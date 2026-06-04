interface BadgeProps {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'default';
  children: React.ReactNode;
}

const colors: Record<string, string> = {
  success: '#4C956C',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#FFC9B9',
  default: '#E5E7EB',
};

const textColors: Record<string, string> = {
  success: 'white',
  danger: 'white',
  warning: 'white',
  info: '#1A1A1A',
  default: '#1A1A1A',
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: colors[variant],
      color: textColors[variant],
    }}>
      {children}
    </span>
  );
}