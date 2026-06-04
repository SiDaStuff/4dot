import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocalBotGame } from '../hooks/useLocalBotGame';
import { Board } from '../components/game/Board';
import { Clock } from '../components/game/Clock';
import { GameInfo } from '../components/game/GameInfo';
import { MoveHistory } from '../components/game/MoveHistory';
import { GameOverOverlay } from '../components/game/GameOver';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { playSoundPlace, playSoundMove, playSoundGameEnd, playSoundGameWin, playSoundGameStart } from '../utils/sounds';
import { useSettings } from '../context/SettingsContext';
import { awardBotWinAchievement, checkAchievementsAfterGame, recordGameResult } from '../utils/achievements';
import { countPiecesOnBoard } from '../utils/boardUtils';
import { TOTAL_PIECES } from '../types';
import type { CellOwner, Position } from '../types';
import { useState, useCallback, useEffect, useRef } from 'react';

export function LocalBotGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { game, loading, moveLoading, makeBotMove, resignBotGame, winLine } = useLocalBotGame(gameId);
  const { settings, updateSetting } = useSettings();
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [premove, setPremove] = useState<{ from?: Position; to: Position } | null>(null);
  const prevMoveCountRef = useRef(0);
  const prevStatusRef = useRef<string>('');
  const achievementCheckedRef = useRef(false);

  useEffect(() => { achievementCheckedRef.current = false; }, [gameId]);

  const uid = user?.uid || '';
  const myColor: CellOwner = 'white';
  const isMyTurn = game?.currentTurn === 'white' && game?.status === 'active';
  const isBotThinking = game?.currentTurn === 'black' && game?.status === 'active';

  const blackOnBoard = game ? countPiecesOnBoard(game.board, 'black') : 0;
  const whiteOnBoard = game ? countPiecesOnBoard(game.board, 'white') : 0;
  const blackRemaining = TOTAL_PIECES - blackOnBoard;
  const whiteRemaining = TOTAL_PIECES - whiteOnBoard;

  useEffect(() => {
    if (!game) return;
    const moveCount = game.moves?.length || 0;
    if (moveCount > prevMoveCountRef.current) {
      const latestMove = game.moves[moveCount - 1];
      if (settings.soundEnabled) {
        if (latestMove.from) playSoundMove(settings.soundVolume);
        else playSoundPlace(settings.soundVolume);
      }
    }
  if (game.status === 'finished' && prevStatusRef.current === 'active' && settings.soundEnabled) {
    const isWin = game.result?.winner === 'white';
    if (isWin) {
      playSoundGameWin(settings.soundVolume);
      if (game.botStrength) awardBotWinAchievement(game.botStrength);
    } else if (game.result?.winner === 'draw') playSoundGameEnd(settings.soundVolume);
    else playSoundGameEnd(settings.soundVolume);
  }
  if (game.status === 'finished' && !achievementCheckedRef.current) {
    achievementCheckedRef.current = true;
    const isWin = game.result?.winner === 'white';
    const isDraw = game.result?.winner === 'draw';
    recordGameResult(isWin ? 'win' : isDraw ? 'draw' : 'loss');
    api.get('/api/profile').then((profile: any) => {
      if (profile) {
        checkAchievementsAfterGame({
          wins: profile.wins || 0,
          losses: profile.losses || 0,
          draws: profile.draws || 0,
          gamesPlayed: profile.gamesPlayed || 0,
          rating: profile.rating || 1500,
        }, { hard: game.botStrength === 'hard', max: game.botStrength === 'stockfish' || game.botStrength === 'max' });
      }
    }).catch(() => {});
  }
    if (game.status === 'active' && prevStatusRef.current !== 'active' && prevStatusRef.current !== '' && settings.soundEnabled) {
      playSoundGameStart(settings.soundVolume);
    }
    prevMoveCountRef.current = moveCount;
    prevStatusRef.current = game.status;
  }, [game?.moves?.length, game?.status, game?.result, game?.botStrength, settings.soundEnabled, settings.soundVolume]);

  const premoveExecutedRef = useRef(false);

  useEffect(() => {
    if (!game || !premove || game.currentTurn !== myColor || game.status !== 'active' || premoveExecutedRef.current) return;
    premoveExecutedRef.current = true;
    if (game.phase === 'movement' && premove.from) {
      makeBotMove(premove.from, premove.to).then(() => {
        setPremove(null);
        setSelectedPos(null);
        premoveExecutedRef.current = false;
      });
    } else if (game.phase === 'placement' && !premove.from) {
      makeBotMove(undefined, premove.to).then(() => {
        setPremove(null);
        premoveExecutedRef.current = false;
      });
    } else {
      premoveExecutedRef.current = false;
    }
  }, [game?.currentTurn, premove, myColor, makeBotMove]);

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
    if (!game || game.status !== 'active' || moveLoading) return;

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

    if (game.phase === 'placement') {
      const result = await makeBotMove(undefined, pos);
      if (!result.error) setSelectedPos(null);
    }

    if (game.phase === 'movement') {
      if (game.board[pos.row][pos.col] === myColor) {
        setSelectedPos(pos);
        return;
      }
      if (selectedPos) {
        const result = await makeBotMove(selectedPos, pos);
        if (!result.error) setSelectedPos(null);
        else setSelectedPos(null);
      }
    }
  }, [game, isMyTurn, moveLoading, makeBotMove, selectedPos, myColor, settings.premoveEnabled]);

  const handleResign = async () => {
    await resignBotGame();
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

  const clock = game.clock || { black: 0, white: 0 };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <GameInfo game={game} myUid={uid} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Black (Bot)
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {game.phase === 'placement' ? `${blackRemaining} left` : `${blackOnBoard} pcs`}
                </span>
              </div>
              <Clock timeMs={clock.black} isActive={game.status === 'active'} isMyTurn={false} lastMoveTimestamp={game.lastMoveTimestamp} currentTurn={game.currentTurn} myColor={myColor || undefined} playerColor="black" />
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
                White (You)
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {game.phase === 'placement' ? `${whiteRemaining} left` : `${whiteOnBoard} pcs`}
                </span>
              </div>
              <Clock timeMs={clock.white} isActive={game.status === 'active'} isMyTurn={myColor === 'white' && isMyTurn} lastMoveTimestamp={game.lastMoveTimestamp} currentTurn={game.currentTurn} myColor={myColor || undefined} playerColor="white" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', position: 'relative' }}>
            <Board
              game={game}
              myColor={myColor || 'white'}
              onCellClick={handleCellClick}
              winLine={winLine}
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
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
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

          {game.status === 'active' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Button variant="danger" size="sm" onClick={handleResign}>Resign</Button>
            </div>
          )}

          <MoveHistory moves={game.moves || []} />
        </div>
      </div>
    </div>
  );
}
