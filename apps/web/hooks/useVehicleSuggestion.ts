/**
 * useVehicleSuggestion Hook
 * ==========================
 *
 * Phase 2.1 Task 2.1.4: Integrate Vehicle Scheduling into Job Creation
 *
 * This hook fetches the suggested vehicle for a technician based on
 * their schedule for a specific date/time.
 */

'use client';

import { useQuery } from '@tanstack/react-query';

interface Vehicle {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    status: string;
}

interface VehicleSuggestionResult {
    success: boolean;
    vehicle: Vehicle | null;
    matchType: 'permanent' | 'date_range' | 'recurring' | null;
    info?: {
        message: string;
        vehicleName: string;
    };
}

interface UseVehicleSuggestionOptions {
    technicianId: string | null;
    date: string | null;
    time?: string | null;
    enabled?: boolean;
}

/**
 * Hook to get vehicle suggestion for a technician on a specific date/time
 */
export function useVehicleSuggestion({
    technicianId,
    date,
    time,
    enabled = true,
}: UseVehicleSuggestionOptions) {
    return useQuery<VehicleSuggestionResult>({
        queryKey: ['vehicle-suggestion', technicianId, date, time],
        queryFn: async () => {
            if (!technicianId || !date) {
                return { success: false, vehicle: null, matchType: null };
            }

            const params = new URLSearchParams({
                technicianId,
                date,
            });

            if (time) {
                params.append('time', time);
            }

            const response = await fetch(`/api/scheduling/vehicle-for-job?${params}`);
            return response.json();
        },
        enabled: enabled && !!technicianId && !!date,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
        gcTime: 1000 * 60 * 10, // Keep in garbage collection for 10 minutes
    });
}

/**
 * Get display label for match type
 */
export function getMatchTypeLabel(
    matchType: 'permanent' | 'date_range' | 'recurring' | null
): string {
    switch (matchType) {
        case 'permanent':
            return 'predeterminado';
        case 'date_range':
            return 'por fechas';
        case 'recurring':
            return 'recurrente';
        default:
            return '';
    }
}
