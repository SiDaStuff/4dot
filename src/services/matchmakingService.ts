import { api } from './api';

export async function joinQueue(uid: string, mode: 'casual' | 'rated') {
  return api.post('/api/matchmaking/join', { mode });
}

export async function leaveQueue(uid: string) {
  return api.post('/api/matchmaking/leave');
}

export async function getQueueSize(): Promise<number> {
  const data = await api.get('/api/matchmaking/queue-size');
  return data.size;
}

export async function checkMatch(uid: string, mode: 'casual' | 'rated'): Promise<{ matched: boolean; gameId?: string }> {
  return api.get('/api/matchmaking/check');
}

export async function createBotGame(strength: string): Promise<{ gameId: string }> {
  return api.post('/api/bot/game', { strength });
}
