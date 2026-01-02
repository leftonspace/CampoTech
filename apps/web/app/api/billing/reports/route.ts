/**
 * Billing Reports API Route
 * Self-contained implementation (placeholder)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Get basic billing data
    const [invoices, locations] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          organizationId: session.organizationId,
          ...(startDate || endDate ? { createdAt: dateFilter } : {}),
        },
        select: {
          id: true,
          total: true,
          status: true,
          locationId: true,
        },
      }),
      prisma.location.findMany({
        where: { organizationId: session.organizationId },
        select: { id: true, name: true },
      }),
    ]);

    // Aggregate by location
    const locationTotals = locations.map((loc: typeof locations[number]) => {
      const locInvoices = invoices.filter((inv: typeof invoices[number]) => inv.locationId === loc.id);
      const total = locInvoices.reduce((sum: number, inv: typeof locInvoices[number]) => sum + (inv.total ? Number(inv.total) : 0), 0);
      const paid = locInvoices
        .filter((inv: typeof locInvoices[number]) => inv.status === 'PAID')
        .reduce((sum: number, inv: typeof locInvoices[number]) => sum + (inv.total ? Number(inv.total) : 0), 0);

      return {
        locationId: loc.id,
        locationName: loc.name,
        totalRevenue: total,
        collectedRevenue: paid,
        pendingRevenue: total - paid,
        invoiceCount: locInvoices.length,
      };
    });

    const totalRevenue = invoices.reduce((sum: number, inv: typeof invoices[number]) => sum + (inv.total ? Number(inv.total) : 0), 0);
    const paidRevenue = invoices
      .filter((inv: typeof invoices[number]) => inv.status === 'PAID')
      .reduce((sum: number, inv: typeof invoices[number]) => sum + (inv.total ? Number(inv.total) : 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          collectedRevenue: paidRevenue,
          pendingRevenue: totalRevenue - paidRevenue,
          totalInvoices: invoices.length,
        },
        byLocation: locationTotals,
        interLocationCharges: [],
      },
    });
  } catch (error) {
    console.error('Get billing report error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching billing report' },
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
    const { locationId } = body;

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'Location ID required' },
        { status: 400 }
      );
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: session.organizationId,
        locationId,
      },
      select: {
        id: true,
        total: true,
        status: true,
      },
    });

    const total = invoices.reduce((sum: number, inv: typeof invoices[number]) => sum + (inv.total ? Number(inv.total) : 0), 0);
    const paid = invoices
      .filter((inv: typeof invoices[number]) => inv.status === 'PAID')
      .reduce((sum: number, inv: typeof invoices[number]) => sum + (inv.total ? Number(inv.total) : 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        locationId,
        totalRevenue: total,
        collectedRevenue: paid,
        pendingRevenue: total - paid,
        invoiceCount: invoices.length,
      },
    });
  } catch (error) {
    console.error('Get location summary error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching location billing summary' },
      { status: 500 }
    );
  }
}
