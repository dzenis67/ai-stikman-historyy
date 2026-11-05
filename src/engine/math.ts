import type {Pt, TimeRef, Word} from './types';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Smootherstep: starts slowly, speeds up, settles slowly (zero velocity and acceleration at both ends).
export const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * k * (k * (k * 6 - 15) + 10);
};
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

export const makeTime = (words: Word[], offset: number) => (ref: TimeRef | undefined): number => {
  if (ref === undefined || ref === null) return NaN;
  if (typeof ref === 'number') return ref;
  const m = /^w(\d+)(\.end)?\s*([+-]\s*\d*\.?\d+)?$/.exec(ref.trim());
  if (!m) throw new Error(`Bad time reference "${ref}"`);
  const w = words[Number(m[1])];
  if (!w) return NaN; // words not loaded yet
  const delta = m[3] ? parseFloat(m[3].replace(/\s+/g, '')) : 0;
  return offset + (m[2] ? w.end : w.start) + delta;
};

// Monotone cubic (Fritsch–Butland) through keyframes. Zero slope at both ends and at
// every hold or turn, so moves ease in and out; consecutive moves in one direction flow on.
export const monotone = (ts: number[], vs: number[], t: number): number => {
  const n = ts.length;
  if (n === 0) return NaN;
  if (n === 1 || t <= ts[0]) return vs[0];
  if (t >= ts[n - 1]) return vs[n - 1];
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(ts[i + 1] - ts[i]);
    d.push((vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]));
  }
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) continue;
    const w1 = 2 * h[i] + h[i - 1];
    const w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  let i = 0;
  while (i < n - 2 && t > ts[i + 1]) i++;
  const u = (t - ts[i]) / h[i];
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * vs[i] +
    (u3 - 2 * u2 + u) * h[i] * m[i] +
    (-2 * u3 + 3 * u2) * vs[i + 1] +
    (u3 - u2) * h[i] * m[i + 1]
  );
};

// Fade envelope 0..1 from in/out times.
export const envelope = (t: number, tin: number, din: number, tout: number, dout: number) => {
  const a = Number.isFinite(tin) ? smooth((t - tin) / din) : 1;
  const b = Number.isFinite(tout) ? 1 - smooth((t - tout) / dout) : 1;
  return a * b;
};

// Sample a path (Catmull–Rom when smooth) into a polyline with cumulative lengths.
export interface Poly { pts: Pt[]; acc: number[]; length: number }
export const samplePath = (raw: Pt[], closed: boolean, smoothPath: boolean): Poly => {
  const P = raw.slice();
  const out: Pt[] = [];
  const segs = closed ? P.length : P.length - 1;
  const get = (i: number) => (closed ? P[(i + P.length) % P.length] : P[Math.max(0, Math.min(P.length - 1, i))]);
  for (let s = 0; s < segs; s++) {
    const p0 = get(s - 1), p1 = get(s), p2 = get(s + 1), p3 = get(s + 2);
    const N = smoothPath ? 16 : 1;
    for (let k = 0; k < N; k++) {
      const u = k / N;
      if (!smoothPath) { out.push(p1); continue; }
      const u2 = u * u, u3 = u2 * u;
      const f = (a: number, b: number, c: number, e: number) =>
        0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - e) * u2 + (-a + 3 * b - 3 * c + e) * u3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(closed ? P[0] : P[P.length - 1]);
  const acc = [0];
  for (let i = 1; i < out.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  }
  return {pts: out, acc, length: acc[acc.length - 1]};
};

export const pointAt = (p: Poly, s: number): Pt => {
  const L = Math.max(0, Math.min(p.length, s));
  let i = 1;
  while (i < p.acc.length - 1 && p.acc[i] < L) i++;
  const a = p.acc[i - 1], b = p.acc[i];
  const k = b > a ? (L - a) / (b - a) : 0;
  return [lerp(p.pts[i - 1][0], p.pts[i][0], k), lerp(p.pts[i - 1][1], p.pts[i][1], k)];
};

// Polyline between two arc lengths.
export const subPath = (p: Poly, s0: number, s1: number): Pt[] => {
  const a = Math.max(0, s0), b = Math.min(p.length, s1);
  if (b <= a) return [];
  const res: Pt[] = [pointAt(p, a)];
  for (let i = 0; i < p.acc.length; i++) if (p.acc[i] > a && p.acc[i] < b) res.push(p.pts[i]);
  res.push(pointAt(p, b));
  return res;
};

export const toD = (pts: Pt[], close = false) =>
  pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join(' ') + (close ? ' Z' : '');
