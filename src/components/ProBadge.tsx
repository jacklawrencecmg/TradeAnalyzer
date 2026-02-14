import { Lock, Sparkles } from 'lucide-react';

interface ProBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function ProBadge({ size = 'sm', showText = true }: ProBadgeProps) {
  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span className={`inline-flex items-center gap-1 ${sizes[size]} bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full font-bold`}>
      <Sparkles className={iconSizes[size]} />
      {showText && 'PRO'}
    </span>
  );
}

interface FeatureLockProps {
  feature: string;
  onUpgrade: () => void;
  children?: React.ReactNode;
}

export function FeatureLock({ feature, onUpgrade, children }: FeatureLockProps) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
        <button
          onClick={onUpgrade}
          className="flex flex-col items-center gap-3 p-6 bg-white rounded-lg shadow-xl max-w-sm"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-6 h-6 text-orange-600" />
            <ProBadge size="md" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Premium Feature</h3>
          <p className="text-gray-600 text-center">{feature} is available for Pro members</p>
          <div className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all">
            Upgrade to Pro
          </div>
        </button>
      </div>
      <div className="opacity-30 pointer-events-none">
        {children}
      </div>
    </div>
  );
}
