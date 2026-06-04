import { useState, useEffect } from 'react';

export function LoadingScreen() {
  const [visible, setVisible] = useState(true);
  const [piecesHidden, setPiecesHidden] = useState([false, false, false, false]);

  useEffect(() => {
    const timers = [200, 450, 700, 950].map((delay, i) =>
      setTimeout(() => setPiecesHidden(prev => { const n = [...prev]; n[i] = true; return n; }), delay)
    );
    const hide = setTimeout(() => setVisible(false), 1500);
    return () => { timers.forEach(clearTimeout); clearTimeout(hide); };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)',
      animation: 'fadeIn 200ms ease-out',
    }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r="50"
          fill="none" stroke="var(--color-border)"
          strokeWidth="2"
        />
        <circle
          cx="60" cy="60" r="50"
          fill="none" stroke="var(--color-success)"
          strokeWidth="3"
          strokeDasharray="314"
          strokeDashoffset="314"
          strokeLinecap="round"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
            animation: 'loadingCircle 1.4s ease-in-out forwards',
          }}
        />
        <circle cx="40" cy="40" r="8" fill="var(--color-dark)" style={{ transition: 'opacity 0.3s', opacity: piecesHidden[0] ? 0 : 1 }} />
        <circle cx="80" cy="40" r="8" fill="var(--color-primary)" style={{ transition: 'opacity 0.3s', opacity: piecesHidden[1] ? 0 : 1 }} />
        <circle cx="40" cy="80" r="8" fill="var(--color-primary)" style={{ transition: 'opacity 0.3s', opacity: piecesHidden[2] ? 0 : 1 }} />
        <circle cx="80" cy="80" r="8" fill="var(--color-success)" style={{ transition: 'opacity 0.3s', opacity: piecesHidden[3] ? 0 : 1 }} />
        <line x1="46" y1="42" x2="46" y2="74" stroke="var(--color-dark)" strokeWidth="2" opacity="0.5" style={{ transition: 'opacity 0.3s', opacity: (piecesHidden[0] || piecesHidden[2]) ? 0 : 0.5 }} />
        <line x1="74" y1="42" x2="74" y2="74" stroke="var(--color-success)" strokeWidth="2" opacity="0.5" style={{ transition: 'opacity 0.3s', opacity: (piecesHidden[1] || piecesHidden[3]) ? 0 : 0.5 }} />
        <line x1="48" y1="40" x2="72" y2="40" stroke="var(--color-primary)" strokeWidth="2" opacity="0.5" style={{ transition: 'opacity 0.3s', opacity: (piecesHidden[0] || piecesHidden[1]) ? 0 : 0.5 }} />
        <line x1="48" y1="80" x2="72" y2="80" stroke="var(--color-primary)" strokeWidth="2" opacity="0.5" style={{ transition: 'opacity 0.3s', opacity: (piecesHidden[2] || piecesHidden[3]) ? 0 : 0.5 }} />
      </svg>
      <style>{`
        @keyframes loadingCircle {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
