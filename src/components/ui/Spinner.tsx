export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <span style={{
      width: size, height: size,
      border: '3px solid var(--color-border)',
      borderTopColor: 'var(--color-success)',
      borderRadius: '50%',
      display: 'inline-block',
      animation: 'spin 0.6s linear infinite',
    }} />
  );
}