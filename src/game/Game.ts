import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { Animator } from './animation';
import { sfx } from './audio';
import { makeCharacter, teamMats, type Rig } from './character';
import {
  BALL_R, BOUNDS, G, JERSEY_NUMBERS, LINES, PLATE_Z, ROUND_TIME, SKINS,
  clamp, damp, lerp, lerpAng, pick, rand, wrapAng,
} from './constants';
import { Effects, type BubbleOwner } from './effects';
import { HOLD, ITEM_TYPES, makeItemMesh, type ItemType } from './items';
import { toon } from './materials';
import { Scoreboard, Stands, buildField } from './stadium';

const V3 = THREE.Vector3;

/** 화면(React)이 엔진에 알려주는 현재 장면 — 카메라 구도와 데모 투구 여부가 달라짐 */
export type View = 'home' | 'select' | 'play' | 'result';

export interface HudSnapshot {
  playing: boolean;
  timeLeft: number;
  score: number;
  throws: number;
  hits: number;
  combo: number;
  /** 0~1 파워 게이지 */
  power: number;
}

export interface RoundResult {
  score: number;
  throws: number;
  hits: number;
  maxCombo: number;
  accuracy: number;
}

export const verdictOf = (score: number) =>
  score >= 2500 ? '속이 시원하다 😤' : score >= 1000 ? '조금 풀렸다 🙂' : '아직 화가 안 풀렸다 😡';

type PState = 'idle' | 'taunt' | 'react' | 'dodge' | 'duck' | 'panic' | 'down' | 'getup';

interface Player extends BubbleOwner {
  anim: Animator;
  num: number;
  state: PState;
  t: number;
  target: THREE.Vector3;
  wait: number;
  vel: THREE.Vector3;
  knock: THREE.Vector3;
  seen: Set<number>;
  tauntT: number;
  tauntDur: number;
  look: number;
  dustDone: boolean;
  reactT: number;
  mode: 'dodge' | 'duck';
  dodgeDir: number;
}

interface Pitcher {
  rig: Rig;
  anim: Animator;
}

interface Ball {
  id: number;
  mesh: THREE.Object3D;
  trail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  vel: THREE.Vector3;
  age: number;
  resolved: boolean;
  bounced: boolean;
  speed: number;
  /** 실제 라운드 투구인지 (메뉴 데모 투구는 점수에 안 들어감) */
  scoring: boolean;
}

interface PendingThrow {
  target: THREE.Vector3;
  power: number;
  t: number;
  scoring: boolean;
}

// 카메라 구도
const CAM_PLAY = { pos: new V3(1.9, 3.3, 4.8), look: new V3(0, 1.0, PLATE_Z + 1) };
const CAM_SELECT = { pos: new V3(3.2, 2.5, -4.5), look: new V3(-0.6, 1.0, PLATE_Z - 0.5) };
// 메인 화면: 투수 왼쪽 뒤 낮은 앵글 (투수 + 멀리 선수들), 천천히 좌우로 흔들림
const CAM_HOME = { pos: new V3(-2.4, 2.3, 4.6), look: new V3(1.5, 1.2, -8) };

const _a = new V3(), _h = new V3(), _seg = new V3(), _tmp = new V3(), _c = new V3(), _closest = new V3();
function distToSeg(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  _seg.subVectors(b, a);
  const t = clamp(_tmp.subVectors(p, a).dot(_seg) / _seg.lengthSq(), 0, 1);
  return _tmp.copy(a).addScaledVector(_seg, t).distanceTo(p);
}

