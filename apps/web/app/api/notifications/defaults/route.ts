import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/notifications/defaults
 * Get organization notification defaults (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only admins can view organization defaults
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        notificationDefaults: true,
        name: true,
        businessName: true,
      },
    });

    // Return defaults or default values for Argentina
    const defaults = org?.notificationDefaults || getArgentineDefaults();

    return NextResponse.json({
      success: true,
      data: {
        organizationName: org?.businessName || org?.name,
        defaults,
      },
    });
  } catch (error) {
    console.error('Get notification defaults error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo configuración por defecto' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/defaults
 * Update organization notification defaults (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only admins can update organization defaults
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { defaults, applyToExistingUsers } = body;

    // Update organization defaults
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        notificationDefaults: defaults,
      },
    });

    // Optionally apply to all existing users who haven't customized
    if (applyToExistingUsers) {
      // Get users without custom preferences
      const usersWithoutPrefs = await prisma.user.findMany({
        where: {
          organizationId: session.organizationId,
          notificationPreferences: null,
        },
        select: { id: true },
      });

      // Create default preferences for these users
      if (usersWithoutPrefs.length > 0) {
        await prisma.notificationPreferences.createMany({
          data: usersWithoutPrefs.map((user) => ({
            userId: user.id,
            organizationId: session.organizationId,
            webEnabled: defaults.webEnabled ?? true,
            pushEnabled: defaults.pushEnabled ?? true,
            smsEnabled: defaults.smsEnabled ?? false,
            emailEnabled: defaults.emailEnabled ?? false,
            whatsappEnabled: defaults.whatsappEnabled ?? true,
            eventPreferences: defaults.eventPreferences || {},
            reminderIntervals: defaults.reminderIntervals || [1440, 60, 30],
            quietHoursEnabled: defaults.quietHoursEnabled ?? false,
            quietHoursStart: defaults.quietHoursStart || '22:00',
            quietHoursEnd: defaults.quietHoursEnd || '08:00',
            quietHoursTimezone: defaults.quietHoursTimezone || 'America/Argentina/Buenos_Aires',
          })),
          skipDuplicates: true,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Configuración actualizada y aplicada a ${usersWithoutPrefs.length} usuarios`,
        usersUpdated: usersWithoutPrefs.length,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Configuración por defecto actualizada',
    });
  } catch (error) {
    console.error('Update notification defaults error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando configuración por defecto' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/defaults
 * Reset organization to Argentine defaults
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    const defaults = getArgentineDefaults();

    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        notificationDefaults: defaults,
      },
    });

    return NextResponse.json({
      success: true,
      data: defaults,
      message: 'Configuración restablecida a valores por defecto de Argentina',
    });
  } catch (error) {
    console.error('Reset notification defaults error:', error);
    return NextResponse.json(
      { success: false, error: 'Error restableciendo configuración' },
      { status: 500 }
    );
  }
}

function getArgentineDefaults() {
  return {
    webEnabled: true,
    pushEnabled: true,
    smsEnabled: false, // SMS is expensive, WhatsApp preferred
    emailEnabled: false,
    whatsappEnabled: true, // WhatsApp is primary in Argentina
    eventPreferences: {
      job_assigned: { whatsapp: true, push: true, email: false, sms: false },
      job_reminder: { whatsapp: true, push: true, email: false, sms: false },
      job_completed: { whatsapp: true, push: true, email: false, sms: false },
      schedule_change: { whatsapp: true, push: true, email: false, sms: false },
      invoice_created: { whatsapp: true, push: false, email: true, sms: false },
      payment_received: { whatsapp: true, push: true, email: false, sms: false },
      team_member_added: { whatsapp: true, push: false, email: false, sms: false },
      system_alert: { whatsapp: true, push: true, email: true, sms: true },
    },
    reminderIntervals: [1440, 60, 30], // 24h, 1h, 30min
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    quietHoursTimezone: 'America/Argentina/Buenos_Aires',
  };
}
