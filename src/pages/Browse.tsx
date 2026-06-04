import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchUsers, type SearchResult } from '../services/publicProfileService';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';

export function Browse() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          const users = await searchUsers(query);
          setResults(users);
          setSearched(true);
        } catch (err) {
          setResults([]);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
        setSearched(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 600 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">Browse Players</h1>

          <Card padding="1.5rem" style={{ marginBottom: '1.5rem' }}>
            <Input
              placeholder="Search players..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </Card>

          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spinner size={24} />
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
              No players found
            </div>
          )}

          {results.length > 0 && (
            <div>
              {results.map((user) => (
                <Card
                  key={user.uid}
                  padding="1rem"
                  style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <button
                    onClick={() => navigate(`/player/${user.uid}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      background: 'none', border: 'none', cursor: 'pointer', flex: 1, textAlign: 'left',
                    }}
                  >
                    <Avatar username={user.username} size={36} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-dark)' }}>{user.username}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Rating: {user.rating}</div>
                    </div>
                  </button>
                </Card>
              ))}
            </div>
          )}

          {!searched && results.length === 0 && (
            <Card padding="2rem" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-muted)' }}>Start typing to search for players</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
