import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Parse a date string with optional time as Argentina timezone.
 * 
 * This combines the selected date with the actual start time to create
 * an accurate datetime. If no time is provided, defaults to noon to prevent
 * timezone-related date shifts.
 * 
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Optional time in HH:MM format (24h)
 * @returns Date object representing the datetime in Argentina timezone
 * 
 * Examples:
 * - parseDateTimeAsArgentina("2026-01-12", "09:00") → 2026-01-12T09:00:00-03:00
 * - parseDateTimeAsArgentina("2026-01-12") → 2026-01-12T12:00:00-03:00 (noon fallback)
 */
function parseDateTimeAsArgentina(dateStr: string, timeStr?: string | null): Date {
    const time = timeStr || '12:00'; // Default to noon if no time provided
    return new Date(`${dateStr}T${time}:00-03:00`);
}

export interface JobFilter {
    status?: string | string[];
    technicianId?: string;
    durationType?: string;
    customerId?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
}

export class JobService {
    /**
     * List jobs with filtering and pagination
     */
    static async listJobs(orgId: string, filters: JobFilter = {}, pagination: { page?: number; limit?: number; sort?: string; order?: 'asc' | 'desc' } = {}) {
        const { status, technicianId, durationType, customerId, search, startDate, endDate } = filters;
        const { page = 1, limit = 20, sort = 'scheduledDate', order = 'asc' } = pagination;

        const where: Prisma.JobWhereInput = {
            organizationId: orgId,
        };

        if (status) {
            if (Array.isArray(status)) {
                where.status = { in: status.map(s => s.toUpperCase()) as any };
            } else if (status !== 'all') {
                where.status = status.toUpperCase() as any;
            }
        }

        if (durationType && durationType !== 'all') where.durationType = durationType.toUpperCase() as any;
        if (technicianId && technicianId !== 'all') {
            where.OR = [
                { technicianId },
                { assignments: { some: { technicianId } } }
            ];
        }
        if (customerId) where.customerId = customerId;

        if (search) {
            where.OR = [
                ...(where.OR as any[] || []),
                { jobNumber: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        if (startDate || endDate) {
            where.scheduledDate = {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
            };
        }

        const [items, total] = await Promise.all([
            prisma.job.findMany({
                where,
                include: {
                    customer: {
                        select: { id: true, name: true, phone: true, email: true, address: true },
                    },
                    technician: {
                        select: { id: true, name: true },
                    },
                    vehicle: { // Phase 2.1: Include vehicle data
                        select: { id: true, plateNumber: true, make: true, model: true },
                    },
                    assignments: {
                        include: {
                            technician: { select: { id: true, name: true } },
                        },
                    },
                    visits: {
                        orderBy: { visitNumber: 'asc' },
                        include: {
                            technician: { select: { id: true, name: true } },
                        },
                    },
                },
                orderBy: { [sort]: order },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.job.count({ where }),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Create a job with assignments and visits
     */
    static async createJob(orgId: string, userId: string, data: any) {
        const {
            serviceType,
            description,
            urgency = 'NORMAL',
            scheduledDate,
            scheduledTimeSlot,
            customerId,
            technicianIds = [],
            vehicleId = null, // Phase 2.1: Vehicle for this job
            visits = [],
            durationType: bodyDurationType,
        } = data;

        // Generate job number
        const lastJob = await prisma.job.findFirst({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
        });

        const jobCount = lastJob
            ? parseInt(lastJob.jobNumber.replace('JOB-', '')) + 1
            : 1;
        const jobNumber = `JOB-${String(jobCount).padStart(5, '0')}`;

        // Expand visits (recurring logic)
        const expandedVisits = this.expandVisits(visits);

        const hasRecurrence = visits.some((v: any) => v.isRecurring);
        const durationType = bodyDurationType || (hasRecurrence ? 'RECURRING' : (expandedVisits.length > 1 ? 'MULTIPLE_VISITS' : 'SINGLE_VISIT'));
        const visitCount = expandedVisits.length > 1 ? expandedVisits.length : null;

        // Extract start time from scheduledTimeSlot if available
        const startTime = scheduledTimeSlot?.start || null;

        return prisma.job.create({
            data: {
                jobNumber,
                serviceType,
                description,
                urgency,
                scheduledDate: scheduledDate ? parseDateTimeAsArgentina(scheduledDate, startTime) : null,
                scheduledTimeSlot: scheduledTimeSlot || null,
                customerId,
                technicianId: technicianIds[0] || null,
                vehicleId: vehicleId || null, // Phase 2.1: Vehicle for this job
                createdById: userId,
                organizationId: orgId,
                durationType: durationType as any,
                visitCount,
                recurrencePattern: hasRecurrence ? (visits.find((v: any) => v.isRecurring)?.recurrencePattern as any) : null,
                recurrenceCount: hasRecurrence ? visits.find((v: any) => v.isRecurring)?.recurrenceCount : null,
                assignments: {
                    create: technicianIds.map((techId: string) => ({
                        technicianId: techId,
                    })),
                },
                visits: expandedVisits.length > 0 ? {
                    create: expandedVisits.map((visit, index) => ({
                        visitNumber: index + 1,
                        visitConfigIndex: visit.configIndex,
                        scheduledDate: visit.date,
                        scheduledTimeSlot: (visit.timeStart || visit.timeEnd)
                            ? { start: visit.timeStart || '', end: visit.timeEnd || '' }
                            : null,
                        technicianId: visit.technicianIds?.[0] || technicianIds[0] || null,
                    })),
                } : undefined,
            },
            include: {
                customer: true,
                technician: { select: { id: true, name: true } },
                vehicle: { select: { id: true, plateNumber: true, make: true, model: true } }, // Phase 2.1
                assignments: {
                    include: { technician: { select: { id: true, name: true } } },
                },
                visits: {
                    orderBy: { visitNumber: 'asc' },
                    include: { technician: { select: { id: true, name: true } } },
                },
            },
        });
    }

    /**
     * Get a single job by ID
     */
    static async getJobById(orgId: string, id: string) {
        return prisma.job.findFirst({
            where: { id, organizationId: orgId },
            include: {
                customer: true,
                technician: { select: { id: true, name: true } },
                vehicle: { select: { id: true, plateNumber: true, make: true, model: true } }, // Phase 2.1
                assignments: { include: { technician: { select: { id: true, name: true } } } },
                visits: { include: { technician: { select: { id: true, name: true } } } },
            },
        });
    }

    /**
     * Update a job
     */
    static async updateJob(orgId: string, id: string, data: any) {
        return prisma.job.update({
            where: { id, organizationId: orgId },
            data,
            include: {
                customer: true,
                technician: { select: { id: true, name: true } },
                vehicle: { select: { id: true, plateNumber: true, make: true, model: true } }, // Phase 2.1
            },
        });
    }

    /**
     * Delete a job
     */
    static async deleteJob(orgId: string, id: string) {
        // Need to delete related assignments and visits first if they aren't CASCADE
        // Actually Prisma handles this if specified in schema, but let's be safe or just use delete
        return prisma.job.delete({
            where: { id, organizationId: orgId }
        });
    }

    /**
     * Update job status generically with automatic timestamp handling
     */
    static async updateJobStatus(orgId: string, id: string, status: string, additionalData: any = {}) {
        const dbStatus = status.toUpperCase();
        const data: any = {
            status: dbStatus as any,
            ...additionalData
        };

        // Handle timestamps
        if (dbStatus === 'IN_PROGRESS') {
            data.startedAt = new Date();
        } else if (dbStatus === 'COMPLETED') {
            data.completedAt = new Date();
        }

        return prisma.job.update({
            where: { id, organizationId: orgId },
            data,
            include: {
                customer: true,
                technician: {
                    select: { id: true, name: true, role: true },
                },
                assignments: {
                    include: {
                        technician: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });
    }

    /**
     * Assign a technician to a job
     */
    static async assignJob(orgId: string, id: string, technicianId: string) {
        return prisma.$transaction(async (tx) => {
            // Add to JobAssignment if not already there
            await tx.jobAssignment.upsert({
                where: {
                    jobId_technicianId: {
                        jobId: id,
                        technicianId: technicianId
                    }
                },
                create: {
                    jobId: id,
                    technicianId: technicianId
                },
                update: {}
            });

            // Update primary technician and status
            return tx.job.update({
                where: { id, organizationId: orgId },
                data: {
                    technicianId,
                    status: 'ASSIGNED' as any,
                },
            });
        });
    }

    /**
     * Unassign a technician from a job
     */
    static async unassignJob(orgId: string, id: string, technicianId: string) {
        return prisma.$transaction(async (tx) => {
            // Remove from JobAssignment
            await tx.jobAssignment.delete({
                where: {
                    jobId_technicianId: {
                        jobId: id,
                        technicianId: technicianId
                    }
                }
            });

            // If this was the primary technician, clear it
            const job = await tx.job.findUnique({ where: { id } });
            if (job?.technicianId === technicianId) {
                // Find another assigned technician if any
                const remaining = await tx.jobAssignment.findFirst({
                    where: { jobId: id }
                });

                return tx.job.update({
                    where: { id, organizationId: orgId },
                    data: {
                        technicianId: remaining ? remaining.technicianId : null,
                        status: remaining ? undefined : 'PENDING' as any,
                    },
                });
            }

            return job;
        });
    }

    /**
     * Schedule a job
     */
    static async scheduleJob(orgId: string, id: string, scheduledDate: Date, scheduledTimeSlot?: any) {
        return prisma.job.update({
            where: { id, organizationId: orgId },
            data: {
                scheduledDate,
                scheduledTimeSlot: scheduledTimeSlot || null,
                status: 'SCHEDULED' as any,
            },
        });
    }

    /**
     * Start a job
     */
    static async startJob(orgId: string, id: string) {
        return prisma.job.update({
            where: { id, organizationId: orgId },
            data: {
                status: 'IN_PROGRESS' as any,
                startedAt: new Date(),
            },
        });
    }

    /**
     * Complete a job
     */
    static async completeJob(orgId: string, id: string, completionData: any) {
        return prisma.job.update({
            where: { id, organizationId: orgId },
            data: {
                status: 'COMPLETED' as any,
                completedAt: new Date(),
                resolution: completionData.notes,
            },
        });
    }

    private static expandVisits(visits: any[]) {
        const expanded: any[] = [];
        visits.forEach((visit, idx) => {
            const configIndex = visit.visitConfigIndex || (idx + 1);
            // Get start time from visit data
            const visitStartTime = visit.timeStart || null;

            if (visit.isRecurring && visit.recurrencePattern && visit.recurrenceCount) {
                // For recurring, parse initial date with the visit's start time
                const startDate = typeof visit.date === 'string'
                    ? parseDateTimeAsArgentina(visit.date, visitStartTime)
                    : visit.date;
                const dates = this.generateRecurringDates(startDate, visit.recurrencePattern, visit.recurrenceCount);
                dates.forEach(date => {
                    expanded.push({ ...visit, date, configIndex, isFromRecurrence: true });
                });
            } else {
                // Parse single visit date with the visit's start time
                const visitDate = typeof visit.date === 'string'
                    ? parseDateTimeAsArgentina(visit.date, visitStartTime)
                    : visit.date;
                expanded.push({ ...visit, date: visitDate, configIndex, isFromRecurrence: false });
            }
        });
        return expanded;
    }

    /**
     * Get job statistics for the organization
     */
    static async getJobStats(orgId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const [
            totalCount,
            inProgressCount,
            scheduledTodayCount,
            completedThisMonthCount,
        ] = await Promise.all([
            prisma.job.count({
                where: { organizationId: orgId, status: { not: 'CANCELLED' } },
            }),
            prisma.job.count({
                where: { organizationId: orgId, status: 'IN_PROGRESS' },
            }),
            prisma.job.count({
                where: {
                    organizationId: orgId,
                    scheduledDate: { gte: today, lt: tomorrow },
                    status: { not: 'CANCELLED' },
                },
            }),
            prisma.job.count({
                where: {
                    organizationId: orgId,
                    status: 'COMPLETED',
                    completedAt: { gte: startOfMonth },
                },
            }),
        ]);

        return {
            totalCount,
            inProgressCount,
            scheduledTodayCount,
            completedThisMonthCount,
        };
    }

    private static generateRecurringDates(startDate: Date, pattern: string, count: number): Date[] {
        const dates: Date[] = [new Date(startDate)];
        for (let i = 1; i < count; i++) {
            const nextDate = new Date(startDate);
            switch (pattern) {
                case 'WEEKLY': nextDate.setDate(nextDate.getDate() + (7 * i)); break;
                case 'BIWEEKLY': nextDate.setDate(nextDate.getDate() + (14 * i)); break;
                case 'MONTHLY': nextDate.setMonth(nextDate.getMonth() + i); break;
                case 'QUARTERLY': nextDate.setMonth(nextDate.getMonth() + (3 * i)); break;
                case 'BIANNUAL': nextDate.setMonth(nextDate.getMonth() + (6 * i)); break;
                case 'ANNUAL': nextDate.setFullYear(nextDate.getFullYear() + i); break;
                default: nextDate.setDate(nextDate.getDate() + (7 * i));
            }
            dates.push(nextDate);
        }
        return dates;
    }
}
