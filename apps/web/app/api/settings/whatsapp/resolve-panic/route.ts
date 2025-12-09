import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin permissions
    if (session.role !== 'owner' && session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Reset WhatsApp panic mode
    await prisma.capabilityOverride.upsert({
      where: {
        organizationId_capability: {
          organizationId: session.organizationId,
          capability: 'whatsapp_outbound',
        },
      },
      update: {
        isEnabled: true,
        reason: 'Manual recovery',
        updatedAt: new Date(),
      },
      create: {
        organizationId: session.organizationId,
        capability: 'whatsapp_outbound',
        isEnabled: true,
        reason: 'Manual recovery',
      },
    });

    // Log the recovery action
    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: 'WHATSAPP_PANIC_RESOLVED',
        entityType: 'system',
        entityId: session.organizationId,
        changes: { panicMode: false },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp panic mode resolved',
    });
  } catch (error) {
    console.error('WhatsApp resolve panic error:', error);
    return NextResponse.json(
      { success: false, error: 'Error resolving panic mode' },
      { status: 500 }
    );
  }
}
