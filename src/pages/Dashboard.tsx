import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getActivityFeed } from '../services/gameService';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { useSettings } from '../context/SettingsContext';
import { getAchievementsWithStatus } from '../utils/achievements';
import { Badge } from '../components/ui/Badge';

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  ratingChange?: number;
  opponent?: string;
  opponentUid?: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const achievements = getAchievementsWithStatus();
  const earnedCount = achievements.filter(a => a.earnedAt).length;

  useEffect(() => {
    if (!user) return;
    api.get('/api/profile').then((data: any) => {
      setProfile(data);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user || !settings.showActivityFeed) return;
    getActivityFeed().then((data) => {
      setActivity(data.slice(0, 10));
      setActivityLoading(false);
    }).catch(() => setActivityLoading(false));
  }, [user, settings.showActivityFeed]);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 800 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
          </p>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '2rem' }}>
            <Link to="/play" style={{ textDecoration: 'none' }}>
              <Card hover padding="1.5rem">
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>sports_esports</span></div>
                <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.25rem' }}>Play</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Find a match</p>
              </Card>
            </Link>
            <Link to="/leaderboards" style={{ textDecoration: 'none' }}>
              <Card hover padding="1.5rem">
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>leaderboard</span></div>
                <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.25rem' }}>Leaderboards</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Global rankings</p>
              </Card>
            </Link>
            <Link to="/friends" style={{ textDecoration: 'none' }}>
              <Card hover padding="1.5rem">
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>group</span></div>
                <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.25rem' }}>Friends</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Manage friends</p>
              </Card>
            </Link>
            <Link to="/spectate" style={{ textDecoration: 'none' }}>
              <Card hover padding="1.5rem">
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>visibility</span></div>
                <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.25rem' }}>Spectate</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Watch live games</p>
              </Card>
            </Link>
            <Link to="/game-history" style={{ textDecoration: 'none' }}>
              <Card hover padding="1.5rem">
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>history</span></div>
                <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.25rem' }}>History</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Past games</p>
              </Card>
            </Link>
            <Link to="/profile" style={{ textDecoration: 'none' }}>
              <Card hover padding="1.5rem">
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>emoji_events</span></div>
                <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.25rem' }}>Achievements</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{earnedCount}/{achievements.length} earned</p>
              </Card>
            </Link>
          </div>

          {settings.showActivityFeed && (
            <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Recent Activity</h2>
              {activityLoading ? (
                <div style={{ textAlign: 'center', padding: '1rem' }}><Spinner size={24} /></div>
              ) : activity.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No recent activity</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activity.map((item) => (
                    <div key={item.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-bg-secondary)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{
                          fontSize: '1.1rem',
                          color: item.type === 'win' ? 'var(--color-success)' : item.type === 'loss' ? 'var(--color-danger)' : 'var(--color-text-muted)',
                        }}>
                          {item.type === 'win' ? 'emoji_events' : item.type === 'loss' ? 'sentiment_dissatisfied' : item.type === 'draw' ? 'handshake' : 'sports_esports'}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{item.message}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {item.ratingChange !== undefined && item.ratingChange !== 0 && (
                          <span style={{
                            fontWeight: 700, fontSize: '0.8rem',
                            color: item.ratingChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                          }}>
                            {item.ratingChange >= 0 ? '+' : ''}{item.ratingChange}
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{formatTime(item.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card padding="2rem">
            <h2 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>How to Play</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ color: 'var(--color-success)', marginBottom: '0.25rem' }}>Phase 1: Placement</h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Alternate placing 8 pieces each on a 6x6 board. Form 4 in a row to win instantly.</p>
              </div>
              <div>
                <h4 style={{ color: 'var(--color-dark)', marginBottom: '0.25rem' }}>Phase 2: Movement</h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Move one piece per turn like a king in chess (any adjacent square). Connect four to win.</p>
              </div>
              <div>
                <h4 style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Draws</h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Threefold repetition or 100 moves without a winner ends in a draw.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
