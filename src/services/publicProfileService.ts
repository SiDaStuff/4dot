import { api } from './api';

export interface PublicProfile {
  uid: string;
  username: string;
  rating: number;
  ratingDeviation: number;
  volatility: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  online: boolean;
  lastSeen: number;
  banned: boolean;
  banReason: string | null;
  banUntil?: number;
  createdAt: number;
  isFriend?: boolean;
  friendRequestPending?: boolean;
}

export interface SearchResult {
  uid: string;
  username: string;
  rating: number;
}

export async function getPublicProfile(uid: string): Promise<PublicProfile> {
  return api.get(`/api/profile/public/${uid}`);
}

export async function searchUsers(query: string): Promise<SearchResult[]> {
  if (query.length < 2) return [];
  const data = await api.get(`/api/search-users?q=${encodeURIComponent(query)}`);
  return data.users || [];
}
