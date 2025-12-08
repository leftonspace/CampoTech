/**
 * MercadoPago Reconciliation Service
 * ===================================
 *
 * Reconciles local payment records with MercadoPago to detect
 * and resolve discrepancies.
 */

import {
  MPCredentials,
  Payment,
  PaymentStatus,
  ReconciliationItem,
  ReconciliationResult,
} from '../../integrations/mercadopago/mercadopago.types';
import {
  fetchPayment,
  makeAuthenticatedRequest,
  parseExternalReference,
} from '../../integrations/mercadopago';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReconciliationConfig {
  batchSize: number;
  lookbackHours: number;
  autoFix: boolean;
}

export interface LocalPaymentRecord {
  id: string;
  invoiceId: string;
  mpPaymentId?: string;
  status: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconciliationCallbacks {
  getCredentials: (orgId: string) => Promise<MPCredentials | null>;
  getLocalPayments: (orgId: string, fromDate: Date) => Promise<LocalPaymentRecord[]>;
  updatePaymentStatus: (paymentId: string, status: string, mpData: Payment) => Promise<void>;
  createPaymentRecord: (invoiceId: string, mpPayment: Payment) => Promise<void>;
  markDiscrepancy: (item: ReconciliationItem) => Promise<void>;
}

const DEFAULT_CONFIG: ReconciliationConfig = {
  batchSize: 50,
  lookbackHours: 24,
  autoFix: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECONCILIATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class MPReconciliationService {
  private config: ReconciliationConfig;
  private callbacks: ReconciliationCallbacks;

  constructor(
    config: Partial<ReconciliationConfig>,
    callbacks: ReconciliationCallbacks
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
  }

  /**
   * Run reconciliation for an organization
   */
  async reconcile(orgId: string): Promise<ReconciliationResult> {
    const startTime = new Date();

    log.info('Starting MercadoPago reconciliation', { orgId });

    const credentials = await this.callbacks.getCredentials(orgId);
    if (!credentials) {
      throw new Error('No credentials for organization');
    }

    const fromDate = new Date(Date.now() - this.config.lookbackHours * 60 * 60 * 1000);

    // Get local payments
    const localPayments = await this.callbacks.getLocalPayments(orgId, fromDate);

    // Get MP payments
    const mpPayments = await this.fetchMPPayments(credentials.accessToken, fromDate);

    // Reconcile
    const items = await this.comparePayments(
      localPayments,
      mpPayments,
      credentials.accessToken
    );

    // Process results
    const result = await this.processReconciliationItems(items);

    result.startTime = startTime;
    result.endTime = new Date();

    log.info('Reconciliation complete', {
      orgId,
      processed: result.totalProcessed,
      synced: result.synced,
      discrepancies: result.discrepancies,
      duration: result.endTime.getTime() - result.startTime.getTime(),
    });

    return result;
  }

  /**
   * Fetch payments from MercadoPago
   */
  private async fetchMPPayments(
    accessToken: string,
    fromDate: Date
  ): Promise<Payment[]> {
    const payments: Payment[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        sort: 'date_created',
        criteria: 'desc',
        range: 'date_created',
        begin_date: fromDate.toISOString(),
        end_date: new Date().toISOString(),
        offset: offset.toString(),
        limit: this.config.batchSize.toString(),
      });

      const result = await makeAuthenticatedRequest<{ results: Payment[]; paging: { total: number } }>(
        accessToken,
        'GET',
        `/v1/payments/search?${params.toString()}`
      );

      if (!result.success) {
        log.error('Failed to fetch MP payments', { error: result.error });
        break;
      }

      payments.push(...result.data.results);
      offset += result.data.results.length;
      hasMore = offset < result.data.paging.total && result.data.results.length > 0;
    }

    return payments;
  }

