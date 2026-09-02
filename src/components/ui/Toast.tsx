import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/utils/cn';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

let toastCallback: ((type: ToastType, message: string) => void) | null = null;

export function toast(type: ToastType, message: string) {
  if (toastCallback) toastCallback(type, message);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    toastCallback = (type, message) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => { toastCallback = null; };
  }, []);

  const icons = {
    success: <CheckCircle2 size={18} className="text-emerald-400" />,
    error: <XCircle size={18} className="text-red-400" />,
    info: <Info size={18} className="text-blue-400" />,
    warning: <AlertTriangle size={18} className="text-amber-400" />,
  };

  return (
    <div className="fixed bottom-2 sm:bottom-4 right-2 sm:right-4 left-2 sm:left-auto z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg border ff-card ff-fade-in max-w-[calc(100vw-16px)] sm:min-w-[280px] sm:max-w-md'
          )}
        >
          {icons[t.type]}
          <p className="text-sm text-[var(--ff-text)] flex-1">{t.message}</p>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-[var(--ff-text-dim)] hover:text-[var(--ff-text)]"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
