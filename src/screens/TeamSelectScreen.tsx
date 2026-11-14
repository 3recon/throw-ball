import type { CSSProperties } from 'react';
import { TEAMS, type Team } from '../data/teams';

interface Props {
  team: Team;
  onPick: (t: Team) => void;
  onLost: () => void;
  onWon: () => void;
  onBack: () => void;
}

export function TeamSelectScreen({ team, onPick, onLost, onWon, onBack }: Props) {
  return (
    <div className="screen screen-select">
      <section className="panel select-panel">
        <button className="back" onClick={onBack}>
          ← 처음으로
        </button>
        <p className="kicker">STEP 1 · 응원팀</p>
        <h1 className="title title-sm">어느 팀 팬이세요?</h1>
        <p className="lede">고르면 관중석과 선수 유니폼 색이 바로 바뀌어요.</p>

        <div className="teams" role="radiogroup" aria-label="응원팀">
          {TEAMS.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={t.id === team.id}
              className={`team${t.id === team.id ? ' is-on' : ''}`}
              style={{ '--team': t.color } as CSSProperties}
              onClick={() => onPick(t)}
            >
              <span className="dot" aria-hidden />
              {t.name}
            </button>
          ))}
        </div>

        <p className="kicker">STEP 2 · 오늘 경기 결과</p>
        <div className="result-pick">
          <button className="btn btn-danger btn-lg" onClick={onLost}>
            졌다 😡
          </button>
          <button className="btn btn-muted btn-lg" onClick={onWon}>
            이겼다 😊
          </button>
        </div>
      </section>
    </div>
  );
}
