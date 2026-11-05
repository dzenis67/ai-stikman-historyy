import React, {useMemo} from 'react';
import type {GlowFx, LightFx, MagnifierFx, Pt, PuffFx, Settings} from './types';
import {easeOut, envelope, lerp, samplePath, smooth, subPath, toD} from './math';

// All effects draw inside a picture's own SVG (units = picture pixels), so they stay on it
// whatever the picture or the camera does.
interface Common {
  t: number;
  time: (r: string | number | undefined) => number;
  iw: number;
  ih: number;
  k: number; // picture pixels per world unit
  pxToLocal: number; // screen px -> picture pixels
  s: Settings;
  id: string;
}

const toPx = (p: Pt, iw: number, ih: number): Pt => [p[0] * iw, p[1] * ih];

const Gradients: React.FC<{id: string; s: Settings}> = ({id, s}) => (
  <>
    <radialGradient id={`${id}-halo`}>
      <stop offset="0%" stopColor={s.style.accent} stopOpacity={0.75} />
      <stop offset="35%" stopColor={s.style.accent} stopOpacity={0.38} />
      <stop offset="70%" stopColor={s.style.accent} stopOpacity={0.1} />
      <stop offset="100%" stopColor={s.style.accent} stopOpacity={0} />
    </radialGradient>
    <radialGradient id={`${id}-core`}>
      <stop offset="0%" stopColor={s.style.accentCore} stopOpacity={0.95} />
      <stop offset="45%" stopColor={s.style.accentCore} stopOpacity={0.55} />
      <stop offset="100%" stopColor={s.style.accent} stopOpacity={0} />
    </radialGradient>
  </>
);

export const Light: React.FC<Common & {e: LightFx}> = ({e, t, time, iw, ih, k, s, id}) => {
  const poly = useMemo(
    () => samplePath(e.path.map((p) => toPx(p, iw, ih)), !!e.closed, e.smooth !== false),
    [e.path, e.closed, e.smooth, iw, ih],
  );
  const start = time(e.start);
  const end = time(e.end);
  if (!(t > start - 0.02 && t < end + 0.7)) return null;
  const p = smooth((t - start) / (end - start));
  const alpha = smooth((t - start) / 0.35) * (1 - smooth((t - end + 0.1) / 0.6));
  if (alpha <= 0.002) return null;
  const head = poly.length * p;
  const trail = e.trail * k * lerp(0.35, 1, smooth((t - start) / 0.5));
  const size = e.size * k;
  const [hx, hy] = (() => {
    const q = subPath(poly, head - 0.01, head);
    return q.length ? q[q.length - 1] : poly.pts[0];
  })();
  const N = 14;
  const segs: React.ReactNode[] = [];
  for (let i = 0; i < N; i++) {
    const a = head - trail + (trail * i) / N;
    const b = head - trail + (trail * (i + 1)) / N + 0.5;
    const pts = subPath(poly, a, b);
    if (pts.length < 2) continue;
    const f = (i + 1) / N;
    segs.push(
      <path
        key={i}
        d={toD(pts)}
        fill="none"
        stroke={s.style.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={size * (0.18 + 0.32 * f)}
        strokeOpacity={0.55 * f * f}
      />,
    );
  }
  return (
    <g opacity={alpha}>
      <defs>
        <Gradients id={id} s={s} />
        <filter id={`${id}-blur`} filterUnits="userSpaceOnUse" x={-iw} y={-ih} width={iw * 3} height={ih * 3}>
          <feGaussianBlur stdDeviation={size * 0.22} />
        </filter>
      </defs>
      <g filter={`url(#${id}-blur)`}>{segs}</g>
      <circle cx={hx} cy={hy} r={size * 1.25} fill={`url(#${id}-halo)`} />
      <circle cx={hx} cy={hy} r={size * 0.42} fill={`url(#${id}-core)`} />
    </g>
  );
};

export const Puff: React.FC<Common & {e: PuffFx}> = ({e, t, time, iw, ih, k, s, id}) => {
  const start = time(e.start);
  if (!(t > start && t < start + e.duration + 1)) return null;
  const [ax, ay] = toPx(e.at, iw, ih);
  const len = Math.hypot(e.dir[0], e.dir[1]) || 1;
  const dx = e.dir[0] / len, dy = e.dir[1] / len;
  const size = e.size * k;
  const blobs: React.ReactNode[] = [];
  const spread = [0, 0.6, -0.5, 0.25, -0.2, 0.45];
  for (let i = 0; i < 6; i++) {
    const tau = (t - start - i * 0.12) / e.duration;
    if (tau <= 0 || tau >= 1) continue;
    const travel = size * (0.2 + 2.3 * easeOut(tau)) * (1 - i * 0.07);
    const side = size * spread[i] * easeOut(tau) * 0.6;
    const x = ax + dx * travel - dy * side;
    const y = ay + dy * travel + dx * side - size * 0.4 * tau;
    const r = size * (0.35 + 1.0 * easeOut(tau)) * (1 - i * 0.05);
    const o = 0.6 * smooth(tau / 0.2) * (1 - smooth((tau - 0.3) / 0.7));
    blobs.push(<circle key={i} cx={x} cy={y} r={r} fill={`url(#${id}-halo)`} opacity={o} />);
  }
  return (
    <g>
      <defs>
        <Gradients id={id} s={s} />
      </defs>
      {blobs}
    </g>
  );
};

export const Glow: React.FC<Common & {e: GlowFx}> = ({e, t, time, iw, ih, k, s, id}) => {
  const f = s.fade;
  const env = envelope(t, time(e.in), e.inDur ?? f.duration, time(e.out), e.outDur ?? f.duration);
  if (env <= 0.002) return null;
  const d = toD(e.path.map((p) => toPx(p, iw, ih)), true);
  return (
    <g>
      <defs>
        <filter id={`${id}-glow`} filterUnits="userSpaceOnUse" x={-iw} y={-ih} width={iw * 3} height={ih * 3}>
          <feGaussianBlur stdDeviation={e.soft * k} />
        </filter>
      </defs>
      <path d={d} fill={s.style.accent} opacity={e.opacity * env} filter={`url(#${id}-glow)`} />
    </g>
  );
};

// Outer tangent lines between two circles.
const tangents = (c1: Pt, r1: number, c2: Pt, r2: number): [Pt, Pt][] => {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(r2 - r1) + 0.5) return [];
  const th = Math.atan2(dy, dx);
  const ph = Math.acos((r1 - r2) / d);
  return [1, -1].map((sgn) => {
    const a = th + sgn * ph;
    return [
      [c1[0] + r1 * Math.cos(a), c1[1] + r1 * Math.sin(a)],
      [c2[0] + r2 * Math.cos(a), c2[1] + r2 * Math.sin(a)],
    ] as [Pt, Pt];
  });
};

