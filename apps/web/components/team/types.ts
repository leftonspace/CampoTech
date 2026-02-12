/**
 * Shared types for team components
 */

import type { TradeCertification } from '@/lib/team/trade-config';

export interface TeamMember {
    id: string;
    name: string;
    phone: string;
    email?: string;
    role: 'OWNER' | 'ADMIN' | 'TECHNICIAN';
    // Legacy single specialty (for backwards compatibility)
    specialty?: string;
    matricula?: string;
    skillLevel?: string;
    // New multi-specialty structure
    specialties?: string[];
    certifications?: Record<string, TradeCertification>;
    avatar?: string;
    isActive: boolean;
    createdAt?: string;
    jobCount: number;
    avgRating: number | null;
    reviewCount: number;
    // Driver's license (for vehicle assignment)
    driverLicenseNumber?: string;
    driverLicenseExpiry?: string;
    driverLicenseCategory?: string;
    driverLicensePhotoFront?: string;
    driverLicensePhotoBack?: string;
}

export interface TeamStats {
    totalEmployees: number;
    activeTechnicians: number;
    inProgressCount: number;
    averageRating: number;
}

export type TabType = 'employees' | 'availability' | 'my-schedule';

export type LiveStatusType = 'UNAVAILABLE' | 'OFF_SHIFT' | 'BUSY' | 'AVAILABLE';

export interface UserLiveStatus {
    userId: string;
    status: LiveStatusType;
    statusLabel: string;
    statusColor: string;
    reason?: string;
    currentJobId?: string;
    jobNumber?: string;
    hasSchedule?: boolean;
}

export interface ScheduleEntry {
    id: string;
    userId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
}

export { TradeCertification };
