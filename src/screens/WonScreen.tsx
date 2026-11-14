import type { Team } from '../data/teams';

interface Props {
  team: Team;
  onBack: () => void;
  onAnyway: () => void;
}

export function WonScreen({ team, onBack, onAnyway }: Props) {
  return (
    <div className="screen screen-center">
      <div className="card">
        <div className="card-emoji" aria-hidden>
          🎉
        </div>
        <h1 className="title title-sm">축하해요!</h1>
        <p className="lede">
          <b>{team.name}</b> 팬 여러분,
          <br />
          오늘은 분풀이할 일이 없네요.
        </p>
        <div className="btn-row">
          <button className="btn btn-muted" onClick={onBack}>
            돌아가기
          </button>
          <button className="btn btn-danger" onClick={onAnyway}>
            그래도 던지기
          </button>
        </div>
      </div>
    </div>
  );
}
