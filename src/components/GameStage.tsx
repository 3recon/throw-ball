import { useEffect, useRef } from 'react';
import { Game } from '../game/Game';

interface Props {
  onReady: (game: Game | null) => void;
}

/** Three.js 엔진을 붙이는 전체화면 배경. 화면 전환과 무관하게 계속 살아 있음. */
export function GameStage({ onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = new Game(ref.current!);
    onReady(game);
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
    return () => {
      onReady(null);
      game.dispose();
    };
  }, [onReady]);

  return <div ref={ref} className="stage" />;
}
