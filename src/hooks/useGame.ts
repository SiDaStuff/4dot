import { useState, useEffect, useCallback } from 'react';
import { listenToGame } from '../services/gameService';
import type { Game } from '../types';

export function useGame(gameId: string | undefined, guestUid?: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) {
      setGame(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = listenToGame(gameId, (g) => {
      setGame(g);
      setLoading(false);
    }, guestUid);

    return unsub;
  }, [gameId, guestUid]);

  const isMyTurn = useCallback((uid: string) => {
    if (!game || game.status !== 'active') return false;
    const myColor = game.blackPlayer.uid === uid ? 'black' : 'white';
    return game.currentTurn === myColor;
  }, [game]);

  return { game, loading, isMyTurn };
}