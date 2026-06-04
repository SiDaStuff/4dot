import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let credential;
try {
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  } else if (process.env.SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);
    if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    credential = admin.credential.cert(serviceAccount);
  } else {
    credential = admin.credential.applicationDefault();
  }
} catch (err) {
  credential = admin.credential.applicationDefault();
}

admin.initializeApp({ credential, databaseURL: process.env.VITE_FIREBASE_DATABASE_URL });

const db = admin.database();
const auth = admin.auth();

const ADMIN_EMAIL = 'sidamailbox@gmail.com';

function normalizeArrays(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeArrays);
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
      const maxIdx = Math.max(...keys.map(Number));
      if (maxIdx < keys.length * 2) {
        const arr = new Array(maxIdx + 1);
        for (let i = 0; i <= maxIdx; i++) arr[i] = normalizeArrays(obj[String(i)]);
        return arr;
      }
    }
    const result = {};
    for (const k of keys) result[k] = normalizeArrays(obj[k]);
    return result;
  }
  return obj;
}

function rtdbSafe(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(rtdbSafe);
  if (typeof obj === 'object') {
    const result = {};
    for (const k of Object.keys(obj)) {
      const v = rtdbSafe(obj[k]);
      if (v !== undefined) result[k] = v;
    }
    return result;
  }
  return obj;
}

async function rtdbGet(path) {
  const snap = await db.ref(path).once('value');
  return snap.exists() ? normalizeArrays(snap.val()) : null;
}

function encodeBoard(board) { return board.map(row => row.map(cell => cell === null ? 0 : cell)); }
function decodeBoard(board) { if (!board) return board; return board.map(row => row.map(cell => cell === 0 ? null : cell)); }

function encodeGameForStorage(gameData) {
  const data = { ...gameData };
  if (data.board) data.board = encodeBoard(data.board);
  return rtdbSafe(data);
}

function decodeGameFromStorage(gameData) {
  if (!gameData) return gameData;
  const data = normalizeArrays(gameData);
  if (data.board) data.board = decodeBoard(data.board);
  return data;
}

async function rtdbGetChild(path, key, value) {
  const snap = await db.ref(path).orderByChild(key).equalTo(value).once('value');
  if (!snap.exists()) return [];
  const results = [];
  snap.forEach(child => { results.push({ id: child.key, ...normalizeArrays(child.val()) }); });
  return results;
}

const app = express();
app.set('trust proxy', 1);
const allowedOrigins = [
  'http://localhost:3000','http://127.0.0.1:3000',
  'http://localhost:5173','http://127.0.0.1:5173',
  'https://4dot.sidastuff.com',
  'https://www.4dot.sidastuff.com',
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : []),
];
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(compression({
  filter: (req, res) => {
    if (req.path === '/api/events' || req.path === '/api/guest/events') return false;
    return compression.filter(req, res);
  },
}));
app.use(express.json());

const rateLimitDefaults = { standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false, trustProxy: false } };
const publicLimiter = rateLimit({ ...rateLimitDefaults, windowMs: 60 * 1000, max: 120, message: { error: 'Too many requests', retryAfter: 60 } });
const authLimiter = rateLimit({ ...rateLimitDefaults, windowMs: 60 * 1000, max: 300, message: { error: 'Too many requests', retryAfter: 60 } });
const moveLimiter = rateLimit({ ...rateLimitDefaults, windowMs: 60 * 1000, max: 600, message: { error: 'Too many requests', retryAfter: 60 } });

app.use('/api/leaderboard', publicLimiter);
app.use('/api/leaderboard', (req, res, next) => { res.set('Cache-Control', 'public, max-age=30'); next(); });
app.use('/api/active-games', publicLimiter);
app.use('/api/active-games', (req, res, next) => { res.set('Cache-Control', 'public, max-age=10'); next(); });
app.use('/api/ban-check/', publicLimiter);
app.use('/api/events', authLimiter);
app.use('/api/game/', moveLimiter);
app.use('/api/matchmaking/', authLimiter);
app.use('/api/bot/', authLimiter);
app.use('/api/admin/', authLimiter);
app.use('/api/profile', authLimiter);
app.use('/api/friends', authLimiter);
app.use('/api/internal-action', authLimiter);
app.use('/api/ban-status', authLimiter);
app.use('/api/challenge', publicLimiter);
app.use('/api/guest', publicLimiter);
app.use('/api/notifications', authLimiter);
app.use('/api/game-history', authLimiter);
app.use('/api/game-history', (req, res, next) => { res.set('Cache-Control', 'private, max-age=10'); next(); });
app.use('/api/opponent-stats', authLimiter);
app.use('/api/opponent-stats', (req, res, next) => { res.set('Cache-Control', 'private, max-age=30'); next(); });
app.use('/api/rating-history', authLimiter);
app.use('/api/rating-history', (req, res, next) => { res.set('Cache-Control', 'private, max-age=30'); next(); });
app.use('/api/game-review', authLimiter);
app.use('/api/activity-feed', authLimiter);
app.use('/api/activity-feed', (req, res, next) => { res.set('Cache-Control', 'private, max-age=10'); next(); });
app.use('/api/profile', authLimiter);

const publicPaths = ['/api/leaderboard', '/api/active-games'];
const publicPathPrefixes = ['/api/ban-check/', '/api/challenge/info/', '/api/challenge/accept/', '/api/guest/events', '/api/game/', '/api/profile/public/'];

const lastUserActivityUpdate = new Map();
app.use((req, res, next) => {
  const isPublicGet = req.method === 'GET' && (publicPaths.includes(req.path) || publicPathPrefixes.some(p => req.path.startsWith(p)));
  const isPublicPost = req.method === 'POST' && publicPathPrefixes.some(p => req.path.startsWith(p));
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : queryToken;

  if (!idToken) {
    if (isPublicGet || isPublicPost) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  }

  admin.auth().verifyIdToken(idToken)
  .then(async (decoded) => {
    const banStatus = await getBanStatus(decoded.uid);
    if (banStatus.banned) {
      if (banStatus.permanent) return res.status(403).json({ error: 'Account permanently banned', banReason: banStatus.reason || 'Cheating', permanent: true });
      if (banStatus.until) {
        const remaining = Math.ceil((banStatus.until - Date.now()) / 60000);
        return res.status(403).json({ error: `Account suspended for ${remaining} more minutes`, banReason: banStatus.reason || 'Suspicious activity', until: banStatus.until });
      }
    }

    const lastUpdate = lastUserActivityUpdate.get(decoded.uid);
    const now = Date.now();
    if (!lastUpdate || now - lastUpdate > 30000) {
      lastUserActivityUpdate.set(decoded.uid, now);
      db.ref(`users/${decoded.uid}`).update({
        lastSeen: now,
        online: true
      }).catch(() => {});
    }

    req.user = decoded;
    next();
  })
  .catch(() => res.status(401).json({ error: 'Invalid token' }));
});

const BOARD_SIZE = 6;
const TOTAL_PIECES = 8;
const DEFAULT_TIME_MS = 3 * 60 * 1000;
const MAX_PLY = 100;
const ABANDON_TIMEOUT_MS = 30 * 1000;
const WIN_LENGTH = 4;
const DIRECTIONS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function createEmptyBoard() { return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null)); }
function cloneBoard(board) { return board.map(r => [...r]); }
function isValidPosition(row, col) { return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE; }

function checkForWin(board, player) {
  if (!player) return false;
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

function getWinLine(board, player) {
  if (!player) return null;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] !== player) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const positions = [{ row, col }];
        for (let step = 1; step < WIN_LENGTH; step++) {
          const nr = row + dr * step, nc = col + dc * step;
          if (isValidPosition(nr, nc) && board[nr][nc] === player) positions.push({ row: nr, col: nc });
          else break;
        }
        if (positions.length === WIN_LENGTH) {
          const pr = row + dr * -1, pc = col + dc * -1;
          const br = row + dr * WIN_LENGTH, bc = col + dc * WIN_LENGTH;
          if (!(isValidPosition(pr, pc) && board[pr][pc] === player) && !(isValidPosition(br, bc) && board[br][bc] === player)) return positions;
        }
      }
    }
  }
  return null;
}

function countPiecesOnBoard(board, player) { return board.reduce((sum, row) => sum + row.reduce((s, c) => s + (c === player ? 1 : 0), 0), 0); }
function isValidKingMove(from, to) { const dr = Math.abs(to.row - from.row); const dc = Math.abs(to.col - from.col); return dr <= 1 && dc <= 1 && (dr + dc > 0); }
function boardToString(board) { return board.map(row => row.map(c => c ? c[0] : '.').join('')).join('/'); }

function checkDraw(positionHistory, board, currentTurn, phase, moveCount) {
  if (phase === 'movement' && moveCount >= MAX_PLY) return true;
  const key = `${boardToString(board)}-${currentTurn}`;
  return positionHistory.filter(p => p === key).length >= 3;
}

function createInitialGameState() { return { board: createEmptyBoard(), currentTurn: 'white', phase: 'placement', moves: [], positionHistory: [] }; }

const BANNED_WORDS = [
  'fuck','shit','ass','bitch','bastard','cunt','dick','piss','whore','slut',
  'nigger','nigga','faggot','retard','damn','hell','cock','pussy','twat',
  'wanker','bollocks','arse','shag','crap','dickhead','motherfucker',
  'goddamn','jesus','christ','nazi','racist','homo','tranny','kill',
  'suicide','rape','molest','pedophile','pedo','sexist','bigot',
];

function isUsernameValid(username) {
  if (!username || typeof username !== 'string') return { valid: false, error: 'Username is required' };
  if (username.length < 2) return { valid: false, error: 'Username must be at least 2 characters' };
  if (username.length > 20) return { valid: false, error: 'Username must be at most 20 characters' };
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  const lower = username.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) return { valid: false, error: 'Username contains inappropriate language' };
  }
  return { valid: true };
}

function validatePlacement(board, player, position) {
  if (!player) return 'Invalid player';
  if (!position || typeof position.row !== 'number' || typeof position.col !== 'number') return 'Invalid position';
  if (!isValidPosition(position.row, position.col)) return 'Position out of bounds';
  if (board[position.row][position.col] !== null) return 'Cell is already occupied';
  if (countPiecesOnBoard(board, player) >= TOTAL_PIECES) return 'All pieces already placed';
  return null;
}

function validateMovement(board, player, from, to) {
  if (!player) return 'Invalid player';
  if (!from || typeof from.row !== 'number' || typeof from.col !== 'number') return 'Invalid source position';
  if (!to || typeof to.row !== 'number' || typeof to.col !== 'number') return 'Invalid destination position';
  if (!isValidPosition(from.row, from.col)) return 'Source position out of bounds';
  if (!isValidPosition(to.row, to.col)) return 'Destination position out of bounds';
  if (board[from.row][from.col] !== player) return 'No piece at source';
  if (board[to.row][to.col] !== null) return 'Destination occupied';
  if (!isValidKingMove(from, to)) return 'Invalid move';
  return null;
}

function applyPlacement(state, player, position) {
  const error = validatePlacement(state.board, player, position);
  if (error) return { error };
  const newBoard = cloneBoard(state.board);
  newBoard[position.row][position.col] = player;
  if (checkForWin(newBoard, player)) { state.board = newBoard; return { gameOver: true, winner: player }; }
  const nextTurn = player === 'black' ? 'white' : 'black';
  state.board = newBoard; state.currentTurn = nextTurn;
  if (countPiecesOnBoard(newBoard, 'black') >= TOTAL_PIECES && countPiecesOnBoard(newBoard, 'white') >= TOTAL_PIECES) state.phase = 'movement';
  return { gameOver: false };
}

function applyMovement(state, player, from, to) {
  const error = validateMovement(state.board, player, from, to);
  if (error) return { error };
  const newBoard = cloneBoard(state.board);
  newBoard[to.row][to.col] = player; newBoard[from.row][from.col] = null;
  if (checkForWin(newBoard, player)) { state.board = newBoard; return { gameOver: true, winner: player }; }
  state.board = newBoard; state.currentTurn = player === 'black' ? 'white' : 'black';
  return { gameOver: false };
}

function applyMove(state, player, from, to) {
  if (player !== state.currentTurn) return { error: 'Not your turn' };
  const result = state.phase === 'placement' ? applyPlacement(state, player, to) : applyMovement(state, player, from, to);
  if (result.error) return result;
  state.positionHistory = [...state.positionHistory, `${boardToString(state.board)}-${state.currentTurn}`];
  state.moves = [...state.moves, { player, from, to, timestamp: Date.now(), moveNumber: state.moves.length + 1 }];
  if (result.gameOver) return result;
  if (checkDraw(state.positionHistory, state.board, state.currentTurn, state.phase, state.moves.length)) return { gameOver: true, draw: true };
  return { gameOver: false };
}

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

