import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 600 }}>
        <div style={{
          animation: 'fadeIn 300ms ease-out',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 120px)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '5rem',
            fontWeight: 700,
            color: 'var(--color-primary)',
            marginBottom: '1rem',
          }}>
            404
          </div>

          <h1 style={{
            color: 'var(--color-dark)',
            fontSize: '2rem',
            marginBottom: '0.5rem',
          }}>
            Page Not Found
          </h1>

          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: '1.1rem',
            marginBottom: '2rem',
            maxWidth: 400,
          }}>
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button
              variant="primary"
              onClick={() => navigate('/')}
            >
              Go Home
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
            >
              Go Back
            </Button>
          </div>

          <Card
            padding="2rem"
            style={{
              marginTop: '3rem',
              background: 'var(--color-bg-secondary)',
              textAlign: 'left',
              maxWidth: 400,
            }}
          >
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>
              Where to go from here?
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <li>
                <button
                  onClick={() => navigate('/play')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.95rem',
                  }}
                >
                  → Play a game
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/leaderboards')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.95rem',
                  }}
                >
                  → View rankings
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/browse')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.95rem',
                  }}
                >
                  → Browse players
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/friends')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.95rem',
                  }}
                >
                  → Check friends
                </button>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
