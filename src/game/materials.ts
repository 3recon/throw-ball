import * as THREE from 'three';

export function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** OutlineEffect 외곽선을 끄는 재질 표시 */
export const noOutline = <M extends THREE.Material>(m: M): M => {
  m.userData.outlineParameters = { visible: false };
  return m;
};

export const lam = (o: THREE.MeshLambertMaterialParameters) => noOutline(new THREE.MeshLambertMaterial(o));

// 3단 툰 그라디언트
const gradMap = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
gradMap.minFilter = gradMap.magFilter = THREE.NearestFilter;
gradMap.needsUpdate = true;
export { gradMap };

export const toon = (c: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color: c, gradientMap: gradMap, ...extra });
