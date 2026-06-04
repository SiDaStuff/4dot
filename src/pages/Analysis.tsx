import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AnalysisBoard } from '../components/game/AnalysisBoard';
import { createInitialGameState, applyMove, engineFindBestMove } from '../utils/gameLogic';
import { downloadPGN, parsePGN, movesToPGN } from '../utils/pgn';
import type { CellOwner, Position, Move, Game } from '../types';
import { BOARD_SIZE } from '../types';

type EngineStrength = 'easy' | 'medium' | 'hard' | 'stockfish';
const STRENGTH_DEPTH: Record<EngineStrength, number> = { easy: 1, medium: 3, hard: 6, stockfish: 10 };
const STRENGTH_LABELS: Record<EngineStrength, string> = {
  easy: 'Easy (Depth 1)',
  medium: 'Medium (Depth 3)',
  hard: 'Hard (Depth 6)',
  stockfish: 'Max (Depth 10)',
};

type TabMode = 'freeplay' | 'import' | 'recent';

interface AnalysisState {
  board: CellOwner[][];
  currentTurn: 'black' | 'white';
  phase: 'placement' | 'movement' | 'finished';
  moves: Move[];
  positionHistory: string[];
}

export function Analysis() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabMode>('freeplay');
  const [engineStrength, setEngineStrength] = useState<EngineStrength>('hard');
  const [showBestMove, setShowBestMove] = useState(true);
  const [gameState, setGameState] = useState<AnalysisState>(createInitialGameState());
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [viewingMove, setViewingMove] = useState(-1);
  const [pgnInput, setPgnInput] = useState('');
  const [pgnError, setPgnError] = useState('');
  const [recentGameId, setRecentGameId] = useState('');
  const [recentLoading, setRecentLoading] = useState(false);
  const [importedMoves, setImportedMoves] = useState<Move[] | null>(null);
  const [currentBestMove, setCurrentBestMove] = useState<{ from?: Position; to: Position } | null>(null);
  const boardStateRef = useRef(gameState);

  useEffect(() => {
    if (showBestMove && gameState.phase !== 'finished') {
      const best = engineFindBestMove(gameState, gameState.currentTurn, STRENGTH_DEPTH[engineStrength]);
      setCurrentBestMove(best);
    } else {
      setCurrentBestMove(null);
    }
  }, [gameState.board, gameState.currentTurn, gameState.phase, showBestMove, engineStrength, viewingMove]);

  const getBoardAtMove = useCallback((state: AnalysisState, moveIndex: number): CellOwner[][] => {
    const tempState = createInitialGameState();
    for (let i = 0; i <= moveIndex; i++) {
      const move = state.moves[i];
      if (move.player !== tempState.currentTurn) {
        tempState.currentTurn = move.player;
      }
      if (tempState.phase === 'placement') {
        tempState.board[move.to.row][move.to.col] = move.player;
        const blackPlaced = tempState.board.flat().filter(c => c === 'black').length;
        const whitePlaced = tempState.board.flat().filter(c => c === 'white').length;
        if (blackPlaced >= 8 && whitePlaced >= 8) tempState.phase = 'movement';
      } else {
        tempState.board[move.to.row][move.to.col] = move.player;
        if (move.from) tempState.board[move.from.row][move.from.col] = null;
      }
      tempState.currentTurn = move.player === 'black' ? 'white' : 'black';
    }
    return tempState.board;
  }, []);

  const displayBoard = viewingMove >= 0
    ? getBoardAtMove(gameState, viewingMove)
    : gameState.board;
  const displayMove = viewingMove >= 0 ? gameState.moves[viewingMove] : null;
  const isViewingHistory = viewingMove >= 0;

  const handleCellClick = useCallback((pos: Position) => {
    if (isViewingHistory) {
      setViewingMove(-1);
      return;
    }
    if (gameState.phase === 'finished') return;

    const state = { ...gameState, board: gameState.board.map(r => [...r]) };

    if (state.phase === 'placement') {
      if (state.board[pos.row][pos.col] !== null) return;
      const result = applyMove(state, state.currentTurn, undefined, pos);
      if ('error' in result) return;
      setGameState(state);
      setSelectedPos(null);
    } else {
      if (state.board[pos.row][pos.col] === state.currentTurn) {
        setSelectedPos(pos);
        return;
      }
      if (selectedPos) {
        const result = applyMove(state, state.currentTurn, selectedPos, pos);
        if ('error' in result) return;
        setGameState(state);
        setSelectedPos(null);
      }
    }
  }, [gameState, selectedPos, isViewingHistory]);

  const handleGoStart = () => setViewingMove(-1);
  const handleGoEnd = () => setViewingMove(-1);
  const handlePrev = () => {
    if (viewingMove < 0) setViewingMove(gameState.moves.length - 1);
    else if (viewingMove > 0) setViewingMove(viewingMove - 1);
  };
  const handleNext = () => {
    if (viewingMove < gameState.moves.length - 1) setViewingMove(viewingMove + 1);
    else setViewingMove(-1);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      if (e.key === 'Home') { e.preventDefault(); handleGoStart(); }
      if (e.key === 'End') { e.preventDefault(); handleGoEnd(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewingMove, gameState.moves.length]);

  const handleImportPGN = () => {
    setPgnError('');
    const result = parsePGN(pgnInput);
    if ('error' in result) {
      setPgnError(result.error);
      return;
    }
    const simState = createInitialGameState();
    for (const move of result.moves) {
      if (move.player !== simState.currentTurn) {
        simState.currentTurn = move.player;
      }
      const from = move.from || undefined;
      applyMove(simState, simState.currentTurn, from, move.to);
    }
    setGameState(simState);
    setViewingMove(-1);
    setImportedMoves(result.moves);
    setTab('freeplay');
  };

  const handleLoadRecent = async () => {
    if (!recentGameId.trim()) return;
    setRecentLoading(true);
    try {
      const { getGame } = await import('../services/gameService');
      const game = await getGame(recentGameId.trim());
      if (!game) { setPgnError('Game not found'); setRecentLoading(false); return; }
      const simState = createInitialGameState();
      if (game.moves) {
        for (const move of game.moves) {
          applyMove(simState, simState.currentTurn, move.from || undefined, move.to);
        }
      }
      setGameState(simState);
      setViewingMove(-1);
      setImportedMoves(game.moves || null);
      setTab('freeplay');
    } catch {
      setPgnError('Failed to load game');
    }
    setRecentLoading(false);
  };

  const handleExport = () => {
    downloadPGN(gameState.moves, 'Black', 'White',
      gameState.phase === 'finished' ? '*' : '*');
  };

  const handleNewGame = () => {
    setGameState(createInitialGameState());
    setSelectedPos(null);
    setViewingMove(-1);
    setImportedMoves(null);
  };

  const totalMoves = gameState.moves.length;
  const currentMoveNum = isViewingHistory ? viewingMove + 1 : totalMoves;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 800 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">
            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', verticalAlign: 'middle', marginRight: 8 }}>analytics</span>
            Analysis
          </h1>

          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
            <Button variant={tab === 'freeplay' ? 'success' : 'ghost'} size="sm" onClick={() => setTab('freeplay')}>Free Play</Button>
            <Button variant={tab === 'import' ? 'success' : 'ghost'} size="sm" onClick={() => setTab('import')}>Import PGN</Button>
            <Button variant={tab === 'recent' ? 'success' : 'ghost'} size="sm" onClick={() => setTab('recent')}>Load Game</Button>
          </div>

          {tab === 'import' && (
            <Card padding="1.5rem" style={{ marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Import PGN</h3>
              <textarea
                value={pgnInput}
                onChange={e => setPgnInput(e.target.value)}
                placeholder={`Paste PGN here...\nExample:\n[Black "Player1"]\n[White "Player2"]\n\na3 b4 c3 d4 e3 f4 g3 h4`}
                style={{
                  width: '100%',
                  minHeight: 120,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-mono)',
                  resize: 'vertical',
                }}
              />
              {pgnError && <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: 4 }}>{pgnError}</div>}
              <Button variant="success" size="sm" onClick={handleImportPGN} style={{ marginTop: '0.5rem' }}>Import</Button>
            </Card>
          )}

          {tab === 'recent' && (
            <Card padding="1.5rem" style={{ marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Load Recent Game</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={recentGameId}
                  onChange={e => setRecentGameId(e.target.value)}
                  placeholder="Enter game ID"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.85rem',
                  }}
                />
                <Button variant="success" size="sm" onClick={handleLoadRecent} loading={recentLoading}>Load</Button>
              </div>
              {pgnError && <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: 4 }}>{pgnError}</div>}
            </Card>
          )}

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 360px', minWidth: 300 }}>
              <Card padding="1rem" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                  <AnalysisBoard
                    board={displayBoard}
                    currentMoveIndex={currentMoveNum}
                    totalMoves={totalMoves}
                    bestMove={isViewingHistory ? null : (showBestMove ? currentBestMove : null)}
                    lastMove={displayMove}
                    onCellClick={handleCellClick}
                    interactive={!isViewingHistory && gameState.phase !== 'finished'}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: '0.75rem' }}>
                  <Button variant="ghost" size="sm" onClick={handleGoStart} title="Go to start (Home)">
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>skip_previous</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handlePrev} title="Previous move (Left)">
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_left</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleNext} title="Next move (Right)">
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleGoEnd} title="Go to end (End)">
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>skip_next</span>
                  </Button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: '0.5rem' }}>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: gameState.currentTurn === 'black' ? '#1a1a1a' : 'var(--color-bg-secondary)',
                    color: gameState.currentTurn === 'black' ? 'white' : 'var(--color-text)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: gameState.currentTurn === 'black' ? '2px solid #444' : '1px solid var(--color-border)',
                  }}>
                    {isViewingHistory ? 'Reviewing' : gameState.phase === 'finished' ? 'Game Over' : `${gameState.currentTurn === 'black' ? 'Black' : 'White'} to move`}
                  </span>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-secondary)',
                    fontSize: '0.8rem',
                    color: 'var(--color-text-secondary)',
                  }}>
                    {gameState.phase === 'placement' ? 'Placement' : 'Movement'}
                  </span>
                </div>
              </Card>
            </div>

            <div style={{ flex: '0 1 280px', minWidth: 240 }}>
              <Card padding="1rem" style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-dark)', marginBottom: '0.75rem' }}>Engine</h3>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Strength</label>
                  <select
                    value={engineStrength}
                    onChange={e => setEngineStrength(e.target.value as EngineStrength)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.8rem',
                    }}
                  >
                    {Object.entries(STRENGTH_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: '0.5rem' }}>
                  <input type="checkbox" checked={showBestMove} onChange={e => setShowBestMove(e.target.checked)} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>Show best move</span>
                </label>

                {showBestMove && currentBestMove && !isViewingHistory && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(76, 149, 108, 0.08)',
                    border: '1px solid rgba(76, 149, 108, 0.2)',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-dark)',
                  }}>
                    Best: {currentBestMove.from
                      ? `${String.fromCharCode(97 + currentBestMove.from.col)}${6 - currentBestMove.from.row}→${String.fromCharCode(97 + currentBestMove.to.col)}${6 - currentBestMove.to.row}`
                      : `${String.fromCharCode(97 + currentBestMove.to.col)}${6 - currentBestMove.to.row}`}
                  </div>
                )}
              </Card>

              <Card padding="1rem" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="secondary" size="sm" onClick={handleNewGame}>New Game</Button>
                  <Button variant="secondary" size="sm" onClick={handleExport}>Export PGN</Button>
                </div>
              </Card>

              <Card padding="1rem">
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-dark)', marginBottom: '0.5rem' }}>Moves</h3>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {gameState.moves.map((move, i) => (
                      <button
                        key={i}
                        onClick={() => setViewingMove(i)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: viewingMove === i
                            ? 'var(--color-success)'
                            : move.player === 'black'
                              ? 'rgba(44,110,73,0.1)'
                              : 'rgba(255,201,185,0.3)',
                          color: viewingMove === i ? 'white' : 'var(--color-text)',
                          fontFamily: 'var(--font-mono)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {move.moveNumber}.
                        {move.from
                          ? `${String.fromCharCode(97 + move.from.col)}${6 - move.from.row}→${String.fromCharCode(97 + move.to.col)}${6 - move.to.row}`
                          : `${String.fromCharCode(97 + move.to.col)}${6 - move.to.row}`}
                      </button>
                    ))}
                    {gameState.moves.length === 0 && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>No moves yet</span>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
