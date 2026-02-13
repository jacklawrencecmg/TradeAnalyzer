import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatSparklineProps {
  data: number[];
  trend?: 'up' | 'down' | 'neutral';
  color?: 'green' | 'red' | 'cyan' | 'yellow';
  height?: number;
  showTrend?: boolean;
  className?: string;
}

export function StatSparkline({
  data,
  trend,
  color = 'cyan',
  height = 32,
  showTrend = true,
  className = '',
}: StatSparklineProps) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  const colorClasses = {
    green: {
      stroke: 'stroke-green-500',
      fill: 'fill-green-500/20',
      glow: 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]',
    },
    red: {
      stroke: 'stroke-red-500',
      fill: 'fill-red-500/20',
      glow: 'drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    },
    cyan: {
      stroke: 'stroke-cyan-500',
      fill: 'fill-cyan-500/20',
      glow: 'drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]',
    },
    yellow: {
      stroke: 'stroke-yellow-500',
      fill: 'fill-yellow-500/20',
      glow: 'drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]',
    },
  };

  const getTrendIcon = () => {
    if (!trend && data.length >= 2) {
      const lastValue = data[data.length - 1];
      const firstValue = data[0];
      if (lastValue > firstValue * 1.1) return <TrendingUp className="w-3 h-3 text-green-500" />;
      if (lastValue < firstValue * 0.9) return <TrendingDown className="w-3 h-3 text-red-500" />;
      return <Minus className="w-3 h-3 text-gray-500" />;
    }

    if (trend === 'up') return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-gray-500" />;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ height: `${height}px`, width: '80px' }}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopOpacity="0.4" />
            <stop offset="100%" stopOpacity="0" />
          </linearGradient>
        </defs>

        <polyline
          points={`0,100 ${points} 100,100`}
          className={`${colorClasses[color].fill}`}
          fill={`url(#gradient-${color})`}
        />

        <polyline
          points={points}
          className={`${colorClasses[color].stroke} ${colorClasses[color].glow}`}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((_, index) => (
          <circle
            key={index}
            cx={(index / (data.length - 1)) * 100}
            cy={100 - ((data[index] - min) / range) * 100}
            r="2"
            className={`${colorClasses[color].stroke.replace('stroke-', 'fill-')}`}
          />
        ))}
      </svg>

      {showTrend && (
        <div className="flex-shrink-0">
          {getTrendIcon()}
        </div>
      )}
    </div>
  );
}
