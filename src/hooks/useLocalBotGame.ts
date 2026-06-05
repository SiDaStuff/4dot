import { useState, useCallback, useRef } from 'react';
import { getWinLine } from '../utils/boardUtils';
import { cloneBoard, countPiecesOnBoard, checkForWin } from '../utils/boardUtils';
import { TOTAL_PIECES } from '../types';
import type { Game, CellOwner, Position } from '../types';
import { createBotGameState, applyBotMove, engineFindBestMove, type BotStrength } from '../utils/botEngine';

const BOT_NAMES: Record<string, string> = {
  easy: '4dot Engine (Easy)',
  medium: '4dot Engine (Medium)',
  hard: '4dot Engine (Hard)',
  stockfish: '4dot Engine MAX',
};

const DEFAULT_TIME_MS = 3 * 60 * 1000;

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

export function useLocalBotGame(strength: BotStrength = 'hard') {
  const [game, setGame] = useState<Game | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef<ReturnType<typeof createBotGameState> | null>(null);

  const startBotGame = useCallback((playerRating: number = 1500, playerUsername: string = 'Player') => {
    const initialState = createBotGameState();
    gameStateRef.current = initialState;
    const gameData: Game = {
      id: `bot_${Date.now()}`,
      whitePlayer: { uid: 'local', username: playerUsername, rating: playerRating, ratingDeviation: 350, piecesPlaced: 0 },
      blackPlayer: { uid: 'bot', username: BOT_NAMES[strength] || '4dot Engine', rating: 1500, ratingDeviation: 350, piecesPlaced: 0 },
      board: initialState.board,
      currentTurn: initialState.currentTurn,
      phase: initialState.phase,
      mode: 'casual',
      moves: [],
      status: 'active',
      clock: { black: DEFAULT_TIME_MS, white: DEFAULT_TIME_MS },
      lastMoveTimestamp: Date.now(),
      createdAt: Date.now(),
      spectators: 0,
      positionHistory: [],
    };
    setGame(gameData);
    return gameData.id;
  }, [strength]);

  const executeBotMove = useCallback((currentState: ReturnType<typeof createBotGameState>, currentGame: Game) => {
    const botMove = engineFindBestMove(currentState, 'black', strength);
    if (!botMove) return;

    const result = applyBotMove(currentState, 'black', botMove.from, botMove.to);
    if (result.error) return;

    const timeElapsed = Date.now() - (currentGame.lastMoveTimestamp || Date.now());
    const newClock = { ...currentGame.clock, black: Math.max(0, currentGame.clock.black - timeElapsed) };

    if (newClock.black <= 0) {
      setGame(prev => {
        if (!prev) return prev;
        return { ...prev, status: 'finished', result: { winner: 'white', method: 'timeout', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: prev.blackPlayer.rating, whiteRating: prev.whitePlayer.rating }, clock: newClock };
      });
      return;
    }

    if (result.gameOver) {
      const method = result.draw
        ? (currentState.phase === 'movement' && currentState.moves.length >= 100 ? '100-ply' : 'threefold-repetition')
        : 'four-in-a-row';
      setGame(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          board: currentState.board,
          currentTurn: currentState.currentTurn,
          phase: currentState.phase,
          moves: [...currentState.moves],
          positionHistory: [...currentState.positionHistory],
          clock: newClock,
          lastMoveTimestamp: Date.now(),
          status: 'finished',
          result: { winner: result.draw ? 'draw' : result.winner, method, ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: prev.blackPlayer.rating, whiteRating: prev.whitePlayer.rating },
        };
      });
      return;
    }

    setGame(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        board: currentState.board,
        currentTurn: currentState.currentTurn,
        phase: currentState.phase,
        moves: [...currentState.moves],
        positionHistory: [...currentState.positionHistory],
        clock: newClock,
        lastMoveTimestamp: Date.now(),
      };
    });

    if (currentState.currentTurn === 'white') {
      startWhiteClock();
    }
  }, [strength]);

  const startWhiteClock = useCallback(() => {
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
  }, []);

  const makePlayerMove = useCallback(async (from: Position | undefined, to: Position) => {
    if (!gameStateRef.current || moveLoading) return { error: 'Loading' };
    const state = gameStateRef.current;

    if (state.gameOver || state.currentTurn !== 'white') return { error: 'Not your turn' };

    const result = applyBotMove(state, 'white', from, to);
    if (result.error) return { error: result.error };

    const timeElapsed = Date.now() - (game?.lastMoveTimestamp || Date.now());
    const newClock = game ? { ...game.clock, white: Math.max(0, game.clock.white - timeElapsed) } : { black: DEFAULT_TIME_MS, white: DEFAULT_TIME_MS };

    if (newClock.white <= 0) {
      setGame(prev => {
        if (!prev) return prev;
        return { ...prev, status: 'finished', result: { winner: 'black', method: 'timeout', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: prev.blackPlayer.rating, whiteRating: prev.whitePlayer.rating }, clock: newClock };
      });
      return { gameOver: true, result: { winner: 'black', method: 'timeout' } };
    }

    if (result.gameOver) {
      const method = result.draw
        ? (state.phase === 'movement' && state.moves.length >= 100 ? '100-ply' : 'threefold-repetition')
        : 'four-in-a-row';
      setGame(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          board: state.board,
          currentTurn: state.currentTurn,
          phase: state.phase,
          moves: [...state.moves],
          positionHistory: [...state.positionHistory],
          clock: newClock,
          lastMoveTimestamp: Date.now(),
          status: 'finished',
          result: { winner: result.draw ? 'draw' : result.winner, method, ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: prev.blackPlayer.rating, whiteRating: prev.whitePlayer.rating },
        };
      });
      return { gameOver: true, result: { winner: result.draw ? 'draw' : result.winner, method } };
    }

    setGame(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        board: state.board,
        currentTurn: state.currentTurn,
        phase: state.phase,
        moves: [...state.moves],
        positionHistory: [...state.positionHistory],
        clock: newClock,
        lastMoveTimestamp: Date.now(),
      };
    });

    setMoveLoading(true);
    setTimeout(() => {
      if (gameStateRef.current) {
        const currentGame = { ...game!, clock: newClock, lastMoveTimestamp: Date.now() };
        executeBotMove(gameStateRef.current, currentGame);
      }
      setMoveLoading(false);
    }, 300);

    return { gameOver: false };
  }, [game, moveLoading, executeBotMove]);

  const resignBotGame = useCallback(() => {
    if (!game) return;
    setGame(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        status: 'finished',
        result: { winner: 'black', method: 'resign', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: prev.blackPlayer.rating, whiteRating: prev.whitePlayer.rating },
      };
    });
    gameStateRef.current = null;
  }, [game]);

  const winLine = game?.status === 'finished' && game.result && game.result.winner !== 'draw'
    ? getWinLine(game.board, game.result.winner as CellOwner) : null;

  return { game, loading: false, moveLoading, makePlayerMove, resignBotGame, winLine, startBotGame };
}
