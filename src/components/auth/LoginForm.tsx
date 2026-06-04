import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { login, signInWithGoogle } from '../../services/authService';
import { sendPasswordResetEmail, getAuth } from 'firebase/auth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { showToast } from '../ui/Toast';

const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password. Please try again or reset your password.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again or reset your password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many failed attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/invalid-login-credentials': 'Incorrect email or password. Please try again or reset your password.',
};

function friendlyError(code: string, fallback: string): string {
  return FRIENDLY_AUTH_ERRORS[code] || fallback;
}

export function LoginForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [banInfo, setBanInfo] = useState<{ reason: string; permanent: boolean; until: number } | null>(null);
  const [countdown, setCountdown] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const banned = searchParams.get('banned');
    const reason = searchParams.get('reason');
    const permanent = searchParams.get('permanent');
    const until = searchParams.get('until');
    if (banned === 'true' && reason) {
      setBanInfo({ reason, permanent: permanent === 'true', until: until ? Number(until) : 0 });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!banInfo || banInfo.permanent || !banInfo.until) return;
    const update = () => {
      const remaining = banInfo.until - Date.now();
      if (remaining <= 0) { setCountdown('Ban has expired - you may try signing in again'); return; }
      const hours = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      const h = hours > 0 ? `${hours}h ` : '';
      setCountdown(`${h}${mins}m ${secs}s remaining`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [banInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setBanInfo(null);
    try {
      await login(email, password);
      showToast('Welcome back!', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.message || 'Failed to login';
      if (msg.startsWith('BANNED:')) {
        const parts = msg.split(':');
        setBanInfo({ reason: parts[1] || 'Account suspended', permanent: (parts[2] || 'temporary') === 'permanent', until: parts[3] ? Number(parts[3]) : 0 });
      } else {
        setError(friendlyError(err.code || '', msg));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Enter your email to reset password'); return; }
    setResetLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(getAuth(), email);
      setResetSent(true);
      showToast('Password reset email sent!', 'success');
    } catch (err: any) {
      setError(friendlyError(err.code || '', err.message || 'Failed to send reset email'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      showToast('Signed in with Google!', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      setError(friendlyError(err.code || '', err.message || 'Google sign-in failed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  if (resetSent) {
    return (
      <Card padding="2rem" style={{ maxWidth: 420, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--color-success)', display: 'block', marginBottom: '0.5rem' }}>mark_email_read</span>
          <h2 style={{ color: 'var(--color-dark)', fontSize: '1.5rem' }}>Check Your Email</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Password reset instructions sent to <strong>{email}</strong>
          </p>
        </div>
        <Button variant="primary" fullWidth onClick={() => { setResetMode(false); setResetSent(false); }}>Back to Sign In</Button>
      </Card>
    );
  }

  return (
    <Card padding="2rem" style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: 'var(--color-dark)', fontSize: '1.5rem' }}>{resetMode ? 'Reset Password' : 'Welcome Back'}</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          {resetMode ? 'Enter your email to receive a reset link' : 'Sign in to play 4Dot'}
        </p>
      </div>

      {banInfo && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{banInfo.permanent ? 'Account Permanently Banned' : 'Account Suspended'}</div>
          <div>Reason: {banInfo.reason}</div>
          {!banInfo.permanent && countdown && <div style={{ marginTop: 6, fontWeight: 600, fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>{countdown}</div>}
        </div>
      )}

      {error && !banInfo && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</div>
      )}

      {resetMode ? (
        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" variant="success" fullWidth loading={resetLoading}>Send Reset Link</Button>
          <button type="button" onClick={() => { setResetMode(false); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--color-dark)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: 4 }}>Back to Sign In</button>
        </form>
      ) : (
        <>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" variant="success" fullWidth loading={loading}>Sign In</Button>
          </form>

          <button type="button" onClick={() => { setResetMode(true); setError(''); }} style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'center', padding: '8px 0', marginTop: '0.25rem' }}>Forgot password?</button>

          <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          <Button variant="secondary" fullWidth loading={googleLoading} onClick={handleGoogle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--color-dark)', fontWeight: 600 }}>Sign up</Link>
          </p>
        </>
      )}
    </Card>
  );
}
