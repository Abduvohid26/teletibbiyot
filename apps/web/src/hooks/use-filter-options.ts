'use client';

import { useCallback } from 'react';
import { api } from '@/lib/api';
import { FilterOptions } from '@/lib/analytics-types';
import { useAsyncQuery } from '@/hooks/use-async-query';

export function useFilterOptions(enabled = true) {
  const queryFn = useCallback(() => api.getFilterOptions(), []);
  return useAsyncQuery<FilterOptions>(queryFn, [], { enabled });
}
