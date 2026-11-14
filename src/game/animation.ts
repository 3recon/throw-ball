import type { BoneName, Rig } from './character';
import { clamp, lerp } from './constants';

/**
 * 키프레임 포즈 애니메이션.
 * 포즈 = 관절별 오일러 [x,y,z] + hp(골반 위치 오프셋). Catmull-Rom 보간, 클립 간 크로스페이드.
 * 각도 규칙: th.x 음수 = 다리 앞으로, kn.x 양수 = 무릎 굽힘, ua.x 음수 = 팔 앞으로,
 * el.x 음수 = 팔꿈치 굽힘, spine.x 양수 = 앞으로 숙임, uaL.z 양수/uaR.z 음수 = 팔 옆으로 벌림.
 */
type Channel = BoneName | 'hp';
type Vec = [number, number, number];
type PoseIn = Partial<Record<Channel, number[]>>;
type Pose = Record<Channel, Vec>;

interface Clip {
  dur: number;
  loop: boolean;
  keys: { t: number; p: Pose }[];
}

const CH: Channel[] = ['hips', 'spine', 'chest', 'neck', 'head', 'uaL', 'elL', 'haL', 'uaR', 'elR', 'haR', 'thL', 'knL', 'anL', 'thR', 'knR', 'anR', 'hp'];
const BASE: PoseIn = {
  uaL: [0, 0, 0.1], uaR: [0, 0, -0.1], elL: [-0.2, 0, 0], elR: [-0.2, 0, 0],
  knL: [0.05, 0, 0], knR: [0.05, 0, 0], thL: [-0.03, 0, 0.02], thR: [-0.03, 0, -0.02],
};
const pad = (v: number[]): Vec => [v[0] || 0, v[1] || 0, v[2] || 0];

function full(p: PoseIn): Pose {
  const o = {} as Pose;
  for (const c of CH) o[c] = pad(p[c] || BASE[c] || [0, 0, 0]);
  return o;
}

/** 좌우 반전 */
export function mirror(p: PoseIn): PoseIn {
  const o: PoseIn = {};
  for (const c of CH) {
    const src = (c.endsWith('L') ? c.slice(0, -1) + 'R' : c.endsWith('R') ? c.slice(0, -1) + 'L' : c) as Channel;
    const s = p[src];
    if (!s) continue;
    const v = pad(s);
    o[c] = c === 'hp' ? [-v[0], v[1], v[2]] : [v[0], -v[1], -v[2]];
  }
  return o;
}

const clip = (dur: number, loop: boolean, keys: [number, PoseIn][]): Clip => ({ dur, loop, keys: keys.map(([t, p]) => ({ t, p: full(p) })) });
const cycle = (dur: number, A: PoseIn, B: PoseIn) =>
  clip(dur, true, [[0, A], [dur * 0.25, B], [dur * 0.5, mirror(A)], [dur * 0.75, mirror(B)], [dur, A]]);

const IDLE_A: PoseIn = { thL: [-0.05, 0, 0.05], knL: [0.1], anL: [-0.05], thR: [-0.05, 0, -0.05], knR: [0.1], anR: [-0.05] };
const STAND_LIE: PoseIn = { hips: [-1.52], hp: [0, -0.81, -0.55], head: [0.05, 0.35, 0], uaL: [0, 0, 1.1], elL: [-0.4], uaR: [0, 0, -1.3], elR: [-0.2], thL: [-0.1, 0, 0.1], knL: [0.15], thR: [-0.22, 0, -0.1], knR: [0.6], anL: [0.3], anR: [0.2] };
const P_SET: PoseIn = { hips: [0, -0.25, 0], spine: [0.12], head: [0, 0.25, 0], uaL: [-0.45, 0, -0.25], elL: [-1.75], uaR: [-0.4, 0, 0.25], elR: [-1.8], thL: [-0.12, 0, 0.08], knL: [0.2], anL: [-0.1], thR: [-0.08, 0, -0.08], knR: [0.15], anR: [-0.08] };
const P_LIFT: PoseIn = { hips: [0, -1.25, 0], hp: [0, 0.02, 0], spine: [0.05, 0, 0.06], chest: [0, -0.2, 0], head: [0, 1.35, 0], thL: [-1.5], knL: [1.75], anL: [0.35], thR: [-0.08], knR: [0.25], anR: [-0.1], uaL: [-0.6, 0, -0.3], elL: [-1.6], uaR: [-0.6, 0, 0.3], elR: [-1.6] };
const PLEAD = (sy: number, ua: number, el: number): PoseIn => ({ ...IDLE_A, spine: [0.25, sy, 0], head: [0.15], uaL: [ua, 0, -0.38], elL: [el], uaR: [ua, 0, 0.38], elR: [el] });
const BOW: PoseIn = { spine: [0.85], chest: [0.3], head: [0.3], hp: [0, -0.02, -0.07], uaL: [0.1, 0, 0.05], uaR: [0.1, 0, -0.05], elL: [-0.1], elR: [-0.1] };

