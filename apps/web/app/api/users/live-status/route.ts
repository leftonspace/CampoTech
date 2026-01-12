/**
 * User Live Status API
 * GET /api/users/live-status - Returns real-time availability status for all team members
 * 
 * STANDBY BUSINESS RULES - Status Priority:
 * 1. 🔴 No Disponible - Has a Sick/Vacation exception today
 * 2. ⚪ Fuera de Turno - Outside weekly hours OR no schedule defined
 * 3. 🟡 Ocupado - Has an IN_PROGRESS job right now
 * 4. 🟢 Disponible - Within working hours + no active job + no exception
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Status types matching Standby business rules
export type LiveStatusType = 'UNAVAILABLE' | 'OFF_SHIFT' | 'BUSY' | 'AVAILABLE';

export interface UserLiveStatus {
    userId: string;
    status: LiveStatusType;
    statusLabel: string;
    statusColor: string;
    reason?: string; // For UNAVAILABLE - shows "Vacaciones", "Enfermedad", etc.
    currentJobId?: string; // For BUSY - the job they're working on
    jobNumber?: string; // Human-readable job number
    hasSchedule: boolean; // Whether user has any schedule records
}

// Check if current time is within schedule hours (Argentina timezone)
function isWithinScheduleHours(startTime: string | null, endTime: string | null): boolean {
    if (!startTime || !endTime) return false;

    // Get current time in Argentina timezone
    const now = new Date();
    const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));

    const currentHour = argentinaTime.getHours();
    const currentMinute = argentinaTime.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Get current date info in Argentina timezone
        const now = new Date();
        const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
        const dayOfWeek = argentinaTime.getDay(); // 0-6 (Sunday-Saturday)

        // Start and end of today in Argentina timezone for date comparisons
        const todayStart = new Date(argentinaTime);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(argentinaTime);
        todayEnd.setHours(23, 59, 59, 999);

        // Fetch all active users in the organization
        const users = await prisma.user.findMany({
            where: {
                organizationId: session.organizationId,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
            },
        });

        const userIds = users.map((u: { id: string; name: string }) => u.id);

        // Fetch today's schedule exceptions (vacations, sick days)
        const todayExceptions = await prisma.scheduleException.findMany({
            where: {
                organizationId: session.organizationId,
                userId: { in: userIds },
                date: {
                    gte: todayStart,
                    lte: todayEnd,
                },
            },
        });

        // Fetch weekly schedules for today's day of week
        const todaySchedules = await prisma.employeeSchedule.findMany({
            where: {
                organizationId: session.organizationId,
                userId: { in: userIds },
                dayOfWeek: dayOfWeek,
            },
        });

        // Fetch ALL weekly schedules to check if user has ANY schedule defined
        const allSchedules = await prisma.employeeSchedule.findMany({
            where: {
                organizationId: session.organizationId,
                userId: { in: userIds },
            },
            select: {
                userId: true,
            },
        });

        // Build set of users who have any schedule defined
        const usersWithSchedule = new Set(allSchedules.map((s: { userId: string }) => s.userId));

        // Fetch active jobs (IN_PROGRESS only for "Ocupado" status)
        const activeJobs = await prisma.job.findMany({
            where: {
                organizationId: session.organizationId,
                status: 'IN_PROGRESS',
                assignments: {
                    some: {
                        technicianId: { in: userIds },
                    },
                },
            },
            select: {
                id: true,
                jobNumber: true,
                status: true,
                assignments: {
                    select: {
                        technicianId: true,
                    },
                },
            },
        });

        // Build user -> active job map
        const userActiveJobMap = new Map<string, { jobId: string; jobNumber: string }>();
        for (const job of activeJobs) {
            for (const assignment of job.assignments) {
                if (assignment.technicianId) {
                    userActiveJobMap.set(assignment.technicianId, {
                        jobId: job.id,
                        jobNumber: job.jobNumber,
                    });
                }
            }
        }

        // Build user -> exception map
        const userExceptionMap = new Map<string, { isAvailable: boolean; reason: string | null }>();
        for (const exception of todayExceptions) {
            userExceptionMap.set(exception.userId, {
                isAvailable: exception.isAvailable,
                reason: exception.reason,
            });
        }

        // Build user -> schedule map
        const userScheduleMap = new Map<string, { startTime: string; endTime: string; isAvailable: boolean }>();
        for (const schedule of todaySchedules) {
            userScheduleMap.set(schedule.userId, {
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                isAvailable: schedule.isAvailable,
            });
        }

        // Calculate live status for each user using STANDBY BUSINESS RULES
        const statuses: UserLiveStatus[] = users.map((user: { id: string; name: string }) => {
            const exception = userExceptionMap.get(user.id);
            const schedule = userScheduleMap.get(user.id);
            const activeJob = userActiveJobMap.get(user.id);
            const hasSchedule = usersWithSchedule.has(user.id);

            // ═══════════════════════════════════════════════════════════════════
            // PRIORITY 1: 🔴 No Disponible - Exception (Sick/Vacation)
            // ═══════════════════════════════════════════════════════════════════
            if (exception && !exception.isAvailable) {
                return {
                    userId: user.id,
                    status: 'UNAVAILABLE' as LiveStatusType,
                    statusLabel: 'No Disponible',
                    statusColor: 'red',
                    reason: exception.reason || undefined,
                    hasSchedule,
                };
            }

            // ═══════════════════════════════════════════════════════════════════
            // PRIORITY 2: ⚪ Fuera de Turno - Outside hours OR no schedule
            // ═══════════════════════════════════════════════════════════════════
            // Determine effective working hours for today
            let startTime: string | null = null;
            let endTime: string | null = null;

            if (exception?.isAvailable) {
                // Special hours exception
                startTime = (exception as { startTime?: string }).startTime || null;
                endTime = (exception as { endTime?: string }).endTime || null;
            } else if (schedule?.isAvailable) {
                // Regular schedule
                startTime = schedule.startTime;
                endTime = schedule.endTime;
            }

            // No schedule defined or not within working hours
            const isWithinHours = isWithinScheduleHours(startTime, endTime);
            if (!startTime || !endTime || !isWithinHours) {
                return {
                    userId: user.id,
                    status: 'OFF_SHIFT' as LiveStatusType,
                    statusLabel: 'Fuera de Turno',
                    statusColor: 'gray',
                    hasSchedule,
                };
            }

            // ═══════════════════════════════════════════════════════════════════
            // PRIORITY 3: 🟡 Ocupado - Has active IN_PROGRESS job
            // ═══════════════════════════════════════════════════════════════════
            if (activeJob) {
                return {
                    userId: user.id,
                    status: 'BUSY' as LiveStatusType,
                    statusLabel: 'Ocupado',
                    statusColor: 'yellow',
                    currentJobId: activeJob.jobId,
                    jobNumber: activeJob.jobNumber,
                    hasSchedule,
                };
            }

            // ═══════════════════════════════════════════════════════════════════
            // PRIORITY 4: 🟢 Disponible - Within hours + no active job
            // ═══════════════════════════════════════════════════════════════════
            return {
                userId: user.id,
                status: 'AVAILABLE' as LiveStatusType,
                statusLabel: 'Disponible',
                statusColor: 'green',
                hasSchedule,
            };
        });

        // Build a map for easy lookup
        const statusMap: Record<string, UserLiveStatus> = {};
        for (const status of statuses) {
            statusMap[status.userId] = status;
        }

        return NextResponse.json({
            success: true,
            data: {
                statuses: statusMap,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error fetching live status:', error);
        return NextResponse.json(
            { success: false, error: 'Error al obtener estado en vivo' },
            { status: 500 }
        );
    }
}
