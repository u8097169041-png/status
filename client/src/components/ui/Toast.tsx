import { AlertCircle, CheckCircle2, Info, Sparkles, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';

type ToastKind = 'success' | 'error' | 'info' | 'xp';

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  text?: string;
}

interface ToastApi {
  push: (kind: ToastKind, title: string, text?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info, xp: Sparkles };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const { t } = useI18n();

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, title: string, text?: string) => {
      const id = ++counter.current;
      setToasts((list) => [...list.slice(-3), { id, kind, title, text }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          return (
            <div key={toast.id} className={`toast toast-${toast.kind}`}>
              <Icon aria-hidden />
              <div className="toast-body">
                <strong>{toast.title}</strong>
                {toast.text && <span>{toast.text}</span>}
              </div>
              <button type="button" className="icon-btn" onClick={() => dismiss(toast.id)} aria-label={t('common.close')}>
                <X />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast muss innerhalb von ToastProvider verwendet werden.');
  return ctx;
}
