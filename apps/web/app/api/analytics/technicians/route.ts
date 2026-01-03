/**
 * Technicians Analytics API Route
 * Self-contained implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

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

    // Use read replica for analytics queries (Phase 5A.3)
    const db = getDb({ analytics: true });
    const organizationId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'month';
    const dateRange = getDateRangeFromPreset(range);

    // Fetch technicians
    const technicians = await db.user.findMany({
      where: {
        organizationId,
        role: 'TECHNICIAN',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Fetch jobs for the period
    const jobs = await db.job.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        id: true,
        status: true,
        technicianId: true,
      },
    });

    const activeTechnicians = technicians.length;
    const totalJobs = jobs.length;
    // const completedJobs = jobs.filter((j: typeof jobs[number]) => j.status === 'COMPLETED').length;
    const avgJobsPerTech = activeTechnicians > 0 ? totalJobs / activeTechnicians : 0;

    // Calculate per-technician stats
    const technicianPerformance = technicians.map((tech: typeof technicians[number]) => {
      const techJobs = jobs.filter((j: typeof jobs[number]) => j.technicianId === tech.id);
      const techCompleted = techJobs.filter((j: typeof techJobs[number]) => j.status === 'COMPLETED').length;

      return {
        id: tech.id,
        name: tech.name || tech.email,
        totalJobs: techJobs.length,
        completedJobs: techCompleted,
        completionRate: techJobs.length > 0 ? (techCompleted / techJobs.length) * 100 : 0,
        revenue: 0,
        avgRating: 0,
        reviewCount: 0,
        avgDuration: 0,
      };
    });

    type TechPerformance = typeof technicianPerformance[number];
    const topTechnicians = [...technicianPerformance]
      .sort((a: TechPerformance, b: TechPerformance) => b.completedJobs - a.completedJobs)
      .slice(0, 10)
      .map((tech: TechPerformance) => ({
        id: tech.id,
        name: tech.name,
        value: tech.completedJobs,
        secondaryValue: tech.avgRating,
      }));

    return NextResponse.json({
      kpis: {
        activeTechnicians: { value: activeTechnicians, change: 0 },
        totalJobs: { value: totalJobs, change: 0 },
        avgJobsPerTech: { value: Math.round(avgJobsPerTech * 10) / 10, change: 0 },
        avgRating: { value: 0, change: 0 },
        avgRevenue: { value: 0, change: 0 },
        utilization: { value: 0, change: 0 },
      },
      topTechnicians,
      technicianPerformance: technicianPerformance.sort((a: TechPerformance, b: TechPerformance) => b.completedJobs - a.completedJobs),
      performanceTrend: [],
      workloadDistribution: [],
      ratingDistribution: [],
    });
  } catch (error) {
    console.error('Technicians analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch technicians analytics' },
      { status: 500 }
    );
  }
}
