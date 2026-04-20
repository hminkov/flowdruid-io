import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AlertIcon, XIcon } from '../icons';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

type Resolver = (result: boolean) => void;
type Pending = (ConfirmOptions & { resolve: Resolver }) | null;

type Ctx = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      pending?.resolve(result);
      setPending(null);
    },
    [pending]
  );

  useEffect(() => {
    if (!pending) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0" onClick={() => close(false)} />
          <div className="animate-modal-in relative w-full max-w-card overflow-hidden rounded-lg bg-surface-primary shadow-float">
            <header className="flex items-start gap-3 border-b border-border p-4">
              {pending.tone === 'danger' && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger-text">
                  <AlertIcon className="h-4 w-4" />
                </span>
              )}
              <h3 className="min-w-0 flex-1 pt-1">{pending.title}</h3>
              <button
                aria-label="Close"
                onClick={() => close(false)}
                className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </header>
            {pending.message && (
              <div className="p-4 text-sm text-text-secondary">{pending.message}</div>
            )}
            <footer className="flex justify-end gap-2 border-t border-border bg-surface-secondary p-3">
              <button
                onClick={() => close(false)}
                className="min-h-input rounded px-3 text-sm text-text-secondary hover:bg-surface-primary"
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={() => close(true)}
                className={`min-h-input rounded px-3 text-sm text-white transition-colors duration-fast ${
                  pending.tone === 'danger'
                    ? 'bg-danger-text hover:brightness-110'
                    : 'bg-brand-600 hover:bg-brand-800'
                }`}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
