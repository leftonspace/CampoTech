/**
 * Acknowledgment API
 * ==================
 *
 * POST /api/verification/acknowledge
 *
 * Records a user's acceptance of a legal acknowledgment.
 * Stores timestamp, IP address, user agent, and acknowledgment version
 * for compliance audit trail.
 *
 * GET /api/verification/acknowledge
 *
 * Returns all acknowledgments made by the current user.
 *
 * GET /api/verification/acknowledge?check=type1,type2
 *
 * Checks if user has acknowledged specific types, returns missing ones.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAuditEntry } from '@/lib/audit/logger';
import { ACKNOWLEDGMENTS, type AcknowledgmentType } from '@/lib/config/acknowledgments';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AcknowledgeRequest {
  acknowledgmentType: AcknowledgmentType;
  version?: string;
  ipAddress?: string | null;
  userAgent?: string;
  deviceInfo?: {
    screenWidth?: number;
    screenHeight?: number;
    timezone?: string;
    language?: string;
  };
}

interface AcknowledgeResponse {
  success: boolean;
  acknowledgmentId?: string;
  acknowledgedAt?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Record Acknowledgment
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse<AcknowledgeResponse>> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = (await request.json()) as AcknowledgeRequest;

    // Validate acknowledgment type
    const { acknowledgmentType, version, ipAddress, userAgent, deviceInfo } = body;

    if (!acknowledgmentType) {
      return NextResponse.json(
        { success: false, error: 'Tipo de aceptación es requerido' },
        { status: 400 }
      );
    }

    // Check if acknowledgment type is valid
    const acknowledgmentConfig = ACKNOWLEDGMENTS[acknowledgmentType];
    if (!acknowledgmentConfig) {
      return NextResponse.json(
        { success: false, error: `Tipo de aceptación inválido: ${acknowledgmentType}` },
        { status: 400 }
      );
    }

    // Use version from request or from config
    const effectiveVersion = version || acknowledgmentConfig.version;

    const userId = session.id;
    const organizationId = session.organizationId;

    // Get IP from request headers if not provided
    const effectiveIpAddress =
      ipAddress ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      null;

    // Get user agent from headers if not provided
    const effectiveUserAgent =
      userAgent || request.headers.get('user-agent') || 'Unknown';

    console.log('[Acknowledge] Recording acknowledgment:', {
      userId,
      organizationId,
      acknowledgmentType,
      version: effectiveVersion,
      ipAddress: effectiveIpAddress,
    });

    // Check for existing acknowledgment with same type and version
    const existing = await prisma.complianceAcknowledgment.findUnique({
      where: {
        userId_acknowledgmentType_version: {
          userId,
          acknowledgmentType: acknowledgmentType as any, // Prisma enum
          version: effectiveVersion,
        },
      },
    });

    if (existing) {
      // Already acknowledged this version
      return NextResponse.json({
        success: true,
        acknowledgmentId: existing.id,
        acknowledgedAt: existing.acknowledgedAt.toISOString(),
      });
    }

    // Create the acknowledgment record
    const acknowledgment = await prisma.complianceAcknowledgment.create({
      data: {
        userId,
        organizationId,
        acknowledgmentType: acknowledgmentType as any, // Prisma enum
        version: effectiveVersion,
        ipAddress: effectiveIpAddress,
        userAgent: effectiveUserAgent,
        deviceInfo: deviceInfo as object || null,
        acknowledgedAt: new Date(),
      },
    });

    // Log audit entry
    await logAuditEntry({
      action: 'acknowledgment_accepted',
      resource: 'compliance_acknowledgment',
      resourceId: acknowledgment.id,
      organizationId,
      actorId: userId,
      details: {
        acknowledgmentType,
        version: effectiveVersion,
        ipAddress: effectiveIpAddress,
        title: acknowledgmentConfig.title,
      },
    }).catch((err) => console.error('[Acknowledge] Audit log error:', err));

    console.log('[Acknowledge] Recorded:', {
      acknowledgmentId: acknowledgment.id,
      type: acknowledgmentType,
    });

    return NextResponse.json({
      success: true,
      acknowledgmentId: acknowledgment.id,
      acknowledgedAt: acknowledgment.acknowledgedAt.toISOString(),
    });
  } catch (error) {
    console.error('[Acknowledge] Error:', error);

    // Check for unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint')
    ) {
      return NextResponse.json({
        success: true,
        error: 'Ya has aceptado esta versión',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al registrar aceptación',
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Acknowledgments / Check Missing
// ═══════════════════════════════════════════════════════════════════════════════

interface GetAcknowledgementsResponse {
  success: boolean;
  acknowledgments?: Array<{
    id: string;
    type: string;
    version: string;
    acknowledgedAt: string;
    title: string;
  }>;
  missing?: string[];
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<GetAcknowledgementsResponse>> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const userId = session.id;
    const { searchParams } = new URL(request.url);
    const checkTypes = searchParams.get('check');

    // If checking specific types
    if (checkTypes) {
      const typesToCheck = checkTypes.split(',').map((t) => t.trim()) as AcknowledgmentType[];

      // Validate types
      const invalidTypes = typesToCheck.filter((t) => !ACKNOWLEDGMENTS[t]);
      if (invalidTypes.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Tipos inválidos: ${invalidTypes.join(', ')}`,
          },
          { status: 400 }
        );
      }

      // Get user's acknowledgments for these types
      const acknowledgments = await prisma.complianceAcknowledgment.findMany({
        where: {
          userId,
          acknowledgmentType: { in: typesToCheck as any[] },
        },
        select: {
          acknowledgmentType: true,
          version: true,
        },
      });

      // Check which are missing or outdated
      const acknowledged = new Map(
        acknowledgments.map((a) => [a.acknowledgmentType, a.version])
      );

      const missing: string[] = [];
      for (const type of typesToCheck) {
        const config = ACKNOWLEDGMENTS[type];
        const userVersion = acknowledged.get(type);

        // Missing if never acknowledged or if version is outdated
        if (!userVersion || userVersion !== config.version) {
          missing.push(type);
        }
      }

      return NextResponse.json({
        success: true,
        missing,
      });
    }

    // Otherwise, return all acknowledgments
    const acknowledgments = await prisma.complianceAcknowledgment.findMany({
      where: { userId },
      orderBy: { acknowledgedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      acknowledgments: acknowledgments.map((a) => ({
        id: a.id,
        type: a.acknowledgmentType,
        version: a.version,
        acknowledgedAt: a.acknowledgedAt.toISOString(),
        title: ACKNOWLEDGMENTS[a.acknowledgmentType as AcknowledgmentType]?.title || a.acknowledgmentType,
      })),
    });
  } catch (error) {
    console.error('[Acknowledge] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener aceptaciones',
      },
      { status: 500 }
    );
  }
}
