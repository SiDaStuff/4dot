import React, { useMemo } from 'react';
import { BOARD_SIZE } from '../../types';
import type { CellOwner, Position, Move } from '../../types';

interface Arrow {
  from: Position;
  to: Position;
  color: string;
}

interface HighlightSquare {
  pos: Position;
  color: string;
}

interface AnalysisBoardProps {
  board: CellOwner[][];
  currentMoveIndex: number;
  totalMoves: number;
  bestMove?: { from?: Position; to: Position } | null;
  lastMove?: Move | null;
  arrows?: Arrow[];
  highlights?: HighlightSquare[];
  onCellClick?: (pos: Position) => void;
  flipped?: boolean;
  interactive?: boolean;
}

export const AnalysisBoard = React.memo(function AnalysisBoard({
  board,
  currentMoveIndex,
  totalMoves,
  bestMove,
  lastMove,
  arrows = [],
  highlights = [],
  onCellClick,
  flipped = false,
  interactive = true,
}: AnalysisBoardProps) {
  const size = typeof window !== 'undefined' && window.innerWidth < 400 ? 48 : 56;

  const highlightSet = useMemo(() => {
    const set = new Map<string, string>();
    for (const h of highlights) {
      set.set(`${h.pos.row}-${h.pos.col}`, h.color);
    }
    if (bestMove?.to) {
      set.set(`${bestMove.to.row}-${bestMove.to.col}`, 'rgba(76, 149, 108, 0.35)');
    }
    if (bestMove?.from) {
      set.set(`${bestMove.from.row}-${bestMove.from.col}`, 'rgba(76, 149, 108, 0.25)');
    }
    return set;
  }, [highlights, bestMove]);

  const lastMoveFromKey = lastMove?.from ? `${lastMove.from.row}-${lastMove.from.col}` : null;
  const lastMoveToKey = lastMove ? `${lastMove.to.row}-${lastMove.to.col}` : null;

  const rows = flipped ? [...Array(BOARD_SIZE).keys()].reverse() : [...Array(BOARD_SIZE).keys()];
  const cols = flipped ? [...Array(BOARD_SIZE).keys()].reverse() : [...Array(BOARD_SIZE).keys()];

  function cellCenter(row: number, col: number) {
    const visualRow = flipped ? (BOARD_SIZE - 1 - row) : row;
    const visualCol = flipped ? (BOARD_SIZE - 1 - col) : col;
    return {
      x: visualCol * (size + 2) + 12 + size / 2,
      y: visualRow * (size + 2) + 12 + size / 2,
    };
  }

  const svgWidth = BOARD_SIZE * (size + 2) + 24;
  const svgHeight = BOARD_SIZE * (size + 2) + 24;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
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
        }}
      >
        {rows.map((row) => (
          <div key={row} style={{ display: 'flex', gap: 2 }}>
            {cols.map((col) => {
              const hlColor = highlightSet.get(`${row}-${col}`);
              const isLastFrom = lastMoveFromKey === `${row}-${col}`;
              const isLastTo = lastMoveToKey === `${row}-${col}`;
              const value = board?.[row]?.[col] ?? null;

              let background = 'var(--color-white)';
              if (hlColor) background = hlColor;
              else if (isLastTo) background = 'rgba(76, 149, 108, 0.15)';
              else if (isLastFrom) background = 'rgba(76, 149, 108, 0.08)';

              let border = `1px solid var(--color-border)`;
              if (isLastTo || isLastFrom) border = '1px solid rgba(76, 149, 108, 0.4)';

              return (
                <button
                  key={`${row}-${col}`}
                  onClick={() => onCellClick?.({ row, col })}
                  disabled={!interactive}
                  style={{
                    width: size,
                    height: size,
                    borderRadius: 'var(--radius-sm)',
                    border,
                    background,
                    cursor: interactive ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {value && (
                    <div style={{
                      width: size * 0.55,
                      height: size * 0.55,
                      borderRadius: '50%',
                      background: value === 'black' ? '#1a1a1a' : '#ffffff',
                      border: value === 'white' ? '2px solid #1a1a1a' : '2px solid #444',
                      boxShadow: isLastTo
                        ? '0 0 0 3px var(--color-success), 0 0 8px rgba(76, 149, 108, 0.4)'
                        : '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {(arrows.length > 0 || bestMove) && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            zIndex: 10,
          }}
          width={svgWidth}
          height={svgHeight}
        >
          <defs>
            <marker id="arrowhead-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(76, 149, 108, 0.8)" />
            </marker>
            <marker id="arrowhead-red" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(239, 68, 68, 0.8)" />
            </marker>
            <marker id="arrowhead-yellow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(245, 158, 11, 0.8)" />
            </marker>
            <marker id="arrowhead-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(59, 130, 246, 0.8)" />
            </marker>
          </defs>

          {bestMove && (
            <line
              x1={bestMove.from ? cellCenter(bestMove.from.row, bestMove.from.col).x : cellCenter(bestMove.to.row, bestMove.to.col).x}
              y1={bestMove.from ? cellCenter(bestMove.from.row, bestMove.from.col).y : cellCenter(bestMove.to.row, bestMove.to.col).y}
              x2={cellCenter(bestMove.to.row, bestMove.to.col).x}
              y2={cellCenter(bestMove.to.row, bestMove.to.col).y}
              stroke="rgba(76, 149, 108, 0.7)"
              strokeWidth="4"
              strokeLinecap="round"
              markerEnd="url(#arrowhead-green)"
            />
          )}

          {arrows.map((arrow, i) => {
            const markerId = arrow.color.includes('red') ? 'arrowhead-red'
              : arrow.color.includes('yellow') ? 'arrowhead-yellow'
              : arrow.color.includes('blue') ? 'arrowhead-blue'
              : 'arrowhead-green';
            return (
              <line
                key={i}
                x1={cellCenter(arrow.from.row, arrow.from.col).x}
                y1={cellCenter(arrow.from.row, arrow.from.col).y}
                x2={cellCenter(arrow.to.row, arrow.to.col).x}
                y2={cellCenter(arrow.to.row, arrow.to.col).y}
                stroke={arrow.color}
                strokeWidth="3"
                strokeLinecap="round"
                markerEnd={`url(#${markerId})`}
              />
            );
          })}
        </svg>
      )}

      <div style={{
        position: 'absolute',
        bottom: -36,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Move {currentMoveIndex}/{totalMoves}
        </span>
      </div>
    </div>
  );
});
