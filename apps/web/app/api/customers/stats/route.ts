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

    const organizationId = session.organizationId;

    // Get the start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel
    const [
      totalCount,
      newThisMonth,
      averageRatingResult,
    ] = await Promise.all([
      // Total customers
      prisma.customer.count({
        where: { organizationId },
      }),

      // New customers this month
      prisma.customer.count({
        where: {
          organizationId,
          createdAt: { gte: startOfMonth },
        },
      }),

      // Average rating from reviews
      prisma.review.aggregate({
        where: {
          customer: { organizationId },
          rating: { not: null },
        },
        _avg: { rating: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalCount,
        newThisMonth,
        vipCount: 0, // VIP feature not yet enabled in database
        averageRating: averageRatingResult._avg.rating || 0,
      },
    });
  } catch (error) {
    console.error('Customer stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching customer stats' },
      { status: 500 }
    );
  }
}
