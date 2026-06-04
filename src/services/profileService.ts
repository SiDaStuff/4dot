import { api } from './api';

export async function getProfile(uid: string) {
  return api.get('/api/profile');
}

export async function updateUsername(uid: string, username: string): Promise<{ error?: string; success?: boolean }> {
  try {
    await api.put('/api/profile/username', { username });
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updatePassword(newPassword: string): Promise<{ error?: string; success?: boolean }> {
  try {
    await api.put('/api/profile/password', { newPassword });
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}