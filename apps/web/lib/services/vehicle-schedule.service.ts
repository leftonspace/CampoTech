/**
 * Vehicle Schedule Service
 * =========================
 *
 * Phase 2.1: Date/Time-Aware Vehicle Assignments
 *
 * This service manages vehicle assignments with support for:
 * - Permanent assignments (default vehicle for a technician)
 * - Date-range assignments (specific period)
 * - Recurring assignments (specific days of the week)
 *
 * Priority Order: DATE_RANGE > RECURRING > PERMANENT
 */
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// Schedule types matching the Prisma enum
export type VehicleScheduleType = 'PERMANENT' | 'DATE_RANGE' | 'RECURRING';

// Inferred types from Prisma queries (use any to avoid stale cache issues)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VehicleScheduleWithVehicle = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VehicleWithSchedules = any;

export interface ScheduleResult {
    success: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schedule?: any;
    error?: string;
}

export interface VehicleForDateTimeResult {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicle: any | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schedule: any | null;
    matchType: 'permanent' | 'date_range' | 'recurring' | null;
}

export interface CreateScheduleInput {
    organizationId: string;
    userId: string;
    vehicleId: string;
    scheduleType: VehicleScheduleType;
    startDate?: Date | null;
    endDate?: Date | null;
    timeStart?: string | null; // HH:mm format
    timeEnd?: string | null; // HH:mm format
    daysOfWeek?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
    priority?: number;
    createdById: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class VehicleScheduleService {
    /**
     * Get vehicle assigned to technician for a specific date/time
     * Priority: DATE_RANGE > RECURRING > PERMANENT
     */
    async getVehicleForDateTime(
        userId: string,
        date: Date,
        time?: string
    ): Promise<VehicleForDateTimeResult> {
        const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
        const dateOnly = new Date(date.toISOString().split('T')[0]); // Strip time

        // Fetch all active schedules for this user
        const schedules = await prisma.vehicleSchedule.findMany({
            where: { userId },
            include: { vehicle: true },
            orderBy: [{ priority: 'asc' }, { scheduleType: 'asc' }],
        });

        // Check schedules in priority order
        for (const schedule of schedules) {
            const matches = this.scheduleMatchesDateTime(schedule, dateOnly, dayOfWeek, time);
            if (matches) {
                return {
                    vehicle: schedule.vehicle,
                    schedule,
                    matchType: schedule.scheduleType.toLowerCase() as 'permanent' | 'date_range' | 'recurring',
                };
            }
        }

        return { vehicle: null, schedule: null, matchType: null };
    }

    /**
     * Check if a schedule matches the given date/time
     */
    private scheduleMatchesDateTime(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schedule: any,
        date: Date,
        dayOfWeek: number,
        time?: string
    ): boolean {
        // First check time constraints if specified
        if (time && schedule.timeStart && schedule.timeEnd) {
            if (time < schedule.timeStart || time > schedule.timeEnd) {
                return false;
            }
        }

        switch (schedule.scheduleType) {
            case 'PERMANENT':
                // Permanent always matches (unless time check failed above)
                return true;

            case 'DATE_RANGE':
                // Check if date is within range
                if (schedule.startDate && date < schedule.startDate) {
                    return false;
                }
                if (schedule.endDate && date > schedule.endDate) {
                    return false;
                }
                return true;

            case 'RECURRING':
                // Check if day of week matches
                if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
                    if (!schedule.daysOfWeek.includes(dayOfWeek)) {
                        return false;
                    }
                }
                // Also check date range if specified
                if (schedule.startDate && date < schedule.startDate) {
                    return false;
                }
                if (schedule.endDate && date > schedule.endDate) {
                    return false;
                }
                return true;

            default:
                return false;
        }
    }

    /**
     * Check if a vehicle is available for a specific date/time
     * (i.e., not already assigned to another user)
     */
    async isVehicleAvailable(
        vehicleId: string,
        date: Date,
        time?: string,
        excludeUserId?: string
    ): Promise<boolean> {
        const dayOfWeek = date.getDay();
        const dateOnly = new Date(date.toISOString().split('T')[0]);

        // Fetch all schedules for this vehicle
        const schedules = await prisma.vehicleSchedule.findMany({
            where: {
                vehicleId,
                ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
            },
            include: { vehicle: true },
        });

        // Check if any schedule conflicts
        for (const schedule of schedules) {
            const conflicts = this.scheduleMatchesDateTime(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                schedule as any,
                dateOnly,
                dayOfWeek,
                time
            );
            if (conflicts) {
                return false;
            }
        }

        return true;
    }

