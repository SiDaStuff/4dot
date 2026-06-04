import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { AnalysisBoard } from '../components/game/AnalysisBoard';
import { createInitialGameState } from '../utils/gameLogic';
import type { CellOwner, Move } from '../types';

interface Player {
  uid: string;
  username: string;
  email: string;
  rating: number;
  gamesPlayed: number;
  susScore: number;
  internalActionFlags: number;
  banned: string | false;
  banReason: string | null;
  banUntil: number | null;
}

interface FlaggedGame {
  id: string;
  gameId: string;
  uid: string;
  username: string;
  matchRate: number;
  totalMoves: number;
  matchingMoves: number;
  reason: string;
  susIncrease: number;
  blackPlayer: any;
  whitePlayer: any;
  moves: Move[];
  createdAt: number;
  status: string;
}

const BAN_REASONS = [
  'Cheating - Engine assistance',
  'Cheating - Unauthorized client modifications',
  'Suspicious play pattern',
  'Harassment',
  'Exploiting bugs',
  'Admin ban',
];

export function Admin() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [endMatchId, setEndMatchId] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [banModal, setBanModal] = useState<{ uid: string; username: string } | null>(null);
  const [banReason, setBanReason] = useState(BAN_REASONS[0]);
  const [banCustomReason, setBanCustomReason] = useState('');
  const [banRefund, setBanRefund] = useState(true);
  const [banPermanent, setBanPermanent] = useState(false);
  const [refundUid, setRefundUid] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundGameId, setRefundGameId] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [flaggedGames, setFlaggedGames] = useState<FlaggedGame[]>([]);
  const [flaggedLoading, setFlaggedLoading] = useState(false);
  const [reviewingFlag, setReviewingFlag] = useState<FlaggedGame | null>(null);
  const [reviewMoveIndex, setReviewMoveIndex] = useState(-1);
  const [reviewBanReason, setReviewBanReason] = useState('');
  const [reviewBanPermanent, setReviewBanPermanent] = useState(false);

  const isAdmin = user?.email === 'sidamailbox@gmail.com';

  useEffect(() => {
    if (isAdmin) {
      loadPlayers();
      loadActiveGames();
      loadFlaggedGames();
    }
  }, [isAdmin]);

  const loadFlaggedGames = async () => {
    setFlaggedLoading(true);
    try {
      const data = await api.get('/api/admin/flagged-games');
      setFlaggedGames(data);
    } catch {}
    setFlaggedLoading(false);
  };

  const getBoardAtMove = useCallback((moves: Move[], moveIndex: number): CellOwner[][] => {
    const temp = createInitialGameState();
    for (let i = 0; i <= moveIndex; i++) {
      const move = moves[i];
      if (!move) continue;
      if (move.player !== temp.currentTurn) temp.currentTurn = move.player;
      if (temp.phase === 'placement') {
        temp.board[move.to.row][move.to.col] = move.player;
        const bp = temp.board.flat().filter((c: any) => c === 'black').length;
        const wp = temp.board.flat().filter((c: any) => c === 'white').length;
        if (bp >= 8 && wp >= 8) temp.phase = 'movement';
      } else {
        temp.board[move.to.row][move.to.col] = move.player;
        if (move.from) temp.board[move.from.row][move.from.col] = null;
      }
      temp.currentTurn = move.player === 'black' ? 'white' : 'black';
    }
    return temp.board;
  }, []);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/admin/players');
      setPlayers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveGames = async () => {
    try {
      const data = await api.get('/api/active-games');
      setActiveGames(data);
    } catch {}
  };

  const handleBan = async () => {
    if (!banModal) return;
    setActionLoading(banModal.uid);
    const reason = banReason === '__custom' ? banCustomReason : banReason;
    try {
      await api.post('/api/admin/ban', { uid: banModal.uid, reason, permanent: banPermanent, refund: banRefund });
      setMsg(`${banModal.username} has been ${banPermanent ? 'permanently' : 'temporarily'} banned`);
      setBanModal(null);
      await loadPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async (uid: string, username: string) => {
    setActionLoading(uid);
    try {
      await api.post('/api/admin/unban', { uid });
      setMsg(`${username} has been unbanned`);
      await loadPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndMatch = async () => {
    if (!endMatchId) return;
    setActionLoading('endmatch');
    try {
      await api.post('/api/admin/end-match', { gameId: endMatchId });
      setMsg(`Match ${endMatchId} has been ended`);
      setEndMatchId('');
      await loadActiveGames();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefundRating = async () => {
    if (!refundUid || !refundAmount) return;
    setRefundLoading(true);
    try {
      const data = await api.post('/api/admin/refund-rating', {
        uid: refundUid,
        amount: parseInt(refundAmount),
        reason: refundReason || undefined,
        gameId: refundGameId || undefined,
      });
      setMsg(`Refunded ${refundAmount} rating to ${refundUid}. New rating: ${data.newRating}`);
      setRefundUid(''); setRefundAmount(''); setRefundReason(''); setRefundGameId('');
      await loadPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefundLoading(false);
    }
  };

  const handleFlagBan = async (flagId: string) => {
    setActionLoading(flagId);
    try {
      await api.post(`/api/admin/flagged-games/${flagId}/ban`, {
        permanent: reviewBanPermanent,
        reason: reviewBanReason || undefined,
      });
      setMsg('Player has been banned');
      setReviewingFlag(null);
      await loadFlaggedGames();
      await loadPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFlagDismiss = async (flagId: string) => {
    setActionLoading(flagId);
    try {
      await api.post(`/api/admin/flagged-games/${flagId}/dismiss`);
      setMsg('Flag has been dismissed');
      await loadFlaggedGames();
      await loadPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 600, textAlign: 'center', paddingTop: '4rem' }}>
          <h2 style={{ color: 'var(--color-danger)' }}>Access Denied</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>You do not have admin privileges.</p>
        </div>
      </div>
    );
  }

  const filtered = players.filter(p =>
    p.username.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.email.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.uid.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const getSusColor = (score: number) => {
    if (score >= 80) return 'var(--color-danger)';
    if (score >= 50) return 'var(--color-warning)';
    if (score >= 20) return '#F59E0B';
    return 'var(--color-success)';
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 1000 }}>
        <h1 className="page-title">Admin Panel</h1>

        {msg && (
          <div style={{
            background: '#ECFDF5', border: '1px solid #A7F3D0',
            borderRadius: 'var(--radius-md)', padding: '10px 14px',
            marginBottom: '1rem', color: '#065F46', fontSize: '0.875rem',
          }}>
            {msg}
          </div>
        )}

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 'var(--radius-md)', padding: '10px 14px',
            marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {banModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              background: 'white', borderRadius: 'var(--radius-lg)',
              padding: '1.5rem', maxWidth: 420, width: '90%',
              boxShadow: 'var(--shadow-xl)',
            }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>
                Ban {banModal.username}
              </h3>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Reason
                </label>
                <select
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)', fontSize: '0.875rem',
                  }}
                >
                  {BAN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  <option value="__custom">Custom reason...</option>
                </select>
              </div>

              {banReason === '__custom' && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <input
                    value={banCustomReason}
                    onChange={e => setBanCustomReason(e.target.value)}
                    placeholder="Enter custom reason"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)', fontSize: '0.875rem',
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={banPermanent} onChange={e => setBanPermanent(e.target.checked)} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>Permanent ban (24h if unchecked)</span>
                </label>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={banRefund} onChange={e => setBanRefund(e.target.checked)} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>Refund ratings to opponents</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" onClick={() => setBanModal(null)}>Cancel</Button>
                <Button variant="danger" size="sm" onClick={handleBan} loading={actionLoading === banModal.uid}>Confirm Ban</Button>
              </div>
            </div>
          </div>
        )}

        <Card padding="1.5rem" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', verticalAlign: 'middle', marginRight: 6 }}>swords</span>
            Force End Match
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              value={endMatchId}
              onChange={e => setEndMatchId(e.target.value)}
              placeholder="Enter game ID"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', fontSize: '0.875rem',
              }}
            />
            <Button
              variant="danger"
              size="sm"
              onClick={handleEndMatch}
              loading={actionLoading === 'endmatch'}
              disabled={!endMatchId}
            >
              End Match
            </Button>
          </div>
          {activeGames.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Active Games:</p>
              <div style={{ maxHeight: 150, overflow: 'auto' }}>
                {activeGames.map((g: any) => (
                  <div key={g.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-secondary)', marginBottom: 4,
                    fontSize: '0.8rem',
                  }}>
                    <span>{g.id}</span>
                    <span>{g.blackPlayer?.username} vs {g.whitePlayer?.username}</span>
                    <button
                      onClick={() => setEndMatchId(g.id)}
                      style={{
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-danger)', color: 'white',
                        border: 'none', fontSize: '0.75rem', cursor: 'pointer',
                      }}
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>
    )}
    </Card>

    <Card padding="1.5rem" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ color: 'var(--color-dark)', marginBottom: '1rem' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', verticalAlign: 'middle', marginRight: 6 }}>payments</span>
        Refund Rating Points
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <input
          value={refundUid}
          onChange={e => setRefundUid(e.target.value)}
          placeholder="Player UID"
          style={{
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', fontSize: '0.875rem',
          }}
        />
        <input
          value={refundAmount}
          onChange={e => setRefundAmount(e.target.value.replace(/[^0-9-]/g, ''))}
          placeholder="Amount (e.g. 25 or -25)"
          type="text"
          style={{
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', fontSize: '0.875rem',
          }}
        />
        <input
          value={refundReason}
          onChange={e => setRefundReason(e.target.value)}
          placeholder="Reason (optional)"
          style={{
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', fontSize: '0.875rem',
          }}
        />
        <input
          value={refundGameId}
          onChange={e => setRefundGameId(e.target.value)}
          placeholder="Game ID (optional)"
          style={{
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', fontSize: '0.875rem',
          }}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleRefundRating}
          loading={refundLoading}
          disabled={!refundUid || !refundAmount}
        >
          Refund Rating
        </Button>
      </div>
    </Card>

    <Card padding="1.5rem" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--color-dark)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', verticalAlign: 'middle', marginRight: 6 }}>flag</span>
          Flagged Games ({flaggedGames.length})
        </h3>
        <Button variant="secondary" size="sm" onClick={loadFlaggedGames} loading={flaggedLoading}>
          Refresh
        </Button>
      </div>

      {reviewingFlag && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: 'var(--radius-lg)',
            padding: '1.5rem', maxWidth: 700, width: '95%', maxHeight: '90vh',
            overflowY: 'auto', boxShadow: 'var(--shadow-xl)',
          }}>
            <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.75rem' }}>
              Review: {reviewingFlag.username} ({reviewingFlag.matchRate}% match)
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Reason: {reviewingFlag.reason} · {reviewingFlag.matchingMoves}/{reviewingFlag.totalMoves} matching moves
            </div>

            {reviewingFlag.moves && reviewingFlag.moves.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <AnalysisBoard
                    board={reviewMoveIndex >= 0
                      ? getBoardAtMove(reviewingFlag.moves, reviewMoveIndex)
                      : getBoardAtMove(reviewingFlag.moves, reviewingFlag.moves.length - 1)}
                    currentMoveIndex={reviewMoveIndex >= 0 ? reviewMoveIndex + 1 : reviewingFlag.moves.length}
                    totalMoves={reviewingFlag.moves.length}
                    lastMove={reviewMoveIndex >= 0 ? reviewingFlag.moves[reviewMoveIndex] : reviewingFlag.moves[reviewingFlag.moves.length - 1]}
                    interactive={false}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: '1rem' }}>
                  <Button variant="ghost" size="sm" onClick={() => setReviewMoveIndex(0)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>skip_previous</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setReviewMoveIndex(Math.max(0, reviewMoveIndex - 1))}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>chevron_left</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setReviewMoveIndex(Math.min(reviewingFlag.moves.length - 1, reviewMoveIndex + 1))}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>chevron_right</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setReviewMoveIndex(reviewingFlag.moves.length - 1)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>skip_next</span>
                  </Button>
                </div>
              </>
            )}

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Ban Reason</label>
              <input
                value={reviewBanReason}
                onChange={e => setReviewBanReason(e.target.value)}
                placeholder={reviewingFlag.reason}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: '1rem' }}>
              <input type="checkbox" checked={reviewBanPermanent} onChange={e => setReviewBanPermanent(e.target.checked)} />
              <span style={{ fontSize: '0.85rem' }}>Permanent ban</span>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="sm" onClick={() => { setReviewingFlag(null); setReviewMoveIndex(-1); }}>Cancel</Button>
              <Button variant="ghost" size="sm" onClick={() => handleFlagDismiss(reviewingFlag.id)} loading={actionLoading === reviewingFlag.id}>Dismiss Flag</Button>
              <Button variant="danger" size="sm" onClick={() => handleFlagBan(reviewingFlag.id)} loading={actionLoading === reviewingFlag.id}>Ban Player</Button>
            </div>
          </div>
        </div>
      )}

      {flaggedLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}><Spinner size={32} /></div>
      ) : flaggedGames.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No flagged games</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: 'var(--color-text-secondary)' }}>Player</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Match Rate</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Moves</th>
                <th style={{ padding: '8px 6px', textAlign: 'left', color: 'var(--color-text-secondary)' }}>Reason</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flaggedGames.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '8px 6px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-dark)' }}>{f.username}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{f.uid}</div>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                      background: f.matchRate >= 85 ? 'var(--color-danger)' : f.matchRate >= 70 ? 'var(--color-warning)' : '#F59E0B',
                      color: 'white', fontWeight: 700, fontSize: '0.75rem',
                    }}>
                      {f.matchRate}%
                    </span>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>{f.matchingMoves}/{f.totalMoves}</td>
                  <td style={{ padding: '8px 6px', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{f.reason}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        onClick={() => { setReviewingFlag(f); setReviewMoveIndex(-1); setReviewBanReason(''); setReviewBanPermanent(false); }}
                        style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary)', color: 'var(--color-text)', border: 'none', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Review
                      </button>
                      <button
                        onClick={() => handleFlagDismiss(f.id)}
                        disabled={actionLoading === f.id}
                        style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-success)', color: 'white', border: 'none', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => { setReviewingFlag(f); setReviewMoveIndex(-1); setReviewBanReason(''); setReviewBanPermanent(false); }}
                        style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-danger)', color: 'white', border: 'none', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Ban
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>

    <Card padding="1.5rem">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--color-dark)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', verticalAlign: 'middle', marginRight: 6 }}>group</span>
              Players ({players.length})
            </h3>
            <Button variant="secondary" size="sm" onClick={loadPlayers} loading={loading}>
              Refresh
            </Button>
          </div>

          <input
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Search by username, email, or UID..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          />

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}><Spinner size={32} /></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    <th style={{ padding: '8px 6px', textAlign: 'left', color: 'var(--color-text-secondary)' }}>Player</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Rating</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Games</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Sus Score</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Flags</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Status</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.uid} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '8px 6px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-dark)' }}>{p.username}</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{p.email}</div>
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>{p.rating}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>{p.gamesPlayed}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                          background: getSusColor(p.susScore), color: 'white',
                          fontWeight: 700, fontSize: '0.75rem', minWidth: 36,
                        }}>
                          {p.susScore}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', color: p.internalActionFlags > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                        {p.internalActionFlags}/3
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        {p.banned ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                            background: p.banned === 'permanent' ? 'var(--color-danger)' : 'var(--color-warning)',
                            color: 'white', fontSize: '0.7rem', fontWeight: 600,
                          }}>
                            {p.banned === 'permanent' ? 'PERM BAN' : 'SUSPENDED'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>Active</span>
                        )}
                        {p.banReason && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{p.banReason}</div>
                        )}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {p.banned ? (
                    <button
                      onClick={() => handleUnban(p.uid, p.username)}
                      disabled={actionLoading === p.uid}
                      style={{
                        padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-success)', color: 'white',
                        border: 'none', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      Unban
                    </button>
                  ) : (
                    <>
                    <button
                      onClick={() => {
                        setBanPermanent(false);
                        setBanRefund(true);
                        setBanReason(BAN_REASONS[0]);
                        setBanCustomReason('');
                        setBanModal({ uid: p.uid, username: p.username });
                      }}
                      disabled={actionLoading === p.uid}
                      style={{
                        padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-danger)', color: 'white',
                        border: 'none', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      Ban
                    </button>
                    <button
                      onClick={() => {
                        setRefundUid(p.uid);
                        setRefundAmount('');
                        setRefundReason('');
                        setRefundGameId('');
                      }}
                      style={{
                        padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-primary)', color: 'white',
                        border: 'none', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      Refund
                    </button>
                    </>
                  )}
                  </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                  No players found
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
