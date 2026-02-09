import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { normalizeForSearch } from '../shared/utils/text.utils';

export interface CustomerFilter {
    search?: string;
    email?: string;
    phone?: string;
    tag?: string;
    filter?: 'vip' | 'new' | 'frequent';
    customerType?: string;
    createdAfter?: Date;
    createdBefore?: Date;
}

export interface PaginationOptions {
    page?: number;
    limit?: number;
    cursor?: string;
    sort?: string;
    order?: 'asc' | 'desc';
}

export class CustomerService {
    /**
     * List customers with flexible filtering and pagination.
     * Supports accent-insensitive search for Argentine names (Pérez, González, etc.)
     */
    static async listCustomers(orgId: string, filters: CustomerFilter = {}, pagination: PaginationOptions = {}) {
        const { search, email, phone, tag, filter, customerType, createdAfter, createdBefore } = filters;
        const { page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = pagination;

        const where: any = {
            organizationId: orgId,
        };

        // Customer type filter
        if (customerType) {
            where.customerType = customerType;
        }

        // Note: We intentionally don't apply search filter in the DB query
        // to enable accent-insensitive matching (e.g., "perez" finds "Pérez")
        // Client-side filtering is applied later

        if (email) where.email = email;
        if (phone) where.phone = phone;

        if (createdAfter || createdBefore) {
            where.createdAt = {};
            if (createdAfter) where.createdAt.gte = createdAfter;
            if (createdBefore) where.createdAt.lte = createdBefore;
        }

        if (filter === 'new') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const existingCreatedAt = where.createdAt as any;
            where.createdAt = { ...(typeof existingCreatedAt === 'object' ? existingCreatedAt : {}), gte: thirtyDaysAgo };
        }

        // Client-side accent-insensitive filter function
        const normalizedSearch = search ? normalizeForSearch(search) : null;
        const matchesSearch = (customer: any): boolean => {
            if (!normalizedSearch) return true;
            const searchableTexts = [
                customer.name || '',
                customer.email || '',
                customer.phone || '',
            ];
            return searchableTexts.some(text =>
                normalizeForSearch(text).includes(normalizedSearch)
            );
        };

        // Determine if we need complex aggregation (frequent filter, or sorting by jobs/revenue)
        const needsAggregation = filter === 'frequent' || sort === 'jobCount' || sort === 'totalSpent';

        let items: any[];
        let total: number;

        if (needsAggregation || search) {
            // Aggregation-heavy query or search query (both need client-side filtering)
            const allCustomers = await prisma.customer.findMany({
                where,
                include: {
                    _count: { select: { jobs: true, invoices: true } },
                },
            });

            const customerIds = allCustomers.map((c: any) => c.id);

            const [jobCounts, invoiceTotals, ratings] = await Promise.all([
                prisma.job.groupBy({
                    by: ['customerId'],
                    where: { customerId: { in: customerIds } },
                    _count: { id: true },
                }),
                prisma.invoice.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIds },
                        status: { in: ['PAID', 'SENT'] },
                    },
                    _sum: { total: true },
                }),
                prisma.review.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIds },
                        rating: { not: null },
                    },
                    _avg: { rating: true },
                }),
            ]);

            const jobCountMap = new Map(jobCounts.map((j: any) => [j.customerId, j._count.id]));
            const revenueMap = new Map(invoiceTotals.map((i: any) => [i.customerId, Number(i._sum.total) || 0]));
            const ratingMap = new Map(ratings.map((r: any) => [r.customerId, r._avg.rating]));

            items = allCustomers.map((c: any) => ({
                ...c,
                jobCount: jobCountMap.get(c.id) || 0,
                totalSpent: revenueMap.get(c.id) || 0,
                averageRating: ratingMap.get(c.id) || null,
            }));

            // Apply accent-insensitive search filter
            if (search) {
                items = items.filter(matchesSearch);
            }

            if (filter === 'frequent') {
                items = items.filter(c => c.jobCount >= 5);
            }

            // Apply sorting
            if (sort === 'jobCount') {
                items.sort((a, b) => order === 'desc' ? b.jobCount - a.jobCount : a.jobCount - b.jobCount);
            } else if (sort === 'totalSpent') {
                items.sort((a, b) => order === 'desc' ? b.totalSpent - a.totalSpent : a.totalSpent - b.totalSpent);
            } else {
                items.sort((a, b) => {
                    const valA = (a as any)[sort];
                    const valB = (b as any)[sort];
                    if (valA < valB) return order === 'desc' ? 1 : -1;
                    if (valA > valB) return order === 'desc' ? -1 : 1;
                    return 0;
                });
            }

            total = items.length;
            items = items.slice((page - 1) * limit, page * limit);
        } else {
            // Standard paginated query (no search, no aggregation needed)
            const orderBy: any = {
                [sort]: order,
            };

            [items, total] = await Promise.all([
                prisma.customer.findMany({
                    where,
                    orderBy,
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        _count: {
                            select: { jobs: true, invoices: true },
                        },
                    },
                }),
                prisma.customer.count({ where }),
            ]);

            const customerIds = items.map(c => c.id);
            const [jobCounts, invoiceTotals, ratings] = await Promise.all([
                prisma.job.groupBy({
                    by: ['customerId'],
                    where: { customerId: { in: customerIds } },
                    _count: { id: true },
                }),
                prisma.invoice.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIds },
                        status: { in: ['PAID', 'SENT'] },
                    },
                    _sum: { total: true },
                }),
                prisma.review.groupBy({
                    by: ['customerId'],
                    where: {
                        customerId: { in: customerIds },
                        rating: { not: null },
                    },
                    _avg: { rating: true },
                }),
            ]);

            const jobCountMap = new Map(jobCounts.map((j: any) => [j.customerId, j._count.id]));
            const revenueMap = new Map(invoiceTotals.map((i: any) => [i.customerId, Number(i._sum.total) || 0]));
            const ratingMap = new Map(ratings.map((r: any) => [r.customerId, r._avg.rating]));

            items = items.map(c => ({
                ...c,
                jobCount: jobCountMap.get(c.id) || 0,
                totalSpent: revenueMap.get(c.id) || 0,
                averageRating: ratingMap.get(c.id) || null,
            }));
        }

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
     * Get a single customer by ID with detailed history and stats
     */
    static async getCustomerById(orgId: string, id: string, options: { includeRecent?: boolean } = {}) {
        const include: any = {
            _count: {
                select: { jobs: true, invoices: true },
            },
        };

        if (options.includeRecent) {
            include.jobs = {
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    technician: {
                        select: { id: true, name: true },
                    },
                },
            };
            include.invoices = {
                orderBy: { createdAt: 'desc' },
                take: 10,
            };
        }

        const customer = await prisma.customer.findFirst({
            where: {
                id,
                organizationId: orgId,
            },
            include,
        });

        if (!customer) return null;

        // Get computed statistics
        const [totalSpentResult, averageRatingResult] = await Promise.all([
            // Total spent from paid/sent invoices
            prisma.invoice.aggregate({
                where: {
                    customerId: id,
                    status: { in: ['PAID', 'SENT'] },
                },
                _sum: { total: true },
            }),
            // Average rating from reviews
            prisma.review.aggregate({
                where: {
                    customerId: id,
                    rating: { not: null },
                },
                _avg: { rating: true },
            }),
        ]);

        return {
            ...customer,
            jobCount: (customer as any)._count.jobs,
            totalSpent: Number(totalSpentResult._sum.total) || 0,
            averageRating: averageRatingResult._avg.rating || null,
        };
    }

    /**
     * Create a new customer
     */
    static async createCustomer(orgId: string, data: any) {
        return prisma.customer.create({
            data: {
                ...data,
                organizationId: orgId,
            },
        });
    }

    /**
     * Update an existing customer
     */
    static async updateCustomer(orgId: string, id: string, data: any) {
        return prisma.customer.update({
            where: {
                id,
                organizationId: orgId,
            },
            data,
        });
    }

    /**
     * Soft delete a customer
     */
    static async deleteCustomer(orgId: string, id: string) {
        // Current schema doesn't seem to have deletedAt, using hard delete for now
        // or we should check if we need to add soft delete to the unified service.
        return prisma.customer.delete({
            where: {
                id,
                organizationId: orgId,
            },
        });
    }

    /**
     * Batch delete customers
     */
    static async batchDeleteCustomers(orgId: string, ids: string[]) {
        return prisma.customer.deleteMany({
            where: {
                id: { in: ids },
                organizationId: orgId,
            },
        });
    }

    /**
     * Get high-level customer statistics
     */
    static async getCustomerStats(orgId: string) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalCount,
            newThisMonth,
            averageRatingResult,
        ] = await Promise.all([
            prisma.customer.count({ where: { organizationId: orgId } }),
            prisma.customer.count({
                where: {
                    organizationId: orgId,
                    createdAt: { gte: startOfMonth },
                },
            }),
            prisma.review.aggregate({
                where: {
                    customer: { organizationId: orgId },
                    rating: { not: null },
                },
                _avg: { rating: true },
            }),
        ]);

        return {
            totalCount,
            newThisMonth,
            vipCount: 0, // Feature pending
            averageRating: averageRatingResult._avg.rating || 0,
        };
    }

    /**
     * Search customers for autocomplete/quick search.
     * Supports accent-insensitive matching for Argentine names.
     */
    static async searchCustomers(orgId: string, query: string, limit: number = 10) {
        // Fetch more results to allow for client-side accent-insensitive filtering
        const allCustomers = await prisma.customer.findMany({
            where: {
                organizationId: orgId,
            },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                address: true,
                customerType: true,
            },
            orderBy: { name: 'asc' },
            take: limit * 10, // Fetch extra for filtering
        });

        // Apply accent-insensitive filtering
        type CustomerResult = typeof allCustomers[0];
        const normalizedQuery = normalizeForSearch(query);
        return allCustomers.filter((customer: CustomerResult) => {
            const searchableTexts = [
                customer.name || '',
                customer.phone || '',
                customer.email || '',
            ];
            return searchableTexts.some(text =>
                normalizeForSearch(text).includes(normalizedQuery)
            );
        }).slice(0, limit);
    }
}
