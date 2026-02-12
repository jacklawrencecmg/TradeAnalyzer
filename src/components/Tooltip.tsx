import { ReactNode, useState } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute ${positionClasses[position]} z-50 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg border border-gray-700 shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150`}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-gray-900 border-gray-700 rotate-45 ${
              position === 'top'
                ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-b border-r'
                : position === 'bottom'
                ? 'top-[-4px] left-1/2 -translate-x-1/2 border-t border-l'
                : position === 'left'
                ? 'right-[-4px] top-1/2 -translate-y-1/2 border-t border-r'
                : 'left-[-4px] top-1/2 -translate-y-1/2 border-b border-l'
            }`}
          />
        </div>
      )}
    </div>
  );
}
