import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Mobile Sync API
 * ===============
 *
 * Handles bidirectional sync between mobile app and server.
 * Supports incremental sync with conflict resolution.
 */

interface SyncOperation {
  id: string;
  table: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: string;
  clientId: string;
}

interface SyncRequest {
  lastSyncAt?: string;
  operations: SyncOperation[];
  deviceId: string;
}

interface SyncResponse {
  serverChanges: {
    jobs: unknown[];
    customers: unknown[];
    products: unknown[];
  };
  conflicts: Array<{
    operationId: string;
    resolution: 'server_wins' | 'client_wins' | 'merged';
    serverData?: unknown;
  }>;
  syncedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SyncRequest = await request.json();
    const { lastSyncAt, operations, deviceId: _deviceId } = body;

    const lastSync = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
    const now = new Date();

    const conflicts: SyncResponse['conflicts'] = [];
    const processedOperations: string[] = [];

    // Process client operations
    for (const op of operations || []) {
      try {
        const result = await processOperation(session.organizationId, op, session.userId);
        if (result.conflict) {
          conflicts.push({
            operationId: op.id,
            resolution: result.resolution || 'server_wins',
            serverData: result.serverData,
          });
        }
        processedOperations.push(op.id);
      } catch (error) {
        console.error('Error processing sync operation:', op.id, error);
      }
    }

    // Fetch server changes since last sync
    const [jobs, customers, products] = await Promise.all([
      prisma.job.findMany({
        where: {
          organizationId: session.organizationId,
          updatedAt: { gt: lastSync },
          OR: [
            { technicianId: session.userId },
            { technicianId: null },
          ],
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
            },
          },
          materials: true,
        },
      }),
      prisma.customer.findMany({
        where: {
          organizationId: session.organizationId,
          updatedAt: { gt: lastSync },
        },
        take: 100, // Limit for performance
      }),
      prisma.product.findMany({
        where: {
          organizationId: session.organizationId,
          updatedAt: { gt: lastSync },
        },
      }),
    ]);

    // Note: Sync operation logging skipped - SyncOperation model not available

    return NextResponse.json({
      success: true,
      data: {
        serverChanges: {
          jobs: jobs.map(formatJobForMobile),
          customers,
          products,
        },
        conflicts,
        syncedAt: now.toISOString(),
        processedOperations,
      } as SyncResponse,
    });
  } catch (error) {
    console.error('Mobile sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Error syncing data' },
      { status: 500 }
    );
  }
}

type ResolutionType = 'server_wins' | 'client_wins' | 'merged';

async function processOperation(
  organizationId: string,
  operation: SyncOperation,
  _userId: string
): Promise<{ conflict?: boolean; resolution?: ResolutionType; serverData?: unknown }> {
  const { table, action, data, timestamp } = operation;
  const clientTimestamp = new Date(timestamp);

  switch (table) {
    case 'jobs': {
      if (action === 'update' && data.id) {
        const existing = await prisma.job.findFirst({
          where: { id: data.id as string, organizationId },
        });

        if (existing && existing.updatedAt > clientTimestamp) {
          // Server has newer data - conflict
          return {
            conflict: true,
            resolution: 'server_wins',
            serverData: existing,
          };
        }

        // Apply client update
        type JobStatusType = 'PENDING' | 'ASSIGNED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
        const updateData: {
          status?: JobStatusType;
          resolution?: string;
          completedAt?: Date;
          updatedAt: Date;
        } = {
          updatedAt: new Date(),
        };
        if (data.status) {
          updateData.status = data.status as JobStatusType;
        }
        if (data.resolution) {
          updateData.resolution = data.resolution as string;
        }
        if (data.completedAt) {
          updateData.completedAt = new Date(data.completedAt as string);
        }
        await prisma.job.update({
          where: { id: data.id as string },
          data: updateData,
        });
      }
      break;
    }

    case 'job_photos': {
      if (action === 'create' && data.jobId) {
        type PhotoTypeEnum = 'BEFORE' | 'DURING' | 'AFTER' | 'SIGNATURE' | 'DOCUMENT';
        await prisma.jobPhoto.create({
          data: {
            jobId: data.jobId as string,
            photoUrl: data.photoUrl as string,
            photoType: (data.photoType as PhotoTypeEnum) || 'AFTER',
            takenAt: data.takenAt ? new Date(data.takenAt as string) : new Date(),
          },
        });
      }
      break;
    }

    // Add more table handlers as needed
  }

  return {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatJobForMobile(job: any) {
  return {
    id: job.id,
    status: job.status,
    scheduledDate: job.scheduledDate,
    scheduledTimeSlot: job.scheduledTimeSlot,
    description: job.description,
    urgency: job.urgency,
    customer: job.customer,
    materials: job.materials,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
