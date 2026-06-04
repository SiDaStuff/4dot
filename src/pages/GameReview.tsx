import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGame } from '../services/gameService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { AnalysisBoard } from '../components/game/AnalysisBoard';
import { createInitialGameState, applyMove } from '../utils/gameLogic';
import { downloadPGN } from '../utils/pgn';
import type { CellOwner, Position, Move } from '../types';
import { BOARD_SIZE } from '../types';

interface MoveAnalysis {
  moveNumber: number;
  player: string;
  from: Position | null;
  to: Position;
  classification: string;
  cpLoss: number;
  engineMove: { from: Position | null; to: Position } | null;
  beforeEval: number;
  bestEval: number;
  afterEval: number;
}

interface ReviewResult {
  accuracy: number;
  moveAnalysis: MoveAnalysis[];
  totalPlayerMoves: number;
  excellentCount: number;
  goodCount: number;
  inaccuracyCount: number;
  mistakeCount: number;
  blunderCount: number;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  best: '#4C956C', excellent: '#4C956C', good: '#6B7280', book: '#9CA3AF',
  inaccuracy: '#F59E0B', mistake: '#E8734A', blunder: '#EF4444',
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  best: 'Best', excellent: 'Excellent', good: 'Good', book: 'Book',
  inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder',
};

type ReviewMode = 'game' | 'manual';

