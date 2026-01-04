/**
 * Notification Preferences API Route
 * ===================================
 *
 * Manages user notification preferences for all notification types:
 * - Subscription notifications
 * - Verification notifications
 * - Employee compliance alerts
 *
 * Supports multiple channels: email, in-app, SMS, WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

// Default preferences
const defaultPreferences = {
  // Global channel settings
  webEnabled: true,
  pushEnabled: false,
  smsEnabled: false,
  emailEnabled: true,
  whatsappEnabled: false,

  // Verification notification preferences
  verification: {
    // Document expiration reminders
    documentExpiringEmail: true,
    documentExpiringInApp: true,
    documentExpiringDays: [30, 14, 7, 1], // Days before expiration to notify

    // Document status changes
    documentApprovedEmail: true,
    documentApprovedInApp: true,
    documentRejectedEmail: true,
    documentRejectedInApp: true,

    // Account status
    accountBlockedEmail: true, // Cannot disable - critical
    accountBlockedInApp: true,
    accountUnblockedEmail: true,
    accountUnblockedInApp: true,

    // Employee notifications (for owners)
    employeeComplianceEmail: true,
    employeeComplianceInApp: true,
    employeeDocExpiringEmail: true,
    employeeDocExpiringInApp: true,

    // AFIP alerts
    afipStatusChangeEmail: true,
    afipStatusChangeInApp: true,

    // Badge earned
    badgeEarnedEmail: true,
    badgeEarnedInApp: true,
  },

  // Subscription notification preferences (existing)
  subscription: {
    trialExpiringEmail: true,
    trialExpiringInApp: true,
    trialExpiredEmail: true,
    trialExpiredInApp: true,
    paymentSuccessfulEmail: true,
    paymentSuccessfulInApp: true,
    paymentFailedEmail: true, // Cannot disable - critical
    paymentFailedInApp: true,
    paymentReminderEmail: true,
    paymentReminderInApp: true,
    subscriptionRenewedEmail: true,
    subscriptionRenewedInApp: false,
    subscriptionCancelledEmail: true,
    subscriptionCancelledInApp: true,
  },

  // General event preferences (legacy)
  eventPreferences: {},

  // Reminder intervals (minutes)
  reminderIntervals: [15, 60],

  // Quiet hours
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'America/Argentina/Buenos_Aires',
};

/**
 * GET /api/notifications/preferences
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Fetch user's preferences from database
    const prefs = await db.notificationPreferences.findUnique({
      where: { userId: session.userId },
    });

    // If no preferences exist, return defaults
    if (!prefs) {
      return NextResponse.json({
        success: true,
        data: {
          ...defaultPreferences,
          eventPreferences: defaultPreferences.eventPreferences || {},
          reminderIntervals: defaultPreferences.reminderIntervals || [60, 15],
        },
      });
    }

    // Map database record to API response
    return NextResponse.json({
      success: true,
      data: {
        webEnabled: prefs.webEnabled,
        pushEnabled: prefs.pushEnabled,
        smsEnabled: prefs.smsEnabled,
        emailEnabled: prefs.emailEnabled,
        whatsappEnabled: prefs.whatsappEnabled,
        eventPreferences: (prefs.eventPreferences as Record<string, Record<string, boolean>>) || {},
        reminderIntervals: (prefs.reminderIntervals as number[]) || [60, 15],
        quietHoursEnabled: prefs.quietHoursEnabled,
        quietHoursStart: prefs.quietHoursStart || '22:00',
        quietHoursEnd: prefs.quietHoursEnd || '08:00',
        quietHoursTimezone: prefs.quietHoursTimezone || 'America/Argentina/Buenos_Aires',
      },
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo preferencias' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
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

    const body = await request.json();
    const {
      webEnabled,
      pushEnabled,
      smsEnabled,
      emailEnabled,
      whatsappEnabled,
      eventPreferences,
      reminderIntervals,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      quietHoursTimezone,
    } = body;

    // Build data for upsert
    const data = {
      webEnabled: webEnabled ?? true,
      pushEnabled: pushEnabled ?? true,
      smsEnabled: smsEnabled ?? false,
      emailEnabled: emailEnabled ?? false,
      whatsappEnabled: whatsappEnabled ?? true,
      eventPreferences: eventPreferences ?? {},
      reminderIntervals: reminderIntervals ?? [60, 15],
      quietHoursEnabled: quietHoursEnabled ?? false,
      quietHoursStart: quietHoursStart ?? '22:00',
      quietHoursEnd: quietHoursEnd ?? '08:00',
      quietHoursTimezone: quietHoursTimezone ?? 'America/Argentina/Buenos_Aires',
    };

    // Upsert preferences in database
    const updated = await db.notificationPreferences.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        organizationId: session.organizationId,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({
      success: true,
      data: {
        webEnabled: updated.webEnabled,
        pushEnabled: updated.pushEnabled,
        smsEnabled: updated.smsEnabled,
        emailEnabled: updated.emailEnabled,
        whatsappEnabled: updated.whatsappEnabled,
        eventPreferences: updated.eventPreferences as Record<string, Record<string, boolean>>,
        reminderIntervals: updated.reminderIntervals as number[],
        quietHoursEnabled: updated.quietHoursEnabled,
        quietHoursStart: updated.quietHoursStart,
        quietHoursEnd: updated.quietHoursEnd,
        quietHoursTimezone: updated.quietHoursTimezone,
      },
      message: 'Preferencias guardadas correctamente',
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando preferencias' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/preferences
 */
export async function POST() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: defaultPreferences,
      message: 'Preferencias creadas',
    });
  } catch (error) {
    console.error('Create notification preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creando preferencias' },
      { status: 500 }
    );
  }
}
