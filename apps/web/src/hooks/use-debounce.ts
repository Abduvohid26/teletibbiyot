'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Realtime eventlar ketma-ket kelganda callback ni birlashtirish */
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay = 800,
): T {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  callbackRef.current = callback;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;
}
