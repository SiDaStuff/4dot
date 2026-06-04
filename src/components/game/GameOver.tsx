import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Game, CellOwner } from '../../types';
import { Confetti } from './Confetti';
import { useSettings } from '../../context/SettingsContext';
import { downloadPGN } from '../../utils/pgn';

interface GameOverProps {
  game: Game;
  myUid: string;
  onPlayAgain?: () => void;
  onBackToDashboard?: () => void;
  onRematch?: () => void;
  onOfferDraw?: () => void;
  drawOfferPending?: boolean;
  opponentDrawOffer?: boolean;
  onAcceptDraw?: () => void;
  onRejectDraw?: () => void;
}

export function GameOverOverlay({ game, myUid, onPlayAgain, onBackToDashboard, onRematch, drawOfferPending, opponentDrawOffer, onAcceptDraw, onRejectDraw }: GameOverProps) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { settings } = useSettings();
  useEffect(() => { setDismissed(false); }, [game.id]);

  if (opponentDrawOffer && game.status === 'active') {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(4px)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
          padding: '1.5rem 2rem',
          textAlign: 'center',
          maxWidth: 320,
          animation: 'fadeIn 200ms ease-out',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: 'var(--color-warning)', display: 'block', marginBottom: '0.5rem' }}>handshake</span>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Draw Offer</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>Your opponent offers a draw</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={onAcceptDraw} style={{ padding: '8px 20px', borderRadius: 'var(--radius-md)', background: 'var(--color-success)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Accept</button>
            <button onClick={onRejectDraw} style={{ padding: '8px 20px', borderRadius: 'var(--radius-md)', background: 'var(--color-danger)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Decline</button>
          </div>
        </div>
      </div>
    );
  }

  if (game.status !== 'finished' || !game.result || dismissed) return null;

  const result = game.result;
  const isWin = result.winner === (game.blackPlayer.uid === myUid ? 'black' : 'white');
  const isDraw = result.winner === 'draw';
  const winnerName = result.winner === 'black' ? game.blackPlayer.username : game.whitePlayer.username;
  const winnerId = result.winner === 'black' ? game.blackPlayer.uid : game.whitePlayer.uid;

  const methodLabels: Record<string, string> = {
    'four-in-a-row': 'Four in a row',
    timeout: 'Timeout',
    resign: 'Resignation',
    resignation: 'Resignation',
    abandon: 'Opponent left',
    'draw-agreed': 'Draw agreed',
    'threefold-repetition': 'Threefold repetition',
    '100-ply': '100-ply limit',
    'admin-intervention': 'Admin intervention',
  };

  const myColor: CellOwner = game.blackPlayer.uid === myUid ? 'black' : 'white';
  const myRatingChange = myColor === 'black' ? result.ratingChangeBlack : result.ratingChangeWhite;

  const shareUrl = `${window.location.origin}/game/${game.id}`;

  const handleExportPGN = () => {
    downloadPGN(
      game.moves || [],
      game.blackPlayer.username,
      game.whitePlayer.username,
      result.winner === 'draw' ? '1/2-1/2' : result.winner === 'black' ? '0-1' : '1-0',
      `4dot_${game.id}.pgn`
    );
  };

  const handleShare = async () => {
    const text = isDraw
      ? `I drew a game of 4Dot! ${shareUrl}`
      : isWin
      ? `I won my 4Dot game! ${shareUrl}`
      : `I lost my 4Dot game. ${shareUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: '4Dot Game', text, url: shareUrl }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Confetti active={isWin} />

      <div
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(4px)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
          padding: '2rem 2.5rem',
          textAlign: 'center',
          maxWidth: 360,
          width: '90%',
          animation: 'fadeIn 300ms ease-out',
          position: 'relative',
        }}
      >
        <button
          onClick={() => setDismissed(true)}
          style={{
            position: 'absolute',
            top: 8,
            right: 12,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: '1.25rem',
            lineHeight: 1,
            padding: 4,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>close</span>
        </button>

        <div style={{ marginBottom: '0.5rem' }}>
          <span className="material-symbols-outlined" style={{
            fontSize: '2.5rem',
            color: isDraw ? 'var(--color-text-secondary)' : isWin ? 'var(--color-success)' : 'var(--color-danger)',
          }}>
            {isDraw ? 'handshake' : isWin ? 'emoji_events' : 'sentiment_dissatisfied'}
          </span>
        </div>

        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: isDraw ? 'var(--color-text)' : isWin ? 'var(--color-success)' : 'var(--color-danger)',
          marginBottom: '0.25rem',
        }}>
          {isDraw ? 'Draw' : isWin ? 'Victory!' : 'Defeat'}
        </h2>

        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          {isDraw ? '' : (
            <>
              <button
                onClick={() => navigate(`/player/${winnerId}`)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  fontSize: 'inherit',
                }}
              >
                {winnerName}
              </button>
              {' '}wins
            </>
          )}{isDraw ? '' : ' '}by {methodLabels[result.method] || result.method}
        </p>

        {game.mode === 'rated' && (
          <p style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: myRatingChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            marginBottom: '0.75rem',
          }}>
            {myRatingChange >= 0 ? '+' : ''}{myRatingChange} rating
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {onPlayAgain && (
            <button onClick={onPlayAgain} style={{
              padding: '8px 20px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-success)', color: 'white',
              border: 'none', fontWeight: 600, cursor: 'pointer',
            }}>
              Play Again
            </button>
          )}
          {onRematch && !game.isBotGame && (
            <button onClick={onRematch} style={{
              padding: '8px 20px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-dark)', color: 'white',
              border: 'none', fontWeight: 600, cursor: 'pointer',
            }}>
              Rematch
            </button>
          )}
          {onBackToDashboard && (
            <button onClick={onBackToDashboard} style={{
              padding: '8px 20px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary)', color: 'var(--color-text)',
              border: 'none', fontWeight: 600, cursor: 'pointer',
            }}>
              Dashboard
            </button>
          )}
        </div>

        <div style={{ marginTop: '0.75rem', display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={handleShare} style={{
            padding: '6px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontWeight: 600, cursor: 'pointer',
            fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4,
          }}>
      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>share</span>
      {copied ? 'Copied!' : 'Share'}
    </button>
    <button onClick={handleExportPGN} style={{
      padding: '6px 14px', borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
      color: 'var(--color-text)', fontWeight: 600, cursor: 'pointer',
      fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>download</span>
      PGN
    </button>
  </div>
      </div>
    </div>
  );
}
