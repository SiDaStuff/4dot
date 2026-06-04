import { useState, useEffect, useCallback } from 'react';
import { listenToGame } from '../services/gameService';
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

export function useGame(gameId: string | undefined, guestUid?: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) {
      setGame(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = listenToGame(gameId, (g) => {
      setGame(g);
      setLoading(false);
    }, guestUid);

    return unsub;
  }, [gameId, guestUid]);

  const applyOptimisticMove = useCallback((playerColor: CellOwner, from: Position | undefined, to: Position) => {
    setGame(prev => {
      if (!prev || prev.status !== 'active' || prev.currentTurn !== playerColor) return prev;

      const result = from
        ? applyMovementLocal(prev.board, playerColor, from, to)
        : applyPlacementLocal(prev.board, playerColor, to);

      if (result.error) return prev;

      const newPhase = prev.phase === 'placement'
        && countPiecesOnBoard(result.board, 'black') >= TOTAL_PIECES
        && countPiecesOnBoard(result.board, 'white') >= TOTAL_PIECES
        ? 'movement' : prev.phase;

      const nextTurn: CellOwner = playerColor === 'black' ? 'white' : 'black';
      const timeElapsed = Date.now() - (prev.lastMoveTimestamp || Date.now());
      const newClock = {
        ...prev.clock,
        [playerColor]: Math.max(0, prev.clock[playerColor] - timeElapsed),
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
        moves: [...(prev.moves || []), { player: playerColor, from, to, timestamp: Date.now(), moveNumber: (prev.moves?.length || 0) + 1 }],
        status: newStatus,
        result: newResult,
      };
    });
  }, []);

  const isMyTurn = useCallback((uid: string) => {
    if (!game || game.status !== 'active') return false;
    const myColor = game.blackPlayer.uid === uid ? 'black' : 'white';
    return game.currentTurn === myColor;
  }, [game]);

  return { game, loading, isMyTurn, applyOptimisticMove };
}
