/**
 * Trial Status API
 * ================
 *
 * GET /api/subscription/trial-status - Get current trial status for organization
 *
 * Returns trial information including:
 * - Whether organization is currently trialing
 * - Days remaining in trial
 * - Trial end date
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { trialManager } from '@/lib/services/trial-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Trial Status
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

    // Get trial status from trial manager
    const trialStatus = await trialManager.getTrialStatus(session.organizationId);

    if (!trialStatus) {
      return NextResponse.json({
        success: true,
        data: {
          isTrialing: false,
          daysRemaining: 0,
          trialEndsAt: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        isTrialing: trialStatus.isTrialing,
        daysRemaining: trialStatus.daysRemaining,
        trialEndsAt: trialStatus.trialEndsAt?.toISOString() || null,
        hasTrialExpired: trialStatus.isExpired,
      },
    });
  } catch (error) {
    console.error('Get trial status error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener estado de prueba' },
      { status: 500 }
    );
  }
}