export const CLIPS = {
  idle: clip(3.2, true, [[0, IDLE_A], [1.6, { ...IDLE_A, hp: [0.015, -0.012, 0], chest: [0.04], spine: [0, 0.06, 0], head: [0.06, 0.18, 0], uaL: [0, 0, 0.15], uaR: [0.05, 0, -0.15] }], [3.2, IDLE_A]]),
  walk: cycle(0.95,
    { hp: [0, -0.02, 0], spine: [0.05, 0.08, 0], thL: [-0.45], knL: [0.12], anL: [-0.2], thR: [0.35], knR: [0.35], anR: [0.3], uaL: [0.4, 0, 0.1], elL: [-0.25], uaR: [-0.4, 0, -0.1], elR: [-0.55] },
    { hp: [0, 0.02, 0], spine: [0.05], thL: [-0.05], knL: [0.1], thR: [-0.35], knR: [1.0], anR: [0.15], uaL: [0, 0, 0.1], uaR: [0, 0, -0.1], elL: [-0.35], elR: [-0.35] }),
  dodge: clip(0.62, false, [
    [0, { hp: [0, -0.08, 0], thL: [-0.3, 0, 0.1], knL: [0.5], thR: [-0.3, 0, -0.1], knR: [0.5], spine: [0.2] }],
    [0.13, { hp: [0, -0.32, 0], thL: [-0.45, 0, 0.7], knL: [1.15], anL: [-0.35, 0, -0.35], thR: [-0.1, 0, -0.55], knR: [0.15], anR: [0.2, 0, 0.3], spine: [0.25, 0, -0.45], chest: [0.1, 0.2, -0.15], head: [0, 0, 0.3], uaL: [-0.3, 0, 1.3], elL: [-0.8], uaR: [-0.6, 0, -1.9], elR: [-1.0] }],
    [0.38, { hp: [0, -0.34, 0], thL: [-0.5, 0, 0.75], knL: [1.25], anL: [-0.4, 0, -0.4], thR: [-0.1, 0, -0.6], knR: [0.12], anR: [0.2, 0, 0.35], spine: [0.3, 0, -0.5], chest: [0.1, 0.25, -0.15], head: [0, -0.2, 0.3], uaL: [-0.2, 0, 1.4], elL: [-0.6], uaR: [-0.5, 0, -2.1], elR: [-0.8] }],
    [0.62, { hp: [0, -0.06, 0], thL: [-0.2, 0, 0.15], knL: [0.35], thR: [-0.2, 0, -0.12], knR: [0.35], spine: [0.1] }]]),
  duck: clip(0.8, false, [
    [0, { hp: [0, -0.05, 0] }],
    [0.14, { hp: [0, -0.58, -0.1], thL: [-1.7, 0, 0.15], knL: [2.3], anL: [-0.6], thR: [-1.7, 0, -0.15], knR: [2.3], anR: [-0.6], spine: [0.7], chest: [0.3], head: [0.4], uaL: [-2.7, 0, 0.35], elL: [-1.5], uaR: [-2.7, 0, -0.35], elR: [-1.5] }],
    [0.55, { hp: [0, -0.58, -0.1], thL: [-1.7, 0, 0.15], knL: [2.3], anL: [-0.6], thR: [-1.7, 0, -0.15], knR: [2.3], anR: [-0.6], spine: [0.75], chest: [0.3], head: [0.45, 0.1, 0], uaL: [-2.75, 0, 0.3], elL: [-1.55], uaR: [-2.75, 0, -0.3], elR: [-1.55] }],
    [0.8, { hp: [0, -0.12, 0], thL: [-0.4], knL: [0.7], anL: [-0.2], thR: [-0.4], knR: [0.7], anR: [-0.2], spine: [0.3] }]]),
  panic: clip(0.5, true, [
    [0, { hp: [0, -0.1, 0], spine: [-0.12], head: [0.3, 0.45, 0], uaL: [-1.9, 0, -0.35], elL: [-1.9], uaR: [-1.9, 0, 0.35], elR: [-1.9], thL: [-0.35, 0, 0.1], knL: [0.6], anL: [-0.25], thR: [-0.35, 0, -0.1], knR: [0.6], anR: [-0.25] }],
    [0.25, { hp: [0.02, -0.12, 0], spine: [-0.15, 0, 0.05], head: [0.35, 0.55, 0], uaL: [-1.95, 0, -0.3], elL: [-1.95], uaR: [-1.85, 0, 0.4], elR: [-1.85], thL: [-0.37, 0, 0.1], knL: [0.65], anL: [-0.27], thR: [-0.33, 0, -0.1], knR: [0.58], anR: [-0.24] }],
    [0.5, { hp: [0, -0.1, 0], spine: [-0.12], head: [0.3, 0.45, 0], uaL: [-1.9, 0, -0.35], elL: [-1.9], uaR: [-1.9, 0, 0.35], elR: [-1.9], thL: [-0.35, 0, 0.1], knL: [0.6], anL: [-0.25], thR: [-0.35, 0, -0.1], knR: [0.6], anR: [-0.25] }]]),
  knockdown: clip(0.95, false, [
    [0, { spine: [-0.45], chest: [-0.2], head: [-0.6], uaL: [-0.3, 0, 1.2], uaR: [-0.3, 0, -1.2], elL: [-0.6], elR: [-0.6], hp: [0, 0, -0.05], thL: [-0.2], knL: [0.3] }],
    [0.18, { hips: [-0.5], hp: [0, -0.25, -0.25], spine: [-0.3], head: [-0.35], uaL: [-1.0, 0, 1.5], uaR: [-1.0, 0, -1.5], elL: [-0.4], elR: [-0.4], thL: [-0.6], knL: [0.6], thR: [-0.3], knR: [0.4] }],
    [0.45, { hips: [-1.5], hp: [0, -0.8, -0.5], spine: [0.1], head: [0.3], uaL: [0.2, 0, 1.5], uaR: [0.2, 0, -1.5], elL: [-0.3], elR: [-0.3], thL: [-1.0], knL: [0.5], thR: [-0.7], knR: [0.3] }],
    [0.62, { hips: [-1.5], hp: [0, -0.81, -0.55], head: [0.1], uaL: [0.1, 0, 1.3], elL: [-0.3], uaR: [0.05, 0, -1.4], thL: [-0.25], knL: [0.2], thR: [-0.15], knR: [0.5] }],
    [0.95, STAND_LIE]]),
  getup: clip(1.15, false, [
    [0, STAND_LIE],
    [0.35, { hips: [-1.5], hp: [0, -0.81, -0.55], spine: [1.1], chest: [0.2], head: [0.25], thL: [-0.5], knL: [1.4], anL: [0.2], thR: [-0.3, 0, -0.1], knR: [0.9], uaL: [0.5, 0, 0.4], elL: [-0.1], uaR: [0.5, 0, -0.4], elR: [-0.1] }],
    [0.75, { hips: [0.3], hp: [0, -0.42, -0.15], spine: [0.4], thL: [-1.6, 0, 0.15], knL: [2.0], anL: [-0.7], thR: [-1.6, 0, -0.15], knR: [2.0], anR: [-0.7], uaL: [-0.6, 0, 0.3], elL: [-0.6], uaR: [-0.6, 0, -0.3], elR: [-0.6] }],
    [1.15, IDLE_A]]),
  bow: clip(1.8, false, [[0, IDLE_A], [0.45, BOW], [1.3, { ...BOW, spine: [0.9], head: [0.35] }], [1.8, IDLE_A]]),
  plead: clip(1.6, false, [[0, IDLE_A],
    [0.3, PLEAD(0, -0.75, -1.65)], [0.5, PLEAD(0.08, -0.6, -1.75)], [0.7, PLEAD(-0.08, -0.78, -1.62)],
    [0.9, PLEAD(0.08, -0.6, -1.75)], [1.2, PLEAD(0, -0.75, -1.65)], [1.6, IDLE_A]]),
  p_idle: clip(2.4, true, [[0, P_SET], [1.2, { ...P_SET, spine: [0.16], chest: [0.03], head: [0.03, 0.3, 0] }], [2.4, P_SET]]),
  windup: clip(0.45, false, [[0, P_SET], [0.2, { ...P_SET, hips: [0, -0.7, 0], head: [0, 0.8, 0], thL: [-0.7], knL: [0.9], uaL: [-0.55, 0, -0.28], uaR: [-0.55, 0, 0.28] }], [0.45, P_LIFT]]),
  pitch: clip(0.66, false, [
    [0, P_LIFT],
    [0.12, { hips: [0, -1.1, 0], hp: [0, -0.15, 0.3], thL: [-0.8, 0, 0.1], knL: [0.5], thR: [0.15], knR: [0.5], anR: [0.3], spine: [-0.05, 0, 0.1], chest: [0, -0.35, 0], head: [0, 1.3, 0], uaL: [0, 0, 1.4], elL: [-0.4], uaR: [-1.57, 0, -1.57], elR: [-1.6] }],
    [0.2, { hips: [0, 0.2, 0], hp: [0, -0.2, 0.5], thL: [-0.7], knL: [0.4], anL: [0.2], thR: [0.5], knR: [0.4], spine: [0.45], chest: [0.15, 0.3, 0], head: [-0.3, -0.4, 0], uaL: [-0.4, 0, 0.6], elL: [-1.8], uaR: [-2.3, 0, -0.4], elR: [-0.25] }],
    [0.36, { hips: [0, 0.45, 0], hp: [0, -0.25, 0.55], spine: [0.75], chest: [0.2, 0.3, 0], head: [-0.6, -0.5, 0], thL: [-0.8], knL: [0.7], anL: [0.15], thR: [0.9], knR: [1.0], uaR: [-0.5, 0, 0.7], elR: [-0.7], uaL: [0.2, 0, 0.4], elL: [-1.6] }],
    [0.66, { ...P_SET, hp: [0, 0, 0.2] }]]),
} satisfies Record<string, Clip>;

