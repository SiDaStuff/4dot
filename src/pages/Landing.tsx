import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function Landing() {
  return (
    <div className="page">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - var(--navbar-height) - 60px)',
        textAlign: 'center',
        padding: '2rem 1rem',
      }}>
        <div style={{ marginBottom: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="40" cy="40" r="14" fill="#4C956C"/>
            <circle cx="80" cy="40" r="14" fill="#FFC9B9"/>
            <circle cx="40" cy="80" r="14" fill="#FFC9B9"/>
            <circle cx="80" cy="80" r="14" fill="#2C6E49"/>
            <line x1="50" y1="44" x2="46" y2="68" stroke="#4C956C" strokeWidth="3" opacity="0.6"/>
            <line x1="70" y1="44" x2="74" y2="68" stroke="#2C6E49" strokeWidth="3" opacity="0.6"/>
            <line x1="48" y1="40" x2="72" y2="40" stroke="#FFC9B9" strokeWidth="3" opacity="0.6"/>
            <line x1="48" y1="80" x2="72" y2="80" stroke="#FFC9B9" strokeWidth="3" opacity="0.6"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: '4rem',
          fontWeight: 800,
          color: 'var(--color-dark)',
          letterSpacing: '-0.02em',
          marginBottom: '0.5rem',
          animation: 'fadeIn 0.6s ease-out',
        }}>
          <span style={{ color: 'var(--color-success)' }}>4Dot</span>
        </h1>

        <p style={{
          fontSize: '1.1rem',
          color: 'var(--color-text-secondary)',
          marginBottom: '0.25rem',
          animation: 'fadeIn 0.7s ease-out',
        }}>
          Strategic board game
        </p>

        <p style={{
          fontSize: '1.25rem',
          color: 'var(--color-text)',
          maxWidth: 500,
          marginBottom: '2.5rem',
          animation: 'fadeIn 0.8s ease-out',
          lineHeight: 1.7,
        }}>
          A strategic board game. Place your pieces, outmaneuver your opponent, and connect four to win.
        </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
          animation: 'fadeIn 0.9s ease-out',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <Link to="/register">
            <Button variant="success" size="lg">Get Started</Button>
          </Link>
          <Link to="/login">
            <Button variant="primary" size="lg">Sign In</Button>
          </Link>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.5rem',
          maxWidth: 800,
          width: '100%',
          marginTop: '4rem',
          animation: 'fadeIn 1s ease-out',
        }}>
          {[
            { title: 'Strategic Depth', desc: 'Two phases: placement then movement. Every move matters.' },
            { title: '6x6 Board', desc: 'Compact arena. 4 pieces each. 4-in-a-row to win.' },
            { title: 'Competitive', desc: 'Glicko-2 rating system. Climb the global leaderboards.' },
          ].map((item) => (
            <div key={item.title} style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              border: '1px solid var(--color-border)',
            }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 700 }}>
                {item.title}
              </h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
