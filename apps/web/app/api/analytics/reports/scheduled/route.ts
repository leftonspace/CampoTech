/**
 * Scheduled Reports API Route
 * ===========================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Manage scheduled report generation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { prisma } from '@repo/database';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/reports/scheduled
// Returns all scheduled reports for the organization
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

    // Fetch scheduled reports from database
    const scheduledReports = await prisma.scheduledReport.findMany({
      where: { organizationId },
      include: {
        report: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []);

    // Calculate next run time for each schedule
    const schedules = scheduledReports.map((schedule: {
      id: string;
      name: string;
      report: { id: string; name: string } | null;
      frequency: string;
      dayOfWeek: number | null;
      dayOfMonth: number | null;
      time: string;
      format: string;
      recipients: string[] | string;
      enabled: boolean;
      lastRunAt: Date | null;
      status: string;
      createdAt: Date;
    }) => ({
      id: schedule.id,
      name: schedule.name,
      reportId: schedule.report?.id || '',
      reportName: schedule.report?.name || 'Unknown',
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
      time: schedule.time,
      format: schedule.format,
      recipients: Array.isArray(schedule.recipients) ? schedule.recipients : [],
      enabled: schedule.enabled,
      lastRun: schedule.lastRunAt?.toISOString(),
      nextRun: calculateNextRun(schedule),
      status: schedule.enabled ? (schedule.status === 'error' ? 'error' : 'active') : 'paused',
      createdAt: schedule.createdAt.toISOString(),
    }));

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Scheduled reports fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled reports' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/analytics/reports/scheduled
// Create a new scheduled report
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const body = await req.json();
    const {
      name,
      reportId,
      frequency,
      dayOfWeek,
      dayOfMonth,
      time,
      format,
      recipients,
    } = body;

    // Validate required fields
    if (!name || !reportId || !frequency || !time || !format || !recipients?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create scheduled report
    const scheduledReport = await prisma.scheduledReport.create({
      data: {
        organizationId,
        name,
        reportId,
        frequency,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
        time,
        format,
        recipients,
        enabled: true,
        status: 'active',
        createdById: session.user.id,
      },
      include: {
        report: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      schedule: {
        id: scheduledReport.id,
        name: scheduledReport.name,
        reportId: scheduledReport.reportId,
        reportName: scheduledReport.report?.name || 'Unknown',
        frequency: scheduledReport.frequency,
        dayOfWeek: scheduledReport.dayOfWeek,
        dayOfMonth: scheduledReport.dayOfMonth,
        time: scheduledReport.time,
        format: scheduledReport.format,
        recipients: scheduledReport.recipients,
        enabled: scheduledReport.enabled,
        nextRun: calculateNextRun(scheduledReport),
        status: 'active',
        createdAt: scheduledReport.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create scheduled report error:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled report' },
      { status: 500 }
    );
  }
}

// Helper function to calculate next run time
function calculateNextRun(schedule: {
  frequency: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  time: string;
}): string {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);

  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  switch (schedule.frequency) {
    case 'daily':
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case 'weekly':
      const targetDay = schedule.dayOfWeek ?? 1;
      const currentDay = next.getDay();
      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) {
        daysUntilTarget += 7;
      }
      next.setDate(next.getDate() + daysUntilTarget);
      break;

    case 'monthly':
      const targetDate = schedule.dayOfMonth ?? 1;
      next.setDate(targetDate);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
  }

  return next.toISOString();
}
