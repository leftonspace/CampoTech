/**
 * Consumer Profile Routes
 * =======================
 *
 * API routes for consumer profile management.
 * Phase 15: Consumer Marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { ConsumerProfileService, ConsumerProfileError } from './consumer-profile.service';
import { authenticateConsumer, requireActiveConsumer } from '../auth/consumer-auth.middleware';

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createConsumerProfileRoutes(pool: Pool): Router {
  const router = Router();
  const service = new ConsumerProfileService(pool);

  // All routes require authentication
  router.use(authenticateConsumer());

  /**
   * GET /profile
   * Get current consumer's profile
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consumer = await service.getById(req.consumer!.consumerId);

      res.json({
        success: true,
        data: formatConsumerProfile(consumer),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /profile
   * Update current consumer's profile
   */
  router.put(
    '/',
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const allowedFields = [
          'firstName',
          'lastName',
          'email',
          'bio',
          'defaultAddress',
          'defaultAddressExtra',
          'defaultLat',
          'defaultLng',
          'neighborhood',
          'city',
          'province',
          'postalCode',
          'preferredContact',
          'language',
        ];

        const updates: Record<string, any> = {};
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
          }
        }

        const consumer = await service.update(req.consumer!.consumerId, updates);

        res.json({
          success: true,
          data: formatConsumerProfile(consumer),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /profile/photo
   * Update profile photo
   */
  router.put(
    '/photo',
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { photoUrl } = req.body;

        if (!photoUrl) {
          return res.status(400).json({
            error: {
              code: 'PHOTO_REQUIRED',
              message: 'Photo URL is required',
            },
          });
        }

        const consumer = await service.updateProfilePhoto(
          req.consumer!.consumerId,
          photoUrl
        );

        res.json({
          success: true,
          data: {
            profilePhotoUrl: consumer.profilePhotoUrl,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /profile/photo
   * Remove profile photo
   */
  router.delete(
    '/photo',
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await service.update(req.consumer!.consumerId, { profilePhotoUrl: undefined });

        res.json({
          success: true,
          message: 'Profile photo removed',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /profile/location
   * Update last known location
   */
  router.put(
    '/location',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { lat, lng } = req.body;

        if (lat === undefined || lng === undefined) {
          return res.status(400).json({
            error: {
              code: 'LOCATION_REQUIRED',
              message: 'Latitude and longitude are required',
            },
          });
        }

        await service.updateLocation(req.consumer!.consumerId, lat, lng);

        res.json({
          success: true,
          message: 'Location updated',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /profile/addresses
   * Get saved addresses
   */
  router.get(
    '/addresses',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const addresses = await service.getSavedAddresses(req.consumer!.consumerId);

        res.json({
          success: true,
          data: addresses,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /profile/addresses
   * Add saved address
   */
  router.post(
    '/addresses',
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { label, address, addressExtra, lat, lng, neighborhood, city, isDefault } =
          req.body;

        if (!label || !address || !city) {
          return res.status(400).json({
            error: {
              code: 'MISSING_FIELDS',
              message: 'Label, address, and city are required',
            },
          });
        }

        const addresses = await service.addSavedAddress(req.consumer!.consumerId, {
          label,
          address,
          addressExtra,
          lat,
          lng,
          neighborhood,
          city,
          isDefault: isDefault || false,
        });

        res.status(201).json({
          success: true,
          data: addresses,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /profile/addresses/:addressId
   * Update saved address
   */
  router.put(
    '/addresses/:addressId',
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { label, address, addressExtra, lat, lng, neighborhood, city, isDefault } =
          req.body;

        const addresses = await service.updateSavedAddress(
          req.consumer!.consumerId,
          req.params.addressId,
          {
            label,
            address,
            addressExtra,
            lat,
            lng,
            neighborhood,
            city,
            isDefault,
          }
        );

        res.json({
          success: true,
          data: addresses,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /profile/addresses/:addressId
   * Remove saved address
   */
  router.delete(
    '/addresses/:addressId',
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const addresses = await service.removeSavedAddress(
          req.consumer!.consumerId,
          req.params.addressId
        );

        res.json({
          success: true,
          data: addresses,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /profile/addresses/:addressId/default
   * Set address as default
   */
  router.put(
    '/addresses/:addressId/default',
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const addresses = await service.setDefaultAddress(
          req.consumer!.consumerId,
          req.params.addressId
        );

        res.json({
          success: true,
          data: addresses,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /profile/notifications
   * Update notification preferences
   */
  router.put(
    '/notifications',
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { pushNotificationsEnabled, emailNotificationsEnabled, smsNotificationsEnabled } =
          req.body;

        const consumer = await service.updateNotificationPreferences(req.consumer!.consumerId, {
          pushNotificationsEnabled,
          emailNotificationsEnabled,
          smsNotificationsEnabled,
        });

        res.json({
          success: true,
          data: {
            pushNotificationsEnabled: consumer.pushNotificationsEnabled,
            emailNotificationsEnabled: consumer.emailNotificationsEnabled,
            smsNotificationsEnabled: consumer.smsNotificationsEnabled,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /profile/privacy
   * Update privacy settings
   */
  router.put(
    '/privacy',
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { profileVisibility, showLastName } = req.body;

        const consumer = await service.updatePrivacySettings(req.consumer!.consumerId, {
          profileVisibility,
          showLastName,
        });

        res.json({
          success: true,
          data: {
            profileVisibility: consumer.profileVisibility,
            showLastName: consumer.showLastName,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /profile/fcm-token
   * Register FCM token for push notifications
   */
  router.post(
    '/fcm-token',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.body;

        if (!token) {
          return res.status(400).json({
            error: {
              code: 'TOKEN_REQUIRED',
              message: 'FCM token is required',
            },
          });
        }

        await service.addFcmToken(req.consumer!.consumerId, token);

        res.json({
          success: true,
          message: 'FCM token registered',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /profile/fcm-token
   * Remove FCM token
   */
  router.delete(
    '/fcm-token',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.body;

        if (!token) {
          return res.status(400).json({
            error: {
              code: 'TOKEN_REQUIRED',
              message: 'FCM token is required',
            },
          });
        }

        await service.removeFcmToken(req.consumer!.consumerId, token);

        res.json({
          success: true,
          message: 'FCM token removed',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /profile/referrals
   * Get referral stats
   */
  router.get(
    '/referrals',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const stats = await service.getReferralStats(req.consumer!.consumerId);

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /profile
   * Delete account (soft delete)
   */
  router.delete(
    '/',
    requireActiveConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await service.deleteAccount(req.consumer!.consumerId);

        res.json({
          success: true,
          message: 'Account deleted successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ConsumerProfileError) {
      return res.status(error.httpStatus).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    console.error('[ConsumerProfile] Unhandled error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatConsumerProfile(consumer: any) {
  return {
    id: consumer.id,
    phone: consumer.phone,
    phoneVerified: consumer.phoneVerified,
    email: consumer.email,
    emailVerified: consumer.emailVerified,
    firstName: consumer.firstName,
    lastName: consumer.lastName,
    profilePhotoUrl: consumer.profilePhotoUrl,
    bio: consumer.bio,
    defaultAddress: consumer.defaultAddress,
    defaultAddressExtra: consumer.defaultAddressExtra,
    defaultLat: consumer.defaultLat,
    defaultLng: consumer.defaultLng,
    neighborhood: consumer.neighborhood,
    city: consumer.city,
    province: consumer.province,
    postalCode: consumer.postalCode,
    preferredContact: consumer.preferredContact,
    language: consumer.language,
    pushNotificationsEnabled: consumer.pushNotificationsEnabled,
    emailNotificationsEnabled: consumer.emailNotificationsEnabled,
    smsNotificationsEnabled: consumer.smsNotificationsEnabled,
    profileVisibility: consumer.profileVisibility,
    showLastName: consumer.showLastName,
    totalRequests: consumer.totalRequests,
    totalJobsCompleted: consumer.totalJobsCompleted,
    totalReviewsGiven: consumer.totalReviewsGiven,
    averageRatingGiven: consumer.averageRatingGiven,
    referralCode: consumer.referralCode,
    referralCount: consumer.referralCount,
    createdAt: consumer.createdAt,
    lastActiveAt: consumer.lastActiveAt,
  };
}
