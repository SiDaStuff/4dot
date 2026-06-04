import {
  BOARD_SIZE,
  TOTAL_PIECES,
  DIRECTIONS,
  type CellOwner,
  type Position,
  type Game,
  type Move,
} from '../types';
import {
  cloneBoard,
  checkForWin,
  countPiecesOnBoard,
  isValidKingMove,
} from './boardUtils';

const WIN_LENGTH = 4;

export type BotStrength = 'easy' | 'medium' | 'hard' | 'stockfish';

const STRENGTH_DEPTH: Record<BotStrength, number> = {
  easy: 1,
  medium: 3,
  hard: 6,
  stockfish: 10,
};

export interface BotGameState {
  board: CellOwner[][];
  currentTurn: 'black' | 'white';
  phase: 'placement' | 'movement';
  moves: Move[];
  positionHistory: string[];
  gameOver: boolean;
  winner?: CellOwner;
  draw?: boolean;
}

export function createBotGameState(): BotGameState {
  return {
    board: Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => null)
    ),
    currentTurn: 'white',
    phase: 'placement',
    moves: [],
    positionHistory: [],
    gameOver: false,
  };
}

function isValidPosition(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function validatePlacement(board: CellOwner[][], player: CellOwner, position: Position): string | null {
  if (!player) return 'Invalid player';
  if (board[position.row][position.col] !== null) return 'Cell occupied';
  if (countPiecesOnBoard(board, player) >= TOTAL_PIECES) return 'All pieces placed';
  return null;
}

function validateMovement(board: CellOwner[][], player: CellOwner, from: Position, to: Position): string | null {
  if (!player) return 'Invalid player';
  if (board[from.row][from.col] !== player) return 'No piece at source';
  if (board[to.row][to.col] !== null) return 'Destination occupied';
  if (!isValidKingMove(from, to)) return 'Invalid move';
  return null;
}

function applyPlacement(state: BotGameState, player: CellOwner, position: Position) {
  const error = validatePlacement(state.board, player, position);
  if (error) return { error };
  const newBoard = cloneBoard(state.board);
  newBoard[position.row][position.col] = player;
  if (checkForWin(newBoard, player)) {
    state.board = newBoard;
    return { gameOver: true, winner: player };
  }
  state.board = newBoard;
  state.currentTurn = player === 'black' ? 'white' : 'black';
  if (countPiecesOnBoard(newBoard, 'black') >= TOTAL_PIECES && countPiecesOnBoard(newBoard, 'white') >= TOTAL_PIECES) {
    state.phase = 'movement';
  }
  return { gameOver: false };
}

function applyMovement(state: BotGameState, player: CellOwner, from: Position, to: Position) {
  const error = validateMovement(state.board, player, from, to);
  if (error) return { error };
  const newBoard = cloneBoard(state.board);
  newBoard[to.row][to.col] = player;
  newBoard[from.row][from.col] = null;
  if (checkForWin(newBoard, player)) {
    state.board = newBoard;
    return { gameOver: true, winner: player };
  }
  state.board = newBoard;
  state.currentTurn = player === 'black' ? 'white' : 'black';
  return { gameOver: false };
}

function boardStr(board: CellOwner[][]): string {
  return board.map(row => row.map(c => c ? c[0] : '.').join('')).join('/');
}

export function applyBotMove(
  state: BotGameState,
  player: CellOwner,
  from: Position | undefined,
  to: Position
): { error?: string; gameOver?: boolean; winner?: CellOwner; draw?: boolean } {
  if (player !== state.currentTurn) return { error: 'Not your turn' };
  if (state.gameOver) return { error: 'Game over' };

  const result = state.phase === 'placement'
    ? applyPlacement(state, player, to)
    : applyMovement(state, player, from!, to);

  if ('error' in result) return result;

  state.positionHistory = [...state.positionHistory, `${boardStr(state.board)}-${state.currentTurn}`];
  state.moves = [...state.moves, {
    player,
    from,
    to,
    timestamp: Date.now(),
    moveNumber: state.moves.length + 1,
  }];

  if (result.gameOver) {
    state.gameOver = true;
    state.winner = result.winner;
    return result;
  }

  const key = `${boardStr(state.board)}-${state.currentTurn}`;
  const reps = state.positionHistory.filter(p => p === key).length;
  if (state.phase === 'movement' && state.moves.length >= 100) {
    state.gameOver = true;
    state.draw = true;
    return { gameOver: true, draw: true };
  }
  if (reps >= 3) {
    state.gameOver = true;
    state.draw = true;
    return { gameOver: true, draw: true };
  }

  return { gameOver: false };
}

function evaluateBoard(board: CellOwner[][], player: CellOwner): number {
  const opponent: CellOwner = player === 'black' ? 'white' : 'black';
  if (checkForWin(board, player)) return 10000;
  if (checkForWin(board, opponent)) return -10000;
  const center = (BOARD_SIZE - 1) / 2;
  let score = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === player) {
        score += 10;
        score += Math.round(center - Math.abs(r - center) - Math.abs(c - center));
        for (const [dr, dc] of DIRECTIONS) {
          let count = 1;
          for (let step = 1; step < WIN_LENGTH; step++) {
            const nr = r + dr * step, nc = c + dc * step;
            if (isValidPosition(nr, nc) && board[nr][nc] === player) count++;
            else break;
          }
          if (count >= 2) {
            const pr = r + dr * -1, pc = c + dc * -1;
            const openBefore = isValidPosition(pr, pc) && board[pr][pc] === null;
            const ar = r + dr * count, ac = c + dc * count;
            const openAfter = isValidPosition(ar, ac) && board[ar][ac] === null;
            if (count === 3) {
              if (openBefore && openAfter) score += 200;
              else if (openBefore || openAfter) score += 80;
            } else if (count === 2) {
              if (openBefore && openAfter) score += 30;
              else if (openBefore || openAfter) score += 10;
            }
          }
        }
      }
      if (board[r][c] === opponent) {
        score -= 10;
        score -= Math.round(center - Math.abs(r - center) - Math.abs(c - center));
        for (const [dr, dc] of DIRECTIONS) {
          let count = 1;
          for (let step = 1; step < WIN_LENGTH; step++) {
            const nr = r + dr * step, nc = c + dc * step;
            if (isValidPosition(nr, nc) && board[nr][nc] === opponent) count++;
            else break;
          }
          if (count >= 2) {
            const pr = r + dr * -1, pc = c + dc * -1;
            const openBefore = isValidPosition(pr, pc) && board[pr][pc] === null;
            const ar = r + dr * count, ac = c + dc * count;
            const openAfter = isValidPosition(ar, ac) && board[ar][ac] === null;
            if (count === 3) {
              if (openBefore && openAfter) score -= 200;
              else if (openBefore || openAfter) score -= 80;
            } else if (count === 2) {
              if (openBefore && openAfter) score -= 30;
              else if (openBefore || openAfter) score -= 10;
            }
          }
        }
      }
    }
  }
  return score;
}

