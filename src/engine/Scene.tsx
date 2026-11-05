import React, {useEffect, useMemo, useState} from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {Effect, LabelFx, LayerDef, Settings, Word} from './types';
import {envelope, lerp, makeTime, monotone, smooth} from './math';
import {Glow, Light, Magnifier, Puff} from './effects';

export interface SceneProps {
  settings: Settings;
  words: Word[];
  [key: string]: unknown;
}

type T = (r: string | number | undefined) => number;

interface Cam { x: number; y: number; zoom: number }

const cameraAt = (s: Settings, time: T, t: number): Cam => {
  const keys = s.camera.map((k) => ({...k, tt: time(k.t)})).sort((a, b) => a.tt - b.tt);
  const ts = keys.map((k) => k.tt);
  return {
    x: monotone(ts, keys.map((k) => k.x), t),
    y: monotone(ts, keys.map((k) => k.y), t),
    // zoom moves in log space so push-ins and pull-backs feel even
    zoom: Math.exp(monotone(ts, keys.map((k) => Math.log(k.zoom)), t)),
  };
};

// Projection for a layer at a given depth: far layers follow the camera less.
const project = (cam: Cam, depth: number, anchor: [number, number]) => {
  const cx = anchor[0] + (cam.x - anchor[0]) * depth;
  const cy = anchor[1] + (cam.y - anchor[1]) * depth;
  return {cx, cy, z: Math.pow(cam.zoom, depth)};
};

export interface LayerState {
  x: number; y: number; scale: number; rotate: number; opacity: number; blur: number; env: number;
}

