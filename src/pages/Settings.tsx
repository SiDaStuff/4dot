import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { showToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';

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

function Toggle({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12,
          background: checked ? 'var(--color-success)' : 'var(--color-border)',
          border: 'none', cursor: 'pointer',
          position: 'relative', transition: 'background var(--transition-fast)',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'white',
          position: 'absolute', top: 3,
          left: checked ? 23 : 3,
          transition: 'left var(--transition-fast)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

function SliderSetting({ label, description, value, min, max, step, onChange }: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{description}</div>
        </div>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-dark)' }}>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', marginTop: 8, accentColor: 'var(--color-success)' }}
      />
    </div>
  );
}

export function Settings() {
  const { user } = useAuth();
  const { settings, updateSetting, resetSettings } = useSettings();
  const [profile, setProfile] = useState<any>(null);
  const [newUsername, setNewUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [daysUntilChange, setDaysUntilChange] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.get('/api/profile').then((data) => {
      setProfile(data);
      const lastChange = data.lastUsernameChange || 0;
      const daysSince = (Date.now() - lastChange) / (1000 * 60 * 60 * 24);
      setDaysUntilChange(Math.max(0, Math.ceil(7 - daysSince)));
    }).catch(() => {});
  }, [user]);

  const handleUsernameChange = async () => {
    const validationError = validateUsername(newUsername.trim());
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }
    setUsernameLoading(true);
    const result = await api.put('/api/profile/username', { username: newUsername.trim() }).catch((err) => ({ error: err.message }));
    if (result.error) showToast(result.error, 'error');
    else {
      showToast('Username updated!', 'success');
      setNewUsername('');
      setDaysUntilChange(7);
    }
    setUsernameLoading(false);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setPasswordLoading(true);
    const result = await api.put('/api/profile/password', { newPassword }).catch((err) => ({ error: err.message }));
    if (result.error) showToast(result.error, 'error');
    else { showToast('Password updated!', 'success'); setNewPassword(''); setConfirmPassword(''); }
    setPasswordLoading(false);
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 600 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">Settings</h1>

          <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Account</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>EMAIL</label>
                <p style={{ color: 'var(--color-text)', fontWeight: 500 }}>{user?.email || 'Not signed in'}</p>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>USER ID</label>
                <p style={{ color: 'var(--color-text)', fontWeight: 500, fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                  {user?.uid || '—'}
                </p>
              </div>
            </div>
          </Card>

          <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Change Username</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              {daysUntilChange > 0
                ? `You can change your username again in ${daysUntilChange} day(s)`
                : 'You can change your username now.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Input
                placeholder="New username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button variant="success" onClick={handleUsernameChange} loading={usernameLoading} disabled={daysUntilChange > 0}>
                Update
              </Button>
            </div>
          </Card>

          <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Change Password</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <Button variant="dark" onClick={handlePasswordChange} loading={passwordLoading}>
                Update Password
              </Button>
            </div>
          </Card>

          <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Sound</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Toggle
                label="Sound Effects"
                description="Audio feedback for moves, game events"
                checked={settings.soundEnabled}
                onChange={(v) => updateSetting('soundEnabled', v)}
              />
              {settings.soundEnabled && (
                <SliderSetting
                  label="Volume"
                  description="Adjust sound effect volume"
                  value={settings.soundVolume}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => updateSetting('soundVolume', v)}
                />
              )}
            </div>
          </Card>

          <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Board & Game</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Toggle
                label="Move Animation"
                description="Smooth animation when pieces move"
                checked={settings.moveAnimationEnabled}
                onChange={(v) => updateSetting('moveAnimationEnabled', v)}
              />
              <Toggle
                label="Last Move Highlight"
                description="Highlight the last move's from/to cells"
                checked={settings.lastMoveHighlightEnabled}
                onChange={(v) => updateSetting('lastMoveHighlightEnabled', v)}
              />
              <Toggle
                label="Turn Pulse"
                description="Subtle visual pulse on the board when it's your turn"
                checked={settings.pulseOnTurnEnabled}
                onChange={(v) => updateSetting('pulseOnTurnEnabled', v)}
              />
              <Toggle
                label="Premove"
                description="Queue your next move while waiting for opponent"
                checked={settings.premoveEnabled}
                onChange={(v) => updateSetting('premoveEnabled', v)}
              />
              <Toggle
                label="Keyboard Shortcuts"
                description="F to flip board, Escape to cancel selection"
                checked={settings.keyboardShortcutsEnabled}
                onChange={(v) => updateSetting('keyboardShortcutsEnabled', v)}
              />
            </div>
          </Card>

          <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Dashboard</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Toggle
                label="Activity Feed"
                description="Show recent games and rating changes on dashboard"
                checked={settings.showActivityFeed}
                onChange={(v) => updateSetting('showActivityFeed', v)}
              />
            </div>
          </Card>

          <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Game Preferences</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Default Game Mode</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Casual or rated</div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <Button
                    variant={settings.defaultGameMode === 'rated' ? 'success' : 'secondary'}
                    size="sm"
                    onClick={() => updateSetting('defaultGameMode', 'rated')}
                  >
                    Rated
                  </Button>
                  <Button
                    variant={settings.defaultGameMode === 'casual' ? 'success' : 'secondary'}
                    size="sm"
                    onClick={() => updateSetting('defaultGameMode', 'casual')}
                  >
                    Casual
                  </Button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Time Control</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Per player</div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {[1, 3, 5, 10].map(min => (
                    <Button
                      key={min}
                      variant={settings.defaultTimeControl === min * 60000 ? 'success' : 'secondary'}
                      size="sm"
                      onClick={() => updateSetting('defaultTimeControl', min * 60000)}
                    >
                      {min}m
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {settings.blockedUsers.length > 0 && (
            <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Blocked Users ({settings.blockedUsers.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {settings.blockedUsers.map(uid => (
                  <div key={uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{uid}</span>
                    <Button variant="ghost" size="sm" onClick={() => updateSetting('blockedUsers', settings.blockedUsers.filter(u => u !== uid))}>
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {settings.mutedUsers.length > 0 && (
            <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>Muted Users ({settings.mutedUsers.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {settings.mutedUsers.map(uid => (
                  <div key={uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{uid}</span>
                    <Button variant="ghost" size="sm" onClick={() => updateSetting('mutedUsers', settings.mutedUsers.filter(u => u !== uid))}>
                      Unmute
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card padding="2rem" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.25rem' }}>Reset All Settings</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Restore default preferences</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => { resetSettings(); showToast('Settings reset to defaults', 'info'); }}>
                Reset
              </Button>
            </div>
          </Card>

          <Card padding="2rem">
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>About</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              4Dot v2.0.0
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              A strategic multiplayer piece game. Glicko-2 rated matchmaking.
            </p>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', verticalAlign: 'middle', marginRight: 2 }}>keyboard</span>
                F = Flip Board
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Esc = Cancel Selection
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
