import * as THREE from 'three';
import { canvasTex, gradMap, noOutline, toon } from './materials';

/**
 * 코드로 만든 관절 캐릭터.
 * 뼈대 계층: hips → spine → chest → neck → head, chest → ua(어깨) → el(팔꿈치) → ha(손),
 * hips → th(엉덩이) → kn(무릎) → an(발목). L = 캐릭터 왼쪽(+x), R = 오른쪽(-x).
 */
export type BoneName =
  | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'uaL' | 'elL' | 'haL' | 'uaR' | 'elR' | 'haR'
  | 'thL' | 'knL' | 'anL' | 'thR' | 'knR' | 'anR';

export interface Rig {
  root: THREE.Group;
  b: Record<BoneName, THREE.Group>;
  meshes: THREE.Mesh[];
  rest: { hipsY: number };
}

export interface RigOptions {
  jersey: THREE.Material;
  cap: THREE.Material;
  pants: THREE.Material;
  socks: THREE.Material;
  sleeve?: THREE.Material;
  skin: number;
  glove?: boolean;
  /** 등번호. null/undefined면 번호판 없음 */
  number?: string | null;
}

const GEO: Record<string, THREE.BufferGeometry> = {};
const capG = (r: number, l: number) => (GEO['c' + r + l] ||= new THREE.CapsuleGeometry(r, l, 5, 12));
const sphG = () => (GEO.s ||= new THREE.SphereGeometry(1, 18, 14));
const cylG = () => (GEO.cy ||= new THREE.CylinderGeometry(1, 1, 1, 18));
const domeG = () => (GEO.dome ||= new THREE.SphereGeometry(0.124, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2));
const brimG = () => (GEO.brim ||= new THREE.CylinderGeometry(0.105, 0.105, 0.014, 20, 1, false, -Math.PI / 2, Math.PI));
const shoeG = () => (GEO.shoe ||= new THREE.CapsuleGeometry(0.05, 0.16, 4, 8));
const planeG = (s: number) => (GEO['p' + s] ||= new THREE.PlaneGeometry(s, s));

const eyeMat = toon(0x111111);
const darkMat = toon(0x1c1c22);
const gloveMat = toon(0x8b5a2b);
const lipMat = toon(0x9a4b3b);

function numberMat(n: string, size: number) {
  const t = canvasTex(128, 128, (x) => {
    x.font = `900 ${size}px sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineWidth = 8;
    x.strokeStyle = '#0006';
    x.strokeText(n, 64, 68);
    x.fillStyle = '#fff';
    x.fillText(n, 64, 68);
  });
  return noOutline(new THREE.MeshToonMaterial({ map: t, transparent: true, gradientMap: gradMap, depthWrite: false }));
}

type V = [number, number, number];

export function makeCharacter(o: RigOptions): Rig {
  const root = new THREE.Group();
  const b = {} as Record<BoneName, THREE.Group>;
  const meshes: THREE.Mesh[] = [];
  const bone = (name: BoneName, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    b[name] = g;
    return g;
  };
  const part = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, p: V = [0, 0, 0], s: V = [1, 1, 1], r: V = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p);
    m.scale.set(...s);
    m.rotation.set(...r);
    m.castShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };
  const skin = toon(o.skin);

  bone('hips', root, 0, 0.98, 0);
  part(b.hips, sphG(), o.pants, [0, 0, 0], [0.155, 0.135, 0.115]);
  part(b.hips, cylG(), darkMat, [0, 0.1, 0], [0.15, 0.035, 0.115]);
  bone('spine', b.hips, 0, 0.1, 0);
  part(b.spine, sphG(), o.jersey, [0, 0.08, 0], [0.142, 0.19, 0.1]);
  bone('chest', b.spine, 0, 0.17, 0);
  part(b.chest, capG(0.115, 0.2), o.jersey, [0, 0.11, 0], [1.4, 1, 0.72]);
  if (o.number != null) {
    part(b.chest, planeG(0.1), numberMat(o.number, 84), [0.075, 0.18, 0.124]).castShadow = false;
    part(b.chest, planeG(0.22), numberMat(o.number, 100), [0, 0.13, -0.125], [1, 1, 1], [0, Math.PI, 0]).castShadow = false;
  }
  bone('neck', b.chest, 0, 0.32, 0);
  part(b.neck, cylG(), skin, [0, 0.03, 0], [0.05, 0.12, 0.05]);
  bone('head', b.neck, 0, 0.08, 0);
  part(b.head, sphG(), skin, [0, 0.1, 0.005], [0.11, 0.124, 0.115]);
  for (const s of [1, -1]) {
    part(b.head, sphG(), skin, [s * 0.108, 0.095, 0], [0.016, 0.03, 0.024]);
    part(b.head, sphG(), eyeMat, [s * 0.042, 0.11, 0.104], [0.014, 0.017, 0.01]);
    part(b.head, sphG(), eyeMat, [s * 0.045, 0.142, 0.1], [0.026, 0.006, 0.01], [0, 0, -s * 0.12]);
  }
  part(b.head, sphG(), skin, [0, 0.083, 0.118], [0.017, 0.022, 0.02]);
  part(b.head, sphG(), lipMat, [0, 0.045, 0.104], [0.03, 0.007, 0.01]);
  part(b.head, domeG(), o.cap, [0, 0.13, 0], [1, 0.85, 1.03]);
  part(b.head, brimG(), o.cap, [0, 0.133, 0.075], [1, 1, 1.25], [0.12, 0, 0]);

  for (const [s, L] of [[1, 'L'], [-1, 'R']] as const) {
    const ua = bone(`ua${L}`, b.chest, s * 0.215, 0.25, 0);
    part(ua, capG(0.055, 0.08), o.jersey, [0, -0.055, 0]);
    part(ua, capG(0.044, 0.18), o.sleeve || skin, [0, -0.15, 0]);
    const el = bone(`el${L}`, ua, 0, -0.29, 0);
    part(el, capG(0.038, 0.18), o.sleeve || skin, [0, -0.12, 0]);
    const ha = bone(`ha${L}`, el, 0, -0.25, 0);
    if (o.glove && s === 1) part(ha, sphG(), gloveMat, [0, -0.07, 0.02], [0.06, 0.1, 0.09]);
    else part(ha, sphG(), skin, [0, -0.045, 0], [0.042, 0.058, 0.03]);
    const th = bone(`th${L}`, b.hips, s * 0.1, -0.04, 0);
    part(th, capG(0.07, 0.3), o.pants, [0, -0.2, 0]);
    const kn = bone(`kn${L}`, th, 0, -0.44, 0);
    part(kn, capG(0.064, 0.06), o.pants, [0, -0.04, 0]);
    part(kn, capG(0.052, 0.28), o.socks, [0, -0.21, 0]);
    const an = bone(`an${L}`, kn, 0, -0.42, 0);
    part(an, shoeG(), darkMat, [0, -0.025, 0.06], [1.1, 1, 0.9], [Math.PI / 2, 0, 0]);
  }
  root.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) m.userData.ownerRoot = root;
  });
  return { root, b, meshes, rest: { hipsY: 0.98 } };
}

/** 팀 색으로 유니폼 재질 세트 생성 */
export function teamMats(color: string) {
  const c = new THREE.Color(color);
  return {
    jersey: toon(c),
    cap: toon(c.clone().multiplyScalar(0.85)),
    socks: toon(c.clone().multiplyScalar(0.75)),
    pants: toon(0xf1f1ee),
  };
}
