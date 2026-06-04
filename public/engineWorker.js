const BOARD_SIZE = 6;
const TOTAL_PIECES = 8;
const WIN_LENGTH = 4;
const DIRECTIONS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function isValidPosition(r, c) { return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE; }

function checkForWin(board, player) {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] !== player) continue;
      for (const [dr, dc] of DIRECTIONS) {
        let count = 1;
        for (let step = 1; step < WIN_LENGTH; step++) {
          const nr = row + dr * step, nc = col + dc * step;
          if (isValidPosition(nr, nc) && board[nr][nc] === player) count++;
          else break;
        }
        if (count === WIN_LENGTH) {
          const br = row + dr * WIN_LENGTH, bc = col + dc * WIN_LENGTH;
          const pr = row + dr * -1, pc = col + dc * -1;
          const beforeMatch = isValidPosition(pr, pc) && board[pr][pc] === player;
          const afterMatch = isValidPosition(br, bc) && board[br][bc] === player;
          if (!beforeMatch && !afterMatch) return true;
        }
      }
    }
  }
  return false;
}

function countPiecesOnBoard(board, player) {
  return board.reduce((sum, row) => sum + row.reduce((s, c) => s + (c === player ? 1 : 0), 0), 0);
}

function cloneBoard(board) { return board.map(r => [...r]); }

function evaluateBoard(board, player) {
  const opponent = player === 'black' ? 'white' : 'black';
  if (checkForWin(board, player)) return 10000;
  if (checkForWin(board, opponent)) return -10000;
  let score = 0;
  const center = (BOARD_SIZE - 1) / 2;
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

function getBotMoves(board, phase, player) {
  const moves = [];
  if (phase === 'placement') {
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        if (board[r][c] === null) moves.push({ to: { row: r, col: c } });
  } else {
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        if (board[r][c] === player)
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const tr = r + dr, tc = c + dc;
              if (isValidPosition(tr, tc) && board[tr][tc] === null)
                moves.push({ from: { row: r, col: c }, to: { row: tr, col: tc } });
            }
  }
  return moves;
}

function applyPlacementToBoard(board, player, pos) {
  const newBoard = cloneBoard(board);
  newBoard[pos.row][pos.col] = player;
  return newBoard;
}

function applyMovementToBoard(board, player, from, to) {
  const newBoard = cloneBoard(board);
  newBoard[to.row][to.col] = player;
  newBoard[from.row][from.col] = null;
  return newBoard;
}

