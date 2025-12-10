'use client';

/**
 * App Providers
 * =============
 *
 * Wraps the app with necessary context providers.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerAuthProvider } from '@/lib/customer-auth';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthProvider>
        {children}
      </CustomerAuthProvider>
    </QueryClientProvider>
  );
}
