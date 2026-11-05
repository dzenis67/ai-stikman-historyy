// A time is seconds on the video timeline, or a word reference:
// "w12" = start of word 12, "w12.end" = end of word 12, optional "+0.3" / "-0.2".
export type TimeRef = number | string;
export type Pt = [number, number];

export interface Word { i: number; text: string; start: number; end: number }
export interface WordsFile { audio: string; duration: number; words: Word[] }

export interface Keyframe {
  t: TimeRef;
  x?: number; y?: number; scale?: number; rotate?: number; opacity?: number; blur?: number;
}

export interface CameraKey { t: TimeRef; x: number; y: number; zoom: number }

export interface LayerDef {
  id: string;
  src: string;
  size: [number, number]; // picture size in pixels
  x: number; y: number;   // centre, world units
  width: number;          // world units
  depth?: number;         // 1 = page; <1 = farther (slower, blurred); >1 = nearer
  depthBlur?: number;     // extra blur in screen px for far layers
  scale?: number; rotate?: number; opacity?: number;
  in?: TimeRef; inDur?: number;
  out?: TimeRef; outDur?: number;
  anim?: Keyframe[];
}

export interface LightFx {
  type: 'light'; layer: string; path: Pt[]; start: TimeRef; end: TimeRef;
  size: number; trail: number; closed?: boolean; smooth?: boolean;
}
export interface PuffFx {
  type: 'puff'; layer: string; at: Pt; start: TimeRef; duration: number; dir: Pt; size: number;
}
export interface GlowFx {
  type: 'glow'; layer: string; path: Pt[]; in: TimeRef; inDur?: number; out?: TimeRef; outDur?: number;
  opacity: number; soft: number;
}
export interface MagnifierFx {
  type: 'magnifier'; layer: string; source: Pt; sourceRadius: number; lens: Pt; lensRadius: number;
  in: TimeRef; grow: number; out?: TimeRef; outDur?: number;
}
export interface LabelFx {
  type: 'label'; text: string; x: number; y: number; size: number;
  in: TimeRef; out?: TimeRef; inDur?: number; outDur?: number;
  underline?: boolean; onPage?: boolean;
}
export type Effect = LightFx | PuffFx | GlowFx | MagnifierFx | LabelFx;

export interface DotGrid { spacing: number; radius: number; color: string; depth: number; blur?: number }

export interface Settings {
  name: string;
  about?: string;
  canvas: {width: number; height: number; fps: number; background: string; focus: Pt;
    safe: {top: number; bottom: number}};
  style: {accent: string; accentCore: string; ink: string; line: string;
    font: {family: string; src: string; weight: number}; letterSpacing: number};
  dots: DotGrid[];
  audio: {src: string; words: string; offset: number; tail: number};
  fade: {duration: number; scale: number; blur: number};
  camera: CameraKey[];
  layers: LayerDef[];
  effects: Effect[];
}
