import { useCallback, useEffect, useRef, useState } from 'react';
import { GameStage } from './components/GameStage';
import { Hud } from './components/Hud';
import { findTeam, type Team } from './data/teams';
import { sfx } from './game/audio';
import type { Game, RoundResult, View } from './game/Game';
import { loadSaved, saveSaved, type Saved } from './lib/storage';
import { HomeScreen } from './screens/HomeScreen';
import { ResultScreen } from './screens/ResultScreen';
import { TeamSelectScreen } from './screens/TeamSelectScreen';
import { WonScreen } from './screens/WonScreen';

type Screen = 'home' | 'select' | 'won' | 'play' | 'result';

const VIEW_OF: Record<Screen, View> = { home: 'home', select: 'select', won: 'select', play: 'play', result: 'result' };

export default function App() {
  const [game, setGame] = useState<Game | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [saved, setSaved] = useState<Saved>(loadSaved);
  const [team, setTeam] = useState<Team>(() => findTeam(saved.teamId));
  const [result, setResult] = useState<{ r: RoundResult; isBest: boolean } | null>(null);

  const onReady = useCallback((g: Game | null) => setGame(g), []);

  // 화면 → 엔진 카메라 구도/데모 모드
  useEffect(() => {
    game?.setView(VIEW_OF[screen]);
  }, [game, screen]);

  // 팀 → 관중석·유니폼 색
  useEffect(() => {
    game?.setTeam(team.color);
  }, [game, team]);

  const savedRef = useRef(saved);
  savedRef.current = saved;
  const persist = (next: Saved) => {
    savedRef.current = next;
    setSaved(next);
    saveSaved(next);
  };

  // 라운드 종료 → 결과 화면
  useEffect(() => {
    if (!game) return;
    game.onEnd = (r) => {
      const prev = savedRef.current;
      persist({ ...prev, plays: prev.plays + 1, best: Math.max(prev.best, r.score) });
      setResult({ r, isBest: r.score > 0 && r.score > prev.best });
      setScreen('result');
    };
    return () => {
      game.onEnd = null;
    };
  }, [game]);

  const startRound = () => {
    sfx('ui');
    persist({ ...saved, teamId: team.id });
    game?.start();
    setScreen('play');
  };

  const go = (s: Screen) => () => {
    sfx('ui');
    setScreen(s);
  };

  return (
    <div className={`app is-${screen}`}>
      <GameStage onReady={onReady} />
      <div className="ui" key={screen}>
        {!game && <div className="screen screen-center loading">⚾ 불러오는 중…</div>}
        {game && screen === 'home' && (
          <HomeScreen team={team} saved={saved} onStart={go('select')} onQuickStart={startRound} />
        )}
        {game && screen === 'select' && (
          <TeamSelectScreen
            team={team}
            onPick={(t) => {
              sfx('ui');
              setTeam(t);
            }}
            onLost={startRound}
            onWon={go('won')}
            onBack={go('home')}
          />
        )}
        {game && screen === 'won' && <WonScreen team={team} onBack={go('select')} onAnyway={startRound} />}
        {game && screen === 'play' && <Hud game={game} onQuit={go('home')} />}
        {game && screen === 'result' && result && (
          <ResultScreen team={team} result={result.r} isBest={result.isBest} onAgain={startRound} onHome={go('home')} />
        )}
      </div>
    </div>
  );
}
