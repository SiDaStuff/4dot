import React from 'react';
import type { Game } from '../../types';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { countPiecesOnBoard } from '../../utils/boardUtils';
import { TOTAL_PIECES } from '../../types';

interface GameInfoProps {
  game: Game;
  myUid: string;
}

export const GameInfo = React.memo(function GameInfo({ game, myUid }: GameInfoProps) {
  const navigate = useNavigate();
  const myColor = game.blackPlayer.uid === myUid ? 'black' : 'white';

  const blackOnBoard = countPiecesOnBoard(game.board, 'black');
  const whiteOnBoard = countPiecesOnBoard(game.board, 'white');
  const blackRemaining = TOTAL_PIECES - blackOnBoard;
  const whiteRemaining = TOTAL_PIECES - whiteOnBoard;
  const isPlacement = game.phase === 'placement';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      background: 'var(--color-bg-secondary)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
    }}>
      <button
        onClick={() => game.blackPlayer.uid !== myUid && navigate(`/player/${game.blackPlayer.uid}`)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'none',
          border: 'none',
          cursor: game.blackPlayer.uid === myUid ? 'default' : 'pointer',
          padding: 0,
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: '#1a1a1a',
          border: '2px solid #444',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', textAlign: 'left' }}>
            <span style={{ color: game.blackPlayer.uid === myUid ? 'inherit' : 'var(--color-primary)' }}>
              {game.blackPlayer.uid === myUid ? 'You' : game.blackPlayer.username}
            </span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginLeft: 6 }}>
              ({game.blackPlayer.rating})
            </span>
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
            Black
            {isPlacement && (
              <span style={{ marginLeft: 6, color: 'var(--color-text-muted)' }}>
                {blackRemaining}/{TOTAL_PIECES}
              </span>
            )}
            {!isPlacement && game.phase !== 'finished' && (
              <span style={{ marginLeft: 6, color: 'var(--color-text-muted)' }}>
                {blackOnBoard} pcs
              </span>
            )}
          </div>
        </div>
      </button>

      <Badge variant={game.mode === 'rated' ? 'success' : 'default'}>
        {game.mode === 'rated' ? 'Rated' : 'Casual'}
      </Badge>

      <button
        onClick={() => game.whitePlayer.uid !== myUid && navigate(`/player/${game.whitePlayer.uid}`)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'none',
          border: 'none',
          cursor: game.whitePlayer.uid === myUid ? 'default' : 'pointer',
          padding: 0,
          textAlign: 'right',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            <span style={{ color: game.whitePlayer.uid === myUid ? 'inherit' : 'var(--color-primary)' }}>
              {game.whitePlayer.uid === myUid ? 'You' : game.whitePlayer.username}
            </span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginLeft: 6 }}>
              ({game.whitePlayer.rating})
            </span>
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
            White
            {isPlacement && (
              <span style={{ marginLeft: 6, color: 'var(--color-text-muted)' }}>
                {whiteRemaining}/{TOTAL_PIECES}
              </span>
            )}
            {!isPlacement && game.phase !== 'finished' && (
              <span style={{ marginLeft: 6, color: 'var(--color-text-muted)' }}>
                {whiteOnBoard} pcs
              </span>
            )}
          </div>
        </div>
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: '#ffffff',
          border: '2px solid #1a1a1a',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  );
});