export class Game {
  /** 라운드 종료 시 호출 */
  onEnd: ((r: RoundResult) => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private effect: OutlineEffect;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  private stands: Stands;
  private board: Scoreboard;
  private fx: Effects;
  private fxLayer: HTMLDivElement;
  private reticle: HTMLDivElement;
  private clock = new THREE.Clock();
  private raf = 0;
  private resizeObs: ResizeObserver;
  private cleanup: (() => void)[] = [];

  // 장면
  private teamColor = '#131230';
  private view: View = 'home';
  private players: Player[] = [];
  private pickables: THREE.Mesh[] = [];
  private pitcher: Pitcher | null = null;
  private held: THREE.Object3D | null = null;
  private heldType: ItemType = 'ball';
  private balls: Ball[] = [];
  private ballId = 0;

  // 라운드 상태
  private playing = false;
  private timeLeft = ROUND_TIME;
  private score = 0;
  private throws = 0;
  private hits = 0;
  private combo = 0;
  private maxCombo = 0;
  private charging = false;
  private charge = 0;
  private power = 0;
  private cooldown = 0;
  private pending: PendingThrow | null = null;

  // 연출
  private shakeT = 0;
  private slowT = 0;
  private timeScale = 1;
  private cheerT = 0;
  private demoT = 1.5;
  private demoAim: THREE.Vector3 | null = null;
  private camPos = CAM_PLAY.pos.clone();
  private camLook = CAM_PLAY.look.clone();
  private camSnap = true;
  private viewShift = { x: 0, y: 0 };

  private mouse = new THREE.Vector2(0, 0.1);
  private raycaster = new THREE.Raycaster();

  // HUD 스냅샷 (useSyncExternalStore 용)
  private snap: HudSnapshot = { playing: false, timeLeft: ROUND_TIME, score: 0, throws: 0, hits: 0, combo: 0, power: 0 };
  private listeners = new Set<() => void>();

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    container.appendChild(this.renderer.domElement);
    this.effect = new OutlineEffect(this.renderer, { defaultThickness: 0.0045, defaultColor: [0.07, 0.07, 0.1] });

    this.fxLayer = document.createElement('div');
    this.fxLayer.className = 'fx-layer';
    container.appendChild(this.fxLayer);
    this.reticle = document.createElement('div');
    this.reticle.className = 'fx-reticle';
    container.appendChild(this.reticle);

    buildField(this.scene);
    this.stands = new Stands(this.scene);
    this.board = new Scoreboard(this.scene);
    this.fx = new Effects(this.scene, this.camera, this.fxLayer);

    this.bindInput();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();

    this.stands.build(this.teamColor);
    this.spawnCast();
    this.loop();
  }

  // ================= 공개 API =================
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;

  setTeam(color: string) {
    if (color === this.teamColor && this.players.length) return;
    this.teamColor = color;
    this.stands.build(color);
    this.spawnCast();
  }

  setView(view: View) {
    if (view === this.view) return;
    this.view = view;
    if (view === 'home') this.board.say('패배 분풀이 야구');
    else if (view === 'select') this.board.say('응원하는 팀은?');
    if (view !== 'play' && this.playing) this.abort();
  }

  /** 새 라운드 시작 (선수 재배치 + 점수 초기화) */
  start() {
    this.spawnCast();
    this.view = 'play';
    this.timeLeft = ROUND_TIME;
    this.score = this.throws = this.hits = this.combo = this.maxCombo = 0;
    this.charging = false;
    this.cooldown = 0;
    this.pending = null;
    this.demoAim = null;
    this.board.say('분풀이 시작!');
    this.playing = true;
    this.publish();
  }

  /** 결과 없이 라운드 중단 */
  abort() {
    this.playing = false;
    this.charging = false;
    this.pending = null;
    this.publish();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.cleanup.forEach((f) => f());
    this.fx.clear();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.renderer.dispose();
    this.container.replaceChildren();
    this.listeners.clear();
  }

  // ================= 월드 구성 =================
  private clearCast() {
    for (const p of this.players) this.scene.remove(p.rig.root);
    this.players = [];
    this.pickables = [];
    if (this.pitcher) this.scene.remove(this.pitcher.rig.root);
    this.pitcher = null;
    this.held = null;
    for (const b of this.balls) this.removeBall(b);
    this.balls = [];
    this.fx.clear();
  }

