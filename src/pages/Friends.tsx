import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFriends } from '../hooks/useFriends';
import { sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend, sendDuelRequest } from '../services/friendService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { showToast } from '../components/ui/Toast';

export function Friends() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requests, friends, refresh } = useFriends();
  const [friendUsername, setFriendUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [duelLoading, setDuelLoading] = useState<string | null>(null);
  const [duelCooldowns, setDuelCooldowns] = useState<Set<string>>(new Set());
  const duelTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      duelTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const handleAddFriend = async () => {
    if (!friendUsername.trim() || !user) return;
    setSending(true);
    const result = await sendFriendRequest(user.uid, friendUsername.trim());
    if (result.error) showToast(result.error, 'error');
    else { showToast('Friend request sent!', 'success'); refresh(); }
    setFriendUsername('');
    setSending(false);
  };

  const handleAccept = async (id: string) => {
    try { await acceptFriendRequest(id); refresh(); }
    catch (err: any) { showToast(err.message || 'Failed to accept', 'error'); }
  };

  const handleReject = async (id: string) => {
    try { await rejectFriendRequest(id); refresh(); }
    catch (err: any) { showToast(err.message || 'Failed to reject', 'error'); }
  };

  const handleRemove = async (friendUid: string) => {
    try { await removeFriend(user!.uid, friendUid); refresh(); }
    catch (err: any) { showToast(err.message || 'Failed to remove friend', 'error'); }
  };

  const handleDuel = async (friendUid: string, friendUsername: string) => {
    if (duelCooldowns.has(friendUid)) return;
    setDuelLoading(friendUid);
    try {
      await sendDuelRequest(user!.uid, friendUid, friendUsername);
      showToast(`Duel request sent to ${friendUsername}!`, 'success');
      setDuelCooldowns(prev => new Set(prev).add(friendUid));
      const timer = setTimeout(() => {
        setDuelCooldowns(prev => {
          const next = new Set(prev);
          next.delete(friendUid);
          return next;
        });
        duelTimersRef.current.delete(friendUid);
      }, 30000);
      duelTimersRef.current.set(friendUid, timer);
    } catch (err) {
      showToast('Failed to send duel request', 'error');
    } finally {
      setDuelLoading(null);
    }
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 600 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">Friends</h1>

          <Card padding="1.5rem" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Input
                placeholder="Enter username..."
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                onKeyDown={(e: any) => e.key === 'Enter' && handleAddFriend()}
                style={{ flex: 1 }}
              />
              <Button variant="success" onClick={handleAddFriend} loading={sending}>
                Add Friend
              </Button>
            </div>
          </Card>

          {requests.length > 0 && (
            <Card padding="1.5rem" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>
                Friend Requests ({requests.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {requests.map((req) => (
                  <div key={req.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <button
                      onClick={() => navigate(`/player/${req.from}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <Avatar username={req.fromUsername} size={36} />
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{req.fromUsername}</span>
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" variant="success" onClick={() => handleAccept(req.id)}>Accept</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleReject(req.id)}>Decline</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card padding="1.5rem">
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>
              Friends ({friends.length})
            </h3>
            {friends.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                No friends yet. Add some!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {friends.map((friend) => (
                  <div key={friend.uid} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <button
                      onClick={() => navigate(`/player/${friend.uid}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        flex: 1,
                        textAlign: 'left',
                      }}
                    >
                      <Avatar username={friend.username} size={36} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary)' }}>{friend.username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {friend.online ? (
                            <span style={{ color: 'var(--color-success)' }}>● Online</span>
                          ) : (
                            `Last seen ${new Date(friend.lastSeen).toLocaleDateString()}`
                          )}
                        </div>
                      </div>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{friend.rating}</span>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => handleDuel(friend.uid, friend.username)}
                  loading={duelLoading === friend.uid}
                  disabled={duelCooldowns.has(friend.uid)}
                >
                  {duelCooldowns.has(friend.uid) ? 'Sent (30s)' : 'Duel'}
                </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleRemove(friend.uid)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}