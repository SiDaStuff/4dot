import {
  BOARD_SIZE,
  TOTAL_PIECES,
  MAX_PLY,
  type CellOwner,
  type Position,
  type Move,
  type Game,
  type GamePhase,
} from '../types';
import {
  cloneBoard,
  checkForWin,
  countPiecesOnBoard,
  isValidKingMove,
  boardToString,
} from './boardUtils';

const WIN_LENGTH = 4;

export function createInitialGameState(): Pick<Game, 'board' | 'currentTurn' | 'phase' | 'moves' | 'positionHistory'> {
  return {
    board: Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => null)
    ),
    currentTurn: 'black',
    phase: 'placement',
    moves: [],
    positionHistory: [],
  };
}

export function validatePlacement(
  board: CellOwner[][],
  player: CellOwner,
  position: Position
): string | null {
  if (!player) return 'Invalid player';
  if (board[position.row][position.col] !== null) return 'Cell is already occupied';
  const placed = countPiecesOnBoard(board, player);
  if (placed >= TOTAL_PIECES) return 'All pieces already placed';
  return null;
}

export function validateMovement(
  board: CellOwner[][],
  player: CellOwner,
  from: Position,
  to: Position
): string | null {
  if (!player) return 'Invalid player';
  if (board[from.row][from.col] !== player) return 'No piece at source position';
  if (board[to.row][to.col] !== null) return 'Destination cell is occupied';
  if (!isValidKingMove(from, to)) return 'Invalid move: pieces move like a king (one step in any direction)';
  return null;
}

export function applyPlacement(
  state: Pick<Game, 'board' | 'currentTurn' | 'phase' | 'moves' | 'positionHistory'>,
  player: CellOwner,
  position: Position
): { gameOver: boolean; winner?: CellOwner } | { error: string } {
  const error = validatePlacement(state.board, player, position);
  if (error) return { error };

  const newBoard = cloneBoard(state.board);
  newBoard[position.row][position.col] = player;

  if (checkForWin(newBoard, player)) {
    state.board = newBoard;
    return { gameOver: true, winner: player };
  }

  const blackPlaced = countPiecesOnBoard(newBoard, 'black');
  const whitePlaced = countPiecesOnBoard(newBoard, 'white');

  const nextTurn: CellOwner = player === 'black' ? 'white' : 'black';

  state.board = newBoard;
  state.currentTurn = nextTurn;

  if (blackPlaced >= TOTAL_PIECES && whitePlaced >= TOTAL_PIECES) {
    state.phase = 'movement';
  }

  return { gameOver: false };
}

export function applyMovement(
  state: Pick<Game, 'board' | 'currentTurn' | 'phase' | 'moves' | 'positionHistory'>,
  player: CellOwner,
  from: Position,
  to: Position
): { gameOver: boolean; winner?: CellOwner } | { error: string } {
  const error = validateMovement(state.board, player, from, to);
  if (error) return { error };

  const newBoard = cloneBoard(state.board);
  newBoard[to.row][to.col] = player;
  newBoard[from.row][from.col] = null;

  if (checkForWin(newBoard, player)) {
    state.board = newBoard;
    return { gameOver: true, winner: player };
  }

  const nextTurn: CellOwner = player === 'black' ? 'white' : 'black';
  state.board = newBoard;
  state.currentTurn = nextTurn;

  return { gameOver: false };
}

export function checkDraw(
  positionHistory: string[],
  board: CellOwner[][],
  currentTurn: CellOwner,
  phase: GamePhase,
  moveCount: number
): boolean {
  if (phase === 'movement' && moveCount >= MAX_PLY) return true;
  const key = `${boardToString(board)}-${currentTurn}`;
  const count = positionHistory.filter((p) => p === key).length;
  return count >= 3;
}

export function applyMove(
  state: Pick<Game, 'board' | 'currentTurn' | 'phase' | 'moves' | 'positionHistory'>,
  player: CellOwner,
  from: Position | undefined,
  to: Position
): { gameOver: boolean; winner?: CellOwner; draw?: boolean } | { error: string } {
  if (player !== state.currentTurn) return { error: 'Not your turn' };

  const result = state.phase === 'placement'
    ? applyPlacement(state, player, to)
    : applyMovement(state, player, from!, to);

  if ('error' in result) return result;

  const stateKey = `${boardToString(state.board)}-${state.currentTurn}`;
  state.positionHistory = [...state.positionHistory, stateKey];
  state.moves = [...state.moves, {
    player,
    from,
    to,
    timestamp: Date.now(),
    moveNumber: state.moves.length + 1,
  }];

  if (result.gameOver) return result;

  const draw = checkDraw(
    state.positionHistory,
    state.board,
    state.currentTurn,
    state.phase,
    state.moves.length
  );

  if (draw) return { gameOver: true, draw: true };

  return { gameOver: false };
}

