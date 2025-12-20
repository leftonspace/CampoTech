/**
 * Subscription Cancellation API (Ley 24.240)
 * ==========================================
 *
 * POST /api/subscription/cancel - Request subscription cancellation
 * GET /api/subscription/cancel - Get cancellation status and eligibility
 * DELETE /api/subscription/cancel - Cancel the cancellation request (undo)
 *
 * Implements "Botón de Arrepentimiento" per Ley 24.240:
 * - 10-day withdrawal period with full refund
 * - Refunds processed within 10 business days
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subscriptionCancellation } from '@/lib/services/subscription-cancellation';
import { logAuditEntry } from '@/lib/audit/logger';
import type { CancellationReason } from '@/lib/services/subscription-cancellation';

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Request Cancellation (Botón de Arrepentimiento)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER can cancel subscription
    if (session.role?.toUpperCase() !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Solo el propietario puede cancelar la suscripción' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const reason: CancellationReason = body.reason || 'arrepentimiento';
    const reasonDetails: string | undefined = body.reasonDetails;

    // Validate reason
    const validReasons: CancellationReason[] = [
      'arrepentimiento',
      'no_longer_needed',
      'too_expensive',
      'missing_features',
      'switching_competitor',
      'technical_issues',
      'other',
    ];

    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: 'Motivo de cancelación no válido' },
        { status: 400 }
      );
    }

    // Request cancellation
    const result = await subscriptionCancellation.requestCancellation({
      organizationId: session.organizationId,
      userId: session.userId,
      reason,
      reasonDetails,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || result.message },
        { status: 400 }
      );
    }

    // Log the action
    await logAuditEntry({
      organizationId: session.organizationId,
      userId: session.userId,
      userRole: session.role || 'OWNER',
      action: 'DELETE',
      entityType: 'subscription',
      entityId: result.cancellationId || session.organizationId,
      metadata: {
        reason,
        reasonDetails,
        eligibleForRefund: result.eligibleForRefund,
        refundAmount: result.refundAmount,
        effectiveDate: result.effectiveDate?.toISOString(),
        ley24240: reason === 'arrepentimiento',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        cancellationId: result.cancellationId,
        eligibleForRefund: result.eligibleForRefund,
        refundAmount: result.refundAmount,
        effectiveDate: result.effectiveDate,
        message: result.message,
      },
    });
  } catch (error) {
    console.error('Cancellation request error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al procesar la solicitud de cancelación' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Cancellation Status and Eligibility
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Get current cancellation request (if any)
    const currentRequest = await subscriptionCancellation.getCancellationStatus(
      session.organizationId
    );

    // Get eligibility info
    const eligibility = await subscriptionCancellation.getEligibilityInfo(
      session.organizationId
    );

    return NextResponse.json({
      success: true,
      data: {
        eligibility,
        currentRequest: currentRequest
          ? {
              id: currentRequest.id,
              status: currentRequest.status,
              refundStatus: currentRequest.refundStatus,
              refundAmount: currentRequest.refundAmount,
              eligibleForRefund: currentRequest.eligibleForRefund,
              requestedAt: currentRequest.requestedAt,
              effectiveDate: currentRequest.effectiveDate,
              reason: currentRequest.reason,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Get cancellation status error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener estado de cancelación' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Cancel the Cancellation Request (Undo)
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER can undo cancellation
    if (session.role?.toUpperCase() !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Solo el propietario puede revertir la cancelación' },
        { status: 403 }
      );
    }

    // Cancel the cancellation request
    const result = await subscriptionCancellation.cancelCancellationRequest(
      session.organizationId,
      session.userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    // Log the action
    await logAuditEntry({
      organizationId: session.organizationId,
      userId: session.userId,
      userRole: session.role || 'OWNER',
      action: 'UPDATE',
      entityType: 'subscription',
      entityId: session.organizationId,
      metadata: {
        action: 'undo_cancellation',
      },
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Undo cancellation error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al revertir la cancelación' },
      { status: 500 }
    );
  }
}
