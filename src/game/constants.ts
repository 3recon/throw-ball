export const G = 9.8;
export const BALL_R = 0.1;
export const ROUND_TIME = 60;
/** 홈플레이트 z (실제보다 축소). 투수판은 z = 0 근처. */
export const PLATE_Z = -14;
/** 선수들이 돌아다니는 영역 */
export const BOUNDS = { x0: -6.5, x1: 6.5, z0: -18.5, z1: -10 };

export const SKINS = [0xf1c9a0, 0xe0ac7e, 0xc98b5e, 0xf5d3b3];
export const JERSEY_NUMBERS = [7, 10, 25, 33, 52, 99];

export const LINES = {
  idle: ['죄송합니다…', '다음엔 이길게요!', '오늘 컨디션이…', '심판이 문제였어요', '팬 여러분 사랑해요'],
  dodge: ['휴~', '안 맞았지롱', '피했다!', '어림없지'],
  panic: ['으악!', '엄마!', '잠깐만!'],
  hit: ['아야!', '반성할게요…', '잘못했어요!', '으윽…'],
  miss: ['아깝다!', '빗나갔다…', '다시 던져!'],
};

export const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const wrapAng = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const lerpAng = (a: number, b: number, k: number) => a + wrapAng(b - a) * k;
/** 프레임레이트와 무관한 지수 감쇠 보간 계수 */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-dt * rate);
