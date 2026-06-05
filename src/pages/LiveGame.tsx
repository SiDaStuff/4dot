import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../hooks/useGame';
import { makeMove, resignGame, offerDraw, acceptDraw, rejectDraw, requestRematch, acceptRematch, declineRematch, cancelRematch } from '../services/gameService';
import { api } from '../services/api';
import { Board } from '../components/game/Board';
import { Clock } from '../components/game/Clock';
import { GameInfo } from '../components/game/GameInfo';
import { MoveHistory } from '../components/game/MoveHistory';
import { GameOverOverlay } from '../components/game/GameOver';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { getWinLine } from '../utils/boardUtils';
import { countPiecesOnBoard } from '../utils/boardUtils';
import { TOTAL_PIECES } from '../types';
import { playSoundPlace, playSoundMove, playSoundGameEnd, playSoundGameWin, playSoundGameStart, playSoundDrawOffer } from '../utils/sounds';
import { useSettings } from '../context/SettingsContext';
import { showToast } from '../components/ui/Toast';
import { awardBotWinAchievement, checkAchievementsAfterGame, recordGameResult } from '../utils/achievements';
import { useSSEListener } from '../context/NotificationContext';
import type { CellOwner, Position } from '../types';

export function LiveGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const guestUid = searchParams.get('guestUid') || undefined;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { game, loading, applyOptimisticMove } = useGame(gameId, guestUid);
  const { settings, updateSetting } = useSettings();
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const winLineRef = useRef<Position[] | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [premove, setPremove] = useState<{ from?: Position; to: Position } | null>(null);
  const [drawOfferPending, setDrawOfferPending] = useState(false);
  const [opponentDrawOffer, setOpponentDrawOffer] = useState(false);
const [rematchLoading, setRematchLoading] = useState(false);
const [rematchRequestId, setRematchRequestId] = useState<string | null>(null);
const [rematchFromUsername, setRematchFromUsername] = useState<string>('');
const [sentRematchId, setSentRematchId] = useState<string | null>(null);
const prevMoveCountRef = useRef(0);
  const prevStatusRef = useRef<string>('');
  const prevTurnRef = useRef<string>('');
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const achievementCheckedRef = useRef(false);

useEffect(() => { achievementCheckedRef.current = false; }, [gameId]);

useSSEListener('rematch_request', useCallback((data: any) => {
if (data.gameId === gameId) {
setRematchRequestId(data.rematchRequestId);
setRematchFromUsername(data.fromUsername || 'Opponent');
}
}, [gameId]));

useSSEListener('rematch_declined', useCallback((_data: any) => {
setSentRematchId(null);
showToast('Rematch declined', 'info');
}, []));

const handleAcceptRematch = async () => {
if (!rematchRequestId) return;
try {
const result = await acceptRematch(rematchRequestId);
if (result.error) showToast(result.error, 'error');
setRematchRequestId(null);
} catch { setRematchRequestId(null); }
};

const handleDeclineRematch = async () => {
if (!rematchRequestId) return;
try {
await declineRematch(rematchRequestId);
} catch {}
setRematchRequestId(null);
};

