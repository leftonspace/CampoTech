/**
 * useTeamMembers Hook
 * ===================
 *
 * Fetches real team members (technicians) from the server API.
 * Replaces the hardcoded MOCK_TECHNICIANS pattern.
 *
 * Uses the existing /api/users?role=TECHNICIAN endpoint.
 */

import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

export interface TeamMember {
    id: string;
    name: string;
    role: string;
    isActive: boolean;
    avatar?: string | null;
    specialty?: string | null;
}

interface UseTeamMembersResult {
    teamMembers: TeamMember[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * Fetches team members from the API.
 * Defaults to fetching TECHNICIAN role but can be overridden.
 *
 * @param role - Filter by role (default: undefined = all team members)
 */
export function useTeamMembers(role?: string): UseTeamMembersResult {
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTeamMembers = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
            const token = await SecureStore.getItemAsync('auth_token');

            if (!token) {
                setTeamMembers([]);
                return;
            }

            const params = new URLSearchParams({ limit: '100' });
            if (role) {
                params.set('role', role);
            }

            const response = await fetch(`${apiUrl}/api/users?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                const members: TeamMember[] = data.data.map((user: {
                    id: string;
                    name: string;
                    role: string;
                    isActive: boolean;
                    avatar?: string | null;
                    specialty?: string | null;
                }) => ({
                    id: user.id,
                    name: user.name,
                    role: user.role,
                    isActive: user.isActive,
                    avatar: user.avatar,
                    specialty: user.specialty,
                }));

                setTeamMembers(members);
            } else {
                setTeamMembers([]);
            }
        } catch (err) {
            console.error('[useTeamMembers] Error fetching team members:', err);
            setError(err instanceof Error ? err.message : 'Error al cargar el equipo');
            setTeamMembers([]);
        } finally {
            setIsLoading(false);
        }
    }, [role]);

    useEffect(() => {
        fetchTeamMembers();
    }, [fetchTeamMembers]);

    return { teamMembers, isLoading, error, refetch: fetchTeamMembers };
}
