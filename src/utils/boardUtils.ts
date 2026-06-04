import { BOARD_SIZE, DIRECTIONS, type CellOwner, type Position } from '../types';

const WIN_LENGTH = 4;

export function createEmptyBoard(): CellOwner[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

export function cloneBoard(board: CellOwner[][]): CellOwner[][] {
  return board.map((row) => [...row]);
}

export function isValidPosition(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function getAdjacentPositions(pos: Position): Position[] {
  return DIRECTIONS
    .map(([dr, dc]) => ({ row: pos.row + dr, col: pos.col + dc }))
    .filter((p) => isValidPosition(p.row, p.col));
}

export function boardToString(board: CellOwner[][]): string {
  return board.map((row) => row.map((c) => c?.[0] ?? '.').join('')).join('/');
}

export function checkForWin(board: CellOwner[][], player: CellOwner): boolean {
  if (!player || !board || !board.length) return false;

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!board[row] || board[row][col] !== player) continue;

      for (const [dr, dc] of DIRECTIONS) {
        let count = 1;
        for (let step = 1; step < WIN_LENGTH; step++) {
          const nr = row + dr * step;
          const nc = col + dc * step;
          if (isValidPosition(nr, nc) && board[nr][nc] === player) {
            count++;
          } else {
            break;
          }
        }
        if (count === WIN_LENGTH) {
          const beforeR = row + dr * -1;
          const beforeC = col + dc * -1;
          const afterR = row + dr * WIN_LENGTH;
          const afterC = col + dc * WIN_LENGTH;
          const beforeMatch = isValidPosition(beforeR, beforeC) && board[beforeR][beforeC] === player;
          const afterMatch = isValidPosition(afterR, afterC) && board[afterR][afterC] === player;
          if (!beforeMatch && !afterMatch) return true;
        }
      }
    }
  }
  return false;
}

export function getWinLine(board: CellOwner[][], player: CellOwner): Position[] | null {
  if (!player || !board || !board.length) return null;

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!board[row] || board[row][col] !== player) continue;

      for (const [dr, dc] of DIRECTIONS) {
        const positions: Position[] = [{ row, col }];
        for (let step = 1; step < WIN_LENGTH; step++) {
          const nr = row + dr * step;
          const nc = col + dc * step;
          if (isValidPosition(nr, nc) && board[nr][nc] === player) {
            positions.push({ row: nr, col: nc });
          } else {
            break;
          }
        }
        if (positions.length === WIN_LENGTH) {
          const beforeR = row + dr * -1;
          const beforeC = col + dc * -1;
          const afterR = row + dr * WIN_LENGTH;
          const afterC = col + dc * WIN_LENGTH;
          const beforeMatch = isValidPosition(beforeR, beforeC) && board[beforeR][beforeC] === player;
          const afterMatch = isValidPosition(afterR, afterC) && board[afterR][afterC] === player;
          if (!beforeMatch && !afterMatch) return positions;
        }
      }
    }
  }
  return null;
}

export function countPiecesOnBoard(board: CellOwner[][], player: CellOwner): number {
  return board.reduce((sum, row) =>
    sum + row.reduce((rowSum, cell) => rowSum + (cell === player ? 1 : 0), 0), 0);
}

export function isValidKingMove(from: Position, to: Position): boolean {
  const dr = Math.abs(to.row - from.row);
  const dc = Math.abs(to.col - from.col);
  return dr <= 1 && dc <= 1 && (dr + dc > 0);
}
