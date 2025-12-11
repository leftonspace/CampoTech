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
    priceBookItems: unknown[];
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
    const { lastSyncAt, operations, deviceId } = body;

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
    const [jobs, customers, priceBookItems] = await Promise.all([
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
          lineItems: true,
        },
      }),
      prisma.customer.findMany({
        where: {
          organizationId: session.organizationId,
          updatedAt: { gt: lastSync },
        },
        take: 100, // Limit for performance
      }),
      prisma.priceBookItem.findMany({
        where: {
          organizationId: session.organizationId,
          updatedAt: { gt: lastSync },
        },
      }),
    ]);

    // Record sync operation
    await prisma.syncOperation.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        deviceId,
        direction: 'bidirectional',
        operationsCount: operations?.length || 0,
        changesCount: jobs.length + customers.length + priceBookItems.length,
        conflictsCount: conflicts.length,
        syncedAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        serverChanges: {
          jobs: jobs.map(formatJobForMobile),
          customers,
          priceBookItems,
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

async function processOperation(
  organizationId: string,
  operation: SyncOperation,
  userId: string
): Promise<{ conflict?: boolean; resolution?: string; serverData?: unknown }> {
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
        await prisma.job.update({
          where: { id: data.id as string },
          data: {
            status: data.status as string,
            notes: data.notes as string,
            completedAt: data.completedAt ? new Date(data.completedAt as string) : undefined,
            updatedAt: new Date(),
          },
        });
      }
      break;
    }

    case 'job_photos': {
      if (action === 'create' && data.jobId) {
        await prisma.jobPhoto.create({
          data: {
            jobId: data.jobId as string,
            url: data.url as string,
            type: (data.type as string) || 'after',
            caption: data.caption as string,
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

function formatJobForMobile(job: any) {
  return {
    id: job.id,
    status: job.status,
    scheduledDate: job.scheduledDate,
    scheduledTimeStart: job.scheduledTimeStart,
    scheduledTimeEnd: job.scheduledTimeEnd,
    address: job.address,
    notes: job.notes,
    priority: job.priority,
    customer: job.customer,
    lineItems: job.lineItems,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
