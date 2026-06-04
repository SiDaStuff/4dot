import { useState, useEffect, useCallback, useRef } from 'react';
import { joinQueue, leaveQueue, getQueueSize } from '../services/matchmakingService';
import { useAuth } from '../context/AuthContext';

export function useMatchmaking() {
  const { user } = useAuth();
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<'casual' | 'rated'>('rated');
  const [queueSize, setQueueSize] = useState(0);
  const sizeIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const pollSize = async () => {
      try { setQueueSize(await getQueueSize()); } catch {}
    };
    pollSize();
    sizeIntervalRef.current = window.setInterval(pollSize, 5000);
    return () => { if (sizeIntervalRef.current) clearInterval(sizeIntervalRef.current); };
  }, []);

  const startSearch = useCallback(async (gameMode: 'casual' | 'rated') => {
    if (!user) return;
    setMode(gameMode);
    setSearching(true);
    await joinQueue(user.uid, gameMode);
  }, [user]);

  const cancelSearch = useCallback(async () => {
    if (!user) return;
    setSearching(false);
    await leaveQueue(user.uid);
  }, [user]);

  useEffect(() => {
    return () => {
      if (searching && user) {
        leaveQueue(user.uid);
      }
    };
  }, [searching, user]);

  return { searching, queueSize, startSearch, cancelSearch };
}
