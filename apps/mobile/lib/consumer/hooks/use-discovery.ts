/**
 * Discovery Hooks
 * ===============
 *
 * Phase 15: Consumer Marketplace
 * Hooks for discovering and searching businesses.
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';

interface LocationData {
  lat: number;
  lng: number;
}

interface Business {
  id: string;
  displayName: string;
  logoUrl?: string;
  coverPhotoUrl?: string;
  shortDescription?: string;
  description?: string;
  overallRating?: number;
  ratingCount?: number;
  avgResponseTimeHours?: number;
  totalJobsCompleted?: number;
  badges?: string[];
  categories?: string[];
  services?: any[];
  serviceAreas?: any[];
  maxTravelDistanceKm?: number;
  acceptsEmergency?: boolean;
  verified?: boolean;
  punctualityRating?: number;
  qualityRating?: number;
  priceRating?: number;
  communicationRating?: number;
  distance?: number;
}

interface SearchFilters {
  category?: string;
  minRating?: number;
  maxDistance?: number;
  hasEmergency?: boolean;
  verified?: boolean;
  sortBy?: 'rating' | 'distance' | 'response_time' | 'relevance';
}

interface Review {
  id: string;
  overallRating: number;
  comment?: string;
  consumerName?: string;
  createdAt: string;
  wouldRecommend?: boolean;
  businessResponse?: string;
  businessResponseAt?: string;
  verified?: boolean;
}

// Get top-rated businesses near location
export function useTopBusinesses(location: LocationData | null) {
  return useQuery({
    queryKey: ['topBusinesses', location?.lat, location?.lng],
    queryFn: async () => {
      if (!location) return [];

      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        limit: '10',
      });

      const response = await apiRequest<Business[]>(
        `/consumer/discovery/top?${params.toString()}`
      );

      return response.data || [];
    },
    enabled: !!location,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Search businesses with filters
export function useSearchBusinesses(
  query: string,
  filters: SearchFilters,
  location: LocationData | null
) {
  return useInfiniteQuery({
    queryKey: ['searchBusinesses', query, filters, location?.lat, location?.lng],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();

      if (query) params.append('q', query);
      if (filters.category) params.append('category', filters.category);
      if (filters.minRating) params.append('minRating', filters.minRating.toString());
      if (filters.maxDistance) params.append('radiusKm', filters.maxDistance.toString());
      if (filters.hasEmergency) params.append('hasEmergency', 'true');
      if (filters.verified) params.append('verified', 'true');
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (location) {
        params.append('lat', location.lat.toString());
        params.append('lng', location.lng.toString());
      }
      params.append('page', pageParam.toString());
      params.append('limit', '20');

      const response = await apiRequest<{
        results: Business[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/consumer/discovery/search?${params.toString()}`);

      return {
        businesses: response.data?.results || [],
        total: response.data?.total || 0,
        page: response.data?.page || pageParam,
        totalPages: response.data?.totalPages || 1,
      };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    select: (data) => ({
      businesses: data.pages.flatMap((page) => page.businesses),
      total: data.pages[0]?.total || 0,
    }),
    enabled: true,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Get business profile with reviews
export function useBusinessProfile(businessId: string | undefined) {
  const businessQuery = useQuery({
    queryKey: ['business', businessId],
    queryFn: async () => {
      const response = await apiRequest<Business>(
        `/consumer/discovery/business/${businessId}`
      );
      return response.data;
    },
    enabled: !!businessId,
    staleTime: 1000 * 60 * 5,
  });

  const reviewsQuery = useQuery({
    queryKey: ['businessReviews', businessId],
    queryFn: async () => {
      const response = await apiRequest<{
        reviews: Review[];
        total: number;
      }>(`/consumer/reviews/business/${businessId}?limit=10`);
      return response.data?.reviews || [];
    },
    enabled: !!businessId,
    staleTime: 1000 * 60 * 5,
  });

  return {
    business: businessQuery.data,
    reviews: reviewsQuery.data,
    isLoading: businessQuery.isLoading || reviewsQuery.isLoading,
    error: businessQuery.error || reviewsQuery.error,
    refetch: () => {
      businessQuery.refetch();
      reviewsQuery.refetch();
    },
  };
}

export default {
  useTopBusinesses,
  useSearchBusinesses,
  useBusinessProfile,
};