  /**
   * Compare local and MP payments
   */
  private async comparePayments(
    localPayments: LocalPaymentRecord[],
    mpPayments: Payment[],
    accessToken: string
  ): Promise<ReconciliationItem[]> {
    const items: ReconciliationItem[] = [];

    // Index local payments by MP ID
    const localByMpId = new Map<string, LocalPaymentRecord>();
    const localByInvoiceId = new Map<string, LocalPaymentRecord>();

    for (const local of localPayments) {
      if (local.mpPaymentId) {
        localByMpId.set(local.mpPaymentId, local);
      }
      localByInvoiceId.set(local.invoiceId, local);
    }

    // Check each MP payment
    for (const mpPayment of mpPayments) {
      const mpId = String(mpPayment.id);
      const local = localByMpId.get(mpId);

      if (!local) {
        // MP payment not in local DB
        items.push({
          mpPaymentId: mpId,
          status: 'missing_local',
          mpStatus: mpPayment.status,
          mpAmount: mpPayment.transactionAmount,
          externalReference: mpPayment.externalReference,
          discrepancy: 'Payment exists in MercadoPago but not locally',
        });
        continue;
      }

      // Check status match
      const localMpStatus = mapInternalToMPStatus(local.status);
      if (localMpStatus !== mpPayment.status) {
        items.push({
          mpPaymentId: mpId,
          localPaymentId: local.id,
          status: 'status_mismatch',
          mpStatus: mpPayment.status,
          localStatus: local.status,
          mpAmount: mpPayment.transactionAmount,
          localAmount: local.amount,
          discrepancy: `Status mismatch: local=${local.status}, MP=${mpPayment.status}`,
        });
        continue;
      }

      // Check amount match
      if (Math.abs(local.amount - mpPayment.transactionAmount) > 0.01) {
        items.push({
          mpPaymentId: mpId,
          localPaymentId: local.id,
          status: 'amount_mismatch',
          mpStatus: mpPayment.status,
          localStatus: local.status,
          mpAmount: mpPayment.transactionAmount,
          localAmount: local.amount,
          discrepancy: `Amount mismatch: local=${local.amount}, MP=${mpPayment.transactionAmount}`,
        });
        continue;
      }

      // Synced
      items.push({
        mpPaymentId: mpId,
        localPaymentId: local.id,
        status: 'synced',
        mpStatus: mpPayment.status,
        localStatus: local.status,
        mpAmount: mpPayment.transactionAmount,
        localAmount: local.amount,
      });
    }

    return items;
  }

  /**
   * Process reconciliation items
   */
  private async processReconciliationItems(
    items: ReconciliationItem[]
  ): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      totalProcessed: items.length,
      synced: 0,
      created: 0,
      updated: 0,
      discrepancies: 0,
      items,
      startTime: new Date(),
      endTime: new Date(),
    };

    for (const item of items) {
      switch (item.status) {
        case 'synced':
          result.synced++;
          break;

        case 'missing_local':
          result.discrepancies++;
          await this.callbacks.markDiscrepancy(item);
          break;

        case 'status_mismatch':
        case 'amount_mismatch':
          result.discrepancies++;
          await this.callbacks.markDiscrepancy(item);
          break;
      }
    }

    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

function mapInternalToMPStatus(internalStatus: string): PaymentStatus | null {
  const statusMap: Record<string, PaymentStatus> = {
    payment_pending: 'pending',
    paid: 'approved',
    payment_authorized: 'authorized',
    payment_processing: 'in_process',
    payment_disputed: 'in_mediation',
    payment_failed: 'rejected',
    cancelled: 'cancelled',
    refunded: 'refunded',
    charged_back: 'charged_back',
  };

  return statusMap[internalStatus] || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED RECONCILIATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScheduledReconciliationConfig {
  intervalHours: number;
  startHour: number; // UTC hour to run (e.g., 3 for 3am)
  organizations: string[];
}

export class ScheduledReconciliation {
  private service: MPReconciliationService;
  private config: ScheduledReconciliationConfig;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    service: MPReconciliationService,
    config: ScheduledReconciliationConfig
  ) {
    this.service = service;
    this.config = config;
  }

  start(): void {
    const checkInterval = 60 * 60 * 1000; // Check every hour
    this.interval = setInterval(() => this.checkAndRun(), checkInterval);
    log.info('Scheduled reconciliation started', { config: this.config });
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    log.info('Scheduled reconciliation stopped');
  }

  private async checkAndRun(): Promise<void> {
    const now = new Date();
    if (now.getUTCHours() !== this.config.startHour) {
      return;
    }

    log.info('Running scheduled reconciliation');

    for (const orgId of this.config.organizations) {
      try {
        await this.service.reconcile(orgId);
      } catch (error) {
        log.error('Scheduled reconciliation failed', {
          orgId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
  }

  async runNow(orgId: string): Promise<ReconciliationResult> {
    return this.service.reconcile(orgId);
  }
}
