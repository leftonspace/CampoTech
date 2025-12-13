/**
 * Operations Analytics API Route
 * Self-contained implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function getDateRangeFromPreset(range: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  let start: Date;

  switch (range) {
    case 'today':
      start = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'quarter':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'month';
    const dateRange = getDateRangeFromPreset(range);

    // Fetch jobs data
    const jobs = await prisma.job.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      include: {
        technician: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate KPIs
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((j: typeof jobs[number]) => j.status === 'COMPLETED').length;
    const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
    const cancelledJobs = jobs.filter((j: typeof jobs[number]) => j.status === 'CANCELLED').length;

    // Jobs by status
    const statusCounts: Record<string, number> = {};
    jobs.forEach((job: typeof jobs[number]) => {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    });

    const jobsByStatus = Object.entries(statusCounts).map(([status, count]: [string, number]) => ({
      label: status,
      value: count,
      color: getStatusColor(status),
    }));

    return NextResponse.json({
      kpis: {
        totalJobs: { value: totalJobs, change: 0 },
        completedJobs: { value: completedJobs, change: 0 },
        completionRate: { value: Math.round(completionRate * 10) / 10, change: 0 },
        avgDuration: { value: 0, change: 0 },
        slaCompliance: { value: 0, change: 0 },
        cancelledJobs: { value: cancelledJobs, change: 0 },
      },
      jobsTrend: [],
      jobsByStatus,
      jobsByService: [],
      jobsByUrgency: [],
      activityHeatmap: [],
      slaByUrgency: [],
    });
  } catch (error) {
    console.error('Operations analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operations analytics' },
      { status: 500 }
    );
  }
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#f59e0b',
    scheduled: '#3b82f6',
    en_camino: '#8b5cf6',
    working: '#6366f1',
    completed: '#22c55e',
    cancelled: '#ef4444',
  };
  return colors[status] || '#6b7280';
}
