export function ThreeDotLogo({ size = 40 }: { size?: number }) {
  const pieceRadius = size * 0.13;
  const centerY1 = size * 0.3;
  const centerY2 = size * 0.7;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size * 0.5} cy={centerY1} r={pieceRadius} fill="#4C956C"/>
      <circle cx={size * 0.3} cy={centerY2} r={pieceRadius} fill="#FFC9B9"/>
      <circle cx={size * 0.7} cy={centerY2} r={pieceRadius} fill="#2C6E49"/>
      <line x1={size * 0.44} y1={centerY1 + pieceRadius} x2={size * 0.34} y2={centerY2 - pieceRadius}
        stroke="#4C956C" strokeWidth={size * 0.02} opacity="0.5"/>
      <line x1={size * 0.56} y1={centerY1 + pieceRadius} x2={size * 0.66} y2={centerY2 - pieceRadius}
        stroke="#2C6E49" strokeWidth={size * 0.02} opacity="0.5"/>
      <line x1={size * 0.34} y1={centerY2 + pieceRadius} x2={size * 0.66} y2={centerY2 + pieceRadius}
        stroke="#FFC9B9" strokeWidth={size * 0.02} opacity="0.5"/>
    </svg>
  );
}
