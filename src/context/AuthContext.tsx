import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
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
  const profileFetched = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChange(async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const [banRes, profileRes] = await Promise.allSettled([
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/ban-status`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            profileFetched.current ? Promise.resolve(undefined) : api.get('/api/profile'),
          ]);

          if (banRes.status === 'fulfilled' && banRes.value.ok) {
            const banData = await banRes.value.json();
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

          if (profileRes.status === 'fulfilled' && profileRes.value !== undefined) {
            profileFetched.current = true;
            if (!profileRes.value || !profileRes.value.username) {
              await api.post('/api/profile/create', {
                email: user.email,
                uid: user.uid,
                username: user.displayName || user.email?.split('@')[0] || 'Player',
              });
            }
          } else if (profileRes.status === 'rejected' && !profileFetched.current) {
            try {
              await api.post('/api/profile/create', {
                email: user.email,
                uid: user.uid,
                username: user.displayName || user.email?.split('@')[0] || 'Player',
              });
              profileFetched.current = true;
            } catch {}
          }
        } catch {}
      }
      setUser(user);
      setLoading(false);
      startTokenRefresh(user);
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