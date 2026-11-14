import * as THREE from 'three';
import { PLATE_Z, pick, rand } from './constants';
import { canvasTex, lam, noOutline } from './materials';

const V3 = THREE.Vector3;

/** 하늘·조명·잔디·마운드·파울라인·조명탑 — 팀과 무관한 고정 배경 */
export function buildField(scene: THREE.Scene) {
  scene.background = canvasTex(4, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2f6fb8');
    g.addColorStop(0.55, '#8cc4ec');
    g.addColorStop(1, '#f6e3c4');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(0xcfe3f2, 70, 160);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a7a40, 1.3));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-9, 20, 6);
  sun.target.position.set(0, 0, -8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  scene.add(sun, sun.target);

  const grassTex = canvasTex(256, 256, (x, w, h) => {
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        x.fillStyle = (i + j) % 2 ? '#4f9a3e' : '#5aa847';
        x.fillRect((i * w) / 8, (j * h) / 8, w / 8, h / 8);
      }
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(9, 9);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), lam({ map: grassTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const dirtMat = lam({ color: 0xc58c5a });
  const white = lam({ color: 0xffffff });
  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.set(-Math.PI / 2, 0, ry);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  flat(new THREE.CircleGeometry(4.6, 48), dirtMat, 0, 0.012, PLATE_Z);
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.0, 0.25, 48), dirtMat);
  mound.position.set(0, 0.125, 0);
  mound.receiveShadow = true;
  scene.add(mound);
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.15), white);
  rubber.position.set(0, 0.26, 0.3);
  scene.add(rubber);

  // 홈플레이트
  {
    const s = new THREE.Shape();
    s.moveTo(-0.22, 0);
    s.lineTo(0.22, 0);
    s.lineTo(0.22, -0.22);
    s.lineTo(0, -0.44);
    s.lineTo(-0.22, -0.22);
    s.closePath();
    const m = flat(new THREE.ShapeGeometry(s), white, 0, 0.02, PLATE_Z + 0.2);
    m.rotation.z = Math.PI;
  }

  // 파울라인 + 베이스 라인 흙 + 타석
  for (const sgn of [1, -1]) {
    const dir = new V3(sgn, 0, 1).normalize();
    const ang = Math.atan2(dir.x, dir.z);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 21), dirtMat);
    path.rotation.set(-Math.PI / 2, 0, ang);
    path.position.set(dir.x * 10.5, 0.011, PLATE_Z + dir.z * 10.5);
    path.receiveShadow = true;
    scene.add(path);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 80), white);
    line.rotation.set(-Math.PI / 2, 0, ang);
    line.position.set(dir.x * 40, 0.016, PLATE_Z + dir.z * 40);
    scene.add(line);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), white);
    base.position.set(dir.x * 20.5, 0.04, PLATE_Z + dir.z * 20.5);
    base.rotation.y = Math.PI / 4;
    scene.add(base);
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.1, 1.8)),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    frame.rotation.x = -Math.PI / 2;
    frame.position.set(sgn * 0.95, 0.02, PLATE_Z);
    scene.add(frame);
  }

  // 조명탑
  const grey = lam({ color: 0x374151 });
  const panelTex = canvasTex(256, 160, (c, w, h) => {
    c.fillStyle = '#374151';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 4; j++) {
        c.fillStyle = '#fffbe6';
        c.fillRect(12 + i * 40, 12 + j * 37, 32, 28);
      }
  });
  for (const sgn of [1, -1]) {
    const a = Math.PI - sgn * 1.45;
    const x = Math.sin(a) * 33;
    const z = PLATE_Z + Math.cos(a) * 33;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 30, 10), lam({ color: 0x6b7280 }));
    pole.position.set(x, 15, z);
    scene.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 4.2, 0.6), [
      grey, grey, grey, grey, noOutline(new THREE.MeshBasicMaterial({ map: panelTex })), grey,
    ]);
    panel.position.set(x, 31, z);
    panel.lookAt(0, 0, PLATE_Z + 4);
    scene.add(panel);
  }
}

// ================= 관중석 (응원팀 색 관중) =================
const STAND_TH = Math.PI - 1.3;
const STAND_LEN = 2.6;

function makeCrowdTex(team: string) {
  return canvasTex(1024, 96, (x, w, h) => {
    x.fillStyle = '#39404d';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#2a2f3a';
    x.fillRect(0, h / 2 - 6, w, 6);
    x.fillRect(0, h - 10, w, 10);
    for (let px = 4; px < w; px += 12 + Math.random() * 4) {
      if (Math.random() < 0.1) continue;
      for (const row of [0, 1]) {
        if (Math.random() < 0.1) continue;
        const r = Math.random();
        const col = r < 0.62 ? team : r < 0.8 ? '#ffffff' : pick(['#facc15', '#111827', '#9ca3af', '#f97316']);
        const by = (row ? h - 8 : h / 2 - 4) - rand(0, 4);
        const bh = 18;
        const ox = px + (row ? 6 : 0);
        x.fillStyle = col;
        x.fillRect(ox, by - bh, 9, bh);
        if (Math.random() < 0.15) {
          x.fillRect(ox - 2, by - bh - 10, 3, 10);
          x.fillRect(ox + 8, by - bh - 10, 3, 10);
        }
        x.fillStyle = pick(['#f1c9a0', '#e0ac7e', '#c98b5e', '#2b2118']);
        x.beginPath();
        x.arc(ox + 4.5, by - bh - 4, 4.5, 0, 7);
        x.fill();
      }
    }
  });
}

