export type Sfx = 'throw' | 'hit' | 'ui';

let actx: AudioContext | null = null;

/** 합성 효과음 (오디오 파일 없음) */
export function sfx(type: Sfx) {
  try {
    actx ||= new AudioContext();
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.connect(g);
    g.connect(actx.destination);
    if (type === 'throw') {
      o.type = 'triangle';
      o.frequency.setValueAtTime(600, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.18);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.start(t);
      o.stop(t + 0.2);
    } else if (type === 'hit') {
      o.type = 'square';
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.start(t);
      o.stop(t + 0.3);
    } else {
      o.type = 'sine';
      o.frequency.setValueAtTime(320, t);
      o.frequency.exponentialRampToValueAtTime(660, t + 0.12);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t);
      o.stop(t + 0.16);
    }
  } catch {
    /* 오디오 미지원 환경은 무음 */
  }
}
