import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { getWinLine } from '../utils/boardUtils';
import type { Game, CellOwner, Position } from '../types';

export function useLocalBotGame(gameId: string | undefined) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [moveLoading, setMoveLoading] = useState(false);
  const pollRef = useRef<number | null>(null);
  const botPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gameId) { setGame(null); setLoading(false); return; }
    setLoading(true);

    const fetchGame = async () => {
      try {
        const data = await api.get(`/api/bot/game/${gameId}`);
        setGame(data);
        setLoading(false);
        if (data.status === 'active' && data.currentTurn === 'black') {
          botPollRef.current = setTimeout(fetchGame, 800);
        }
      } catch {
        setLoading(false);
      }
    };

    fetchGame();
    pollRef.current = window.setInterval(async () => {
      if (!gameId) return;
      try {
        const data = await api.get(`/api/bot/game/${gameId}`);
        setGame(data);
      } catch {}
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (botPollRef.current) clearTimeout(botPollRef.current);
    };
  }, [gameId]);

  const makeBotMove = useCallback(async (from: Position | undefined, to: Position) => {
    if (!gameId || moveLoading) return { error: 'Loading' };
    setMoveLoading(true);
    try {
      const data = await api.post(`/api/bot/game/${gameId}/move`, { from, to });
      if (data.game) setGame(data.game);
      return data;
    } catch (err: any) {
      return { error: err.message };
    } finally {
      setMoveLoading(false);
    }
  }, [gameId, moveLoading]);

  const resignBotGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await api.post(`/api/bot/game/${gameId}/resign`);
      if (data.game) setGame(data.game);
    } catch {}
  }, [gameId]);

  const winLine = game?.status === 'finished' && game.result && game.result.winner !== 'draw'
    ? getWinLine(game.board, game.result.winner as CellOwner) : null;

  return { game, loading, moveLoading, makeBotMove, resignBotGame, winLine };
}
