import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Dashboard Activity API
 * Returns recent activity for the dashboard
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get recent jobs activity
    const recentJobs = await prisma.job.findMany({
      where: {
        organizationId: session.organizationId,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        customer: {
          select: {
            name: true,
          },
        },
        assignedTo: {
          select: {
            name: true,
          },
        },
      },
    });

    // Get recent invoices
    const recentInvoices = await prisma.invoice.findMany({
      where: {
        organizationId: session.organizationId,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    // Format activity feed
    const activity = [
      ...recentJobs.map((job) => ({
        id: job.id,
        type: 'job' as const,
        description: `Trabajo ${job.status} - ${job.customer?.name || 'Sin cliente'}`,
        timestamp: job.updatedAt,
        metadata: {
          status: job.status,
          assignedTo: job.assignedTo?.name,
        },
      })),
      ...recentInvoices.map((invoice) => ({
        id: invoice.id,
        type: 'invoice' as const,
        description: `Factura ${invoice.invoiceNumber} - ${invoice.customer?.name || 'Sin cliente'}`,
        timestamp: invoice.createdAt,
        metadata: {
          status: invoice.status,
          amount: invoice.totalAmount,
        },
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
     .slice(0, 15);

    return NextResponse.json({
      success: true,
      data: {
        activity,
      },
    });
  } catch (error) {
    console.error('Dashboard activity error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching activity' },
      { status: 500 }
    );
  }
}
