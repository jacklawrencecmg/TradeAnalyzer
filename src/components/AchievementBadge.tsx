import React from 'react';
import { Flame, Zap, Star, TrendingUp, Award, AlertCircle, Activity, Crown } from 'lucide-react';

interface AchievementBadgeProps {
  type: 'hot' | 'trending' | 'star' | 'breakout' | 'elite' | 'injury' | 'active' | 'champion';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const badgeConfig = {
  hot: {
    icon: Flame,
    color: 'bg-gradient-to-r from-orange-500 to-red-500',
    textColor: 'text-white',
    glow: 'shadow-[0_0_12px_rgba(249,115,22,0.6)]',
    label: 'Hot',
  },
  trending: {
    icon: TrendingUp,
    color: 'bg-gradient-to-r from-green-500 to-emerald-500',
    textColor: 'text-white',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.6)]',
    label: 'Trending',
  },
  star: {
    icon: Star,
    color: 'bg-gradient-to-r from-yellow-400 to-yellow-500',
    textColor: 'text-gray-900',
    glow: 'shadow-[0_0_12px_rgba(234,179,8,0.6)]',
    label: 'Star',
  },
  breakout: {
    icon: Zap,
    color: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    textColor: 'text-white',
    glow: 'shadow-[0_0_12px_rgba(6,182,212,0.6)]',
    label: 'Breakout',
  },
  elite: {
    icon: Award,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    textColor: 'text-white',
    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.6)]',
    label: 'Elite',
  },
  injury: {
    icon: AlertCircle,
    color: 'bg-gradient-to-r from-red-600 to-red-700',
    textColor: 'text-white',
    glow: 'shadow-[0_0_12px_rgba(220,38,38,0.6)]',
    label: 'Injured',
  },
  active: {
    icon: Activity,
    color: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    textColor: 'text-white',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.6)]',
    label: 'Active',
  },
  champion: {
    icon: Crown,
    color: 'bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500',
    textColor: 'text-gray-900',
    glow: 'shadow-[0_0_16px_rgba(234,179,8,0.8)]',
    label: 'Champion',
  },
};

const sizeClasses = {
  sm: {
    container: 'px-1.5 py-0.5 text-[10px] gap-0.5',
    icon: 'w-2.5 h-2.5',
  },
  md: {
    container: 'px-2 py-1 text-xs gap-1',
    icon: 'w-3 h-3',
  },
  lg: {
    container: 'px-3 py-1.5 text-sm gap-1.5',
    icon: 'w-4 h-4',
  },
};

export function AchievementBadge({
  type,
  label,
  size = 'md',
  className = '',
}: AchievementBadgeProps) {
  const config = badgeConfig[type];
  const Icon = config.icon;
  const displayLabel = label || config.label;

  return (
    <div
      className={`inline-flex items-center ${sizeClasses[size].container} ${config.color} ${config.textColor} ${config.glow} rounded-full font-bold uppercase tracking-wide animate-pulse-subtle ${className}`}
    >
      <Icon className={sizeClasses[size].icon} />
      <span>{displayLabel}</span>
    </div>
  );
}
