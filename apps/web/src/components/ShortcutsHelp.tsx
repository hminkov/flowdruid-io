import { SHORTCUT_GROUPS, useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { XIcon } from './icons';

/**
 * Cheat-sheet overlay for global keyboard shortcuts — toggled by `?`
 * (see `useKeyboardShortcuts`). Rendered once at the app root so it
 * sits above any page content and reuses the same focus-trap + ESC
 * behaviour as other modals.
 */
export function ShortcutsHelp() {
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts();
  const trapRef = useFocusTrap<HTMLDivElement>(helpOpen);
  if (!helpOpen) return null;

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)] p-4"
    >
      <div className="absolute inset-0" onClick={() => setHelpOpen(false)} aria-hidden="true" />
      <div className="animate-modal-in relative w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface-primary shadow-float">
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          <button
            onClick={() => setHelpOpen(false)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-[10px] uppercase tracking-widest text-text-tertiary">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((s) => (
                  <li key={s.keys} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-text-primary">{s.label}</span>
                    <span className="flex gap-1">
                      {s.keys.split(' ').map((k, i) => (
                        <kbd
                          key={i}
                          className="inline-flex min-w-[24px] items-center justify-center rounded border border-border bg-surface-secondary px-1.5 py-0.5 font-mono text-[11px] text-text-secondary"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
