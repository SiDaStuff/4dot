import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    return () => {};
  }, [user]);
}