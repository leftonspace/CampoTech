/**
 * Reviews Hooks
 * =============
 *
 * Phase 15: Consumer Marketplace
 * Hooks for managing reviews.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';

interface SubmitReviewInput {
  businessProfileId: string;
  jobId?: string;
  overallRating: number;
  punctualityRating?: number;
  qualityRating?: number;
  priceRating?: number;
  communicationRating?: number;
  comment?: string;
  wouldRecommend: boolean;
  photos?: string[];
}

interface Review {
  id: string;
  consumerId: string;
  businessProfileId: string;
  jobId?: string;
  overallRating: number;
  comment?: string;
  status: string;
  createdAt: string;
}

// Submit a review
export function useSubmitReview() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: SubmitReviewInput) => {
      const response = await apiRequest<Review>('/consumer/reviews', {
        method: 'POST',
        body: data,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to submit review');
      }

      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate business reviews
      queryClient.invalidateQueries({
        queryKey: ['businessReviews', data.businessProfileId],
      });
      // Invalidate business profile (rating will change)
      queryClient.invalidateQueries({
        queryKey: ['business', data.businessProfileId],
      });
      // Invalidate job if linked
      if (data.jobId) {
        queryClient.invalidateQueries({
          queryKey: ['job', data.jobId],
        });
      }
    },
  });

  return {
    submitReview: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

// Mark review as helpful
export function useMarkHelpful() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await apiRequest(`/consumer/reviews/${reviewId}/helpful`, {
        method: 'POST',
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to mark as helpful');
      }

      return response.data;
    },
    onSuccess: () => {
      // Could invalidate specific queries if needed
    },
  });

  return {
    markHelpful: mutation.mutateAsync,
    isLoading: mutation.isPending,
  };
}

// Report a review
export function useReportReview() {
  const mutation = useMutation({
    mutationFn: async ({
      reviewId,
      reason,
      details,
    }: {
      reviewId: string;
      reason: string;
      details?: string;
    }) => {
      const response = await apiRequest(`/consumer/reviews/${reviewId}/report`, {
        method: 'POST',
        body: { reason, details },
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to report review');
      }

      return response.data;
    },
  });

  return {
    reportReview: mutation.mutateAsync,
    isLoading: mutation.isPending,
  };
}

export default {
  useSubmitReview,
  useMarkHelpful,
  useReportReview,
};
