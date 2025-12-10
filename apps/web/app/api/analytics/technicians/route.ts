/**
 * Technicians Analytics API Route
 * ================================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Technician performance metrics for analytics dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '@repo/database';
import { getDateRangeFromPreset } from '../../../../../../../src/analytics/reports/templates/report-templates';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/technicians
// Returns technician performance analytics data
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'month';

    // Get date range
    const dateRange = getDateRangeFromPreset(range as 'today' | 'week' | 'month' | 'quarter' | 'year');
    const previousRange = getPreviousRange(dateRange.start, dateRange.end);

    // Fetch technicians and their jobs
    const [technicians, currentJobs, previousJobs, reviews] = await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId,
          role: 'TECHNICIAN',
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          isActive: true,
        },
      }).catch(() => []),
      prisma.job.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
          technicianId: { not: null },
        },
        include: {
          technician: {
            select: { id: true },
          },
          invoice: {
            select: { total: true },
          },
        },
      }).catch(() => []),
      prisma.job.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: previousRange.start,
            lte: previousRange.end,
          },
          technicianId: { not: null },
        },
      }).catch(() => []),
      prisma.review.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        select: {
          technicianId: true,
          rating: true,
        },
      }).catch(() => []),
    ]);

    // Calculate KPIs
    const activeTechnicians = technicians.filter((t) => t.isActive).length;
    const totalTechnicians = technicians.length;

    const completedJobs = currentJobs.filter((j) => j.status === 'COMPLETED').length;
    const previousCompleted = previousJobs.filter((j) => j.status === 'COMPLETED').length;
    const completedChange = previousCompleted > 0 ? ((completedJobs - previousCompleted) / previousCompleted) * 100 : 0;

    const avgJobsPerTech = activeTechnicians > 0 ? currentJobs.length / activeTechnicians : 0;
    const previousAvgJobs = activeTechnicians > 0 ? previousJobs.length / activeTechnicians : 0;
    const avgJobsChange = previousAvgJobs > 0 ? ((avgJobsPerTech - previousAvgJobs) / previousAvgJobs) * 100 : 0;

    const totalRevenue = currentJobs.reduce((sum, j) => sum + (j.invoice?.total || 0), 0);
    const avgRevenuePerTech = activeTechnicians > 0 ? totalRevenue / activeTechnicians : 0;

    const allRatings = reviews.filter((r) => r.rating !== null).map((r) => r.rating as number);
    const avgRating = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0;

    // Utilization rate (jobs per working day)
    const workingDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const utilization = activeTechnicians > 0 && workingDays > 0 ? (currentJobs.length / (activeTechnicians * workingDays)) * 100 : 0;

    // Calculate individual technician performance
    const technicianPerformance = technicians.map((tech) => {
      const techJobs = currentJobs.filter((j) => j.technician?.id === tech.id);
      const techCompleted = techJobs.filter((j) => j.status === 'COMPLETED').length;
      const techRevenue = techJobs.reduce((sum, j) => sum + (j.invoice?.total || 0), 0);
      const techReviews = reviews.filter((r) => r.technicianId === tech.id);
      const techRatings = techReviews.filter((r) => r.rating !== null).map((r) => r.rating as number);
      const techAvgRating = techRatings.length > 0 ? techRatings.reduce((a, b) => a + b, 0) / techRatings.length : 0;

      // Calculate avg job duration
      const completedWithTime = techJobs.filter((j) =>
        j.status === 'COMPLETED' && j.startTime && j.endTime
      );
      const totalDuration = completedWithTime.reduce((sum, j) => {
        if (!j.startTime || !j.endTime) return sum;
        return sum + (new Date(j.endTime).getTime() - new Date(j.startTime).getTime());
      }, 0);
      const avgDurationHours = completedWithTime.length > 0
        ? (totalDuration / completedWithTime.length) / (1000 * 60 * 60)
        : 0;

      return {
        id: tech.id,
        name: `${tech.firstName || ''} ${tech.lastName || ''}`.trim() || tech.email,
        avatar: tech.avatar,
        isActive: tech.isActive,
        totalJobs: techJobs.length,
        completedJobs: techCompleted,
        completionRate: techJobs.length > 0 ? (techCompleted / techJobs.length) * 100 : 0,
        revenue: techRevenue,
        avgRating: Math.round(techAvgRating * 10) / 10,
        reviewCount: techReviews.length,
        avgDuration: Math.round(avgDurationHours * 10) / 10,
      };
    });

    // Sort by completed jobs for leaderboard
    const topTechnicians = [...technicianPerformance]
      .sort((a, b) => b.completedJobs - a.completedJobs)
      .slice(0, 10)
      .map((tech) => ({
        id: tech.id,
        name: tech.name,
        avatar: tech.avatar,
        value: tech.completedJobs,
        secondaryValue: tech.avgRating,
      }));

    // Performance trend
    const performanceTrend = aggregatePerformanceByPeriod(currentJobs, dateRange.start, dateRange.end);

    // Workload distribution
    const workloadDistribution = technicianPerformance.map((tech) => ({
      label: tech.name,
      value: tech.totalJobs,
    }));

    // Rating distribution
    const ratingDistribution = [
      { label: '5 estrellas', value: reviews.filter((r) => r.rating === 5).length, color: '#22c55e' },
      { label: '4 estrellas', value: reviews.filter((r) => r.rating === 4).length, color: '#84cc16' },
      { label: '3 estrellas', value: reviews.filter((r) => r.rating === 3).length, color: '#f59e0b' },
      { label: '2 estrellas', value: reviews.filter((r) => r.rating === 2).length, color: '#f97316' },
      { label: '1 estrella', value: reviews.filter((r) => r.rating === 1).length, color: '#ef4444' },
    ];

    return NextResponse.json({
      kpis: {
        activeTechnicians: { value: activeTechnicians, change: 0 },
        totalJobs: { value: currentJobs.length, change: Math.round(completedChange * 10) / 10 },
        avgJobsPerTech: { value: Math.round(avgJobsPerTech * 10) / 10, change: Math.round(avgJobsChange * 10) / 10 },
        avgRating: { value: Math.round(avgRating * 10) / 10, change: 0 },
        avgRevenue: { value: Math.round(avgRevenuePerTech), change: 0 },
        utilization: { value: Math.round(utilization * 10) / 10, change: 0 },
      },
      topTechnicians,
      technicianPerformance: technicianPerformance.sort((a, b) => b.completedJobs - a.completedJobs),
      performanceTrend,
      workloadDistribution,
      ratingDistribution,
    });
  } catch (error) {
    console.error('Technicians analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch technicians analytics' },
      { status: 500 }
    );
  }
}

// Helper functions
function getPreviousRange(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime() - 1),
  };
}

function aggregatePerformanceByPeriod(
  jobs: { createdAt: Date; status: string }[],
  start: Date,
  end: Date
): { label: string; jobs: number; completed: number }[] {
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const groupByWeek = days > 31;

  const groups: Record<string, { jobs: number; completed: number }> = {};
  jobs.forEach((job) => {
    const date = new Date(job.createdAt);
    const key = groupByWeek
      ? `Sem ${getWeekNumber(date)}`
      : date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

    if (!groups[key]) {
      groups[key] = { jobs: 0, completed: 0 };
    }
    groups[key].jobs += 1;
    if (job.status === 'COMPLETED') {
      groups[key].completed += 1;
    }
  });

  return Object.entries(groups).map(([label, data]) => ({
    label,
    jobs: data.jobs,
    completed: data.completed,
  }));
}

function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7);
}