export const Magnifier: React.FC<Common & {e: MagnifierFx; src: string}> = ({
  e, t, time, iw, ih, pxToLocal, s, id, src,
}) => {
  const tin = time(e.in);
  const f = s.fade;
  const out = 1 - (Number.isFinite(time(e.out)) ? smooth((t - time(e.out)) / (e.outDur ?? f.duration)) : 0);
  if (t < tin || out <= 0.002) return null;
  const ring = smooth((t - tin) / 0.45); // small ring draws itself first
  const g = smooth((t - tin - 0.25) / e.grow); // then the lens grows out of the detail
  const sp = toPx(e.source, iw, ih);
  const r1 = e.sourceRadius * iw;
  const target = toPx(e.lens, iw, ih);
  const r2 = e.lensRadius * iw;
  const c: Pt = [lerp(sp[0], target[0], g), lerp(sp[1], target[1], g)];
  const r = lerp(r1, r2, g);
  const mag = r2 / r1;
  const stroke = 2.2 * pxToLocal;
  const lines = tangents(sp, r1, c, r);
  const lensOpacity = smooth(g / 0.12);
  return (
    <g opacity={out}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle cx={c[0]} cy={c[1]} r={r} />
        </clipPath>
      </defs>
      <circle
        cx={sp[0]} cy={sp[1]} r={r1} fill="none" stroke={s.style.line} strokeWidth={stroke}
        pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ring}
      />
      {lines.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={s.style.line} strokeWidth={stroke * 0.8}
          opacity={smooth(g / 0.2)} />
      ))}
      <g opacity={lensOpacity}>
        <g clipPath={`url(#${id}-clip)`}>
          <circle cx={c[0]} cy={c[1]} r={r} fill="#ffffff" />
          <image
            href={src} x={0} y={0} width={iw} height={ih}
            transform={`translate(${c[0]} ${c[1]}) scale(${mag}) translate(${-sp[0]} ${-sp[1]})`}
          />
        </g>
        <circle cx={c[0]} cy={c[1]} r={r} fill="none" stroke={s.style.line} strokeWidth={stroke * 1.2} />
      </g>
    </g>
  );
};
