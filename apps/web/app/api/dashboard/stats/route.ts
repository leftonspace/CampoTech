import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayJobs,
      pendingJobs,
      completedToday,
      pendingInvoices,
      unpaidInvoices,
    ] = await Promise.all([
      // Jobs scheduled for today
      prisma.job.count({
        where: {
          organizationId: session.organizationId,
          scheduledDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      // Pending jobs
      prisma.job.count({
        where: {
          organizationId: session.organizationId,
          status: { in: ['PENDING', 'ASSIGNED'] },
        },
      }),
      // Completed today
      prisma.job.count({
        where: {
          organizationId: session.organizationId,
          status: 'COMPLETED',
          completedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      // Pending invoices count
      prisma.invoice.count({
        where: {
          organizationId: session.organizationId,
          status: { in: ['PENDING', 'SENT'] },
        },
      }),
      // Unpaid amount
      prisma.invoice.aggregate({
        where: {
          organizationId: session.organizationId,
          status: { in: ['PENDING', 'SENT', 'OVERDUE'] },
        },
        _sum: { total: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        todayJobs,
        pendingJobs,
        completedToday,
        pendingInvoices,
        unpaidAmount: unpaidInvoices._sum.total || 0,
        monthlyRevenue: 0, // TODO: Calculate from paid invoices
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching dashboard stats' },
      { status: 500 }
    );
  }
}
