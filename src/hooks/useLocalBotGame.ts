import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { getWinLine } from '../utils/boardUtils';
import { cloneBoard, countPiecesOnBoard, checkForWin } from '../utils/boardUtils';
import { TOTAL_PIECES } from '../types';
import type { Game, CellOwner, Position } from '../types';

function applyPlacementLocal(board: CellOwner[][], player: CellOwner, pos: Position): { board: CellOwner[][]; gameOver: boolean; winner?: CellOwner; error?: string } {
  if (board[pos.row][pos.col] !== null) return { board, gameOver: false, error: 'Cell occupied' };
  if (countPiecesOnBoard(board, player) >= TOTAL_PIECES) return { board, gameOver: false, error: 'All pieces placed' };
  const newBoard = cloneBoard(board);
  newBoard[pos.row][pos.col] = player;
  if (checkForWin(newBoard, player)) return { board: newBoard, gameOver: true, winner: player };
  return { board: newBoard, gameOver: false };
}

function applyMovementLocal(board: CellOwner[][], player: CellOwner, from: Position, to: Position): { board: CellOwner[][]; gameOver: boolean; winner?: CellOwner; error?: string } {
  const dr = Math.abs(to.row - from.row);
  const dc = Math.abs(to.col - from.col);
  if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) return { board, gameOver: false, error: 'Invalid move' };
  if (board[from.row][from.col] !== player) return { board, gameOver: false, error: 'No piece at source' };
  if (board[to.row][to.col] !== null) return { board, gameOver: false, error: 'Destination occupied' };
  const newBoard = cloneBoard(board);
  newBoard[to.row][to.col] = player;
  newBoard[from.row][from.col] = null;
  if (checkForWin(newBoard, player)) return { board: newBoard, gameOver: true, winner: player };
  return { board: newBoard, gameOver: false };
}

export function useLocalBotGame(gameId: string | undefined) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [moveLoading, setMoveLoading] = useState(false);
  const pollRef = useRef<number | null>(null);
  const botPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef<Game | null>(null);

  useEffect(() => {
    if (!gameId) { setGame(null); setLoading(false); return; }
    setLoading(true);

    const fetchGame = async () => {
      try {
        const data = await api.get(`/api/bot/game/${gameId}`);
        setGame(data);
        gameRef.current = data;
        setLoading(false);
        if (data.status === 'active' && data.currentTurn === 'black') {
          botPollRef.current = setTimeout(fetchGame, 500);
        }
      } catch {
        setLoading(false);
      }
    };

    fetchGame();
    pollRef.current = window.setInterval(async () => {
      if (!gameId || gameRef.current?.status === 'finished') return;
      try {
        const data = await api.get(`/api/bot/game/${gameId}`);
        setGame(data);
        gameRef.current = data;
      } catch {}
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (botPollRef.current) clearTimeout(botPollRef.current);
    };
  }, [gameId]);

  const makeBotMove = useCallback(async (from: Position | undefined, to: Position) => {
    if (!gameId || moveLoading) return { error: 'Loading' };

    setGame(prev => {
      if (!prev || prev.status !== 'active' || prev.currentTurn !== 'white') return prev;

      const result = from
        ? applyMovementLocal(prev.board, 'white', from, to)
        : applyPlacementLocal(prev.board, 'white', to);

      if (result.error) return prev;

      const newPhase = prev.phase === 'placement'
        && countPiecesOnBoard(result.board, 'black') >= TOTAL_PIECES
        && countPiecesOnBoard(result.board, 'white') >= TOTAL_PIECES
        ? 'movement' : prev.phase;

      const nextTurn = 'black';
      const timeElapsed = Date.now() - (prev.lastMoveTimestamp || Date.now());
      const newClock = {
        ...prev.clock,
        white: Math.max(0, prev.clock.white - timeElapsed),
      };

      let newStatus: 'active' | 'finished' = prev.status;
      let newResult: Game['result'] = prev.result;
      if (result.gameOver && result.winner) {
        newStatus = 'finished';
        newResult = { winner: result.winner, method: 'four-in-a-row', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: prev.blackPlayer.rating, whiteRating: prev.whitePlayer.rating };
      }

      return {
        ...prev,
        board: result.board,
        currentTurn: result.gameOver ? prev.currentTurn : nextTurn as 'black' | 'white',
        phase: result.gameOver ? prev.phase : (newPhase as 'placement' | 'movement'),
        clock: newClock,
        lastMoveTimestamp: Date.now(),
        moves: [...(prev.moves || []), { player: 'white', from, to, timestamp: Date.now(), moveNumber: (prev.moves?.length || 0) + 1 }],
        status: newStatus,
        result: newResult,
      };
    });

    setMoveLoading(true);
    try {
      const data = await api.post(`/api/bot/game/${gameId}/move`, { from, to });
      if (data.game) setGame(data.game);
      return data;
    } catch (err: any) {
      return { error: err.message };
    } finally {
      setMoveLoading(false);
    }
  }, [gameId, moveLoading]);

  const resignBotGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await api.post(`/api/bot/game/${gameId}/resign`);
      if (data.game) setGame(data.game);
    } catch {}
  }, [gameId]);

  const winLine = game?.status === 'finished' && game.result && game.result.winner !== 'draw'
    ? getWinLine(game.board, game.result.winner as CellOwner) : null;

  return { game, loading, moveLoading, makeBotMove, resignBotGame, winLine };
}
