/**
 * Report History API Route
 * ========================
 *
 * Phase 10.4: Analytics Dashboard UI
 * View and download previously generated reports.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { prisma } from '@repo/database';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/reports/history
// Returns report generation history for the organization
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
    const search = searchParams.get('search') || '';
    const format = searchParams.get('format');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build query filters
    const where: Record<string, unknown> = { organizationId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { reportType: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (format && format !== 'all') {
      where.format = format;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (from || to) {
      where.generatedAt = {};
      if (from) {
        (where.generatedAt as Record<string, Date>).gte = new Date(from);
      }
      if (to) {
        (where.generatedAt as Record<string, Date>).lte = new Date(to);
      }
    }

    // Fetch reports with pagination
    const [reports, total] = await Promise.all([
      prisma.reportHistory.findMany({
        where,
        include: {
          generatedBy: {
            select: { name: true, email: true },
          },
        },
        orderBy: { generatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }).catch(() => []),
      prisma.reportHistory.count({ where }).catch(() => 0),
    ]);

    // Format response
    const formattedReports = reports.map((report: {
      id: string;
      name: string;
      reportType: string;
      format: string;
      status: string;
      generatedAt: Date;
      generatedBy: { name: string | null; email: string } | null;
      fileSize: number | null;
      downloadUrl: string | null;
      parameters: unknown;
      errorMessage: string | null;
    }) => ({
      id: report.id,
      name: report.name,
      reportType: report.reportType,
      format: report.format,
      status: report.status,
      generatedAt: report.generatedAt.toISOString(),
      generatedBy: report.generatedBy?.name || report.generatedBy?.email || 'System',
      fileSize: report.fileSize,
      downloadUrl: report.downloadUrl,
      parameters: report.parameters,
      errorMessage: report.errorMessage,
    }));

    return NextResponse.json({
      reports: formattedReports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Report history fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report history' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/analytics/reports/history
// Delete multiple reports from history
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest) {
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
    const { reportIds } = body;

    if (!reportIds || !Array.isArray(reportIds)) {
      return NextResponse.json(
        { error: 'Report IDs required' },
        { status: 400 }
      );
    }

    // Delete reports (only for the organization)
    await prisma.reportHistory.deleteMany({
      where: {
        id: { in: reportIds },
        organizationId,
      },
    });

    return NextResponse.json({ success: true, deleted: reportIds.length });
  } catch (error) {
    console.error('Report history delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete reports' },
      { status: 500 }
    );
  }
}
