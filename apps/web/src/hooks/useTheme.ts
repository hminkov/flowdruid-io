import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'flowdruid-theme';

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // ignore
  }
  return 'system';
}

function applyClass(preference: ThemePreference) {
  const el = document.documentElement;
  el.classList.remove('light', 'dark');
  if (preference !== 'system') el.classList.add(preference);
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStored);

  useEffect(() => {
    applyClass(preference);
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // ignore
    }
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => setPreferenceState(p), []);

  const cycle = useCallback(() => {
    setPreferenceState((p) => (p === 'light' ? 'dark' : p === 'dark' ? 'system' : 'light'));
  }, []);

  return { preference, setPreference, cycle };
}
