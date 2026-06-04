import { useState, useEffect, useCallback, useMemo } from 'react';
import { getFriendRequests, getFriends, type FriendRequest, type Friend } from '../services/friendService';
import { useAuth } from '../context/AuthContext';

export function useFriends() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    if (!user) { setRequests([]); setFriends([]); return; }

    const load = async () => {
      try {
        const [reqs, frs] = await Promise.all([getFriendRequests(), getFriends()]);
        setRequests(reqs);
        setFriends(frs);
      } catch {}
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const refresh = useCallback(() => {
    if (user) {
      getFriendRequests().then(setRequests).catch(() => {});
      getFriends().then(setFriends).catch(() => {});
    }
  }, [user]);

  return useMemo(() => ({ requests, friends, refresh }), [requests, friends, refresh]);
}