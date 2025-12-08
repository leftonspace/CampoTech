/**
 * Organization Controller
 * =======================
 *
 * HTTP request handlers for organization endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { getOrganizationService, OrganizationError } from './organization.service';
import {
  CreateOrganizationDTO,
  UpdateOrganizationDTO,
  UpdateOrganizationSettingsDTO,
  AFIPConfigDTO,
  toOrganizationResponse,
} from './organization.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export class OrganizationController {
  /**
   * Get current organization (from auth context)
   */
  async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
      }

      const service = getOrganizationService();
      const org = await service.getById(orgId);

      res.json({ data: toOrganizationResponse(org) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get organization by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const service = getOrganizationService();
      const org = await service.getById(id);

      res.json({ data: toOrganizationResponse(org) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current organization
   */
  async updateCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
      }

      const data: UpdateOrganizationDTO = req.body;

      const service = getOrganizationService();
      const org = await service.update(orgId, data);

      res.json({ data: toOrganizationResponse(org) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current organization settings
   */
  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
      }

      const settings: UpdateOrganizationSettingsDTO = req.body;

      const service = getOrganizationService();
      const org = await service.updateSettings(orgId, settings);

      res.json({ data: toOrganizationResponse(org) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Configure AFIP
   */
  async configureAFIP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
      }

      const config: AFIPConfigDTO = req.body;

      // Validation
      if (!config.certificate || !config.certificatePassword || !config.puntoVenta) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Certificate, password, and punto de venta are required',
          },
        });
        return;
      }

      const service = getOrganizationService();
      const status = await service.configureAFIP(orgId, config);

      res.json({ data: status });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get AFIP configuration status
   */
  async getAFIPStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
      }

      const service = getOrganizationService();
      const status = await service.getAFIPStatus(orgId);

      res.json({ data: status });
    } catch (error) {
      next(error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLER MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export function organizationErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof OrganizationError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  next(error);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const organizationController = new OrganizationController();
