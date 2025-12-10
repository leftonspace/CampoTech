/**
 * Organizations Controller
 * ========================
 *
 * API endpoints for organization management:
 * - GET /org - Get current organization
 * - PATCH /org - Update organization settings
 * - POST /org/afip/cert - Upload AFIP certificate
 * - GET /org/afip/status - Check AFIP connection status
 * - POST /org/mp/connect - Initiate MercadoPago OAuth
 * - GET /org/mp/callback - Handle MP OAuth callback
 * - POST /org/whatsapp/verify - Verify WhatsApp connection
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import * as crypto from 'crypto';
import { requireScopes, readScope, writeScope } from '../../middleware';
import { ApiRequestContext } from '../../public-api.types';
import { log } from '../../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  legal_name: z.string().max(255).optional(),
  cuit: z.string().regex(/^\d{11}$/).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  iva_condition: z.enum([
    'responsable_inscripto',
    'monotributista',
    'exento',
    'consumidor_final',
  ]).optional(),
  settings: z.record(z.any()).optional(),
});

const afipCertSchema = z.object({
  certificate: z.string().min(1), // Base64 encoded .pfx
  password: z.string().min(1),
  environment: z.enum(['homologacion', 'produccion']).optional().default('homologacion'),
});

const whatsappVerifySchema = z.object({
  phone_number_id: z.string().min(1),
  business_id: z.string().min(1),
  access_token: z.string().min(1),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createOrganizationsController(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /org - Get current organization
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/',
    requireScopes(readScope('organizations')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;

        const result = await pool.query(
          `SELECT
            id, name, legal_name, cuit, iva_condition,
            address, city, province, postal_code,
            phone, email, website, logo_url,
            timezone, currency, settings,
            afip_connected, mp_connected, whatsapp_connected,
            created_at, updated_at
           FROM organizations
           WHERE id = $1`,
          [apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Organization not found' },
          });
        }

        const org = result.rows[0];

        // Get connection statuses
        const connections = {
          afip: {
            connected: org.afip_connected || false,
            cert_expires_at: org.afip_cert_expires_at,
          },
          mercadopago: {
            connected: org.mp_connected || false,
          },
          whatsapp: {
            connected: org.whatsapp_connected || false,
          },
        };

        res.json({
          success: true,
          data: {
            id: org.id,
            name: org.name,
            legal_name: org.legal_name,
            cuit: org.cuit,
            iva_condition: org.iva_condition,
            address: org.address,
            city: org.city,
            province: org.province,
            postal_code: org.postal_code,
            phone: org.phone,
            email: org.email,
            website: org.website,
            logo_url: org.logo_url,
            timezone: org.timezone,
            currency: org.currency,
            settings: org.settings,
            connections,
            created_at: org.created_at,
            updated_at: org.updated_at,
          },
        });
      } catch (error) {
        log.error('[Organizations API] Get error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get organization' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /org - Update organization settings
  // ─────────────────────────────────────────────────────────────────────────────

  router.patch(
    '/',
    requireScopes(writeScope('organizations')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = updateOrgSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid organization data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const data = parseResult.data;

        // Check role for sensitive fields
        const userRole = apiContext.scopes?.includes('admin') ? 'admin' : 'user';
        const sensitiveFields = ['cuit', 'legal_name', 'iva_condition'];

        if (userRole !== 'admin') {
          for (const field of sensitiveFields) {
            if (data[field as keyof typeof data] !== undefined) {
              return res.status(403).json({
                success: false,
                error: {
                  code: 'FORBIDDEN',
                  message: `Only admins can update ${field}`,
                },
              });
            }
          }
        }

        // Build update query
        const setClauses: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let paramIndex = 1;

        const fields = Object.keys(data) as (keyof typeof data)[];
        for (const field of fields) {
          if (data[field] !== undefined) {
            if (field === 'settings') {
              // Merge settings
              setClauses.push(`settings = COALESCE(settings, '{}') || $${paramIndex++}::jsonb`);
              values.push(JSON.stringify(data.settings));
            } else {
              setClauses.push(`${field} = $${paramIndex++}`);
              values.push(data[field]);
            }
          }
        }

        if (values.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'NO_UPDATES', message: 'No valid fields to update' },
          });
        }

        values.push(apiContext.orgId);

        const result = await pool.query(
          `UPDATE organizations
           SET ${setClauses.join(', ')}
           WHERE id = $${paramIndex}
           RETURNING id, name, legal_name, cuit, iva_condition,
                     address, city, province, postal_code,
                     phone, email, website, logo_url,
                     timezone, currency, settings, updated_at`,
          values
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Organization not found' },
          });
        }

        log.info('Organization updated', {
          orgId: apiContext.orgId,
          fields: Object.keys(data),
        });

        res.json({ success: true, data: result.rows[0] });
      } catch (error) {
        log.error('[Organizations API] Update error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to update organization' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /org/afip/cert - Upload AFIP certificate
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/afip/cert',
    requireScopes(writeScope('organizations')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = afipCertSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid certificate data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { certificate, password, environment } = parseResult.data;

        // Decode and validate certificate
        let certBuffer: Buffer;
        try {
          certBuffer = Buffer.from(certificate, 'base64');
        } catch {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_CERT', message: 'Invalid base64 certificate' },
          });
        }

        // Extract certificate info (simplified - in production use node-forge or similar)
        let certInfo: { subject: string; expiry: Date; issuer: string };
        try {
          // For now, we'll store and validate later during CAE request
          // In production, parse the PFX properly
          certInfo = {
            subject: 'Certificate uploaded',
            expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Placeholder
            issuer: 'AFIP',
          };
        } catch {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_CERT', message: 'Could not parse certificate' },
          });
        }

        // Encrypt private key for storage
        const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
          'aes-256-gcm',
          Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32)),
          iv
        );
        const encrypted = Buffer.concat([
          cipher.update(certBuffer),
          cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();

        const encryptedCert = JSON.stringify({
          iv: iv.toString('hex'),
          data: encrypted.toString('hex'),
          tag: authTag.toString('hex'),
          password: password, // In production, also encrypt this
        });

        // Update organization
        await pool.query(
          `UPDATE organizations
           SET afip_certificate = $1,
               afip_cert_subject = $2,
               afip_cert_expires_at = $3,
               afip_environment = $4,
               afip_connected = false,
               afip_last_test = NULL,
               updated_at = NOW()
           WHERE id = $5`,
          [encryptedCert, certInfo.subject, certInfo.expiry, environment, apiContext.orgId]
        );

        log.info('AFIP certificate uploaded', {
          orgId: apiContext.orgId,
          environment,
          expiresAt: certInfo.expiry,
        });

        res.json({
          success: true,
          data: {
            message: 'Certificate uploaded successfully',
            environment,
            expires_at: certInfo.expiry,
            needs_test: true,
          },
        });
      } catch (error) {
        log.error('[Organizations API] AFIP cert error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to upload certificate' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /org/afip/status - Check AFIP connection status
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/afip/status',
    requireScopes(readScope('organizations')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;

        const result = await pool.query(
          `SELECT
            afip_connected, afip_environment, afip_cert_subject,
            afip_cert_expires_at, afip_last_test, afip_last_error
           FROM organizations
           WHERE id = $1`,
          [apiContext.orgId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Organization not found' },
          });
        }

        const org = result.rows[0];
        const now = new Date();
        const certExpiry = org.afip_cert_expires_at ? new Date(org.afip_cert_expires_at) : null;
        const daysToExpiry = certExpiry
          ? Math.floor((certExpiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          : null;

        res.json({
          success: true,
          data: {
            connected: org.afip_connected || false,
            environment: org.afip_environment || 'homologacion',
            certificate: {
              subject: org.afip_cert_subject,
              expires_at: org.afip_cert_expires_at,
              days_to_expiry: daysToExpiry,
              expired: daysToExpiry !== null && daysToExpiry < 0,
              expiring_soon: daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry < 30,
            },
            last_test: org.afip_last_test,
            last_error: org.afip_last_error,
          },
        });
      } catch (error) {
        log.error('[Organizations API] AFIP status error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get AFIP status' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /org/mp/connect - Initiate MercadoPago OAuth
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/mp/connect',
    requireScopes(writeScope('organizations')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { redirect_uri } = req.body;

        const clientId = process.env.MP_CLIENT_ID;
        const baseRedirectUri = redirect_uri || process.env.MP_REDIRECT_URI;

        if (!clientId || !baseRedirectUri) {
          return res.status(500).json({
            success: false,
            error: {
              code: 'MP_NOT_CONFIGURED',
              message: 'MercadoPago OAuth not configured',
            },
          });
        }

        // Generate state token for CSRF protection
        const state = crypto.randomBytes(32).toString('hex');

        // Store state in database
        await pool.query(
          `UPDATE organizations
           SET mp_oauth_state = $1,
               mp_oauth_started_at = NOW(),
               updated_at = NOW()
           WHERE id = $2`,
          [state, apiContext.orgId]
        );

        // Build OAuth URL
        const authUrl = new URL('https://auth.mercadopago.com/authorization');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('platform_id', 'mp');
        authUrl.searchParams.set('redirect_uri', baseRedirectUri);
        authUrl.searchParams.set('state', state);

        log.info('MP OAuth initiated', { orgId: apiContext.orgId });

        res.json({
          success: true,
          data: {
            auth_url: authUrl.toString(),
            state,
            expires_in: 600, // 10 minutes
          },
        });
      } catch (error) {
        log.error('[Organizations API] MP connect error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to initiate MP connection' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /org/mp/callback - Handle MP OAuth callback
  // ─────────────────────────────────────────────────────────────────────────────

  router.get('/mp/callback', async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_CALLBACK', message: 'Missing code or state' },
        });
      }

      // Find org by state
      const orgResult = await pool.query(
        `SELECT id FROM organizations
         WHERE mp_oauth_state = $1
           AND mp_oauth_started_at > NOW() - INTERVAL '10 minutes'`,
        [state]
      );

      if (orgResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Invalid or expired state token' },
        });
      }

      const orgId = orgResult.rows[0].id;

      // Exchange code for tokens
      const clientId = process.env.MP_CLIENT_ID;
      const clientSecret = process.env.MP_CLIENT_SECRET;
      const redirectUri = process.env.MP_REDIRECT_URI;

      const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId!,
          client_secret: clientSecret!,
          code: code as string,
          redirect_uri: redirectUri!,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        log.error('MP token exchange failed', { error, orgId });
        return res.status(500).json({
          success: false,
          error: { code: 'MP_TOKEN_ERROR', message: 'Failed to exchange token' },
        });
      }

      const tokenData = await tokenResponse.json();

      // Store tokens
      await pool.query(
        `UPDATE organizations
         SET mp_access_token = $1,
             mp_refresh_token = $2,
             mp_user_id = $3,
             mp_public_key = $4,
             mp_token_expires_at = NOW() + INTERVAL '${tokenData.expires_in} seconds',
             mp_connected = true,
             mp_oauth_state = NULL,
             updated_at = NOW()
         WHERE id = $5`,
        [
          tokenData.access_token,
          tokenData.refresh_token,
          tokenData.user_id,
          tokenData.public_key,
          orgId,
        ]
      );

      log.info('MP OAuth completed', { orgId, mpUserId: tokenData.user_id });

      // Redirect to success page
      const successUrl = process.env.APP_URL
        ? `${process.env.APP_URL}/settings/integrations?mp=connected`
        : '/settings/integrations?mp=connected';

      res.redirect(successUrl);
    } catch (error) {
      log.error('[Organizations API] MP callback error:', { error });
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to complete MP connection' },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /org/whatsapp/verify - Verify WhatsApp connection
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/whatsapp/verify',
    requireScopes(writeScope('organizations')),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = whatsappVerifySchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid WhatsApp data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { phone_number_id, business_id, access_token } = parseResult.data;

        // Test the connection by fetching phone number details
        const testResponse = await fetch(
          `https://graph.facebook.com/v18.0/${phone_number_id}`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
          }
        );

        if (!testResponse.ok) {
          const error = await testResponse.text();
          log.error('WhatsApp verification failed', { error, orgId: apiContext.orgId });
          return res.status(400).json({
            success: false,
            error: {
              code: 'WA_VERIFICATION_FAILED',
              message: 'Failed to verify WhatsApp credentials',
            },
          });
        }

        const phoneData = await testResponse.json();

        // Store credentials
        await pool.query(
          `UPDATE organizations
           SET whatsapp_phone_id = $1,
               whatsapp_business_id = $2,
               whatsapp_access_token = $3,
               whatsapp_phone_number = $4,
               whatsapp_connected = true,
               whatsapp_verified_at = NOW(),
               updated_at = NOW()
           WHERE id = $5`,
          [
            phone_number_id,
            business_id,
            access_token,
            phoneData.display_phone_number,
            apiContext.orgId,
          ]
        );

        log.info('WhatsApp verified', {
          orgId: apiContext.orgId,
          phoneNumber: phoneData.display_phone_number,
        });

        res.json({
          success: true,
          data: {
            connected: true,
            phone_number: phoneData.display_phone_number,
            verified_phone_number: phoneData.verified_name,
            quality_rating: phoneData.quality_rating,
          },
        });
      } catch (error) {
        log.error('[Organizations API] WhatsApp verify error:', { error });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to verify WhatsApp' },
        });
      }
    }
  );

  return router;
}
