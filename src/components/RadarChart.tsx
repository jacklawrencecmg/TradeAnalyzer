interface RadarChartProps {
  data: {
    label: string;
    value: number;
    max?: number;
  }[];
  size?: number;
  color?: string;
}

export function RadarChart({ data, size = 300, color = '#00d4ff' }: RadarChartProps) {
  const center = size / 2;
  const radius = (size / 2) - 40;
  const angleStep = (2 * Math.PI) / data.length;

  const getPoint = (value: number, index: number, maxValue: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const normalizedValue = (value / maxValue) * radius;
    const x = center + normalizedValue * Math.cos(angle);
    const y = center + normalizedValue * Math.sin(angle);
    return { x, y };
  };

  const maxValue = Math.max(...data.map(d => d.max || d.value));

  const dataPoints = data.map((d, i) => getPoint(d.value, i, maxValue));
  const pathData = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          <radialGradient id="radarGradient">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {gridLevels.map((level, levelIndex) => {
          const gridPoints = data.map((_, i) => getPoint(maxValue * level, i, maxValue));
          const gridPath = gridPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

          return (
            <path
              key={levelIndex}
              d={gridPath}
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="1"
            />
          );
        })}

        {data.map((_, index) => {
          const point = getPoint(maxValue, index, maxValue);
          return (
            <line
              key={index}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="1"
            />
          );
        })}

        <path
          d={pathData}
          fill="url(#radarGradient)"
          stroke={color}
          strokeWidth="2"
          filter="url(#glow)"
        />

        {dataPoints.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={color}
            stroke="white"
            strokeWidth="2"
          />
        ))}

        {data.map((d, index) => {
          const labelPoint = getPoint(maxValue * 1.2, index, maxValue);
          const angle = index * angleStep - Math.PI / 2;

          let textAnchor = 'middle';
          if (Math.cos(angle) > 0.1) textAnchor = 'start';
          else if (Math.cos(angle) < -0.1) textAnchor = 'end';

          return (
            <g key={index}>
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                className="text-xs fill-gray-400 font-medium"
              >
                {d.label}
              </text>
              <text
                x={labelPoint.x}
                y={labelPoint.y + 14}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                className="text-xs fill-white font-bold"
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
