import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

type Serializer<T> = {
  parse: (raw: string) => T;
  stringify: (v: T) => string;
};

const STRING_SERIALIZER = {
  parse: (raw: string) => raw,
  stringify: (v: string) => v,
} as const;

const JSON_SERIALIZER = {
  parse: JSON.parse,
  stringify: JSON.stringify,
} as const;

/**
 * Persist state to URL query params. Best for filter state that should be
 * shareable and survive reloads. String-only by default.
 */
export function usePersistedState(
  key: string,
  initial: string
): [string, (v: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(key);
  const value = raw ?? initial;

  // IMPORTANT: use the functional updater. Without it, two back-to-back
  // setValue calls (e.g. clear source + clear dependent filter in one
  // onClick) both see the initial URLSearchParams snapshot — the second
  // call overwrites the first, and one of the filters doesn't clear.
  const setValue = useCallback(
    (v: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!v || v === initial) next.delete(key);
          else next.set(key, v);
          return next;
        },
        { replace: true },
      );
    },
    [key, initial, setSearchParams],
  );

  return [value, setValue];
}

/**
 * Persist state to localStorage. Best for per-user preferences
 * (e.g. "default view mode"). Serialises via JSON by default.
 */
export function usePersistedLocalState<T>(
  key: string,
  initial: T,
  serializer: Serializer<T> = JSON_SERIALIZER as Serializer<T>
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) return serializer.parse(raw);
    } catch {
      // ignore
    }
    return initial;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serializer.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value, serializer]);

  return [value, setValue];
}

// Re-exported so consumers that want a plain string URL serializer can use it
export { STRING_SERIALIZER, JSON_SERIALIZER };
