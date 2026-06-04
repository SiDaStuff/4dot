import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveGames } from '../services/gameService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { showToast } from '../components/ui/Toast';

export function Spectate() {
  const navigate = useNavigate();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const load = async () => {
    try {
      const active = await getActiveGames();
      setGames(active.filter((g: any) => g.status === 'active' && !g.isBotGame));
    } catch (err: any) {
      showToast(err.message || 'Failed to load games', 'error');
    } finally {
      setLoading(false);
    }
  };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">Live Games</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
            Watch ongoing matches
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}><Spinner size={32} /></div>
          ) : games.length === 0 ? (
            <Card padding="2rem" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>visibility</span>
              </div>
              <p style={{ color: 'var(--color-text-muted)' }}>No active games right now</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {games.map((game: any) => (
                <Card
                  key={game.id}
                  hover
                  padding="1rem"
                  onClick={() => navigate(`/game/${game.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--color-success)',
                      }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/player/${game.blackPlayer?.uid}`); }}
                            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 'inherit' }}
                          >
                            {game.blackPlayer?.username}
                          </button>
                          <span style={{ color: 'var(--color-text-muted)', margin: '0 0.25rem' }}>vs</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/player/${game.whitePlayer?.uid}`); }}
                            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 'inherit' }}
                          >
                            {game.whitePlayer?.username}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          {game.blackPlayer?.rating} &middot; {game.whitePlayer?.rating}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge variant={game.mode === 'rated' ? 'success' : 'default'}>{game.mode}</Badge>
                      <Badge variant="info">{game.phase}</Badge>
                      <Button size="sm" variant="secondary">Watch</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
