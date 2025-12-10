/**
 * White-Label Routes
 * ==================
 *
 * API routes for white-label configuration.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { getBrandingService } from './branding.service';
import { getDomainService } from './domain.service';

/**
 * Public routes (no auth required) - for portal to fetch config
 */
export function createWhiteLabelPublicRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * GET /whitelabel/config/:orgId
   * Get public white-label config for portal
   */
  router.get('/config/:orgId', async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const brandingService = getBrandingService();
      const branding = await brandingService.getBranding(orgId);

      // Return public config
      res.json({
        success: true,
        data: {
          companyName: branding.companyName,
          tagline: branding.tagline,
          logoUrl: branding.logoUrl,
          logoSmallUrl: branding.logoSmallUrl,
          faviconUrl: branding.faviconUrl,
          primaryColor: branding.primaryColor,
          supportEmail: branding.supportEmail,
          supportPhone: branding.supportPhone,
          supportWhatsApp: branding.supportWhatsApp,
          socialLinks: branding.socialLinks,
          welcomeMessage: branding.welcomeMessage,
          footerText: branding.footerText,
          privacyPolicyUrl: branding.privacyPolicyUrl,
          termsOfServiceUrl: branding.termsOfServiceUrl,
        },
      });
    } catch (error: any) {
      console.error('[WhiteLabel] Get config error:', error);
      res.status(error.message?.includes('not found') ? 404 : 500).json({
        success: false,
        error: {
          code: error.message?.includes('not found') ? 'NOT_FOUND' : 'SERVER_ERROR',
          message: error.message || 'Error al obtener la configuración',
        },
      });
    }
  });

  /**
   * GET /whitelabel/styles/:orgId
   * Get CSS stylesheet for portal
   */
  router.get('/styles/:orgId', async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;

      const brandingService = getBrandingService();
      const branding = await brandingService.getBranding(orgId);
      const stylesheet = brandingService.generateStylesheet(branding);

      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      res.send(stylesheet);
    } catch (error: any) {
      res.status(500).send('/* Error loading styles */');
    }
  });

  /**
   * GET /whitelabel/resolve?domain=xxx
   * Resolve domain to org ID
   */
  router.get('/resolve', async (req: Request, res: Response) => {
    try {
      const domain = req.query.domain as string;

      if (!domain) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Domain is required' },
        });
      }

      const domainService = getDomainService();
      const orgId = await domainService.getOrgIdByDomain(domain);

      if (!orgId) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Domain not found' },
        });
      }

      res.json({
        success: true,
        data: { orgId },
      });
    } catch (error) {
      console.error('[WhiteLabel] Resolve domain error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error resolving domain' },
      });
    }
  });

  return router;
}

/**
 * Admin routes (requires auth) - for managing white-label config
 */
export function createWhiteLabelAdminRoutes(pool: Pool): Router {
  const router = Router();

  // These routes require admin authentication
  // Would use requireAuth middleware from main auth module

  /**
   * GET /admin/whitelabel
   * Get full white-label config for current org
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).user?.orgId;

      if (!orgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
        });
      }

      const brandingService = getBrandingService();
      const domainService = getDomainService();

      const [branding, domain] = await Promise.all([
        brandingService.getBranding(orgId),
        domainService.getDomainByOrgId(orgId),
      ]);

      res.json({
        success: true,
        data: {
          branding,
          domain,
        },
      });
    } catch (error) {
      console.error('[WhiteLabel Admin] Get config error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error al obtener la configuración' },
      });
    }
  });

  /**
   * PUT /admin/whitelabel/branding
   * Update branding config
   */
  router.put('/branding', async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).user?.orgId;

      if (!orgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
        });
      }

      const brandingService = getBrandingService();

      // Validate input
      const errors = brandingService.validateBranding(req.body);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: errors.join(', ') },
        });
      }

      const updated = await brandingService.updateBranding(orgId, req.body);

      res.json({
        success: true,
        data: { branding: updated },
      });
    } catch (error) {
      console.error('[WhiteLabel Admin] Update branding error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error al actualizar la configuración' },
      });
    }
  });

  /**
   * POST /admin/whitelabel/domain
   * Set custom domain
   */
  router.post('/domain', async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).user?.orgId;

      if (!orgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
        });
      }

      const { domain } = req.body;

      if (!domain) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Domain is required' },
        });
      }

      const domainService = getDomainService();
      const config = await domainService.setCustomDomain(orgId, domain);
      const instructions = domainService.getVerificationInstructions(config);

      res.json({
        success: true,
        data: {
          domain: config,
          verificationInstructions: instructions,
        },
      });
    } catch (error: any) {
      console.error('[WhiteLabel Admin] Set domain error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'DOMAIN_ERROR', message: error.message || 'Error al configurar el dominio' },
      });
    }
  });

  /**
   * POST /admin/whitelabel/domain/verify
   * Verify custom domain
   */
  router.post('/domain/verify', async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).user?.orgId;

      if (!orgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
        });
      }

      const domainService = getDomainService();
      const result = await domainService.verifyDomain(orgId);

      if (result.verified) {
        const domain = await domainService.getDomainByOrgId(orgId);
        res.json({
          success: true,
          data: { domain, verified: true },
        });
      } else {
        res.status(400).json({
          success: false,
          error: { code: 'VERIFICATION_FAILED', message: result.error },
        });
      }
    } catch (error) {
      console.error('[WhiteLabel Admin] Verify domain error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error al verificar el dominio' },
      });
    }
  });

  /**
   * DELETE /admin/whitelabel/domain
   * Remove custom domain
   */
  router.delete('/domain', async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).user?.orgId;

      if (!orgId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
        });
      }

      const domainService = getDomainService();
      await domainService.removeCustomDomain(orgId);

      res.json({ success: true });
    } catch (error) {
      console.error('[WhiteLabel Admin] Remove domain error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Error al eliminar el dominio' },
      });
    }
  });

  return router;
}
