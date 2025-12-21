import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Helper to safely run queries that might fail due to missing tables
async function safeQuery<T>(query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch (error) {
    // Return fallback for table/column not found errors
    console.warn('Dashboard query failed (table may not exist):', error);
    return fallback;
  }
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Start of current month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    // Start of last month
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Start of current week (Monday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    // Start of last week
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);

    const [
      todayJobs,
      yesterdayJobs,
      pendingJobs,
      completedToday,
      pendingInvoices,
      unpaidInvoices,
      todayRevenue,
      lastWeekRevenue,
      activeCustomers,
      lastMonthCustomers,
      averageRating,
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
      // Jobs scheduled for yesterday (for comparison)
      prisma.job.count({
        where: {
          organizationId: session.organizationId,
          scheduledDate: {
            gte: yesterday,
            lt: today,
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
      // Pending invoices count (wrapped in safeQuery for missing table)
      safeQuery(
        prisma.invoice.count({
          where: {
            organizationId: session.organizationId,
            status: { in: ['PENDING', 'SENT'] },
          },
        }),
        0
      ),
      // Unpaid amount
      safeQuery(
        prisma.invoice.aggregate({
          where: {
            organizationId: session.organizationId,
            status: { in: ['PENDING', 'SENT', 'OVERDUE'] },
          },
          _sum: { total: true },
        }),
        { _sum: { total: null } }
      ),
      // Today's revenue (paid invoices)
      safeQuery(
        prisma.invoice.aggregate({
          where: {
            organizationId: session.organizationId,
            status: 'PAID',
            paidAt: {
              gte: today,
              lt: tomorrow,
            },
          },
          _sum: { total: true },
        }),
        { _sum: { total: null } }
      ),
      // Last week's revenue (for comparison)
      safeQuery(
        prisma.invoice.aggregate({
          where: {
            organizationId: session.organizationId,
            status: 'PAID',
            paidAt: {
              gte: startOfLastWeek,
              lte: endOfLastWeek,
            },
          },
          _sum: { total: true },
        }),
        { _sum: { total: null } }
      ),
      // Active customers (with at least one job)
      prisma.customer.count({
        where: {
          organizationId: session.organizationId,
        },
      }),
      // Customers created last month (for comparison)
      prisma.customer.count({
        where: {
          organizationId: session.organizationId,
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
      // Average rating from reviews
      safeQuery(
        prisma.review.aggregate({
          where: {
            organizationId: session.organizationId,
          },
          _avg: { rating: true },
          _count: { rating: true },
        }),
        { _avg: { rating: null }, _count: { rating: 0 } }
      ),
    ]);

    // Calculate new customers this month
    const newCustomersThisMonth = await prisma.customer.count({
      where: {
        organizationId: session.organizationId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    // Calculate jobs difference vs yesterday
    const jobsDiff = todayJobs - yesterdayJobs;
    const jobsTrend = jobsDiff >= 0 ? `+${jobsDiff} vs ayer` : `${jobsDiff} vs ayer`;

    // Calculate customer trend
    const customerTrend = newCustomersThisMonth > 0
      ? `+${newCustomersThisMonth} este mes`
      : null;

    // Calculate revenue
    const todayRevenueAmount = todayRevenue._sum.total ? Number(todayRevenue._sum.total) : 0;
    const lastWeekRevenueAmount = lastWeekRevenue._sum.total ? Number(lastWeekRevenue._sum.total) : 0;

    // Calculate week-over-week revenue change
    let revenueTrend: string | null = null;
    if (lastWeekRevenueAmount > 0) {
      const weeklyRevenue = todayRevenueAmount * 7; // Approximate weekly projection
      const change = ((weeklyRevenue - lastWeekRevenueAmount) / lastWeekRevenueAmount) * 100;
      if (change >= 0) {
        revenueTrend = `+${Math.round(change)}% vs semana pasada`;
      } else {
        revenueTrend = `${Math.round(change)}% vs semana pasada`;
      }
    }

    // Format rating
    const rating = averageRating._avg.rating ? Number(averageRating._avg.rating).toFixed(1) : null;
    const ratingCount = averageRating._count.rating || 0;

    return NextResponse.json({
      success: true,
      data: {
        // Jobs
        todayJobs,
        yesterdayJobs,
        jobsTrend: todayJobs > 0 || yesterdayJobs > 0 ? jobsTrend : null,
        pendingJobs,
        completedToday,

        // Customers
        activeCustomers,
        customerTrend,

        // Invoices & Revenue
        pendingInvoices,
        unpaidAmount: unpaidInvoices._sum.total ? Number(unpaidInvoices._sum.total) : 0,
        todayRevenue: todayRevenueAmount,
        revenueTrend,

        // Rating
        averageRating: rating,
        ratingCount,
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
