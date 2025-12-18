import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  filterEntitiesByRole,
  getEntityFieldMetadata,
  UserRole,
} from '@/lib/middleware/field-filter';

// Type for customer with computed fields
type CustomerWithCount = Prisma.CustomerGetPayload<{
  include: { _count: { select: { jobs: true; invoices: true } } };
}>;

interface EnrichedCustomer extends CustomerWithCount {
  jobCount: number;
  totalSpent: number;
  averageRating: number | null;
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

    // Start of current month for "new" filter
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const where: any = {
      organizationId,
    };

    // Apply search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { customerNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Apply filter conditions
    if (filter === 'vip') {
      where.isVip = true;
    } else if (filter === 'new') {
      where.createdAt = { gte: startOfMonth };
    }
    // 'frequent' filter will be applied after fetching (job count >= 5)

    // Determine sort order
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'name') {
      orderBy = { name: 'asc' };
    } else if (sort === 'recent') {
      orderBy = { createdAt: 'desc' };
    }
    // 'jobs' and 'revenue' sorts will be applied after aggregation

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: filter === 'frequent' || sort === 'jobs' || sort === 'revenue' ? 1000 : limit,
        include: {
          _count: {
            select: { jobs: true, invoices: true },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    // Get job counts, total spent, and ratings for all customers
    const customerIds = customers.map((c: CustomerWithCount) => c.id);

    // Get aggregated data for all customers in one query
    const [jobCounts, invoiceTotals, ratings] = await Promise.all([
      // Job counts per customer
      prisma.job.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds } },
        _count: { id: true },
      }),

      // Total spent (paid invoices) per customer
      prisma.invoice.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: customerIds },
          status: { in: ['paid', 'issued', 'sent'] },
        },
        _sum: { total: true },
      }),

      // Average rating per customer
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
    const jobCountMap = new Map<string, number>(
      jobCounts.map((j) => [j.customerId, j._count.id])
    );
    const totalSpentMap = new Map<string, number>(
      invoiceTotals.map((i) => [i.customerId, Number(i._sum.total) || 0])
    );
    const ratingMap = new Map<string, number | null>(
      ratings.map((r) => [r.customerId, r._avg.rating])
    );

    // Enrich customers with computed fields
    let enrichedCustomers: EnrichedCustomer[] = customers.map((customer: CustomerWithCount) => ({
      ...customer,
      jobCount: jobCountMap.get(customer.id) || 0,
      totalSpent: totalSpentMap.get(customer.id) || 0,
      averageRating: ratingMap.get(customer.id) || null,
    }));

    // Apply 'frequent' filter (job count >= 5)
    if (filter === 'frequent') {
      enrichedCustomers = enrichedCustomers.filter((c: EnrichedCustomer) => c.jobCount >= 5);
    }

    // Apply sorting by jobs or revenue
    if (sort === 'jobs') {
      enrichedCustomers.sort((a: EnrichedCustomer, b: EnrichedCustomer) => b.jobCount - a.jobCount);
    } else if (sort === 'revenue') {
      enrichedCustomers.sort((a: EnrichedCustomer, b: EnrichedCustomer) => b.totalSpent - a.totalSpent);
    }

    // Apply pagination after filtering/sorting if needed
    if (filter === 'frequent' || sort === 'jobs' || sort === 'revenue') {
      enrichedCustomers = enrichedCustomers.slice((page - 1) * limit, page * limit);
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