  private spawnCast() {
    this.clearCast();
    const tm = teamMats(this.teamColor);
    // 투수 = 분노한 팬 (팀 유니폼 + 청바지)
    const prig = makeCharacter({ ...tm, pants: toon(0x3b5b8c), socks: toon(0x2b3a55), skin: SKINS[0], glove: true, number: '' });
    prig.root.position.set(0, 0.25, 0.1);
    prig.root.rotation.y = Math.PI;
    this.scene.add(prig.root);
    this.pitcher = { rig: prig, anim: new Animator(prig) };
    this.pitcher.anim.play('p_idle');
    this.setHeldItem(pick(ITEM_TYPES));

    JERSEY_NUMBERS.forEach((n, i) => {
      const rig = makeCharacter({ ...tm, skin: SKINS[i % SKINS.length], glove: i % 2 === 0, number: String(n) });
      rig.root.position.set(-5.5 + i * 2.2, 0, rand(-16, -11));
      this.scene.add(rig.root);
      const p: Player = {
        rig, anim: new Animator(rig), num: n, state: 'idle', t: 0, target: new V3(), wait: 0,
        vel: new V3(), knock: new V3(), seen: new Set(), tauntT: rand(1.5, 6), tauntDur: 0,
        bubble: null, look: 0, dustDone: false, reactT: 0, mode: 'dodge', dodgeDir: 1,
      };
      p.anim.play('idle');
      p.anim.time = Math.random() * 3;
      this.newTarget(p);
      this.players.push(p);
      this.pickables.push(...rig.meshes);
    });
  }

  private setHeldItem(type: ItemType) {
    if (!this.pitcher) return;
    this.held?.removeFromParent();
    this.heldType = type;
    this.held = makeItemMesh(type);
    const h = HOLD[type];
    this.held.position.set(...h.p);
    this.held.rotation.set(...h.r);
    this.pitcher.rig.b.haR.add(this.held);
  }

  private newTarget(p: Player) {
    p.target.set(rand(BOUNDS.x0, BOUNDS.x1), 0, rand(BOUNDS.z0, BOUNDS.z1));
    p.wait = rand(0.8, 3);
  }

