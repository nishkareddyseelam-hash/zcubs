"use client";

/** Circular gauge for a 0-100 score — the game-y "Idea Score" style
 * presentation, built from the exact same computed number the flat
 * percentage text already showed elsewhere (never a separate/different
 * value). `celebrate` briefly glows the ring — pass it only when the score
 * just crossed a real milestone the caller can point to, never on every
 * render, so it stays a moment instead of noise. */
export default function ScoreRing({
  value,
  size = 96,
  strokeWidth = 10,
  label,
  celebrate = false,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  celebrate?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const gradientId = "scoreRingGradient";

  return (
    <div className="score-ring" data-celebrate={celebrate} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="55%" stopColor="#8a3fe0" />
            <stop offset="100%" stopColor="var(--spark)" />
          </linearGradient>
        </defs>
        <circle className="score-ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
        <circle
          className="score-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-ring__label">
        <span className="score-ring__num" style={{ fontSize: size * 0.26 }}>{Math.round(clamped)}%</span>
        {label && <span className="score-ring__unit">{label}</span>}
      </div>
    </div>
  );
}
