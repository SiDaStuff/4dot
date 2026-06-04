import React from 'react';

interface CardProps {
  children: React.ReactNode;
  padding?: string;
  hover?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Card({ children, padding, hover, style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--color-white)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        padding: padding || 'var(--spacing-lg)',
        transition: 'all var(--transition-normal)',
        cursor: onClick ? 'pointer' : undefined,
        ...(hover ? {
          ':hover': {
            boxShadow: 'var(--shadow-md)',
            transform: 'translateY(-2px)',
          },
        } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}