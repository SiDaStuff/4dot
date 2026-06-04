import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { api } from '../../services/api';

export function NotificationPopup({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, deleteNotification, markAllRead } = useNotifications();
  const [acceptingDuel, setAcceptingDuel] = useState<string | null>(null);

  const hasMarkedRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      if (!hasMarkedRef.current) {
        markAllRead();
        hasMarkedRef.current = true;
      }
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    } else {
      hasMarkedRef.current = false;
    }
  }, [isOpen, onClose]);

  const handleAcceptDuel = async (fromUid: string, duelId?: string) => {
    if (!user) return;
    setAcceptingDuel(fromUid);
    try {
      const payload: any = { opponentUid: fromUid };
      if (duelId) payload.duelId = duelId;
      const data = await api.post('/api/game/create-duel', payload);
      if (data.gameId) {
        navigate(`/game/${data.gameId}`);
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to accept duel:', err);
    } finally {
      setAcceptingDuel(null);
    }
  };

  const handleViewProfile = (uid: string) => {
    navigate(`/player/${uid}`);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    deleteNotification(notifId);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      style={{
        position: 'absolute',
        top: 44,
        right: 0,
        background: 'var(--color-white)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        minWidth: 320,
        maxWidth: 400,
        maxHeight: 400,
        overflowY: 'auto',
        zIndex: 200,
      }}
    >
      {notifications.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
          }}
        >
          No notifications
        </div>
      ) : (
        <div>
          {notifications.map((notification, idx) => (
            <div
              key={notification.id}
              style={{
                padding: '0.75rem 1rem',
                borderBottom:
                  idx < notifications.length - 1
                    ? '1px solid var(--color-border-light)'
                    : 'none',
                background: notification.read
                  ? 'transparent'
                  : 'var(--color-bg-secondary)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: notification.read
                      ? 'transparent'
                      : 'var(--color-primary)',
                    marginTop: '0.35rem',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--color-dark)',
                      fontWeight: notification.read ? 500 : 600,
                      wordBreak: 'break-word',
                    }}
                  >
                    {notification.type === 'friend_request'
                      ? 'Friend Request'
                      : notification.type === 'banned'
                      ? 'Account Suspended'
                      : notification.type === 'rating_refund'
                      ? 'Rating Refund'
                      : notification.type === 'duel_request'
                      ? 'Duel Request'
                      : 'Notification'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-secondary)',
                      marginTop: '0.25rem',
                      wordBreak: 'break-word',
                    }}
                  >
                    {notification.type === 'duel_request' && notification.fromUsername ? (
                      <button
                        onClick={() => handleViewProfile(notification.fromUid!)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: 0,
                          fontSize: 'inherit',
                          textDecoration: 'underline',
                        }}
                      >
                        {notification.fromUsername}
                      </button>
                    ) : null}
                    {' '}{notification.message}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      marginTop: '0.5rem',
                    }}
                  >
                    {new Date(notification.createdAt).toLocaleTimeString(
                      [],
                      { hour: '2-digit', minute: '2-digit' }
                    )}
                  </div>
                  {notification.type === 'duel_request' && notification.fromUid && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  onClick={() => handleAcceptDuel(notification.fromUid!, notification.duelId)}
                  disabled={acceptingDuel === notification.fromUid}
                        style={{
                          flex: 1,
                          padding: '0.4rem 0.8rem',
                          background: 'var(--color-success)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: acceptingDuel === notification.fromUid ? 'wait' : 'pointer',
                          opacity: acceptingDuel === notification.fromUid ? 0.6 : 1,
                        }}
                      >
                        {acceptingDuel === notification.fromUid ? 'Starting...' : 'Accept Duel'}
                      </button>
                      <button
                        onClick={onClose}
                        style={{
                          flex: 1,
                          padding: '0.4rem 0.8rem',
                          background: 'var(--color-bg-secondary)',
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(e, notification.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    padding: 2,
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                  title="Delete notification"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
