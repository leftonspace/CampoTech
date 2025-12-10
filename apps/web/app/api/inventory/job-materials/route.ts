import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  addJobMaterial,
  getJobMaterials,
  updateJobMaterial,
  removeJobMaterial,
  useMaterial,
  returnMaterial,
  getJobMaterialSummary,
  getMaterialEstimates,
  generateMaterialUsageReport,
  getJobProfitabilityReport,
} from '@/src/modules/inventory';

/**
 * GET /api/inventory/job-materials
 * Get job materials, estimates, or reports
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'materials';
    const jobId = searchParams.get('jobId');

    // Get job materials
    if (view === 'materials' && jobId) {
      const materials = await getJobMaterials(session.organizationId, jobId);
      return NextResponse.json({ success: true, data: { materials } });
    }

    // Get job material summary
    if (view === 'summary' && jobId) {
      const summary = await getJobMaterialSummary(session.organizationId, jobId);
      return NextResponse.json({ success: true, data: summary });
    }

    // Generate job estimate
    if (view === 'estimate') {
      const serviceType = searchParams.get('serviceType') || 'general';
      const warehouseId = searchParams.get('warehouseId') || undefined;
      const estimate = await getMaterialEstimates(session.organizationId, serviceType, warehouseId);
      return NextResponse.json({ success: true, data: estimate });
    }

    // Job profitability
    if (view === 'profitability' && jobId) {
      const profitability = await getJobProfitabilityReport(session.organizationId, jobId);
      return NextResponse.json({ success: true, data: profitability });
    }

    // Material usage report
    if (view === 'usage-report') {
      const dateFrom = new Date(searchParams.get('dateFrom') || Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = new Date(searchParams.get('dateTo') || Date.now());
      const report = await generateMaterialUsageReport(session.organizationId, dateFrom, dateTo);
      return NextResponse.json({ success: true, data: report });
    }

    return NextResponse.json(
      { success: false, error: 'jobId is required or invalid view' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Job materials API error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching job materials data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/job-materials
 * Add, use, or return job materials
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    // Add material to job
    if (action === 'add' || !action) {
      const { jobId, productId, quantity, unitPrice, discount, sourceType, sourceId, notes, reserveStock } = body;
      const material = await addJobMaterial(session.organizationId, {
        jobId,
        productId,
        quantity,
        unitPrice,
        discount,
        sourceType,
        sourceId,
        notes,
        reserveStock,
      });
      return NextResponse.json({ success: true, data: { material } });
    }

    // Use material
    if (action === 'use') {
      const { jobMaterialId, usedQty, fromVehicle, technicianId } = body;
      const result = await useMaterial(session.organizationId, {
        jobMaterialId,
        usedQty,
        fromVehicle,
        technicianId: technicianId || session.userId,
      });
      return NextResponse.json({ success: true, data: result });
    }

    // Return material
    if (action === 'return') {
      const { jobMaterialId, returnedQty, reason, toWarehouseId } = body;
      const result = await returnMaterial(session.organizationId, {
        jobMaterialId,
        returnedQty,
        reason,
        toWarehouseId,
      });
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Job materials action error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error processing job materials action' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory/job-materials
 * Update job material
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { jobMaterialId, ...data } = body;

    if (!jobMaterialId) {
      return NextResponse.json(
        { success: false, error: 'jobMaterialId is required' },
        { status: 400 }
      );
    }

    const material = await updateJobMaterial(session.organizationId, jobMaterialId, data);

    return NextResponse.json({
      success: true,
      data: { material },
    });
  } catch (error) {
    console.error('Job material update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error updating job material' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/job-materials
 * Remove material from job
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobMaterialId = searchParams.get('jobMaterialId');

    if (!jobMaterialId) {
      return NextResponse.json(
        { success: false, error: 'jobMaterialId is required' },
        { status: 400 }
      );
    }

    await removeJobMaterial(session.organizationId, jobMaterialId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Job material removal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error removing job material' },
      { status: 500 }
    );
  }
}
