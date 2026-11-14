import type { Team } from '../data/teams';
import type { Saved } from '../lib/storage';

interface Props {
  team: Team;
  saved: Saved;
  onStart: () => void;
  onQuickStart: () => void;
}

const ITEMS = [
  { icon: '⚾', name: '야구공', desc: '기본에 충실' },
  { icon: '🏏', name: '배트', desc: '빙글빙글 회전' },
  { icon: '🍗', name: '치킨', desc: '아깝지만 던진다' },
  { icon: '🍺', name: '맥주병', desc: '오늘은 참지 마' },
];

const STEPS = [
  { k: '1', t: '조준', d: '마우스로 선수를 겨눠요' },
  { k: '2', t: '와인드업', d: '꾹 누르면 파워가 왕복해요' },
  { k: '3', t: '투구', d: '떼는 순간 던져요. 세게 던질수록 못 피함' },
];

export function HomeScreen({ team, saved, onStart, onQuickStart }: Props) {
  const returning = saved.plays > 0;

  return (
    <div className="screen screen-home">
      <header className="topbar">
        <div className="brand">
          <span className="brand-ball" aria-hidden>
            ⚾
          </span>
          분풀이 야구
        </div>
        <span className="badge">비공식 팬 게임</span>
      </header>

      <section className="panel home-panel">
        <p className="kicker">
          <span className="live-dot" aria-hidden /> 오늘 경기, 졌나요?
        </p>
        <h1 className="title">
          패배
          <br />
          <span className="title-accent">분풀이</span> 야구
        </h1>
        <p className="lede">
          응원팀이 진 날, 마운드에 올라 <b>우리 팀 선수들</b>에게 던져버리세요.
          <br />
          선수들은 피하고, 숙이고, 맞고 넘어집니다. 60초면 속이 좀 풀릴지도?
        </p>

        <div className="cta-row">
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            분풀이 시작하기 <span aria-hidden>→</span>
          </button>
          {returning && (
            <button className="btn btn-ghost btn-lg" onClick={onQuickStart}>
              <span className="dot" style={{ background: team.color }} aria-hidden />
              {team.name}로 바로 던지기
            </button>
          )}
        </div>

        {returning && (
          <dl className="record">
            <div>
              <dt>최고 점수</dt>
              <dd>{saved.best.toLocaleString()}</dd>
            </div>
            <div>
              <dt>분풀이 횟수</dt>
              <dd>{saved.plays}회</dd>
            </div>
          </dl>
        )}

        <div className="section">
          <h2 className="section-title">던질 수 있는 것들</h2>
          <ul className="items">
            {ITEMS.map((it) => (
              <li key={it.name} className="item">
                <span className="item-icon" aria-hidden>
                  {it.icon}
                </span>
                <span className="item-name">{it.name}</span>
                <span className="item-desc">{it.desc}</span>
              </li>
            ))}
          </ul>
          <p className="hint">매 투구마다 손에 쥐는 아이템이 랜덤으로 바뀌어요.</p>
        </div>

        <div className="section">
          <h2 className="section-title">플레이 방법</h2>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.k}>
                <span className="step-k">{s.k}</span>
                <div>
                  <b>{s.t}</b>
                  <span>{s.d}</span>
                </div>
              </li>
            ))}
          </ol>
          <p className="hint">
            키보드: <kbd>Space</kbd> 꾹 눌렀다 떼기 · 연속 명중 시 콤보 보너스
          </p>
        </div>

        <footer className="fineprint">팬이 만든 비공식 게임 · 구단 로고·실제 선수 미사용(가상 선수, 등번호만)</footer>
      </section>
    </div>
  );
}
