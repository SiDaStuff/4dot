import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { createAuthenticatedEventSource, api } from '../services/api';
import { showToast } from '../components/ui/Toast';
import { useNavigate } from 'react-router-dom';

let notifCounter = 0;
function uniqueId() {
  return `${Date.now()}-${++notifCounter}`;
}

export interface NotificationData {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: number;
  fromUid?: string;
  fromUsername?: string;
  amount?: number;
  gameId?: string;
  duelId?: string;
}

type SSEListener = (data: any) => void;

interface NotificationContextType {
  notifications: NotificationData[];
  unreadCount: number;
  addSSEListener: (type: string, listener: SSEListener) => void;
  removeSSEListener: (type: string, listener: SSEListener) => void;
  deleteNotification: (id: string) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  addSSEListener: () => {},
  removeSSEListener: () => {},
  deleteNotification: () => {},
  markAllRead: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const sseListenersRef = useRef<Map<string, Set<SSEListener>>>(new Map());
  const navigate = useNavigate();

  const addNotification = useCallback((notification: NotificationData) => {
    setNotifications(prev => [notification, ...prev].slice(0, 50));
  }, []);

  const addSSEListener = useCallback((type: string, listener: SSEListener) => {
    if (!sseListenersRef.current.has(type)) sseListenersRef.current.set(type, new Set());
    sseListenersRef.current.get(type)!.add(listener);
  }, []);

  const removeSSEListener = useCallback((type: string, listener: SSEListener) => {
    const listeners = sseListenersRef.current.get(type);
    if (listeners) listeners.delete(listener);
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try { await api.post(`/api/notifications/${id}/delete`); } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try { await api.post('/api/notifications/mark-read'); } catch {}
  }, []);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    api.get('/api/notifications').then((data: NotificationData[]) => {
      setNotifications(data);
    }).catch(() => {});
  }, [user]);

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    let active = true;
    let es: EventSource | null = null;

    createAuthenticatedEventSource().then((eventSource) => {
      if (!active) {
        eventSource.close();
        return;
      }
      es = eventSource;
      es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      const listeners = sseListenersRef.current.get(data.type);
      if (listeners) listeners.forEach(fn => { try { fn(data); } catch {} });

      if (data.type === 'friend_request_received') {
        addNotification({
          id: uniqueId(),
          type: 'friend_request',
          message: data.fromUsername ? `Friend request from ${data.fromUsername}` : 'New friend request',
          read: false,
          createdAt: Date.now(),
          fromUid: data.fromUid,
          fromUsername: data.fromUsername,
        });
      }
      if (data.type === 'banned') {
        addNotification({
          id: uniqueId(),
          type: 'banned',
          message: `You have been banned: ${data.reason}`,
          read: false,
          createdAt: Date.now(),
        });
        showToast(`Account suspended: ${data.reason}`, 'error');
        setTimeout(() => { window.location.replace('/login'); }, 2000);
      }
      if (data.type === 'rating_refund') {
        const amount = data.amount || 0;
        addNotification({
          id: uniqueId(),
          type: 'rating_refund',
          message: `Rating refund: +${amount}${data.reason ? ` (${data.reason})` : ''}`,
          read: false,
          createdAt: Date.now(),
          amount,
        });
        showToast(`Rating refunded: +${amount}`, 'success');
        api.get('/api/notifications').then((notifData: NotificationData[]) => {
          setNotifications(notifData);
        }).catch(() => {});
      }
      if (data.type === 'duel_request') {
        addNotification({
          id: uniqueId(),
          type: 'duel_request',
          message: data.message,
          read: false,
          createdAt: Date.now(),
          fromUid: data.fromUid,
          fromUsername: data.fromUsername,
          duelId: data.duelId,
        });
        showToast(`Duel request from ${data.fromUsername}!`, 'info');
      }
if (data.type === 'duel_accepted' && data.gameId) {
navigateRef.current(`/game/${data.gameId}`);
}
if (data.type === 'rematch_accepted' && data.gameId) {
navigateRef.current(`/game/${data.gameId}`);
}
      if (data.type === 'match_found' && data.gameId) {
        navigateRef.current(`/game/${data.gameId}`);
      }
      };
    }).catch(() => {});

    return () => {
      active = false;
      if (es) es.close();
    };
  }, [user, addNotification]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo(() => ({ notifications, unreadCount, addSSEListener, removeSSEListener, deleteNotification, markAllRead }), [notifications, unreadCount, addSSEListener, removeSSEListener, deleteNotification, markAllRead]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

export function useSSEListener(type: string, handler: SSEListener) {
  const { addSSEListener, removeSSEListener } = useNotifications();
  useEffect(() => {
    addSSEListener(type, handler);
    return () => removeSSEListener(type, handler);
  }, [type, handler, addSSEListener, removeSSEListener]);
}
