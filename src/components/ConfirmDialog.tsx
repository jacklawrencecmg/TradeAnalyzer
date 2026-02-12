import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const colors = {
    danger: {
      bg: 'bg-red-500',
      hover: 'hover:bg-red-600',
      text: 'text-red-400',
      border: 'border-red-500',
    },
    warning: {
      bg: 'bg-yellow-500',
      hover: 'hover:bg-yellow-600',
      text: 'text-yellow-400',
      border: 'border-yellow-500',
    },
    info: {
      bg: 'bg-[#00d4ff]',
      hover: 'hover:bg-[#00b8e6]',
      text: 'text-[#00d4ff]',
      border: 'border-[#00d4ff]',
    },
  };

  const colorScheme = colors[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${colorScheme.border} border bg-opacity-10`}>
              <AlertTriangle className={`w-6 h-6 ${colorScheme.text}`} />
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-300 mb-6 ml-14">{message}</p>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 ${colorScheme.bg} ${colorScheme.hover} text-white rounded-lg transition-colors font-medium`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
