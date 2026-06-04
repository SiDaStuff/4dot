import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useAuth } from '../context/AuthContext';

export function Matchmaking() {
  const { mode } = useParams<{ mode: string }>();
  const gameMode = mode === 'casual' ? 'casual' : 'rated';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { searching, queueSize, startSearch, cancelSearch } = useMatchmaking();
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started && user) {
      setStarted(true);
      startSearch(gameMode);
    }
  }, [user, gameMode, startSearch, started]);

  useEffect(() => {
    if (!searching) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [searching]);

  const handleCancel = async () => {
    await cancelSearch();
    navigate('/play');
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 500 }}>
        <Card padding="3rem" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(76,149,108,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Spinner size={32} />
            </div>
          </div>

          <h2 style={{ color: 'var(--color-dark)', marginBottom: '0.5rem' }}>Searching...</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Looking for {gameMode === 'rated' ? 'a rated' : 'a casual'} opponent
          </p>

          <div style={{
            fontSize: '2rem', fontWeight: 700, color: 'var(--color-success)',
            fontFamily: 'var(--font-mono)', marginBottom: '1rem',
          }}>
            {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
          </div>

          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
            {queueSize > 0 ? `${queueSize} player(s) in queue` : 'No players in queue'}
          </div>

          <Button variant="danger" onClick={handleCancel} fullWidth>
            Cancel Search
          </Button>
        </Card>
      </div>
    </div>
  );
}
