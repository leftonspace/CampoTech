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

// Critical notifications that cannot be disabled
const criticalNotifications = [
  'verification.accountBlockedEmail',
  'subscription.paymentFailedEmail',
];

/**
 * GET /api/notifications/preferences
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

    return NextResponse.json({
      success: true,
      data: defaultPreferences,
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
      verification,
      subscription,
      eventPreferences,
      reminderIntervals,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      quietHoursTimezone,
    } = body;

    // Merge verification preferences (ensure critical ones stay enabled)
    const mergedVerification = {
      ...defaultPreferences.verification,
      ...(verification || {}),
      // Force critical notifications to stay enabled
      accountBlockedEmail: true,
    };

    // Merge subscription preferences (ensure critical ones stay enabled)
    const mergedSubscription = {
      ...defaultPreferences.subscription,
      ...(subscription || {}),
      // Force critical notifications to stay enabled
      paymentFailedEmail: true,
    };

    // Build updated preferences
    const updatedPreferences = {
      webEnabled: webEnabled ?? defaultPreferences.webEnabled,
      pushEnabled: pushEnabled ?? defaultPreferences.pushEnabled,
      smsEnabled: smsEnabled ?? defaultPreferences.smsEnabled,
      emailEnabled: emailEnabled ?? defaultPreferences.emailEnabled,
      whatsappEnabled: whatsappEnabled ?? defaultPreferences.whatsappEnabled,
      verification: mergedVerification,
      subscription: mergedSubscription,
      eventPreferences: eventPreferences ?? defaultPreferences.eventPreferences,
      reminderIntervals: reminderIntervals ?? defaultPreferences.reminderIntervals,
      quietHoursEnabled: quietHoursEnabled ?? defaultPreferences.quietHoursEnabled,
      quietHoursStart: quietHoursStart ?? defaultPreferences.quietHoursStart,
      quietHoursEnd: quietHoursEnd ?? defaultPreferences.quietHoursEnd,
      quietHoursTimezone: quietHoursTimezone ?? defaultPreferences.quietHoursTimezone,
    };

    // Note: In a full implementation, these would be stored per-user in the database
    // For now, we return success with the updated preferences
    // TODO: Add notificationPreferences field to User model and persist

    return NextResponse.json({
      success: true,
      data: updatedPreferences,
      message: 'Preferencias actualizadas correctamente',
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
export async function POST(request: NextRequest) {
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
