/**
 * MercadoPago Payment Controller
 * ==============================
 *
 * API endpoints for MercadoPago payment integration:
 * - POST /payments/preference - Create payment preference
 * - GET /payments/:id/link - Get payment link
 * - POST /payments/webhook - Handle MP webhooks
 * - GET /payments/reconcile - Reconciliation report
 * - POST /payments/:id/refund - Process refund via MP API
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import {
  buildPreferenceRequest,
  createPreference,
  getPreference,
  PreferenceBuildOptions,
} from '../../../../integrations/mercadopago/preference';
import {
  validateWebhookSignature,
  parseWebhookNotification,
  processWebhook,
  mapPaymentStatus,
} from '../../../../integrations/mercadopago/webhook';
import { makeAuthenticatedRequest } from '../../../../integrations/mercadopago/oauth';
import {
  getDistributedLockService,
  getPaymentLockKey,
  getWebhookLockKey,
} from '../../../../lib/services/distributed-lock.service';
import {
  getIdempotencyService,
  IdempotencyService,
} from '../../../../lib/services/idempotency.service';
import { requireScopes, readScope, writeScope } from '../../middleware';
import { ApiRequestContext } from '../../public-api.types';
import { log } from '../../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const createPreferenceSchema = z.object({
  invoice_id: z.string().uuid(),
  back_urls: z.object({
    success: z.string().url(),
    failure: z.string().url(),
    pending: z.string().url().optional(),
  }).optional(),
  notification_url: z.string().url().optional(),
  max_installments: z.number().int().min(1).max(24).optional().default(12),
  excluded_payment_methods: z.array(z.string()).optional(),
  excluded_payment_types: z.array(z.string()).optional(),
  expiration_minutes: z.number().int().min(5).max(1440).optional(),
});

const mpRefundSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createMercadoPagoController(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /payments/preference - Create MP payment preference
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/preference',
    writeScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const parseResult = createPreferenceSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid preference data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const data = parseResult.data;

        // Get org's MP credentials
        const orgResult = await pool.query(
          `SELECT mp_access_token, mp_public_key, settings
           FROM organizations WHERE id = $1`,
          [apiContext.orgId]
        );

        if (orgResult.rows.length === 0 || !orgResult.rows[0].mp_access_token) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MP_NOT_CONNECTED',
              message: 'MercadoPago not connected for this organization',
            },
          });
        }

        const accessToken = orgResult.rows[0].mp_access_token;
        const settings = orgResult.rows[0].settings || {};

        // Get invoice with customer and line items
        const invoiceResult = await pool.query(
          `SELECT i.*,
                  c.name as customer_name, c.email as customer_email,
                  c.phone as customer_phone, c.doc_type as customer_doc_type,
                  c.doc_number as customer_doc_number
           FROM invoices i
           JOIN customers c ON i.customer_id = c.id
           WHERE i.id = $1 AND i.org_id = $2`,
          [data.invoice_id, apiContext.orgId]
        );

        if (invoiceResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
          });
        }

        const invoice = invoiceResult.rows[0];

        // Check invoice status
        if (invoice.status === 'paid') {
          return res.status(400).json({
            success: false,
            error: { code: 'INVOICE_ALREADY_PAID', message: 'Invoice is already paid' },
          });
        }

        // Get line items
        const lineItemsResult = await pool.query(
          `SELECT description, quantity, unit_price
           FROM invoice_items
           WHERE invoice_id = $1
           ORDER BY sort_order`,
          [data.invoice_id]
        );

        const lineItems = lineItemsResult.rows.length > 0
          ? lineItemsResult.rows.map((item: any) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unit_price),
            }))
          : [{
              description: `Factura ${invoice.invoice_number || invoice.id}`,
              quantity: 1,
              unitPrice: Number(invoice.amount_due || invoice.total),
            }];

        // Build preference
        const baseUrl = settings.app_url || process.env.APP_URL || 'https://app.campotech.ar';
        const notificationUrl = data.notification_url ||
          settings.mp_webhook_url ||
          `${process.env.API_URL || baseUrl}/api/v1/payments/webhook`;

        const preferenceOptions: PreferenceBuildOptions = {
          invoiceId: data.invoice_id,
          orgId: apiContext.orgId,
          items: lineItems,
          customer: invoice.customer_email ? {
            name: invoice.customer_name,
            email: invoice.customer_email,
            phone: invoice.customer_phone,
            documentType: invoice.customer_doc_type as any,
            documentNumber: invoice.customer_doc_number,
          } : undefined,
          backUrls: data.back_urls || {
            success: `${baseUrl}/payments/success`,
            failure: `${baseUrl}/payments/failure`,
            pending: `${baseUrl}/payments/pending`,
          },
          notificationUrl,
          maxInstallments: data.max_installments,
          excludedPaymentMethods: data.excluded_payment_methods,
          excludedPaymentTypes: data.excluded_payment_types,
          expirationMinutes: data.expiration_minutes,
          metadata: {
            org_id: apiContext.orgId,
            invoice_id: data.invoice_id,
            invoice_number: invoice.invoice_number,
          },
        };

        const request = buildPreferenceRequest(preferenceOptions);
        const result = await createPreference(accessToken, request);

        if (!result.success) {
          log.error('Failed to create MP preference', {
            orgId: apiContext.orgId,
            invoiceId: data.invoice_id,
            error: result.error,
          });

          return res.status(500).json({
            success: false,
            error: {
              code: 'MP_ERROR',
              message: result.error,
            },
          });
        }

        // Store preference ID on a pending payment record
        await pool.query(
          `INSERT INTO payments (
            org_id, customer_id, invoice_id, amount, currency,
            status, payment_method, payment_type, processor,
            metadata, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, 'ARS',
            'pending', 'mercadopago', 'online', 'mercadopago',
            $5, NOW(), NOW()
          )
          ON CONFLICT (invoice_id, processor) WHERE status = 'pending'
          DO UPDATE SET metadata = $5, updated_at = NOW()`,
          [
            apiContext.orgId,
            invoice.customer_id,
            data.invoice_id,
            invoice.amount_due || invoice.total,
            JSON.stringify({
              preference_id: result.preference.id,
              init_point: result.checkoutUrl,
              sandbox_init_point: result.sandboxUrl,
            }),
          ]
        );

        log.info('MP preference created', {
          orgId: apiContext.orgId,
          invoiceId: data.invoice_id,
          preferenceId: result.preference.id,
        });

        res.status(201).json({
          success: true,
          data: {
            preference_id: result.preference.id,
            init_point: result.checkoutUrl,
            sandbox_init_point: result.sandboxUrl,
            expires_at: result.preference.expirationDateTo,
          },
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        log.error('[Payments API] Create preference error:', { error: err });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to create payment preference' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /payments/:id/link - Get payment link
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/:id/link',
    readScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;

        // Get payment with preference info
        const paymentResult = await pool.query(
          `SELECT p.*, o.mp_access_token
           FROM payments p
           JOIN organizations o ON p.org_id = o.id
           WHERE p.id = $1 AND p.org_id = $2`,
          [id, apiContext.orgId]
        );

        if (paymentResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Payment not found' },
          });
        }

        const payment = paymentResult.rows[0];
        const metadata = payment.metadata || {};

        if (!metadata.preference_id) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'NO_PREFERENCE',
              message: 'No MercadoPago preference found for this payment',
            },
          });
        }

        // Check if preference is still valid
        if (payment.mp_access_token) {
          const prefResult = await getPreference(payment.mp_access_token, metadata.preference_id);

          if (prefResult.success) {
            const pref = prefResult.preference;

            // Check expiration
            if (pref.expirationDateTo && new Date(pref.expirationDateTo) < new Date()) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'PREFERENCE_EXPIRED',
                  message: 'Payment preference has expired. Please create a new one.',
                },
              });
            }

            return res.json({
              success: true,
              data: {
                payment_id: id,
                init_point: pref.initPoint,
                sandbox_init_point: pref.sandboxInitPoint,
                expires_at: pref.expirationDateTo,
              },
            });
          }
        }

        // Return cached URL if API check fails
        res.json({
          success: true,
          data: {
            payment_id: id,
            init_point: metadata.init_point,
            sandbox_init_point: metadata.sandbox_init_point,
          },
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        log.error('[Payments API] Get link error:', { error: err });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to get payment link' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /payments/webhook - Handle MercadoPago webhooks
  // ─────────────────────────────────────────────────────────────────────────────

  router.post('/webhook', async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-signature'] as string;
      const requestId = req.headers['x-request-id'] as string;
      const rawBody = JSON.stringify(req.body);

      log.info('MP webhook received', {
        type: req.body?.type,
        action: req.body?.action,
        dataId: req.body?.data?.id,
      });

      // Parse notification
      const notification = parseWebhookNotification(req.body);

      if (!notification) {
        log.warn('Invalid webhook payload', { body: req.body });
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      // Get webhook secret for signature validation (from first matching org or env)
      const webhookSecret = process.env.MP_WEBHOOK_SECRET;

      // Validate signature if secret is configured
      if (webhookSecret && signature) {
        const isValid = validateWebhookSignature(
          rawBody,
          signature,
          webhookSecret,
          requestId
        );

        if (!isValid) {
          log.warn('Invalid webhook signature', { requestId });
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Use distributed lock for processing
      let lockService;
      try {
        lockService = getDistributedLockService();
      } catch {
        // Lock service not initialized, proceed without lock
      }

      const webhookLockKey = getWebhookLockKey('mercadopago', `${notification.id}-${notification.data.id}`);

      const processWithLock = async () => {
        // Process the webhook
        const result = await processWebhook(notification, {
          accessToken: '', // Will be fetched per-org
          onPaymentUpdate: async (mpPayment, invoiceId, orgId) => {
            // Get org's access token
            const orgResult = await pool.query(
              'SELECT mp_access_token FROM organizations WHERE id = $1',
              [orgId]
            );

            if (orgResult.rows.length === 0) {
              log.warn('Org not found for payment update', { orgId, invoiceId });
              return;
            }

            // Update payment record
            const internalStatus = mapPaymentStatus(mpPayment.status);

            await pool.query(
              `UPDATE payments
               SET status = $1,
                   external_transaction_id = $2,
                   metadata = metadata || $3,
                   updated_at = NOW()
               WHERE invoice_id = $4 AND org_id = $5 AND processor = 'mercadopago'`,
              [
                internalStatus,
                String(mpPayment.id),
                JSON.stringify({
                  mp_status: mpPayment.status,
                  mp_status_detail: mpPayment.statusDetail,
                  mp_payment_method: mpPayment.paymentMethodId,
                  mp_payment_type: mpPayment.paymentTypeId,
                  mp_installments: mpPayment.installments,
                  updated_at: new Date().toISOString(),
                }),
                invoiceId,
                orgId,
              ]
            );

            // Update invoice status if payment approved
            if (mpPayment.status === 'approved') {
              await pool.query(
                `UPDATE invoices
                 SET status = 'paid',
                     amount_paid = total,
                     amount_due = 0,
                     paid_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $1 AND org_id = $2`,
                [invoiceId, orgId]
              );

              log.info('Invoice marked as paid', { invoiceId, orgId, mpPaymentId: mpPayment.id });
            }

            // Handle chargebacks
            if (mpPayment.status === 'charged_back') {
              // Create dispute record
              await pool.query(
                `INSERT INTO payment_disputes (
                  payment_id, dispute_type, status, disputed_amount,
                  mp_dispute_id, created_at, updated_at
                )
                SELECT p.id, 'chargeback', 'pending_response', $1, $2, NOW(), NOW()
                FROM payments p
                WHERE p.invoice_id = $3 AND p.org_id = $4 AND p.processor = 'mercadopago'
                ON CONFLICT DO NOTHING`,
                [
                  mpPayment.transactionAmount,
                  String(mpPayment.id),
                  invoiceId,
                  orgId,
                ]
              );

              log.warn('Chargeback received', { invoiceId, orgId, mpPaymentId: mpPayment.id });
            }
          },
        });

        return result;
      };

      let result;
      if (lockService) {
        result = await lockService.withLock(webhookLockKey, processWithLock, { ttlMs: 30000 });
      } else {
        result = await processWithLock();
      }

      if (!result.success) {
        log.error('Webhook processing failed', { error: result.error });
        // Return 200 to prevent retry for permanent errors
        return res.status(200).json({ received: true, error: result.error });
      }

      res.status(200).json({ received: true, status: 'processed' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      log.error('[Payments API] Webhook error:', { error: err });
      // Return 200 to prevent retry storms
      res.status(200).json({ received: true, error: 'Internal processing error' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /payments/reconcile - Reconciliation report
  // ─────────────────────────────────────────────────────────────────────────────

  router.get(
    '/reconcile',
    readScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { from, to } = req.query;

        const fromDate = from ? new Date(from as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to as string) : new Date();

        // Get org's MP credentials
        const orgResult = await pool.query(
          'SELECT mp_access_token FROM organizations WHERE id = $1',
          [apiContext.orgId]
        );

        if (!orgResult.rows[0]?.mp_access_token) {
          return res.status(400).json({
            success: false,
            error: { code: 'MP_NOT_CONNECTED', message: 'MercadoPago not connected' },
          });
        }

        const accessToken = orgResult.rows[0].mp_access_token;

        // Get local payments
        const localPayments = await pool.query(
          `SELECT id, external_transaction_id, amount, status, invoice_id, created_at
           FROM payments
           WHERE org_id = $1
             AND processor = 'mercadopago'
             AND created_at >= $2
             AND created_at <= $3`,
          [apiContext.orgId, fromDate, toDate]
        );

        // Search MP payments
        const searchResult = await makeAuthenticatedRequest<any>(
          accessToken,
          'GET',
          `/v1/payments/search?begin_date=${fromDate.toISOString()}&end_date=${toDate.toISOString()}&limit=100`
        );

        const discrepancies: any[] = [];

        if (searchResult.success) {
          const mpPayments = new Map(
            (searchResult.data as any).results.map((p: any) => [String(p.id), p])
          );

          // Check local payments against MP
          for (const local of localPayments.rows) {
            if (!local.external_transaction_id) continue;

            const mpPayment = mpPayments.get(local.external_transaction_id);

            if (!mpPayment) {
              discrepancies.push({
                type: 'missing_in_mp',
                local_id: local.id,
                mp_id: local.external_transaction_id,
                amount: local.amount,
              });
            } else {
              // Check status match
              const expectedStatus = mapPaymentStatus((mpPayment as any).status);
              if (expectedStatus !== local.status) {
                discrepancies.push({
                  type: 'status_mismatch',
                  local_id: local.id,
                  mp_id: local.external_transaction_id,
                  local_status: local.status,
                  mp_status: (mpPayment as any).status,
                  expected_status: expectedStatus,
                });
              }

              // Check amount match
              if (Number(local.amount) !== (mpPayment as any).transaction_amount) {
                discrepancies.push({
                  type: 'amount_mismatch',
                  local_id: local.id,
                  mp_id: local.external_transaction_id,
                  local_amount: local.amount,
                  mp_amount: (mpPayment as any).transaction_amount,
                });
              }
            }
          }

          // Check for MP payments not in local
          const localMpIds = new Set(
            localPayments.rows
              .filter((p: any) => p.external_transaction_id)
              .map((p: any) => p.external_transaction_id)
          );

          for (const [mpId, mpPayment] of mpPayments) {
            if (!localMpIds.has(mpId) && (mpPayment as any).status === 'approved') {
              discrepancies.push({
                type: 'missing_locally',
                mp_id: mpId,
                mp_amount: (mpPayment as any).transaction_amount,
                mp_status: (mpPayment as any).status,
                external_reference: (mpPayment as any).external_reference,
              });
            }
          }
        }

        res.json({
          success: true,
          data: {
            period: { from: fromDate, to: toDate },
            local_count: localPayments.rows.length,
            mp_count: searchResult.success ? (searchResult.data as any).results.length : 0,
            discrepancies,
            needs_attention: discrepancies.length > 0,
          },
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        log.error('[Payments API] Reconcile error:', { error: err });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to reconcile payments' },
        });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /payments/:id/mp-refund - Process refund via MercadoPago API
  // ─────────────────────────────────────────────────────────────────────────────

  router.post(
    '/:id/mp-refund',
    writeScope('payments'),
    async (req: Request, res: Response) => {
      try {
        const apiContext = (req as any).apiContext as ApiRequestContext;
        const { id } = req.params;
        const parseResult = mpRefundSchema.safeParse(req.body);

        if (!parseResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid refund data',
              details: parseResult.error.flatten().fieldErrors,
            },
          });
        }

        const { amount, reason, metadata } = parseResult.data;

        // Get payment with MP transaction ID
        const paymentResult = await pool.query(
          `SELECT p.*, o.mp_access_token
           FROM payments p
           JOIN organizations o ON p.org_id = o.id
           WHERE p.id = $1 AND p.org_id = $2`,
          [id, apiContext.orgId]
        );

        if (paymentResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Payment not found' },
          });
        }

        const payment = paymentResult.rows[0];

        if (!payment.external_transaction_id) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'NO_MP_TRANSACTION',
              message: 'No MercadoPago transaction ID found',
            },
          });
        }

        if (!payment.mp_access_token) {
          return res.status(400).json({
            success: false,
            error: { code: 'MP_NOT_CONNECTED', message: 'MercadoPago not connected' },
          });
        }

        if (payment.status !== 'completed' && payment.status !== 'partially_refunded') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: 'Payment cannot be refunded in current status',
            },
          });
        }

        const availableForRefund = Number(payment.amount) - Number(payment.refunded_amount || 0);
        const refundAmount = amount || availableForRefund;

        if (refundAmount > availableForRefund) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_AMOUNT',
              message: `Refund amount exceeds available (${availableForRefund})`,
            },
          });
        }

        // Use distributed lock for refund
        let lockService;
        try {
          lockService = getDistributedLockService();
        } catch {
          // Continue without lock
        }

        const processRefund = async () => {
          // Call MP Refunds API
          const refundBody: any = {};
          if (amount) {
            refundBody.amount = amount;
          }
          if (metadata) {
            refundBody.metadata = metadata;
          }

          const mpResult = await makeAuthenticatedRequest<any>(
            payment.mp_access_token,
            'POST',
            `/v1/payments/${payment.external_transaction_id}/refunds`,
            Object.keys(refundBody).length > 0 ? refundBody : undefined
          );

          if (!mpResult.success) {
            return {
              success: false,
              error: mpResult.error,
              status: mpResult.status,
            };
          }

          const mpRefund = mpResult.data;
          const newRefundedAmount = Number(payment.refunded_amount || 0) + refundAmount;
          const isFullRefund = newRefundedAmount >= Number(payment.amount);
          const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

          // Create refund record
          await pool.query(
            `INSERT INTO payment_refunds (
              payment_id, amount, reason, notes, external_refund_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())`,
            [id, refundAmount, reason, JSON.stringify(metadata), String(mpRefund.id)]
          );

          // Update payment
          await pool.query(
            `UPDATE payments
             SET refunded_amount = $1, status = $2, updated_at = NOW()
             WHERE id = $3`,
            [newRefundedAmount, newStatus, id]
          );

          // Update invoice
          if (payment.invoice_id) {
            await pool.query(
              `UPDATE invoices
               SET amount_paid = amount_paid - $1,
                   amount_due = amount_due + $1,
                   status = CASE
                     WHEN amount_paid - $1 <= 0 THEN 'sent'
                     ELSE 'partially_paid'
                   END,
                   updated_at = NOW()
               WHERE id = $2`,
              [refundAmount, payment.invoice_id]
            );
          }

          return {
            success: true,
            refund: mpRefund,
            isFullRefund,
            newStatus,
          };
        };

        let result;
        if (lockService) {
          result = await lockService.withLock(
            getPaymentLockKey(id),
            processRefund,
            { ttlMs: 30000 }
          );
        } else {
          result = await processRefund();
        }

        if (!result.success) {
          return res.status(500).json({
            success: false,
            error: {
              code: 'MP_REFUND_FAILED',
              message: result.error,
            },
          });
        }

        log.info('MP refund processed', {
          paymentId: id,
          refundAmount,
          mpRefundId: result.refund.id,
        });

        res.json({
          success: true,
          data: {
            refund_id: result.refund.id,
            amount: refundAmount,
            is_full_refund: result.isFullRefund,
            new_status: result.newStatus,
            mp_refund: result.refund,
          },
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        log.error('[Payments API] MP refund error:', { error: err });
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Failed to process refund' },
        });
      }
    }
  );

  return router;
}
