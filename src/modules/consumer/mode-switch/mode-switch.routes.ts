/**
 * Mode Switch Routes
 * ==================
 *
 * API routes for dual profile and mode switching.
 * Phase 15: Consumer Marketplace
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { ModeSwitchService, AppMode } from './mode-switch.service';
import { authenticateConsumer } from '../auth/consumer-auth.middleware';

export function createModeSwitchRoutes(pool: Pool): Router {
  const router = Router();
  const service = new ModeSwitchService(pool);

  /**
   * GET /mode/status
   * Check dual profile status
   */
  router.get(
    '/status',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const phone = req.consumer!.phone;
        const currentMode = (req.query.mode as AppMode) || 'consumer';

        const status = await service.checkDualProfile(phone, currentMode);

        res.json({
          success: true,
          data: {
            hasConsumerProfile: status.hasConsumerProfile,
            hasBusinessProfile: status.hasBusinessProfile,
            canSwitch: status.canSwitch,
            currentMode: status.currentMode,
            consumer: status.consumerProfile
              ? {
                  id: status.consumerProfile.id,
                  displayName: status.consumerProfile.displayName,
                  profilePhotoUrl: status.consumerProfile.profilePhotoUrl,
                  activeRequests: status.consumerProfile.activeRequests,
                }
              : null,
            business: status.businessProfile
              ? {
                  id: status.businessProfile.id,
                  displayName: status.businessProfile.displayName,
                  logoUrl: status.businessProfile.logoUrl,
                  subscriptionPlan: status.businessProfile.subscriptionPlan,
                  pendingLeads: status.businessProfile.pendingLeads,
                }
              : null,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /mode/switch
   * Switch between consumer and business modes
   */
  router.post(
    '/switch',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const phone = req.consumer!.phone;
        const { mode } = req.body;

        if (!mode || !['consumer', 'business'].includes(mode)) {
          return res.status(400).json({
            error: {
              code: 'INVALID_MODE',
              message: 'Modo debe ser "consumer" o "business"',
            },
          });
        }

        const result = await service.switchMode(phone, mode as AppMode);

        if (!result.success) {
          return res.status(400).json({
            error: {
              code: 'CANNOT_SWITCH',
              message: 'No puedes cambiar de modo. Verifica que tengas ambos perfiles.',
            },
          });
        }

        res.json({
          success: true,
          data: {
            mode,
            profile: result.profile,
          },
          message:
            mode === 'consumer'
              ? 'Cambiaste al modo consumidor'
              : 'Cambiaste al modo negocio',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /mode/preference
   * Get user's mode preference
   */
  router.get(
    '/preference',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const phone = req.consumer!.phone;
        const preference = await service.getModePreference(phone);

        res.json({
          success: true,
          data: preference || {
            preferredMode: 'consumer',
            autoSwitchEnabled: false,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /mode/preference
   * Update mode preference
   */
  router.put(
    '/preference',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const phone = req.consumer!.phone;
        const { preferredMode, autoSwitchEnabled } = req.body;

        if (preferredMode && !['consumer', 'business'].includes(preferredMode)) {
          return res.status(400).json({
            error: {
              code: 'INVALID_MODE',
              message: 'Modo debe ser "consumer" o "business"',
            },
          });
        }

        await service.saveModePreference(
          phone,
          preferredMode || 'consumer',
          autoSwitchEnabled ?? false
        );

        res.json({
          success: true,
          message: 'Preferencia guardada',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /mode/link
   * Link consumer profile to business profile
   */
  router.post(
    '/link',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const consumerId = req.consumer!.consumerId;
        const { businessProfileId } = req.body;

        if (!businessProfileId) {
          return res.status(400).json({
            error: {
              code: 'MISSING_BUSINESS_ID',
              message: 'ID del perfil de negocio requerido',
            },
          });
        }

        const linked = await service.linkProfiles(consumerId, businessProfileId);

        if (!linked) {
          return res.status(400).json({
            error: {
              code: 'LINK_FAILED',
              message: 'No se pudo vincular los perfiles',
            },
          });
        }

        res.json({
          success: true,
          message: 'Perfiles vinculados exitosamente',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /mode/upsell/business
   * Check if should show business upsell
   */
  router.get(
    '/upsell/business',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const consumerId = req.consumer!.consumerId;
        const result = await service.shouldShowBusinessUpsell(consumerId);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /mode/upsell/shown
   * Record that upsell was shown
   */
  router.post(
    '/upsell/shown',
    authenticateConsumer(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const consumerId = req.consumer!.consumerId;
        const { type } = req.body;

        if (!type || !['business', 'subscription'].includes(type)) {
          return res.status(400).json({
            error: {
              code: 'INVALID_TYPE',
              message: 'Tipo debe ser "business" o "subscription"',
            },
          });
        }

        await service.recordUpsellShown(consumerId, type);

        res.json({
          success: true,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handler
  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Mode Switch] Error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno',
      },
    });
  });

  return router;
}
