/**
 * Admin Alert Preferences API
 * ===========================
 *
 * GET /api/admin/alerts/preferences - Get admin's alert preferences
 * PUT /api/admin/alerts/preferences - Update alert preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { AdminAlertPreferences, AdminAlertType } from '@/types';

// Default preferences for new admins
const DEFAULT_PREFERENCES: Omit<AdminAlertPreferences, 'adminId'> = {
  emailEnabled: true,
  emailDigestFrequency: 'daily',
  inAppEnabled: true,
  alertTypes: {
    new_subscription_payment: { email: false, inApp: true },
    failed_payment: { email: true, inApp: true },
    new_verification_submission: { email: false, inApp: true },
    document_expired: { email: true, inApp: true },
    organization_blocked: { email: true, inApp: true },
    subscription_cancelled: { email: true, inApp: true },
    verification_approved: { email: false, inApp: false },
    verification_rejected: { email: false, inApp: true },
  },
};

// In-memory storage for demo (in production, use database)
const adminPreferences: Map<string, AdminAlertPreferences> = new Map();

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create preferences for this admin
    let preferences = adminPreferences.get(session.id);
    if (!preferences) {
      preferences = {
        adminId: session.id,
        ...DEFAULT_PREFERENCES,
      };
      adminPreferences.set(session.id, preferences);
    }

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('Get alert preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      emailEnabled,
      emailDigestFrequency,
      inAppEnabled,
      alertTypes,
    } = body;

    // Validate input
    if (emailDigestFrequency && !['immediate', 'daily', 'weekly', 'never'].includes(emailDigestFrequency)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email digest frequency' },
        { status: 400 }
      );
    }

    // Get existing or create new preferences
    let preferences = adminPreferences.get(session.id);
    if (!preferences) {
      preferences = {
        adminId: session.id,
        ...DEFAULT_PREFERENCES,
      };
    }

    // Update preferences
    if (typeof emailEnabled === 'boolean') {
      preferences.emailEnabled = emailEnabled;
    }
    if (emailDigestFrequency) {
      preferences.emailDigestFrequency = emailDigestFrequency;
    }
    if (typeof inAppEnabled === 'boolean') {
      preferences.inAppEnabled = inAppEnabled;
    }
    if (alertTypes) {
      // Merge alert type preferences
      for (const [type, settings] of Object.entries(alertTypes)) {
        if (preferences.alertTypes[type as AdminAlertType]) {
          preferences.alertTypes[type as AdminAlertType] = {
            ...preferences.alertTypes[type as AdminAlertType],
            ...(settings as { email?: boolean; inApp?: boolean }),
          };
        }
      }
    }

    adminPreferences.set(session.id, preferences);

    return NextResponse.json({
      success: true,
      data: preferences,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('Update alert preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating preferences' },
      { status: 500 }
    );
  }
}