export type ClipName = keyof typeof CLIPS;

function sampleClip(c: Clip, t: number, mirrorIt: boolean, out: Pose): Pose {
  const keys = c.keys;
  const n = keys.length;
  t = c.loop ? ((t % c.dur) + c.dur) % c.dur : clamp(t, 0, c.dur);
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const idx = (j: number) => (c.loop ? (j < 0 ? j + n - 1 : j > n - 1 ? j - (n - 1) : j) : clamp(j, 0, n - 1));
  const k0 = keys[idx(i - 1)];
  const k3 = keys[idx(i + 2)];
  const u = clamp((t - k1.t) / Math.max(1e-6, k2.t - k1.t), 0, 1);
  const u2 = u * u;
  const u3 = u2 * u;
  for (const ch of CH) {
    const a = k0.p[ch], p1 = k1.p[ch], p2 = k2.p[ch], d = k3.p[ch];
    const r = out[ch] || (out[ch] = [0, 0, 0]);
    for (let j = 0; j < 3; j++)
      r[j] = 0.5 * (2 * p1[j] + (-a[j] + p2[j]) * u + (2 * a[j] - 5 * p1[j] + 4 * p2[j] - d[j]) * u2 + (-a[j] + 3 * p1[j] - 3 * p2[j] + d[j]) * u3);
  }
  if (mirrorIt) {
    const m = mirror(out);
    for (const ch of CH) out[ch] = m[ch] as Vec;
  }
  return out;
}

