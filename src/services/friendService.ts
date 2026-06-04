import { api } from './api';

export interface FriendRequest {
  id: string;
  from: string;
  fromUsername: string;
  to: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export interface Friend {
  uid: string;
  username: string;
  online: boolean;
  lastSeen: number;
  rating: number;
}

export async function getFriends(): Promise<Friend[]> {
  return api.get('/api/friends');
}

export async function getFriendRequests(): Promise<FriendRequest[]> {
  return api.get('/api/friends/requests');
}

export async function sendFriendRequest(fromUid: string, toUsername: string): Promise<{ error?: string }> {
  try {
    await api.post('/api/friends/request', { toUsername });
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function acceptFriendRequest(requestId: string) {
  return api.post('/api/friends/accept', { requestId });
}

export async function rejectFriendRequest(requestId: string) {
  return api.post('/api/friends/reject', { requestId });
}

export async function removeFriend(uid: string, friendUid: string) {
  return api.post('/api/friends/remove', { friendUid });
}

export async function sendDuelRequest(fromUid: string, toUid: string, toUsername: string): Promise<{ error?: string }> {
  try {
    await api.post('/api/friends/duel-request', { toUid });
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}