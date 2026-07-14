'use client';

import { useCallback, useEffect, useState } from 'react';
import { toUserMessage } from '@/lib/errors';

export interface AsyncQueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | undefined>>;
}

export function useAsyncQuery<T>(
  queryFn: () => Promise<T>,
  deps: readonly unknown[],
  options?: { enabled?: boolean; initialData?: T },
): AsyncQueryState<T> {
  const [data, setData] = useState<T | undefined>(options?.initialData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const enabled = options?.enabled ?? true;

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setData(await queryFn());
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps passed explicitly by caller
  }, [enabled, queryFn, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
