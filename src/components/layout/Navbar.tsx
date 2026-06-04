import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { logout } from '../../services/authService';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { NotificationPopup } from '../ui/NotificationPopup';
import { showToast } from '../ui/Toast';
import { useState, useRef, useEffect } from 'react';

export function Navbar() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationPopupOpen, setNotificationPopupOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    showToast('Signed out', 'info');
    navigate('/');
    setMobileMenuOpen(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
      setMobileMenuOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setMenuOpen(false);
      setNotificationPopupOpen(false);
    }
  }, [mobileMenuOpen]);

  const navLinks = user ? (
    <>
      <Link to="/play" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', textDecoration: 'none', padding: '8px 0' }}>
        Play
      </Link>
      <Link to="/leaderboards" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', textDecoration: 'none', padding: '8px 0' }}>
        Rankings
      </Link>
      <Link to="/spectate" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', textDecoration: 'none', padding: '8px 0' }}>
        Watch
      </Link>
        <Link to="/friends" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', textDecoration: 'none', padding: '8px 0' }}>
          Friends
        </Link>
        <Link to="/game-history" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', textDecoration: 'none', padding: '8px 0' }}>
          History
        </Link>
      </>
    ) : null;

  return (
    <nav style={{
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-white)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="container" style={{
        height: 'var(--navbar-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link to={user ? '/dashboard' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <svg width="32" height="32" viewBox="0 0 32 32">
            <circle cx="10" cy="10" r="4" fill="#4C956C"/>
            <circle cx="22" cy="10" r="4" fill="#FFC9B9"/>
            <circle cx="10" cy="22" r="4" fill="#FFC9B9"/>
            <circle cx="22" cy="22" r="4" fill="#2C6E49"/>
            <line x1="12" y1="13" x2="11" y2="19" stroke="#4C956C" strokeWidth="1.5" opacity="0.6"/>
            <line x1="20" y1="13" x2="21" y2="19" stroke="#2C6E49" strokeWidth="1.5" opacity="0.6"/>
            <line x1="13" y1="10" x2="19" y2="10" stroke="#FFC9B9" strokeWidth="1.5" opacity="0.6"/>
            <line x1="13" y1="22" x2="19" y2="22" stroke="#FFC9B9" strokeWidth="1.5" opacity="0.6"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-dark)' }}>
            4Dot
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {navLinks}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user && (
            <>
              {/* Search button */}
              <div ref={searchRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setSearchOpen(!searchOpen)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', padding: 4,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)' }}>
                    search
                  </span>
                </button>
                {searchOpen && (
                  <form onSubmit={handleSearch} style={{
                    position: 'absolute', right: 0, top: 44,
                    background: 'var(--color-white)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                    padding: 8, display: 'flex', gap: 8, zIndex: 200,
                  }}>
                    <input
                      autoFocus
                      placeholder="Search players..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                        padding: '6px 10px', fontSize: '0.85rem', width: 200, outline: 'none',
                      }}
                    />
                    <Button variant="success" size="sm" type="submit">Go</Button>
                  </form>
                )}
              </div>

              {/* Play button (desktop) */}
              <Link to="/play" className="desktop-nav" style={{ textDecoration: 'none' }}>
                <Button variant="success" size="sm">Play</Button>
              </Link>

              {/* Notifications */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setNotificationPopupOpen(!notificationPopupOpen)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    position: 'relative', display: 'flex', alignItems: 'center',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)' }}>
                    notifications
                  </span>
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -6, right: -6,
                      background: 'var(--color-danger)', color: 'white',
                      fontSize: '0.65rem', fontWeight: 700,
                      width: 18, height: 18, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>
                <NotificationPopup
                  isOpen={notificationPopupOpen}
                  onClose={() => setNotificationPopupOpen(false)}
                />
              </div>

              {/* Profile dropdown (desktop) */}
              <div className="desktop-nav" style={{ position: 'relative' }}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <Avatar username={user.email || 'U'} size={36} />
                </button>
                {menuOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: 44,
                    background: 'var(--color-white)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                    minWidth: 180, zIndex: 200,
                  }}>
        <Link to="/profile" style={{
          display: 'block', padding: '10px 16px',
          color: 'var(--color-text)', textDecoration: 'none', fontSize: '0.875rem',
          borderBottom: '1px solid var(--color-border)',
        }} onClick={() => setMenuOpen(false)}>Profile</Link>
        <Link to="/game-history" style={{
          display: 'block', padding: '10px 16px',
          color: 'var(--color-text)', textDecoration: 'none', fontSize: '0.875rem',
          borderBottom: '1px solid var(--color-border)',
        }} onClick={() => setMenuOpen(false)}>Game History</Link>
        <Link to="/settings" style={{
                      display: 'block', padding: '10px 16px',
                      color: 'var(--color-text)', textDecoration: 'none', fontSize: '0.875rem',
                      borderBottom: '1px solid var(--color-border)',
                    }} onClick={() => setMenuOpen(false)}>Settings</Link>
                    {user?.email === 'sidamailbox@gmail.com' && (
                      <Link to="/admin" style={{
                        display: 'block', padding: '10px 16px',
                        color: 'var(--color-dark)', textDecoration: 'none', fontSize: '0.875rem',
                        fontWeight: 700, borderBottom: '1px solid var(--color-border)',
                        background: 'rgba(44,110,73,0.05)',
                      }} onClick={() => setMenuOpen(false)}>Admin Panel</Link>
                    )}
                    <button onClick={() => { setMenuOpen(false); handleLogout(); }} style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 16px', color: 'var(--color-danger)', fontSize: '0.875rem',
                      background: 'none', border: 'none', cursor: 'pointer',
                      borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                    }}>Sign Out</button>
                  </div>
                )}
              </div>

              {/* Hamburger (mobile) */}
              <button
                className="mobile-nav-toggle"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'none' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: 'var(--color-text-secondary)' }}>
                  {mobileMenuOpen ? 'close' : 'menu'}
                </span>
              </button>
            </>
          )}

          {!user && (
            <>
              <Link to="/login"><Button variant="ghost" size="sm">Sign In</Button></Link>
              <Link to="/register"><Button variant="success" size="sm">Sign Up</Button></Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {user && mobileMenuOpen && (
        <div className="mobile-nav-menu" style={{
          borderTop: '1px solid var(--color-border)', background: 'var(--color-white)',
          padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                padding: '8px 10px', fontSize: '0.85rem', outline: 'none',
              }}
            />
            <Button variant="success" size="sm" type="submit">Go</Button>
          </form>
          <Link to="/play" onClick={() => setMobileMenuOpen(false)} style={{ padding: '10px 0', color: 'var(--color-dark)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
            Play
          </Link>
          <Link to="/leaderboards" onClick={() => setMobileMenuOpen(false)} style={{ padding: '10px 0', color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
            Rankings
          </Link>
          <Link to="/spectate" onClick={() => setMobileMenuOpen(false)} style={{ padding: '10px 0', color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
            Watch
          </Link>
        <Link to="/friends" onClick={() => setMobileMenuOpen(false)} style={{ padding: '10px 0', color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
          Friends
        </Link>
        <Link to="/game-history" onClick={() => setMobileMenuOpen(false)} style={{ padding: '10px 0', color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
          History
        </Link>
          <div style={{ height: 1, background: 'var(--color-border-light)', margin: '4px 0' }} />
        <Link to="/profile" onClick={() => setMobileMenuOpen(false)} style={{ padding: '10px 0', color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
          Profile
        </Link>
        <Link to="/game-history" onClick={() => setMobileMenuOpen(false)} style={{ padding: '10px 0', color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
          Game History
        </Link>
        <Link to="/settings" onClick={() => setMobileMenuOpen(false)} style={{ padding: '10px 0', color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
          Settings
        </Link>
          <button onClick={handleLogout} style={{
            padding: '10px 0', color: 'var(--color-danger)', fontSize: '0.875rem',
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}>Sign Out</button>
        </div>
      )}
    </nav>
  );
}
