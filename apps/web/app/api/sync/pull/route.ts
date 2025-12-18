import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

/**
 * Sync Pull API
 * =============
 *
 * GET /api/sync/pull?since={timestamp}
 * Returns jobs, customers, and priceBook items for mobile sync.
 */

async function getMobileSession(request: NextRequest): Promise<TokenPayload | null> {
  // First try Authorization header (mobile apps)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (payload) return payload;
  }

  // Fall back to cookie (web)
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('auth-token')?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getMobileSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Get 'since' timestamp from query params
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');
    const since = sinceParam ? new Date(parseInt(sinceParam, 10)) : new Date(0);

    // Fetch jobs updated since last sync
    const jobs = await prisma.job.findMany({
      where: {
        organizationId: session.organizationId,
        updatedAt: { gt: since },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        technician: {
          select: {
            id: true,
            name: true,
          },
        },
        materials: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });

    // Fetch customers updated since last sync
    const customers = await prisma.customer.findMany({
      where: {
        organizationId: session.organizationId,
        updatedAt: { gt: since },
      },
      take: 500, // Limit for performance
    });

    // Fetch price book items (products) updated since last sync
    const priceBook = await prisma.product.findMany({
      where: {
        organizationId: session.organizationId,
        updatedAt: { gt: since },
      },
    });

    // Format jobs for mobile
    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      customerId: job.customerId,
      organizationId: job.organizationId,
      assignedToId: job.technicianId,
      serviceType: job.serviceType,
      status: job.status,
      priority: job.urgency,
      scheduledStart: job.scheduledDate?.toISOString(),
      scheduledEnd: job.scheduledDate?.toISOString(), // Use same date, mobile handles time slots
      actualStart: null,
      actualEnd: job.completedAt?.toISOString(),
      address: job.customer?.address || '',
      latitude: null,
      longitude: null,
      notes: job.description,
      internalNotes: job.internalNotes,
      completionNotes: job.resolution,
      materialsUsed: job.materials ? JSON.stringify(job.materials) : null,
      signatureUrl: null,
      subtotal: job.estimatedCost,
      tax: 0,
      total: job.estimatedCost,
      customer: job.customer,
      technician: job.technician,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    }));

    // Format customers for mobile
    const formattedCustomers = customers.map((customer) => ({
      id: customer.id,
      organizationId: customer.organizationId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      dni: customer.taxId,
      cuit: customer.taxId,
      ivaCondition: 'CONSUMIDOR_FINAL',
      address: customer.address,
      city: customer.city,
      province: customer.state,
      notes: customer.notes,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    }));

    // Format price book for mobile
    const formattedPriceBook = priceBook.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      name: item.name,
      category: item.category,
      description: item.description,
      unitPrice: item.unitCost,
      unit: item.unit,
      taxRate: 0.21, // Default IVA
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        jobs: formattedJobs,
        customers: formattedCustomers,
        priceBook: formattedPriceBook,
        serverTime: Date.now(),
      },
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Error pulling sync data' } },
      { status: 500 }
    );
  }
}
