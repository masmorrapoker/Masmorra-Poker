import { useState, useEffect } from 'react';
import { triggerHaptic } from '../utils/haptic';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

type ToastCallback = (toast: ToastMessage) => void;
const listeners = new Set<ToastCallback>();

export const toast = {
  show(message: string, type: 'success' | 'warning' | 'error' | 'info' = 'success') {
    const id = Math.random().toString(36).substring(2, 9);
    const toastObj: ToastMessage = { id, message, type };
    
    // Trigger proper vibration feedback matching type
    if (type === 'success') triggerHaptic('success');
    else if (type === 'error') triggerHaptic('error');
    else triggerHaptic('light');

    listeners.forEach(cb => cb(toastObj));
  },
  success(message: string) {
    this.show(message, 'success');
  },
  error(message: string) {
    this.show(message, 'error');
  },
  warning(message: string) {
    this.show(message, 'warning');
  },
  info(message: string) {
    this.show(message, 'info');
  }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleNewToast = (newToast: ToastMessage) => {
      setToasts(prev => [...prev, newToast]);
      // Remove automatically after 3 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 3000);
    };

    listeners.add(handleNewToast);
    return () => {
      listeners.delete(handleNewToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl shadow-xl flex items-center justify-between text-xs font-bold border animate-toast-slide-in pointer-events-auto backdrop-blur-md ${
            t.type === 'success' ? 'bg-success bg-opacity-20 border-success text-success' :
            t.type === 'error' ? 'bg-danger bg-opacity-20 border-danger text-danger' :
            t.type === 'warning' ? 'bg-warning bg-opacity-20 border-warning text-warning' :
            'bg-primary bg-opacity-20 border-primary text-primary'
          }`}
          style={{ letterSpacing: '0.02em' }}
        >
          <span>{t.message}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="ml-3 text-[10px] opacity-60 hover:opacity-100 font-bold bg-transparent border-none text-current cursor-pointer"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
