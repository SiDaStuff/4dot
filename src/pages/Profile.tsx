import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getRatingHistory } from '../services/gameService';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { getAchievementsWithStatus } from '../utils/achievements';
import type { UserProfile } from '../types/user';

export function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingData, setRatingData] = useState<{ timestamp: number; rating: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const achievements = getAchievementsWithStatus();
  const earnedCount = achievements.filter(a => a.earnedAt).length;

  useEffect(() => {
    if (!user) return;
    api.get('/api/profile').then((data) => {
      setProfile(data as UserProfile);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getRatingHistory().then(setRatingData).catch(() => {});
  }, [user]);

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || ratingData.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const ratings = ratingData.map(d => d.rating);
    const minR = Math.min(...ratings) - 20;
    const maxR = Math.max(...ratings) + 20;
    const range = maxR - minR || 1;

    const padLeft = 45;
    const padRight = 10;
    const padTop = 10;
    const padBottom = 25;
    const graphW = w - padLeft - padRight;
    const graphH = h - padTop - padBottom;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + (graphH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + graphW, y);
      ctx.stroke();

      const val = Math.round(maxR - (range / gridLines) * i);
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toString(), padLeft - 6, y + 3);
    }

    const getX = (i: number) => padLeft + (i / (ratingData.length - 1)) * graphW;
    const getY = (r: number) => padTop + ((maxR - r) / range) * graphH;

    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + graphH);
    gradient.addColorStop(0, 'rgba(76, 149, 108, 0.15)');
    gradient.addColorStop(1, 'rgba(76, 149, 108, 0)');

    ctx.beginPath();
    ctx.moveTo(getX(0), padTop + graphH);
    for (let i = 0; i < ratingData.length; i++) {
      ctx.lineTo(getX(i), getY(ratingData[i].rating));
    }
    ctx.lineTo(getX(ratingData.length - 1), padTop + graphH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = '#4C956C';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (let i = 0; i < ratingData.length; i++) {
      if (i === 0) ctx.moveTo(getX(i), getY(ratingData[i].rating));
      else ctx.lineTo(getX(i), getY(ratingData[i].rating));
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(getX(ratingData.length - 1), getY(ratings[ratings.length - 1]), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4C956C';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [ratingData]);

  useEffect(() => {
    drawGraph();
    const handleResize = () => drawGraph();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawGraph]);

  if (loading) return <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}><Spinner size={40} /></div>;
  if (!profile) return <div className="page"><p>Profile not found</p></div>;

  const winRate = profile.gamesPlayed > 0
    ? ((profile.wins / profile.gamesPlayed) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 600 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">Profile</h1>

          <Card padding="2rem" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <Avatar username={profile.username} size={64} />
            </div>
            <h2 style={{ color: 'var(--color-dark)', fontSize: '1.5rem' }}>{profile.username}</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Joined {new Date(profile.createdAt).toLocaleDateString()}
            </p>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.5rem',
            }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>{profile.rating}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Rating</div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-dark)' }}>{profile.gamesPlayed}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Games</div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>{winRate}%</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Win Rate</div>
              </div>
            </div>
          </Card>

          {ratingData.length >= 2 && (
            <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Rating Over Time</h3>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: 180, display: 'block' }}
              />
            </Card>
          )}

          <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>
              Achievements ({earnedCount}/{achievements.length})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {achievements.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: a.earnedAt ? 'rgba(76, 149, 108, 0.08)' : 'var(--color-bg-secondary)',
                  border: a.earnedAt ? '1px solid rgba(76, 149, 108, 0.3)' : '1px solid var(--color-border-light)',
                  opacity: a.earnedAt ? 1 : 0.5,
                }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: '1.2rem',
                    color: a.earnedAt ? 'var(--color-success)' : 'var(--color-text-muted)',
                  }}>
                    {a.icon}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.75rem', color: a.earnedAt ? 'var(--color-dark)' : 'var(--color-text-muted)' }}>
                      {a.label}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                      {a.earnedAt ? new Date(a.earnedAt).toLocaleDateString() : a.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="2rem">
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Statistics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Row label="Wins" value={profile.wins.toString()} color="var(--color-success)" />
              <Row label="Losses" value={profile.losses.toString()} color="var(--color-danger)" />
              <Row label="Draws" value={profile.draws.toString()} color="var(--color-text-muted)" />
              <Row label="Rating Deviation" value={profile.ratingDeviation.toString()} />
              <Row label="Volatility" value={profile.volatility.toFixed(3)} />
              <Row label="Online Status" value={profile.online ? 'Online' : 'Offline'} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-light)' }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || 'var(--color-text)', fontSize: '0.9rem' }}>{value}</span>
    </div>
  );
}
