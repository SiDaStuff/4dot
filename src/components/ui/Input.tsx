import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
          {label}
        </label>
      )}
      <input
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          fontSize: '1rem',
          outline: 'none',
          transition: 'border-color var(--transition-fast)',
          background: 'var(--color-white)',
          color: 'var(--color-text)',
          width: '100%',
          ...style,
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>{error}</span>
      )}
    </div>
  );
}