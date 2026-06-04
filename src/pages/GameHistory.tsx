import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGameHistory } from '../services/gameService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import type { GameMode } from '../types';

interface HistoryEntry {
  id: string;
  opponent: string;
  opponentUid: string;
  result: 'win' | 'loss' | 'draw';
  mode: GameMode;
  ratingChange: number;
  timestamp: number;
  method?: string;
}

export function GameHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [lastKey, setLastKey] = useState<string | undefined>();

  const loadGames = useCallback(async (key?: string) => {
    if (!user) return;
    try {
      const data = await getGameHistory(key, 20);
      if (key) {
        setGames(prev => [...prev, ...data.games]);
      } else {
        setGames(data.games);
      }
      setHasMore(data.hasMore);
      if (data.games.length > 0) {
        setLastKey(data.games[data.games.length - 1].id);
      }
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const resultColor = (r: string) => r === 'win' ? 'var(--color-success)' : r === 'loss' ? 'var(--color-danger)' : 'var(--color-text-muted)';

  if (loading) {
    return <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}><Spinner size={40} /></div>;
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">Game History</h1>

          {games.length === 0 ? (
            <Card padding="2rem" style={{ textAlign: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>history</span>
              <p style={{ color: 'var(--color-text-muted)' }}>No games played yet</p>
              <Button variant="success" onClick={() => navigate('/play')} style={{ marginTop: '1rem' }}>Play Now</Button>
            </Card>
          ) : (
            <>
              <Card padding="0" style={{ overflow: 'hidden' }}>
                {games.map((g, i) => (
                  <div
                    key={g.id}
                    onClick={() => navigate(`/game/${g.id}`)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: i < games.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                      cursor: 'pointer',
                      transition: 'background var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: resultColor(g.result), minWidth: 40 }}>
                        {g.result.toUpperCase()}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/player/${g.opponentUid}`); }}
                            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 'inherit' }}
                          >
                            {g.opponent}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {formatDate(g.timestamp)}
                          {g.method ? ` · ${g.method}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge variant={g.mode === 'rated' ? 'success' : 'default'}>{g.mode}</Badge>
                      {g.ratingChange !== 0 && (
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: g.ratingChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                        }}>
                          {g.ratingChange >= 0 ? '+' : ''}{g.ratingChange}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </Card>

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <Button variant="ghost" onClick={() => loadGames(lastKey)}>Load More</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
