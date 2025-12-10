/**
 * Referral Service
 * ================
 *
 * Consumer referral system for marketplace growth.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReferralCode {
  code: string;
  consumerId: string;
  usageCount: number;
  totalRewards: number;
  createdAt: Date;
}

export interface ReferralReward {
  type: 'referrer' | 'referee';
  status: 'pending' | 'earned' | 'paid';
  amount: number;
  reason: string;
  earnedAt: Date | null;
  paidAt: Date | null;
}

export interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  pendingRewards: number;
  earnedRewards: number;
  paidRewards: number;
  conversionRate: number;
}

export interface ReferralProgram {
  referrerReward: number;
  refereeReward: number;
  minJobsForReward: number;
  maxReferralsPerMonth: number;
  rewardType: 'credit' | 'cash';
}

// Default program configuration
const DEFAULT_PROGRAM: ReferralProgram = {
  referrerReward: 500, // ARS
  refereeReward: 300, // ARS discount
  minJobsForReward: 1, // Must complete at least 1 job
  maxReferralsPerMonth: 10,
  rewardType: 'credit',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ReferralService {
  private program: ReferralProgram = DEFAULT_PROGRAM;

  constructor(private pool: Pool) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // REFERRAL CODE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get or create referral code for a consumer
   */
  async getOrCreateReferralCode(consumerId: string): Promise<ReferralCode> {
    // Check existing
    const existing = await this.pool.query<{
      code: string;
      consumer_id: string;
      usage_count: number;
      total_rewards: number;
      created_at: Date;
    }>(
      `SELECT * FROM consumer.referral_codes WHERE consumer_id = $1`,
      [consumerId]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return {
        code: row.code,
        consumerId: row.consumer_id,
        usageCount: row.usage_count,
        totalRewards: row.total_rewards,
        createdAt: row.created_at,
      };
    }

    // Generate new code
    const code = this.generateReferralCode();

    const result = await this.pool.query<{
      code: string;
      consumer_id: string;
      usage_count: number;
      total_rewards: number;
      created_at: Date;
    }>(
      `INSERT INTO consumer.referral_codes (code, consumer_id, usage_count, total_rewards)
       VALUES ($1, $2, 0, 0)
       RETURNING *`,
      [code, consumerId]
    );

    const row = result.rows[0];
    return {
      code: row.code,
      consumerId: row.consumer_id,
      usageCount: row.usage_count,
      totalRewards: row.total_rewards,
      createdAt: row.created_at,
    };
  }

  /**
   * Apply referral code during signup
   */
  async applyReferralCode(
    newConsumerId: string,
    referralCode: string
  ): Promise<{ success: boolean; reward?: number; error?: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Validate code
      const codeResult = await client.query<{
        consumer_id: string;
        usage_count: number;
      }>(
        `SELECT consumer_id, usage_count FROM consumer.referral_codes WHERE code = $1`,
        [referralCode.toUpperCase()]
      );

      if (codeResult.rows.length === 0) {
        return { success: false, error: 'Código de referido inválido' };
      }

      const referrerId = codeResult.rows[0].consumer_id;

      // Check if same person
      if (referrerId === newConsumerId) {
        return { success: false, error: 'No puedes usar tu propio código' };
      }

      // Check if already used a referral code
      const alreadyUsed = await client.query(
        `SELECT id FROM consumer.referral_uses
         WHERE referee_id = $1`,
        [newConsumerId]
      );

      if (alreadyUsed.rows.length > 0) {
        return { success: false, error: 'Ya usaste un código de referido' };
      }

      // Check monthly limit for referrer
      const monthlyCount = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM consumer.referral_uses
         WHERE referrer_id = $1
         AND used_at >= date_trunc('month', NOW())`,
        [referrerId]
      );

      if (parseInt(monthlyCount.rows[0].count, 10) >= this.program.maxReferralsPerMonth) {
        return {
          success: false,
          error: 'El usuario que te refirió alcanzó su límite mensual',
        };
      }

      // Record the referral use
      await client.query(
        `INSERT INTO consumer.referral_uses (referrer_id, referee_id, referral_code, status)
         VALUES ($1, $2, $3, 'pending')`,
        [referrerId, newConsumerId, referralCode.toUpperCase()]
      );

      // Update usage count
      await client.query(
        `UPDATE consumer.referral_codes SET usage_count = usage_count + 1 WHERE code = $1`,
        [referralCode.toUpperCase()]
      );

      // Create pending reward for referee (discount on first job)
      await client.query(
        `INSERT INTO consumer.referral_rewards (consumer_id, type, amount, status, reason)
         VALUES ($1, 'referee', $2, 'pending', 'Descuento por registro con código de referido')`,
        [newConsumerId, this.program.refereeReward]
      );

      await client.query('COMMIT');

      return {
        success: true,
        reward: this.program.refereeReward,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REWARD PROCESSING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Process rewards when referee completes first job
   */
  async processJobCompletion(consumerId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if this consumer was referred and reward is pending
      const referralUse = await client.query<{
        id: string;
        referrer_id: string;
        status: string;
      }>(
        `SELECT id, referrer_id, status FROM consumer.referral_uses
         WHERE referee_id = $1 AND status = 'pending'`,
        [consumerId]
      );

      if (referralUse.rows.length === 0) {
        await client.query('COMMIT');
        return;
      }

      const referrerId = referralUse.rows[0].referrer_id;
      const referralUseId = referralUse.rows[0].id;

      // Count completed jobs for this consumer
      const jobCount = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM consumer.service_requests
         WHERE consumer_id = $1 AND status = 'completed'`,
        [consumerId]
      );

      if (parseInt(jobCount.rows[0].count, 10) < this.program.minJobsForReward) {
        await client.query('COMMIT');
        return;
      }

      // Update referral use status
      await client.query(
        `UPDATE consumer.referral_uses SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [referralUseId]
      );

      // Mark referee reward as earned
      await client.query(
        `UPDATE consumer.referral_rewards
         SET status = 'earned', earned_at = NOW()
         WHERE consumer_id = $1 AND type = 'referee' AND status = 'pending'`,
        [consumerId]
      );

      // Create reward for referrer
      await client.query(
        `INSERT INTO consumer.referral_rewards (consumer_id, type, amount, status, reason, earned_at)
         VALUES ($1, 'referrer', $2, 'earned', 'Recompensa por referido exitoso', NOW())`,
        [referrerId, this.program.referrerReward]
      );

      // Update referrer's total rewards
      await client.query(
        `UPDATE consumer.referral_codes
         SET total_rewards = total_rewards + $1
         WHERE consumer_id = $2`,
        [this.program.referrerReward, referrerId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATS AND HISTORY
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get referral statistics for a consumer
   */
  async getReferralStats(consumerId: string): Promise<ReferralStats> {
    const result = await this.pool.query<{
      total_referrals: string;
      successful_referrals: string;
      pending_rewards: string;
      earned_rewards: string;
      paid_rewards: string;
    }>(
      `WITH stats AS (
        SELECT
          (SELECT COUNT(*) FROM consumer.referral_uses WHERE referrer_id = $1) as total_referrals,
          (SELECT COUNT(*) FROM consumer.referral_uses WHERE referrer_id = $1 AND status = 'completed') as successful_referrals,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_rewards,
          COALESCE(SUM(CASE WHEN status = 'earned' THEN amount ELSE 0 END), 0) as earned_rewards,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_rewards
        FROM consumer.referral_rewards
        WHERE consumer_id = $1
      )
      SELECT * FROM stats`,
      [consumerId]
    );

    const data = result.rows[0];
    const totalReferrals = parseInt(data.total_referrals, 10);
    const successfulReferrals = parseInt(data.successful_referrals, 10);

    return {
      totalReferrals,
      successfulReferrals,
      pendingRewards: parseFloat(data.pending_rewards),
      earnedRewards: parseFloat(data.earned_rewards),
      paidRewards: parseFloat(data.paid_rewards),
      conversionRate: totalReferrals > 0 ? (successfulReferrals / totalReferrals) * 100 : 0,
    };
  }

  /**
   * Get referral history for a consumer
   */
  async getReferralHistory(consumerId: string): Promise<Array<{
    type: 'sent' | 'received';
    displayName: string | null;
    status: string;
    reward: number | null;
    date: Date;
  }>> {
    const result = await this.pool.query<{
      type: 'sent' | 'received';
      display_name: string | null;
      status: string;
      reward: number | null;
      date: Date;
    }>(
      `SELECT
        'sent' as type,
        cp.display_name,
        ru.status,
        (SELECT amount FROM consumer.referral_rewards WHERE consumer_id = ru.referrer_id AND type = 'referrer' AND earned_at > ru.used_at LIMIT 1) as reward,
        ru.used_at as date
       FROM consumer.referral_uses ru
       JOIN consumer.consumer_profiles cp ON cp.id = ru.referee_id
       WHERE ru.referrer_id = $1

       UNION ALL

       SELECT
        'received' as type,
        cp.display_name,
        ru.status,
        (SELECT amount FROM consumer.referral_rewards WHERE consumer_id = ru.referee_id AND type = 'referee' LIMIT 1) as reward,
        ru.used_at as date
       FROM consumer.referral_uses ru
       JOIN consumer.consumer_profiles cp ON cp.id = ru.referrer_id
       WHERE ru.referee_id = $1

       ORDER BY date DESC`,
      [consumerId]
    );

    return result.rows.map((row) => ({
      type: row.type,
      displayName: row.display_name,
      status: row.status,
      reward: row.reward,
      date: row.date,
    }));
  }

  /**
   * Get pending credit balance
   */
  async getCreditBalance(consumerId: string): Promise<number> {
    const result = await this.pool.query<{ balance: string }>(
      `SELECT COALESCE(SUM(amount), 0) as balance
       FROM consumer.referral_rewards
       WHERE consumer_id = $1 AND status = 'earned'`,
      [consumerId]
    );

    return parseFloat(result.rows[0].balance);
  }

  /**
   * Use credit for a job
   */
  async useCredit(consumerId: string, amount: number): Promise<boolean> {
    const balance = await this.getCreditBalance(consumerId);
    if (balance < amount) return false;

    // Mark rewards as used (paid)
    await this.pool.query(
      `UPDATE consumer.referral_rewards
       SET status = 'paid', paid_at = NOW()
       WHERE consumer_id = $1 AND status = 'earned'
       AND id IN (
         SELECT id FROM consumer.referral_rewards
         WHERE consumer_id = $1 AND status = 'earned'
         ORDER BY earned_at
         LIMIT (
           SELECT COUNT(*) FROM consumer.referral_rewards
           WHERE consumer_id = $1 AND status = 'earned'
         )
       )`,
      [consumerId]
    );

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SHARE LINK GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get shareable referral link
   */
  async getShareLink(consumerId: string): Promise<{
    link: string;
    code: string;
    message: string;
  }> {
    const referralCode = await this.getOrCreateReferralCode(consumerId);

    const baseUrl = process.env.APP_URL || 'https://campotech.com.ar';
    const link = `${baseUrl}/registro?ref=${referralCode.code}`;

    const message = `¡Te invito a usar CampoTech! Encuentra los mejores profesionales para tu hogar. Usa mi código ${referralCode.code} y obtené $${this.program.refereeReward} de descuento en tu primer servicio. ${link}`;

    return {
      link,
      code: referralCode.code,
      message,
    };
  }

  /**
   * Get program details for display
   */
  getProgramDetails(): {
    referrerReward: number;
    refereeReward: number;
    conditions: string[];
  } {
    return {
      referrerReward: this.program.referrerReward,
      refereeReward: this.program.refereeReward,
      conditions: [
        `Tu amigo obtiene $${this.program.refereeReward} de descuento en su primer servicio`,
        `Vos recibís $${this.program.referrerReward} cuando completen su primer trabajo`,
        `Podés referir hasta ${this.program.maxReferralsPerMonth} amigos por mes`,
        'Los créditos no vencen y se pueden usar en cualquier servicio',
      ],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(crypto.randomInt(chars.length));
    }
    return code;
  }
}
