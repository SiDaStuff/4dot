import { useEffect, useState, useRef } from 'react';

interface ClockProps {
  timeMs: number;
  isActive: boolean;
  isMyTurn: boolean;
  lastMoveTimestamp?: number;
  currentTurn?: string;
  myColor?: string;
  playerColor?: 'black' | 'white';
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function Clock({ timeMs, isActive, isMyTurn, lastMoveTimestamp, currentTurn, myColor, playerColor }: ClockProps) {
  const [displayMs, setDisplayMs] = useState(timeMs);
  const rafRef = useRef<number>(0);
  const baseTimeRef = useRef(timeMs);
  const baseTsRef = useRef(Date.now());

  useEffect(() => {
    baseTimeRef.current = timeMs;
    baseTsRef.current = Date.now();
    setDisplayMs(timeMs);
  }, [timeMs, lastMoveTimestamp]);

  useEffect(() => {
    if (!isActive || !currentTurn) {
      setDisplayMs(baseTimeRef.current);
      return;
    }

    const isThisPlayerTurn = playerColor === currentTurn;

    const tick = () => {
      if (isThisPlayerTurn) {
        const elapsed = Date.now() - baseTsRef.current;
        setDisplayMs(Math.max(0, baseTimeRef.current - elapsed));
      } else {
        setDisplayMs(baseTimeRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, isMyTurn, currentTurn, myColor, playerColor]);

  const danger = displayMs < 30000;

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '1.25rem',
      fontWeight: 700,
      padding: '8px 16px',
      borderRadius: 'var(--radius-md)',
      background: isActive && isMyTurn
        ? (danger ? '#FEF2F2' : 'var(--color-secondary)')
        : 'var(--color-bg-secondary)',
      border: `1px solid ${
        isActive && isMyTurn
          ? (danger ? 'var(--color-danger)' : 'var(--color-border)')
          : 'var(--color-border)'
      }`,
      color: danger && isActive && isMyTurn ? 'var(--color-danger)' : 'var(--color-text)',
      transition: 'background 0.3s, border-color 0.3s, color 0.3s',
      minWidth: 80,
      textAlign: 'center',
    }}>
      {formatTime(displayMs)}
    </div>
  );
}