function minimax(board, phase, player, depth, alpha, beta, maximizing) {
  const opponent = player === 'black' ? 'white' : 'black';
  const current = maximizing ? player : opponent;
  if (checkForWin(board, player)) return 10000 + depth;
  if (checkForWin(board, opponent)) return -10000 - depth;
  if (depth === 0) return evaluateBoard(board, player);
  const moves = getBotMoves(board, phase, current);
  if (moves.length === 0) return maximizing ? -9999 : 9999;

  moves.sort((a, b) => {
    const bA = a.from ? applyMovementToBoard(board, current, a.from, a.to) : applyPlacementToBoard(board, current, a.to);
    const bB = b.from ? applyMovementToBoard(board, current, b.from, b.to) : applyPlacementToBoard(board, current, b.to);
    return evaluateBoard(bB, player) - evaluateBoard(bA, player);
  });

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const nb = move.from ? applyMovementToBoard(board, current, move.from, move.to) : applyPlacementToBoard(board, current, move.to);
      const eval_ = minimax(nb, phase, player, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const nb = move.from ? applyMovementToBoard(board, current, move.from, move.to) : applyPlacementToBoard(board, current, move.to);
      const eval_ = minimax(nb, phase, player, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function engineFindBestMove(board, phase, player, maxDepth) {
  const moves = getBotMoves(board, phase, player);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];
  for (const move of moves) {
    const nb = move.from ? applyMovementToBoard(board, player, move.from, move.to) : applyPlacementToBoard(board, player, move.to);
    if (checkForWin(nb, player)) return move;
  }
  const opponent = player === 'black' ? 'white' : 'black';
  for (const move of moves) {
    let nb;
    if (phase === 'placement') { nb = cloneBoard(board); nb[move.to.row][move.to.col] = opponent; }
    else { nb = move.from ? applyMovementToBoard(board, opponent, move.from, move.to) : applyPlacementToBoard(board, opponent, move.to); }
    if (checkForWin(nb, opponent)) return move;
  }
  let bestMove = moves[0];
  let bestEval = -Infinity;
  const depth = Math.min(maxDepth, moves.length <= 5 ? 8 : moves.length <= 10 ? 6 : 4);
  for (const move of moves) {
    const nb = move.from ? applyMovementToBoard(board, player, move.from, move.to) : applyPlacementToBoard(board, player, move.to);
    const eval_ = minimax(nb, phase, player, depth - 1, -Infinity, Infinity, false);
    if (eval_ > bestEval) { bestEval = eval_; bestMove = move; }
  }
  return bestMove;
}

function analyzeMove(board, phase, move, playerColor, maxDepth) {
  const beforeEval = evaluateBoard(board, playerColor);
  const engineMove = engineFindBestMove(board, phase, playerColor, maxDepth);
  let bestEval = beforeEval;
  if (engineMove) {
    const nb = engineMove.from ? applyMovementToBoard(board, playerColor, engineMove.from, engineMove.to) : applyPlacementToBoard(board, playerColor, engineMove.to);
    bestEval = evaluateBoard(nb, playerColor);
  }
  const afterBoard = move.from ? applyMovementToBoard(board, playerColor, move.from, move.to) : applyPlacementToBoard(board, playerColor, move.to);
  const afterEval = evaluateBoard(afterBoard, playerColor);
  const cpLoss = Math.max(0, bestEval - afterEval);
  let classification = 'book';
  if (cpLoss === 0) classification = 'best';
  else if (cpLoss <= 15) classification = 'excellent';
  else if (cpLoss <= 50) classification = 'good';
  else if (cpLoss <= 150) classification = 'inaccuracy';
  else if (cpLoss <= 400) classification = 'mistake';
  else classification = 'blunder';
  return { classification, cpLoss, engineMove, beforeEval, bestEval, afterEval };
}

self.onmessage = function(e) {
  const { type, moves, playerColor, maxDepth } = e.data;

  if (type === 'analyze') {
    const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    let phase = 'placement';
    const moveAnalysis = [];
    let totalCpLoss = 0;
    let excellentCount = 0, goodCount = 0, inaccuracyCount = 0, mistakeCount = 0, blunderCount = 0;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      if (move.player !== playerColor) {
        if (phase === 'placement') { board[move.to.row][move.to.col] = move.player; const bp = board.flat().filter(c => c === 'black').length; const wp = board.flat().filter(c => c === 'white').length; if (bp >= TOTAL_PIECES && wp >= TOTAL_PIECES) phase = 'movement'; }
        else { board[move.to.row][move.to.col] = move.player; if (move.from) board[move.from.row][move.from.col] = null; }
        continue;
      }

      const result = analyzeMove(board, phase, move, playerColor, maxDepth || 10);

      if (result.classification === 'best' || result.classification === 'excellent') excellentCount++;
      else if (result.classification === 'good') goodCount++;
      else if (result.classification === 'inaccuracy') inaccuracyCount++;
      else if (result.classification === 'mistake') mistakeCount++;
      else blunderCount++;
      totalCpLoss += result.cpLoss;

      moveAnalysis.push({
        moveNumber: move.moveNumber || i + 1,
        player: move.player,
        from: move.from || null,
        to: move.to,
        classification: result.classification,
        cpLoss: result.cpLoss,
        engineMove: result.engineMove ? { from: result.engineMove.from || null, to: result.engineMove.to } : null,
        beforeEval: result.beforeEval,
        bestEval: result.bestEval,
        afterEval: result.afterEval,
      });

      if (phase === 'placement') { board[move.to.row][move.to.col] = move.player; const bp = board.flat().filter(c => c === 'black').length; const wp = board.flat().filter(c => c === 'white').length; if (bp >= TOTAL_PIECES && wp >= TOTAL_PIECES) phase = 'movement'; }
      else { board[move.to.row][move.to.col] = move.player; if (move.from) board[move.from.row][move.from.col] = null; }

      if (i % 2 === 0) {
        self.postMessage({ type: 'progress', current: i + 1, total: moves.length });
      }
    }

    const totalPlayerMoves = moveAnalysis.length;
    let accuracy = 100;
    if (totalPlayerMoves > 0) {
      const avgCpLoss = totalCpLoss / totalPlayerMoves;
      accuracy = Math.max(0, Math.min(100, Math.round(100 - avgCpLoss * 0.15)));
    }

    self.postMessage({ type: 'result', accuracy, moveAnalysis, totalPlayerMoves, excellentCount, goodCount, inaccuracyCount, mistakeCount, blunderCount });
  }

  if (type === 'bestMove') {
    const { board: boardData, phase, player, depth } = e.data;
    const move = engineFindBestMove(boardData, phase, player, depth || 10);
    self.postMessage({ type: 'bestMove', move });
  }
};