export function evaluateBoard(board: CellOwner[][], player: CellOwner): number {
  const opponent: CellOwner = player === 'black' ? 'white' : 'black';
  if (checkForWin(board, player)) return 10000;
  if (checkForWin(board, opponent)) return -10000;

  const DIRECTIONS: [number, number][] = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];

  let score = 0;
  const center = (BOARD_SIZE - 1) / 2;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === player) {
        score += 10;
        score += Math.round((BOARD_SIZE - 1) - Math.abs(r - center) - Math.abs(c - center));
        for (const [dr, dc] of DIRECTIONS) {
          let count = 1;
          for (let step = 1; step < WIN_LENGTH; step++) {
            const nr = r + dr * step, nc = c + dc * step;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) count++;
            else break;
          }
          if (count >= 2) {
            const pr = r + dr * -1, pc = c + dc * -1;
            const openBefore = pr >= 0 && pr < BOARD_SIZE && pc >= 0 && pc < BOARD_SIZE && board[pr][pc] === null;
            let openAfter = false;
            const ar = r + dr * count, ac = c + dc * count;
            if (ar >= 0 && ar < BOARD_SIZE && ac >= 0 && ac < BOARD_SIZE && board[ar][ac] === null) openAfter = true;
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
        score -= Math.round((BOARD_SIZE - 1) - Math.abs(r - center) - Math.abs(c - center));
        for (const [dr, dc] of DIRECTIONS) {
          let count = 1;
          for (let step = 1; step < WIN_LENGTH; step++) {
            const nr = r + dr * step, nc = c + dc * step;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === opponent) count++;
            else break;
          }
          if (count >= 2) {
            const pr = r + dr * -1, pc = c + dc * -1;
            const openBefore = pr >= 0 && pr < BOARD_SIZE && pc >= 0 && pc < BOARD_SIZE && board[pr][pc] === null;
            let openAfter = false;
            const ar = r + dr * count, ac = c + dc * count;
            if (ar >= 0 && ar < BOARD_SIZE && ac >= 0 && ac < BOARD_SIZE && board[ar][ac] === null) openAfter = true;
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

export function getBotMoves(
  state: Pick<Game, 'board' | 'currentTurn' | 'phase' | 'moves' | 'positionHistory'>,
  player: CellOwner
): { from?: Position; to: Position }[] {
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
              if (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE && state.board[tr][tc] === null)
                moves.push({ from: { row: r, col: c }, to: { row: tr, col: tc } });
            }
  }
  return moves;
}

export function minimax(
  state: Pick<Game, 'board' | 'currentTurn' | 'phase' | 'moves' | 'positionHistory'>,
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

  moves.sort((a, b) => {
    const bA = cloneBoard(state.board);
    if (a.from) { bA[a.to.row][a.to.col] = current; bA[a.from.row][a.from.col] = null; }
    else bA[a.to.row][a.to.col] = current;
    const bB = cloneBoard(state.board);
    if (b.from) { bB[b.to.row][b.to.col] = current; bB[b.from.row][b.from.col] = null; }
    else bB[b.to.row][b.to.col] = current;
    return evaluateBoard(bB, player) - evaluateBoard(bA, player);
  });

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
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
      const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
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
  state: Pick<Game, 'board' | 'currentTurn' | 'phase' | 'moves' | 'positionHistory'>,
  player: CellOwner,
  maxDepth = 10
): { from?: Position; to: Position } | null {
  const moves = getBotMoves(state, player);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  for (const move of moves) {
    const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
    if (state.phase === 'placement') applyPlacement(ns, player, move.to);
    else applyMovement(ns, player, move.from!, move.to);
    if (checkForWin(ns.board, player)) return move;
  }

  const opponent: CellOwner = player === 'black' ? 'white' : 'black';
  for (const move of moves) {
    const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
    if (state.phase === 'placement') applyPlacement(ns, opponent, move.to);
    else {
      if (move.from) { ns.board[move.to.row][move.to.col] = opponent; ns.board[move.from.row][move.from.col] = null; }
    }
    if (checkForWin(ns.board, opponent)) return move;
  }

  let bestMove = moves[0];
  let bestEval = -Infinity;
  const depth = Math.min(maxDepth, moves.length <= 5 ? 8 : moves.length <= 10 ? 6 : 4);

  for (const move of moves) {
    const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
    if (state.phase === 'placement') applyPlacement(ns, player, move.to);
    else applyMovement(ns, player, move.from!, move.to);
    ns.currentTurn = opponent;
    const eval_ = minimax(ns, player, depth - 1, -Infinity, Infinity, false);
    if (eval_ > bestEval) { bestEval = eval_; bestMove = move; }
  }
  return bestMove;
}
