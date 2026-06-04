import { api } from './api';

export async function sendNotification(uid: string, type: string, message: string, data?: Record<string, string>) {
  // Notifications are sent server-side via SSE
}

export function listenToPresence(uid: string, callback: (online: boolean) => void) {
  // Presence handled by server
  return () => {};
}

export function setOnlineStatus(uid: string, online: boolean) {
  // Presence handled by server
}