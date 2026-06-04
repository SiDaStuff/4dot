import type { Game } from '../../types';

interface MoveHistoryProps {
  moves: Game['moves'];
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  return (
    <div style={{
      maxHeight: 200,
      overflowY: 'auto',
      padding: '8px',
      background: 'var(--color-bg-secondary)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
        Move History
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {moves?.map((move, i) => (
          <span
            key={i}
            style={{
              fontSize: '0.75rem',
              padding: '2px 6px',
              borderRadius: 4,
              background: move.player === 'black' ? 'rgba(44,110,73,0.1)' : 'rgba(255,201,185,0.3)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {move.moveNumber}.
            {move.from
              ? `${String.fromCharCode(97 + move.from.col)}${5 - move.from.row}→${String.fromCharCode(97 + move.to.col)}${5 - move.to.row}`
              : `${String.fromCharCode(97 + move.to.col)}${5 - move.to.row}`
            }
          </span>
        ))}
        {(!moves || moves.length === 0) && (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>No moves yet</span>
        )}
      </div>
    </div>
  );
}