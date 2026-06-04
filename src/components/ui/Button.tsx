import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'dark' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: { background: 'var(--color-primary)', color: 'var(--color-text)', border: 'none' },
  secondary: { background: 'var(--color-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' },
  success: { background: 'var(--color-success)', color: 'white', border: 'none' },
  dark: { background: 'var(--color-dark)', color: 'white', border: 'none' },
  danger: { background: 'var(--color-danger)', color: 'white', border: 'none' },
  ghost: { background: 'transparent', color: 'var(--color-text)', border: 'none' },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '0.875rem' },
  md: { padding: '10px 20px', fontSize: '1rem' },
  lg: { padding: '14px 28px', fontSize: '1.125rem' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  children,
  style,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      style={{
        borderRadius: 'var(--radius-md)',
        fontWeight: 600,
        transition: 'all var(--transition-fast)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        width: fullWidth ? '100%' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span style={{
          width: 16, height: 16, border: '2px solid currentColor',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.6s linear infinite', display: 'inline-block',
        }} />
      )}
      {children}
    </button>
  );
}