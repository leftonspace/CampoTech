/**
 * Consumer Profile Service
 * ========================
 *
 * Business logic for consumer profile management.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';
import {
  ConsumerProfile,
  CreateConsumerDTO,
  UpdateConsumerDTO,
  SavedAddress,
  ConsumerPaginationParams,
  ConsumerPaginatedResult,
} from '../consumer.types';
import { ConsumerProfileRepository } from './consumer-profile.repository';

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsumerProfileError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.name = 'ConsumerProfileError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsumerProfileService {
  private repo: ConsumerProfileRepository;

  constructor(pool: Pool) {
    this.repo = new ConsumerProfileRepository(pool);
  }

  /**
   * Get consumer by ID
   */
  async getById(id: string): Promise<ConsumerProfile> {
    const consumer = await this.repo.findById(id);
    if (!consumer) {
      throw new ConsumerProfileError('CONSUMER_NOT_FOUND', 'Consumer not found', 404);
    }
    return consumer;
  }

  /**
   * Get consumer by phone
   */
  async getByPhone(phone: string): Promise<ConsumerProfile | null> {
    return this.repo.findByPhone(phone);
  }

  /**
   * Get consumer by email
   */
  async getByEmail(email: string): Promise<ConsumerProfile | null> {
    return this.repo.findByEmail(email);
  }

  /**
   * Create a new consumer
   */
  async create(data: CreateConsumerDTO): Promise<ConsumerProfile> {
    // Check for duplicate phone
    const existingByPhone = await this.repo.findByPhone(data.phone);
    if (existingByPhone) {
      throw new ConsumerProfileError(
        'PHONE_EXISTS',
        'A consumer with this phone number already exists'
      );
    }

    // Check for duplicate email if provided
    if (data.email) {
      const existingByEmail = await this.repo.findByEmail(data.email);
      if (existingByEmail) {
        throw new ConsumerProfileError(
          'EMAIL_EXISTS',
          'A consumer with this email already exists'
        );
      }
    }

    return this.repo.create(data);
  }

  /**
   * Update consumer profile
   */
  async update(id: string, data: UpdateConsumerDTO): Promise<ConsumerProfile> {
    // Verify consumer exists
    const existing = await this.getById(id);

    // Check email uniqueness if changing
    if (data.email && data.email !== existing.email) {
      const existingByEmail = await this.repo.findByEmail(data.email);
      if (existingByEmail && existingByEmail.id !== id) {
        throw new ConsumerProfileError(
          'EMAIL_EXISTS',
          'This email is already in use'
        );
      }
    }

    const updated = await this.repo.update(id, data);
    if (!updated) {
      throw new ConsumerProfileError('UPDATE_FAILED', 'Failed to update profile');
    }

    return updated;
  }

  /**
   * Update profile photo
   */
  async updateProfilePhoto(id: string, photoUrl: string): Promise<ConsumerProfile> {
    return this.update(id, { profilePhotoUrl: photoUrl });
  }

  /**
   * Update last known location
   */
  async updateLocation(id: string, lat: number, lng: number): Promise<void> {
    await this.repo.updateLastLocation(id, lat, lng);
  }

  /**
   * Add FCM token for push notifications
   */
  async addFcmToken(id: string, token: string): Promise<void> {
    await this.repo.addFcmToken(id, token);
  }

  /**
   * Remove FCM token
   */
  async removeFcmToken(id: string, token: string): Promise<void> {
    await this.repo.removeFcmToken(id, token);
  }

  /**
   * Get saved addresses
   */
  async getSavedAddresses(id: string): Promise<SavedAddress[]> {
    const consumer = await this.getById(id);
    return consumer.savedAddresses;
  }

  /**
   * Add saved address
   */
  async addSavedAddress(id: string, address: Omit<SavedAddress, 'id'>): Promise<SavedAddress[]> {
    const consumer = await this.getById(id);
    const addresses = [...consumer.savedAddresses];

    // Generate ID for new address
    const newAddress: SavedAddress = {
      ...address,
      id: crypto.randomUUID(),
    };

    // If setting as default, unset others
    if (newAddress.isDefault) {
      addresses.forEach(a => (a.isDefault = false));
    }

    addresses.push(newAddress);
    await this.repo.updateSavedAddresses(id, addresses);

    return addresses;
  }

  /**
   * Update saved address
   */
  async updateSavedAddress(
    id: string,
    addressId: string,
    updates: Partial<SavedAddress>
  ): Promise<SavedAddress[]> {
    const consumer = await this.getById(id);
    const addresses = [...consumer.savedAddresses];
    const index = addresses.findIndex(a => a.id === addressId);

    if (index === -1) {
      throw new ConsumerProfileError('ADDRESS_NOT_FOUND', 'Address not found', 404);
    }

    // If setting as default, unset others
    if (updates.isDefault) {
      addresses.forEach(a => (a.isDefault = false));
    }

    addresses[index] = { ...addresses[index], ...updates };
    await this.repo.updateSavedAddresses(id, addresses);

    return addresses;
  }

  /**
   * Remove saved address
   */
  async removeSavedAddress(id: string, addressId: string): Promise<SavedAddress[]> {
    const consumer = await this.getById(id);
    const addresses = consumer.savedAddresses.filter(a => a.id !== addressId);

    await this.repo.updateSavedAddresses(id, addresses);
    return addresses;
  }

  /**
   * Set default address
   */
  async setDefaultAddress(id: string, addressId: string): Promise<SavedAddress[]> {
    return this.updateSavedAddress(id, addressId, { isDefault: true });
  }

  /**
   * Get referral stats
   */
  async getReferralStats(id: string): Promise<{
    referralCode: string;
    referralCount: number;
    referredBy?: string;
    referrals: { id: string; firstName: string; createdAt: Date }[];
  }> {
    return this.repo.getReferralStats(id);
  }

  /**
   * Soft delete consumer account
   */
  async deleteAccount(id: string): Promise<void> {
    await this.getById(id); // Verify exists
    await this.repo.softDelete(id);
    console.log(`[ConsumerProfile] Consumer ${id.slice(0, 8)}... deleted their account`);
  }

  /**
   * Suspend consumer
   */
  async suspend(id: string, reason: string): Promise<void> {
    await this.getById(id);
    await this.repo.suspend(id, reason);
    console.log(`[ConsumerProfile] Consumer ${id.slice(0, 8)}... suspended: ${reason}`);
  }

  /**
   * Unsuspend consumer
   */
  async unsuspend(id: string): Promise<void> {
    await this.getById(id);
    await this.repo.unsuspend(id);
    console.log(`[ConsumerProfile] Consumer ${id.slice(0, 8)}... unsuspended`);
  }

  /**
   * Get paginated consumers (admin)
   */
  async listConsumers(
    params: { city?: string; isActive?: boolean },
    pagination: ConsumerPaginationParams
  ): Promise<ConsumerPaginatedResult<ConsumerProfile>> {
    return this.repo.findPaginated(params, pagination);
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    id: string,
    preferences: {
      pushNotificationsEnabled?: boolean;
      emailNotificationsEnabled?: boolean;
      smsNotificationsEnabled?: boolean;
    }
  ): Promise<ConsumerProfile> {
    return this.update(id, preferences);
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(
    id: string,
    settings: {
      profileVisibility?: 'public' | 'service_providers' | 'private';
      showLastName?: boolean;
    }
  ): Promise<ConsumerProfile> {
    return this.update(id, settings);
  }

  /**
   * Increment stats (called by other services)
   */
  async incrementRequestCount(id: string): Promise<void> {
    await this.repo.incrementRequestCount(id);
  }

  async incrementCompletedJobs(id: string): Promise<void> {
    await this.repo.incrementCompletedJobs(id);
  }

  async incrementReviewsGiven(id: string): Promise<void> {
    await this.repo.incrementReviewsGiven(id);
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(id: string): Promise<void> {
    await this.repo.updateLastActive(id);
  }
}
