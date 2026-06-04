import React, { useEffect, useState } from 'react';

interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'ratelimit';
  retryAfter?: number;
}

let addToastFn: ((toast: Omit<ToastData, 'id'>) => void) | null = null;

export function showToast(message: string, type: ToastData['type'] = 'info', retryAfter?: number) {
  addToastFn?.({ message, type, retryAfter });
}

let toastCounter = 0;

function RateLimitToast({ message, retryAfter }: { message: string; retryAfter: number }) {
  const [remaining, setRemaining] = useState(retryAfter);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining, retryAfter]);

  const formatCountdown = (sec: number) => {
    if (sec <= 0) return 'Ready!';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>hourglass_top</span>
        </span>
        {message}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, (remaining / retryAfter) * 100)}%`, height: '100%', borderRadius: 2, background: remaining <= 0 ? '#4C956C' : 'rgba(255,255,255,0.7)', transition: 'width 1s linear' }} />
        </div>
        <span style={{ fontSize: '0.75rem', opacity: 0.9, minWidth: 40, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCountdown(remaining)}</span>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    addToastFn = (toast) => {
      const id = `${Date.now()}-${++toastCounter}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      const duration = toast.type === 'ratelimit' ? (toast.retryAfter || 60) * 1000 + 2000 : 3000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    };
    return () => { addToastFn = null; };
  }, []);

  const iconMap = { success: 'check', error: 'close', info: 'info', ratelimit: 'hourglass_top' };
  const bgMap = { success: 'var(--color-success)', error: 'var(--color-danger)', info: 'var(--color-dark)', ratelimit: '#B45309' };

  return (
    <div style={{
      position: 'fixed', top: 80, right: 16, zIndex: 2000,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: bgMap[toast.type],
            color: 'white',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 200ms ease-out',
            maxWidth: 400,
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          {toast.type === 'ratelimit' ? (
            <RateLimitToast message={toast.message} retryAfter={toast.retryAfter || 60} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>{iconMap[toast.type]}</span>
              </span>
              {toast.message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}