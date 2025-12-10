/**
 * Consumer Profile Repository
 * ===========================
 *
 * Data access layer for consumer profiles.
 * Phase 15: Consumer Marketplace
 */

import { Pool, PoolClient } from 'pg';
import {
  ConsumerProfile,
  CreateConsumerDTO,
  UpdateConsumerDTO,
  ConsumerPaginationParams,
  ConsumerPaginatedResult,
  SavedAddress,
  ConsumerContactPreference,
} from '../consumer.types';
import { objectToCamel, toSnakeCase } from '../../../shared/repositories/base.repository';

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsumerProfileRepository {
  constructor(private pool: Pool) {}

  /**
   * Find consumer by ID
   */
  async findById(id: string, client?: PoolClient): Promise<ConsumerProfile | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM consumer_profiles WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find consumer by phone
   */
  async findByPhone(phone: string, client?: PoolClient): Promise<ConsumerProfile | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM consumer_profiles WHERE phone = $1 AND deleted_at IS NULL`,
      [phone]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find consumer by email
   */
  async findByEmail(email: string, client?: PoolClient): Promise<ConsumerProfile | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM consumer_profiles WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find consumer by referral code
   */
  async findByReferralCode(code: string, client?: PoolClient): Promise<ConsumerProfile | null> {
    const conn = client || this.pool;
    const result = await conn.query(
      `SELECT * FROM consumer_profiles WHERE referral_code = $1 AND deleted_at IS NULL`,
      [code.toUpperCase()]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Create a new consumer
   */
  async create(data: CreateConsumerDTO, client?: PoolClient): Promise<ConsumerProfile> {
    const conn = client || this.pool;

    // Handle referral
    let referredById: string | null = null;
    if (data.referralCode) {
      const referrer = await this.findByReferralCode(data.referralCode, client);
      if (referrer) {
        referredById = referrer.id;
        // Increment referrer's count
        await conn.query(
          `UPDATE consumer_profiles SET referral_count = referral_count + 1 WHERE id = $1`,
          [referrer.id]
        );
      }
    }

    const result = await conn.query(
      `INSERT INTO consumer_profiles (
        phone, first_name, last_name, email,
        default_address, city, province, neighborhood,
        referred_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.phone,
        data.firstName,
        data.lastName || null,
        data.email || null,
        data.defaultAddress || null,
        data.city || 'Buenos Aires',
        data.province || 'CABA',
        data.neighborhood || null,
        referredById,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Update consumer profile
   */
  async update(id: string, data: UpdateConsumerDTO, client?: PoolClient): Promise<ConsumerProfile | null> {
    const conn = client || this.pool;

    const fields: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    const fieldMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      profilePhotoUrl: 'profile_photo_url',
      bio: 'bio',
      defaultAddress: 'default_address',
      defaultAddressExtra: 'default_address_extra',
      defaultLat: 'default_lat',
      defaultLng: 'default_lng',
      neighborhood: 'neighborhood',
      city: 'city',
      province: 'province',
      postalCode: 'postal_code',
      preferredContact: 'preferred_contact',
      language: 'language',
      pushNotificationsEnabled: 'push_notifications_enabled',
      emailNotificationsEnabled: 'email_notifications_enabled',
      smsNotificationsEnabled: 'sms_notifications_enabled',
      profileVisibility: 'profile_visibility',
      showLastName: 'show_last_name',
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && fieldMap[key]) {
        fields.push(`${fieldMap[key]} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return this.findById(id, client);
    }

    const result = await conn.query(
      `UPDATE consumer_profiles
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update phone verified status
   */
  async setPhoneVerified(id: string, verified: boolean, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles SET phone_verified = $2, updated_at = NOW() WHERE id = $1`,
      [id, verified]
    );
  }

  /**
   * Update email verified status
   */
  async setEmailVerified(id: string, verified: boolean, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles SET email_verified = $2, updated_at = NOW() WHERE id = $1`,
      [id, verified]
    );
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(id: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles SET last_active_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  /**
   * Update last known location
   */
  async updateLastLocation(id: string, lat: number, lng: number, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles
       SET last_known_lat = $2, last_known_lng = $3, last_location_update = NOW()
       WHERE id = $1`,
      [id, lat, lng]
    );
  }

  /**
   * Add FCM token
   */
  async addFcmToken(id: string, token: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles
       SET fcm_tokens = CASE
         WHEN fcm_tokens @> $2::jsonb THEN fcm_tokens
         ELSE fcm_tokens || $2::jsonb
       END
       WHERE id = $1`,
      [id, JSON.stringify([token])]
    );
  }

  /**
   * Remove FCM token
   */
  async removeFcmToken(id: string, token: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles
       SET fcm_tokens = fcm_tokens - $2
       WHERE id = $1`,
      [id, token]
    );
  }

  /**
   * Update saved addresses
   */
  async updateSavedAddresses(id: string, addresses: SavedAddress[], client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles SET saved_addresses = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [id, JSON.stringify(addresses)]
    );
  }

  /**
   * Increment request count
   */
  async incrementRequestCount(id: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles SET total_requests = total_requests + 1 WHERE id = $1`,
      [id]
    );
  }

  /**
   * Increment completed jobs count
   */
  async incrementCompletedJobs(id: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles SET total_jobs_completed = total_jobs_completed + 1 WHERE id = $1`,
      [id]
    );
  }

  /**
   * Increment reviews given count
   */
  async incrementReviewsGiven(id: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles SET total_reviews_given = total_reviews_given + 1 WHERE id = $1`,
      [id]
    );
  }

  /**
   * Update average rating given
   */
  async updateAverageRatingGiven(id: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles cp
       SET average_rating_given = (
         SELECT ROUND(AVG(overall_rating)::numeric, 1)
         FROM consumer_reviews cr
         WHERE cr.consumer_id = cp.id
       )
       WHERE cp.id = $1`,
      [id]
    );
  }

  /**
   * Suspend consumer
   */
  async suspend(id: string, reason: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles
       SET is_suspended = true, suspension_reason = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, reason]
    );
  }

  /**
   * Unsuspend consumer
   */
  async unsuspend(id: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles
       SET is_suspended = false, suspension_reason = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Soft delete consumer
   */
  async softDelete(id: string, client?: PoolClient): Promise<void> {
    const conn = client || this.pool;
    await conn.query(
      `UPDATE consumer_profiles SET deleted_at = NOW(), is_active = false WHERE id = $1`,
      [id]
    );
  }

  /**
   * Get consumers with pagination
   */
  async findPaginated(
    params: { city?: string; isActive?: boolean },
    pagination: ConsumerPaginationParams,
    client?: PoolClient
  ): Promise<ConsumerPaginatedResult<ConsumerProfile>> {
    const conn = client || this.pool;
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE deleted_at IS NULL';
    const values: any[] = [];
    let paramIndex = 1;

    if (params.city) {
      whereClause += ` AND city = $${paramIndex}`;
      values.push(params.city);
      paramIndex++;
    }

    if (params.isActive !== undefined) {
      whereClause += ` AND is_active = $${paramIndex}`;
      values.push(params.isActive);
      paramIndex++;
    }

    // Count
    const countResult = await conn.query(
      `SELECT COUNT(*) FROM consumer_profiles ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get data
    const sortBy = pagination.sortBy === 'createdAt' ? 'created_at' : 'last_active_at';
    const sortOrder = pagination.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const result = await conn.query(
      `SELECT * FROM consumer_profiles ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      data: result.rows.map(row => this.mapRow(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get referral stats
   */
  async getReferralStats(id: string, client?: PoolClient): Promise<{
    referralCode: string;
    referralCount: number;
    referredBy?: string;
    referrals: { id: string; firstName: string; createdAt: Date }[];
  }> {
    const conn = client || this.pool;

    const consumer = await this.findById(id, client);
    if (!consumer) {
      throw new Error('Consumer not found');
    }

    const referralsResult = await conn.query(
      `SELECT id, first_name, created_at
       FROM consumer_profiles
       WHERE referred_by = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 50`,
      [id]
    );

    return {
      referralCode: consumer.referralCode,
      referralCount: consumer.referralCount,
      referredBy: consumer.referredBy,
      referrals: referralsResult.rows.map(row => ({
        id: row.id,
        firstName: row.first_name,
        createdAt: row.created_at,
      })),
    };
  }

  /**
   * Map database row to ConsumerProfile
   */
  private mapRow(row: Record<string, any>): ConsumerProfile {
    return {
      id: row.id,
      phone: row.phone,
      phoneVerified: row.phone_verified,
      email: row.email,
      emailVerified: row.email_verified,
      firstName: row.first_name,
      lastName: row.last_name,
      profilePhotoUrl: row.profile_photo_url,
      bio: row.bio,
      defaultAddress: row.default_address,
      defaultAddressExtra: row.default_address_extra,
      defaultLat: row.default_lat ? parseFloat(row.default_lat) : undefined,
      defaultLng: row.default_lng ? parseFloat(row.default_lng) : undefined,
      neighborhood: row.neighborhood,
      city: row.city,
      province: row.province,
      postalCode: row.postal_code,
      savedAddresses: row.saved_addresses || [],
      preferredContact: row.preferred_contact as ConsumerContactPreference,
      language: row.language,
      pushNotificationsEnabled: row.push_notifications_enabled,
      emailNotificationsEnabled: row.email_notifications_enabled,
      smsNotificationsEnabled: row.sms_notifications_enabled,
      profileVisibility: row.profile_visibility,
      showLastName: row.show_last_name,
      totalRequests: row.total_requests,
      totalJobsCompleted: row.total_jobs_completed,
      totalReviewsGiven: row.total_reviews_given,
      averageRatingGiven: row.average_rating_given ? parseFloat(row.average_rating_given) : undefined,
      referralCode: row.referral_code,
      referredBy: row.referred_by,
      referralCount: row.referral_count,
      isActive: row.is_active,
      isSuspended: row.is_suspended,
      suspensionReason: row.suspension_reason,
      fcmTokens: row.fcm_tokens || [],
      lastKnownLat: row.last_known_lat ? parseFloat(row.last_known_lat) : undefined,
      lastKnownLng: row.last_known_lng ? parseFloat(row.last_known_lng) : undefined,
      lastLocationUpdate: row.last_location_update,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastActiveAt: row.last_active_at,
      deletedAt: row.deleted_at,
    };
  }
}
