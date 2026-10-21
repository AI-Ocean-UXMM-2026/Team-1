"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    if (value == null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Storage can be unavailable in private browsing; state then lives in memory only.
  }
}

/**
 * State kept in localStorage so a reload or dropped connection loses nothing.
 */
export function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const fallbackRef = useRef(fallback);

  useEffect(() => {
    setValue(readStore(key, fallbackRef.current));
  }, [key]);

  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof next === "function"
            ? (next as (previous: T) => T)(previous)
            : next;
        writeStore(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update] as const;
}
