// 이 브라우저에만 저장되는 편의 정보 (최고 점수, 마지막으로 고른 팀).
// 저장소가 막혀 있어도(시크릿 모드 등) 게임은 정상 동작해야 하므로 모든 접근을 try/catch.
const KEY = 'bunpuri-baseball:v1';

export interface Saved {
  teamId: string | null;
  best: number;
  plays: number;
}

const EMPTY: Saved = { teamId: null, best: 0, plays: 0 };

export function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export function saveSaved(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 실패는 무시 */
  }
}
