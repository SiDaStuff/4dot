import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { showToast } from '../components/ui/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let idToken: string | null = null;

export function setAuthToken(token: string | null) {
  idToken = token;
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const retrySec = retryAfter ? parseInt(retryAfter, 10) : 60;
    const data429 = await res.json().catch(() => ({}));
    const serverRetry = data429.retryAfter || retrySec;
    showToast('Slow down — rate limit reached', 'ratelimit', serverRetry);
    throw Object.assign(new Error(data429.error || 'Too many requests'), { isRateLimit: true, retryAfter: serverRetry });
  }

  if (res.status === 403) {
    let data: any = {};
    try { data = await res.json(); } catch {}
    setAuthToken(null);
    try { await signOut(auth); } catch {}
    const banReason = data.banReason || data.error || 'Account suspended';
    const permanent = data.permanent || false;
    const until = data.until || null;
  const params = new URLSearchParams({ banned: 'true', reason: banReason });
  if (permanent) params.set('permanent', 'true');
  if (until) params.set('until', String(until));
  window.location.replace(`/login?${params.toString()}`);
    throw new Error(banReason);
  }

  if (res.status === 401) {
    if (!idToken) {
      const data401 = await res.json().catch(() => ({}));
      throw new Error(data401.error || 'Authentication required');
    }
    try {
      if (auth.currentUser) {
        const freshToken = await auth.currentUser.getIdToken(true);
        setAuthToken(freshToken);
        const retryHeaders: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` };
        const retryRes = await fetch(`${API_URL}${path}`, { ...options, headers: retryHeaders });
        if (retryRes.ok) return retryRes.json();
      }
    } catch {}
    setAuthToken(null);
    try { await signOut(auth); } catch {}
    window.location.replace('/login');
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: any) => request(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};

export function createEventSource(guestUid?: string): EventSource {
  if (!idToken) {
    const uid = guestUid || 'anonymous';
    return new EventSource(`${API_URL}/api/guest/events?uid=${encodeURIComponent(uid)}`);
  }
  return new EventSource(`${API_URL}/api/events?token=${encodeURIComponent(idToken)}`);
}

export async function createAuthenticatedEventSource(guestUid?: string): Promise<EventSource> {
  if (guestUid) {
    return new EventSource(`${API_URL}/api/guest/events?uid=${encodeURIComponent(guestUid)}`);
  }

  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    setAuthToken(token);
    return new EventSource(`${API_URL}/api/events?token=${encodeURIComponent(token)}`);
  }

  return new EventSource(`${API_URL}/api/guest/events?uid=anonymous`);
}

export { API_URL };
