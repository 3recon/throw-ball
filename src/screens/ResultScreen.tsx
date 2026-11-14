import { useState } from 'react';
import type { Team } from '../data/teams';
import { verdictOf, type RoundResult } from '../game/Game';

interface Props {
  team: Team;
  result: RoundResult;
  isBest: boolean;
  onAgain: () => void;
  onHome: () => void;
}

export function ResultScreen({ team, result, isBest, onAgain, onHome }: Props) {
  const [copied, setCopied] = useState(false);
  const verdict = verdictOf(result.score);

  const share = async () => {
    const text = `⚾ 패배 분풀이 야구 — ${team.name} 팬\n${verdict}\n점수 ${result.score.toLocaleString()} · 명중률 ${result.accuracy}% · 최대 콤보 ${result.maxCombo}\n${location.origin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* 사용자가 공유 취소 */
    }
  };

  return (
    <div className="screen screen-center">
      <div className="card result-card">
        {isBest && <div className="ribbon">최고 기록!</div>}
        <p className="kicker">오늘의 분풀이 결과</p>
        <h1 className="title title-sm">{verdict}</h1>
        <div className="score-big">{result.score.toLocaleString()}</div>
        <dl className="stats">
          <div>
            <dt>명중률</dt>
            <dd>{result.accuracy}%</dd>
          </div>
          <div>
            <dt>명중</dt>
            <dd>
              {result.hits} / {result.throws}
            </dd>
          </div>
          <div>
            <dt>최대 콤보</dt>
            <dd>{result.maxCombo}</dd>
          </div>
        </dl>
        <div className="btn-row">
          <button className="btn btn-danger" onClick={onAgain}>
            한 번 더
          </button>
          <button className="btn btn-muted" onClick={share}>
            {copied ? '복사됨!' : '결과 공유'}
          </button>
          <button className="btn btn-ghost" onClick={onHome}>
            처음으로
          </button>
        </div>
      </div>
    </div>
  );
}
