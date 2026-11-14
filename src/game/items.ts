import * as THREE from 'three';
import { BALL_R } from './constants';
import { canvasTex, toon } from './materials';

/** 던지는 아이템 (매 투구 랜덤): 야구공 · 야구배트 · 치킨닭다리 · 맥주병 */
export const ITEM_TYPES = ['ball', 'bat', 'chicken', 'beer'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

const ballTex = canvasTex(256, 128, (x, w, h) => {
  x.fillStyle = '#fafafa';
  x.fillRect(0, 0, w, h);
  x.strokeStyle = '#dc2626';
  x.lineWidth = 5;
  for (const off of [0, w / 2]) {
    x.beginPath();
    for (let i = 0; i <= w / 2; i += 4) {
      const yy = h / 2 + Math.sin((i / (w / 2)) * Math.PI * 2) * h * 0.3;
      if (i) x.lineTo(off + i, yy);
      else x.moveTo(off + i, yy);
    }
    x.stroke();
  }
});
const ballGeo = new THREE.SphereGeometry(BALL_R, 20, 14);
const ballMat = toon(0xffffff, { map: ballTex });
const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);

export function makeItemMesh(type: ItemType): THREE.Object3D {
  if (type === 'ball') {
    const m = new THREE.Mesh(ballGeo, ballMat);
    m.castShadow = true;
    return m;
  }
  const g = new THREE.Group();
  const at = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    g.add(m);
    return m;
  };
  if (type === 'bat') {
    const wood = toon(0xb07a3c);
    at(cyl(0.05, 0.028, 0.5), wood, 0.17);
    at(cyl(0.023, 0.023, 0.2), toon(0x2b2b2b), -0.07);
    at(cyl(0.033, 0.033, 0.03), wood, -0.18);
  } else if (type === 'chicken') {
    const bone = toon(0xf1e7cf);
    at(new THREE.SphereGeometry(0.1, 14, 12), toon(0xca7a2c), 0.03).scale.set(1, 1.2, 1);
    at(cyl(0.017, 0.017, 0.15, 8), bone, -0.11);
    at(new THREE.SphereGeometry(0.032, 8, 8), bone, -0.18);
  } else {
    const glass = toon(0x2f6a33);
    at(cyl(0.058, 0.058, 0.24, 14), glass, 0);
    at(cyl(0.026, 0.058, 0.07, 14), glass, 0.155);
    at(cyl(0.024, 0.026, 0.08, 12), glass, 0.23);
    at(cyl(0.027, 0.027, 0.02, 12), toon(0xe0b020), 0.28);
    at(cyl(0.0595, 0.0595, 0.1, 14), toon(0xf1e8c8), -0.01);
  }
  g.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) m.castShadow = true;
  });
  return g;
}

/** 손에 쥘 때의 로컬 오프셋 (오른손 본 기준) */
export const HOLD: Record<ItemType, { p: [number, number, number]; r: [number, number, number] }> = {
  ball: { p: [0, -0.08, 0.03], r: [0, 0, 0] },
  bat: { p: [0, -0.1, 0.04], r: [0.3, 0, 0] },
  chicken: { p: [0, -0.12, 0.04], r: [0.4, 0, 0] },
  beer: { p: [0, -0.14, 0.04], r: [0.2, 0, 0] },
};
