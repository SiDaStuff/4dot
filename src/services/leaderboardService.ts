import { api } from './api';

export interface LeaderboardEntry {
  uid: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

export async function getLeaderboardPage(lastUid?: string, lastRating?: number): Promise<{ entries: LeaderboardEntry[]; hasMore: boolean; lastUid: string | null; lastRating: number | null }> {
  const params = new URLSearchParams();
  if (lastUid) params.set('lastUid', lastUid);
  if (lastRating !== undefined) params.set('lastRating', lastRating.toString());
  return api.get(`/api/leaderboard?${params.toString()}`);
}