import { api, createEventSource } from './api';
import type { Game } from '../types';

const BOARD_SIZE = 6;

function normalizeArrays(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeArrays);
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
      const maxIdx = Math.max(...keys.map(Number));
      if (maxIdx < keys.length * 2) {
        const arr: any[] = new Array(maxIdx + 1);
        for (let i = 0; i <= maxIdx; i++) arr[i] = normalizeArrays(obj[String(i)]);
        return arr;
      }
    }
    const result: Record<string, any> = {};
    for (const k of keys) result[k] = normalizeArrays(obj[k]);
    return result;
  }
  return obj;
}

function decodeBoard(board: any): any {
  if (!board || !Array.isArray(board)) return board;
  return board.map((row: any) => {
    if (!Array.isArray(row)) return row;
    return row.map((cell: any) => cell === 0 ? null : cell);
  });
}

function isValidBoard(board: any): boolean {
  return Array.isArray(board)
    && board.length === BOARD_SIZE
    && board.every((row) => Array.isArray(row) && row.length === BOARD_SIZE);
}

function normalizeGame(game: any): Game | null {
  if (!game) return game;
  const normalized = normalizeArrays(game);
  if (normalized.board) normalized.board = decodeBoard(normalized.board);
  if (!isValidBoard(normalized.board)) return null;
  return normalized;
}

export async function makeMove(
  gameId: string,
  uid: string,
  from?: { row: number; col: number },
  to?: { row: number; col: number },
  guestUid?: string
): Promise<{ error?: string; gameOver?: boolean; result?: any; botMoved?: boolean; move?: any }> {
  try {
    const path = guestUid ? `/api/game/${gameId}/move?guestUid=${encodeURIComponent(guestUid)}` : `/api/game/${gameId}/move`;
    const data = await api.post(path, { from, to });
    return data;
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function resignGame(gameId: string, uid: string, guestUid?: string): Promise<{ error?: string }> {
  try {
    const path = guestUid ? `/api/game/${gameId}/resign?guestUid=${encodeURIComponent(guestUid)}` : `/api/game/${gameId}/resign`;
    await api.post(path);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function offerDraw(gameId: string): Promise<{ error?: string }> {
  try {
    await api.post(`/api/game/${gameId}/draw-offer`);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function acceptDraw(gameId: string): Promise<{ error?: string }> {
  try {
    await api.post(`/api/game/${gameId}/draw-accept`);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function rejectDraw(gameId: string): Promise<{ error?: string }> {
  try {
    await api.post(`/api/game/${gameId}/draw-reject`);
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function requestRematch(gameId: string): Promise<{ error?: string; gameId?: string }> {
  try {
    const data = await api.post(`/api/game/${gameId}/rematch`);
    return data;
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function getGame(gameId: string): Promise<Game | null> {
  try {
    const data = await api.get(`/api/game/${gameId}`);
    return normalizeGame(data);
  } catch {
    return null;
  }
}

export async function getActiveGames(): Promise<any[]> {
  return api.get('/api/active-games');
}

export async function createBotGame(strength: string): Promise<{ gameId: string }> {
  return api.post('/api/bot/game', { strength });
}

export async function getGameHistory(lastKey?: string, limit: number = 20): Promise<{ games: any[]; hasMore: boolean }> {
  try {
    const params = new URLSearchParams();
    if (lastKey) params.set('lastKey', lastKey);
    params.set('limit', limit.toString());
    return await api.get(`/api/game-history?${params.toString()}`);
  } catch {
    return { games: [], hasMore: false };
  }
}

export async function getOpponentStats(opponentUid: string): Promise<{ wins: number; losses: number; draws: number }> {
  try {
    return await api.get(`/api/opponent-stats/${opponentUid}`);
  } catch {
    return { wins: 0, losses: 0, draws: 0 };
  }
}

export async function getRatingHistory(): Promise<{ timestamp: number; rating: number }[]> {
  try {
    return await api.get('/api/rating-history');
  } catch {
    return [];
  }
}

export async function getActivityFeed(): Promise<any[]> {
  try {
    return await api.get('/api/activity-feed');
  } catch {
    return [];
  }
}

export function listenToGame(gameId: string, callback: (game: Game | null) => void, guestUid?: string): () => void {
  let active = true;
  let eventSource: EventSource | null = null;
  let pollTimer: number | null = null;
  let currentGame: Game | null = null;
  let pollingActive = false;
  let finishedGame: Game | null = null;

  const fetchGame = async () => {
    if (!active) return;
    try {
      const game = await getGame(gameId);
      if (!active) return;
      if (game && game.status === 'finished') finishedGame = game;
      else if (!game && finishedGame) {
        callback(finishedGame);
        return;
      }
      currentGame = game;
      callback(game);
    } catch {
      if (finishedGame) { callback(finishedGame); return; }
      if (active) callback(null);
    }
  };

  const startPolling = () => {
    if (pollingActive) return;
    pollingActive = true;
    pollTimer = window.setInterval(fetchGame, 3000);
  };

  const stopPolling = () => {
    if (pollTimer !== null) { window.clearInterval(pollTimer); pollTimer = null; }
    pollingActive = false;
  };

  fetchGame();

  try {
    eventSource = createEventSource(guestUid);

    eventSource.onmessage = (event) => {
      if (!active) return;
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'clock_tick' && data.gameId === gameId && currentGame) {
          currentGame = {
            ...currentGame,
            clock: data.clock,
          };
          callback(currentGame);
          return;
        }

        if (data.type === 'move_made' && data.gameId === gameId) {
          fetchGame();
          return;
        }

        if (data.type === 'game_over' && data.gameId === gameId) {
          fetchGame();
          stopPolling();
          return;
        }

        if (data.type === 'match_found' && data.gameId === gameId) {
          fetchGame();
          return;
        }

        if (data.type === 'draw_offered' && data.gameId === gameId) {
          if (currentGame) {
            currentGame = { ...currentGame, drawOfferFrom: data.fromUid } as any;
            callback(currentGame);
          }
          return;
        }

        if (data.type === 'connected') return;

        if (data.gameId === gameId) fetchGame();
      } catch {
        fetchGame();
      }
    };

    eventSource.onerror = () => {
      eventSource?.close();
      eventSource = null;
      startPolling();
    };
  } catch {
    startPolling();
  }

  return () => {
    active = false;
    eventSource?.close();
    stopPolling();
  };
}
