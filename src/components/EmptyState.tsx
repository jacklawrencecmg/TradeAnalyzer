import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-[#00d4ff] to-[#0099cc] opacity-20 blur-3xl rounded-full"></div>
        <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
          <Icon className="w-16 h-16 text-[#00d4ff]" />
        </div>
      </div>

      <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 max-w-md mb-6 leading-relaxed">{description}</p>

      {action && (
        <button
          onClick={action.onClick}
          className="bg-gradient-to-r from-[#00d4ff] to-[#0099cc] text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-[#00d4ff]/50 transition-all duration-300 hover:scale-105"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
