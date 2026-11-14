import { useSyncExternalStore } from 'react';
import type { Game } from '../game/Game';

interface Props {
  game: Game;
  onQuit: () => void;
}

export function Hud({ game, onQuit }: Props) {
  const s = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const urgent = s.timeLeft <= 10;

  return (
    <div className="hud">
      <div className="hud-top">
        <div className={`chip chip-time${urgent ? ' is-urgent' : ''}`}>
          <span className="chip-label">남은 시간</span>
          <b>{s.timeLeft}</b>
        </div>
        <div className="chip">
          <span className="chip-label">점수</span>
          <b>{s.score.toLocaleString()}</b>
        </div>
        <div className="chip">
          <span className="chip-label">명중</span>
          <b>
            {s.hits}/{s.throws}
          </b>
        </div>
        <div className="chip">
          <span className="chip-label">콤보</span>
          <b>{s.combo}</b>
        </div>
        <button className="chip chip-quit" onClick={onQuit} aria-label="그만하고 처음으로">
          그만하기
        </button>
      </div>
      <div className="power">
        <div className="power-label">꾹 눌러 와인드업 → 떼면 투구 · 세게 던질수록 못 피함</div>
        <div className="power-bar">
          <div className="power-fill" style={{ width: `${s.power * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