export class Stands {
  readonly group = new THREE.Group();
  private crowd: THREE.Texture[] = [];
  private adTex = canvasTex(2048, 128, (x, w, h) => {
    const ads = [
      ['#0f172a', '분풀이 스포츠'],
      ['#b91c1c', 'ANGRY FAN'],
      ['#065f46', '시원한 음료'],
      ['#1e3a8a', '멘탈 회복 센터'],
      ['#7c2d12', '치킨은 이길 때도 질 때도'],
    ];
    for (let i = 0; i < 10; i++) {
      const [bg, t] = ads[i % ads.length];
      x.fillStyle = bg;
      x.fillRect((i * w) / 10, 0, w / 10, h);
      x.fillStyle = '#fff';
      x.font = 'bold 30px sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(t, (i * w) / 10 + w / 20, h / 2);
    }
  });

  constructor(scene: THREE.Scene) {
    this.adTex.wrapS = THREE.RepeatWrapping;
    this.adTex.repeat.set(-2, 1);
    scene.add(this.group);
  }

  build(team: string) {
    this.dispose();
    const base = makeCrowdTex(team);
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(9.6, 9.6, 2.4, 64, 1, true, STAND_TH, STAND_LEN),
      lam({ map: this.adTex, side: THREE.DoubleSide }),
    );
    wall.position.set(0, 1.2, PLATE_Z);
    this.group.add(wall);
    let y = 2.4;
    let R = 9.6;
    const stepMat = lam({ color: 0x8b93a1, side: THREE.DoubleSide });
    for (let i = 0; i < 11; i++) {
      const top = new THREE.Mesh(new THREE.RingGeometry(R, R + 1.3, 64, 1, STAND_TH - Math.PI / 2, STAND_LEN), stepMat);
      top.rotation.x = -Math.PI / 2;
      top.position.set(0, y, PLATE_Z);
      this.group.add(top);
      R += 1.3;
      const t = base.clone();
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set((-R * STAND_LEN) / 22, 1);
      t.offset.x = Math.random();
      t.needsUpdate = true;
      this.crowd.push(t);
      const riser = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R, 0.8, 72, 1, true, STAND_TH, STAND_LEN),
        lam({ map: t, side: THREE.DoubleSide }),
      );
      riser.position.set(0, y + 0.4, PLATE_Z);
      this.group.add(riser);
      y += 0.8;
    }
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(R + 0.2, R + 0.2, 2.2, 72, 1, true, STAND_TH, STAND_LEN),
      lam({ color: new THREE.Color(team).multiplyScalar(0.8), side: THREE.DoubleSide }),
    );
    rim.position.set(0, y + 1.1, PLATE_Z);
    this.group.add(rim);
    const roof = new THREE.Mesh(
      new THREE.RingGeometry(R - 6, R + 0.2, 64, 1, STAND_TH - Math.PI / 2, STAND_LEN),
      lam({ color: 0xe5e7eb, side: THREE.DoubleSide }),
    );
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(0, y + 2.2, PLATE_Z);
    this.group.add(roof);
  }

  /** 관중 들썩임 (cheer > 0 동안) */
  update(cheer: number, now: number) {
    this.crowd.forEach((t, i) => {
      t.offset.y = cheer > 0 ? Math.abs(Math.sin(now * 14 + i * 1.7)) * 0.06 * Math.min(1, cheer) : 0;
    });
  }

  private dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mat = m.material as THREE.MeshLambertMaterial;
      if (mat.map && mat.map !== this.adTex) mat.map.dispose();
      mat.dispose();
    });
    this.group.clear();
    this.crowd = [];
  }
}

// ================= 전광판 =================
export interface BoardState {
  timeLeft: number;
  score: number;
  hits: number;
  throws: number;
  combo: number;
}

export class Scoreboard {
  msg = '패배 분풀이 야구';
  dirty = true;
  private canvas = document.createElement('canvas');
  private tex: THREE.CanvasTexture;
  private timer = 0;

  constructor(scene: THREE.Scene) {
    this.canvas.width = 768;
    this.canvas.height = 288;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Group();
    board.add(new THREE.Mesh(new THREE.BoxGeometry(15, 6.2, 0.8), lam({ color: 0x1f2937 })));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(14.2, 5.4), noOutline(new THREE.MeshBasicMaterial({ map: this.tex })));
    screen.position.z = 0.41;
    board.add(screen);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 0.6), lam({ color: 0x4b5563 }));
    leg.position.y = -5.5;
    board.add(leg);
    board.position.set(0, 23, PLATE_Z - 30);
    scene.add(board);
  }

  say(msg: string) {
    this.msg = msg;
    this.dirty = true;
  }

  update(dt: number, s: BoardState) {
    if ((this.timer -= dt) >= 0 && !this.dirty) return;
    this.timer = 0.25;
    const x = this.canvas.getContext('2d')!;
    const w = 768;
    const h = 288;
    x.fillStyle = '#05070c';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#111827';
    for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 1, h);
    x.font = 'bold 34px sans-serif';
    x.fillStyle = '#fbbf24';
    x.textAlign = 'left';
    x.fillText('분풀이 전광판', 24, 48);
    x.textAlign = 'right';
    x.fillStyle = '#f87171';
    x.fillText('⏱ ' + Math.ceil(s.timeLeft), w - 24, 48);
    x.textAlign = 'center';
    x.fillStyle = '#fff';
    x.font = 'bold 96px sans-serif';
    x.fillText(String(s.score), w / 2, 150);
    x.font = 'bold 30px sans-serif';
    x.fillStyle = '#93c5fd';
    x.fillText(`명중 ${s.hits}/${s.throws}   ·   콤보 ${s.combo}`, w / 2, 200);
    x.fillStyle = '#fde047';
    x.font = 'bold 34px sans-serif';
    x.fillText(this.msg, w / 2, 258);
    this.tex.needsUpdate = true;
    this.dirty = false;
  }
}
