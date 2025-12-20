/**
 * Subscription Testing Utilities
 * ================================
 *
 * Mock factories and utilities for testing subscription-related functionality:
 * - Subscription and payment mocks
 * - MercadoPago response mocks
 * - AFIP response mocks
 * - Verification document mocks
 * - Time manipulation for trial/expiry tests
 */

import { vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SubscriptionTier = 'FREE' | 'INICIAL' | 'PROFESIONAL' | 'EMPRESA';
export type SubscriptionStatus = 'active' | 'trialing' | 'expired' | 'cancelled' | 'past_due';
export type VerificationStatus = 'pending' | 'in_review' | 'verified' | 'rejected';
export type BlockType = 'soft_block' | 'hard_block' | null;
export type DocumentType = 'cuit' | 'dni_front' | 'dni_back' | 'selfie' | 'driver_license' | 'insurance';
export type DocumentStatus = 'pending' | 'review' | 'approved' | 'rejected' | 'expired';

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MockSubscriptionOptions {
  id?: string;
  organizationId?: string;
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date | null;
  cancelledAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

let subscriptionIdCounter = 1;

export function createMockSubscription(options: MockSubscriptionOptions = {}) {
  const id = options.id ?? `sub-${subscriptionIdCounter++}`;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  return {
    id,
    organizationId: options.organizationId ?? 'org-1',
    tier: options.tier ?? 'INICIAL',
    status: options.status ?? 'active',
    currentPeriodStart: options.currentPeriodStart ?? now,
    currentPeriodEnd: options.currentPeriodEnd ?? periodEnd,
    trialEndsAt: options.trialEndsAt ?? null,
    cancelledAt: options.cancelledAt ?? null,
    cancelAtPeriodEnd: options.cancelAtPeriodEnd ?? false,
    mercadoPagoSubscriptionId: `mp-sub-${id}`,
    createdAt: now,
    updatedAt: now,
  };
}

export function createMockTrialSubscription(daysRemaining: number = 14) {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + daysRemaining);

  return createMockSubscription({
    status: 'trialing',
    tier: 'INICIAL',
    trialEndsAt: trialEnd,
    currentPeriodEnd: trialEnd,
  });
}

export function createMockExpiredTrialSubscription() {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() - 1);

  return createMockSubscription({
    status: 'expired',
    tier: 'FREE',
    trialEndsAt: trialEnd,
    currentPeriodEnd: trialEnd,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MockPaymentOptions {
  id?: string;
  organizationId?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentMethod?: string;
  mercadoPagoPaymentId?: string;
  paidAt?: Date | null;
}

let paymentIdCounter = 1;

export function createMockPayment(options: MockPaymentOptions = {}) {
  const id = options.id ?? `pay-${paymentIdCounter++}`;
  const now = new Date();

  return {
    id,
    organizationId: options.organizationId ?? 'org-1',
    subscriptionId: options.subscriptionId ?? 'sub-1',
    amount: options.amount ?? 25000,
    currency: options.currency ?? 'ARS',
    status: options.status ?? 'completed',
    paymentMethod: options.paymentMethod ?? 'credit_card',
    mercadoPagoPaymentId: options.mercadoPagoPaymentId ?? `mp-pay-${id}`,
    paidAt: options.paidAt ?? (options.status === 'completed' ? now : null),
    createdAt: now,
    updatedAt: now,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MockVerificationDocumentOptions {
  id?: string;
  organizationId?: string;
  userId?: string;
  documentType?: DocumentType;
  status?: DocumentStatus;
  expiresAt?: Date | null;
  rejectionReason?: string | null;
}

let documentIdCounter = 1;

export function createMockVerificationDocument(options: MockVerificationDocumentOptions = {}) {
  const id = options.id ?? `doc-${documentIdCounter++}`;
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  return {
    id,
    organizationId: options.organizationId ?? 'org-1',
    userId: options.userId ?? 'user-1',
    documentType: options.documentType ?? 'dni_front',
    status: options.status ?? 'approved',
    fileUrl: `https://storage.example.com/docs/${id}.jpg`,
    expiresAt: options.expiresAt ?? expiresAt,
    rejectionReason: options.rejectionReason ?? null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function createMockVerifiedOrganization() {
  return {
    documents: [
      createMockVerificationDocument({ documentType: 'cuit', status: 'approved' }),
      createMockVerificationDocument({ documentType: 'dni_front', status: 'approved' }),
      createMockVerificationDocument({ documentType: 'dni_back', status: 'approved' }),
      createMockVerificationDocument({ documentType: 'selfie', status: 'approved' }),
    ],
    status: 'verified' as VerificationStatus,
  };
}

export function createMockExpiringDocument(daysUntilExpiry: number) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysUntilExpiry);

  return createMockVerificationDocument({
    status: 'approved',
    expiresAt,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION WITH SUBSCRIPTION MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MockOrgWithSubscriptionOptions {
  id?: string;
  name?: string;
  cuit?: string;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  verificationStatus?: VerificationStatus;
  blockType?: BlockType;
  blockReason?: string | null;
  trialEndsAt?: Date | null;
}

let orgSubIdCounter = 1;

export function createMockOrgWithSubscription(options: MockOrgWithSubscriptionOptions = {}) {
  const id = options.id ?? `org-sub-${orgSubIdCounter++}`;
  const now = new Date();

  return {
    id,
    name: options.name ?? `Test Org ${id}`,
    cuit: options.cuit ?? '30-12345678-9',
    subscriptionTier: options.subscriptionTier ?? 'INICIAL',
    subscriptionStatus: options.subscriptionStatus ?? 'active',
    verificationStatus: options.verificationStatus ?? 'verified',
    verificationCompletedAt: options.verificationStatus === 'verified' ? now : null,
    blockType: options.blockType ?? null,
    blockReason: options.blockReason ?? null,
    trialEndsAt: options.trialEndsAt ?? null,
    onboardingCompletedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function createMockTrialOrg(daysRemaining: number = 14) {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + daysRemaining);

  return createMockOrgWithSubscription({
    subscriptionTier: 'INICIAL',
    subscriptionStatus: 'trialing',
    trialEndsAt: trialEnd,
    verificationStatus: 'pending',
  });
}

export function createMockBlockedOrg(blockType: BlockType = 'soft_block') {
  return createMockOrgWithSubscription({
    subscriptionStatus: 'expired',
    blockType,
    blockReason: blockType === 'hard_block'
      ? 'Account suspended for non-payment'
      : 'Trial expired - limited access',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MERCADOPAGO MOCK RESPONSES
// ═══════════════════════════════════════════════════════════════════════════════

export const mockMercadoPagoResponses = {
  // Payment responses
  paymentApproved: (paymentId: string = 'mp-123') => ({
    id: paymentId,
    status: 'approved',
    status_detail: 'accredited',
    payment_type_id: 'credit_card',
    payment_method_id: 'visa',
    transaction_amount: 25000,
    currency_id: 'ARS',
    date_created: new Date().toISOString(),
    date_approved: new Date().toISOString(),
    payer: {
      id: 'payer-123',
      email: 'test@example.com',
    },
    metadata: {
      organization_id: 'org-1',
    },
  }),

  paymentPending: (paymentId: string = 'mp-123') => ({
    id: paymentId,
    status: 'pending',
    status_detail: 'pending_contingency',
    transaction_amount: 25000,
    currency_id: 'ARS',
    date_created: new Date().toISOString(),
  }),

  paymentRejected: (paymentId: string = 'mp-123', reason: string = 'cc_rejected_bad_filled_security_code') => ({
    id: paymentId,
    status: 'rejected',
    status_detail: reason,
    transaction_amount: 25000,
    currency_id: 'ARS',
    date_created: new Date().toISOString(),
  }),

  // Webhook payloads
  webhookPaymentApproved: (dataId: string = 'mp-123') => ({
    id: `webhook-${Date.now()}`,
    type: 'payment',
    action: 'payment.created',
    data: { id: dataId },
    live_mode: false,
    date_created: new Date().toISOString(),
    api_version: 'v1',
  }),

  webhookSubscriptionCreated: (dataId: string = 'mp-sub-123') => ({
    id: `webhook-${Date.now()}`,
    type: 'subscription_preapproval',
    action: 'created',
    data: { id: dataId },
    live_mode: false,
    date_created: new Date().toISOString(),
  }),

  // Subscription responses
  subscriptionActive: (subscriptionId: string = 'mp-sub-123') => ({
    id: subscriptionId,
    status: 'authorized',
    reason: 'Plan INICIAL - CampoTech',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 25000,
      currency_id: 'ARS',
    },
    payer_id: 'payer-123',
    date_created: new Date().toISOString(),
  }),

  // Refund responses
  refundSuccess: (refundId: string = 'refund-123', amount: number = 25000) => ({
    id: refundId,
    payment_id: 'mp-123',
    amount,
    status: 'approved',
    date_created: new Date().toISOString(),
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// AFIP MOCK RESPONSES
// ═══════════════════════════════════════════════════════════════════════════════

export const mockAFIPResponses = {
  // CUIT verification
  cuitValid: (cuit: string = '30-12345678-9') => ({
    success: true,
    data: {
      cuit: cuit.replace(/-/g, ''),
      denominacion: 'Test Company SA',
      tipoPersona: 'JURIDICA',
      estadoClave: 'ACTIVO',
      domicilioFiscal: {
        direccion: 'Av. Corrientes 1234',
        localidad: 'Ciudad Autónoma de Buenos Aires',
        provincia: 'CABA',
        codigoPostal: '1043',
      },
      actividades: [
        { codigo: '620100', descripcion: 'Servicios de consultores en informática' },
      ],
      impuestos: [
        { codigo: '30', descripcion: 'IVA' },
        { codigo: '32', descripcion: 'Ganancias' },
      ],
      fechaInscripcion: '2015-03-15',
    },
  }),

  cuitInvalid: (cuit: string) => ({
    success: false,
    error: {
      code: 'CUIT_NOT_FOUND',
      message: `CUIT ${cuit} not found in AFIP database`,
    },
  }),

  cuitInactive: (cuit: string = '30-12345678-9') => ({
    success: true,
    data: {
      cuit: cuit.replace(/-/g, ''),
      denominacion: 'Inactive Company SA',
      tipoPersona: 'JURIDICA',
      estadoClave: 'INACTIVO',
    },
  }),

  // Service unavailable
  serviceUnavailable: () => ({
    success: false,
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'AFIP service is temporarily unavailable',
    },
  }),

  // Timeout
  timeout: () => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AFIP request timed out')), 100);
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL MOCK
// ═══════════════════════════════════════════════════════════════════════════════

export function createMockEmailService() {
  const sentEmails: Array<{
    to: string;
    subject: string;
    template: string;
    data: Record<string, unknown>;
  }> = [];

  return {
    sendEmail: vi.fn().mockImplementation(async (options) => {
      sentEmails.push({
        to: options.to,
        subject: options.subject,
        template: options.template,
        data: options.data,
      });
      return { success: true, messageId: `msg-${Date.now()}` };
    }),
    getSentEmails: () => sentEmails,
    clearSentEmails: () => sentEmails.length = 0,
    getLastEmail: () => sentEmails[sentEmails.length - 1],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME MANIPULATION
// ═══════════════════════════════════════════════════════════════════════════════

let originalDate: typeof Date;
let frozenTime: Date | null = null;

export function freezeTime(date: Date = new Date()) {
  originalDate = global.Date;
  frozenTime = date;

  const MockDate = class extends Date {
    constructor(...args: (string | number | Date)[]) {
      if (args.length === 0) {
        super(frozenTime!);
      } else {
        // @ts-expect-error - spread args
        super(...args);
      }
    }

    static now() {
      return frozenTime!.getTime();
    }
  };

  global.Date = MockDate as DateConstructor;
}

export function advanceTime(days: number) {
  if (!frozenTime) {
    frozenTime = new Date();
  }
  frozenTime = new Date(frozenTime.getTime() + days * 24 * 60 * 60 * 1000);
}

export function advanceTimeHours(hours: number) {
  if (!frozenTime) {
    frozenTime = new Date();
  }
  frozenTime = new Date(frozenTime.getTime() + hours * 60 * 60 * 1000);
}

export function unfreezeTime() {
  if (originalDate) {
    global.Date = originalDate;
    frozenTime = null;
  }
}

export function getCurrentFrozenTime(): Date | null {
  return frozenTime;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRISMA MOCK
// ═══════════════════════════════════════════════════════════════════════════════

export function createMockPrisma() {
  const mockData: {
    organizations: Map<string, ReturnType<typeof createMockOrgWithSubscription>>;
    subscriptions: Map<string, ReturnType<typeof createMockSubscription>>;
    payments: Map<string, ReturnType<typeof createMockPayment>>;
    documents: Map<string, ReturnType<typeof createMockVerificationDocument>>;
    events: Array<Record<string, unknown>>;
  } = {
    organizations: new Map(),
    subscriptions: new Map(),
    payments: new Map(),
    documents: new Map(),
    events: [],
  };

  return {
    organization: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockData.organizations.get(where.id) || null);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const org = mockData.organizations.get(where.id);
        if (org) {
          const updated = { ...org, ...data, updatedAt: new Date() };
          mockData.organizations.set(where.id, updated);
          return Promise.resolve(updated);
        }
        return Promise.reject(new Error('Organization not found'));
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const org = { ...data, id: data.id || `org-${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
        mockData.organizations.set(org.id, org);
        return Promise.resolve(org);
      }),
    },
    organizationSubscription: {
      findFirst: vi.fn().mockImplementation(() => {
        const subs = Array.from(mockData.subscriptions.values());
        return Promise.resolve(subs[0] || null);
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const sub = { ...data, id: data.id || `sub-${Date.now()}`, createdAt: new Date() };
        mockData.subscriptions.set(sub.id, sub);
        return Promise.resolve(sub);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const sub = mockData.subscriptions.get(where.id);
        if (sub) {
          const updated = { ...sub, ...data };
          mockData.subscriptions.set(where.id, updated);
          return Promise.resolve(updated);
        }
        return Promise.reject(new Error('Subscription not found'));
      }),
    },
    subscriptionPayment: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockData.payments.get(where.id) || null);
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const payment = { ...data, id: data.id || `pay-${Date.now()}`, createdAt: new Date() };
        mockData.payments.set(payment.id, payment);
        return Promise.resolve(payment);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const payment = mockData.payments.get(where.id);
        if (payment) {
          const updated = { ...payment, ...data };
          mockData.payments.set(where.id, updated);
          return Promise.resolve(updated);
        }
        return Promise.reject(new Error('Payment not found'));
      }),
    },
    subscriptionEvent: {
      create: vi.fn().mockImplementation(({ data }) => {
        const event = { ...data, id: `event-${Date.now()}`, createdAt: new Date() };
        mockData.events.push(event);
        return Promise.resolve(event);
      }),
      findMany: vi.fn().mockImplementation(() => Promise.resolve(mockData.events)),
    },
    verificationDocument: {
      findMany: vi.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(mockData.documents.values()));
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const doc = { ...data, id: data.id || `doc-${Date.now()}`, createdAt: new Date() };
        mockData.documents.set(doc.id, doc);
        return Promise.resolve(doc);
      }),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      // Simple mock: just execute the callback
      if (typeof callback === 'function') {
        return callback({
          organization: { update: vi.fn(), create: vi.fn() },
          organizationSubscription: { update: vi.fn(), create: vi.fn() },
          subscriptionPayment: { update: vi.fn(), create: vi.fn() },
          subscriptionEvent: { create: vi.fn() },
        });
      }
      return Promise.all(callback);
    }),

    // Helper methods for tests
    _mockData: mockData,
    _addOrganization: (org: ReturnType<typeof createMockOrgWithSubscription>) => {
      mockData.organizations.set(org.id, org);
    },
    _addSubscription: (sub: ReturnType<typeof createMockSubscription>) => {
      mockData.subscriptions.set(sub.id, sub);
    },
    _addPayment: (payment: ReturnType<typeof createMockPayment>) => {
      mockData.payments.set(payment.id, payment);
    },
    _addDocument: (doc: ReturnType<typeof createMockVerificationDocument>) => {
      mockData.documents.set(doc.id, doc);
    },
    _clearAll: () => {
      mockData.organizations.clear();
      mockData.subscriptions.clear();
      mockData.payments.clear();
      mockData.documents.clear();
      mockData.events.length = 0;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESET HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function resetSubscriptionCounters() {
  subscriptionIdCounter = 1;
  paymentIdCounter = 1;
  documentIdCounter = 1;
  orgSubIdCounter = 1;
}

export function resetAllMocks() {
  resetSubscriptionCounters();
  unfreezeTime();
}
