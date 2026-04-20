import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertIcon, CheckIcon, InfoIcon, XIcon } from '../icons';

type ToastKind = 'success' | 'error' | 'info';

type ToastInput = {
  kind?: ToastKind;
  title: string;
  message?: string;
  durationMs?: number; // 0 = sticky
  action?: { label: string; onClick: () => void };
};

type Toast = ToastInput & { id: string };

type Ctx = {
  push: (t: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 4500;

const ToastContext = createContext<Ctx | null>(null);

const TONE_CLASSES: Record<ToastKind, string> = {
  success: 'border-success-text/25 bg-success-bg text-success-text',
  error: 'border-danger-text/25 bg-danger-bg text-danger-text',
  info: 'border-info-text/25 bg-info-bg text-info-text',
};

const ToneIcon = ({ kind }: { kind: ToastKind }) => {
  if (kind === 'success') return <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />;
  if (kind === 'error') return <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />;
  return <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const handle = timers.current[id];
    if (handle) {
      window.clearTimeout(handle);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const toast: Toast = { kind: 'info', durationMs: DEFAULT_DURATION, ...t, id };
      setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), toast]);
      if (toast.durationMs && toast.durationMs > 0) {
        timers.current[id] = window.setTimeout(() => dismiss(id), toast.durationMs);
      }
      return id;
    },
    [dismiss]
  );

  const clear = useCallback(() => {
    setToasts([]);
    Object.values(timers.current).forEach((h) => window.clearTimeout(h));
    timers.current = {};
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach((h) => window.clearTimeout(h));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss, clear }}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => {
          const kind = t.kind ?? 'info';
          return (
            <div
              key={t.id}
              className={`animate-toast-in flex items-start gap-2 rounded-lg border bg-surface-primary p-3 shadow-float ${TONE_CLASSES[kind]}`}
            >
              <ToneIcon kind={kind} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs opacity-90">{t.message}</p>}
                {t.action && (
                  <button
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-1.5 text-xs underline underline-offset-2 hover:opacity-80"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-surface-primary/40"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
