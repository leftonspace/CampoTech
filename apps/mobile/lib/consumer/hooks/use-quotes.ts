/**
 * Quotes Hooks
 * ============
 *
 * Phase 15: Consumer Marketplace
 * Hooks for managing quotes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';

interface Quote {
  id: string;
  quoteNumber: string;
  serviceRequestId: string;
  businessProfileId: string;
  priceType?: string;
  priceAmount?: number;
  priceMin?: number;
  priceMax?: number;
  description?: string;
  estimatedDurationHours?: number;
  availableDate?: string;
  status: string;
  createdAt: string;
  business?: {
    id: string;
    displayName: string;
    logoUrl?: string;
    overallRating?: number;
    ratingCount?: number;
    badges?: string[];
  };
}

interface QuoteStats {
  minPrice?: number;
  maxPrice?: number;
  avgPrice?: number;
  avgDuration?: number;
}

// Get quotes for a request
export function useRequestQuotes(requestId: string | undefined) {
  const quotesQuery = useQuery({
    queryKey: ['requestQuotes', requestId],
    queryFn: async () => {
      const response = await apiRequest<Quote[]>(
        `/consumer/requests/${requestId}/quotes`
      );
      return response.data || [];
    },
    enabled: !!requestId,
    staleTime: 1000 * 60,
  });

  const statsQuery = useQuery({
    queryKey: ['requestQuotesStats', requestId],
    queryFn: async () => {
      const response = await apiRequest<{
        quotes: Quote[];
        stats: QuoteStats;
      }>(`/consumer/requests/${requestId}/quotes/compare`);
      return response.data?.stats;
    },
    enabled: !!requestId,
    staleTime: 1000 * 60,
  });

  return {
    quotes: quotesQuery.data,
    stats: statsQuery.data,
    isLoading: quotesQuery.isLoading,
    error: quotesQuery.error,
    refetch: quotesQuery.refetch,
  };
}

// Accept a quote
export function useAcceptQuote() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await apiRequest<Quote>(
        `/consumer/quotes/${quoteId}/accept`,
        { method: 'POST' }
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to accept quote');
      }

      return response.data;
    },
    onSuccess: (data) => {
      if (data?.serviceRequestId) {
        queryClient.invalidateQueries({
          queryKey: ['request', data.serviceRequestId],
        });
        queryClient.invalidateQueries({
          queryKey: ['requestQuotes', data.serviceRequestId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
    },
  });

  return {
    acceptQuote: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

// Decline a quote
export function useDeclineQuote() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ quoteId, reason }: { quoteId: string; reason?: string }) => {
      const response = await apiRequest<Quote>(
        `/consumer/quotes/${quoteId}/decline`,
        {
          method: 'POST',
          body: { reason },
        }
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to decline quote');
      }

      return response.data;
    },
    onSuccess: (data) => {
      if (data?.serviceRequestId) {
        queryClient.invalidateQueries({
          queryKey: ['requestQuotes', data.serviceRequestId],
        });
      }
    },
  });

  return {
    declineQuote: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

export default {
  useRequestQuotes,
  useAcceptQuote,
  useDeclineQuote,
};