function getBotMoves(state: BotGameState, player: CellOwner): { from?: Position; to: Position }[] {
  const moves: { from?: Position; to: Position }[] = [];
  if (state.phase === 'placement') {
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        if (state.board[r][c] === null) moves.push({ to: { row: r, col: c } });
  } else {
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        if (state.board[r][c] === player)
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const tr = r + dr, tc = c + dc;
              if (isValidPosition(tr, tc) && state.board[tr][tc] === null)
                moves.push({ from: { row: r, col: c }, to: { row: tr, col: tc } });
            }
  }
  return moves;
}

function minimax(
  state: BotGameState,
  player: CellOwner,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean
): number {
  const opponent: CellOwner = player === 'black' ? 'white' : 'black';
  const current = maximizing ? player : opponent;
  if (checkForWin(state.board, player)) return 10000 + depth;
  if (checkForWin(state.board, opponent)) return -10000 - depth;
  if (depth === 0) return evaluateBoard(state.board, player);

  const moves = getBotMoves(state, current);
  if (moves.length === 0) return maximizing ? -9999 : 9999;

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const ns: BotGameState = {
        board: cloneBoard(state.board), currentTurn: state.currentTurn,
        phase: state.phase, moves: state.moves, positionHistory: state.positionHistory,
        gameOver: false,
      };
      if (state.phase === 'placement') applyPlacement(ns, current, move.to);
      else applyMovement(ns, current, move.from!, move.to);
      ns.currentTurn = current === 'black' ? 'white' : 'black';
      const eval_ = minimax(ns, player, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const ns: BotGameState = {
        board: cloneBoard(state.board), currentTurn: state.currentTurn,
        phase: state.phase, moves: state.moves, positionHistory: state.positionHistory,
        gameOver: false,
      };
      if (state.phase === 'placement') applyPlacement(ns, current, move.to);
      else applyMovement(ns, current, move.from!, move.to);
      ns.currentTurn = current === 'black' ? 'white' : 'black';
      const eval_ = minimax(ns, player, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export function engineFindBestMove(
  state: BotGameState,
  player: CellOwner,
  strength: BotStrength
): { from?: Position; to: Position } | null {
  const maxDepth = STRENGTH_DEPTH[strength];
  const moves = getBotMoves(state, player);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  if (strength === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  for (const move of moves) {
    const ns: BotGameState = {
      board: cloneBoard(state.board), currentTurn: state.currentTurn,
      phase: state.phase, moves: state.moves, positionHistory: state.positionHistory,
      gameOver: false,
    };
    if (state.phase === 'placement') applyPlacement(ns, player, move.to);
    else applyMovement(ns, player, move.from!, move.to);
    if (checkForWin(ns.board, player)) return move;
  }

  const opponent: CellOwner = player === 'black' ? 'white' : 'black';
  for (const move of moves) {
    const ns: BotGameState = {
      board: cloneBoard(state.board), currentTurn: state.currentTurn,
      phase: state.phase, moves: state.moves, positionHistory: state.positionHistory,
      gameOver: false,
    };
    if (state.phase === 'placement') { ns.board[move.to.row][move.to.col] = opponent; }
    else { if (move.from) { ns.board[move.to.row][move.to.col] = opponent; ns.board[move.from.row][move.from.col] = null; } }
    if (checkForWin(ns.board, opponent)) return move;
  }

  let bestMove = moves[0];
  let bestEval = -Infinity;
  const depth = Math.min(maxDepth, moves.length <= 5 ? maxDepth : moves.length <= 10 ? Math.min(maxDepth, 6) : Math.min(maxDepth, 4));

  for (const move of moves) {
    const ns: BotGameState = {
      board: cloneBoard(state.board), currentTurn: state.currentTurn,
      phase: state.phase, moves: state.moves, positionHistory: state.positionHistory,
      gameOver: false,
    };
    if (state.phase === 'placement') applyPlacement(ns, player, move.to);
    else applyMovement(ns, player, move.from!, move.to);
    ns.currentTurn = opponent;
    const eval_ = minimax(ns, player, depth - 1, -Infinity, Infinity, false);
    if (eval_ > bestEval) { bestEval = eval_; bestMove = move; }
  }
  return bestMove;
}
