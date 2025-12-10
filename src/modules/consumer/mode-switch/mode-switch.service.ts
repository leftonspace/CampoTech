/**
 * Mode Switch Service
 * ===================
 *
 * Handles dual profile detection and mode switching.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AppMode = 'consumer' | 'business';

export interface DualProfileInfo {
  hasConsumerProfile: boolean;
  hasBusinessProfile: boolean;
  consumerProfile: ConsumerProfileSummary | null;
  businessProfile: BusinessProfileSummary | null;
  canSwitch: boolean;
  currentMode: AppMode;
}

export interface ConsumerProfileSummary {
  id: string;
  phone: string;
  displayName: string | null;
  profilePhotoUrl: string | null;
  totalRequests: number;
  activeRequests: number;
}

export interface BusinessProfileSummary {
  id: string;
  displayName: string;
  logoUrl: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  overallRating: number;
  pendingLeads: number;
}

export interface ModePreference {
  userId: string;
  preferredMode: AppMode;
  lastSwitchedAt: Date;
  autoSwitchEnabled: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ModeSwitchService {
  constructor(private pool: Pool) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // DUAL PROFILE DETECTION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a user has both consumer and business profiles
   */
  async checkDualProfile(
    phoneNumber: string,
    currentMode: AppMode = 'consumer'
  ): Promise<DualProfileInfo> {
    const client = await this.pool.connect();

    try {
      // Check consumer profile
      const consumerResult = await client.query<{
        id: string;
        phone: string;
        display_name: string | null;
        profile_photo_url: string | null;
        total_requests: string;
        active_requests: string;
      }>(
        `SELECT
          cp.id,
          cp.phone,
          cp.display_name,
          cp.profile_photo_url,
          COALESCE(
            (SELECT COUNT(*) FROM consumer.service_requests sr WHERE sr.consumer_id = cp.id),
            0
          ) as total_requests,
          COALESCE(
            (SELECT COUNT(*) FROM consumer.service_requests sr
             WHERE sr.consumer_id = cp.id AND sr.status IN ('open', 'quotes_received', 'accepted', 'in_progress')),
            0
          ) as active_requests
        FROM consumer.consumer_profiles cp
        WHERE cp.phone = $1`,
        [this.normalizePhone(phoneNumber)]
      );

      const consumerProfile = consumerResult.rows[0]
        ? {
            id: consumerResult.rows[0].id,
            phone: consumerResult.rows[0].phone,
            displayName: consumerResult.rows[0].display_name,
            profilePhotoUrl: consumerResult.rows[0].profile_photo_url,
            totalRequests: parseInt(consumerResult.rows[0].total_requests, 10),
            activeRequests: parseInt(consumerResult.rows[0].active_requests, 10),
          }
        : null;

      // Check business profile by phone
      const businessResult = await client.query<{
        id: string;
        display_name: string;
        logo_url: string | null;
        subscription_plan: string;
        subscription_status: string;
        overall_rating: number;
        pending_leads: string;
      }>(
        `SELECT
          bp.id,
          bp.display_name,
          bp.logo_url,
          COALESCE(o.subscription_plan, 'free') as subscription_plan,
          COALESCE(o.subscription_status, 'inactive') as subscription_status,
          COALESCE(bpp.overall_rating, 0) as overall_rating,
          COALESCE(
            (SELECT COUNT(*) FROM consumer.quotes q
             JOIN consumer.service_requests sr ON q.service_request_id = sr.id
             WHERE q.business_profile_id = bp.id AND q.status = 'pending'),
            0
          ) as pending_leads
        FROM business_profiles bp
        JOIN organizations o ON bp.organization_id = o.id
        LEFT JOIN consumer.business_public_profiles bpp ON bpp.business_profile_id = bp.id
        WHERE bp.phone = $1 OR bp.owner_phone = $1
        LIMIT 1`,
        [this.normalizePhone(phoneNumber)]
      );

      const businessProfile = businessResult.rows[0]
        ? {
            id: businessResult.rows[0].id,
            displayName: businessResult.rows[0].display_name,
            logoUrl: businessResult.rows[0].logo_url,
            subscriptionPlan: businessResult.rows[0].subscription_plan,
            subscriptionStatus: businessResult.rows[0].subscription_status,
            overallRating: businessResult.rows[0].overall_rating,
            pendingLeads: parseInt(businessResult.rows[0].pending_leads, 10),
          }
        : null;

      return {
        hasConsumerProfile: !!consumerProfile,
        hasBusinessProfile: !!businessProfile,
        consumerProfile,
        businessProfile,
        canSwitch: !!consumerProfile && !!businessProfile,
        currentMode,
      };
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODE PREFERENCE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get user's mode preference
   */
  async getModePreference(phoneNumber: string): Promise<ModePreference | null> {
    const result = await this.pool.query<{
      user_id: string;
      preferred_mode: AppMode;
      last_switched_at: Date;
      auto_switch_enabled: boolean;
    }>(
      `SELECT user_id, preferred_mode, last_switched_at, auto_switch_enabled
       FROM consumer.mode_preferences
       WHERE phone = $1`,
      [this.normalizePhone(phoneNumber)]
    );

    if (result.rows.length === 0) return null;

    return {
      userId: result.rows[0].user_id,
      preferredMode: result.rows[0].preferred_mode,
      lastSwitchedAt: result.rows[0].last_switched_at,
      autoSwitchEnabled: result.rows[0].auto_switch_enabled,
    };
  }

  /**
   * Save user's mode preference
   */
  async saveModePreference(
    phoneNumber: string,
    mode: AppMode,
    autoSwitch: boolean = false
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO consumer.mode_preferences (phone, preferred_mode, last_switched_at, auto_switch_enabled)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (phone) DO UPDATE SET
         preferred_mode = $2,
         last_switched_at = NOW(),
         auto_switch_enabled = $3`,
      [this.normalizePhone(phoneNumber), mode, autoSwitch]
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SWITCH MODE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Switch between consumer and business modes
   */
  async switchMode(
    phoneNumber: string,
    targetMode: AppMode
  ): Promise<{ success: boolean; token?: string; profile?: ConsumerProfileSummary | BusinessProfileSummary }> {
    const dualProfile = await this.checkDualProfile(phoneNumber, targetMode);

    if (!dualProfile.canSwitch) {
      return { success: false };
    }

    // Save the preference
    await this.saveModePreference(phoneNumber, targetMode);

    // Log the switch
    await this.logModeSwitch(phoneNumber, targetMode);

    // Return the appropriate profile
    const profile =
      targetMode === 'consumer'
        ? dualProfile.consumerProfile
        : dualProfile.businessProfile;

    return {
      success: true,
      profile: profile || undefined,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LINK PROFILES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Link a consumer profile to a business profile
   */
  async linkProfiles(
    consumerId: string,
    businessProfileId: string
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      // Verify both profiles exist
      const consumerCheck = await client.query(
        'SELECT phone FROM consumer.consumer_profiles WHERE id = $1',
        [consumerId]
      );

      const businessCheck = await client.query(
        'SELECT phone, owner_phone FROM business_profiles WHERE id = $1',
        [businessProfileId]
      );

      if (consumerCheck.rows.length === 0 || businessCheck.rows.length === 0) {
        return false;
      }

      // Update business profile with owner phone if not set
      if (!businessCheck.rows[0].owner_phone) {
        await client.query(
          'UPDATE business_profiles SET owner_phone = $1 WHERE id = $2',
          [consumerCheck.rows[0].phone, businessProfileId]
        );
      }

      // Create link record
      await client.query(
        `INSERT INTO consumer.profile_links (consumer_id, business_profile_id, linked_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (consumer_id, business_profile_id) DO NOTHING`,
        [consumerId, businessProfileId]
      );

      return true;
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UPSELL: CONSUMER TO BUSINESS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if consumer should be shown business upsell
   */
  async shouldShowBusinessUpsell(consumerId: string): Promise<{
    show: boolean;
    reason?: string;
  }> {
    const result = await this.pool.query<{
      total_requests: string;
      has_business_profile: boolean;
      last_upsell_shown: Date | null;
    }>(
      `SELECT
        COALESCE(
          (SELECT COUNT(*) FROM consumer.service_requests WHERE consumer_id = $1),
          0
        ) as total_requests,
        EXISTS(
          SELECT 1 FROM business_profiles bp
          JOIN consumer.consumer_profiles cp ON bp.owner_phone = cp.phone
          WHERE cp.id = $1
        ) as has_business_profile,
        (SELECT shown_at FROM consumer.upsell_shown WHERE consumer_id = $1 AND type = 'business' ORDER BY shown_at DESC LIMIT 1) as last_upsell_shown`,
      [consumerId]
    );

    const data = result.rows[0];

    // Don't show if already has business profile
    if (data.has_business_profile) {
      return { show: false };
    }

    // Don't show if shown in last 7 days
    if (data.last_upsell_shown) {
      const daysSinceShown =
        (Date.now() - new Date(data.last_upsell_shown).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceShown < 7) {
        return { show: false };
      }
    }

    // Show if has made several requests (might be a professional)
    const totalRequests = parseInt(data.total_requests, 10);
    if (totalRequests >= 3) {
      return {
        show: true,
        reason: 'frequent_user',
      };
    }

    return { show: false };
  }

  /**
   * Record that upsell was shown
   */
  async recordUpsellShown(
    consumerId: string,
    type: 'business' | 'subscription'
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO consumer.upsell_shown (consumer_id, type, shown_at)
       VALUES ($1, $2, NOW())`,
      [consumerId, type]
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ANALYTICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Log mode switch for analytics
   */
  private async logModeSwitch(
    phoneNumber: string,
    targetMode: AppMode
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO consumer.mode_switch_logs (phone, target_mode, switched_at)
       VALUES ($1, $2, NOW())`,
      [this.normalizePhone(phoneNumber), targetMode]
    );
  }

  /**
   * Get mode switch analytics
   */
  async getModeSwitchAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSwitches: number;
    uniqueUsers: number;
    consumerToBusinessCount: number;
    businessToConsumerCount: number;
    avgSwitchesPerUser: number;
  }> {
    const result = await this.pool.query<{
      total_switches: string;
      unique_users: string;
      c_to_b: string;
      b_to_c: string;
    }>(
      `SELECT
        COUNT(*) as total_switches,
        COUNT(DISTINCT phone) as unique_users,
        SUM(CASE WHEN target_mode = 'business' THEN 1 ELSE 0 END) as c_to_b,
        SUM(CASE WHEN target_mode = 'consumer' THEN 1 ELSE 0 END) as b_to_c
       FROM consumer.mode_switch_logs
       WHERE switched_at BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    const data = result.rows[0];
    const totalSwitches = parseInt(data.total_switches, 10);
    const uniqueUsers = parseInt(data.unique_users, 10);

    return {
      totalSwitches,
      uniqueUsers,
      consumerToBusinessCount: parseInt(data.c_to_b, 10),
      businessToConsumerCount: parseInt(data.b_to_c, 10),
      avgSwitchesPerUser: uniqueUsers > 0 ? totalSwitches / uniqueUsers : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }
}
