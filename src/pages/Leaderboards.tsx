import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Avatar } from '../components/ui/Avatar';

type LeaderboardPeriod = 'all' | 'monthly' | 'weekly';

interface PeriodEntry {
  uid: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

export function Leaderboards() {
  const navigate = useNavigate();
  const { entries, loading, hasMore, loadMore } = useLeaderboard();
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const [periodEntries, setPeriodEntries] = useState<PeriodEntry[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);

  const loadPeriodLeaderboard = useCallback(async () => {
    if (period === 'all') return;
    setPeriodLoading(true);
    try {
      const data = await api.get(`/api/leaderboard/${period}`);
      setPeriodEntries(data.entries || []);
    } catch {
      setPeriodEntries([]);
    }
    setPeriodLoading(false);
  }, [period]);

  useEffect(() => {
    if (period !== 'all') loadPeriodLeaderboard();
  }, [period, loadPeriodLeaderboard]);

  const displayEntries = period === 'all' ? entries : periodEntries;
  const displayLoading = period === 'all' ? loading : periodLoading;
  const displayHasMore = period === 'all' ? hasMore : false;

  const periodBadge = period === 'monthly' ? 'This Month' : period === 'weekly' ? 'This Week' : 'All Time';
  const resetInfo = period === 'monthly'
    ? 'Resets on the 1st of each month'
    : period === 'weekly'
    ? 'Resets every Monday'
    : '';

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">Leaderboards</h1>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {(['all', 'weekly', 'monthly'] as LeaderboardPeriod[]).map(p => (
              <Button
                key={p}
                variant={period === p ? 'success' : 'secondary'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {p === 'all' ? 'All Time' : p === 'weekly' ? 'Weekly' : 'Monthly'}
              </Button>
            ))}
          </div>

          {resetInfo && (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', verticalAlign: 'middle', marginRight: 4 }}>schedule</span>
              {resetInfo}
            </p>
          )}

          <Card padding="0" style={{ overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 80px 80px 80px',
              gap: 0, padding: '12px 16px',
              background: 'var(--color-bg-secondary)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)',
            }}>
              <span>Rank</span>
              <span>Player</span>
              <span style={{ textAlign: 'right' }}>Rating</span>
              <span style={{ textAlign: 'right' }}>W</span>
              <span style={{ textAlign: 'right' }}>L</span>
            </div>

            {displayEntries.length === 0 && !displayLoading && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No players yet
              </div>
            )}

            {displayEntries.map((entry, i) => (
              <div key={entry.uid} style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 80px 80px 80px',
                gap: 0, padding: '10px 16px',
                borderBottom: i < displayEntries.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                alignItems: 'center',
                transition: 'background var(--transition-fast)',
              }}>
                <span style={{
                  fontWeight: 700,
                  color: i < 3 ? 'var(--color-success)' : 'var(--color-text-muted)',
                  fontSize: i < 3 ? '1rem' : '0.9rem',
                }}>
                  {i + 1}
                </span>
                <button
                  onClick={() => navigate(`/player/${entry.uid}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  <Avatar username={entry.username} size={28} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary)' }}>{entry.username}</span>
                </button>
                <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-dark)', fontSize: '0.9rem' }}>
                  {entry.rating}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--color-success)', fontSize: '0.85rem' }}>
                  {entry.wins}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                  {entry.losses}
                </span>
              </div>
            ))}

            {displayLoading && (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <Spinner size={24} />
              </div>
            )}

            {displayHasMore && !displayLoading && (
              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <Button variant="ghost" onClick={loadMore}>Load More</Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
