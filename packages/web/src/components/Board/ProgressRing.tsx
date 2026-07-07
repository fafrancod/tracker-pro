interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  completed: number;
  total: number;
}

export function ProgressRing({
  progress,
  size = 40,
  strokeWidth = 3,
  completed,
  total,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  const color =
    total === 0
      ? '#30363d'
      : progress === 100
        ? '#3fb950'
        : progress >= 50
          ? '#58a6ff'
          : '#7d8590';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#30363d"
          strokeWidth={strokeWidth}
        />
        {total > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        )}
      </svg>
      <span className="absolute text-[10px] font-semibold" style={{ color }}>
        {total === 0 ? '–' : `${completed}/${total}`}
      </span>
    </div>
  );
}
