import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { API_URL, setAuthToken } from './api';

export async function signUp(email: string, password: string, username: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const token = await credential.user.getIdToken();
  setAuthToken(token);
  await apiPost('/api/profile/create', { username, email, uid: credential.user.uid });
  return credential;
}

async function checkBanStatus(token: string): Promise<{ banned: boolean; reason?: string; permanent?: boolean; until?: number }> {
  try {
    const res = await fetch(`${API_URL}/api/ban-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}
  return { banned: false };
}

export async function login(email: string, password: string) {
  let credential;
  try {
    credential = await signInWithEmailAndPassword(auth, email, password);
  } catch (err: any) {
    if (err.code === 'auth/user-disabled') {
      const banRes = await fetch(`${API_URL}/api/ban-check/${encodeURIComponent(email)}`, { method: 'GET' });
      if (banRes.ok) {
        const banData = await banRes.json();
        if (banData.banned) {
          throw new Error(`BANNED:${banData.reason || 'Account suspended'}:${banData.permanent ? 'permanent' : 'temporary'}:${banData.until || ''}`);
        }
      }
      throw new Error('BANNED:Account suspended by administrator:permanent:');
    }
    throw err;
  }

  const token = await credential.user.getIdToken();
  setAuthToken(token);

  const banStatus = await checkBanStatus(token);
  if (banStatus.banned) {
    setAuthToken(null);
    await signOut(auth);
    const reason = banStatus.reason || 'Account suspended';
    throw new Error(`BANNED:${reason}:${banStatus.permanent ? 'permanent' : 'temporary'}:${banStatus.until || ''}`);
  }

  return credential;
}

export async function logout() {
  setAuthToken(null);
  return signOut(auth);
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const token = await user.getIdToken();
      setAuthToken(token);
    } else {
      setAuthToken(null);
    }
    callback(user);
  });
}

let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;
export function startTokenRefresh(user: User | null) {
  if (tokenRefreshInterval) clearInterval(tokenRefreshInterval);
  if (!user) return;
  tokenRefreshInterval = setInterval(async () => {
    try {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken(true);
        setAuthToken(token);
      }
    } catch {}
  }, 10 * 60 * 1000);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const token = await credential.user.getIdToken();
  setAuthToken(token);
  await apiPost('/api/profile/create', { email: credential.user.email, uid: credential.user.uid, username: credential.user.displayName || credential.user.email!.split('@')[0] });
  return credential;
}

async function apiPost(path: string, body: any) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}
