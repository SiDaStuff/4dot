import React from 'react';
import type { CellOwner } from '../../types';

interface CellProps {
  value: CellOwner;
  row: number;
  col: number;
  isWinCell: boolean;
  isSelected: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  isAnimatingFrom: boolean;
  isAnimatingTo: boolean;
  animatingPlayer?: string;
  isPremoveFrom: boolean;
  isPremoveTo: boolean;
  onClick: () => void;
}

export const Cell = React.memo(function Cell({
  value,
  isWinCell,
  isSelected,
  isLastMoveFrom,
  isLastMoveTo,
  isAnimatingFrom,
  isAnimatingTo,
  animatingPlayer,
  isPremoveFrom,
  isPremoveTo,
  onClick,
}: CellProps) {
  const size = typeof window !== 'undefined' && window.innerWidth < 400 ? 48 : 56;

  const isLastMove = isLastMoveTo;

  let border = `1px solid ${isWinCell ? 'var(--color-success)' : 'var(--color-border)'}`;
  if (isLastMoveFrom || isLastMoveTo) {
    border = '1px solid rgba(76, 149, 108, 0.4)';
  }

  let background = 'var(--color-white)';
  if (isWinCell) background = 'rgba(76, 149, 108, 0.12)';
  else if (isLastMoveTo) background = 'rgba(76, 149, 108, 0.1)';
  else if (isLastMoveFrom) background = 'rgba(76, 149, 108, 0.06)';
  if (isPremoveTo) background = 'rgba(76, 149, 108, 0.15)';

  let boxShadow = 'none';
  if (isSelected) boxShadow = '0 0 0 2px var(--color-success)';
  else if (isPremoveFrom) boxShadow = '0 0 0 2px rgba(76, 149, 108, 0.5)';

  const pieceBoxShadow = isLastMove
    ? '0 0 0 3px var(--color-success), 0 0 8px rgba(76, 149, 108, 0.4)'
    : isPremoveTo
    ? '0 0 0 2px rgba(76, 149, 108, 0.6)'
    : '0 1px 3px rgba(0,0,0,0.3)';

  const showGhost = isAnimatingFrom && animatingPlayer;
  const showArriving = isAnimatingTo && animatingPlayer && !value;

  return (
    <button
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-sm)',
        border,
        background,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all var(--transition-fast)',
        position: 'relative',
        boxShadow,
      }}
    >
      {value && !isAnimatingFrom && (
        <div style={{
          width: size * 0.55,
          height: size * 0.55,
          borderRadius: '50%',
          background: value === 'black' ? '#1a1a1a' : '#ffffff',
          border: value === 'white' ? '2px solid #1a1a1a' : '2px solid #444',
          boxShadow: pieceBoxShadow,
          transition: 'all var(--transition-normal)',
          animation: 'fadeIn 200ms ease-out',
        }} />
      )}
      {showGhost && (
        <div style={{
          width: size * 0.55,
          height: size * 0.55,
          borderRadius: '50%',
          background: animatingPlayer === 'black' ? '#1a1a1a' : '#ffffff',
          border: animatingPlayer === 'white' ? '2px solid #1a1a1a' : '2px solid #444',
          opacity: 0.3,
          animation: 'fadeOut 300ms ease-out forwards',
        }} />
      )}
      {showArriving && (
        <div style={{
          width: size * 0.55,
          height: size * 0.55,
          borderRadius: '50%',
          background: animatingPlayer === 'black' ? '#1a1a1a' : '#ffffff',
          border: animatingPlayer === 'white' ? '2px solid #1a1a1a' : '2px solid #444',
          animation: 'pieceArrive 300ms ease-out',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      )}
    </button>
  );
});