const layerState = (l: LayerDef, s: Settings, time: T, t: number): LayerState => {
  const base: Record<string, number> = {
    x: l.x, y: l.y, scale: l.scale ?? 1, rotate: l.rotate ?? 0, opacity: l.opacity ?? 1, blur: 0,
  };
  for (const prop of Object.keys(base)) {
    const kf = (l.anim ?? [])
      .filter((k) => (k as unknown as Record<string, unknown>)[prop] !== undefined)
      .map((k) => [time(k.t), (k as unknown as Record<string, number>)[prop]] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    if (kf.length) base[prop] = monotone(kf.map((k) => k[0]), kf.map((k) => k[1]), t);
  }
  const f = s.fade;
  const env = envelope(t, time(l.in), l.inDur ?? f.duration, time(l.out), l.outDur ?? f.duration);
  return {
    x: base.x,
    y: base.y,
    scale: base.scale * lerp(f.scale, 1, env),
    rotate: base.rotate,
    opacity: base.opacity * env,
    blur: base.blur + (1 - env) * f.blur,
    env,
  };
};

const useFont = (s: Settings) => {
  const [handle] = useState(() => delayRender('font'));
  useEffect(() => {
    const face = new FontFace(s.style.font.family, `url(${staticFile(s.style.font.src)})`, {
      weight: String(s.style.font.weight),
    });
    face
      .load()
      .then((f) => {
        (document.fonts as unknown as {add: (x: FontFace) => void}).add(f);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle, s]);
};

const Dots: React.FC<{s: Settings; cam: Cam}> = ({s, cam}) => {
  const {width, height} = s.canvas;
  const [fx, fy] = s.canvas.focus;
  return (
    <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
      <defs>
        {s.dots.map((d, i) => {
          const {cx, cy, z} = project(cam, d.depth, [0, 0]);
          const size = d.spacing * z;
          const ox = fx - cx * z - size / 2;
          const oy = fy - cy * z - size / 2;
          return (
            <React.Fragment key={i}>
              <pattern id={`dots${i}`} patternUnits="userSpaceOnUse" width={size} height={size} x={ox} y={oy}>
                <circle cx={size / 2} cy={size / 2} r={d.radius * z} fill={d.color} />
              </pattern>
              {d.blur ? (
                <filter id={`dotsBlur${i}`}>
                  <feGaussianBlur stdDeviation={d.blur} />
                </filter>
              ) : null}
            </React.Fragment>
          );
        })}
      </defs>
      {s.dots.map((d, i) => (
        <rect
          key={i}
          width={width}
          height={height}
          fill={`url(#dots${i})`}
          filter={d.blur ? `url(#dotsBlur${i})` : undefined}
        />
      ))}
    </svg>
  );
};

const Layer: React.FC<{
  l: LayerDef; s: Settings; cam: Cam; t: number; time: T; effects: Effect[];
}> = ({l, s, cam, t, time, effects}) => {
  const st = layerState(l, s, time, t);
  if (st.opacity <= 0.002) return null;
  const depth = l.depth ?? 1;
  const {cx, cy, z} = project(cam, depth, [l.x, l.y]);
  const [fx, fy] = s.canvas.focus;
  const [iw, ih] = l.size;
  const w = l.width;
  const h = (w * ih) / iw;
  const screenPerWorld = z * st.scale;
  const blurScreen = st.blur + (l.depthBlur ?? 0);
  const blurLocal = blurScreen / screenPerWorld;
  const k = iw / w; // picture pixels per world unit
  const pxToLocal = k / screenPerWorld; // screen px -> picture pixels
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: '0 0',
        transform: `translate(${fx - cx * z}px, ${fy - cy * z}px) scale(${z})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: st.x - w / 2,
          top: st.y - h / 2,
          width: w,
          height: h,
          transform: `rotate(${st.rotate}deg) scale(${st.scale})`,
          opacity: st.opacity,
          filter: blurLocal > 0.02 ? `blur(${blurLocal}px)` : undefined,
        }}
      >
        <Img src={staticFile(l.src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />
        {effects.length ? (
          <svg
            width={w}
            height={h}
            viewBox={`0 0 ${iw} ${ih}`}
            style={{position: 'absolute', inset: 0, overflow: 'visible'}}
          >
            {effects.map((e, i) => {
              const id = `${l.id}-${i}`;
              const common = {t, time, iw, ih, k, pxToLocal, s, id};
              if (e.type === 'light') return <Light key={i} e={e} {...common} />;
              if (e.type === 'puff') return <Puff key={i} e={e} {...common} />;
              if (e.type === 'glow') return <Glow key={i} e={e} {...common} />;
              if (e.type === 'magnifier') return <Magnifier key={i} e={e} src={staticFile(l.src)} {...common} />;
              return null;
            })}
          </svg>
        ) : null}
      </div>
    </div>
  );
};

const Label: React.FC<{e: LabelFx; s: Settings; cam: Cam; t: number; time: T}> = ({e, s, cam, t, time}) => {
  const f = s.fade;
  const tin = time(e.in);
  const env = envelope(t, tin, e.inDur ?? f.duration, time(e.out), e.outDur ?? f.duration);
  if (env <= 0.002) return null;
  const [fx, fy] = s.canvas.focus;
  const z = cam.zoom;
  const ls = s.style.letterSpacing;
  const draw = smooth((t - tin - 0.2) / 0.7);
  const blurLocal = ((1 - env) * f.blur) / z;
  const halo = e.onPage
    ? '0 0 0.18em #fff, 0 0 0.35em #fff, 0 0 0.6em #fff, 0 0 0.9em rgba(255,255,255,0.9)'
    : undefined;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: '0 0',
        transform: `translate(${fx - cam.x * z}px, ${fy - cam.y * z}px) scale(${z})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: e.x,
          top: e.y,
          transform: `translate(-50%, -50%) scale(${lerp(f.scale, 1, env)})`,
          opacity: env,
          filter: blurLocal > 0.02 ? `blur(${blurLocal}px)` : undefined,
          fontFamily: `'${s.style.font.family}'`,
          fontWeight: s.style.font.weight,
          fontSize: e.size,
          letterSpacing: `${ls}em`,
          paddingLeft: `${ls}em`,
          textTransform: 'uppercase',
          color: s.style.ink,
          whiteSpace: 'nowrap',
          lineHeight: 1,
          textShadow: halo,
        }}
      >
        {e.text}
        {e.underline ? (
          <div
            style={{
              position: 'absolute',
              left: `${ls}em`,
              right: `${ls}em`,
              bottom: '-0.38em',
              height: '0.1em',
              borderRadius: '0.05em',
              background: s.style.accent,
              boxShadow: `0 0 0.3em ${s.style.accent}, 0 0 0.7em ${s.style.accent}`,
              transform: `scaleX(${draw})`,
              transformOrigin: 'left center',
              opacity: 0.95,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export const Scene: React.FC<SceneProps> = ({settings: s, words}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  useFont(s);
  const t = frame / fps;
  const time = useMemo(() => makeTime(words, s.audio.offset), [words, s.audio.offset]);
  const cam = cameraAt(s, time, t);
  const byLayer = useMemo(() => {
    const m: Record<string, Effect[]> = {};
    for (const e of s.effects) if ('layer' in e && e.layer) (m[e.layer] ??= []).push(e);
    return m;
  }, [s.effects]);
  const labels = s.effects.filter((e): e is LabelFx => e.type === 'label');
  return (
    <AbsoluteFill style={{background: s.canvas.background, overflow: 'hidden'}}>
      <Dots s={s} cam={cam} />
      {s.layers.map((l) => (
        <Layer key={l.id} l={l} s={s} cam={cam} t={t} time={time} effects={byLayer[l.id] ?? []} />
      ))}
      {labels.map((e, i) => (
        <Label key={i} e={e} s={s} cam={cam} t={t} time={time} />
      ))}
      <Sequence from={Math.round(s.audio.offset * fps)}>
        <Audio src={staticFile(s.audio.src)} />
      </Sequence>
    </AbsoluteFill>
  );
};
