import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard shortcuts, loosely modelled on Linear / GitHub.
 *
 * Prefix shortcuts — press `g`, then a letter within 1.2 s:
 *   g d  Dashboard
 *   g t  Task board
 *   g s  Standup
 *   g c  Leave calendar
 *   g l  Request leave
 *   g q  QA environments
 *   g p  Prod support
 *   g k  Parking
 *   g i  Inbox
 *   g m  Messages
 *   g a  All teams
 *
 * Single keys:
 *   /   focus the header search
 *   ?   toggle the keyboard-shortcut help overlay
 *
 * Shortcuts are suppressed when the target is an input / textarea /
 * select / contenteditable so typing stays unaffected — the only
 * exception is `Escape`, which closes the help overlay if open
 * (individual modals still handle their own ESC).
 */

const PREFIX_TIMEOUT_MS = 1_200;

export type Shortcut = { keys: string; label: string };

export const SHORTCUT_GROUPS: Array<{ title: string; items: Shortcut[] }> = [
  {
    title: 'Navigate',
    items: [
      { keys: 'g d', label: 'Dashboard' },
      { keys: 'g t', label: 'Task board' },
      { keys: 'g s', label: 'Standup' },
      { keys: 'g c', label: 'Leave calendar' },
      { keys: 'g l', label: 'Request leave' },
      { keys: 'g q', label: 'QA environments' },
      { keys: 'g p', label: 'Prod support' },
      { keys: 'g k', label: 'Parking' },
      { keys: 'g i', label: 'Inbox' },
      { keys: 'g m', label: 'Messages' },
      { keys: 'g a', label: 'All teams' },
    ],
  },
  {
    title: 'Actions',
    items: [
      { keys: '/', label: 'Focus search' },
      { keys: '?', label: 'Toggle this help' },
      { keys: 'Esc', label: 'Close dialog or overlay' },
    ],
  },
];

const PREFIX_ROUTES: Record<string, string> = {
  d: '/dashboard',
  t: '/tasks',
  s: '/standup',
  c: '/calendar',
  l: '/leave/request',
  q: '/qa',
  p: '/prod-support',
  k: '/parking',
  i: '/inbox',
  m: '/inbox',
  a: '/all-teams',
};

// True when the active element is an input-like surface where typing
// should take precedence over global shortcuts.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

type Ctx = {
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
};

const ShortcutsContext = createContext<Ctx | null>(null);

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const prefixRef = useRef<{ key: string; timer: number } | null>(null);

  const clearPrefix = useCallback(() => {
    if (prefixRef.current) {
      window.clearTimeout(prefixRef.current.timer);
      prefixRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // ESC closes the help overlay even when the user is typing
      // (but other surfaces — modals — still handle their own ESC
      // because those listeners ran first).
      if (e.key === 'Escape') {
        if (helpOpen) {
          e.preventDefault();
          setHelpOpen(false);
          clearPrefix();
        }
        return;
      }

      if (isTypingTarget(e.target)) return;

      // Inside a prefix window — resolve the second key.
      if (prefixRef.current?.key === 'g') {
        const route = PREFIX_ROUTES[e.key.toLowerCase()];
        clearPrefix();
        if (route) {
          e.preventDefault();
          navigate(route);
        }
        return;
      }

      // Start a 'g' prefix.
      if (e.key === 'g') {
        e.preventDefault();
        const timer = window.setTimeout(clearPrefix, PREFIX_TIMEOUT_MS);
        prefixRef.current = { key: 'g', timer };
        return;
      }

      // '?' toggles help (shifted '/').
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      // '/' focuses the header search input, if present.
      if (e.key === '/') {
        const search = document.querySelector<HTMLInputElement>('[data-shortcut="search"]');
        if (search) {
          e.preventDefault();
          search.focus();
          search.select?.();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearPrefix();
    };
  }, [clearPrefix, helpOpen, navigate]);

  return (
    <ShortcutsContext.Provider value={{ helpOpen, setHelpOpen }}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx)
    throw new Error(
      'useKeyboardShortcuts must be used within a KeyboardShortcutsProvider',
    );
  return ctx;
}
