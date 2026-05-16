'use client';

/**
 * React Query provider wrapper.
 *
 * Instantiates a QueryClient with sensible defaults (30 s stale time, 1
 * retry) and provides it to the component tree. Placed at the root of the
 * client component tree so all data-fetching hooks share the same cache.
 *
 * Exports:
 * - `Providers` — Wraps children with a QueryClientProvider instance.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/** Provides a React Query client to the component tree. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
