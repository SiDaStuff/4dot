import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { createBotGame } from '../services/matchmakingService';
import { showToast } from '../components/ui/Toast';
import { useState } from 'react';
import { api } from '../services/api';
import { CreateChallenge } from './Challenge';

const BOT_OPTIONS: { strength: string; label: string; desc: string; color: string }[] = [
  { strength: 'easy', label: 'Easy Bot', desc: 'Random moves. Great for learning.', color: 'var(--color-success)' },
  { strength: 'medium', label: 'Medium Bot', desc: 'Depth 3 search. A fair challenge.', color: 'var(--color-warning)' },
  { strength: 'hard', label: 'Hard Bot', desc: 'Depth 6 search. Tough opponent.', color: 'var(--color-danger)' },
  { strength: 'stockfish', label: '4dot Engine MAX', desc: 'Depth 10 search. Near-perfect play.', color: 'var(--color-dark)' },
];

export function Play() {
  const navigate = useNavigate();
  const [botLoading, setBotLoading] = useState<string | null>(null);

  const handleBotPlay = async (strength: string) => {
    setBotLoading(strength);
    try {
      const { gameId } = await createBotGame(strength);
      navigate(`/bot-game/${gameId}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to start bot game', 'error');
    } finally {
      setBotLoading(null);
    }
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 600 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">Play 4Dot</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
            Choose a game mode
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Card hover padding="1.5rem" onClick={() => navigate('/matchmaking/rated')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-md)',
                  background: 'rgba(76,149,108,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: 'var(--color-success)' }}>swords</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ color: 'var(--color-dark)' }}>Rated Match</h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    Glicko-2 rating system. Affects your ranking.
                  </p>
                </div>
                <Button variant="success">Play</Button>
              </div>
            </Card>

            <Card hover padding="1.5rem" onClick={() => navigate('/matchmaking/casual')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,201,185,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>casino</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ color: 'var(--color-dark)' }}>Casual Match</h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    No rating changes. Just for fun.
                  </p>
                </div>
                <Button variant="primary">Play</Button>
              </div>
            </Card>

            <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <h3 style={{ color: 'var(--color-dark)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', verticalAlign: 'middle', marginRight: 6 }}>smart_toy</span>
                vs Bot
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {BOT_OPTIONS.map(opt => (
                  <Card
                    key={opt.strength}
                    hover
                    padding="1rem"
                    onClick={() => handleBotPlay(opt.strength)}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                      background: opt.color, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', marginBottom: '0.5rem',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'white' }}>smart_toy</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-dark)' }}>{opt.label}</div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', marginTop: 2 }}>{opt.desc}</div>
                    {botLoading === opt.strength && (
                      <div style={{ color: 'var(--color-primary)', fontSize: '0.75rem', marginTop: 4 }}>Starting...</div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>

        <CreateChallenge />
      </div>
    </div>
  );
}
