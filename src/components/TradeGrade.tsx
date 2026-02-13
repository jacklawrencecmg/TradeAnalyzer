interface TradeGradeProps {
  grade: string;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const gradeColors = {
  'A+': 'from-emerald-500 to-emerald-600',
  'A': 'from-emerald-500 to-emerald-600',
  'A-': 'from-emerald-500 to-emerald-600',
  'B+': 'from-blue-500 to-blue-600',
  'B': 'from-blue-500 to-blue-600',
  'B-': 'from-blue-500 to-blue-600',
  'C+': 'from-yellow-500 to-yellow-600',
  'C': 'from-yellow-500 to-yellow-600',
  'C-': 'from-yellow-500 to-yellow-600',
  'D+': 'from-orange-500 to-orange-600',
  'D': 'from-orange-500 to-orange-600',
  'D-': 'from-orange-500 to-orange-600',
  'F': 'from-red-500 to-red-600',
};

const sizeClasses = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-16 h-16 text-2xl',
  lg: 'w-24 h-24 text-4xl',
};

export function TradeGrade({ grade, score, size = 'md', showLabel = true }: TradeGradeProps) {
  const gradientClass = gradeColors[grade as keyof typeof gradeColors] || gradeColors['C'];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} rounded-xl blur-lg opacity-50`}></div>
        <div className={`relative w-full h-full bg-gradient-to-br ${gradientClass} rounded-xl flex items-center justify-center font-bold text-white shadow-lg border-2 border-white/20`}>
          {grade}
        </div>
      </div>

      {showLabel && (
        <div className="text-center">
          <div className="text-xs text-gray-400">Trade Grade</div>
          {score !== undefined && (
            <div className="text-sm font-semibold text-white">{score.toFixed(1)}/100</div>
          )}
        </div>
      )}
    </div>
  );
}

export function calculateTradeGrade(fairnessScore: number): string {
  if (fairnessScore >= 95) return 'A+';
  if (fairnessScore >= 90) return 'A';
  if (fairnessScore >= 85) return 'A-';
  if (fairnessScore >= 80) return 'B+';
  if (fairnessScore >= 75) return 'B';
  if (fairnessScore >= 70) return 'B-';
  if (fairnessScore >= 65) return 'C+';
  if (fairnessScore >= 60) return 'C';
  if (fairnessScore >= 55) return 'C-';
  if (fairnessScore >= 50) return 'D+';
  if (fairnessScore >= 45) return 'D';
  if (fairnessScore >= 40) return 'D-';
  return 'F';
}