const uid = user?.uid || guestUid || '';
  const myColor: CellOwner | null = game
    ? (game.blackPlayer.uid === uid ? 'black' : game.whitePlayer.uid === uid ? 'white' : null)
    : null;
  const isSpectator = myColor === null && game?.status === 'active';

  const blackOnBoard = game ? countPiecesOnBoard(game.board, 'black') : 0;
  const whiteOnBoard = game ? countPiecesOnBoard(game.board, 'white') : 0;
  const blackRemaining = TOTAL_PIECES - blackOnBoard;
  const whiteRemaining = TOTAL_PIECES - whiteOnBoard;

  useEffect(() => {
    if (game?.status === 'finished' && game.result) {
      winLineRef.current = null;
      if (game.result.winner !== 'draw') {
        const winner = game.result.winner as CellOwner;
        if (winner) winLineRef.current = getWinLine(game.board, winner);
      }
    }
  }, [game?.status, game?.result, game?.board]);

  useEffect(() => {
    if (!game) return;
    const moveCount = game.moves?.length || 0;
    if (moveCount > prevMoveCountRef.current) {
      const latestMove = game.moves[game.moves.length - 1];
      if (settings.soundEnabled) {
        if (latestMove.from) playSoundMove(settings.soundVolume);
        else playSoundPlace(settings.soundVolume);
      }
    }
    if (game.status === 'finished' && prevStatusRef.current === 'active' && settings.soundEnabled) {
      const isWin = game.result?.winner === myColor;
      if (isWin) playSoundGameWin(settings.soundVolume);
      else if (game.result?.winner === 'draw') playSoundGameEnd(settings.soundVolume);
      else playSoundGameEnd(settings.soundVolume);
    }
    if (game.status === 'active' && prevStatusRef.current !== 'active' && settings.soundEnabled) {
      playSoundGameStart(settings.soundVolume);
    }
    prevMoveCountRef.current = moveCount;
    prevStatusRef.current = game.status;
  }, [game?.moves?.length, game?.status, game?.result, settings.soundEnabled, settings.soundVolume, myColor]);

  const premoveExecutedRef = useRef(false);

  useEffect(() => {
    if (!game || game.status !== 'finished' || achievementCheckedRef.current) return;
    achievementCheckedRef.current = true;
    const result = game.result;
    if (!result) return;
    const isWin = result.winner === myColor;
    const isDraw = result.winner === 'draw';
    recordGameResult(isWin ? 'win' : isDraw ? 'draw' : 'loss');
    api.get('/api/profile').then((profile: any) => {
      if (profile) {
        checkAchievementsAfterGame({
          wins: profile.wins || 0,
          losses: profile.losses || 0,
          draws: profile.draws || 0,
          gamesPlayed: profile.gamesPlayed || 0,
          rating: profile.rating || 1500,
        });
      }
    }).catch(() => {});
  }, [game?.status, game?.result, myColor]);

  useEffect(() => {
    if (!game || !premove || !myColor || premoveExecutedRef.current) return;
    if (game.currentTurn === myColor && game.status === 'active') {
      premoveExecutedRef.current = true;
      if (game.phase === 'movement' && premove.from) {
        applyOptimisticMove(myColor, premove.from, premove.to);
        makeMove(gameId!, uid, premove.from, premove.to, guestUid).then((result) => {
          setPremove(null);
          setSelectedPos(null);
          premoveExecutedRef.current = false;
        });
      } else if (game.phase === 'placement' && !premove.from) {
        applyOptimisticMove(myColor, undefined, premove.to);
        makeMove(gameId!, uid, undefined, premove.to, guestUid).then((result) => {
          setPremove(null);
          premoveExecutedRef.current = false;
        });
      } else {
        premoveExecutedRef.current = false;
      }
    }
  }, [game?.currentTurn, premove, myColor, gameId, uid, guestUid]);

  useEffect(() => {
    if (!game) return;
    const drawFrom = (game as any).drawOfferFrom;
    if (drawFrom && drawFrom !== uid) {
      setOpponentDrawOffer(true);
      if (settings.soundEnabled) playSoundDrawOffer(settings.soundVolume);
    } else {
      setOpponentDrawOffer(false);
    }
  }, [game, uid, settings.soundEnabled, settings.soundVolume]);

  useEffect(() => {
    if (!settings.keyboardShortcutsEnabled) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        updateSetting('boardFlipped', !settings.boardFlipped);
      }
      if (e.key === 'Escape') {
        setSelectedPos(null);
        setPremove(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [settings.keyboardShortcutsEnabled, settings.boardFlipped, updateSetting]);

  const handleCellClick = useCallback(async (pos: Position) => {
    if (!game || !uid || game.status !== 'active' || !myColor || moveLoading) return;

    const isMyTurn = game.currentTurn === myColor;

    if (!isMyTurn && settings.premoveEnabled) {
      if (game.phase === 'placement') {
        setPremove({ to: pos });
        return;
      }
      if (game.phase === 'movement') {
        if (game.board[pos.row][pos.col] === myColor) {
          setSelectedPos(pos);
          return;
        }
        if (selectedPos) {
          setPremove({ from: selectedPos, to: pos });
          return;
        }
      }
      return;
    }

    if (!isMyTurn) return;

    setMoveLoading(true);
    try {
      if (game.phase === 'placement') {
        applyOptimisticMove(myColor, undefined, pos);
        const result = await makeMove(gameId!, uid, undefined, pos, guestUid);
        if (!result.error) setSelectedPos(null);
      } else if (game.phase === 'movement') {
        if (game.board[pos.row][pos.col] === myColor) {
          setSelectedPos(pos);
          setMoveLoading(false);
          return;
        }
        if (selectedPos) {
          applyOptimisticMove(myColor, selectedPos, pos);
          const result = await makeMove(gameId!, uid, selectedPos, pos, guestUid);
          setSelectedPos(null);
        }
      }
    } catch (err: any) {
      if (err.message !== 'Session expired') {
      }
    } finally {
      setMoveLoading(false);
    }
  }, [game, uid, myColor, gameId, selectedPos, moveLoading, guestUid, settings.premoveEnabled, applyOptimisticMove]);

const handleResign = async () => {
try {
await resignGame(gameId!, uid, guestUid);
} catch {
}
};

useEffect(() => {
return () => {
if (sentRematchId) cancelRematch(sentRematchId).catch(() => {});
};
}, []);

  const handleDrawOffer = async () => {
    if (drawOfferPending) return;
    const result = await offerDraw(gameId!);
    if (result.error) showToast(result.error, 'error');
    else {
      setDrawOfferPending(true);
      showToast('Draw offer sent', 'info');
    }
  };

  const handleAcceptDraw = async () => {
    const result = await acceptDraw(gameId!);
    if (result.error) showToast(result.error, 'error');
    setOpponentDrawOffer(false);
  };

  const handleRejectDraw = async () => {
    const result = await rejectDraw(gameId!);
    if (result.error) showToast(result.error, 'error');
    setOpponentDrawOffer(false);
  };

const handleRematch = async () => {
setRematchLoading(true);
const result = await requestRematch(gameId!);
if (result.error) showToast(result.error, 'error');
else if (result.gameId) navigate(`/game/${result.gameId}`);
else if (result.rematchRequestId) {
setSentRematchId(result.rematchRequestId);
showToast('Rematch request sent', 'info');
}
setRematchLoading(false);
};

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <Spinner size={40} />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <h2 style={{ color: 'var(--color-text-secondary)' }}>Game not found</h2>
        <Button variant="primary" onClick={() => navigate('/play')} style={{ marginTop: '1rem' }}>
          Back to Play
        </Button>
      </div>
    );
  }

  const isMyTurn = game.currentTurn === myColor && game.status === 'active';
  const clock = game.clock || { black: 0, white: 0 };
  const isBotThinking = game.isBotGame && game.currentTurn === 'black' && game.status === 'active';

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <GameInfo game={game} myUid={uid} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Black
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {game.phase === 'placement' ? `${blackRemaining} left` : `${blackOnBoard} pcs`}
                </span>
              </div>
              <Clock
                timeMs={clock.black}
                isActive={game.status === 'active'}
                isMyTurn={myColor === 'black' && isMyTurn}
                lastMoveTimestamp={game.lastMoveTimestamp}
                currentTurn={game.currentTurn}
                myColor={myColor || undefined}
                playerColor="black"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateSetting('boardFlipped', !settings.boardFlipped)}
                title="Flip board (F)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>flip</span>
              </Button>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                White
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {game.phase === 'placement' ? `${whiteRemaining} left` : `${whiteOnBoard} pcs`}
                </span>
              </div>
              <Clock
                timeMs={clock.white}
                isActive={game.status === 'active'}
                isMyTurn={myColor === 'white' && isMyTurn}
                lastMoveTimestamp={game.lastMoveTimestamp}
                currentTurn={game.currentTurn}
                myColor={myColor || undefined}
                playerColor="white"
              />
            </div>
          </div>

          <div ref={boardContainerRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', position: 'relative' }}>
            <Board
              game={game}
              myColor={myColor || 'black'}
              onCellClick={handleCellClick}
              winLine={winLineRef.current}
              selectedPos={selectedPos}
              premoveFrom={premove?.from || null}
              premoveTo={premove?.to || null}
              isMyTurn={isMyTurn}
            />
<GameOverOverlay
game={game}
myUid={uid}
onPlayAgain={() => navigate('/play')}
onBackToDashboard={() => navigate('/dashboard')}
onRematch={handleRematch}
opponentDrawOffer={opponentDrawOffer}
onAcceptDraw={handleAcceptDraw}
onRejectDraw={handleRejectDraw}
/>
{rematchRequestId && (
<div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
<div style={{
background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(4px)',
borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
boxShadow: 'var(--shadow-xl)', padding: '1.5rem 2rem', textAlign: 'center', maxWidth: 320,
animation: 'fadeIn 200ms ease-out',
}}>
<span className="material-symbols-outlined" style={{ fontSize: '2rem', color: 'var(--color-primary)', display: 'block', marginBottom: '0.5rem' }}>replay</span>
<h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Rematch Request</h3>
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>{rematchFromUsername} wants a rematch</p>
<div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
<button onClick={handleAcceptRematch} style={{ padding: '8px 20px', borderRadius: 'var(--radius-md)', background: 'var(--color-success)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Accept</button>
<button onClick={handleDeclineRematch} style={{ padding: '8px 20px', borderRadius: 'var(--radius-md)', background: 'var(--color-danger)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Decline</button>
</div>
</div>
</div>
)}
          </div>

          <div style={{
            display: 'flex', justifyContent: 'center', gap: '1rem',
            marginBottom: '1rem',
          }}>
            <Button variant="secondary" size="sm">
              {game.phase === 'placement' ? 'Placement Phase' : game.phase === 'movement' ? 'Movement Phase' : 'Game Over'}
            </Button>
            <span style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              background: isMyTurn ? 'var(--color-success)' : 'var(--color-bg-secondary)',
              color: isMyTurn ? 'white' : 'var(--color-text)',
              fontSize: '0.875rem', fontWeight: 600,
              transition: 'all var(--transition-fast)',
            }}>
              {isBotThinking ? 'Bot Thinking...' : isMyTurn ? 'Your Turn' : "Opponent's Turn"}
            </span>
            {(moveLoading || isBotThinking) && <Spinner size={20} />}
            {premove && (
              <span style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-secondary)', color: 'var(--color-dark)',
                fontSize: '0.8rem', fontWeight: 600,
                border: '1px solid var(--color-border)',
              }}>
                Premove
              </span>
            )}
          </div>

          {!isSpectator && game.status === 'active' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Button variant="danger" size="sm" onClick={handleResign}>
                Resign
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDrawOffer} disabled={drawOfferPending}>
                {drawOfferPending ? 'Draw Offered' : 'Offer Draw'}
              </Button>
            </div>
          )}

          <MoveHistory moves={game.moves || []} />
        </div>
      </div>
    </div>
  );
}
