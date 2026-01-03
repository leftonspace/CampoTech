/**
 * AFIP Queue API
 * ==============
 *
 * Manage AFIP invoice processing queue.
 *
 * GET /api/afip/queue - Get queue status and pending jobs
 * POST /api/afip/queue - Add invoice(s) to queue
 * DELETE /api/afip/queue/:jobId - Cancel a pending job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAFIPClient, getAFIPBatchProcessor } from '@/lib/integrations/afip';
import { prisma } from '@/lib/prisma';

interface PendingInvoice {
  id: string;
  number: string | null;
  status: string;
  total: number | null;
  createdAt: Date;
  retryAt: Date | null;
  retryCount: number | null;
  customer: { name: string } | null;
}

interface InvoiceCheck {
  id: string;
  status: string;
}

/**
 * GET - Get queue status
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 400 }
      );
    }

    const client = getAFIPClient();
    const batchProcessor = getAFIPBatchProcessor();

    // Get queue status
    const queueStatus = batchProcessor.getStatus();
    const pendingJobs = batchProcessor.getPendingJobs();

    // Get org-specific pending invoices from database
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['pending_cae', 'processing_cae'] },
      },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        createdAt: true,
        retryAt: true,
        retryCount: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }) as PendingInvoice[];

    // Check if org can proceed
    const canProceed = client.canProceed(orgId);

    return NextResponse.json({
      queue: queueStatus,
      canProceed,
      pendingInvoices: pendingInvoices.map((inv: PendingInvoice) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        total: inv.total,
        customerName: inv.customer?.name,
        createdAt: inv.createdAt,
        retryAt: inv.retryAt,
        retryCount: inv.retryCount || 0,
      })),
      inMemoryJobs: pendingJobs.filter((j) => j.orgId === orgId),
    });
  } catch (error) {
    console.error('[AFIP Queue API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    );
  }
}

/**
 * POST - Add invoice(s) to queue
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = session.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { invoiceIds, priority = 'normal', immediate = false } = body as {
      invoiceIds: string[];
      priority?: 'high' | 'normal' | 'low';
      immediate?: boolean;
    };

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: 'invoiceIds array is required' },
        { status: 400 }
      );
    }

    // Verify invoices belong to org
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        organizationId: orgId,
      },
      select: { id: true, status: true },
    }) as InvoiceCheck[];

    if (invoices.length !== invoiceIds.length) {
      return NextResponse.json(
        { error: 'Some invoices not found or not owned by organization' },
        { status: 400 }
      );
    }

    // Check if any are already processed
    const alreadyProcessed = invoices.filter((i: InvoiceCheck) =>
      ['cae_approved', 'processing_cae'].includes(i.status)
    );
    if (alreadyProcessed.length > 0) {
      return NextResponse.json(
        {
          error: 'Some invoices are already processed or processing',
          alreadyProcessed: alreadyProcessed.map((i: InvoiceCheck) => i.id),
        },
        { status: 400 }
      );
    }

    const client = getAFIPClient();

    // Check if we can proceed
    const canProceed = client.canProceed(orgId);
    if (!canProceed.allowed) {
      return NextResponse.json(
        {
          error: 'Cannot process invoices now',
          reason: canProceed.reason,
          waitTime: canProceed.waitTime,
        },
        { status: 429 }
      );
    }

    let results;
    if (immediate && invoiceIds.length === 1) {
      // Process single invoice immediately
      const result = await client.requestCAEImmediate(invoiceIds[0], orgId);
      results = {
        batchId: `immediate_${Date.now()}`,
        totalJobs: 1,
        successCount: result.success ? 1 : 0,
        failedCount: result.success ? 0 : 1,
        results: [result],
      };
    } else {
      // Queue for batch processing
      results = await client.requestCAEBatch(
        invoiceIds.map((id) => ({
          invoiceId: id,
          orgId,
          priority,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      queued: invoiceIds.length,
      ...results,
    });
  } catch (error) {
    console.error('[AFIP Queue API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to queue invoices',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cancel a pending job
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    const batchProcessor = getAFIPBatchProcessor();
    const cancelled = batchProcessor.cancel(jobId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Job not found or already processing' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} cancelled`,
    });
  } catch (error) {
    console.error('[AFIP Queue API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    );
  }
}
