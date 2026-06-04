import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPublicProfile, type PublicProfile } from '../services/publicProfileService';
import { sendFriendRequest, sendDuelRequest, removeFriend } from '../services/friendService';
import { getOpponentStats } from '../services/gameService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Spinner } from '../components/ui/Spinner';
import { showToast } from '../components/ui/Toast';
import { useSettings } from '../context/SettingsContext';

export function PublicProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings, isBlocked, isMuted, blockUser, unblockUser, muteUser, unmuteUser } = useSettings();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [duelSending, setDuelSending] = useState(false);
  const [removingFriend, setRemovingFriend] = useState(false);
  const [opponentStats, setOpponentStats] = useState<{ wins: number; losses: number; draws: number } | null>(null);
  const [duelCooldown, setDuelCooldown] = useState(false);
  const duelCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = uid ? isBlocked(uid) : false;
  const muted = uid ? isMuted(uid) : false;

  useEffect(() => {
    if (!uid) {
      navigate('/browse');
      return;
    }
    setLoading(true);
    getPublicProfile(uid)
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [uid]);

  useEffect(() => {
    if (!uid || !user || user.uid === uid) return;
    getOpponentStats(uid).then(setOpponentStats).catch(() => {});
  }, [uid, user]);

  const handleAddFriend = async () => {
    if (!profile) return;
    setSending(true);
    try {
      const result = await sendFriendRequest(user?.uid || '', profile.username);
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        showToast('Friend request sent', 'success');
        setProfile({ ...profile, friendRequestPending: true });
      }
    } catch (err) {
      showToast('Failed to send friend request', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!profile || !user) return;
    setRemovingFriend(true);
    try {
      await removeFriend(user.uid, profile.uid);
      showToast('Friend removed', 'info');
      setProfile({ ...profile, isFriend: false });
    } catch (err) {
      showToast('Failed to remove friend', 'error');
    } finally {
      setRemovingFriend(false);
    }
  };

  const handleDuel = async () => {
    if (!profile || !user || duelCooldown) return;
    setDuelSending(true);
    try {
      const result = await sendDuelRequest(user.uid, profile.uid, profile.username);
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        showToast(`Duel request sent to ${profile.username}!`, 'success');
        setDuelCooldown(true);
        duelCooldownRef.current = setTimeout(() => {
          setDuelCooldown(false);
          duelCooldownRef.current = null;
        }, 30000);
      }
    } catch (err) {
      showToast('Failed to send duel request', 'error');
    } finally {
      setDuelSending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (duelCooldownRef.current) clearTimeout(duelCooldownRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <Spinner size={40} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 600 }}>
          <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Profile not found
          </p>
          <Button
            variant="primary"
            onClick={() => navigate('/browse')}
            style={{ marginTop: '1rem' }}
          >
            Back to Browse
          </Button>
        </div>
      </div>
    );
  }

  const winRate = (profile.gamesPlayed ?? 0) > 0
    ? (((profile.wins ?? 0) / (profile.gamesPlayed ?? 1)) * 100).toFixed(1)
    : '0.0';

  const isOwnProfile = user?.uid === profile.uid;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 600 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <Button
            variant="ghost"
            onClick={() => navigate('/browse')}
            style={{ marginBottom: '1rem' }}
          >
            &larr; Back
          </Button>

          <Card padding="2rem" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <Avatar username={profile.username} size={64} />
            </div>
            <h2 style={{ color: 'var(--color-dark)', fontSize: '1.5rem' }}>
              {profile.username}
            </h2>

            {profile.banned && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: '#fee2e2',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #fecaca',
                }}
              >
                <div style={{ fontWeight: 600, color: '#991b1b', fontSize: '0.95rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: 4 }}>block</span>{profile.banReason || 'Account Suspended'}
                </div>
                {profile.banUntil && (
                  <div style={{ fontSize: '0.85rem', color: '#7f1d1d', marginTop: '0.25rem' }}>
                    Until: {new Date(profile.banUntil).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}

            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Joined {new Date(profile.createdAt).toLocaleDateString()}
            </p>
            {profile.online ? (
              <div style={{ color: 'var(--color-success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>circle</span> Online
              </div>
            ) : (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Last seen{' '}
                {new Date(profile.lastSeen).toLocaleDateString()}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginTop: '1.5rem',
              }}
            >
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>
                  {profile.rating}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Rating
                </div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-dark)' }}>
                  {profile.gamesPlayed ?? 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Games
                </div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {winRate}%
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Win Rate
                </div>
              </div>
            </div>

            {!isOwnProfile && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                {profile.isFriend ? (
                  <>
                    <Button
                      variant="danger"
                      onClick={handleRemoveFriend}
                      disabled={removingFriend}
                      style={{ flex: 1 }}
                    >
                      {removingFriend ? 'Removing...' : 'Remove Friend'}
                    </Button>
                    <Button
                      variant="success"
                      onClick={handleDuel}
                      disabled={duelSending || duelCooldown}
                      style={{ flex: 1 }}
                    >
                      {duelSending ? 'Sending...' : duelCooldown ? 'Duel Sent (30s)' : 'Duel'}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleAddFriend}
                    disabled={sending || profile.friendRequestPending}
                    style={{ flex: 1 }}
                  >
                    {profile.friendRequestPending ? 'Request Sent' : sending ? 'Adding...' : '+ Add Friend'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { if (blocked) unblockUser(profile.uid); else blockUser(profile.uid); }}
                  style={{ minWidth: 80 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: 4 }}>{blocked ? 'lock_open' : 'block'}</span>
                  {blocked ? 'Unblock' : 'Block'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { if (muted) unmuteUser(profile.uid); else muteUser(profile.uid); }}
                  style={{ minWidth: 80 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: 4 }}>{muted ? 'notifications' : 'notifications_off'}</span>
                  {muted ? 'Unmute' : 'Mute'}
                </Button>
              </div>
            )}
          </Card>

          {opponentStats && !isOwnProfile && ((opponentStats.wins ?? 0) + (opponentStats.losses ?? 0) + (opponentStats.draws ?? 0) > 0) && (
            <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Your Record vs {profile.username}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>{opponentStats.wins}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Wins</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>{opponentStats.losses}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Losses</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{opponentStats.draws}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Draws</div>
                </div>
              </div>
            </Card>
          )}

          <Card padding="2rem">
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>
              Statistics
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Row label="Wins" value={(profile.wins ?? 0).toString()} color="var(--color-success)" />
        <Row
          label="Losses"
          value={(profile.losses ?? 0).toString()}
          color="var(--color-danger)"
        />
        <Row
          label="Draws"
          value={(profile.draws ?? 0).toString()}
          color="var(--color-text-muted)"
        />
        <Row label="Rating Deviation" value={(profile.ratingDeviation ?? 350).toString()} />
        <Row label="Volatility" value={(profile.volatility ?? 0.06).toFixed(3)} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid var(--color-border-light)',
      }}
    >
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
        {label}
      </span>
      <span
        style={{
          fontWeight: 600,
          color: color || 'var(--color-text)',
          fontSize: '0.9rem',
        }}
      >
        {value}
      </span>
    </div>
  );
}
