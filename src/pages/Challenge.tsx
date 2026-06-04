import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, API_URL } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { showToast } from '../components/ui/Toast';

async function publicFetch(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) } });
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const retrySec = retryAfter ? parseInt(retryAfter, 10) : 60;
    const data429 = await res.json().catch(() => ({}));
    const serverRetry = data429.retryAfter || retrySec;
    showToast('Slow down — rate limit reached', 'ratelimit', serverRetry);
    throw new Error(data429.error || 'Too many requests');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function Challenge() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<{ fromUsername: string; fromRating: number; mode: string; timeControl: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) { setError('Invalid challenge link'); setLoading(false); return; }
    publicFetch(`/api/challenge/info/${code}`)
      .then((data) => { setChallenge(data); setLoading(false); })
      .catch((err) => { setError(err.message || 'Challenge not found'); setLoading(false); });
  }, [code]);

  const handleAccept = async () => {
    if (!code) return;
    setAccepting(true);
    try {
      let data;
      if (user) {
        data = await api.post(`/api/challenge/accept/${code}`);
      } else {
        data = await publicFetch(`/api/challenge/accept/${code}`, { method: 'POST' });
      }
      if (data.gameId) {
        if (data.isGuest && data.guestUid) {
          navigate(`/game/${data.gameId}?guestUid=${encodeURIComponent(data.guestUid)}`);
        } else {
          navigate(`/game/${data.gameId}`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept challenge');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <Spinner size={40} />
      </div>
    );
  }

  if (error && !challenge) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 500, textAlign: 'center', paddingTop: '4rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--color-danger)', display: 'block', marginBottom: '1rem' }}>link_off</span>
          <h2 style={{ color: 'var(--color-danger)', marginBottom: '0.5rem' }}>Challenge Not Found</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <Button variant="primary" onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const timeMin = challenge ? Math.round(challenge.timeControl / 60000) : 3;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 500, paddingTop: '3rem' }}>
        <Card padding="2rem" style={{ textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--color-success)', display: 'block', marginBottom: '1rem' }}>swords</span>
          <h2 style={{ color: 'var(--color-dark)', marginBottom: '0.5rem' }}>Challenge from {challenge?.fromUsername}</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-dark)' }}>{challenge?.fromRating}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Rating</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{timeMin}m</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Time</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: challenge?.mode === 'rated' ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                {challenge?.mode === 'rated' ? 'Rated' : 'Casual'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Mode</div>
            </div>
          </div>

          {!user && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              You can accept without an account as a guest.
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <Button variant="success" onClick={handleAccept} loading={accepting} style={{ minWidth: 140 }}>
              Accept Challenge
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')} style={{ minWidth: 100 }}>
              Decline
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function CreateChallenge() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const data = await api.post('/api/challenge/create', { mode: 'casual' });
      const baseUrl = window.location.origin;
      setChallengeUrl(`${baseUrl}/challenge/${data.code}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create challenge', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(challengeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card padding="1.5rem" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', verticalAlign: 'middle', marginRight: 6 }}>link</span>
        Challenge Link
      </h3>
      {!challengeUrl ? (
        <Button variant="primary" onClick={handleCreate} loading={creating}>
          Create Challenge Link
        </Button>
      ) : (
        <div>
          <div style={{
            padding: '10px 14px', background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
            fontSize: '0.85rem', wordBreak: 'break-all', color: 'var(--color-primary)',
            marginBottom: '0.5rem',
          }}>
            {challengeUrl}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            Share this link. Anyone can accept, even without an account.
          </p>
          <Button variant="success" size="sm" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>
      )}
    </Card>
  );
}
