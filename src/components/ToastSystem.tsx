

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

const ToastItem: React.FC<{ toast: Toast; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5000); // Auto dismiss after 5 seconds
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success': return 'bg-green-600/90 border-green-500 text-white';
      case 'error': return 'bg-red-600/90 border-red-500 text-white';
      case 'warning': return 'bg-amber-600/90 border-amber-500 text-white';
      case 'info': default: return 'bg-sky-600/90 border-sky-500 text-white';
    }
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <span>[Thành công]</span>;
      case 'error': return <span>[Lỗi]</span>;
      case 'warning': return <span>[Cảnh báo]</span>;
      default: return <span>[Thông tin]</span>;
    }
  };

  return (
    <div 
      role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' || toast.type === 'warning' ? 'assertive' : 'polite'}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg  border mb-2 min-w-[300px] max-w-md ${getStyles(toast.type)}`}
    >
      <div className="flex-shrink-0">{getIcon(toast.type)}</div>
      <div className="flex-grow text-sm font-medium break-words">{toast.message}</div>
      <button onClick={() => onClose(toast.id)} className="opacity-70 hover:opacity-100 ml-2" aria-label="Đóng thông báo">
        <span>[Đóng]</span>
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-20 right-4 z-[100] flex flex-col items-end pointer-events-none">
        <div className="pointer-events-auto">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};
