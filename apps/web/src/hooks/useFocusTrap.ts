import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keyboard focus-trap for modal/drawer roots.
 *
 *  - When the modal opens, captures whatever element had focus so we can
 *    return to it on close (keeps the keyboard context for the user who
 *    triggered it).
 *  - If nothing inside the modal is already focused, focuses the first
 *    tabbable child (autoFocus on form inputs still wins because it
 *    runs first).
 *  - Tab / Shift+Tab cycle stays inside the modal instead of leaking
 *    back to the page behind it.
 *
 * Attach the returned ref to the modal's root element (the one with
 * role="dialog"). Call with `active: false` if the modal's JSX stays
 * mounted while hidden — otherwise leave it defaulted.
 */
export function useFocusTrap<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null && !el.hasAttribute('aria-hidden'),
      );

    // Only steal focus if nothing inside is already focused (respects
    // autoFocus on inputs — React has already moved focus there).
    if (!root.contains(document.activeElement)) {
      // Defer one tick so autoFocus runs first.
      queueMicrotask(() => {
        const focusables = getFocusable();
        focusables[0]?.focus();
      });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusable();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !root.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Return focus to whatever triggered the modal, if it's still in
      // the DOM. Wrapping in try/catch because focus() can throw on
      // detached elements.
      try {
        previouslyFocused?.focus?.();
      } catch {
        /* ignore */
      }
    };
  }, [active]);

  return ref;
}