function getBotMoves(state, player) {
  const moves = [];
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

function minimax(state, player, depth, alpha, beta, maximizing) {
  const opponent = player === 'black' ? 'white' : 'black';
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
      else applyMovement(ns, current, move.from, move.to);
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
      else applyMovement(ns, current, move.from, move.to);
      ns.currentTurn = current === 'black' ? 'white' : 'black';
      const eval_ = minimax(ns, player, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function engineFindBestMove(state, player, maxDepth = 10) {
  const moves = getBotMoves(state, player);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  for (const move of moves) {
    const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
    if (state.phase === 'placement') applyPlacement(ns, player, move.to);
    else applyMovement(ns, player, move.from, move.to);
    if (checkForWin(ns.board, player)) return move;
  }

  const opponent = player === 'black' ? 'white' : 'black';
  for (const move of moves) {
    const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
    if (state.phase === 'placement') applyPlacement(ns, opponent, move.to);
    else { if (move.from) { ns.board[move.to.row][move.to.col] = opponent; ns.board[move.from.row][move.from.col] = null; } }
    if (checkForWin(ns.board, opponent)) return move;
  }

  let bestMove = moves[0];
  let bestEval = -Infinity;
  const depth = Math.min(maxDepth, moves.length <= 5 ? 8 : moves.length <= 10 ? 6 : 4);

  for (const move of moves) {
    const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
    if (state.phase === 'placement') applyPlacement(ns, player, move.to);
    else applyMovement(ns, player, move.from, move.to);
    ns.currentTurn = opponent;
    const eval_ = minimax(ns, player, depth - 1, -Infinity, Infinity, false);
    if (eval_ > bestEval) { bestEval = eval_; bestMove = move; }
  }
  return bestMove;
}

function engineFindBestMoveForPlayer(state, player, maxDepth = 10) {
  const moves = getBotMoves(state, player);
  if (moves.length === 0) return null;

  for (const move of moves) {
    const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
    if (state.phase === 'placement') applyPlacement(ns, player, move.to);
    else applyMovement(ns, player, move.from, move.to);
    if (checkForWin(ns.board, player)) return move;
  }

  const opponent = player === 'black' ? 'white' : 'black';
  for (const move of moves) {
    const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
    if (state.phase === 'placement') { ns.board[move.to.row][move.to.col] = opponent; }
    else { if (move.from) { ns.board[move.to.row][move.to.col] = opponent; ns.board[move.from.row][move.from.col] = null; } }
    if (checkForWin(ns.board, opponent)) return move;
  }

  let bestMove = moves[0];
  let bestEval = -Infinity;
  const depth = Math.min(maxDepth, moves.length <= 5 ? 8 : moves.length <= 10 ? 6 : 4);
  for (const move of moves) {
    const ns = { board: cloneBoard(state.board), currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory };
    if (state.phase === 'placement') applyPlacement(ns, player, move.to);
    else applyMovement(ns, player, move.from, move.to);
    ns.currentTurn = opponent;
    const eval_ = minimax(ns, player, depth - 1, -Infinity, Infinity, false);
    if (eval_ > bestEval) { bestEval = eval_; bestMove = move; }
  }
  return bestMove;
}

// Helper function to ban a user and update their status
async function banUser(uid, permanent, reason) {
  const banData = permanent
  ? { permanent: true, reason, createdAt: Date.now() }
  : { until: Date.now() + 24 * 60 * 60 * 1000, reason, createdAt: Date.now(), hasBeenBanned: true };

  await db.ref(`bans/${uid}`).set(banData);
  await db.ref(`users/${uid}`).update({ banned: true, banReason: reason });
  invalidateBanCache(uid);
  await forfeitActiveGamesForBannedPlayer(uid);
}

async function forfeitActiveGamesForBannedPlayer(bannedUid) {
  try {
    const snap = await db.ref('activeGames').once('value');
    if (!snap.exists()) return;
    const forfeits = [];
    snap.forEach(child => {
      const g = child.val();
      if (g.status !== 'active') return;
      if (g.blackPlayer?.uid !== bannedUid && g.whitePlayer?.uid !== bannedUid) return;
      const gameId = child.key;
      const winner = g.blackPlayer?.uid === bannedUid ? 'white' : 'black';
      const game = decodeGameFromStorage(g);
      const gameResult = { winner, method: 'abandon', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
      const state = { board: game.board, currentTurn: game.currentTurn, phase: game.phase, moves: game.moves || [], positionHistory: game.positionHistory || [] };
      forfeits.push(finalizeGame(game, gameId, state, game.clock, null, gameResult).then(() => broadcastToGame(game, { type: 'game_over', gameId })));
    });
    await Promise.all(forfeits);
  } catch {}
}

async function analyzeGameAndCheckSus(game, state, gameId) {
  if (game.blackPlayer.uid === 'bot' || game.whitePlayer.uid === 'bot') return;
  const humanUid = game.blackPlayer.uid !== 'bot' ? game.blackPlayer.uid : game.whitePlayer.uid;
  const humanColor = game.blackPlayer.uid !== 'bot' ? 'black' : 'white';
  if (humanUid === 'bot') return;

  const moves = state.moves || [];
  let matchingMoves = 0;
  let totalMoves = 0;

  const simState = createInitialGameState();

  for (const move of moves) {
    if (move.player !== humanColor) {
      if (simState.phase === 'placement') applyPlacement(simState, move.player, move.to);
      else applyMovement(simState, move.player, move.from, move.to);
      if (!simState.currentTurn) simState.currentTurn = move.player === 'black' ? 'white' : 'black';
      continue;
    }

    totalMoves++;
    const engineMove = engineFindBestMoveForPlayer(simState, humanColor, 10);

    if (engineMove) {
      const playerFrom = move.from ? `${move.from.row},${move.from.col}` : null;
      const playerTo = `${move.to.row},${move.to.col}`;
      const engineFrom = engineMove.from ? `${engineMove.from.row},${engineMove.from.col}` : null;
      const engineTo = `${engineMove.to.row},${engineMove.to.col}`;
      if (playerTo === engineTo && playerFrom === engineFrom) matchingMoves++;
    }

    if (simState.phase === 'placement') applyPlacement(simState, humanColor, move.to);
    else applyMovement(simState, humanColor, move.from, move.to);
    simState.currentTurn = humanColor === 'black' ? 'white' : 'black';
  }

  if (totalMoves >= 4) {
    const matchRate = matchingMoves / totalMoves;
    let susIncrease = 0;
    let flagReason = '';
    if (matchRate >= 0.95) { susIncrease = 40; flagReason = 'Very high engine match rate (>=95%)'; }
    else if (matchRate >= 0.85) { susIncrease = 25; flagReason = 'High engine match rate (>=85%)'; }
    else if (matchRate >= 0.75) { susIncrease = 15; flagReason = 'Elevated engine match rate (>=75%)'; }
    else if (matchRate >= 0.65) { susIncrease = 5; flagReason = 'Moderate engine match rate (>=65%)'; }

    if (susIncrease > 0) {
      const userSnap = await db.ref(`users/${humanUid}`).once('value');
      if (userSnap.exists()) {
        const userData = userSnap.val();
        const currentSus = userData.susScore || 0;
        const newSus = currentSus + susIncrease;
        await db.ref(`users/${humanUid}`).update({ susScore: newSus });

        await db.ref(`flaggedGames/${gameId}`).set({
          gameId,
          uid: humanUid,
          username: userData.username || 'Player',
          matchRate: Math.round(matchRate * 100),
          totalMoves,
          matchingMoves,
          reason: flagReason,
          susIncrease,
          blackPlayer: game.blackPlayer,
          whitePlayer: game.whitePlayer,
          moves: state.moves || [],
          reviewedAt: null,
          dismissedAt: null,
          createdAt: Date.now(),
          status: 'pending',
        });
      }
    }
  }
}

async function refundRatingsForBannedPlayer(bannedUid) {
  const games = await getFinishedGames(500);
  const updates = [];
  games.forEach(({ id, game: g }) => {
    if (g.blackPlayer?.uid === bannedUid || g.whitePlayer?.uid === bannedUid) {
      const opponentUid = g.blackPlayer?.uid === bannedUid ? g.whitePlayer?.uid : g.blackPlayer?.uid;
      if (opponentUid && g.result) {
        const ratingChange = g.blackPlayer?.uid === bannedUid ? g.result.ratingChangeWhite : g.result.ratingChangeBlack;
        if (ratingChange && ratingChange !== 0) {
          updates.push(
            db.ref(`users/${opponentUid}`).once('value').then(oppSnap => {
              if (oppSnap.exists()) {
                const oppData = oppSnap.val();
                const refund = ratingChange < 0 ? Math.abs(ratingChange) : -ratingChange;
                return db.ref(`users/${opponentUid}`).update({
                  rating: (oppData.rating || 1500) + refund,
                }).then(() => sendSSE(opponentUid, { type: 'rating_refund', amount: refund, reason: 'Opponent banned for cheating' }));
              }
            })
          );
        }
      }
    }
  });
  await Promise.all(updates);
}

async function finalizeGame(game, gameId, state, clock, move, gameResult) {
  const gameRef = db.ref(`activeGames/${gameId}`);
  const isBotGame = game.blackPlayer.uid === 'bot' || game.whitePlayer.uid === 'bot';

  if (isBotGame) {
    return;
  }

  if (game.mode === 'rated') {
    const blackScore = gameResult.winner === 'black' ? 1 : gameResult.winner === 'white' ? 0 : 0.5;
    const whiteScore = gameResult.winner === 'white' ? 1 : gameResult.winner === 'black' ? 0 : 0.5;
    const [blackData, whiteData] = await Promise.all([rtdbGet(`users/${game.blackPlayer.uid}`), rtdbGet(`users/${game.whitePlayer.uid}`)]);

    const blackRating = blackData.rating || 1500, blackRD = blackData.ratingDeviation || 350, blackVol = blackData.volatility || 0.06;
    const whiteRating = whiteData.rating || 1500, whiteRD = whiteData.ratingDeviation || 350, whiteVol = whiteData.volatility || 0.06;

    const newBlack = calculateNewRating({ rating: blackRating, ratingDeviation: blackRD, volatility: blackVol }, [{ rating: whiteRating, ratingDeviation: whiteRD, score: blackScore }]);
    const newWhite = calculateNewRating({ rating: whiteRating, ratingDeviation: whiteRD, volatility: whiteVol }, [{ rating: blackRating, ratingDeviation: blackRD, score: whiteScore }]);

    gameResult.ratingChangeBlack = Math.round(newBlack.rating - blackRating);
    gameResult.ratingChangeWhite = Math.round(newWhite.rating - whiteRating);
    gameResult.blackRating = Math.round(newBlack.rating);
    gameResult.whiteRating = Math.round(newWhite.rating);

    const blackUpdate = { rating: Math.round(newBlack.rating), ratingDeviation: Math.round(newBlack.ratingDeviation), volatility: newBlack.volatility, gamesPlayed: (blackData.gamesPlayed || 0) + 1 };
    if (gameResult.winner === 'black') blackUpdate.wins = (blackData.wins || 0) + 1;
    else if (gameResult.winner === 'white') blackUpdate.losses = (blackData.losses || 0) + 1;
    else blackUpdate.draws = (blackData.draws || 0) + 1;

    const whiteUpdate = { rating: Math.round(newWhite.rating), ratingDeviation: Math.round(newWhite.ratingDeviation), volatility: newWhite.volatility, gamesPlayed: (whiteData.gamesPlayed || 0) + 1 };
    if (gameResult.winner === 'white') whiteUpdate.wins = (whiteData.wins || 0) + 1;
    else if (gameResult.winner === 'black') whiteUpdate.losses = (whiteData.losses || 0) + 1;
    else whiteUpdate.draws = (whiteData.draws || 0) + 1;

    await Promise.all([db.ref(`users/${game.blackPlayer.uid}`).update(blackUpdate), db.ref(`users/${game.whitePlayer.uid}`).update(whiteUpdate)]);
    cache.delete(`profile_${game.blackPlayer.uid}`);
    cache.delete(`profile_${game.whitePlayer.uid}`);
  }

  const finishedAt = Date.now();
  await gameRef.update(encodeGameForStorage({
    board: state.board,
    currentTurn: state.currentTurn,
    phase: 'finished',
    moves: state.moves || [],
    positionHistory: state.positionHistory || [],
    clock,
    lastMoveTimestamp: finishedAt,
    status: 'finished',
    completed: true,
    result: { ...gameResult, moves: state.moves || [] },
    finishedAt,
  }));

  finishedGamesCache.ts = 0;
  if (game.blackPlayer?.uid) activeGameIndex.delete(game.blackPlayer.uid);
  if (game.whitePlayer?.uid) activeGameIndex.delete(game.whitePlayer.uid);
  cache.delete('active_games');
}

function calculateNewRating(state, opponents, tau = 0.6) {
  if (opponents.length === 0) return { ...state };
  const { rating, ratingDeviation: RD, volatility: sigma } = state;
  const mu = (rating - 1500) / 173.7178;
  const phi = Math.max(RD, 30) / 173.7178;

  const oppData = opponents.map(opp => ({
    mu_j: (opp.rating - 1500) / 173.7178,
    phi_j: Math.max(opp.ratingDeviation, 30) / 173.7178,
    s_j: opp.score,
  }));

  const g = (phi) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
  const E = (mu, mu_j, phi_j) => 1 / (1 + Math.exp(-g(phi_j) * (mu - mu_j)));

  let v = 0;
  for (const opp of oppData) {
    const gPhi = g(opp.phi_j);
    const eVal = E(mu, opp.mu_j, opp.phi_j);
    v += gPhi * gPhi * eVal * (1 - eVal);
  }
  v = 1 / v;

  let deltaSum = 0;
  for (const opp of oppData) {
    const gPhi = g(opp.phi_j);
    const eVal = E(mu, opp.mu_j, opp.phi_j);
    deltaSum += gPhi * (opp.s_j - eVal);
  }
  const delta = v * deltaSum;

  const a = Math.log(sigma * sigma);
  const phiSq = phi * phi;
  const deltaSq = delta * delta;

  function f(x) {
    const ex = Math.exp(x);
    const d = phiSq + v + ex;
    return (ex * (deltaSq - d)) / (2 * d * d) - (x - a) / (tau * tau);
  }

  let A = a;
  let B;
  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  for (let iter = 0; iter < 100; iter++) {
    if (Math.abs(B - A) <= 1e-10) break;
    const C = A + (A - B) * fA / (fB - fA);
    if (!isFinite(C)) break;
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  const newSigma = Math.exp(A / 2);
  const phiStar = Math.sqrt(phiSq + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;

  const newRating = 173.7178 * newMu + 1500;
  const newRD = 173.7178 * newPhi;

  return {
    rating: Math.max(100, Math.min(3000, newRating)),
    ratingDeviation: Math.min(newRD, 350),
    volatility: Math.max(0.00001, newSigma),
  };
}

const sseClients = new Map();
const guestSseClients = new Map();
const botGameStore = new Map();
const clockTimers = new Map();
const duelCooldowns = new Map();

const cache = new Map();
const MAX_CACHE_SIZE = 500;
function cachedGet(key, ttlMs, fetcher) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) return entry.data;
  if (cache.size > MAX_CACHE_SIZE) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 100);
    for (const [k] of oldest) cache.delete(k);
  }
  const result = fetcher();
  if (result && typeof result.then === 'function') {
    return result.then(data => { cache.set(key, { data, ts: Date.now() }); return data; });
  }
  cache.set(key, { data: result, ts: Date.now() });
  return result;
}

const banCache = new Map();
const BAN_CACHE_TTL = 60000;
const activeGameIndex = new Map();
const activeGameIndexTs = { value: 0, ttl: 3000 };

async function getBanStatus(uid) {
  const cached = banCache.get(uid);
  if (cached && Date.now() - cached.ts < BAN_CACHE_TTL) return cached.data;
  const snap = await db.ref(`bans/${uid}`).once('value');
  let result = { banned: false };
  if (snap.exists()) {
    const ban = snap.val();
    if (ban.permanent) result = { banned: true, permanent: true, reason: ban.reason || 'Cheating' };
    else if (ban.until && Date.now() < ban.until) result = { banned: true, permanent: false, reason: ban.reason || 'Suspicious activity', until: ban.until };
    else await db.ref(`bans/${uid}`).remove().catch(() => {});
  }
  banCache.set(uid, { data: result, ts: Date.now() });
  return result;
}

function invalidateBanCache(uid) { banCache.delete(uid); }

async function refreshActiveGameIndex() {
  const now = Date.now();
  if (now - activeGameIndexTs.value < activeGameIndexTs.ttl && activeGameIndex.size > 0) return;
  const snap = await db.ref('activeGames').once('value');
  activeGameIndex.clear();
  if (snap.exists()) {
    snap.forEach(child => {
      const g = child.val();
      if (g.status === 'active') {
        if (g.blackPlayer?.uid) activeGameIndex.set(g.blackPlayer.uid, child.key);
        if (g.whitePlayer?.uid) activeGameIndex.set(g.whitePlayer.uid, child.key);
      }
    });
  }
  activeGameIndexTs.value = now;
}

const finishedGamesCache = { data: null, ts: 0, ttl: 15000, promise: null };
async function getFinishedGames(limit) {
  const now = Date.now();
  if (finishedGamesCache.data && now - finishedGamesCache.ts < finishedGamesCache.ttl) {
    if (limit) return finishedGamesCache.data.slice(0, limit);
    return finishedGamesCache.data;
  }
  if (finishedGamesCache.promise) return finishedGamesCache.promise.then(d => limit ? d.slice(0, limit) : d);

  finishedGamesCache.promise = (async () => {
    const gamesById = new Map();
    const activeSnap = await db.ref('activeGames').once('value');
    if (activeSnap.exists()) {
      activeSnap.forEach(child => {
        const game = normalizeArrays(child.val());
        if (game.status === 'finished' || game.completed) {
          gamesById.set(child.key, { id: child.key, game });
        }
      });
    }
    let completedRef = db.ref('completedGames');
    if (limit) completedRef = completedRef.limitToLast(limit);
    const completedSnap = await completedRef.once('value');
    if (completedSnap.exists()) {
      completedSnap.forEach(child => {
        if (!gamesById.has(child.key)) {
          gamesById.set(child.key, { id: child.key, game: normalizeArrays(child.val()) });
        }
      });
    }
    const result = Array.from(gamesById.values());
    finishedGamesCache.data = result;
    finishedGamesCache.ts = Date.now();
    finishedGamesCache.promise = null;
    return result;
  })();
  return finishedGamesCache.promise.then(d => limit ? d.slice(0, limit) : d);
}

app.get('/api/events', (req, res) => {
  const uid = req.user.uid;
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(`data: ${JSON.stringify({ type: 'connected', uid })}\n\n`);
  if (!sseClients.has(uid)) sseClients.set(uid, new Set());
  sseClients.get(uid).add(res);
  req.on('close', () => { const clients = sseClients.get(uid); if (clients) { clients.delete(res); if (clients.size === 0) sseClients.delete(uid); } });
});

app.get('/api/guest/events', (req, res) => {
  const uid = typeof req.query.uid === 'string' ? req.query.uid : null;
  if (!uid) return res.status(400).json({ error: 'uid query parameter required' });
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(`data: ${JSON.stringify({ type: 'connected', uid })}\n\n`);
  if (!guestSseClients.has(uid)) guestSseClients.set(uid, new Set());
  guestSseClients.get(uid).add(res);
  req.on('close', () => { const clients = guestSseClients.get(uid); if (clients) { clients.delete(res); if (clients.size === 0) guestSseClients.delete(uid); } });
});

setInterval(() => {
  for (const clients of sseClients.values()) {
    clients.forEach(res => { try { res.write(': keepalive\n\n'); } catch {} });
  }
  for (const clients of guestSseClients.values()) {
    clients.forEach(res => { try { res.write(': keepalive\n\n'); } catch {} });
  }
}, 30000);

function sendSSE(uid, data) {
  const clients = sseClients.get(uid);
  if (clients) clients.forEach(res => { try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {} });
  const guestClients = guestSseClients.get(uid);
  if (guestClients) guestClients.forEach(res => { try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {} });
}
function broadcastToGame(game, data) { sendSSE(game.blackPlayer.uid, data); sendSSE(game.whitePlayer.uid, data); }

async function createGameFromRematch(oldGame, requesterUid) {
  const opponentUid = oldGame.blackPlayer.uid === requesterUid ? oldGame.whitePlayer.uid : oldGame.blackPlayer.uid;
  const opponentData = await rtdbGet(`users/${opponentUid}`);
  if (!opponentData) throw new Error('Opponent not found');
  const userData = await rtdbGet(`users/${requesterUid}`);
  if (!userData) throw new Error('User not found');

  const fromColor = oldGame.blackPlayer.uid === requesterUid ? 'black' : 'white';
  const newBlackUid = fromColor === 'white' ? opponentUid : requesterUid;
  const newWhiteUid = fromColor === 'white' ? requesterUid : opponentUid;
  const newBlackData = newBlackUid === requesterUid ? userData : opponentData;
  const newWhiteData = newWhiteUid === requesterUid ? userData : opponentData;
  const initialState = createInitialGameState();
  const gameId = `${Date.now()}_${newBlackUid.slice(0, 6)}_${newWhiteUid.slice(0, 6)}`;
  const gameData = {
    id: gameId,
    blackPlayer: { uid: newBlackUid, username: newBlackData.username || 'Player', rating: newBlackData.rating || 1500, ratingDeviation: newBlackData.ratingDeviation || 350, piecesPlaced: 0 },
    whitePlayer: { uid: newWhiteUid, username: newWhiteData.username || 'Player', rating: newWhiteData.rating || 1500, ratingDeviation: newWhiteData.ratingDeviation || 350, piecesPlaced: 0 },
    board: initialState.board, currentTurn: initialState.currentTurn, phase: initialState.phase,
    mode: oldGame.mode || 'casual', moves: [], status: 'active',
    clock: { black: DEFAULT_TIME_MS, white: DEFAULT_TIME_MS },
    lastMoveTimestamp: Date.now(), createdAt: Date.now(), spectators: 0, positionHistory: [],
  };
	await createActiveGame(gameData);
	startClockTimer(gameId);
	return { gameId, opponentUid };
}

async function findActiveGameForUser(uid) {
  if (!uid) return null;
  await refreshActiveGameIndex();
  const gameId = activeGameIndex.get(uid);
  if (!gameId) return null;
  const snap = await db.ref(`activeGames/${gameId}`).once('value');
  if (!snap.exists()) { activeGameIndex.delete(uid); return null; }
  const game = decodeGameFromStorage(snap.val());
  if (game.status !== 'active') { activeGameIndex.delete(uid); return null; }
  return { id: gameId, ...game };
}

async function isUserBusy(uid) {
  const activeGame = await findActiveGameForUser(uid);
  return activeGame ? { busy: true, gameId: activeGame.id } : { busy: false };
}

async function getFinishedGame(gameId) {
  const activeSnap = await db.ref(`activeGames/${gameId}`).once('value');
  if (activeSnap.exists()) {
    const game = normalizeArrays(activeSnap.val());
    if (game.status === 'finished' || game.completed) return game;
  }
  const completedSnap = await db.ref(`completedGames/${gameId}`).once('value');
  return completedSnap.exists() ? normalizeArrays(completedSnap.val()) : null;
}

function clearClockTimers(gameId) {
  const timers = clockTimers.get(gameId);
  if (timers) {
    clearTimeout(timers.tick);
    clearTimeout(timers.abandon);
    clockTimers.delete(gameId);
  }
}

function startClockTimer(gameId) {
  clearClockTimers(gameId);
  const tickTimer = setTimeout(async () => {
    try {
      const gameRef = db.ref(`activeGames/${gameId}`);
      const snap = await gameRef.once('value');
      if (!snap.exists()) { clearClockTimers(gameId); return; }
      const game = decodeGameFromStorage(snap.val());
      if (game.status !== 'active') { clearClockTimers(gameId); return; }
      const now = Date.now();
      const elapsed = now - (game.lastMoveTimestamp || now);
      const currentClock = { ...game.clock };
      const currentTurn = game.currentTurn;
      currentClock[currentTurn] = Math.max(0, currentClock[currentTurn] - elapsed);
      if (currentClock[currentTurn] <= 0) {
        const winner = currentTurn === 'black' ? 'white' : 'black';
        const gameResult = { winner, method: 'timeout', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
        const state = { board: game.board, currentTurn: game.currentTurn, phase: game.phase, moves: game.moves || [], positionHistory: game.positionHistory || [] };
        await finalizeGame(game, gameId, state, currentClock, null, gameResult);
        broadcastToGame(game, { type: 'game_over', gameId });
        clearClockTimers(gameId);
        return;
      }
      await gameRef.update(encodeGameForStorage({ clock: currentClock, lastMoveTimestamp: now }));
      sendSSE(game.blackPlayer.uid, { type: 'clock_tick', gameId, clock: currentClock });
      sendSSE(game.whitePlayer.uid, { type: 'clock_tick', gameId, clock: currentClock });
      const abandonTimer = setTimeout(async () => {
        try {
          const snap2 = await gameRef.once('value');
          if (!snap2.exists()) return;
          const game2 = decodeGameFromStorage(snap2.val());
          if (game2.status !== 'active' || game2.currentTurn !== currentTurn) return;
          if (Date.now() - (game2.lastMoveTimestamp || game2.createdAt) >= ABANDON_TIMEOUT_MS) {
            const abandonWinner = currentTurn === 'black' ? 'white' : 'black';
            const gameResult = { winner: abandonWinner, method: 'abandon', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game2.blackPlayer.rating, whiteRating: game2.whitePlayer.rating };
            const state = { board: game2.board, currentTurn: game2.currentTurn, phase: game2.phase, moves: game2.moves || [], positionHistory: game2.positionHistory || [] };
            await finalizeGame(game2, gameId, state, game2.clock, null, gameResult);
            broadcastToGame(game2, { type: 'game_over', gameId });
            clearClockTimers(gameId);
          }
        } catch (err) { console.error('Abandon check error:', err.message); }
      }, ABANDON_TIMEOUT_MS);
      if (clockTimers.has(gameId)) clockTimers.get(gameId).abandon = abandonTimer;
    } catch (err) { console.error('Clock tick error:', err.message); }
  }, 1000);
  clockTimers.set(gameId, { tick: tickTimer, abandon: null });
}

async function createActiveGame(gameData) {
  await db.ref(`activeGames/${gameData.id}`).set(encodeGameForStorage(gameData));
  if (gameData.blackPlayer?.uid) activeGameIndex.set(gameData.blackPlayer.uid, gameData.id);
  if (gameData.whitePlayer?.uid) activeGameIndex.set(gameData.whitePlayer.uid, gameData.id);
  cache.delete('active_games');
}

app.post('/api/profile/create', async (req, res) => {
  const { username, email } = req.body;
  const uid = req.user.uid;
  const existing = await rtdbGet(`users/${uid}`);
  if (!existing) {
    let finalUsername = username || email?.split('@')[0] || 'Player';
    const validation = isUsernameValid(finalUsername);
    if (!validation.valid) finalUsername = 'Player';
    const existingUname = await rtdbGet(`usernames/${finalUsername.toLowerCase()}`);
    if (existingUname && existingUname !== uid) finalUsername = `Player${Date.now().toString().slice(-4)}`;
    await db.ref(`users/${uid}`).set({
      uid, username: finalUsername, email: email || '',
      createdAt: Date.now(), rating: 1500, ratingDeviation: 350, volatility: 0.06,
      gamesPlayed: 0, wins: 0, losses: 0, draws: 0, online: true, lastSeen: Date.now(),
      lastUsernameChange: 0, susScore: 0, internalActionFlags: 0,
      banned: false, banReason: null,
    });
    await db.ref(`usernames/${finalUsername.toLowerCase()}`).set(uid);
  } else {
    const updates = {};
    const defaults = {
      rating: 1500, ratingDeviation: 350, volatility: 0.06,
      gamesPlayed: 0, wins: 0, losses: 0, draws: 0,
      online: true, lastSeen: Date.now(),
      lastUsernameChange: 0, susScore: 0, internalActionFlags: 0,
      banned: false, banReason: null,
    };
    for (const [key, value] of Object.entries(defaults)) {
      if (existing[key] === undefined || existing[key] === null) updates[key] = value;
    }
    if (Object.keys(updates).length > 0) await db.ref(`users/${uid}`).update(updates);
  }
  res.json({ success: true });
});

app.get('/api/profile', async (req, res) => {
  const uid = req.user.uid;
  const cacheKey = `profile_${uid}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5000) {
    return res.json(cached.data);
  }
  const data = await rtdbGet(`users/${uid}`);
  if (!data) return res.status(404).json({ error: 'Not found' });
  const publicData = { ...data };
  delete publicData.susScore;
  delete publicData.internalActionFlags;
  cache.set(cacheKey, { data: publicData, ts: Date.now() });
  res.json(publicData);
});

app.get('/api/profile/public/:uid', publicLimiter, async (req, res) => {
  const { uid } = req.params;
  const data = await rtdbGet(`users/${uid}`);
  if (!data) return res.status(404).json({ error: 'User not found' });

  const banData = await rtdbGet(`bans/${uid}`);
  const publicData = { ...data, banned: false, banReason: null };
  delete publicData.susScore;
  delete publicData.internalActionFlags;

  if (banData) {
    if (banData.permanent) {
      publicData.banned = true;
      publicData.banReason = banData.reason || 'Permanently banned';
    } else if (banData.until && Date.now() < banData.until) {
      publicData.banned = true;
      publicData.banReason = banData.reason || 'Temporarily banned';
      publicData.banUntil = banData.until;
    }
  }

  const allRequests = await rtdbGet('friendRequests');
  const viewerUid = req.user?.uid;
  if (viewerUid && allRequests) {
    publicData.isFriend = Object.values(allRequests).some((r) =>
      r.status === 'accepted' && ((r.from === viewerUid && r.to === uid) || (r.from === uid && r.to === viewerUid))
    );
    publicData.friendRequestPending = Object.values(allRequests).some((r) =>
      r.status === 'pending' && r.from === viewerUid && r.to === uid
    );
  } else {
    publicData.isFriend = false;
    publicData.friendRequestPending = false;
  }

  res.json(publicData);
});

app.get('/api/search-users', publicLimiter, async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.length < 2) {
    return res.json({ users: [] });
  }
  
  const allUsers = await rtdbGet('users');
  if (!allUsers) return res.json({ users: [] });
  
  const query = q.toLowerCase();
  const results = Object.entries(allUsers)
    .filter(([uid, data]) => data.username && data.username.toLowerCase().includes(query))
    .slice(0, 10)
    .map(([uid, data]) => ({ uid, username: data.username || 'Player', rating: data.rating || 1500 }));
  
  res.json({ users: results });
});

app.put('/api/profile/username', async (req, res) => {
  const { username } = req.body;
  const validation = isUsernameValid(username);
  if (!validation.valid) return res.status(400).json({ error: validation.error });
  const data = await rtdbGet(`users/${req.user.uid}`);
  if (!data) return res.status(404).json({ error: 'Not found' });
  const lastChange = data.lastUsernameChange || 0;
  const daysSince = (Date.now() - lastChange) / (1000 * 60 * 60 * 24);
  if (daysSince < 7 && lastChange > 0) return res.status(400).json({ error: `You can change your username again in ${Math.ceil(7 - daysSince)} day(s)` });
  const existingUid = await rtdbGet(`usernames/${username.toLowerCase()}`);
  if (existingUid && existingUid !== req.user.uid) return res.status(400).json({ error: 'Username already taken' });
  const oldUsername = data.username;
  await db.ref(`users/${req.user.uid}`).update({ username, lastUsernameChange: Date.now() });
  if (oldUsername) await db.ref(`usernames/${oldUsername.toLowerCase()}`).remove();
  await db.ref(`usernames/${username.toLowerCase()}`).set(req.user.uid);
  res.json({ success: true, username });
});

app.put('/api/profile/password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) return res.status(400).json({ error: 'Password must be 6-128 characters' });
  try {
    await auth.updateUser(req.user.uid, { password: newPassword });
    res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to update password' });
  }
});

app.post('/api/internal-action', async (req, res) => {
  const uid = req.user.uid;
  const snap = await db.ref(`users/${uid}`).once('value');
  if (!snap.exists()) return res.status(404).json({ error: 'Not found' });
  const data = snap.val();
  const flags = (data.internalActionFlags || 0) + 1;
  const update = { internalActionFlags: flags };
  if (flags >= 3) {
    update.internalActionFlags = 0;
    const currentSus = data.susScore || 0;
    const newSus = currentSus + 100;
    update.susScore = newSus;

    await db.ref(`flaggedGames/internal_${uid}_${Date.now()}`).set({
      gameId: `internal_${uid}_${Date.now()}`,
      uid,
      username: data.username || 'Player',
      matchRate: 100,
      totalMoves: 0,
      matchingMoves: 0,
      reason: 'Unauthorized client modifications detected (3 internal action flags)',
      susIncrease: 100,
      blackPlayer: null,
      whitePlayer: null,
      moves: [],
      reviewedAt: null,
      dismissedAt: null,
      createdAt: Date.now(),
      status: 'pending',
    });
  }
  await db.ref(`users/${uid}`).update(update);
  res.json({ success: true });
});

app.get('/api/ban-status', async (req, res) => {
  const status = await getBanStatus(req.user.uid);
  res.json(status);
});

app.get('/api/leaderboard', async (req, res) => {
  const cacheKey = 'leaderboard';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 30000) {
    return res.json(cached.data);
  }
  const pageSize = 20;
  const lastRating = req.query.lastRating ? parseFloat(req.query.lastRating) : null;
  const lastUid = req.query.lastUid || null;
  const allUsers = await rtdbGet('users');
  const allBans = await rtdbGet('bans');
  if (!allUsers) return res.json({ entries: [], hasMore: false, lastUid: null, lastRating: null });
  
  // Filter out banned users
  let entries = Object.entries(allUsers)
    .filter(([uid, data]) => {
      if (!allBans || !allBans[uid]) return true; // Not banned
      const ban = allBans[uid];
      if (ban.permanent) return false; // Permanently banned
      if (ban.until && Date.now() < ban.until) return false; // Temporarily banned
      return true; // Ban expired
    })
    .map(([uid, data]) => ({ 
      uid, 
username: data.username || 'Player',
      rating: data.rating || 1500, 
      wins: data.wins || 0, 
      losses: data.losses || 0, 
      draws: data.draws || 0 
    }))
    .sort((a, b) => b.rating - a.rating);
  
  if (lastRating !== null && lastUid) { 
    const idx = entries.findIndex(e => e.uid === lastUid && e.rating === lastRating); 
    if (idx >= 0) entries = entries.slice(idx + 1); 
  }
  const page = entries.slice(0, pageSize);
  const result = {
    entries: page,
    hasMore: entries.length > pageSize,
    lastUid: page.length > 0 ? page[page.length - 1].uid : null,
    lastRating: page.length > 0 ? page[page.length - 1].rating : null
  };
  cache.set(cacheKey, { data: result, ts: Date.now() });
  res.json(result);
});

app.get('/api/friends', async (req, res) => {
  const uid = req.user.uid;
  const allRequests = await rtdbGet('friendRequests');
  if (!allRequests) return res.json([]);
  const friendUids = new Set();
  Object.values(allRequests).forEach(r => { if (r.from === uid && r.status === 'accepted') friendUids.add(r.to); if (r.to === uid && r.status === 'accepted') friendUids.add(r.from); });
  const friendUidArr = [...friendUids];
  const friendDataArr = await Promise.all(friendUidArr.map(fuid => rtdbGet(`users/${fuid}`)));
  const friends = [];
  for (let i = 0; i < friendUidArr.length; i++) {
    const data = friendDataArr[i];
    if (data) friends.push({ uid: friendUidArr[i], username: data.username || 'Player', online: data.online || false, lastSeen: data.lastSeen || 0, rating: data.rating || 1500 });
  }
  res.json(friends);
});

app.get('/api/friends/requests', async (req, res) => {
  const requests = await rtdbGetChild('friendRequests', 'to', req.user.uid);
  const pending = requests.filter(r => r.status === 'pending');
  const result = await Promise.all(pending.map(async (r) => { const userData = await rtdbGet(`users/${r.from}`); return { id: r.id, from: r.from, fromUsername: userData ? userData.username : 'Unknown', to: r.to, status: r.status, createdAt: r.createdAt }; }));
  res.json(result);
});

app.post('/api/friends/request', async (req, res) => {
  const { toUsername } = req.body;
  if (!toUsername) return res.status(400).json({ error: 'Username required' });
  const targetUid = await rtdbGet(`usernames/${toUsername.toLowerCase()}`);
  if (!targetUid) return res.status(404).json({ error: 'User not found' });
  if (targetUid === req.user.uid) return res.status(400).json({ error: 'Cannot send request to yourself' });
  const existing = await rtdbGetChild('friendRequests', 'from', req.user.uid);
  if (existing.some(r => r.to === targetUid && r.status === 'pending')) return res.status(400).json({ error: 'Request already sent' });
  const newRef = db.ref('friendRequests').push();
  await newRef.set({ from: req.user.uid, to: targetUid, status: 'pending', createdAt: Date.now() });
  const notifRef = db.ref(`notifications/${targetUid}`).push();
  const senderData = await rtdbGet(`users/${req.user.uid}`);
  await notifRef.set({
    type: 'friend_request',
    message: `Friend request from ${senderData ? senderData.username : 'a user'}`,
    fromUid: req.user.uid,
    fromUsername: senderData ? senderData.username : 'Unknown',
    createdAt: Date.now(),
    read: false,
  });
  sendSSE(targetUid, { type: 'friend_request_received', fromUid: req.user.uid, fromUsername: senderData ? senderData.username : 'Unknown' });
  res.json({ success: true });
});

app.post('/api/friends/accept', async (req, res) => { const { requestId } = req.body; const data = await rtdbGet(`friendRequests/${requestId}`); if (!data || data.to !== req.user.uid) return res.status(403).json({ error: 'Forbidden' }); if (data.status !== 'pending') return res.status(400).json({ error: 'Request already processed' }); await db.ref(`friendRequests/${requestId}`).update({ status: 'accepted' }); res.json({ success: true }); });
app.post('/api/friends/reject', async (req, res) => { const { requestId } = req.body; const data = await rtdbGet(`friendRequests/${requestId}`); if (!data || data.to !== req.user.uid) return res.status(403).json({ error: 'Forbidden' }); if (data.status !== 'pending') return res.status(400).json({ error: 'Request already processed' }); await db.ref(`friendRequests/${requestId}`).update({ status: 'rejected' }); res.json({ success: true }); });

app.post('/api/friends/remove', async (req, res) => {
  const { friendUid } = req.body;
  const uid = req.user.uid;
  const allRequests = await rtdbGet('friendRequests'); if (!allRequests) return res.json({ success: true });
  const deletes = [];
  Object.entries(allRequests).forEach(([id, r]) => { if (r.status === 'accepted' && ((r.from === uid && r.to === friendUid) || (r.from === friendUid && r.to === uid))) deletes.push(db.ref(`friendRequests/${id}`).remove()); });
  await Promise.all(deletes); res.json({ success: true });
});

app.post('/api/friends/duel-request', async (req, res) => {
  const { toUid } = req.body;
  const fromUid = req.user.uid;
  if (!toUid) return res.status(400).json({ error: 'Target UID required' });
  if (toUid === fromUid) return res.status(400).json({ error: 'Cannot duel yourself' });

  const [senderBusy, targetBusy] = await Promise.all([isUserBusy(fromUid), isUserBusy(toUid)]);
  if (senderBusy.busy) return res.status(409).json({ error: 'You are already in a match', gameId: senderBusy.gameId });
  if (targetBusy.busy) return res.status(409).json({ error: 'That player is already in a match', gameId: targetBusy.gameId });

  const cooldownKey = `${fromUid}_${toUid}`;
  const lastDuel = duelCooldowns.get(cooldownKey);
  if (lastDuel && Date.now() - lastDuel < 30000) {
    return res.status(429).json({ error: 'Please wait 30 seconds before sending another duel request' });
  }

  const senderData = await rtdbGet(`users/${fromUid}`);
  if (!senderData) return res.status(404).json({ error: 'Sender not found' });

  const allRequests = await rtdbGet('friendRequests');
  const areFriends = allRequests && Object.values(allRequests).some((r) =>
    r.status === 'accepted' && ((r.from === fromUid && r.to === toUid) || (r.from === toUid && r.to === fromUid))
  );
  if (!areFriends) return res.status(403).json({ error: 'You can only duel friends' });

  duelCooldowns.set(cooldownKey, Date.now());
  setTimeout(() => duelCooldowns.delete(cooldownKey), 30000);

  const duelId = `duel_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  sendSSE(toUid, {
    type: 'duel_request',
    fromUid: fromUid,
    fromUsername: senderData.username || 'Player',
    message: `${senderData.username || 'Player'} wants to duel you!`,
    duelId
  });

  const notifRef = db.ref(`notifications/${toUid}`).push();
  await notifRef.set({
    type: 'duel_request',
    message: `${senderData.username || 'Player'} wants to duel you!`,
    fromUid: fromUid,
    fromUsername: senderData.username || 'Player',
    createdAt: Date.now(),
    read: false,
    duelId,
    consumed: false,
  });

  res.json({ success: true });
});

app.post('/api/matchmaking/join', async (req, res) => {
  const { mode } = req.body;
  if (!mode || !['rated', 'casual'].includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
  const data = await rtdbGet(`users/${req.user.uid}`);
  if (!data) return res.status(404).json({ error: 'User not found' });

  const busy = await isUserBusy(req.user.uid);
  if (busy.busy) return res.status(409).json({ error: 'You are already in a match', gameId: busy.gameId });

  const existingSnap = await db.ref(`queue/${req.user.uid}`).once('value');
  if (existingSnap.exists()) {
    return res.json({ success: true, alreadyInQueue: true });
  }

  await db.ref(`queue/${req.user.uid}`).set({ uid: req.user.uid, username: data.username || 'Player', rating: data.rating || 1500, ratingDeviation: data.ratingDeviation || 350, mode, joinedAt: Date.now(), range: 100 });
  res.json({ success: true });
  setTimeout(() => tryMatchmaking(req.user.uid), 1000);
});

async function tryMatchmaking(uid) {
  try {
    const mySnap = await db.ref(`queue/${uid}`).once('value');
    if (!mySnap.exists()) return;
    const myEntry = normalizeArrays(mySnap.val());

    const snap = await db.ref('queue').once('value');
    if (!snap.exists()) return;
    const entries = Object.values(normalizeArrays(snap.val()));
    const opponents = entries.filter(e => e.uid !== uid && e.mode === myEntry.mode && Math.abs(e.rating - myEntry.rating) <= myEntry.range);
    if (opponents.length === 0) {
      await db.ref(`queue/${uid}`).update({ range: Math.min(myEntry.range + 50, 500) });
      return;
    }
    const opponent = opponents[0];

    const [myBusy, opponentBusy] = await Promise.all([isUserBusy(uid), isUserBusy(opponent.uid)]);
    if (myBusy.busy || opponentBusy.busy) {
      if (myBusy.busy) await db.ref(`queue/${uid}`).remove();
      if (opponentBusy.busy) await db.ref(`queue/${opponent.uid}`).remove();
      return;
    }

    const removed = await Promise.all([
      db.ref(`queue/${uid}`).transaction(current => {
        if (current) return null;
        return current;
      }),
      db.ref(`queue/${opponent.uid}`).transaction(current => {
        if (current) return null;
        return current;
      })
    ]);

    if (!removed[0].committed || !removed[1].committed) {
      return;
    }

    const gameId = `${Date.now()}_${uid.slice(0, 6)}_${opponent.uid.slice(0, 6)}`;
    const initialState = createInitialGameState();
    const [blackData, whiteData] = await Promise.all([rtdbGet(`users/${uid}`), rtdbGet(`users/${opponent.uid}`)]);
    const gameData = { id: gameId, blackPlayer: { uid, username: blackData.username || 'Player', rating: blackData.rating || 1500, ratingDeviation: blackData.ratingDeviation || 350, piecesPlaced: 0 }, whitePlayer: { uid: opponent.uid, username: whiteData.username || 'Player', rating: whiteData.rating || 1500, ratingDeviation: whiteData.ratingDeviation || 350, piecesPlaced: 0 }, board: initialState.board, currentTurn: initialState.currentTurn, phase: initialState.phase, mode: myEntry.mode, moves: [], status: 'active', clock: { black: DEFAULT_TIME_MS, white: DEFAULT_TIME_MS }, lastMoveTimestamp: Date.now(), createdAt: Date.now(), spectators: 0, positionHistory: [] };
	await createActiveGame(gameData);
	sendSSE(opponent.uid, { type: 'match_found', gameId });
	sendSSE(uid, { type: 'match_found', gameId });
    startClockTimer(gameId);
  } catch (err) {
    console.error('Matchmaking error:', err.message);
  }
}

setInterval(async () => {
  try {
    const snap = await db.ref('queue').once('value');
    if (!snap.exists()) return;
    const raw = snap.val();
    const entries = [];
    snap.forEach(child => { entries.push({ uid: child.key, ...normalizeArrays(child.val()) }); });
    const matched = new Set();
    for (let i = 0; i < entries.length; i++) {
      if (matched.has(entries[i].uid)) continue;
      for (let j = i + 1; j < entries.length; j++) {
        if (matched.has(entries[j].uid)) continue;
        const a = entries[i], b = entries[j];
        if (a.mode !== b.mode) continue;
        if (Math.abs(a.rating - b.rating) > Math.max(a.range, b.range)) continue;

        const [aBusy, bBusy] = await Promise.all([isUserBusy(a.uid), isUserBusy(b.uid)]);
        if (aBusy.busy || bBusy.busy) {
          if (aBusy.busy) await db.ref(`queue/${a.uid}`).remove();
          if (bBusy.busy) await db.ref(`queue/${b.uid}`).remove();
          continue;
        }

        const removedA = await db.ref(`queue/${a.uid}`).transaction(current => { if (current) return null; return current; });
        const removedB = await db.ref(`queue/${b.uid}`).transaction(current => { if (current) return null; return current; });
        if (!removedA.committed || !removedB.committed) continue;

        matched.add(a.uid);
        matched.add(b.uid);
        const gameId = `${Date.now()}_${a.uid.slice(0, 6)}_${b.uid.slice(0, 6)}`;
        const initialState = createInitialGameState();
        const [blackData, whiteData] = await Promise.all([rtdbGet(`users/${a.uid}`), rtdbGet(`users/${b.uid}`)]);
        const gameData = { id: gameId, blackPlayer: { uid: a.uid, username: blackData.username || 'Player', rating: blackData.rating || 1500, ratingDeviation: blackData.ratingDeviation || 350, piecesPlaced: 0 }, whitePlayer: { uid: b.uid, username: whiteData.username || 'Player', rating: whiteData.rating || 1500, ratingDeviation: whiteData.ratingDeviation || 350, piecesPlaced: 0 }, board: initialState.board, currentTurn: initialState.currentTurn, phase: initialState.phase, mode: a.mode, moves: [], status: 'active', clock: { black: DEFAULT_TIME_MS, white: DEFAULT_TIME_MS }, lastMoveTimestamp: Date.now(), createdAt: Date.now(), spectators: 0, positionHistory: [] };
	await createActiveGame(gameData);
	sendSSE(a.uid, { type: 'match_found', gameId });
	sendSSE(b.uid, { type: 'match_found', gameId });
        startClockTimer(gameId);
        break;
      }
    }
    for (const entry of entries) {
      if (!matched.has(entry.uid)) {
        const stillExists = await db.ref(`queue/${entry.uid}`).once('value');
        if (stillExists.exists()) {
          await db.ref(`queue/${entry.uid}`).update({ range: Math.min((entry.range || 100) + 50, 500) });
        }
      }
    }
  } catch (err) {
    console.error('Matchmaking interval error:', err.message);
  }
}, 2000);

app.post('/api/game/create-duel', async (req, res) => {
  const { opponentUid, duelNotificationId, duelId } = req.body;
  const fromUid = req.user.uid;

  if (!opponentUid) return res.status(400).json({ error: 'Opponent UID required' });
  if (opponentUid === fromUid) return res.status(400).json({ error: 'Cannot duel yourself' });

  if (duelNotificationId) {
    const notifSnap = await db.ref(`notifications/${opponentUid}/${duelNotificationId}`).once('value');
    if (notifSnap.exists()) {
      const notif = notifSnap.val();
      if (notif.type === 'duel_accepted' || notif.consumed) {
        return res.status(409).json({ error: 'Duel request has already been accepted' });
      }
      await db.ref(`notifications/${opponentUid}/${duelNotificationId}`).update({ consumed: true });
    }
  }

  if (duelId) {
    const notifsSnap = await db.ref(`notifications/${opponentUid}`).orderByChild('duelId').equalTo(duelId).once('value');
    if (notifsSnap.exists()) {
      let alreadyConsumed = false;
      const updates = {};
      notifsSnap.forEach(child => {
        const n = child.val();
        if (n.consumed) alreadyConsumed = true;
        else updates[`${child.key}/consumed`] = true;
      });
      if (alreadyConsumed) return res.status(409).json({ error: 'Duel request has already been accepted' });
      if (Object.keys(updates).length > 0) await db.ref(`notifications/${opponentUid}`).update(updates);
    }
  }

  const [senderBusy, opponentBusy] = await Promise.all([isUserBusy(fromUid), isUserBusy(opponentUid)]);
  if (senderBusy.busy) return res.status(409).json({ error: 'You are already in a match', gameId: senderBusy.gameId });
  if (opponentBusy.busy) return res.status(409).json({ error: 'That player is already in a match', gameId: opponentBusy.gameId });

  // Check if they're friends
  const allRequests = await rtdbGet('friendRequests');
  const areFriends = allRequests && Object.values(allRequests).some((r) =>
    r.status === 'accepted' && ((r.from === fromUid && r.to === opponentUid) || (r.from === opponentUid && r.to === fromUid))
  );
  if (!areFriends) return res.status(403).json({ error: 'You can only duel friends' });

  // Get both users' data
  const [fromData, toData] = await Promise.all([
    rtdbGet(`users/${fromUid}`),
    rtdbGet(`users/${opponentUid}`)
  ]);
  
  if (!fromData || !toData) return res.status(404).json({ error: 'User not found' });
  
  // Create game
  const gameId = `${Date.now()}_${fromUid.slice(0, 6)}_${opponentUid.slice(0, 6)}`;
  const initialState = createInitialGameState();
  const gameData = {
    id: gameId,
    blackPlayer: {
      uid: fromUid,
      username: fromData.username || 'Player',
      rating: fromData.rating || 1500,
      ratingDeviation: fromData.ratingDeviation || 350,
      piecesPlaced: 0
    },
    whitePlayer: {
      uid: opponentUid,
      username: toData.username || 'Player',
      rating: toData.rating || 1500,
      ratingDeviation: toData.ratingDeviation || 350,
      piecesPlaced: 0
    },
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
    positionHistory: []
  };
  
	await createActiveGame(gameData);
	sendSSE(opponentUid, { type: 'duel_accepted', gameId });
  sendSSE(fromUid, { type: 'duel_accepted', gameId });
  startClockTimer(gameId);
  res.json({ gameId });
});

app.post('/api/bot/game', async (req, res) => {
  const { strength } = req.body;
  const validStrengths = ['easy', 'medium', 'hard', 'stockfish'];
  if (!validStrengths.includes(strength)) return res.status(400).json({ error: 'Invalid bot strength' });
  const data = await rtdbGet(`users/${req.user.uid}`);
  if (!data) return res.status(404).json({ error: 'User not found' });
  const gameId = `bot_${Date.now()}_${req.user.uid.slice(0, 6)}`;
  const botNames = { easy: '4dot Engine (Easy)', medium: '4dot Engine (Medium)', hard: '4dot Engine (Hard)', stockfish: '4dot Engine MAX' };
  const initialState = createInitialGameState();
  const gameData = {
    id: gameId,
    whitePlayer: { uid: req.user.uid, username: data.username || 'Player', rating: data.rating || 1500, ratingDeviation: data.ratingDeviation || 350, piecesPlaced: 0 },
    blackPlayer: { uid: 'bot', username: botNames[strength], rating: 1500, ratingDeviation: 350, piecesPlaced: 0 },
    board: initialState.board, currentTurn: initialState.currentTurn, phase: initialState.phase,
    mode: 'casual', moves: [], status: 'active',
    clock: { black: DEFAULT_TIME_MS, white: DEFAULT_TIME_MS },
    lastMoveTimestamp: Date.now(), createdAt: Date.now(), spectators: 0, positionHistory: [],
    isBotGame: true, botStrength: strength,
  };
  botGameStore.set(gameId, gameData);
  res.json({ gameId, game: gameData });
});

app.get('/api/bot/game/:gameId', async (req, res) => {
  const game = botGameStore.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Bot game not found' });
  if (game.whitePlayer.uid !== req.user.uid) return res.status(403).json({ error: 'Not your game' });
  res.json(game);
});

app.post('/api/bot/game/:gameId/move', async (req, res) => {
  const { from, to } = req.body;
  const game = botGameStore.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Bot game not found' });
  if (game.whitePlayer.uid !== req.user.uid) return res.status(403).json({ error: 'Not your game' });
  if (game.status !== 'active') return res.status(400).json({ error: 'Game is not active' });
  if (game.currentTurn !== 'white') return res.status(400).json({ error: 'Not your turn' });

  const state = { board: game.board, currentTurn: game.currentTurn, phase: game.phase, moves: game.moves || [], positionHistory: game.positionHistory || [] };
  const result = applyMove(state, 'white', from, to);
  if (result.error) return res.status(400).json({ error: result.error });

  const timeElapsed = Date.now() - (game.lastMoveTimestamp || Date.now());
  const newClock = { ...game.clock, white: Math.max(0, game.clock.white - timeElapsed) };

  if (newClock.white <= 0) {
    game.status = 'finished';
    game.result = { winner: 'black', method: 'timeout', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
    botGameStore.set(req.params.gameId, game);
    return res.json({ gameOver: true, result: game.result, game });
  }

  if (result.gameOver) {
    game.status = 'finished';
    game.board = state.board; game.moves = state.moves; game.positionHistory = state.positionHistory; game.currentTurn = state.currentTurn; game.phase = state.phase;
    game.result = { winner: result.draw ? 'draw' : result.winner, method: result.draw ? (game.phase === 'movement' && state.moves.length >= 100 ? '100-ply' : 'threefold-repetition') : 'four-in-a-row', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
    botGameStore.set(req.params.gameId, game);
    return res.json({ gameOver: true, result: game.result, game });
  }

  game.board = state.board; game.moves = state.moves; game.positionHistory = state.positionHistory; game.currentTurn = state.currentTurn; game.phase = state.phase; game.clock = newClock; game.lastMoveTimestamp = Date.now();
  botGameStore.set(req.params.gameId, game);

  const botResult = executeBotMoveSync(game);
  if (botResult.gameOver) {
    game.status = 'finished';
    game.result = botResult.result;
    botGameStore.set(req.params.gameId, game);
    return res.json({ gameOver: true, result: botResult.result, game });
  }

  botGameStore.set(req.params.gameId, game);
  res.json({ gameOver: false, game });
});

app.post('/api/bot/game/:gameId/resign', async (req, res) => {
  const game = botGameStore.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Bot game not found' });
  if (game.whitePlayer.uid !== req.user.uid) return res.status(403).json({ error: 'Not your game' });
  game.status = 'finished';
  game.result = { winner: 'black', method: 'resign', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
  botGameStore.set(req.params.gameId, game);
  res.json({ success: true, game });
});

function executeBotMoveSync(game) {
  const strength = game.botStrength || 'hard';
  const timeElapsed = Date.now() - (game.lastMoveTimestamp || Date.now());
  const newClock = { ...game.clock, black: Math.max(0, game.clock.black - timeElapsed) };

  if (newClock.black <= 0) {
    const gameResult = { winner: 'white', method: 'timeout', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
    game.clock = newClock;
    return { gameOver: true, result: gameResult };
  }

  const state = { board: game.board, currentTurn: game.currentTurn, phase: game.phase, moves: game.moves || [], positionHistory: game.positionHistory || [] };
  const botMove = engineFindBestMove(state, 'black', STRENGTH_DEPTH[strength] || 6);
  if (!botMove) return { gameOver: false };
  const moveResult = applyMove(state, 'black', botMove.from, botMove.to);
  if (moveResult.error) return { gameOver: false };

  game.board = state.board; game.moves = state.moves; game.positionHistory = state.positionHistory; game.currentTurn = state.currentTurn; game.phase = state.phase; game.clock = newClock; game.lastMoveTimestamp = Date.now();

  if (moveResult.gameOver) {
    const gameResult = { winner: moveResult.draw ? 'draw' : moveResult.winner, method: moveResult.draw ? (game.phase === 'movement' && state.moves.length >= 100 ? '100-ply' : 'threefold-repetition') : 'four-in-a-row', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
    return { gameOver: true, result: gameResult };
  }
  return { gameOver: false };
}

app.post('/api/matchmaking/leave', async (req, res) => { await db.ref(`queue/${req.user.uid}`).remove(); res.json({ success: true }); });

app.get('/api/matchmaking/queue-size', async (req, res) => { const snap = await db.ref('queue').once('value'); if (!snap.exists()) return res.json({ size: 0 }); res.json({ size: Object.keys(normalizeArrays(snap.val())).length }); });

app.get('/api/matchmaking/check', async (req, res) => {
  const mySnap = await db.ref(`queue/${req.user.uid}`).once('value');
  if (!mySnap.exists()) return res.json({ matched: false });
  const myEntry = normalizeArrays(mySnap.val());
  const snap = await db.ref('queue').once('value');
  if (!snap.exists()) return res.json({ matched: false });
  const entries = Object.values(normalizeArrays(snap.val()));
  const opponents = entries.filter(e => e.uid !== req.user.uid && e.mode === myEntry.mode && Math.abs(e.rating - myEntry.rating) <= myEntry.range);
  if (opponents.length === 0) {
    await db.ref(`queue/${req.user.uid}`).update({ range: Math.min(myEntry.range + 50, 500) });
    return res.json({ matched: false });
  }
  const opponent = opponents[0];

  const removedA = await db.ref(`queue/${req.user.uid}`).transaction(current => { if (current) return null; return current; });
  const removedB = await db.ref(`queue/${opponent.uid}`).transaction(current => { if (current) return null; return current; });
  if (!removedA.committed || !removedB.committed) {
    return res.json({ matched: false });
  }

  const gameId = `${Date.now()}_${req.user.uid.slice(0, 6)}_${opponent.uid.slice(0, 6)}`;
  const initialState = createInitialGameState();
  const [blackData, whiteData] = await Promise.all([rtdbGet(`users/${req.user.uid}`), rtdbGet(`users/${opponent.uid}`)]);
  const gameData = { id: gameId, blackPlayer: { uid: req.user.uid, username: blackData.username || 'Player', rating: blackData.rating || 1500, ratingDeviation: blackData.ratingDeviation || 350, piecesPlaced: 0 }, whitePlayer: { uid: opponent.uid, username: opponent.username || 'Player', rating: opponent.rating, ratingDeviation: opponent.ratingDeviation, piecesPlaced: 0 }, board: initialState.board, currentTurn: initialState.currentTurn, phase: initialState.phase, mode: myEntry.mode, moves: [], status: 'active', clock: { black: DEFAULT_TIME_MS, white: DEFAULT_TIME_MS }, lastMoveTimestamp: Date.now(), createdAt: Date.now(), spectators: 0, positionHistory: [] };
	await createActiveGame(gameData);
	sendSSE(opponent.uid, { type: 'match_found', gameId });
	sendSSE(req.user.uid, { type: 'match_found', gameId });
  startClockTimer(gameId);
  res.json({ matched: true, gameId });
});

app.get('/api/active-games', async (req, res) => {
  const cacheKey = 'active_games';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5000) {
    return res.json(cached.data);
  }
  const snap = await db.ref('activeGames').once('value'); if (!snap.exists()) { cache.set(cacheKey, { data: [], ts: Date.now() }); return res.json([]); }
  const games = [];
  snap.forEach(child => { const g = decodeGameFromStorage(child.val()); if (g.status === 'active') games.push({ id: child.key, blackPlayer: g.blackPlayer, whitePlayer: g.whitePlayer, mode: g.mode, phase: g.phase, status: g.status }); });
  cache.set(cacheKey, { data: games, ts: Date.now() });
  res.json(games);
});

app.get('/api/game/:gameId', async (req, res) => {
  const snap = await db.ref(`activeGames/${req.params.gameId}`).once('value');
  if (!snap.exists()) {
    const completed = await getFinishedGame(req.params.gameId);
    if (completed) return res.json(completed);
    return res.status(404).json({ error: 'Game not found' });
  }
  res.json(decodeGameFromStorage(snap.val()));
});

async function executeBotMove(gameId, game) {
  try {
    const strength = game.botStrength || 'hard';
    const state = { board: game.board, currentTurn: game.currentTurn, phase: game.phase, moves: game.moves || [], positionHistory: game.positionHistory || [] };
    const botMove = engineFindBestMove(state, 'black', STRENGTH_DEPTH[strength] || 6);
    if (!botMove) return;
    const moveResult = applyMove(state, 'black', botMove.from, botMove.to);
    if (moveResult.error) return;
    const timeElapsed = Date.now() - (game.lastMoveTimestamp || Date.now());
    const newClock = { ...game.clock, black: Math.max(0, game.clock.black - timeElapsed) };
    if (moveResult.gameOver) {
      const gameResult = { winner: moveResult.draw ? 'draw' : moveResult.winner, method: moveResult.draw ? (game.phase === 'movement' && state.moves.length >= 100 ? '100-ply' : 'threefold-repetition') : 'four-in-a-row', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
      await finalizeGame(game, gameId, state, newClock, state.moves[state.moves.length - 1], gameResult);
      sendSSE(game.whitePlayer.uid, { type: 'game_over', gameId });
      return;
    }
    await db.ref(`activeGames/${gameId}`).update(encodeGameForStorage({ board: state.board, currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory, lastMoveTimestamp: Date.now(), clock: newClock }));
    sendSSE(game.whitePlayer.uid, { type: 'move_made', gameId, clock: newClock });
    startClockTimer(gameId);
  } catch {}
}

const STRENGTH_DEPTH = { easy: 1, medium: 3, hard: 6, stockfish: 10 };

app.post('/api/game/:gameId/move', async (req, res) => {
  const { from, to } = req.body;
  const actingUid = req.user?.uid || req.query.guestUid || req.body.guestUid;
  if (!actingUid) return res.status(401).json({ error: 'Authentication required' });
  const gameRef = db.ref(`activeGames/${req.params.gameId}`);
  const snap = await gameRef.once('value');
  if (!snap.exists()) return res.status(404).json({ error: 'Game not found' });
  const game = decodeGameFromStorage(snap.val());
  if (game.status !== 'active') return res.status(400).json({ error: 'Game is not active' });
  const playerColor = game.blackPlayer.uid === actingUid ? 'black' : game.whitePlayer.uid === actingUid ? 'white' : null;
  if (!playerColor) return res.status(403).json({ error: 'Not a player' });
  if (game.currentTurn !== playerColor) return res.status(400).json({ error: 'Not your turn' });
  const state = { board: game.board, currentTurn: game.currentTurn, phase: game.phase, moves: game.moves || [], positionHistory: game.positionHistory || [] };
  const result = applyMove(state, playerColor, from, to);
  if (result.error) return res.status(400).json({ error: result.error });
  const timeElapsed = Date.now() - (game.lastMoveTimestamp || Date.now());
  const newClock = { ...game.clock, [playerColor]: Math.max(0, game.clock[playerColor] - timeElapsed) };

  if (newClock[playerColor] <= 0) {
    const timeoutWinner = playerColor === 'black' ? 'white' : 'black';
    const gameResult = { winner: timeoutWinner, method: 'timeout', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
    await finalizeGame(game, req.params.gameId, state, newClock, state.moves[state.moves.length - 1], gameResult);
    broadcastToGame(game, { type: 'game_over', gameId: req.params.gameId });
    return res.json({ gameOver: true, result: gameResult });
  }

  if (result.gameOver) {
    const gameResult = { winner: result.draw ? 'draw' : result.winner, method: result.draw ? (game.phase === 'movement' && state.moves.length >= 100 ? '100-ply' : 'threefold-repetition') : 'four-in-a-row', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
    await finalizeGame(game, req.params.gameId, state, newClock, state.moves[state.moves.length - 1], gameResult);
    broadcastToGame(game, { type: 'game_over', gameId: req.params.gameId });
    return res.json({ gameOver: true, result: gameResult });
  }

  await gameRef.update(encodeGameForStorage({ board: state.board, currentTurn: state.currentTurn, phase: state.phase, moves: state.moves, positionHistory: state.positionHistory, lastMoveTimestamp: Date.now(), clock: newClock }));
    sendSSE(game.blackPlayer.uid, { type: 'move_made', gameId: req.params.gameId, clock: newClock });
    sendSSE(game.whitePlayer.uid, { type: 'move_made', gameId: req.params.gameId, clock: newClock });
  startClockTimer(req.params.gameId);

  res.json({ gameOver: false });
});

app.post('/api/game/:gameId/resign', async (req, res) => {
  const actingUid = req.user?.uid || req.query.guestUid;
  if (!actingUid) return res.status(401).json({ error: 'Authentication required' });
  const gameRef = db.ref(`activeGames/${req.params.gameId}`);
  const snap = await gameRef.once('value');
  if (!snap.exists()) return res.status(404).json({ error: 'Game not found' });
  const game = decodeGameFromStorage(snap.val());

  // Only the player in the game can resign
  const playerColor = game.blackPlayer.uid === actingUid ? 'black' : game.whitePlayer.uid === actingUid ? 'white' : null;
  if (!playerColor) return res.status(403).json({ error: 'Not a player in this game' });

  const winner = playerColor === 'black' ? 'white' : 'black';
  const gameResult = { winner, method: 'resign', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
  const state = { board: game.board, currentTurn: game.currentTurn, phase: game.phase, moves: game.moves || [], positionHistory: game.positionHistory || [] };
  await finalizeGame(game, req.params.gameId, state, game.clock, null, gameResult);
  broadcastToGame(game, { type: 'game_over', gameId: req.params.gameId });
  res.json({ success: true });
});

app.get('/api/admin/players', async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
  const allUsers = await rtdbGet('users');
  if (!allUsers) return res.json([]);
  const allBans = await rtdbGet('bans') || {};
  const players = Object.entries(allUsers).map(([uid, data]) => ({
    uid, username: data.username || 'Player', email: data.email || '', rating: data.rating || 1500,
    gamesPlayed: data.gamesPlayed || 0, susScore: data.susScore || 0,
    internalActionFlags: data.internalActionFlags || 0,
    banned: allBans[uid] ? (allBans[uid].permanent ? 'permanent' : 'temporary') : false,
    banReason: allBans[uid]?.reason || null, banUntil: allBans[uid]?.until || null,
  }));
  res.json(players);
});

app.post('/api/admin/ban', async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
  const { uid, reason, permanent, refund } = req.body;
  if (!uid) return res.status(400).json({ error: 'UID required' });
  
  const banReason = reason || 'Admin ban';
  await banUser(uid, permanent || false, banReason);
  
  if (permanent && refund !== false) await refundRatingsForBannedPlayer(uid);
  
  await db.ref(`users/${uid}`).update({ susScore: 50 });
  await disableFirebaseAccount(uid);
  sendSSE(uid, { type: 'banned', reason: banReason });
  res.json({ success: true });
});

app.post('/api/admin/unban', async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'UID required' });
  await db.ref(`bans/${uid}`).remove();
  await db.ref(`users/${uid}`).update({ susScore: 0 });
  invalidateBanCache(uid);
  await enableFirebaseAccount(uid);
  res.json({ success: true });
});

app.post('/api/admin/refund-rating', async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
  const { uid, amount, reason, gameId } = req.body;
  if (!uid || !amount) return res.status(400).json({ error: 'UID and amount required' });
  const userSnap = await db.ref(`users/${uid}`).once('value');
  if (!userSnap.exists()) return res.status(404).json({ error: 'User not found' });
  const userData = userSnap.val();
  const newRating = Math.max(100, (userData.rating || 1500) + amount);
  await db.ref(`users/${uid}`).update({ rating: newRating });
  const notifRef = db.ref(`notifications/${uid}`).push();
  await notifRef.set({
    type: 'rating_refund',
    message: reason || `Admin rating refund: +${amount}`,
    amount,
    gameId: gameId || null,
    createdAt: Date.now(),
    read: false,
  });
  sendSSE(uid, { type: 'rating_refund', amount, reason: reason || 'Admin rating refund' });
  res.json({ success: true, newRating });
});

app.get('/api/notifications', async (req, res) => {
  const uid = req.user.uid;
  const snap = await db.ref(`notifications/${uid}`).orderByChild('createdAt').once('value');
  if (!snap.exists()) return res.json([]);
  const notifs = [];
  snap.forEach(child => {
    notifs.push({ id: child.key, ...child.val() });
  });
  res.json(notifs.reverse().slice(0, 50));
});

app.post('/api/notifications/:notifId/delete', async (req, res) => {
  const uid = req.user.uid;
  const notifSnap = await db.ref(`notifications/${uid}/${req.params.notifId}`).once('value');
  if (!notifSnap.exists()) return res.status(404).json({ error: 'Notification not found' });
  await db.ref(`notifications/${uid}/${req.params.notifId}`).remove();
  res.json({ success: true });
});

app.post('/api/notifications/mark-read', async (req, res) => {
  const uid = req.user.uid;
  const snap = await db.ref(`notifications/${uid}`).once('value');
  if (!snap.exists()) return res.json({ success: true });
  const updates = {};
  snap.forEach(child => {
    if (!child.val().read) updates[`${child.key}/read`] = true;
  });
  if (Object.keys(updates).length > 0) await db.ref(`notifications/${uid}`).update(updates);
  res.json({ success: true });
});

app.post('/api/admin/end-match', async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: 'GameId required' });
  const gameRef = db.ref(`activeGames/${gameId}`);
  const snap = await gameRef.once('value');
  if (!snap.exists()) return res.status(404).json({ error: 'Game not found' });
  const game = decodeGameFromStorage(snap.val());
  if (game.status !== 'active') return res.status(400).json({ error: 'Game is not active' });
  const gameResult = { winner: 'draw', method: 'admin-intervention', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
  const state = { board: game.board, currentTurn: game.currentTurn, phase: game.phase, moves: game.moves || [], positionHistory: game.positionHistory || [] };
  await finalizeGame(game, gameId, state, game.clock, null, gameResult);
  broadcastToGame(game, { type: 'game_over', gameId });
  res.json({ success: true });
});

app.delete('/api/admin/cleanup-active-games', async (req, res) => {
  if (!req.user || req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
  const snap = await db.ref('activeGames').once('value');
  if (!snap.exists()) return res.json({ cleaned: 0 });
  let count = 0; const deletes = [];
  snap.forEach(child => { const g = child.val(); if (!g.board) { deletes.push(db.ref(`activeGames/${child.key}`).remove()); count++; } });
  await Promise.all(deletes); res.json({ cleaned: count });
});

app.get('/api/ban-check/:identifier', async (req, res) => {
  const identifier = req.params.identifier;
  if (!identifier) return res.status(400).json({ error: 'Identifier required' });
  let uid = identifier;
  if (identifier.includes('@')) {
    try {
      const userRecord = await auth.getUserByEmail(identifier);
      uid = userRecord.uid;
    } catch {
      return res.json({ banned: false });
    }
  }
  const status = await getBanStatus(uid);
  res.json(status);
});

async function disableFirebaseAccount(uid) {
  try {
    await auth.updateUser(uid, { disabled: true });
  } catch (err) {
    console.error(`Failed to disable account ${uid}:`, err.message);
  }
}

async function enableFirebaseAccount(uid) {
  try {
    await auth.updateUser(uid, { disabled: false });
  } catch (err) {
    console.error(`Failed to enable account ${uid}:`, err.message);
  }
}

async function serverPollForSusAndQueuedReview() {
  try {
    const susSnap = await db.ref('users').orderByChild('susScore').startAt(100).limitToFirst(10).once('value');
    if (susSnap.exists()) {
      susSnap.forEach(child => {
        const uid = child.key;
        const data = child.val();
        db.ref(`flaggedGames/sus_${uid}_${Date.now()}`).set({
          gameId: `sus_${uid}_${Date.now()}`,
          uid,
          username: data.username || 'Player',
          matchRate: 100,
          totalMoves: 0,
          matchingMoves: 0,
          reason: `Suspicion score reached ${data.susScore || 0} (threshold: 100)`,
          susIncrease: 0,
          blackPlayer: null,
          whitePlayer: null,
          moves: [],
          reviewedAt: null,
          dismissedAt: null,
          createdAt: Date.now(),
          status: 'pending',
        });
      });
    }

    const recentEnd = Date.now();
    const recentStart = recentEnd - 24 * 60 * 60 * 1000;
    const finishedGames = await getFinishedGames(50);
    const recentUnreviewed = finishedGames.filter(({ id, game: g }) => {
      if (g.blackPlayer?.uid === 'bot' || g.whitePlayer?.uid === 'bot') return false;
      if (!g.finishedAt || g.finishedAt < recentStart) return false;
      return true;
    });

    if (recentUnreviewed.length === 0) return;

    const reviewedSnap = await db.ref('reviewedGames').once('value');
    const reviewed = reviewedSnap.exists() ? new Set(Object.keys(reviewedSnap.val())) : new Set();

    const toReview = recentUnreviewed.filter(({ id }) => !reviewed.has(id)).slice(0, 3);

    for (const { id, game } of toReview) {
      const humanUid = game.blackPlayer.uid !== 'bot' ? game.blackPlayer.uid : game.whitePlayer.uid;
      const humanColor = game.blackPlayer.uid !== 'bot' ? 'black' : 'white';
      if (humanUid === 'bot') { await db.ref(`reviewedGames/${id}`).set(true); continue; }

      const moves = game.result?.moves || [];
      if (!moves || moves.length < 4) { await db.ref(`reviewedGames/${id}`).set(true); continue; }

      const simState = createInitialGameState();
      let matchingMoves = 0;
      let totalMoves = 0;

      for (const move of moves) {
        if (move.player !== humanColor) {
          if (simState.phase === 'placement') applyPlacement(simState, move.player, move.to);
          else applyMovement(simState, move.player, move.from, move.to);
          continue;
        }
        totalMoves++;
        const engineMove = engineFindBestMoveForPlayer(simState, humanColor, 6);
        if (engineMove) {
          const playerFrom = move.from ? `${move.from.row},${move.from.col}` : null;
          const playerTo = `${move.to.row},${move.to.col}`;
          const engineFrom = engineMove.from ? `${engineMove.from.row},${engineMove.from.col}` : null;
          const engineTo = `${engineMove.to.row},${engineMove.to.col}`;
          if (playerTo === engineTo && playerFrom === engineFrom) matchingMoves++;
        }
        if (simState.phase === 'placement') applyPlacement(simState, humanColor, move.to);
        else applyMovement(simState, humanColor, move.from, move.to);
      }

      if (totalMoves >= 4) {
        const matchRate = matchingMoves / totalMoves;
        let susIncrease = 0;
        let flagReason = '';
        if (matchRate >= 0.95) { susIncrease = 40; flagReason = 'Very high engine match rate (>=95%)'; }
        else if (matchRate >= 0.85) { susIncrease = 25; flagReason = 'High engine match rate (>=85%)'; }
        else if (matchRate >= 0.75) { susIncrease = 15; flagReason = 'Elevated engine match rate (>=75%)'; }
        else if (matchRate >= 0.65) { susIncrease = 5; flagReason = 'Moderate engine match rate (>=65%)'; }

        if (susIncrease > 0) {
          const userSnap = await db.ref(`users/${humanUid}`).once('value');
          if (userSnap.exists()) {
            const currentSus = userSnap.val().susScore || 0;
            const newSus = currentSus + susIncrease;
            await db.ref(`users/${humanUid}`).update({ susScore: newSus });

            await db.ref(`flaggedGames/${id}`).set({
              gameId: id,
              uid: humanUid,
              username: userSnap.val().username || 'Player',
              matchRate: Math.round(matchRate * 100),
              totalMoves,
              matchingMoves,
              reason: flagReason,
              susIncrease,
              blackPlayer: game.blackPlayer,
              whitePlayer: game.whitePlayer,
              moves: game.result?.moves || [],
              reviewedAt: null,
              dismissedAt: null,
              createdAt: Date.now(),
              status: 'pending',
            });
          }
        }
      }
      await db.ref(`reviewedGames/${id}`).set(true);
    }
  } catch (err) {
    console.error('Server poll error:', err.message);
  }
}

// Archive and clean up old move history (older than 2 months)
async function cleanupOldMoveHistory() {
  try {
    const twoMonthsAgo = Date.now() - (60 * 24 * 60 * 60 * 1000); // 60 days in milliseconds
    const finishedGames = await getFinishedGames();
    
    const updates = {};
    finishedGames.forEach(({ id, game }) => {
      if (game.finishedAt && game.finishedAt < twoMonthsAgo) {
        // Archive to moveHistory collection
        if (game.result && game.result.moves) {
          const archived = {
            gameId: id,
            blackUid: game.blackPlayer?.uid,
            whiteUid: game.whitePlayer?.uid,
            moves: game.result.moves,
            finishedAt: game.finishedAt,
            archivedAt: Date.now(),
          };
          updates[`moveHistory/${id}`] = archived;
        }
      }
    });
    
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
  } catch (err) {
    console.error('Cleanup move history error:', err.message);
  }
}

// Mark users as offline after 5 minutes of inactivity
async function updateUserOfflineStatus() {
  try {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const allUsers = await rtdbGet('users');
    if (!allUsers) return;
    
    const updates = {};
    Object.entries(allUsers).forEach(([uid, data]) => {
      if (data.online && data.lastSeen && data.lastSeen < fiveMinutesAgo) {
        updates[`users/${uid}/online`] = false;
      }
    });
    
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
  } catch (err) {
    console.error('Update offline status error:', err.message);
  }
}

// Add endpoint to retrieve archived move history for validation
app.get('/api/admin/move-history/:gameId', async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });

  const { gameId } = req.params;
  const data = await rtdbGet(`moveHistory/${gameId}`);
  if (!data) return res.status(404).json({ error: 'Move history not found' });
  res.json(data);
});

app.post('/api/challenge/create', async (req, res) => {
  const { mode, timeControl } = req.body;
  const validMode = mode && ['rated', 'casual'].includes(mode) ? mode : 'casual';
  const validTimeControl = typeof timeControl === 'number' && timeControl >= 30000 && timeControl <= 3600000 ? timeControl : DEFAULT_TIME_MS;
  const fromUid = req.user.uid;
  const fromData = await rtdbGet(`users/${fromUid}`);
  if (!fromData) return res.status(404).json({ error: 'User not found' });

  const busy = await isUserBusy(fromUid);
  if (busy.busy) return res.status(409).json({ error: 'You are already in a match', gameId: busy.gameId });

  const code = crypto.randomBytes(6).toString('base64url');
  await db.ref(`challenges/${code}`).set({
    fromUid,
    fromUsername: fromData.username || 'Player',
    fromRating: fromData.rating || 1500,
    mode: validMode,
    timeControl: validTimeControl,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });
  res.json({ code, url: `/challenge/${code}` });
});

app.get('/api/challenge/info/:code', async (req, res) => {
  const challenge = await rtdbGet(`challenges/${req.params.code}`);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found or expired' });
  if (challenge.expiresAt < Date.now()) {
    await db.ref(`challenges/${req.params.code}`).remove();
    return res.status(404).json({ error: 'Challenge expired' });
  }
  res.json({
    fromUsername: challenge.fromUsername,
    fromRating: challenge.fromRating,
    mode: challenge.mode,
    timeControl: challenge.timeControl,
  });
});

app.post('/api/challenge/accept/:code', async (req, res) => {
  const challenge = await rtdbGet(`challenges/${req.params.code}`);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found or expired' });
  if (challenge.expiresAt < Date.now()) {
    await db.ref(`challenges/${req.params.code}`).remove();
    return res.status(404).json({ error: 'Challenge expired' });
  }

  let toUid = req.user?.uid;
  let toUsername = 'Guest';
  let toRating = 1500;
  let toRatingDeviation = 350;

  if (toUid) {
    const toData = await rtdbGet(`users/${toUid}`);
    if (toData) {
      toUsername = toData.username || 'Player';
      toRating = toData.rating || 1500;
      toRatingDeviation = toData.ratingDeviation || 350;
    }
  } else {
    toUid = `guest_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  }

  if (toUid === challenge.fromUid) return res.status(400).json({ error: 'Cannot accept your own challenge' });

  const creatorBusy = await isUserBusy(challenge.fromUid);
  if (creatorBusy.busy) return res.status(409).json({ error: 'Challenge creator is already in a match', gameId: creatorBusy.gameId });

  if (!toUid.startsWith('guest_')) {
    const accepterBusy = await isUserBusy(toUid);
    if (accepterBusy.busy) return res.status(409).json({ error: 'You are already in a match', gameId: accepterBusy.gameId });
  }

  await db.ref(`challenges/${req.params.code}`).remove();

  const gameId = `${Date.now()}_${challenge.fromUid.slice(0, 6)}_${toUid.slice(0, 6)}`;
  const initialState = createInitialGameState();
  const timeMs = challenge.timeControl || DEFAULT_TIME_MS;
  const gameData = {
    id: gameId,
    blackPlayer: { uid: challenge.fromUid, username: challenge.fromUsername || 'Player', rating: challenge.fromRating, ratingDeviation: 350, piecesPlaced: 0 },
    whitePlayer: { uid: toUid, username: toUsername, rating: toRating, ratingDeviation: toRatingDeviation, piecesPlaced: 0 },
    board: initialState.board, currentTurn: initialState.currentTurn, phase: initialState.phase,
    mode: challenge.mode || 'casual', moves: [], status: 'active',
    clock: { black: timeMs, white: timeMs },
    lastMoveTimestamp: Date.now(), createdAt: Date.now(), spectators: 0, positionHistory: [],
  };
	await createActiveGame(gameData);
	sendSSE(challenge.fromUid, { type: 'match_found', gameId });
  startClockTimer(gameId);
  res.json({ gameId, isGuest: toUid.startsWith('guest_'), guestUid: toUid.startsWith('guest_') ? toUid : undefined });
});

app.post('/api/game/:gameId/draw-offer', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const gameRef = db.ref(`activeGames/${req.params.gameId}`);
  const snap = await gameRef.once('value');
  if (!snap.exists()) return res.status(404).json({ error: 'Game not found' });
  const game = decodeGameFromStorage(snap.val());
  if (game.status !== 'active') return res.status(400).json({ error: 'Game is not active' });
  const playerColor = game.blackPlayer.uid === req.user.uid ? 'black' : game.whitePlayer.uid === req.user.uid ? 'white' : null;
  if (!playerColor) return res.status(403).json({ error: 'Not a player' });
  const opponentUid = playerColor === 'black' ? game.whitePlayer.uid : game.blackPlayer.uid;
  sendSSE(opponentUid, { type: 'draw_offered', gameId: req.params.gameId, fromUid: req.user.uid });
  await gameRef.update({ drawOfferFrom: req.user.uid });
  res.json({ success: true });
});

app.post('/api/game/:gameId/draw-accept', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const gameRef = db.ref(`activeGames/${req.params.gameId}`);
  const snap = await gameRef.once('value');
  if (!snap.exists()) return res.status(404).json({ error: 'Game not found' });
  const game = decodeGameFromStorage(snap.val());
  if (game.status !== 'active') return res.status(400).json({ error: 'Game is not active' });
  const playerColor = game.blackPlayer.uid === req.user.uid ? 'black' : game.whitePlayer.uid === req.user.uid ? 'white' : null;
  if (!playerColor) return res.status(403).json({ error: 'Not a player' });
  if (game.drawOfferFrom === req.user.uid) return res.status(400).json({ error: 'Cannot accept your own draw offer' });
  const gameResult = { winner: 'draw', method: 'draw-agreed', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
  const state = { board: game.board, currentTurn: game.currentTurn, phase: game.phase, moves: game.moves || [], positionHistory: game.positionHistory || [] };
  await finalizeGame(game, req.params.gameId, state, game.clock, null, gameResult);
  broadcastToGame(game, { type: 'game_over', gameId: req.params.gameId });
  res.json({ success: true });
});

app.post('/api/game/:gameId/draw-reject', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const gameRef = db.ref(`activeGames/${req.params.gameId}`);
  const snap = await gameRef.once('value');
  if (!snap.exists()) return res.status(404).json({ error: 'Game not found' });
  const game = decodeGameFromStorage(snap.val());
  if (game.status !== 'active') return res.status(400).json({ error: 'Game is not active' });
  await gameRef.update({ drawOfferFrom: null });
  const offererUid = game.drawOfferFrom;
  if (offererUid) sendSSE(offererUid, { type: 'draw_rejected', gameId: req.params.gameId });
  res.json({ success: true });
});

app.post('/api/game/:gameId/rematch', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const oldGame = await getFinishedGame(req.params.gameId);
  if (!oldGame) return res.status(404).json({ error: 'Game not found' });
  if (oldGame.blackPlayer.uid !== req.user.uid && oldGame.whitePlayer.uid !== req.user.uid) return res.status(403).json({ error: 'Not a player in this game' });
  const opponentUid = oldGame.blackPlayer.uid === req.user.uid ? oldGame.whitePlayer.uid : oldGame.blackPlayer.uid;
  const [requesterBusy, opponentBusy] = await Promise.all([isUserBusy(req.user.uid), isUserBusy(opponentUid)]);
  if (requesterBusy.busy) return res.status(409).json({ error: 'You are already in a match', gameId: requesterBusy.gameId });
  if (opponentBusy.busy) return res.status(409).json({ error: 'Opponent is already in a match', gameId: opponentBusy.gameId });

  const requester = oldGame.blackPlayer.uid === req.user.uid ? oldGame.blackPlayer : oldGame.whitePlayer;
  const requestRef = db.ref('rematchRequests').push();
  const request = {
    id: requestRef.key,
    oldGameId: req.params.gameId,
    fromUid: req.user.uid,
    toUid: opponentUid,
    fromUsername: requester.username || 'Player',
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  await requestRef.set(request);

  const notifRef = db.ref(`notifications/${opponentUid}`).push();
  await notifRef.set({
    type: 'rematch_request',
    message: `${request.fromUsername} wants a rematch`,
    fromUid: req.user.uid,
    fromUsername: request.fromUsername,
    rematchRequestId: requestRef.key,
    gameId: req.params.gameId,
    createdAt: Date.now(),
    read: false,
  });

  sendSSE(opponentUid, {
    type: 'rematch_request',
    message: `${request.fromUsername} wants a rematch`,
    fromUid: req.user.uid,
    fromUsername: request.fromUsername,
    rematchRequestId: requestRef.key,
    gameId: req.params.gameId,
  });
  res.json({ success: true, rematchRequestId: requestRef.key });
});

app.post('/api/rematch/:requestId/accept', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const requestRef = db.ref(`rematchRequests/${req.params.requestId}`);
  const requestSnap = await requestRef.once('value');
  if (!requestSnap.exists()) return res.status(404).json({ error: 'Rematch request not found' });
  const request = normalizeArrays(requestSnap.val());
  if (request.status !== 'pending') return res.status(400).json({ error: 'Rematch request is no longer pending' });
  if (request.expiresAt && request.expiresAt < Date.now()) {
    await requestRef.update({ status: 'expired' });
    return res.status(400).json({ error: 'Rematch request expired' });
  }
  if (request.toUid !== req.user.uid) return res.status(403).json({ error: 'This rematch request is not for you' });

  const oldGame = await getFinishedGame(request.oldGameId);
  if (!oldGame) return res.status(404).json({ error: 'Original game not found' });
  const [requesterBusy, accepterBusy] = await Promise.all([isUserBusy(request.fromUid), isUserBusy(request.toUid)]);
  if (requesterBusy.busy) return res.status(409).json({ error: 'Opponent is already in a match', gameId: requesterBusy.gameId });
  if (accepterBusy.busy) return res.status(409).json({ error: 'You are already in a match', gameId: accepterBusy.gameId });

  try {
    const { gameId } = await createGameFromRematch(oldGame, request.fromUid);
    await requestRef.update({ status: 'accepted', acceptedAt: Date.now(), newGameId: gameId });
    sendSSE(request.fromUid, { type: 'rematch_accepted', gameId });
    sendSSE(request.toUid, { type: 'rematch_accepted', gameId });
    res.json({ gameId });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create rematch' });
  }
});

app.get('/api/game-history', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const lastKey = req.query.lastKey || null;
  const uid = req.user.uid;
  const finishedGames = await getFinishedGames();
  if (finishedGames.length === 0) return res.json({ games: [], hasMore: false });
  const games = [];
  let pastLastKey = !lastKey;
  finishedGames.forEach(({ id, game: g }) => {
    if (g.blackPlayer?.uid !== uid && g.whitePlayer?.uid !== uid) return;
    if (!pastLastKey) {
      if (id === lastKey) pastLastKey = true;
      return;
    }
    const isBlack = g.blackPlayer?.uid === uid;
    const opponent = isBlack ? g.whitePlayer : g.blackPlayer;
    const result = g.result;
    let myResult = 'draw';
    if (result?.winner === 'draw') myResult = 'draw';
    else if ((result?.winner === 'black' && isBlack) || (result?.winner === 'white' && !isBlack)) myResult = 'win';
    else myResult = 'loss';
    const ratingChange = isBlack ? (result?.ratingChangeBlack || 0) : (result?.ratingChangeWhite || 0);
    games.push({
      id,
      opponent: opponent?.username || 'Player',
      opponentUid: opponent?.uid || '',
      result: myResult,
      mode: g.mode || 'casual',
      ratingChange,
      timestamp: g.finishedAt || 0,
      method: result?.method || '',
    });
  });
  games.sort((a, b) => b.timestamp - a.timestamp);
  const hasMore = games.length > limit;
  res.json({ games: games.slice(0, limit), hasMore });
});

app.get('/api/opponent-stats/:opponentUid', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const uid = req.user.uid;
  const opponentUid = req.params.opponentUid;
  const finishedGames = await getFinishedGames();
  let wins = 0, losses = 0, draws = 0;
  if (finishedGames.length > 0) {
    finishedGames.forEach(({ game: g }) => {
      if ((g.blackPlayer?.uid !== uid || g.whitePlayer?.uid !== opponentUid) &&
          (g.whitePlayer?.uid !== uid || g.blackPlayer?.uid !== opponentUid)) return;
      const isBlack = g.blackPlayer?.uid === uid;
      const winner = g.result?.winner;
      if (winner === 'draw') draws++;
      else if ((winner === 'black' && isBlack) || (winner === 'white' && !isBlack)) wins++;
      else losses++;
    });
  }
  res.json({ wins, losses, draws });
});

app.get('/api/rating-history', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const uid = req.user.uid;
  const finishedGames = await getFinishedGames();
  const history = [];
  if (finishedGames.length > 0) {
    const entries = [];
    finishedGames.forEach(({ game: g }) => {
      if (g.blackPlayer?.uid !== uid && g.whitePlayer?.uid !== uid) return;
      const isBlack = g.blackPlayer?.uid === uid;
      const rating = isBlack ? g.result?.blackRating : g.result?.whiteRating;
      if (rating && g.finishedAt) entries.push({ timestamp: g.finishedAt, rating });
    });
    entries.sort((a, b) => a.timestamp - b.timestamp);
    history.push(...entries);
  }
  if (history.length === 0) {
    const userData = await rtdbGet(`users/${uid}`);
    history.push({ timestamp: Date.now(), rating: userData?.rating || 1500 });
  }
  res.json(history);
});

app.get('/api/activity-feed', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const uid = req.user.uid;
  const finishedGames = await getFinishedGames();
  const activities = [];
  if (finishedGames.length > 0) {
    finishedGames.forEach(({ id, game: g }) => {
      if (g.blackPlayer?.uid !== uid && g.whitePlayer?.uid !== uid) return;
      const isBlack = g.blackPlayer?.uid === uid;
      const opponent = isBlack ? g.whitePlayer : g.blackPlayer;
      const result = g.result;
      let myResult = 'draw';
      if (result?.winner === 'draw') myResult = 'draw';
      else if ((result?.winner === 'black' && isBlack) || (result?.winner === 'white' && !isBlack)) myResult = 'win';
      else myResult = 'loss';
      const ratingChange = isBlack ? (result?.ratingChangeBlack || 0) : (result?.ratingChangeWhite || 0);
      activities.push({
        id,
        type: myResult,
        message: `${myResult === 'win' ? 'Won' : myResult === 'loss' ? 'Lost' : 'Drew'} vs ${opponent?.username || 'Player'}`,
        timestamp: g.finishedAt || 0,
        ratingChange,
        opponent: opponent?.username,
        opponentUid: opponent?.uid,
      });
    });
  }
  activities.sort((a, b) => b.timestamp - a.timestamp);
  res.json(activities.slice(0, 20));
});

app.get('/api/leaderboard/weekly', async (req, res) => {
  const now = Date.now();
  const weekStart = now - (7 * 24 * 60 * 60 * 1000);
  const finishedGames = await getFinishedGames();
  const weekly = {};
  if (finishedGames.length > 0) {
    finishedGames.forEach(({ game: g }) => {
      if (!g.finishedAt || g.finishedAt < weekStart) return;
      [g.blackPlayer, g.whitePlayer].forEach(p => {
        if (!weekly[p.uid]) weekly[p.uid] = { uid: p.uid, username: p.username, rating: p.rating || 1500, wins: 0, losses: 0, draws: 0 };
      });
      if (g.result?.winner === 'draw') { weekly[g.blackPlayer.uid].draws++; weekly[g.whitePlayer.uid].draws++; }
      else if (g.result?.winner === 'black') { weekly[g.blackPlayer.uid].wins++; weekly[g.whitePlayer.uid].losses++; }
      else { weekly[g.whitePlayer.uid].wins++; weekly[g.blackPlayer.uid].losses++; }
    });
  }
  const entries = Object.values(weekly).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  res.json({ entries: entries.slice(0, 50) });
});

app.get('/api/leaderboard/monthly', async (req, res) => {
  const now = Date.now();
  const monthStart = now - (30 * 24 * 60 * 60 * 1000);
  const finishedGames = await getFinishedGames();
  const monthly = {};
  if (finishedGames.length > 0) {
    finishedGames.forEach(({ game: g }) => {
      if (!g.finishedAt || g.finishedAt < monthStart) return;
      [g.blackPlayer, g.whitePlayer].forEach(p => {
        if (!monthly[p.uid]) monthly[p.uid] = { uid: p.uid, username: p.username, rating: p.rating || 1500, wins: 0, losses: 0, draws: 0 };
      });
      if (g.result?.winner === 'draw') { monthly[g.blackPlayer.uid].draws++; monthly[g.whitePlayer.uid].draws++; }
      else if (g.result?.winner === 'black') { monthly[g.blackPlayer.uid].wins++; monthly[g.whitePlayer.uid].losses++; }
      else { monthly[g.whitePlayer.uid].wins++; monthly[g.blackPlayer.uid].losses++; }
    });
  }
  const entries = Object.values(monthly).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  res.json({ entries: entries.slice(0, 50) });
});

app.get('/api/admin/flagged-games', async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
  const snap = await db.ref('flaggedGames').once('value');
  if (!snap.exists()) return res.json([]);
  const flagged = [];
  snap.forEach(child => {
    const entry = normalizeArrays(child.val());
    if (entry.status === 'pending') {
      flagged.push({ id: child.key, ...entry });
    }
  });
  flagged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.json(flagged);
});

app.post('/api/admin/flagged-games/:flagId/ban', async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
  const { flagId } = req.params;
  const { permanent, reason } = req.body;
  const snap = await db.ref(`flaggedGames/${flagId}`).once('value');
  if (!snap.exists()) return res.status(404).json({ error: 'Flagged game not found' });
  const flag = snap.val();
  const uid = flag.uid;
  if (!uid) return res.status(400).json({ error: 'No UID on flagged game' });

  const banReason = reason || flag.reason || 'Admin ban after review';
  await banUser(uid, permanent || false, banReason);
  if (permanent) await refundRatingsForBannedPlayer(uid);
  await db.ref(`flaggedGames/${flagId}`).update({ status: 'banned', reviewedAt: Date.now(), banReason });
  await db.ref(`users/${uid}`).update({ susScore: 50 });
  await disableFirebaseAccount(uid);
  sendSSE(uid, { type: 'banned', reason: banReason });
  res.json({ success: true });
});

app.post('/api/admin/flagged-games/:flagId/dismiss', async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
  const { flagId } = req.params;
  const snap = await db.ref(`flaggedGames/${flagId}`).once('value');
  if (!snap.exists()) return res.status(404).json({ error: 'Flagged game not found' });
  const flag = snap.val();
  await db.ref(`flaggedGames/${flagId}`).update({ status: 'dismissed', dismissedAt: Date.now() });
  if (flag.uid) {
    const userSnap = await db.ref(`users/${flag.uid}`).once('value');
    if (userSnap.exists()) {
      const currentSus = userSnap.val().susScore || 0;
      const reduction = flag.susIncrease || 0;
      await db.ref(`users/${flag.uid}`).update({ susScore: Math.max(0, currentSus - reduction) });
    }
  }
  res.json({ success: true });
});

app.post('/api/game-review', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { moves, playerColor } = req.body;
  if (!moves || !Array.isArray(moves) || !playerColor) return res.status(400).json({ error: 'moves and playerColor required' });

  const simState = createInitialGameState();
  const moveAnalysis = [];
  let totalCpLoss = 0;
  let excellentCount = 0;
  let goodCount = 0;
  let inaccuracyCount = 0;
  let mistakeCount = 0;
  let blunderCount = 0;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move.player !== playerColor) {
      if (simState.phase === 'placement') applyPlacement(simState, move.player, move.to);
      else applyMovement(simState, move.player, move.from, move.to);
      if (!simState.currentTurn) simState.currentTurn = move.player === 'black' ? 'white' : 'black';
      continue;
    }

    const beforeEval = evaluateBoard(simState.board, playerColor);
    const engineMove = engineFindBestMoveForPlayer(simState, playerColor, 10);
    let bestEval = beforeEval;
    if (engineMove) {
      const ns = { board: cloneBoard(simState.board), currentTurn: simState.currentTurn, phase: simState.phase, moves: simState.moves, positionHistory: simState.positionHistory };
      if (simState.phase === 'placement') applyPlacement(ns, playerColor, engineMove.to);
      else applyMovement(ns, playerColor, engineMove.from, engineMove.to);
      bestEval = evaluateBoard(ns.board, playerColor);
    }

    const afterState = { board: cloneBoard(simState.board), currentTurn: simState.currentTurn, phase: simState.phase, moves: simState.moves, positionHistory: simState.positionHistory };
    if (simState.phase === 'placement') applyPlacement(afterState, playerColor, move.to);
    else applyMovement(afterState, playerColor, move.from, move.to);
    const afterEval = evaluateBoard(afterState.board, playerColor);

    const cpLoss = Math.max(0, bestEval - afterEval);
    let classification = 'book';
    if (cpLoss === 0) { classification = 'best'; excellentCount++; }
    else if (cpLoss <= 15) { classification = 'excellent'; excellentCount++; }
    else if (cpLoss <= 50) { classification = 'good'; goodCount++; }
    else if (cpLoss <= 150) { classification = 'inaccuracy'; inaccuracyCount++; }
    else if (cpLoss <= 400) { classification = 'mistake'; mistakeCount++; }
    else { classification = 'blunder'; blunderCount++; }

    totalCpLoss += cpLoss;

    moveAnalysis.push({
      moveNumber: move.moveNumber || i + 1,
      player: move.player,
      from: move.from || null,
      to: move.to,
      classification,
      cpLoss,
      engineMove: engineMove ? { from: engineMove.from || null, to: engineMove.to } : null,
      beforeEval,
      bestEval,
      afterEval,
    });

    simState.board = afterState.board;
    simState.currentTurn = playerColor === 'black' ? 'white' : 'black';
    if (afterState.phase === 'movement') simState.phase = 'movement';
  }

  const totalPlayerMoves = moveAnalysis.length;
  let accuracy = 100;
  if (totalPlayerMoves > 0) {
    const avgCpLoss = totalCpLoss / totalPlayerMoves;
    accuracy = Math.max(0, Math.min(100, Math.round(100 - avgCpLoss * 0.15)));
  }

  res.json({
    accuracy,
    moveAnalysis,
    totalPlayerMoves,
    excellentCount,
    goodCount,
    inaccuracyCount,
    mistakeCount,
    blunderCount,
  });
});

setInterval(() => { serverPollForSusAndQueuedReview().catch(err => console.error('Poll error:', err.message)); }, 5 * 60 * 1000);
setInterval(() => { cleanupOldMoveHistory().catch(err => console.error('Cleanup error:', err.message)); }, 7 * 24 * 60 * 60 * 1000);
setInterval(() => { updateUserOfflineStatus().catch(err => console.error('Offline status error:', err.message)); }, 5 * 60 * 1000);
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of lastUserActivityUpdate) {
    if (now - v > 300000) lastUserActivityUpdate.delete(k);
  }
  for (const [k, v] of banCache) {
    if (now - v.ts > BAN_CACHE_TTL * 2) banCache.delete(k);
  }
}, 60000);
serverPollForSusAndQueuedReview().catch(() => {});
cleanupOldMoveHistory().catch(() => {});
updateUserOfflineStatus().catch(() => {});

setInterval(() => {
  const now = Date.now();
  for (const [id, game] of botGameStore) {
    if (game.status === 'active') {
      const elapsed = now - (game.lastMoveTimestamp || game.createdAt);
      const currentClock = { ...game.clock };
      currentClock[game.currentTurn] = Math.max(0, currentClock[game.currentTurn] - elapsed);
      if (currentClock[game.currentTurn] <= 0) {
        const winner = game.currentTurn === 'black' ? 'white' : 'black';
        game.status = 'finished';
        game.result = { winner, method: 'timeout', ratingChangeBlack: 0, ratingChangeWhite: 0, blackRating: game.blackPlayer.rating, whiteRating: game.whitePlayer.rating };
        game.clock = currentClock;
        botGameStore.set(id, game);
      }
    }
    if (game.status === 'finished' && now - (game.lastMoveTimestamp || game.createdAt) > 3600000) botGameStore.delete(id);
    else if (now - game.createdAt > 86400000) botGameStore.delete(id);
  }
}, 5000);

app.use(express.static(path.join(__dirname, '../dist'), {
  maxAge: '365d',
  immutable: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);

  for (const [gameId, timers] of clockTimers) {
    clearTimeout(timers.tick);
    clearTimeout(timers.abandon);
  }
  clockTimers.clear();

  for (const [uid, clients] of sseClients) {
    clients.forEach(res => {
      try { res.write(`data: ${JSON.stringify({ type: 'server_shutdown', message: 'Server is restarting...' })}\n\n`); } catch {}
      try { res.end(); } catch {}
    });
  }
  sseClients.clear();

  for (const [uid, clients] of guestSseClients) {
    clients.forEach(res => {
      try { res.end(); } catch {}
    });
  }
  guestSseClients.clear();

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.log('Forcing exit after 10s');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
