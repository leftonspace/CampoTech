import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Notification Defaults API
 * =========================
 *
 * Placeholder - Notification preferences system not yet implemented.
 * Returns default Argentine notification settings.
 */

function getArgentineDefaults() {
  return {
    webEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
    emailEnabled: false,
    whatsappEnabled: true,
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
    reminderIntervals: [1440, 60, 30],
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    quietHoursTimezone: 'America/Argentina/Buenos_Aires',
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        organizationName: 'Organization',
        defaults: getArgentineDefaults(),
      },
      message: 'Notification preferences system not yet implemented',
    });
  } catch (error) {
    console.error('Get notification defaults error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo configuración por defecto' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    // Notification preferences storage not yet implemented
    return NextResponse.json({
      success: true,
      message: 'Notification preferences system not yet implemented',
    });
  } catch (error) {
    console.error('Update notification defaults error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando configuración por defecto' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: getArgentineDefaults(),
      message: 'Notification preferences system not yet implemented',
    });
  } catch (error) {
    console.error('Reset notification defaults error:', error);
    return NextResponse.json(
      { success: false, error: 'Error restableciendo configuración' },
      { status: 500 }
    );
  }
}
