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
    hasPendingVariance?: boolean; // Filter for jobs with tech-proposed prices awaiting approval
}

export class JobService {
    /**
     * List jobs with filtering and pagination
     */
    static async listJobs(orgId: string, filters: JobFilter = {}, pagination: { page?: number; limit?: number; sort?: string; order?: 'asc' | 'desc' } = {}) {
        const { status, technicianId, durationType, customerId, search, startDate, endDate, hasPendingVariance } = filters;
        const { page = 1, limit = 20, sort = 'scheduledDate', order = 'asc' } = pagination;

        const where: Prisma.JobWhereInput = {
            organizationId: orgId,
        };

        // Filter for jobs with pending variance approval
        if (hasPendingVariance) {
            where.techProposedTotal = { not: null };
            where.varianceApprovedAt = null;
            where.varianceRejectedAt = null;
            where.pricingLockedAt = null;
            // Ensure techProposedTotal differs from estimatedTotal
            where.NOT = {
                techProposedTotal: { equals: prisma.job.fields.estimatedTotal },
            };
        }

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
                            vehicleAssignments: {
                                include: {
                                    vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
                                    drivers: {
                                        include: {
                                            user: { select: { id: true, name: true } },
                                        },
                                    },
                                },
                            },
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
     * Phase 6: Now supports multiple vehicles per visit with multiple drivers
     * Phase 1 (Jan 2026): Added per-visit pricing support
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
            vehicleId = null, // Legacy: single vehicle for job (Phase 2.1)
            visits = [],
            durationType: bodyDurationType,
            // Phase 1: Per-visit pricing fields
            pricingMode = 'FIXED_TOTAL',
            defaultVisitRate = null,
            estimatedTotal = null,
            depositAmount = null,
            depositPaymentMethod = null,
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

        // Determine initial status: ASSIGNED if technicians are provided, otherwise PENDING
        const initialStatus = technicianIds.length > 0 ? 'ASSIGNED' : 'PENDING';

        // Use transaction to create job, visits, and vehicle assignments atomically
        const jobId = await prisma.$transaction(
            async (tx) => {
                // Create the job with visits
                const job = await tx.job.create({
                    data: {
                        jobNumber,
                        serviceType,
                        description,
                        urgency,
                        status: initialStatus,
                        scheduledDate: scheduledDate ? parseDateTimeAsArgentina(scheduledDate, startTime) : null,
                        scheduledTimeSlot: scheduledTimeSlot || null,
                        customerId,
                        technicianId: technicianIds[0] || null,
                        vehicleId: vehicleId || null, // Legacy: single vehicle for job
                        createdById: userId,
                        organizationId: orgId,
                        durationType: durationType as any,
                        visitCount,
                        recurrencePattern: hasRecurrence ? (visits.find((v: any) => v.isRecurring)?.recurrencePattern as any) : null,
                        recurrenceCount: hasRecurrence ? visits.find((v: any) => v.isRecurring)?.recurrenceCount : null,
                        // Phase 1: Per-visit pricing fields
                        pricingMode: pricingMode as any,
                        defaultVisitRate: defaultVisitRate ? parseFloat(defaultVisitRate) : null,
                        estimatedTotal: estimatedTotal ? parseFloat(estimatedTotal) : null,
                        depositAmount: depositAmount ? parseFloat(depositAmount) : null,
                        depositPaymentMethod: depositPaymentMethod || null,
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
                                // Phase 1: Per-visit pricing fields
                                estimatedPrice: visit.estimatedPrice ? parseFloat(visit.estimatedPrice) : null,
                                requiresDeposit: visit.requiresDeposit || false,
                                depositAmount: visit.depositAmount ? parseFloat(visit.depositAmount) : null,
                            })),
                        } : undefined,
                    },
                    include: {
                        visits: { orderBy: { visitNumber: 'asc' } },
                    },
                });

                // Phase 6: Create vehicle assignments for each visit
                // Match visits to their vehicle assignments by visitNumber (array index + 1)
                for (const createdVisit of job.visits) {
                    // Find the corresponding expanded visit by matching visitNumber (1-based index)
                    const visitIndex = createdVisit.visitNumber - 1;
                    const expandedVisit = expandedVisits[visitIndex];

                    const vehicleAssignments = expandedVisit?.vehicleAssignments || [];

                    for (const assignment of vehicleAssignments) {
                        if (!assignment.vehicleId) continue;

                        // Create the JobVisitVehicle record
                        const visitVehicle = await tx.jobVisitVehicle.create({
                            data: {
                                jobVisitId: createdVisit.id,
                                vehicleId: assignment.vehicleId,
                            },
                        });

                        // Create JobVisitVehicleDriver records for each driver
                        const driverIds = assignment.driverIds || [];
                        for (const driverId of driverIds) {
                            await tx.jobVisitVehicleDriver.create({
                                data: {
                                    jobVisitVehicleId: visitVehicle.id,
                                    userId: driverId,
                                },
                            });
                        }
                    }
                }

                // Return the job ID to fetch after transaction completes
                return job.id;
            }
        );

        // Fetch the complete job with all relations AFTER the transaction
        // This prevents transaction timeout issues
        return prisma.job.findUniqueOrThrow({
            where: { id: jobId },
            include: {
                customer: true,
                technician: { select: { id: true, name: true } },
                vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
                assignments: {
                    include: { technician: { select: { id: true, name: true } } },
                },
                visits: {
                    orderBy: { visitNumber: 'asc' },
                    include: {
                        technician: { select: { id: true, name: true } },
                        vehicleAssignments: {
                            include: {
                                vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
                                drivers: {
                                    include: {
                                        user: { select: { id: true, name: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Get a single job by ID
     * Phase 6: Includes vehicle assignments per visit
     */
    static async getJobById(orgId: string, id: string) {
        return prisma.job.findFirst({
            where: { id, organizationId: orgId },
            include: {
                customer: true,
                technician: { select: { id: true, name: true } },
                vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
                assignments: { include: { technician: { select: { id: true, name: true } } } },
                visits: {
                    orderBy: { visitNumber: 'asc' },
                    include: {
                        technician: { select: { id: true, name: true } },
                        vehicleAssignments: {
                            include: {
                                vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
                                drivers: {
                                    include: {
                                        user: { select: { id: true, name: true, driverLicenseNumber: true, driverLicenseExpiry: true } },
                                    },
                                },
                            },
                        },
                    },
                },
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

    // ═══════════════════════════════════════════════════════════════════════════════
    // OPTIMIZED QUERY METHODS (Phase 2 - Feb 2026)
    // Uses SQL views for sub-500ms response times
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * Fast job list query using optimized v_jobs_list view
     * Replaces listJobs for performance-critical paths (Jobs page list view)
     * 
     * Performance: ~50-100ms vs ~10-15s for listJobs with 1000+ records
     */
    static async listJobsFast(
        orgId: string,
        filters: JobFilter = {},
        pagination: { page?: number; limit?: number; sort?: string; order?: 'asc' | 'desc' } = {}
    ): Promise<{ items: JobListViewResult[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
        const { status, search, durationType, technicianId, customerId } = filters;
        const { page = 1, limit = 50, sort = 'scheduled_date', order = 'desc' } = pagination;
        const offset = (page - 1) * limit;

        // Build WHERE conditions dynamically
        const conditions: string[] = ['organization_id = $1'];
        const params: (string | number)[] = [orgId];
        let paramIndex = 2;

        // Status filter - requires explicit cast to "JobStatus" enum type
        if (status && status !== 'all') {
            if (Array.isArray(status)) {
                // Multiple statuses: cast each placeholder to JobStatus enum
                const placeholders = status.map((_, i) => `$${paramIndex + i}::"JobStatus"`);
                conditions.push(`status IN (${placeholders.join(', ')})`);
                params.push(...status.map(s => s.toUpperCase()));
                paramIndex += status.length;
            } else {
                conditions.push(`status = $${paramIndex}::"JobStatus"`);
                params.push(status.toUpperCase());
                paramIndex++;
            }
        }

        // Duration type filter - requires explicit cast to "DurationType" enum
        if (durationType && durationType !== 'all') {
            conditions.push(`duration_type = $${paramIndex}::"DurationType"`);
            params.push(durationType.toUpperCase());
            paramIndex++;
        }

        if (technicianId && technicianId !== 'all') {
            conditions.push(`technician_id = $${paramIndex}`);
            params.push(technicianId);
            paramIndex++;
        }

        if (customerId) {
            conditions.push(`customer_id = $${paramIndex}`);
            params.push(customerId);
            paramIndex++;
        }

        if (search) {
            // Accent-insensitive search using normalize_search_text function
            const normalizedSearch = search.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            conditions.push(`(
                normalize_search_text(job_number || ' ' || COALESCE(description, '') || ' ' || COALESCE(customer_name, ''))
                LIKE '%' || $${paramIndex} || '%'
            )`);
            params.push(normalizedSearch);
            paramIndex++;
        }

        const whereClause = conditions.join(' AND ');

        // Map camelCase sort fields to snake_case view columns
        const sortFieldMap: Record<string, string> = {
            'scheduledDate': 'scheduled_date',
            'createdAt': 'created_at',
            'completedAt': 'completed_at',
            'jobNumber': 'job_number',
            'status': 'status',
        };
        const orderColumn = sortFieldMap[sort] || sort;
        const orderDirection = order.toUpperCase();

        // Get items with pagination
        const items = await prisma.$queryRawUnsafe<JobListViewResult[]>(`
            SELECT * FROM v_jobs_list
            WHERE ${whereClause}
            ORDER BY ${orderColumn} ${orderDirection} NULLS LAST
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, ...params, limit, offset);

        // Get total count for pagination (uses same WHERE clause and params)
        const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
            SELECT COUNT(*) as count FROM v_jobs_list
            WHERE ${whereClause}
        `, ...params);

        const total = Number(countResult[0]?.count || 0);

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
     * Fast job counts using optimized v_jobs_counts view
     * Returns all counts in a single query (instant)
     * 
     * Use for: Dashboard stats, tab badges (Todos, Activos, Cancelados)
     */
    static async getJobCountsFast(orgId: string): Promise<JobCountsViewResult | null> {
        const result = await prisma.$queryRaw<JobCountsViewResult[]>`
            SELECT * FROM v_jobs_counts
            WHERE organization_id = ${orgId}
        `;
        return result[0] || null;
    }

    /**
     * Global search using optimized v_global_search view
     * Supports accent-insensitive search for AI Copilot and GlobalSearch component
     * 
     * @param orgId - Organization ID
     * @param query - Search query (natural language)
     * @param options - Optional filters (entityType, limit)
     * @returns Array of search results grouped by entity type
     */
    static async globalSearch(
        orgId: string,
        query: string,
        options: { entityType?: string; limit?: number } = {}
    ): Promise<GlobalSearchResult[]> {
        const { entityType, limit = 35 } = options;

        // Normalize query for accent-insensitive search (María → maria)
        const normalizedQuery = query.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        // Build entity filter if specified
        const entityFilter = entityType ? `AND entity_type = '${entityType}'` : '';

        const results = await prisma.$queryRawUnsafe<GlobalSearchResult[]>(`
            SELECT 
                id,
                entity_type,
                title,
                subtitle,
                badge,
                organization_id,
                created_at,
                sort_date
            FROM v_global_search
            WHERE organization_id = $1
                ${entityFilter}
                AND normalized_text LIKE '%' || $2 || '%'
            ORDER BY 
                CASE entity_type
                    WHEN 'jobs' THEN 1
                    WHEN 'customers' THEN 2
                    WHEN 'team' THEN 3
                    WHEN 'vehicles' THEN 4
                    WHEN 'inventory' THEN 5
                    WHEN 'invoices' THEN 6
                    WHEN 'payments' THEN 7
                END,
                sort_date DESC NULLS LAST
            LIMIT $3
        `, orgId, normalizedQuery, limit);

        return results;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS FOR OPTIMIZED VIEWS (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result type for v_jobs_list view
 * Pre-joined job data with customer, technician, and vehicle info
 */
export interface JobListViewResult {
    id: string;
    job_number: string;
    status: string;
    urgency: string;
    service_type: string;
    service_type_code: string | null;
    description: string;
    scheduled_date: Date | null;
    scheduled_time_slot: unknown;
    duration_type: string;
    pricing_locked_at: Date | null;
    estimated_total: string | null;
    tech_proposed_total: string | null;
    variance_approved_at: Date | null;
    variance_rejected_at: Date | null;
    created_at: Date;
    completed_at: Date | null;
    organization_id: string;
    customer_id: string;
    customer_name: string;
    customer_phone: string;
    customer_address: unknown;
    technician_id: string | null;
    technician_name: string | null;
    assignment_count: number;
    vehicle_id: string | null;
    vehicle_plate: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
}

/**
 * Result type for v_jobs_counts view
 * Aggregated counts for dashboard stats and tab badges
 */
export interface JobCountsViewResult {
    organization_id: string;
    total_count: bigint;
    cancelled_count: bigint;
    active_count: bigint;
    in_progress_count: bigint;
    completed_count: bigint;
    completed_this_month: bigint;
    scheduled_today: bigint;
    pending_variance: bigint;
}

/**
 * Result type for v_global_search view
 * Unified cross-entity search results
 */
export interface GlobalSearchResult {
    id: string;
    entity_type: 'jobs' | 'customers' | 'team' | 'vehicles' | 'inventory' | 'invoices' | 'payments';
    title: string;
    subtitle: string | null;
    badge: string | null;
    organization_id: string;
    created_at: Date;
    sort_date: Date | null;
}

