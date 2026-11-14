import * as THREE from 'three';
import type { Rig } from './character';
import { rand } from './constants';
import { canvasTex, noOutline } from './materials';

/** 3D 위치를 따라다니는 DOM 텍스트 (점수, "퍽!", 말풍선) */
export interface Float {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  life: number;
  t: number;
  rise: number;
  owner?: BubbleOwner;
}
export interface BubbleOwner {
  rig: Rig;
  bubble: Float | null;
}

interface Dust {
  s: THREE.Sprite;
  v: THREE.Vector3;
  t: number;
  life: number;
  g: number;
}

const dustTex = canvasTex(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(222,190,150,0.9)');
  g.addColorStop(1, 'rgba(222,190,150,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
});

const _p = new THREE.Vector3();

export class Effects {
  private floats: Float[] = [];
  private dusts: Dust[] = [];
  private comboEl: HTMLDivElement;
  private comboTimer = 0;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private layer: HTMLElement,
  ) {
    this.comboEl = document.createElement('div');
    this.comboEl.className = 'fx-combo';
    layer.appendChild(this.comboEl);
  }

  floatAt(pos: THREE.Vector3, text: string, cls: string, life: number, rise: number, owner?: BubbleOwner) {
    const el = document.createElement('div');
    el.className = 'fx-float ' + cls;
    el.textContent = text;
    this.layer.appendChild(el);
    const f: Float = { el, pos: pos.clone(), life, t: 0, rise, owner };
    this.floats.push(f);
    return f;
  }

  say(p: BubbleOwner, text: string) {
    if (p.bubble) p.bubble.t = p.bubble.life;
    p.bubble = this.floatAt(new THREE.Vector3(), text, 'fx-bubble', 1.6, 0, p);
  }

  combo(text: string) {
    this.comboEl.textContent = text;
    this.comboEl.style.opacity = '1';
    this.comboTimer = 0.9;
  }

  dust(pos: THREE.Vector3, n: number, size = 0.6) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false })));
      s.position.copy(pos).add(new THREE.Vector3(rand(-0.3, 0.3), rand(0.05, 0.25), rand(-0.3, 0.3)));
      s.scale.setScalar(size * rand(0.6, 1));
      this.scene.add(s);
      this.dusts.push({ s, v: new THREE.Vector3(rand(-1, 1), rand(0.3, 1.2), rand(-1, 1)), t: 0, life: rand(0.6, 1.1), g: size });
    }
  }

  update(dt: number, realDt: number) {
    const W = this.layer.clientWidth;
    const H = this.layer.clientHeight;
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      if (f.owner) {
        f.owner.rig.b.head.getWorldPosition(f.pos);
        f.pos.y += 0.45;
      } else f.pos.y += f.rise * dt;
      _p.copy(f.pos).project(this.camera);
      f.el.style.left = ((_p.x + 1) / 2) * W + 'px';
      f.el.style.top = ((1 - _p.y) / 2) * H + 'px';
      f.el.style.opacity = String(_p.z > 1 ? 0 : Math.min(1, (f.life - f.t) * 4));
      if (f.t >= f.life) {
        f.el.remove();
        this.floats.splice(i, 1);
        if (f.owner && f.owner.bubble === f) f.owner.bubble = null;
      }
    }
    for (let i = this.dusts.length - 1; i >= 0; i--) {
      const d = this.dusts[i];
      d.t += dt;
      d.s.position.addScaledVector(d.v, dt);
      d.v.multiplyScalar(Math.exp(-dt * 2));
      d.s.scale.setScalar(d.g * (1 + d.t * 1.5));
      d.s.material.opacity = Math.max(0, 1 - d.t / d.life) * 0.8;
      if (d.t > d.life) this.removeDust(i);
    }
    if (this.comboTimer > 0 && (this.comboTimer -= realDt) <= 0) this.comboEl.style.opacity = '0';
  }

  clear() {
    for (const f of this.floats) f.el.remove();
    this.floats.length = 0;
    for (let i = this.dusts.length - 1; i >= 0; i--) this.removeDust(i);
    this.comboEl.style.opacity = '0';
  }

  private removeDust(i: number) {
    const d = this.dusts[i];
    this.scene.remove(d.s);
    d.s.material.dispose();
    this.dusts.splice(i, 1);
  }
}
