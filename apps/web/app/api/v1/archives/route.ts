/**
 * CampoTech Archive Retrieval API (Phase 5A.2.3)
 * ===============================================
 *
 * Allows businesses to retrieve their archived data.
 * Complies with ARCO rights (Ley 25.326 - Argentina).
 *
 * Endpoints:
 * - GET /api/v1/archives - List available archives
 * - GET /api/v1/archives?download=true - Get signed download URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listArchives,
  getSignedUrl,
} from '@/lib/storage/archive-storage';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ArchiveListResponse {
  success: boolean;
  archives: Array<{
    table: string;
    path: string;
    createdAt: string;
    dateRange?: {
      from: string;
      to: string;
    };
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

interface ArchiveDownloadResponse {
  success: boolean;
  downloadUrl: string;
  expiresIn: number; // seconds
  path: string;
}

// Archivable tables that users can request
const ACCESSIBLE_TABLES = [
  'jobs',
  'whatsapp_messages',
  'invoices',
  'customers',
  'audit_logs',
  'technician_locations_aggregates',
];

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/archives
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { organizationId } = session;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const table = searchParams.get('table');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const download = searchParams.get('download') === 'true';
    const path = searchParams.get('path');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    // If download requested with specific path
    if (download && path) {
      return handleDownload(organizationId, path);
    }

    // Validate table if specified
    if (table && !ACCESSIBLE_TABLES.includes(table)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid table. Accessible tables: ${ACCESSIBLE_TABLES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Parse dates
    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    const parsedEndDate = endDate ? new Date(endDate) : undefined;

    // Validate date range
    if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid startDate format. Use ISO 8601.' },
        { status: 400 }
      );
    }
    if (parsedEndDate && isNaN(parsedEndDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid endDate format. Use ISO 8601.' },
        { status: 400 }
      );
    }

    // Fetch archives
    const tablesToQuery = table ? [table] : ACCESSIBLE_TABLES;
    const allArchives: Array<{
      table: string;
      path: string;
      createdAt: string;
    }> = [];

    for (const t of tablesToQuery) {
      const archives = await listArchives(
        t,
        organizationId,
        parsedStartDate,
        parsedEndDate
      );

      for (const archive of archives) {
        allArchives.push({
          table: t,
          path: archive.path,
          createdAt: archive.created_at,
        });
      }
    }

    // Sort by date descending
    allArchives.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Paginate
    const total = allArchives.length;
    const startIndex = (page - 1) * limit;
    const paginatedArchives = allArchives.slice(startIndex, startIndex + limit);

    const response: ArchiveListResponse = {
      success: true,
      archives: paginatedArchives,
      pagination: {
        total,
        page,
        limit,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ArchivesAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

async function handleDownload(
  organizationId: string,
  path: string
): Promise<NextResponse> {
  try {
    // Security: Verify the path belongs to this organization
    if (!path.includes(`${organizationId}_`)) {
      console.warn(
        `[ArchivesAPI] Access denied: org ${organizationId} tried to access ${path}`
      );
      return NextResponse.json(
        { success: false, error: 'Access denied to this archive' },
        { status: 403 }
      );
    }

    // Generate signed URL (valid for 1 hour)
    const expiresIn = 3600;
    const signedUrl = await getSignedUrl(path, expiresIn);

    if (!signedUrl) {
      return NextResponse.json(
        { success: false, error: 'Archive not found or inaccessible' },
        { status: 404 }
      );
    }

    const response: ArchiveDownloadResponse = {
      success: true,
      downloadUrl: signedUrl,
      expiresIn,
      path,
    };

    // Log access for audit
    console.log(`[ArchivesAPI] Download requested: org=${organizationId}, path=${path}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ArchivesAPI] Download error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/archives/request
// For ARCO data access requests
// ═══════════════════════════════════════════════════════════════════════════════

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
    const { type, tables, dateRange, reason } = body;

    // Validate request type
    const validTypes = ['access', 'export', 'deletion'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Valid types: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // For deletion requests, we only allow certain tables
    if (type === 'deletion') {
      const nonDeletableTables = ['invoices', 'audit_logs'];
      const requestedNonDeletable = (tables || []).filter((t: string) =>
        nonDeletableTables.includes(t)
      );

      if (requestedNonDeletable.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot delete from these tables due to legal requirements: ${requestedNonDeletable.join(', ')}. ` +
              'Invoices must be retained for 10 years (AFIP). Audit logs are required for compliance.',
          },
          { status: 400 }
        );
      }
    }

    // Log ARCO request for compliance
    const arcoRequest = {
      id: `arco_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId: session.organizationId,
      userId: session.userId,
      type,
      tables: tables || ACCESSIBLE_TABLES,
      dateRange: dateRange || null,
      reason: reason || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      estimatedCompletion: getEstimatedCompletion(type),
    };

    console.log('[ArchivesAPI] ARCO request created:', arcoRequest);

    // In production, this would:
    // 1. Store the request in database
    // 2. Notify data protection officer
    // 3. Queue processing job

    return NextResponse.json({
      success: true,
      request: arcoRequest,
      message: getRequestMessage(type),
    });
  } catch (error) {
    console.error('[ArchivesAPI] ARCO request error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getEstimatedCompletion(type: string): string {
  const now = new Date();
  const days = type === 'deletion' ? 10 : type === 'export' ? 3 : 1;
  now.setDate(now.getDate() + days);
  return now.toISOString();
}

function getRequestMessage(type: string): string {
  switch (type) {
    case 'access':
      return 'Your data access request has been received. You will receive access within 24 hours.';
    case 'export':
      return 'Your data export request has been received. The export will be ready within 3 business days.';
    case 'deletion':
      return 'Your data deletion request has been received. It will be processed within 10 business days as required by Ley 25.326. ' +
        'Note: Some data may be retained for legal compliance (invoices, audit logs).';
    default:
      return 'Your request has been received.';
  }
}
