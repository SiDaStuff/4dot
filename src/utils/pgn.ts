import type { Move } from '../types';

function posToNotation(pos: { row: number; col: number }): string {
  return `${String.fromCharCode(97 + pos.col)}${6 - pos.row}`;
}

export function movesToPGN(moves: Move[], blackPlayer?: string, whitePlayer?: string, result?: string): string {
  const lines: string[] = [];
  if (blackPlayer || whitePlayer) {
    lines.push(`[Black "${blackPlayer || 'Black'}"]`);
    lines.push(`[White "${whitePlayer || 'White'}"]`);
  }
  if (result) {
    lines.push(`[Result "${result}"]`);
  }
  if (lines.length > 0) lines.push('');

  const moveTexts: string[] = [];
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move.player === 'black' && (i === 0 || moves[i - 1].player === 'white')) {
      moveTexts.push(`${Math.floor(i / 2) + 1}...`);
    }
    if (move.player === 'white' || (move.player === 'black' && i === 0)) {
      if (i === 0 || moves[i - 1].player === 'white') {
        moveTexts.push(`${Math.floor(i / 2) + 1}.`);
      } else if (i > 0 && moves[i - 1].player === 'black') {
        moveTexts.push(`${Math.floor(i / 2) + 1}.`);
      }
    }
    const fromStr = move.from ? `${posToNotation(move.from)}` : '';
    const toStr = posToNotation(move.to);
    moveTexts.push(move.from ? `${fromStr}-${toStr}` : toStr);
  }

  lines.push(moveTexts.join(' '));
  return lines.join('\n');
}

export function parsePGN(pgn: string): { moves: Move[]; blackPlayer: string; whitePlayer: string; result: string } | { error: string } {
  const lines = pgn.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let blackPlayer = 'Black';
  let whitePlayer = 'White';
  let result = '*';
  const moveLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('[')) {
      const match = line.match(/\[(\w+)\s+"(.*)"\]/);
      if (match) {
        const [, key, value] = match;
        if (key === 'Black') blackPlayer = value;
        else if (key === 'White') whitePlayer = value;
        else if (key === 'Result') result = value;
      }
    } else {
      moveLines.push(line);
    }
  }

  const moveText = moveLines.join(' ').replace(/\d+\.{1,3}\s*/g, '').replace(/\.{3}\s*/g, '');
  const tokens = moveText.split(/\s+/).filter(t => t.length > 0 && t !== '*' && t !== '1-0' && t !== '0-1' && t !== '1/2-1/2');

  const moves: Move[] = [];
  let currentTurn: 'black' | 'white' = 'black';
  let moveNumber = 1;

  for (const token of tokens) {
    let from: { row: number; col: number } | undefined;
    let to: { row: number; col: number };

    if (token.includes('-')) {
      const parts = token.split('-');
      if (parts.length !== 2) return { error: `Invalid move token: ${token}` };
      const fromParsed = notationToPos(parts[0]);
      const toParsed = notationToPos(parts[1]);
      if (!fromParsed || !toParsed) return { error: `Invalid notation in: ${token}` };
      from = fromParsed;
      to = toParsed;
    } else {
      const toParsed = notationToPos(token);
      if (!toParsed) return { error: `Invalid notation: ${token}` };
      to = toParsed;
    }

    moves.push({
      player: currentTurn,
      from,
      to,
      timestamp: Date.now(),
      moveNumber,
    });

    moveNumber++;
    currentTurn = currentTurn === 'black' ? 'white' : 'black';
  }

  return { moves, blackPlayer, whitePlayer, result };
}

function notationToPos(notation: string): { row: number; col: number } | null {
  if (!notation || notation.length < 2) return null;
  const col = notation.charCodeAt(0) - 97;
  const rowStr = notation.slice(1);
  const row = 6 - parseInt(rowStr, 10);
  if (col < 0 || col >= 6 || row < 0 || row >= 6) return null;
  return { row, col };
}

export function downloadPGN(moves: Move[], blackPlayer?: string, whitePlayer?: string, result?: string, filename?: string) {
  const pgn = movesToPGN(moves, blackPlayer, whitePlayer, result);
  const blob = new Blob([pgn], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `4dot_game_${Date.now()}.pgn`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
