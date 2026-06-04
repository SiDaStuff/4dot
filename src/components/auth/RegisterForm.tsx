import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '../../services/authService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { showToast } from '../ui/Toast';

const BANNED_WORDS = [
  'fuck','shit','ass','bitch','bastard','cunt','dick','piss','whore','slut',
  'nigger','nigga','faggot','retard','damn','hell','cock','pussy','twat',
  'wanker','bollocks','arse','shag','crap','dickhead','motherfucker',
  'goddamn','jesus','christ','nazi','racist','homo','tranny','kill',
  'suicide','rape','molest','pedophile','pedo','sexist','bigot',
];

function validateUsername(username: string): string | null {
  if (!username || username.length < 2) return 'Username must be at least 2 characters';
  if (username.length > 20) return 'Username must be at most 20 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
  const lower = username.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) return 'Username contains inappropriate language';
  }
  return null;
}

export function RegisterForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const usernameError = validateUsername(username);
    if (usernameError) { setError(usernameError); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    try {
      await signUp(email, password, username);
      showToast('Account created!', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card padding="2rem" style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: 'var(--color-dark)', fontSize: '1.5rem' }}>Create Account</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Join 4Dot</p>
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 'var(--radius-md)', padding: '10px 14px',
          marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: -8 }}>Letters, numbers, and underscores only</div>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        <Button type="submit" variant="success" fullWidth loading={loading}>Create Account</Button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--color-dark)', fontWeight: 600 }}>Sign in</Link>
      </p>
    </Card>
  );
}
