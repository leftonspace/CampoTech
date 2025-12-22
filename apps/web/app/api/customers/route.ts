import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterEntitiesByRole,
  getEntityFieldMetadata,
  UserRole,
} from '@/lib/middleware/field-filter';

// Helper type for enriched customer
interface EnrichedCustomer {
  id: string;
  jobCount: number;
  totalSpent: number;
  averageRating: number | null;
  [key: string]: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const filter = searchParams.get('filter'); // 'vip' | 'new' | 'frequent' | null
    const sort = searchParams.get('sort'); // 'name' | 'jobs' | 'revenue' | 'recent'

    const organizationId = session.organizationId;

    // 30 days ago for "new" filter
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      organizationId,
    };

    // Apply search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Apply filter conditions
    // Note: VIP filter returns empty since isVip column doesn't exist in database yet
    if (filter === 'vip') {
      // Return empty result for VIP filter until database is migrated
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    } else if (filter === 'new') {
      // New customers: created within last 30 days
      where.createdAt = { gte: thirtyDaysAgo };
    }
    // 'frequent' filter will be applied after fetching (job count >= 5)

    // Determine sort order
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'name') {
      orderBy = { name: 'asc' };
    } else if (sort === 'recent') {
      orderBy = { createdAt: 'desc' };
    }
    // 'jobs' and 'revenue' sorts will be applied after aggregation

    // Optimized approach: avoid fetching 1000 records for complex sorts/filters
    // For 'frequent' filter or 'jobs'/'revenue' sort, we need aggregated data
    const needsAggregation = filter === 'frequent' || sort === 'jobs' || sort === 'revenue';

    let customers: { id: string; [key: string]: unknown }[];
    let total: number;
    let enrichedCustomers: EnrichedCustomer[];

    if (needsAggregation) {
      // For aggregation-based queries, use a more efficient approach:
      // 1. First get aggregated data for the organization
      // 2. Then fetch only the customers we need

      const [jobCounts, invoiceTotals, ratings, allCustomers, customerCount] = await Promise.all([
        // Job counts per customer (for org)
        prisma.job.groupBy({
          by: ['customerId'],
          where: {
            customer: { organizationId },
            ...(search ? {
              customer: {
                organizationId,
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { phone: { contains: search } },
                  { email: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            } : {}),
          },
          _count: { id: true },
        }),

        // Total spent per customer (for org)
        prisma.invoice.groupBy({
          by: ['customerId'],
          where: {
            customer: { organizationId },
            status: { in: ['PAID', 'SENT'] },
          },
          _sum: { total: true },
        }),

        // Average rating per customer (for org)
        prisma.review.groupBy({
          by: ['customerId'],
          where: {
            customer: { organizationId },
            rating: { not: null },
          },
          _avg: { rating: true },
        }),

        // Get basic customer data (no aggregation overhead)
        prisma.customer.findMany({
          where,
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            organizationId: true,
            locationId: true,
            zoneId: true,
          },
        }),

        prisma.customer.count({ where }),
      ]);

      total = customerCount;

      // Create maps for quick lookup
      const jobCountMap = new Map<string, number>();
      for (const j of jobCounts) {
        jobCountMap.set(j.customerId, j._count.id);
      }

      const totalSpentMap = new Map<string, number>();
      for (const i of invoiceTotals) {
        totalSpentMap.set(i.customerId, Number(i._sum.total) || 0);
      }

      const ratingMap = new Map<string, number | null>();
      for (const r of ratings) {
        ratingMap.set(r.customerId ?? '', r._avg.rating);
      }

      // Enrich customers with computed fields
      enrichedCustomers = allCustomers.map((customer: typeof allCustomers[number]) => ({
        ...customer,
        jobCount: jobCountMap.get(customer.id) || 0,
        totalSpent: totalSpentMap.get(customer.id) || 0,
        averageRating: ratingMap.get(customer.id) || null,
      }));

      // Apply 'frequent' filter (job count >= 5)
      if (filter === 'frequent') {
        enrichedCustomers = enrichedCustomers.filter((c) => c.jobCount >= 5);
        total = enrichedCustomers.length;
      }

      // Apply sorting by jobs or revenue
      if (sort === 'jobs') {
        enrichedCustomers.sort((a, b) => b.jobCount - a.jobCount);
      } else if (sort === 'revenue') {
        enrichedCustomers.sort((a, b) => b.totalSpent - a.totalSpent);
      }

      // Apply pagination
      enrichedCustomers = enrichedCustomers.slice((page - 1) * limit, page * limit);
      customers = enrichedCustomers;
    } else {
      // Standard case: direct database pagination (most efficient)
      const [fetchedCustomers, customerCount] = await Promise.all([
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

      customers = fetchedCustomers;
      total = customerCount;

      // Get aggregated data only for the paginated customers (much smaller set)
      const customerIds: string[] = customers.map((c) => c.id);

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

      // Create maps for quick lookup
      const jobCountMap = new Map<string, number>();
      for (const j of jobCounts) {
        jobCountMap.set(j.customerId, j._count.id);
      }

      const totalSpentMap = new Map<string, number>();
      for (const i of invoiceTotals) {
        totalSpentMap.set(i.customerId, Number(i._sum.total) || 0);
      }

      const ratingMap = new Map<string, number | null>();
      for (const r of ratings) {
        ratingMap.set(r.customerId ?? '', r._avg.rating);
      }

      enrichedCustomers = customers.map((customer) => ({
        ...customer,
        jobCount: jobCountMap.get(customer.id) || 0,
        totalSpent: totalSpentMap.get(customer.id) || 0,
        averageRating: ratingMap.get(customer.id) || null,
      }));
    }

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Filter data based on user role
    const filteredCustomers = filterEntitiesByRole(enrichedCustomers, 'customer', userRole);
    const fieldMeta = getEntityFieldMetadata('customer', userRole);

    return NextResponse.json({
      success: true,
      data: filteredCustomers,
      _fieldMeta: fieldMeta,
      pagination: {
        page,
        limit,
        total: filter === 'frequent'
          ? enrichedCustomers.length
          : total,
        totalPages: Math.ceil(
          (filter === 'frequent' ? enrichedCustomers.length : total) / limit
        ),
      },
    });
  } catch (error) {
    console.error('Customers list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching customers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address || {},
        notes: body.notes,
        organizationId: session.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creating customer' },
      { status: 500 }
    );
  }
}
