/**
 * Report History by ID API Route
 * ===============================
 *
 * Phase 10: Analytics & Reporting
 * Get, download, or delete a specific report from history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../lib/auth';
import { prisma } from '@repo/database';

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/reports/history/[id]
// Returns a specific report from history
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

    const report = await prisma.reportHistory.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        generatedBy: {
          select: { name: true, email: true },
        },
        report: {
          select: { id: true, name: true },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      report: {
        id: report.id,
        name: report.name,
        reportType: report.reportType,
        format: report.format,
        status: report.status,
        parameters: report.parameters,
        fileUrl: report.fileUrl,
        fileSize: report.fileSize,
        generationTimeMs: report.generationTimeMs,
        errorMessage: report.errorMessage,
        downloadUrl: report.downloadUrl,
        generatedAt: report.generatedAt.toISOString(),
        generatedBy: report.generatedBy?.name || report.generatedBy?.email || 'System',
        linkedReport: report.report ? {
          id: report.report.id,
          name: report.report.name,
        } : null,
      },
    });
  } catch (error) {
    console.error('Get report history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/analytics/reports/history/[id]
// Delete a specific report from history
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

    // Verify the report exists and belongs to the organization
    const existing = await prisma.reportHistory.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Delete the report from history
    await prisma.reportHistory.delete({
      where: { id },
    });

    // TODO: If fileUrl exists, also delete the file from storage

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    console.error('Delete report history error:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}
