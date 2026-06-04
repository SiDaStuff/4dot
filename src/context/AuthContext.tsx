import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChange, startTokenRefresh } from '../services/authService';
import { api, setAuthToken } from '../services/api';
import { signOut, getAuth } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChange(async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const banRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/ban-status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (banRes.ok) {
            const banData = await banRes.json();
            if (banData.banned) {
              setAuthToken(null);
              try { await signOut(getAuth()); } catch {}
              const params = new URLSearchParams({ banned: 'true', reason: banData.reason || 'Account suspended' });
              if (banData.permanent) params.set('permanent', 'true');
              if (banData.until) params.set('until', String(banData.until));
              window.location.replace(`/login?${params.toString()}`);
              setUser(null);
              setLoading(false);
              return;
            }
          }
        } catch {}
      }
      setUser(user);
      setLoading(false);
      startTokenRefresh(user);
      if (user) {
        try {
          const profile = await api.get('/api/profile');
          if (!profile || !profile.username) {
            await api.post('/api/profile/create', {
              email: user.email,
              uid: user.uid,
              username: user.displayName || user.email?.split('@')[0] || 'Player',
            });
          }
        } catch {
          try {
            await api.post('/api/profile/create', {
              email: user.email,
              uid: user.uid,
              username: user.displayName || user.email?.split('@')[0] || 'Player',
            });
          } catch {}
        }
      }
    });
    return unsub;
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}