/**
 * Operations Analytics API Route
 * ==============================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Operations metrics, job tracking, and SLA data for analytics dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '@repo/database';
import { getDateRangeFromPreset } from '../../../../../../../src/analytics/reports/templates/report-templates';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/operations
// Returns operations analytics data
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

    // Fetch jobs data
    const [currentJobs, previousJobs] = await Promise.all([
      prisma.job.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        include: {
          technician: {
            select: { id: true, firstName: true, lastName: true },
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
        },
      }).catch(() => []),
    ]);

    // Calculate KPIs
    const totalJobs = currentJobs.length;
    const previousTotal = previousJobs.length;
    const totalJobsChange = previousTotal > 0 ? ((totalJobs - previousTotal) / previousTotal) * 100 : 0;

    const completedJobs = currentJobs.filter((j) => j.status === 'COMPLETED').length;
    const previousCompleted = previousJobs.filter((j) => j.status === 'COMPLETED').length;
    const completedChange = previousCompleted > 0 ? ((completedJobs - previousCompleted) / previousCompleted) * 100 : 0;

    const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
    const previousCompletionRate = previousTotal > 0 ? (previousCompleted / previousTotal) * 100 : 0;
    const completionRateChange = previousCompletionRate > 0 ? ((completionRate - previousCompletionRate) / previousCompletionRate) * 100 : 0;

    // Average duration calculation
    const completedWithDuration = currentJobs.filter((j) =>
      j.status === 'COMPLETED' && j.startTime && j.endTime
    );
    const totalDuration = completedWithDuration.reduce((sum, j) => {
      if (!j.startTime || !j.endTime) return sum;
      return sum + (new Date(j.endTime).getTime() - new Date(j.startTime).getTime());
    }, 0);
    const avgDurationMs = completedWithDuration.length > 0 ? totalDuration / completedWithDuration.length : 0;
    const avgDurationHours = avgDurationMs / (1000 * 60 * 60);

    // SLA compliance (jobs completed within estimated time)
    const slaCompliant = completedWithDuration.filter((j) => {
      if (!j.estimatedDuration || !j.startTime || !j.endTime) return false;
      const actualDuration = new Date(j.endTime).getTime() - new Date(j.startTime).getTime();
      return actualDuration <= j.estimatedDuration * 60 * 1000;
    }).length;
    const slaRate = completedWithDuration.length > 0 ? (slaCompliant / completedWithDuration.length) * 100 : 0;

    // Pending and in-progress jobs
    const pendingJobs = currentJobs.filter((j) => j.status === 'PENDING').length;
    const inProgressJobs = currentJobs.filter((j) => j.status === 'IN_PROGRESS').length;

    // Job trend by day
    const jobTrend = aggregateJobsByPeriod(currentJobs, dateRange.start, dateRange.end);

    // Jobs by status
    const jobsByStatus = aggregateJobsByStatus(currentJobs);

    // Jobs by service type
    const jobsByServiceType = aggregateJobsByServiceType(currentJobs);

    // Jobs by priority
    const jobsByPriority = aggregateJobsByPriority(currentJobs);

    // Activity heatmap (day/hour)
    const activityHeatmap = generateActivityHeatmap(currentJobs);

    // Top technicians
    const topTechnicians = aggregateByTechnician(currentJobs);

    return NextResponse.json({
      kpis: {
        totalJobs: { value: totalJobs, change: Math.round(totalJobsChange * 10) / 10 },
        completedJobs: { value: completedJobs, change: Math.round(completedChange * 10) / 10 },
        completionRate: { value: Math.round(completionRate * 10) / 10, change: Math.round(completionRateChange * 10) / 10 },
        avgDuration: { value: Math.round(avgDurationHours * 10) / 10, change: 0 },
        slaCompliance: { value: Math.round(slaRate * 10) / 10, change: 0 },
        pendingJobs: { value: pendingJobs, change: 0 },
      },
      jobTrend,
      jobsByStatus,
      jobsByServiceType,
      jobsByPriority,
      activityHeatmap,
      topTechnicians,
    });
  } catch (error) {
    console.error('Operations analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operations analytics' },
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

function aggregateJobsByPeriod(
  jobs: { createdAt: Date; status: string }[],
  start: Date,
  end: Date
): { label: string; completed: number; pending: number }[] {
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const groupByWeek = days > 31;

  const groups: Record<string, { completed: number; pending: number }> = {};
  jobs.forEach((job) => {
    const date = new Date(job.createdAt);
    const key = groupByWeek
      ? `Sem ${getWeekNumber(date)}`
      : date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

    if (!groups[key]) {
      groups[key] = { completed: 0, pending: 0 };
    }
    if (job.status === 'COMPLETED') {
      groups[key].completed += 1;
    } else {
      groups[key].pending += 1;
    }
  });

  return Object.entries(groups).map(([label, data]) => ({
    label,
    completed: data.completed,
    pending: data.pending,
  }));
}

function aggregateJobsByStatus(
  jobs: { status: string }[]
): { label: string; value: number; color: string }[] {
  const colors: Record<string, string> = {
    PENDING: '#f59e0b',
    SCHEDULED: '#3b82f6',
    IN_PROGRESS: '#8b5cf6',
    COMPLETED: '#22c55e',
    CANCELLED: '#ef4444',
  };

  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    SCHEDULED: 'Programado',
    IN_PROGRESS: 'En Progreso',
    COMPLETED: 'Completado',
    CANCELLED: 'Cancelado',
  };

  const groups: Record<string, number> = {};
  jobs.forEach((job) => {
    groups[job.status] = (groups[job.status] || 0) + 1;
  });

  return Object.entries(groups).map(([status, count]) => ({
    label: labels[status] || status,
    value: count,
    color: colors[status] || '#6b7280',
  }));
}

function aggregateJobsByServiceType(
  jobs: { serviceType?: string | null }[]
): { label: string; value: number; color: string }[] {
  const colors: Record<string, string> = {
    installation: '#3b82f6',
    repair: '#ef4444',
    maintenance: '#22c55e',
    inspection: '#f59e0b',
    consultation: '#8b5cf6',
  };

  const labels: Record<string, string> = {
    installation: 'Instalación',
    repair: 'Reparación',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    consultation: 'Consulta',
  };

  const groups: Record<string, number> = {};
  jobs.forEach((job) => {
    const type = job.serviceType || 'other';
    groups[type] = (groups[type] || 0) + 1;
  });

  return Object.entries(groups).map(([type, count]) => ({
    label: labels[type] || type,
    value: count,
    color: colors[type] || '#6b7280',
  }));
}

function aggregateJobsByPriority(
  jobs: { priority?: string | null }[]
): { label: string; value: number; color: string }[] {
  const colors: Record<string, string> = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#ef4444',
    urgent: '#dc2626',
  };

  const labels: Record<string, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente',
  };

  const groups: Record<string, number> = {};
  jobs.forEach((job) => {
    const priority = job.priority || 'medium';
    groups[priority] = (groups[priority] || 0) + 1;
  });

  return Object.entries(groups).map(([priority, count]) => ({
    label: labels[priority] || priority,
    value: count,
    color: colors[priority] || '#6b7280',
  }));
}

function generateActivityHeatmap(
  jobs: { createdAt: Date }[]
): { day: number; hour: number; value: number }[] {
  const heatmap: Record<string, number> = {};

  jobs.forEach((job) => {
    const date = new Date(job.createdAt);
    const day = date.getDay();
    const hour = date.getHours();
    const key = `${day}-${hour}`;
    heatmap[key] = (heatmap[key] || 0) + 1;
  });

  const result: { day: number; hour: number; value: number }[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      result.push({
        day,
        hour,
        value: heatmap[`${day}-${hour}`] || 0,
      });
    }
  }

  return result;
}

function aggregateByTechnician(
  jobs: { technician?: { id: string; firstName?: string | null; lastName?: string | null } | null; status: string }[]
): { id: string; name: string; value: number; secondaryValue: number }[] {
  const groups: Record<string, { name: string; total: number; completed: number }> = {};

  jobs.forEach((job) => {
    if (!job.technician) return;
    const id = job.technician.id;
    const name = `${job.technician.firstName || ''} ${job.technician.lastName || ''}`.trim() || 'Unknown';

    if (!groups[id]) {
      groups[id] = { name, total: 0, completed: 0 };
    }
    groups[id].total += 1;
    if (job.status === 'COMPLETED') {
      groups[id].completed += 1;
    }
  });

  return Object.entries(groups)
    .sort((a, b) => b[1].completed - a[1].completed)
    .slice(0, 10)
    .map(([id, data]) => ({
      id,
      name: data.name,
      value: data.completed,
      secondaryValue: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }));
}

function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7);
}
