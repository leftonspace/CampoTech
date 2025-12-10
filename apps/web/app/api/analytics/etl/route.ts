/**
 * ETL Pipeline API
 * ================
 *
 * Phase 10.1: Analytics Data Infrastructure
 * API endpoints for managing ETL pipeline operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  runFullETL,
  runIncrementalETL,
  getETLStatus,
  getLastAnalyticsUpdate,
  getFactSummary,
  cleanupOldData,
} from '@/src/analytics';

/**
 * GET /api/analytics/etl
 * Get ETL status and last update time
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    // Get ETL status
    const status = await getETLStatus(organizationId);
    const lastUpdate = await getLastAnalyticsUpdate(organizationId);

    // Get fact summaries
    const [jobsSummary, invoicesSummary, paymentsSummary] = await Promise.all([
      getFactSummary(organizationId, 'jobs'),
      getFactSummary(organizationId, 'invoices'),
      getFactSummary(organizationId, 'payments'),
    ]);

    return NextResponse.json({
      status,
      lastUpdate,
      summaries: {
        jobs: jobsSummary,
        invoices: invoicesSummary,
        payments: paymentsSummary,
      },
    });
  } catch (error) {
    console.error('ETL status error:', error);
    return NextResponse.json(
      { error: 'Failed to get ETL status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/etl
 * Trigger ETL pipeline
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins and owners can trigger ETL
    if (!['ADMIN', 'OWNER'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = session.user.organizationId;
    const body = await request.json().catch(() => ({}));
    const { type = 'incremental' } = body;

    let result;
    if (type === 'full') {
      result = await runFullETL(organizationId);
    } else {
      result = await runIncrementalETL(organizationId);
    }

    return NextResponse.json({
      success: true,
      type,
      result,
    });
  } catch (error) {
    console.error('ETL execution error:', error);
    return NextResponse.json(
      { error: 'Failed to run ETL pipeline' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/analytics/etl
 * Clean up old analytics data
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can cleanup data
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = session.user.organizationId;
    const result = await cleanupOldData(organizationId);

    return NextResponse.json({
      success: true,
      deleted: result.deleted,
    });
  } catch (error) {
    console.error('ETL cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup analytics data' },
      { status: 500 }
    );
  }
}
