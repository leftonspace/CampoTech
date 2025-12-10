/**
 * Scheduled Report by ID API Route
 * =================================
 *
 * Phase 10: Analytics & Reporting
 * Manage individual scheduled reports (GET, PUT, DELETE).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import { prisma } from '@repo/database';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/reports/scheduled/[id]
// Returns a specific scheduled report
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const { id } = await params;

    const scheduledReport = await prisma.scheduledReport.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        report: {
          select: { id: true, name: true },
        },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            completedAt: true,
            error: true,
          },
        },
      },
    });

    if (!scheduledReport) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      schedule: {
        id: scheduledReport.id,
        name: scheduledReport.name,
        reportId: scheduledReport.reportId,
        reportName: scheduledReport.report?.name || 'Custom Report',
        frequency: scheduledReport.frequency,
        dayOfWeek: scheduledReport.dayOfWeek,
        dayOfMonth: scheduledReport.dayOfMonth,
        time: scheduledReport.time,
        format: scheduledReport.format,
        recipients: scheduledReport.recipients,
        enabled: scheduledReport.enabled,
        status: scheduledReport.status,
        lastRun: scheduledReport.lastRunAt?.toISOString(),
        nextRun: calculateNextRun(scheduledReport),
        recentExecutions: scheduledReport.executions,
        createdAt: scheduledReport.createdAt.toISOString(),
        updatedAt: scheduledReport.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get scheduled report error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled report' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/analytics/reports/scheduled/[id]
// Update a scheduled report
// ═══════════════════════════════════════════════════════════════════════════════

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const { id } = await params;
    const body = await req.json();

    // Verify the scheduled report exists and belongs to the organization
    const existing = await prisma.scheduledReport.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    // Extract updateable fields
    const {
      name,
      reportId,
      frequency,
      dayOfWeek,
      dayOfMonth,
      time,
      format,
      recipients,
      enabled,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (reportId !== undefined) updateData.reportId = reportId;
    if (frequency !== undefined) {
      updateData.frequency = frequency;
      // Reset day fields based on frequency
      if (frequency === 'daily') {
        updateData.dayOfWeek = null;
        updateData.dayOfMonth = null;
      } else if (frequency === 'weekly') {
        updateData.dayOfWeek = dayOfWeek ?? existing.dayOfWeek ?? 1;
        updateData.dayOfMonth = null;
      } else if (frequency === 'monthly') {
        updateData.dayOfWeek = null;
        updateData.dayOfMonth = dayOfMonth ?? existing.dayOfMonth ?? 1;
      }
    }
    if (dayOfWeek !== undefined && frequency === 'weekly') {
      updateData.dayOfWeek = dayOfWeek;
    }
    if (dayOfMonth !== undefined && frequency === 'monthly') {
      updateData.dayOfMonth = dayOfMonth;
    }
    if (time !== undefined) updateData.time = time;
    if (format !== undefined) updateData.format = format;
    if (recipients !== undefined) updateData.recipients = recipients;
    if (enabled !== undefined) {
      updateData.enabled = enabled;
      updateData.status = enabled ? 'active' : 'paused';
    }

    // Update the scheduled report
    const updatedReport = await prisma.scheduledReport.update({
      where: { id },
      data: updateData,
      include: {
        report: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      schedule: {
        id: updatedReport.id,
        name: updatedReport.name,
        reportId: updatedReport.reportId,
        reportName: updatedReport.report?.name || 'Custom Report',
        frequency: updatedReport.frequency,
        dayOfWeek: updatedReport.dayOfWeek,
        dayOfMonth: updatedReport.dayOfMonth,
        time: updatedReport.time,
        format: updatedReport.format,
        recipients: updatedReport.recipients,
        enabled: updatedReport.enabled,
        status: updatedReport.status,
        lastRun: updatedReport.lastRunAt?.toISOString(),
        nextRun: calculateNextRun(updatedReport),
        createdAt: updatedReport.createdAt.toISOString(),
        updatedAt: updatedReport.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update scheduled report error:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled report' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/analytics/reports/scheduled/[id]
// Delete a scheduled report
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const { id } = await params;

    // Verify the scheduled report exists and belongs to the organization
    const existing = await prisma.scheduledReport.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    // Delete the scheduled report (cascades to executions)
    await prisma.scheduledReport.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Scheduled report deleted successfully',
    });
  } catch (error) {
    console.error('Delete scheduled report error:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled report' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateNextRun(schedule: {
  frequency: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  time: string;
  enabled: boolean;
}): string | null {
  if (!schedule.enabled) return null;

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
      // Handle months with fewer days
      while (next.getDate() !== targetDate) {
        next.setDate(0); // Go to last day of previous month
      }
      break;
  }

  return next.toISOString();
}
