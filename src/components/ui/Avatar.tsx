interface AvatarProps {
  username: string;
  size?: number;
}

export function Avatar({ username, size = 40 }: AvatarProps) {
  const initials = (username || '?').slice(0, 2).toUpperCase();
  const colors = ['#FFC9B9', '#4C956C', '#2C6E49', '#FEFEE3'];
  const colorIndex = (username || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;

  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: colors[colorIndex],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: size * 0.4,
      color: colorIndex === 3 ? '#1A1A1A' : 'white',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}