  // ================= 입력 =================
  private bindInput() {
    const cv = this.renderer.domElement;
    const setMouse = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.reticle.style.left = e.clientX - r.left + 'px';
      this.reticle.style.top = e.clientY - r.top + 'px';
    };
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      t.addEventListener(type, fn as EventListener);
      this.cleanup.push(() => t.removeEventListener(type, fn as EventListener));
    };
    on(cv, 'pointermove', (e) => {
      setMouse(e);
      if (this.playing) this.reticle.style.display = 'block';
    });
    on(cv, 'pointerdown', (e) => {
      setMouse(e);
      if (!this.playing) return;
      this.reticle.style.display = 'block';
      this.beginCharge();
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    });
    on(cv, 'pointerup', (e) => {
      setMouse(e);
      this.release();
    });
    on(window, 'keydown', (e) => {
      if (e.code === 'Space' && this.playing) {
        e.preventDefault();
        this.beginCharge();
      }
    });
    on(window, 'keyup', (e) => {
      if (e.code === 'Space') this.release();
    });
  }

  private resize() {
    const w = this.container.clientWidth || innerWidth;
    const h = this.container.clientHeight || innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private beginCharge() {
    if (!this.playing || this.cooldown > 0 || this.charging || !this.pitcher) return;
    this.charging = true;
    this.charge = 0;
    this.setHeldItem(pick(ITEM_TYPES));
    this.pitcher.anim.play('windup', { fade: 0.12 });
  }

  private release() {
    if (!this.playing || !this.charging) return;
    this.charging = false;
    this.throwAt(this.aimPoint(), this.power, true);
  }

  private aimPoint() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    if (hit) return hit.point.clone();
    const r = this.raycaster.ray;
    const tz = r.direction.z < -0.05 ? (PLATE_Z - r.origin.z) / r.direction.z : 20;
    return r.origin.clone().addScaledVector(r.direction, clamp(tz, 4, 30));
  }

  private throwAt(target: THREE.Vector3, power: number, scoring: boolean) {
    if (!this.pitcher) return;
    this.pending = { target, power, t: 0, scoring };
    this.pitcher.anim.play('pitch', { fade: 0.06 });
    this.cooldown = 0.7;
    if (scoring) this.throws++;
  }

  private spawnBall(pt: PendingThrow) {
    if (!this.held) return;
    const start = new V3();
    this.held.getWorldPosition(start);
    this.held.visible = false;
    const speed = 16 + pt.power * 24;
    const t = start.distanceTo(pt.target) / speed;
    const vel = pt.target.clone().sub(start).divideScalar(t);
    vel.y += 0.5 * G * t;
    const mesh = makeItemMesh(this.heldType);
    mesh.position.copy(start);
    this.scene.add(mesh);
    const pts = new Float32Array(8 * 3);
    for (let i = 0; i < 8; i++) start.toArray(pts, i * 3);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    mat.userData.outlineParameters = { visible: false };
    const trail = new THREE.Line(tg, mat);
    this.scene.add(trail);
    this.balls.push({ id: this.ballId++, mesh, trail, vel, age: 0, resolved: false, bounced: false, speed, scoring: pt.scoring });
    if (pt.scoring) sfx('throw');
  }

  private removeBall(b: Ball) {
    this.scene.remove(b.mesh, b.trail);
    b.trail.geometry.dispose();
    b.trail.material.dispose();
  }

  // ================= 메뉴 데모 투구 =================
  private updateDemo(dt: number) {
    if (this.playing || this.view === 'play' || !this.pitcher) return;
    if (this.demoAim) {
      if ((this.demoT -= dt) <= 0) {
        this.throwAt(this.demoAim, rand(0.15, 0.95), false);
        this.demoAim = null;
        this.demoT = rand(1.8, 3.4);
      }
      return;
    }
    if ((this.demoT -= dt) > 0 || this.cooldown > 0 || this.pending) return;
    const targets = this.players.filter((p) => p.state === 'idle' || p.state === 'taunt');
    if (!targets.length) {
      this.demoT = 0.5;
      return;
    }
    const p = pick(targets);
    this.demoAim = p.rig.b.chest.getWorldPosition(new V3()).add(new V3(rand(-0.4, 0.4), rand(-0.2, 0.5), 0));
    this.setHeldItem(pick(ITEM_TYPES));
    this.pitcher.anim.play('windup', { fade: 0.12 });
    this.demoT = 0.5;
  }

  // ================= 업데이트 =================
  private resolveMiss(b: Ball) {
    if (b.resolved) return;
    b.resolved = true;
    if (!b.scoring) return;
    this.combo = 0;
    this.board.say(pick(LINES.miss));
  }

  private onHit(p: Player, b: Ball) {
    b.resolved = true;
    p.state = 'down';
    p.t = 0;
    p.dustDone = false;
    p.rig.root.rotation.y = Math.atan2(-b.vel.x, -b.vel.z);
    p.knock.set(b.vel.x, 0, b.vel.z).normalize().multiplyScalar(1.6 + b.speed * 0.05);
    p.anim.play('knockdown', { fade: 0.05, restart: true });
    const hp = b.mesh.position.clone();
    b.vel.set(-b.vel.x * 0.2, 3, -b.vel.z * 0.2);
    this.fx.floatAt(hp.add(new V3(0, 0.2, 0)), '퍽!', 'fx-pow', 0.6, 0.8);
    this.fx.say(p, pick(LINES.hit));
    this.slowT = 0.22;
    this.cheerT = 1.2;
    if (!b.scoring) return;

    this.hits++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const pts = 100 + (this.combo - 1) * 50 + Math.round((b.speed - 16) * 4);
    this.score += pts;
    this.fx.floatAt(p.rig.root.position.clone().add(new V3(0, 2.3, 0)), '+' + pts, 'fx-pts', 0.9, 1.4);
    sfx('hit');
    this.shakeT = 0.18;
    this.board.say(`${p.num}번 명중! +${pts}`);
    if (this.combo >= 2) this.fx.combo(this.combo + ' 콤보!');
  }

  private updateBalls(dt: number) {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      const p = b.mesh.position;
      b.age += dt;
      b.vel.y -= G * dt;
      p.addScaledVector(b.vel, dt);
      b.mesh.rotation.x -= dt * 25;
      if (p.y < BALL_R) {
        p.y = BALL_R;
        b.vel.y = Math.abs(b.vel.y) * 0.4;
        b.vel.x *= 0.7;
        b.vel.z *= 0.7;
        if (!b.bounced) {
          b.bounced = true;
          this.resolveMiss(b);
          this.fx.dust(p, 2, 0.35);
        }
      }
      if (p.z < PLATE_Z - 9.3 && b.vel.z < 0) {
        b.vel.z *= -0.35;
        this.resolveMiss(b);
      }
      const arr = b.trail.geometry.attributes.position.array as Float32Array;
      arr.copyWithin(3, 0, arr.length - 3);
      p.toArray(arr, 0);
      b.trail.geometry.attributes.position.needsUpdate = true;
      b.trail.material.opacity = b.resolved ? Math.max(0, b.trail.material.opacity - dt * 2) : 0.55;
      if (!b.resolved) {
        for (const pl of this.players) {
          if (pl.state === 'down' || pl.state === 'getup') continue;
          pl.rig.b.head.getWorldPosition(_h);
          _h.y += 0.12;
          _a.copy(pl.rig.root.position).setY(0.1);
          if (distToSeg(p, _a, _h) < 0.27 + BALL_R) {
            this.onHit(pl, b);
            break;
          }
        }
      }
      if (b.age > 4) {
        this.resolveMiss(b);
        this.removeBall(b);
        this.balls.splice(i, 1);
      }
    }
  }

  private leftVec(pl: Player) {
    const y = pl.rig.root.rotation.y;
    return new V3(Math.cos(y), 0, -Math.sin(y));
  }

  /** 날아오는 공 궤적 예측 → 회피(옆으로 몸 날리기·숙이기) 또는 패닉 */
  private scanBalls(pl: Player) {
    _c.copy(pl.rig.root.position).setY(1.1);
    for (const b of this.balls) {
      if (b.resolved || pl.seen.has(b.id)) continue;
      const ts = _tmp.subVectors(_c, b.mesh.position).dot(b.vel) / b.vel.lengthSq();
      if (ts <= 0 || ts > 0.6) continue;
      _closest.copy(b.mesh.position).addScaledVector(b.vel, ts);
      _closest.y -= 0.5 * G * ts * ts;
      if (Math.hypot(_closest.x - _c.x, _closest.z - _c.z) > 1.0) continue;
      pl.seen.add(b.id);
      pl.t = 0;
      // 회피 확률은 공 속도에 반비례
      const chance = clamp(0.82 - ((b.speed - 16) / 24) * 0.57, 0.25, 0.82);
      if (Math.random() < chance) {
        pl.state = 'react';
        pl.reactT = rand(0.04, 0.16);
        if (_closest.y > 1.2 && Math.random() < 0.45) pl.mode = 'duck';
        else {
          pl.mode = 'dodge';
          const L = this.leftVec(pl);
          const side = Math.sign(_tmp.subVectors(_c, _closest).dot(L)) || (Math.random() < 0.5 ? -1 : 1);
          let dir = side;
          const dest = _c.clone().addScaledVector(L, dir * 2);
          if (dest.x > BOUNDS.x1 + 1 || dest.x < BOUNDS.x0 - 1) dir *= -1;
          pl.dodgeDir = dir;
          pl.vel.copy(L).multiplyScalar(dir * 6.5);
        }
      } else {
        pl.state = 'panic';
        pl.anim.play('panic', { fade: 0.08 });
        this.fx.say(pl, pick(LINES.panic));
      }
      return;
    }
  }

  private toIdle(pl: Player) {
    pl.state = 'idle';
    pl.t = 0;
    this.newTarget(pl);
    pl.wait = rand(0.3, 1.5);
  }

  private updatePlayer(pl: Player, dt: number) {
    const root = pl.rig.root;
    const pos = root.position;
    const pp = this.pitcher!.rig.root.position;
    pl.t += dt;
    let faceYaw = Math.atan2(pp.x - pos.x, pp.z - pos.z);
    let turn = true;
    switch (pl.state) {
      case 'idle': {
        const to = _tmp.copy(pl.target).sub(pos);
        to.y = 0;
        const dist = to.length();
        if (dist > 0.3 && pl.wait <= 0) {
          to.normalize();
          pos.addScaledVector(to, 1.5 * dt);
          faceYaw = Math.atan2(to.x, to.z);
          pl.anim.play('walk', { fade: 0.25 });
        } else {
          pl.anim.play('idle', { fade: 0.3 });
          if (dist <= 0.3) this.newTarget(pl);
          pl.wait -= dt;
        }
        if ((pl.tauntT -= dt) < 0) {
          pl.tauntT = this.playing ? rand(5, 10) : rand(8, 16);
          const r = Math.random();
          if (r < 0.4) {
            pl.state = 'taunt';
            pl.t = 0;
            pl.tauntDur = 1.8;
            pl.anim.play('bow', { fade: 0.2 });
            this.fx.say(pl, '죄송합니다…');
          } else if (r < 0.7) {
            pl.state = 'taunt';
            pl.t = 0;
            pl.tauntDur = 1.6;
            pl.anim.play('plead', { fade: 0.2 });
            this.fx.say(pl, '살려주세요');
          } else this.fx.say(pl, pick(LINES.idle));
        }
        this.scanBalls(pl);
        break;
      }
      case 'taunt':
        if (pl.t > pl.tauntDur) this.toIdle(pl);
        this.scanBalls(pl);
        break;
      case 'react':
        if ((pl.reactT -= dt) <= 0) {
          pl.state = pl.mode;
          pl.t = 0;
          if (pl.mode === 'dodge') {
            pl.anim.play('dodge', { mirror: pl.dodgeDir < 0, fade: 0.08, restart: true });
            this.fx.dust(pos, 2, 0.4);
          } else pl.anim.play('duck', { fade: 0.08, restart: true });
        }
        break;
      case 'dodge':
        if (pl.t < 0.42) pos.addScaledVector(pl.vel, dt * (1 - pl.t / 0.5));
        if (pl.t > 0.62) {
          if (Math.random() < 0.5) this.fx.say(pl, pick(LINES.dodge));
          this.toIdle(pl);
        }
        break;
      case 'duck':
        if (pl.t > 0.8) {
          if (Math.random() < 0.5) this.fx.say(pl, pick(LINES.dodge));
          this.toIdle(pl);
        }
        break;
      case 'panic':
        if (pl.t > 0.75) this.toIdle(pl);
        break;
      case 'down':
        turn = false;
        pos.addScaledVector(pl.knock, dt);
        pl.knock.multiplyScalar(Math.exp(-dt * 4));
        if (!pl.dustDone && pl.t > 0.42) {
          pl.dustDone = true;
          this.fx.dust(pl.rig.b.hips.getWorldPosition(new V3()).setY(0), 7, 0.9);
        }
        if (pl.t > 2.0) {
          pl.state = 'getup';
          pl.t = 0;
          pl.anim.play('getup', { fade: 0.1 });
        }
        break;
      case 'getup':
        turn = false;
        if (pl.t > 1.15) this.toIdle(pl);
        break;
    }
    pos.x = clamp(pos.x, BOUNDS.x0 - 2, BOUNDS.x1 + 2);
    pos.z = clamp(pos.z, BOUNDS.z0 - 2, BOUNDS.z1 + 1.5);
    if (turn) root.rotation.y = lerpAng(root.rotation.y, faceYaw, damp(7, dt));
    pl.anim.update(dt);
    // 날아오는 공을 고개로 따라보기
    let look = 0;
    if (pl.state === 'idle' || pl.state === 'taunt' || pl.state === 'react' || pl.state === 'panic') {
      const b = this.balls.find((b) => !b.resolved);
      if (b) look = clamp(wrapAng(Math.atan2(b.mesh.position.x - pos.x, b.mesh.position.z - pos.z) - root.rotation.y), -0.9, 0.9);
    }
    pl.look = lerp(pl.look, look, damp(10, dt));
    pl.rig.b.head.rotation.y += pl.look;
  }

  private updatePitcher(dt: number) {
    const pitcher = this.pitcher!;
    const a = pitcher.anim;
    if (this.pending) {
      this.pending.t += dt;
      if (this.pending.t >= 0.19) {
        this.spawnBall(this.pending);
        this.pending = null;
      }
    }
    if (a.name === 'pitch' && a.time > 0.66) a.play('p_idle', { fade: 0.3 });
    a.update(dt);
    if (this.charging) pitcher.rig.b.chest.rotation.z += Math.sin(performance.now() / 40) * 0.015 * this.power;
  }

  private updateCamera(rdt: number) {
    const now = performance.now() / 1000;
    let pos: THREE.Vector3, look: THREE.Vector3;
    if (this.view === 'home') {
      pos = _tmp.copy(CAM_HOME.pos);
      pos.x += Math.sin(now * 0.15) * 0.8;
      pos.y += Math.sin(now * 0.11) * 0.2;
      look = CAM_HOME.look;
    } else if (this.view === 'select') {
      pos = CAM_SELECT.pos;
      look = CAM_SELECT.look;
    } else {
      pos = CAM_PLAY.pos;
      look = CAM_PLAY.look;
    }
    const k = this.camSnap ? 1 : damp(2.2, rdt);
    this.camSnap = false;
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    if (this.shakeT > 0) {
      this.shakeT -= rdt;
      this.camera.position.x += rand(-0.04, 0.04);
      this.camera.position.y += rand(-0.04, 0.04);
    }

    // 메뉴 화면에서는 UI 패널을 피해 장면을 밀어줌.
    // 넓은 화면: 패널이 왼쪽 → 장면을 오른쪽으로 / 좁은 화면: 패널이 아래 → 장면을 위로 (global.css 900px 기준과 맞춤)
    const W = this.container.clientWidth;
    const H = this.container.clientHeight;
    const menu = this.view === 'home' || this.view === 'select';
    const wide = W > 900;
    const ks = damp(3, rdt);
    this.viewShift.x = lerp(this.viewShift.x, menu && wide ? 0.17 : 0, ks);
    this.viewShift.y = lerp(this.viewShift.y, menu && !wide ? 0.3 : 0, ks);
    if (Math.abs(this.viewShift.x) + Math.abs(this.viewShift.y) > 0.002)
      this.camera.setViewOffset(W, H, -this.viewShift.x * W, this.viewShift.y * H, W, H);
    else this.camera.clearViewOffset();
  }

  private publish() {
    const s = this.snap;
    const timeLeft = Math.ceil(this.timeLeft);
    const power = Math.round(this.power * 100) / 100;
    if (
      s.playing === this.playing && s.timeLeft === timeLeft && s.score === this.score && s.throws === this.throws &&
      s.hits === this.hits && s.combo === this.combo && s.power === power
    ) return;
    this.snap = { playing: this.playing, timeLeft, score: this.score, throws: this.throws, hits: this.hits, combo: this.combo, power };
    this.listeners.forEach((l) => l());
  }

  private endRound() {
    this.playing = false;
    this.charging = false;
    this.timeLeft = 0;
    this.board.say(verdictOf(this.score));
    const result: RoundResult = {
      score: this.score,
      throws: this.throws,
      hits: this.hits,
      maxCombo: this.maxCombo,
      accuracy: this.throws ? Math.round((this.hits / this.throws) * 100) : 0,
    };
    this.publish();
    this.onEnd?.(result);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const rdt = Math.min(0.05, this.clock.getDelta());
    if (this.slowT > 0) {
      this.slowT -= rdt;
      this.timeScale = 0.3;
    } else this.timeScale = lerp(this.timeScale, 1, damp(8, rdt));
    const dt = rdt * this.timeScale;

    if (this.playing) {
      this.timeLeft -= rdt;
      if (this.charging) {
        this.charge += rdt;
        const c = this.charge % 2;
        this.power = c < 1 ? c : 2 - c;
      } else if (!this.pending) this.power = 0;
      if (this.timeLeft <= 0) this.endRound();
    } else {
      this.power = 0;
      this.reticle.style.display = 'none';
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown <= 0 && !this.pending && this.held) this.held.visible = true;
    this.updateDemo(rdt);

    if (this.pitcher) {
      this.updatePitcher(dt);
      this.updateBalls(dt);
      for (const p of this.players) this.updatePlayer(p, dt);
    }
    this.updateCamera(rdt);
    this.fx.update(dt, rdt);
    this.board.update(rdt, { timeLeft: this.timeLeft, score: this.score, hits: this.hits, throws: this.throws, combo: this.combo });
    this.cheerT = Math.max(0, this.cheerT - rdt);
    this.stands.update(this.cheerT, performance.now() / 1000);
    this.publish();
    this.effect.render(this.scene, this.camera);
  };
}
