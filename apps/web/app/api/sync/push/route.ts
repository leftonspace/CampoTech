import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

/**
 * Sync Push API
 * =============
 *
 * POST /api/sync/push
 * Receives operations from mobile and applies them to the server.
 */

interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: Record<string, unknown>;
}

interface PushRequest {
  operations: SyncOperation[];
}

interface Conflict {
  entityType: string;
  entityId: string;
  serverData: unknown;
}

async function getMobileSession(request: NextRequest): Promise<TokenPayload | null> {
  // First try Authorization header (mobile apps)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (payload) return payload;
  }

  // Fall back to cookie (web)
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('auth-token')?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getMobileSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const body: PushRequest = await request.json();
    const { operations = [] } = body;

    const conflicts: Conflict[] = [];
    let processed = 0;

    for (const op of operations) {
      try {
        const result = await processOperation(session, op);
        if (result.conflict) {
          conflicts.push({
            entityType: op.entity,
            entityId: op.data.id as string,
            serverData: result.serverData,
          });
        } else {
          processed++;
        }
      } catch (error) {
        console.error('Error processing operation:', op, error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed,
        conflicts,
      },
    });
  } catch (error) {
    console.error('Sync push error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Error pushing sync data' } },
      { status: 500 }
    );
  }
}

async function processOperation(
  session: TokenPayload,
  operation: SyncOperation
): Promise<{ conflict?: boolean; serverData?: unknown }> {
  const { type, entity, data } = operation;

  switch (entity) {
    case 'job': {
      if (type === 'update' && data.serverId) {
        const existing = await prisma.job.findFirst({
          where: {
            id: data.serverId as string,
            organizationId: session.organizationId,
          },
        });

        if (!existing) {
          return {}; // Job not found, skip
        }

        // Phase 10 Security: Block modifications to terminal state jobs
        const TERMINAL_STATES = ['COMPLETED', 'CANCELLED'];
        if (TERMINAL_STATES.includes(existing.status)) {
          console.warn('[SECURITY] Sync push terminal state violation:', {
            jobId: data.serverId,
            currentStatus: existing.status,
            attemptedStatus: data.status,
            timestamp: new Date().toISOString(),
          });
          return {
            conflict: true,
            serverData: {
              error: `No se puede modificar un trabajo ${existing.status === 'COMPLETED' ? 'completado' : 'cancelado'}`,
              terminalStateBlocked: true,
              currentStatus: existing.status,
            },
          };
        }

        // Check for conflicts based on timestamp
        const clientUpdatedAt = data.updatedAt ? new Date(data.updatedAt as string) : new Date(0);
        if (existing.updatedAt > clientUpdatedAt) {
          return {
            conflict: true,
            serverData: existing,
          };
        }

        // Apply update
        type JobStatusType = 'PENDING' | 'ASSIGNED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (data.status) {
          updateData.status = data.status as JobStatusType;
        }
        if (data.completionNotes) {
          updateData.resolution = data.completionNotes;
        }
        if (data.actualEnd) {
          updateData.completedAt = new Date(data.actualEnd as string);
        }

        await prisma.job.update({
          where: { id: data.serverId as string },
          data: updateData,
        });

        return {};
      }
      break;
    }

    case 'customer': {
      if (type === 'create') {
        // Create new customer
        await prisma.customer.create({
          data: {
            organizationId: session.organizationId,
            name: data.name as string,
            phone: data.phone as string || null,
            email: data.email as string || null,
            address: data.address as string || null,
            city: data.city as string || null,
            state: data.province as string || null,
            taxId: (data.dni || data.cuit) as string || null,
            notes: data.notes as string || null,
          },
        });
        return {};
      }
      break;
    }

    // Add more entity handlers as needed
  }

  return {};
}
