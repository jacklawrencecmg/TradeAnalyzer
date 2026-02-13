import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const getIcon = (type: ToastType) => {
    const iconClass = "w-5 h-5 flex-shrink-0";
    switch (type) {
      case 'success':
        return (
          <div className="relative">
            <div className="absolute inset-0 bg-green-400 blur-md opacity-50"></div>
            <CheckCircle className={`${iconClass} text-green-400 relative`} />
          </div>
        );
      case 'error':
        return (
          <div className="relative">
            <div className="absolute inset-0 bg-red-400 blur-md opacity-50"></div>
            <AlertCircle className={`${iconClass} text-red-400 relative`} />
          </div>
        );
      case 'info':
        return (
          <div className="relative">
            <div className="absolute inset-0 bg-[#00d4ff] blur-md opacity-50"></div>
            <Info className={`${iconClass} text-[#00d4ff] relative`} />
          </div>
        );
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'border-green-500/50 bg-gradient-to-r from-green-950/90 to-green-900/90 shadow-green-500/20';
      case 'error':
        return 'border-red-500/50 bg-gradient-to-r from-red-950/90 to-red-900/90 shadow-red-500/20';
      case 'info':
        return 'border-[#00d4ff]/50 bg-gradient-to-r from-gray-900/90 to-gray-800/90 shadow-[#00d4ff]/20';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-md">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 ${getStyles(
              toast.type
            )} shadow-2xl backdrop-blur-md transform transition-all duration-300 hover:scale-105 hover:shadow-3xl`}
            style={{
              animation: 'slideInRight 0.3s ease-out',
              animationDelay: `${index * 0.1}s`
            }}
          >
            {getIcon(toast.type)}
            <p className="text-white text-sm font-medium flex-1 leading-relaxed">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
