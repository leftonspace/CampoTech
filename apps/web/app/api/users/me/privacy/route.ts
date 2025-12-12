/**
 * User Privacy Preferences API
 * =============================
 *
 * GET /api/users/me/privacy - Get privacy preferences
 * PUT /api/users/me/privacy - Update privacy preferences
 *
 * Implements Right of Opposition per Ley 25.326
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

interface PrivacyPreferences {
  marketingEmails: boolean;
  activityTracking: boolean;
  aiTraining: boolean;
  locationHistory: boolean;
}

const privacyPreferencesSchema = z.object({
  marketingEmails: z.boolean().optional(),
  activityTracking: z.boolean().optional(),
  aiTraining: z.boolean().optional(),
  locationHistory: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/users/me/privacy
 * Get user's privacy preferences
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { userId } = session;

    // Get or create preferences
    const preferences = await prisma.$queryRaw<Array<{
      marketing_emails: boolean;
      activity_tracking: boolean;
      ai_training: boolean;
      location_history: boolean;
      updated_at: Date;
    }>>`
      SELECT marketing_emails, activity_tracking, ai_training, location_history, updated_at
      FROM user_privacy_preferences
      WHERE user_id = ${userId}::uuid
      LIMIT 1
    `;

    if (preferences.length === 0) {
      // Return defaults (haven't been set yet)
      return NextResponse.json({
        preferences: {
          marketingEmails: true,
          activityTracking: true,
          aiTraining: false, // Never use for AI training by default
          locationHistory: true,
        },
        isDefault: true,
        descriptions: getPreferenceDescriptions(session.role),
      });
    }

    const prefs = preferences[0];
    return NextResponse.json({
      preferences: {
        marketingEmails: prefs.marketing_emails,
        activityTracking: prefs.activity_tracking,
        aiTraining: prefs.ai_training,
        locationHistory: prefs.location_history,
      },
      isDefault: false,
      lastUpdated: prefs.updated_at.toISOString(),
      descriptions: getPreferenceDescriptions(session.role),
    });
  } catch (error) {
    console.error('Get privacy preferences error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al obtener preferencias' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PUT /api/users/me/privacy
 * Update user's privacy preferences
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { userId } = session;

    // Parse and validate body
    const body = await request.json();
    const parseResult = privacyPreferencesSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'invalid_input', message: 'Datos inválidos', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const updates = parseResult.data;

    // Build update values
    const marketingEmails = updates.marketingEmails ?? true;
    const activityTracking = updates.activityTracking ?? true;
    const aiTraining = updates.aiTraining ?? false; // Default to false
    const locationHistory = updates.locationHistory ?? true;

    // Upsert preferences
    await prisma.$executeRaw`
      INSERT INTO user_privacy_preferences (
        user_id, marketing_emails, activity_tracking, ai_training, location_history
      ) VALUES (
        ${userId}::uuid,
        ${marketingEmails},
        ${activityTracking},
        ${aiTraining},
        ${locationHistory}
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        marketing_emails = ${marketingEmails},
        activity_tracking = ${activityTracking},
        ai_training = ${aiTraining},
        location_history = ${locationHistory},
        updated_at = NOW()
    `;

    return NextResponse.json({
      success: true,
      message: 'Preferencias de privacidad actualizadas.',
      preferences: {
        marketingEmails,
        activityTracking,
        aiTraining,
        locationHistory,
      },
    });
  } catch (error) {
    console.error('Update privacy preferences error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al actualizar preferencias' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getPreferenceDescriptions(role: string): Record<keyof PrivacyPreferences, { title: string; description: string; warning?: string }> {
  const isTechnician = role === 'TECHNICIAN';

  return {
    marketingEmails: {
      title: 'Emails promocionales',
      description: 'Recibir novedades, ofertas y consejos de CampoTech.',
    },
    activityTracking: {
      title: 'Registro de actividad',
      description: 'Permitir el registro de tus acciones para mejorar la experiencia y seguridad.',
    },
    aiTraining: {
      title: 'Uso para IA',
      description: 'Permitir el uso de tus datos para entrenar modelos de inteligencia artificial.',
      warning: 'CampoTech nunca usa datos de clientes para entrenar IA sin consentimiento explícito.',
    },
    locationHistory: {
      title: 'Historial de ubicación',
      description: isTechnician
        ? 'Guardar historial de ubicaciones durante el trabajo para optimizar rutas.'
        : 'Guardar historial de ubicaciones para análisis de cobertura.',
    },
  };
}
