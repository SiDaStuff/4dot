import { useState, useEffect, useCallback, useRef } from 'react';
import { getLeaderboardPage, type LeaderboardEntry } from '../services/leaderboardService';

function uniqueByUid(entries: LeaderboardEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.uid)) return false;
    seen.add(entry.uid);
    return true;
  });
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastUid, setLastUid] = useState<string | null>(null);
  const [lastRating, setLastRating] = useState<number | null>(null);
  const initialLoadStarted = useRef(false);
  const loadingPage = useRef(false);

  const loadPage = useCallback(async (reset = false) => {
    if (loadingPage.current) return;
    loadingPage.current = true;
    setLoading(true);
    try {
      const result = await getLeaderboardPage(reset ? undefined : lastUid ?? undefined, reset ? undefined : lastRating ?? undefined);
      if (reset) {
        setEntries(uniqueByUid(result.entries));
        setLastUid(result.lastUid);
        setLastRating(result.lastRating);
      } else {
        setEntries((prev) => uniqueByUid([...prev, ...result.entries]));
        setLastUid(result.lastUid);
        setLastRating(result.lastRating);
      }
      setHasMore(result.hasMore);
    } catch {}
    loadingPage.current = false;
    setLoading(false);
  }, [lastUid, lastRating]);

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    loadPage(true);
  }, [loadPage]);

  return { entries, loading, hasMore, loadMore: () => loadPage(false), refresh: () => loadPage(true) };
}