interface Playing {
  name: ClipName;
  c: Clip;
  t: number;
  mirror: boolean;
}

export class Animator {
  private cur: Playing | null = null;
  private prev: Playing | null = null;
  private w = 1;
  private fadeDur = 0.15;
  private A = {} as Pose;
  private B = {} as Pose;

  constructor(private rig: Rig) {}

  play(name: ClipName, { mirror = false, fade = 0.18, restart = false } = {}) {
    if (!restart && this.cur && this.cur.name === name && this.cur.mirror === mirror) return;
    this.prev = this.cur;
    this.cur = { name, c: CLIPS[name], t: 0, mirror };
    this.w = this.prev ? 0 : 1;
    this.fadeDur = fade;
  }

  get name() {
    return this.cur?.name;
  }
  get time() {
    return this.cur ? this.cur.t : 0;
  }
  set time(t: number) {
    if (this.cur) this.cur.t = t;
  }

  update(dt: number) {
    const cur = this.cur;
    if (!cur) return;
    cur.t += dt;
    if (this.prev) this.prev.t += dt;
    this.w = Math.min(1, this.w + dt / this.fadeDur);
    const B = sampleClip(cur.c, cur.t, cur.mirror, this.B);
    let P = B;
    if (this.prev && this.w < 1) {
      const A = sampleClip(this.prev.c, this.prev.t, this.prev.mirror, this.A);
      const k = this.w * this.w * (3 - 2 * this.w);
      for (const ch of CH) for (let j = 0; j < 3; j++) A[ch][j] = lerp(A[ch][j], B[ch][j], k);
      P = A;
    }
    const b = this.rig.b;
    for (const ch of CH) {
      if (ch === 'hp') continue;
      const v = P[ch];
      b[ch].rotation.set(v[0], v[1], v[2]);
    }
    b.hips.position.set(P.hp[0], this.rig.rest.hipsY + P.hp[1], P.hp[2]);
  }
}
