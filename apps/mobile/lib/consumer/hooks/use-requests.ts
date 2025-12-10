/**
 * Requests Hooks
 * ==============
 *
 * Phase 15: Consumer Marketplace
 * Hooks for managing service requests.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';

interface ServiceRequest {
  id: string;
  requestNumber: string;
  consumerId: string;
  category: string;
  serviceType?: string;
  title: string;
  description: string;
  photoUrls?: string[];
  voiceNoteUrl?: string;
  address: string;
  addressExtra?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  city: string;
  urgency: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
  budgetRange?: string;
  status: string;
  quotesReceived?: number;
  createdAt: string;
  updatedAt: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  businessProfileId: string;
  priceType?: string;
  priceAmount?: number;
  priceMin?: number;
  priceMax?: number;
  description?: string;
  estimatedDurationHours?: number;
  status: string;
  createdAt: string;
  business?: {
    id: string;
    displayName: string;
    logoUrl?: string;
    overallRating?: number;
    ratingCount?: number;
  };
}

interface CreateRequestInput {
  category: string;
  serviceType?: string;
  title: string;
  description: string;
  photoUrls?: string[];
  voiceNoteUrl?: string;
  address: string;
  addressExtra?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  city: string;
  urgency: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
  budgetRange?: string;
}

// Get consumer's requests
export function useMyRequests(params?: { status?: string }) {
  return useQuery({
    queryKey: ['myRequests', params?.status],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);

      const response = await apiRequest<{
        data: ServiceRequest[];
        total: number;
      }>(`/consumer/requests?${queryParams.toString()}`);

      return response.data?.data || [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// Get single request with quotes
export function useRequestDetail(requestId: string | undefined) {
  const requestQuery = useQuery({
    queryKey: ['request', requestId],
    queryFn: async () => {
      const response = await apiRequest<ServiceRequest>(
        `/consumer/requests/${requestId}`
      );
      return response.data;
    },
    enabled: !!requestId,
    staleTime: 1000 * 60 * 2,
  });

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

  return {
    request: requestQuery.data,
    quotes: quotesQuery.data,
    isLoading: requestQuery.isLoading || quotesQuery.isLoading,
    error: requestQuery.error || quotesQuery.error,
    refetch: () => {
      requestQuery.refetch();
      quotesQuery.refetch();
    },
  };
}

// Create new request
export function useCreateRequest() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: CreateRequestInput) => {
      const response = await apiRequest<ServiceRequest>('/consumer/requests', {
        method: 'POST',
        body: data,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create request');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
    },
  });

  return {
    createRequest: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

// Cancel request
export function useCancelRequest() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiRequest<ServiceRequest>(
        `/consumer/requests/${requestId}/cancel`,
        { method: 'POST' }
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to cancel request');
      }

      return response.data;
    },
    onSuccess: (_, requestId) => {
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
    },
  });

  return {
    cancelRequest: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

export default {
  useMyRequests,
  useRequestDetail,
  useCreateRequest,
  useCancelRequest,
};