    /**
     * Set default (permanent) vehicle for a technician
     * Replaces any existing permanent assignment
     */
    async setDefaultVehicle(
        organizationId: string,
        userId: string,
        vehicleId: string,
        createdById: string
    ): Promise<ScheduleResult> {
        try {
            // Remove existing permanent assignment
            await prisma.vehicleSchedule.deleteMany({
                where: {
                    userId,
                    scheduleType: 'PERMANENT',
                },
            });

            // Create new permanent assignment
            const schedule = await prisma.vehicleSchedule.create({
                data: {
                    organizationId,
                    userId,
                    vehicleId,
                    scheduleType: 'PERMANENT',
                    priority: 1000, // Lowest priority (permanent is fallback)
                    createdById,
                },
            });

            return { success: true, schedule };
        } catch (error) {
            console.error('[VehicleSchedule] Error setting default vehicle:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create a date-range vehicle assignment
     */
    async createDateRangeSchedule(
        input: Omit<CreateScheduleInput, 'scheduleType' | 'daysOfWeek'>
    ): Promise<ScheduleResult> {
        try {
            // Validate date range
            if (input.startDate && input.endDate && input.endDate < input.startDate) {
                return { success: false, error: 'End date must be after start date' };
            }

            const schedule = await prisma.vehicleSchedule.create({
                data: {
                    organizationId: input.organizationId,
                    userId: input.userId,
                    vehicleId: input.vehicleId,
                    scheduleType: 'DATE_RANGE',
                    startDate: input.startDate ?? null,
                    endDate: input.endDate ?? null,
                    timeStart: input.timeStart ?? null,
                    timeEnd: input.timeEnd ?? null,
                    priority: input.priority ?? 10, // Higher priority than permanent
                    createdById: input.createdById,
                },
            });

            return { success: true, schedule };
        } catch (error) {
            console.error('[VehicleSchedule] Error creating date range schedule:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create a recurring (day-of-week based) vehicle assignment
     */
    async createRecurringSchedule(
        input: Omit<CreateScheduleInput, 'scheduleType'>
    ): Promise<ScheduleResult> {
        try {
            // Validate days of week
            if (!input.daysOfWeek || input.daysOfWeek.length === 0) {
                return { success: false, error: 'At least one day of week must be specified' };
            }

            // Validate day values (0-6)
            const validDays = input.daysOfWeek.every((day) => day >= 0 && day <= 6);
            if (!validDays) {
                return { success: false, error: 'Days of week must be 0-6 (Sunday-Saturday)' };
            }

            const schedule = await prisma.vehicleSchedule.create({
                data: {
                    organizationId: input.organizationId,
                    userId: input.userId,
                    vehicleId: input.vehicleId,
                    scheduleType: 'RECURRING',
                    startDate: input.startDate ?? null,
                    endDate: input.endDate ?? null,
                    timeStart: input.timeStart ?? null,
                    timeEnd: input.timeEnd ?? null,
                    daysOfWeek: input.daysOfWeek,
                    priority: input.priority ?? 50, // Medium priority
                    createdById: input.createdById,
                },
            });

            return { success: true, schedule };
        } catch (error) {
            console.error('[VehicleSchedule] Error creating recurring schedule:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create any type of schedule (unified method)
     */
    async createSchedule(input: CreateScheduleInput): Promise<ScheduleResult> {
        switch (input.scheduleType) {
            case 'PERMANENT':
                return this.setDefaultVehicle(
                    input.organizationId,
                    input.userId,
                    input.vehicleId,
                    input.createdById
                );

            case 'DATE_RANGE':
                return this.createDateRangeSchedule(input);

            case 'RECURRING':
                return this.createRecurringSchedule(input);

            default:
                return { success: false, error: 'Invalid schedule type' };
        }
    }

    /**
     * Update an existing schedule
     */
    async updateSchedule(
        scheduleId: string,
        updates: Partial<Omit<CreateScheduleInput, 'organizationId' | 'createdById'>>
    ): Promise<ScheduleResult> {
        try {
            const schedule = await prisma.vehicleSchedule.update({
                where: { id: scheduleId },
                data: {
                    ...(updates.userId && { userId: updates.userId }),
                    ...(updates.vehicleId && { vehicleId: updates.vehicleId }),
                    ...(updates.scheduleType && { scheduleType: updates.scheduleType }),
                    ...(updates.startDate !== undefined && { startDate: updates.startDate }),
                    ...(updates.endDate !== undefined && { endDate: updates.endDate }),
                    ...(updates.timeStart !== undefined && { timeStart: updates.timeStart }),
                    ...(updates.timeEnd !== undefined && { timeEnd: updates.timeEnd }),
                    ...(updates.daysOfWeek !== undefined && { daysOfWeek: updates.daysOfWeek }),
                    ...(updates.priority !== undefined && { priority: updates.priority }),
                },
            });

            return { success: true, schedule };
        } catch (error) {
            console.error('[VehicleSchedule] Error updating schedule:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Delete a schedule
     */
    async deleteSchedule(scheduleId: string): Promise<{ success: boolean; error?: string }> {
        try {
            await prisma.vehicleSchedule.delete({
                where: { id: scheduleId },
            });
            return { success: true };
        } catch (error) {
            console.error('[VehicleSchedule] Error deleting schedule:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get all schedules for a user
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getUserSchedules(userId: string): Promise<any[]> {
        return prisma.vehicleSchedule.findMany({
            where: { userId },
            include: { vehicle: true },
            orderBy: [{ priority: 'asc' }, { scheduleType: 'asc' }],
        });
    }

    /**
     * Get all schedules for a vehicle
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getVehicleSchedules(vehicleId: string): Promise<any[]> {
        return prisma.vehicleSchedule.findMany({
            where: { vehicleId },
            include: {
                user: {
                    select: { id: true, name: true },
                },
            },
            orderBy: [{ priority: 'asc' }, { scheduleType: 'asc' }],
        });
    }

    /**
     * Get schedules for an organization
     */
    async getOrganizationSchedules(
        organizationId: string,
        options?: { userId?: string; vehicleId?: string }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any[]> {
        return prisma.vehicleSchedule.findMany({
            where: {
                organizationId,
                ...(options?.userId && { userId: options.userId }),
                ...(options?.vehicleId && { vehicleId: options.vehicleId }),
            },
            include: {
                vehicle: true,
                user: {
                    select: { id: true, name: true },
                },
            },
            orderBy: [{ priority: 'asc' }, { scheduleType: 'asc' }],
        });
    }

    /**
     * Get default (permanent) vehicle for a user
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getDefaultVehicle(userId: string): Promise<any | null> {
        const schedule = await prisma.vehicleSchedule.findFirst({
            where: {
                userId,
                scheduleType: 'PERMANENT',
            },
            include: { vehicle: true },
        });

        return schedule?.vehicle ?? null;
    }

    /**
     * Check for scheduling conflicts
     */
    async checkForConflicts(
        vehicleId: string,
        scheduleType: VehicleScheduleType,
        startDate?: Date | null,
        endDate?: Date | null,
        daysOfWeek?: number[],
        excludeScheduleId?: string
    ): Promise<{ hasConflict: boolean; conflictingSchedules: any[] }> {
        // Get all schedules for this vehicle
        const schedules = await prisma.vehicleSchedule.findMany({
            where: {
                vehicleId,
                ...(excludeScheduleId && { id: { not: excludeScheduleId } }),
            },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conflictingSchedules: any[] = [];

        for (const schedule of schedules) {
            // Check for overlap based on schedule types
            let hasOverlap = false;

            if (scheduleType === 'PERMANENT' || schedule.scheduleType === 'PERMANENT') {
                // Permanent schedules always potentially conflict
                hasOverlap = true;
            } else if (scheduleType === 'DATE_RANGE' && schedule.scheduleType === 'DATE_RANGE') {
                // Check date range overlap
                hasOverlap = this.dateRangesOverlap(
                    startDate ?? null,
                    endDate ?? null,
                    schedule.startDate,
                    schedule.endDate
                );
            } else if (scheduleType === 'RECURRING' && schedule.scheduleType === 'RECURRING') {
                // Check if any days of week overlap
                const overlappingDays = (daysOfWeek ?? []).some((day) =>
                    schedule.daysOfWeek.includes(day)
                );
                // Also check date ranges overlap
                hasOverlap =
                    overlappingDays &&
                    this.dateRangesOverlap(
                        startDate ?? null,
                        endDate ?? null,
                        schedule.startDate,
                        schedule.endDate
                    );
            }

            if (hasOverlap) {
                conflictingSchedules.push(schedule);
            }
        }

        return {
            hasConflict: conflictingSchedules.length > 0,
            conflictingSchedules,
        };
    }

    private dateRangesOverlap(
        start1: Date | null,
        end1: Date | null,
        start2: Date | null,
        end2: Date | null
    ): boolean {
        // If either range is unbounded, they potentially overlap
        if (!start1 && !end1) return true;
        if (!start2 && !end2) return true;

        // Check for overlap
        const rangeStart1 = start1 ?? new Date(0);
        const rangeEnd1 = end1 ?? new Date('9999-12-31');
        const rangeStart2 = start2 ?? new Date(0);
        const rangeEnd2 = end2 ?? new Date('9999-12-31');

        return rangeStart1 <= rangeEnd2 && rangeEnd1 >= rangeStart2;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const vehicleScheduleService = new VehicleScheduleService();
