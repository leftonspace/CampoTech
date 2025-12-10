/**
 * Jobs Hooks
 * ==========
 *
 * Phase 15: Consumer Marketplace
 * Hooks for managing consumer jobs.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';

interface Job {
  id: string;
  jobNumber: string;
  serviceRequestId: string;
  quoteId: string;
  businessProfileId: string;
  title?: string;
  serviceType?: string;
  address: string;
  scheduledDate?: string;
  scheduledTime?: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Business {
  id: string;
  displayName: string;
  logoUrl?: string;
  phone?: string;
  overallRating?: number;
  ratingCount?: number;
}

interface TimelineEvent {
  id: string;
  jobId: string;
  eventType: string;
  title: string;
  description?: string;
  imageUrl?: string;
  createdBy: string;
  createdAt: string;
}

// Get job detail with business info and timeline
export function useJobDetail(jobId: string | undefined) {
  const jobQuery = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const response = await apiRequest<Job>(`/consumer/jobs/${jobId}`);
      return response.data;
    },
    enabled: !!jobId,
    staleTime: 1000 * 60,
  });

  const businessQuery = useQuery({
    queryKey: ['jobBusiness', jobId],
    queryFn: async () => {
      if (!jobQuery.data?.businessProfileId) return null;
      const response = await apiRequest<Business>(
        `/consumer/discovery/business/${jobQuery.data.businessProfileId}`
      );
      return response.data;
    },
    enabled: !!jobQuery.data?.businessProfileId,
    staleTime: 1000 * 60 * 5,
  });

  const timelineQuery = useQuery({
    queryKey: ['jobTimeline', jobId],
    queryFn: async () => {
      const response = await apiRequest<TimelineEvent[]>(
        `/consumer/jobs/${jobId}/timeline`
      );
      return response.data || [];
    },
    enabled: !!jobId,
    staleTime: 1000 * 30,
  });

  return {
    job: jobQuery.data,
    business: businessQuery.data,
    timeline: timelineQuery.data,
    isLoading: jobQuery.isLoading,
    error: jobQuery.error,
    refetch: () => {
      jobQuery.refetch();
      timelineQuery.refetch();
    },
  };
}

// Get consumer's jobs
export function useMyJobs(params?: { status?: string }) {
  return useQuery({
    queryKey: ['myJobs', params?.status],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);

      const response = await apiRequest<{
        data: Job[];
        total: number;
      }>(`/consumer/jobs?${queryParams.toString()}`);

      return response.data?.data || [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export default {
  useJobDetail,
  useMyJobs,
};