export function GameReview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { gameId: urlGameId } = useParams();
  const [mode, setMode] = useState<ReviewMode>('game');
  const [gameId, setGameId] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState('');
  const [viewingMove, setViewingMove] = useState(-1);
  const [playerColor, setPlayerColor] = useState<'black' | 'white'>('white');
  const [manualMoves, setManualMoves] = useState<Move[]>([]);
  const [manualState, setManualState] = useState(createInitialGameState());
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const review = reviewResult;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramGameId = urlGameId || params.get('gameId');
    if (paramGameId) { setGameId(paramGameId); setMode('game'); }
  }, [urlGameId]);

  const allMoves = manualMoves;
  const boardCache = useRef<Map<number, CellOwner[][]>>(new Map());

  const getBoardAtMove = useCallback((moves: Move[], moveIndex: number): CellOwner[][] => {
    const cached = boardCache.current.get(moveIndex);
    if (cached) return cached;
    const temp = createInitialGameState();
    for (let i = 0; i <= moveIndex; i++) {
      const move = moves[i];
      if (move.player !== temp.currentTurn) temp.currentTurn = move.player;
      if (temp.phase === 'placement') {
        temp.board[move.to.row][move.to.col] = move.player;
        const bp = temp.board.flat().filter(c => c === 'black').length;
        const wp = temp.board.flat().filter(c => c === 'white').length;
        if (bp >= 8 && wp >= 8) temp.phase = 'movement';
      } else {
        temp.board[move.to.row][move.to.col] = move.player;
        if (move.from) temp.board[move.from.row][move.from.col] = null;
      }
      temp.currentTurn = move.player === 'black' ? 'white' : 'black';
      boardCache.current.set(i, temp.board.map(r => [...r]));
    }
    return temp.board;
  }, []);

  useEffect(() => { boardCache.current.clear(); }, [allMoves]);

  const runAnalysis = useCallback((moves: Move[], color: 'black' | 'white') => {
    if (workerRef.current) workerRef.current.terminate();
    setLoading(true);
    setAnalyzeProgress(0);
    setReviewResult(null);
    setError('');
    const worker = new Worker('/engineWorker.js');
    workerRef.current = worker;
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        setAnalyzeProgress(Math.round((e.data.current / e.data.total) * 100));
      }
      if (e.data.type === 'result') {
        setReviewResult({
          accuracy: e.data.accuracy,
          moveAnalysis: e.data.moveAnalysis,
          totalPlayerMoves: e.data.totalPlayerMoves,
          excellentCount: e.data.excellentCount,
          goodCount: e.data.goodCount,
          inaccuracyCount: e.data.inaccuracyCount,
          mistakeCount: e.data.mistakeCount,
          blunderCount: e.data.blunderCount,
        });
        setLoading(false);
        setAnalyzeProgress(100);
        worker.terminate();
        workerRef.current = null;
      }
    };
    worker.onerror = () => {
      setError('Analysis engine failed');
      setLoading(false);
      worker.terminate();
      workerRef.current = null;
    };
    worker.postMessage({ type: 'analyze', moves, playerColor: color, maxDepth: 10 });
  }, []);

  const handleReviewGame = async () => {
    if (!gameId.trim()) return;
    setError('');
    setReviewResult(null);
    try {
      const game = await getGame(gameId.trim());
      if (!game) { setError('Game not found'); return; }
      if (!game.moves || game.moves.length === 0) { setError('No moves in this game'); return; }
      const myColor = game.blackPlayer.uid === user?.uid ? 'black' : 'white';
      setPlayerColor(myColor);
      setManualMoves(game.moves);
      setManualState({ ...game });
      boardCache.current.clear();
      runAnalysis(game.moves, myColor);
    } catch (err: any) {
      setError(err.message || 'Failed to load game');
    }
  };

  const handleManualMove = useCallback((pos: Position) => {
    if (manualState.phase === 'finished') return;
    const state = { ...manualState, board: manualState.board.map(r => [...r]) };
    if (state.phase === 'placement') {
      if (state.board[pos.row][pos.col] !== null) return;
      const result = applyMove(state, state.currentTurn, undefined, pos);
      if ('error' in result) return;
      setManualState(state);
      setManualMoves([...state.moves]);
      setSelectedPos(null);
    } else {
      if (state.board[pos.row][pos.col] === state.currentTurn) { setSelectedPos(pos); return; }
      if (selectedPos) {
        const result = applyMove(state, state.currentTurn, selectedPos, pos);
        if ('error' in result) return;
        setManualState(state);
        setManualMoves([...state.moves]);
        setSelectedPos(null);
      }
    }
  }, [manualState, selectedPos]);

  const handleManualReview = () => {
    if (manualMoves.length < 4) { setError('Make at least 4 moves to review'); return; }
    setError('');
    boardCache.current.clear();
    runAnalysis(manualMoves, playerColor);
  };

  const handlePrev = () => {
    if (viewingMove < 0) setViewingMove(allMoves.length - 1);
    else if (viewingMove > 0) setViewingMove(viewingMove - 1);
  };
  const handleNext = () => {
    if (viewingMove < allMoves.length - 1) setViewingMove(viewingMove + 1);
    else setViewingMove(-1);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewingMove, allMoves.length]);

  useEffect(() => { return () => { if (workerRef.current) workerRef.current.terminate(); }; }, []);

  const displayBoard = viewingMove >= 0 ? getBoardAtMove(allMoves, viewingMove) : manualState.board;
  const currentMoveAnalysis = review?.moveAnalysis[viewingMove];
  const engineArrow = currentMoveAnalysis?.engineMove
    ? { from: currentMoveAnalysis.engineMove.from || currentMoveAnalysis.engineMove.to, to: currentMoveAnalysis.engineMove.to }
    : null;
  const playerArrow = viewingMove >= 0 && allMoves[viewingMove]?.from
    ? { from: allMoves[viewingMove].from!, to: allMoves[viewingMove].to }
    : null;

  const getAccuracyColor = (acc: number) => {
    if (acc >= 90) return 'var(--color-success)';
    if (acc >= 70) return '#F59E0B';
    if (acc >= 50) return '#E8734A';
    return 'var(--color-danger)';
  };

  const ClassificationBar = ({ review: r }: { review: ReviewResult }) => {
    const total = r.totalPlayerMoves || 1;
    const segments = [
      { pct: r.excellentCount / total, color: CLASSIFICATION_COLORS.excellent },
      { pct: r.goodCount / total, color: CLASSIFICATION_COLORS.good },
      { pct: r.inaccuracyCount / total, color: CLASSIFICATION_COLORS.inaccuracy },
      { pct: r.mistakeCount / total, color: CLASSIFICATION_COLORS.mistake },
      { pct: r.blunderCount / total, color: CLASSIFICATION_COLORS.blunder },
    ].filter(s => s.pct > 0);
    return (
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--color-bg-secondary)' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.pct * 100}%`, background: s.color, transition: 'width 0.5s ease' }} />
        ))}
      </div>
    );
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 900 }}>
        <div style={{ animation: 'fadeIn 300ms ease-out' }}>
          <h1 className="page-title">
            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', verticalAlign: 'middle', marginRight: 8 }}>rate_review</span>
            Game Review
          </h1>

          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
            <Button variant={mode === 'game' ? 'success' : 'ghost'} size="sm" onClick={() => setMode('game')}>Review a Game</Button>
            <Button variant={mode === 'manual' ? 'success' : 'ghost'} size="sm" onClick={() => setMode('manual')}>Manual Review</Button>
          </div>

          {mode === 'game' && !review && (
            <Card padding="1.5rem" style={{ marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Enter Game ID to Review</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={gameId} onChange={e => setGameId(e.target.value)} placeholder="Game ID (from game history)" style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.85rem' }} />
                <Button variant="success" size="sm" onClick={handleReviewGame} loading={loading}>Analyze</Button>
              </div>
              {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: 6 }}>{error}</div>}
            </Card>
          )}

          {mode === 'manual' && !review && (
            <Card padding="1.5rem" style={{ marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--color-dark)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Play moves from both sides, then analyze</h3>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Review as:</label>
                <select value={playerColor} onChange={e => setPlayerColor(e.target.value as 'black' | 'white')} style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
                  <option value="white">White</option>
                  <option value="black">Black</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="success" size="sm" onClick={handleManualReview} loading={loading} disabled={manualMoves.length < 4}>Analyze Moves</Button>
                <Button variant="secondary" size="sm" onClick={() => { setManualState(createInitialGameState()); setManualMoves([]); setSelectedPos(null); boardCache.current.clear(); }}>Reset</Button>
              </div>
              {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: 6 }}>{error}</div>}
            </Card>
          )}

          {loading && (
            <Card padding="1.5rem" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1rem' }}>
                <div style={{ position: 'relative', width: 48, height: 48 }}>
                  <svg width="48" height="48" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-border)" strokeWidth="3" />
                    <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-success)" strokeWidth="3" strokeDasharray={`${analyzeProgress * 1.26} 126`} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dasharray 0.3s ease' }} />
                  </svg>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-success)' }}>{analyzeProgress}%</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-dark)' }}>Analyzing moves...</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    {analyzeProgress < 30 ? 'Evaluating positions' : analyzeProgress < 70 ? 'Running engine analysis' : 'Calculating accuracy'}
                  </div>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--color-bg-secondary)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${analyzeProgress}%`, background: 'var(--color-success)', borderRadius: 3, transition: 'width 0.3s ease' }} />
              </div>
            </Card>
          )}

          {review && (
            <>
              <Card padding="1.5rem" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: getAccuracyColor(review.accuracy), fontFamily: 'var(--font-mono)' }}>
                      {review.accuracy}%
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Accuracy</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <ClassificationBar review={review} />
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                      {[
                        { label: 'Excellent', count: review.excellentCount, color: CLASSIFICATION_COLORS.excellent },
                        { label: 'Good', count: review.goodCount, color: CLASSIFICATION_COLORS.good },
                        { label: 'Inaccuracy', count: review.inaccuracyCount, color: CLASSIFICATION_COLORS.inaccuracy },
                        { label: 'Mistake', count: review.mistakeCount, color: CLASSIFICATION_COLORS.mistake },
                        { label: 'Blunder', count: review.blunderCount, color: CLASSIFICATION_COLORS.blunder },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: item.color }}>{item.count}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <Button variant="secondary" size="sm" onClick={() => downloadPGN(allMoves, 'Black', 'White', '*')}>Export PGN</Button>
                  </div>
                </div>
              </Card>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 360px', minWidth: 300 }}>
                  <Card padding="1rem" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                      <AnalysisBoard
                        board={displayBoard}
                        currentMoveIndex={viewingMove >= 0 ? viewingMove + 1 : allMoves.length}
                        totalMoves={allMoves.length}
                        bestMove={null}
                        lastMove={viewingMove >= 0 ? allMoves[viewingMove] : null}
                        arrows={[
                          ...(playerArrow && viewingMove >= 0 && currentMoveAnalysis?.classification === 'blunder' ? [{ from: playerArrow.from, to: playerArrow.to, color: 'rgba(239, 68, 68, 0.6)' }] : []),
                          ...(playerArrow && viewingMove >= 0 && currentMoveAnalysis?.classification === 'mistake' ? [{ from: playerArrow.from, to: playerArrow.to, color: 'rgba(232, 115, 74, 0.6)' }] : []),
                          ...(playerArrow && viewingMove >= 0 && currentMoveAnalysis?.classification === 'inaccuracy' ? [{ from: playerArrow.from, to: playerArrow.to, color: 'rgba(245, 158, 11, 0.6)' }] : []),
                          ...(engineArrow && viewingMove >= 0 && (currentMoveAnalysis?.classification === 'blunder' || currentMoveAnalysis?.classification === 'mistake' || currentMoveAnalysis?.classification === 'inaccuracy') ? [{ from: engineArrow.from, to: engineArrow.to, color: 'rgba(76, 149, 108, 0.6)' }] : []),
                        ]}
                        interactive={false}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: '0.5rem' }}>
                      <Button variant="ghost" size="sm" onClick={() => setViewingMove(-1)} title="Go to start">
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>skip_previous</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handlePrev} title="Previous">
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_left</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleNext} title="Next">
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setViewingMove(-1)} title="Go to end">
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>skip_next</span>
                      </Button>
                    </div>

                    {viewingMove >= 0 && currentMoveAnalysis && (
                      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                        <span style={{
                          display: 'inline-block', padding: '4px 12px', borderRadius: 'var(--radius-md)',
                          background: CLASSIFICATION_COLORS[currentMoveAnalysis.classification] || '#9CA3AF',
                          color: 'white', fontSize: '0.75rem', fontWeight: 700,
                        }}>
                          {CLASSIFICATION_LABELS[currentMoveAnalysis.classification] || currentMoveAnalysis.classification}
                          {currentMoveAnalysis.cpLoss > 0 && ` (-${currentMoveAnalysis.cpLoss})`}
                        </span>
                      </div>
                    )}
                  </Card>
                </div>

                <div style={{ flex: '0 1 300px', minWidth: 240 }}>
                  <Card padding="1rem">
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-dark)', marginBottom: '0.5rem' }}>Move Analysis</h3>
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                      {review.moveAnalysis.map((ma, i) => (
                        <button
                          key={i}
                          onClick={() => setViewingMove(i)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: 'none',
                            background: viewingMove === i ? 'var(--color-bg-secondary)' : 'transparent',
                            cursor: 'pointer', textAlign: 'left', marginBottom: 2,
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: CLASSIFICATION_COLORS[ma.classification] || '#9CA3AF', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text)', flex: 1 }}>
                            {ma.from
                              ? `${String.fromCharCode(97 + ma.from.col)}${6 - ma.from.row}\u2192${String.fromCharCode(97 + ma.to.col)}${6 - ma.to.row}`
                              : `${String.fromCharCode(97 + ma.to.col)}${6 - ma.to.row}`}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: CLASSIFICATION_COLORS[ma.classification] || '#9CA3AF' }}>
                            {CLASSIFICATION_LABELS[ma.classification] || ma.classification}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}

          {mode === 'manual' && !review && !loading && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 360px', minWidth: 300 }}>
                <Card padding="1rem">
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <AnalysisBoard
                      board={manualState.board}
                      currentMoveIndex={manualMoves.length}
                      totalMoves={manualMoves.length}
                      bestMove={null}
                      onCellClick={handleManualMove}
                      interactive={manualState.phase !== 'finished'}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {manualState.currentTurn === 'black' ? 'Black' : 'White'} to move \u00b7 {manualState.phase}
                    </span>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
