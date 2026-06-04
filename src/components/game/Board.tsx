import React, { useMemo, useEffect, useState } from 'react';
import { BOARD_SIZE } from '../../types';
import { Cell } from './Cell';
import type { CellOwner, Position, Game, Move } from '../../types';
import { useSettings } from '../../context/SettingsContext';

interface BoardProps {
  game: Game;
  myColor: CellOwner;
  onCellClick: (pos: Position) => void;
  winLine: Position[] | null;
  selectedPos: Position | null;
  premoveFrom?: Position | null;
  premoveTo?: Position | null;
  isMyTurn?: boolean;
}

export const Board = React.memo(function Board({ game, myColor, onCellClick, winLine, selectedPos, premoveFrom, premoveTo, isMyTurn }: BoardProps) {
  const { settings } = useSettings();
  const lastMove = game.moves?.[game.moves?.length - 1];
  const prevMove = game.moves?.length > 1 ? game.moves[game.moves.length - 2] : undefined;
  const [animatingMove, setAnimatingMove] = useState<{ from: Position; to: Position; player: string } | null>(null);
  const [lastProcessedMove, setLastProcessedMove] = useState<number>(0);

  useEffect(() => {
    if (game.moves && game.moves.length > 0 && game.moves.length !== lastProcessedMove) {
      const latestMove = game.moves[game.moves.length - 1];
      if (latestMove.from && settings.moveAnimationEnabled) {
        setAnimatingMove({ from: latestMove.from, to: latestMove.to, player: latestMove.player });
        const timer = setTimeout(() => setAnimatingMove(null), 300);
        setLastProcessedMove(game.moves.length);
        return () => clearTimeout(timer);
      }
      setLastProcessedMove(game.moves.length);
    }
  }, [game.moves?.length, settings.moveAnimationEnabled]);

  const winCellSet = useMemo(() => {
    if (!winLine) return new Set<string>();
    return new Set(winLine.map(p => `${p.row}-${p.col}`));
  }, [winLine]);

  const lastMoveFromKey = lastMove?.from ? `${lastMove.from.row}-${lastMove.from.col}` : null;
  const lastMoveToKey = lastMove ? `${lastMove.to.row}-${lastMove.to.col}` : null;

  const flipped = settings.boardFlipped && myColor === 'white';

  const rows = flipped ? [...Array(BOARD_SIZE).keys()].reverse() : [...Array(BOARD_SIZE).keys()];
  const cols = flipped ? [...Array(BOARD_SIZE).keys()].reverse() : [...Array(BOARD_SIZE).keys()];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: 12,
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        animation: settings.pulseOnTurnEnabled && isMyTurn && game.status === 'active'
          ? 'turnPulse 2s ease-in-out infinite'
          : 'none',
      }}
    >
      {rows.map((row) => (
        <div key={row} style={{ display: 'flex', gap: 2 }}>
          {cols.map((col) => {
            const isAnimatingFrom = animatingMove?.from.row === row && animatingMove.from.col === col;
            const isAnimatingTo = animatingMove?.to.row === row && animatingMove.to.col === col;

            return (
              <Cell
                key={`${row}-${col}`}
                value={game.board?.[row]?.[col] ?? null}
                row={row}
                col={col}
                isWinCell={winCellSet.has(`${row}-${col}`)}
                isSelected={selectedPos?.row === row && selectedPos?.col === col}
                isLastMoveFrom={settings.lastMoveHighlightEnabled && lastMoveFromKey === `${row}-${col}`}
                isLastMoveTo={settings.lastMoveHighlightEnabled && lastMoveToKey === `${row}-${col}`}
                isAnimatingFrom={isAnimatingFrom}
                isAnimatingTo={isAnimatingTo}
                animatingPlayer={isAnimatingFrom ? animatingMove!.player : undefined}
                isPremoveFrom={premoveFrom?.row === row && premoveFrom?.col === col}
                isPremoveTo={premoveTo?.row === row && premoveTo?.col === col}
                onClick={() => onCellClick({ row, col })}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});
