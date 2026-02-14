import React, { useState } from 'react';
import { User } from 'lucide-react';

interface PlayerAvatarProps {
  playerId?: string;
  playerName: string;
  team?: string;
  position?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTeamLogo?: boolean;
  showBadge?: boolean;
  badgeContent?: React.ReactNode;
  className?: string;
}

const teamColors: Record<string, string> = {
  'ARI': 'bg-red-700',
  'ATL': 'bg-red-600',
  'BAL': 'bg-purple-800',
  'BUF': 'bg-blue-700',
  'CAR': 'bg-cyan-500',
  'CHI': 'bg-orange-700',
  'CIN': 'bg-orange-600',
  'CLE': 'bg-orange-800',
  'DAL': 'bg-blue-800',
  'DEN': 'bg-orange-600',
  'DET': 'bg-blue-600',
  'GB': 'bg-green-700',
  'HOU': 'bg-red-800',
  'IND': 'bg-blue-700',
  'JAC': 'bg-teal-600',
  'KC': 'bg-red-700',
  'LAC': 'bg-blue-500',
  'LAR': 'bg-blue-700',
  'LV': 'bg-gray-900',
  'MIA': 'bg-teal-500',
  'MIN': 'bg-purple-700',
  'NE': 'bg-blue-900',
  'NO': 'bg-yellow-600',
  'NYG': 'bg-blue-700',
  'NYJ': 'bg-green-700',
  'PHI': 'bg-green-800',
  'PIT': 'bg-yellow-500',
  'SF': 'bg-red-700',
  'SEA': 'bg-blue-800',
  'TB': 'bg-red-700',
  'TEN': 'bg-blue-600',
  'WAS': 'bg-red-900',
};

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
};

const iconSizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

const teamLogoSize = {
  sm: 'w-4 h-4 text-[10px]',
  md: 'w-5 h-5 text-xs',
  lg: 'w-6 h-6 text-sm',
  xl: 'w-7 h-7 text-base',
};

export function PlayerAvatar({
  playerId,
  playerName,
  team,
  position,
  size = 'md',
  showTeamLogo = true,
  showBadge = false,
  badgeContent,
  className = '',
}: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const initials = playerName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const teamColor = team ? teamColors[team] || 'bg-gray-600' : 'bg-gray-600';
  const playerImageUrl = playerId ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : null;

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full ${!imageError && playerImageUrl ? 'bg-gray-800' : teamColor} flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-gray-700/50 transition-all duration-300 hover:ring-cyan-500/50 hover:shadow-cyan-500/20 hover:shadow-xl overflow-hidden`}
      >
        {!imageError && playerImageUrl ? (
          <img
            src={playerImageUrl}
            alt={playerName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : playerName ? (
          <span className={size === 'sm' ? 'text-xs' : size === 'lg' || size === 'xl' ? 'text-lg' : 'text-sm'}>
            {initials}
          </span>
        ) : (
          <User className={iconSizeClasses[size]} />
        )}
      </div>

      {showTeamLogo && team && (
        <div
          className={`absolute -bottom-1 -right-1 ${teamLogoSize[size]} rounded-full bg-gray-900 flex items-center justify-center font-bold text-white shadow-lg ring-2 ring-gray-800`}
        >
          {team}
        </div>
      )}

      {showBadge && badgeContent && (
        <div className="absolute -top-1 -right-1 bg-cyan-500 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-gray-900 shadow-lg ring-2 ring-gray-800">
          {badgeContent}
        </div>
      )}
    </div>
  );
}
