/**
 * API Validation Schemas (Zod)
 * ============================
 * 
 * Centralized validation schemas for API route handlers.
 * 
 * Security Fix: LOW-3 from Phase 6 Authorization Audit
 * - Provides runtime schema validation for all update operations
 * - Replaces manual validation with type-safe Zod schemas
 * - Prevents malformed or malicious input from reaching Prisma
 * 
 * Usage:
 * ```typescript
 * import { laborRateSchema, validateBody } from '@/lib/validation/api-schemas';
 * 
 * const result = validateBody(body, laborRateSchema);
 * if (!result.success) {
 *   return NextResponse.json({ success: false, error: result.error }, { status: 400 });
 * }
 * const validData = result.data;
 * ```
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates request body against a Zod schema
 * Returns either { success: true, data } or { success: false, error }
 */
export function validateBody<T extends z.ZodSchema>(
    body: unknown,
    schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string } {
    const result = schema.safeParse(body);
    if (!result.success) {
        const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: `Validation error: ${errors}` };
    }
    return { success: true, data: result.data };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Labor Rates
export const laborRateSchema = z.object({
    specialty: z.string().min(1, 'Especialidad requerida'),
    category: z.string().min(1, 'Categoría requerida'),
    hourlyRate: z.number().nonnegative('Tarifa debe ser positiva'),
    notes: z.string().optional(),
});

export const laborRateBulkSchema = z.object({
    rates: z.array(laborRateSchema),
});

// Pricing Settings
export const pricingSettingsSchema = z.object({
    exchangeRateSource: z.enum(['OFICIAL', 'BLUE', 'MEP', 'CCL', 'CRYPTO', 'CUSTOM']).optional(),
    customExchangeRate: z.number().positive().optional().nullable(),
    exchangeRateMarkup: z.number().min(-100).max(1000).optional(),
    exchangeRateLabel: z.string().max(50).optional().nullable(),
    autoUpdateExchangeRate: z.boolean().optional(),
    roundingStrategy: z.enum(['NO_ROUNDING', 'ROUND_100', 'ROUND_500', 'ROUND_1000', 'ROUND_5000']).optional(),
    roundingDirection: z.enum(['NEAREST', 'UP', 'DOWN']).optional(),
    autoUpdateThreshold: z.number().min(0).max(100).optional(),
});

// Pricing Rules
export const pricingRulesSchema = z.object({
    techCanModifyPricing: z.boolean().optional(),
    techMaxAdjustmentPercent: z.number().min(0).max(100).optional().nullable(),
    techMaxAdjustmentAmount: z.number().nonnegative().optional().nullable(),
    requireApprovalOverLimit: z.boolean().optional(),
    invoiceGeneration: z.enum(['MANUAL', 'AUTO_ON_COMPLETE', 'AUTO_24H']).optional(),
    autoLockOnInvoice: z.boolean().optional(),
    enableDeposits: z.boolean().optional(),
    defaultDepositPercent: z.number().min(0).max(100).optional().nullable(),
    requireDepositToStart: z.boolean().optional(),
    usePriceBook: z.boolean().optional(),
    priceBookMandatory: z.boolean().optional(),
});

// Service Types
export const serviceTypeUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    color: z.string().max(20).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    sortOrder: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
});

// WhatsApp Settings (for PUT /api/settings/whatsapp)
export const whatsappSettingsSchema = z.object({
    personalNumber: z.string().max(30).optional().nullable(),
    integrationType: z.enum(['NONE', 'WAME_LINK', 'BSP_API']).optional(),
    phoneNumberId: z.string().max(100).optional().nullable(),
    businessAccountId: z.string().max(100).optional().nullable(),
    accessToken: z.string().max(500).optional().nullable(),
    appSecret: z.string().max(200).optional().nullable(),
    webhookVerifyToken: z.string().max(100).optional().nullable(),
});

// WhatsApp Templates (for PUT /api/settings/whatsapp/templates)
export const whatsappTemplateListSchema = z.object({
    templates: z.array(z.object({
        id: z.string().min(1),
        template: z.string().min(1).max(4096),
    })),
});

// MercadoPago Settings (for PUT /api/settings/mercadopago)
export const mercadopagoSettingsSchema = z.object({
    accessToken: z.string().max(500).optional().nullable(),
    publicKey: z.string().max(200).optional().nullable(),
    environment: z.enum(['sandbox', 'production']).optional(),
});

// Pricebook Item
export const pricebookItemSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    type: z.enum(['SERVICE', 'PRODUCT', 'service', 'product']).optional(),
    price: z.number().nonnegative().optional(),
    unit: z.string().max(20).optional().nullable(),
    taxRate: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    priceCurrency: z.enum(['ARS', 'USD']).optional(),
    priceInUsd: z.number().nonnegative().optional().nullable(),
});

// AI Assistant Settings
export const aiAssistantSettingsSchema = z.object({
    isEnabled: z.boolean().optional(),
    autoResponseEnabled: z.boolean().optional(),
    minConfidenceToRespond: z.number().min(0).max(100).optional(),
    minConfidenceToCreateJob: z.number().min(0).max(100).optional(),
    dataAccessPermissions: z.record(z.boolean()).optional(),
    companyName: z.string().max(200).optional().nullable(),
    companyDescription: z.string().max(2000).optional().nullable(),
    servicesOffered: z.array(z.string()).optional(),
    businessHours: z.record(z.unknown()).optional(),
    serviceAreas: z.string().max(500).optional().nullable(),
    pricingInfo: z.string().max(2000).optional().nullable(),
    cancellationPolicy: z.string().max(1000).optional().nullable(),
    paymentMethods: z.string().max(500).optional().nullable(),
    warrantyInfo: z.string().max(1000).optional().nullable(),
    faqItems: z.array(z.unknown()).optional(),
    customInstructions: z.string().max(4000).optional().nullable(),
    aiTone: z.enum(['friendly_professional', 'formal', 'casual']).optional(),
    greetingMessage: z.string().max(500).optional().nullable(),
    awayMessage: z.string().max(500).optional().nullable(),
    transferKeywords: z.array(z.string()).optional(),
    escalationUserId: z.string().uuid().optional().nullable(),
});

// AFIP Settings (for PUT /api/settings/afip)
export const afipSettingsSchema = z.object({
    cuit: z.string().max(15).optional(),
    puntoVenta: z.string().max(10).optional(),
    environment: z.enum(['testing', 'production']).optional(),
    certificate: z.string().max(10000).optional(),
    privateKey: z.string().max(10000).optional(),
});

// Language Settings
export const languageSettingsSchema = z.object({
    primaryLanguage: z.string().length(2),
    supportedLanguages: z.array(z.string().length(2)).optional(),
    autoDetect: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CORE ENTITY SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Job Status Update
export const jobStatusSchema = z.object({
    status: z.enum([
        'PENDING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS',
        'COMPLETED', 'CANCELLED', 'ON_HOLD', 'PENDING_APPROVAL'
    ]),
    notes: z.string().max(1000).optional(),
    completedAt: z.string().datetime().optional(),
});

// Job Assignment
export const jobAssignSchema = z.object({
    technicianId: z.string().uuid(),
    scheduledDate: z.string().datetime().optional(),
    notes: z.string().max(500).optional(),
});

// Job Unassignment
export const jobUnassignSchema = z.object({
    reason: z.string().max(500).optional(),
});

// Job Confirmation Code
export const jobConfirmationCodeSchema = z.object({
    code: z.string().length(6),
    type: z.enum(['START', 'COMPLETE']).optional(),
});

// Job Line Item
export const jobLineItemSchema = z.object({
    description: z.string().min(1).max(500),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    discount: z.number().min(0).max(100).optional(),
    taxRate: z.number().min(0).max(100).optional(),
});

// Job Visit Pricing
export const jobVisitPricingSchema = z.object({
    laborHours: z.number().nonnegative().optional(),
    laborRate: z.number().nonnegative().optional(),
    materialsTotal: z.number().nonnegative().optional(),
    discount: z.number().min(0).max(100).optional(),
    notes: z.string().max(1000).optional(),
});

// Invoice Update
export const invoiceUpdateSchema = z.object({
    status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'PARTIAL']).optional(),
    dueDate: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
    paymentMethod: z.string().max(50).optional(),
});

// Employee Verification
export const employeeVerificationSchema = z.object({
    documentType: z.string().max(50),
    documentNumber: z.string().max(50),
    expirationDate: z.string().datetime().optional(),
    status: z.enum(['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED']).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Job Materials
export const jobMaterialsSchema = z.object({
    jobId: z.string().uuid(),
    materials: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative().optional(),
    })),
});

// Supplier
export const supplierSchema = z.object({
    name: z.string().min(1).max(200),
    code: z.string().min(1).max(20).optional(), // Required for creation
    cuit: z.string().regex(/^\d{11}$/).optional().nullable(),
    taxId: z.string().max(20).optional().nullable(), // Alias for cuit
    email: z.string().email().optional().nullable(),
    contactEmail: z.string().email().optional().nullable(), // Alias
    phone: z.string().max(30).optional().nullable(),
    contactPhone: z.string().max(30).optional().nullable(), // Alias
    address: z.union([z.string().max(500), z.record(z.unknown())]).optional().nullable(),
    contactName: z.string().max(100).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    paymentTermDays: z.number().int().min(0).max(365).optional(),
    paymentTerms: z.number().int().min(0).max(365).optional(), // Alias
    isActive: z.boolean().optional(),
    // Additional address fields
    street: z.string().max(200).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
    country: z.string().max(50).optional().nullable(),
});

// Supplier Product Association
export const supplierProductSchema = z.object({
    action: z.literal('addProduct'),
    supplierId: z.string().uuid(),
    productId: z.string().uuid(),
    supplierSku: z.string().max(50).optional().nullable(),
    supplierPrice: z.number().nonnegative().optional(),
    leadTimeDays: z.number().int().min(0).max(365).optional().nullable(),
    isPreferred: z.boolean().optional(),
});

// Warehouse
export const warehouseSchema = z.object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(20).optional(), // Required for creation
    type: z.enum(['MAIN', 'VEHICLE', 'CONSIGNMENT', 'DROPSHIP']).optional(),
    address: z.union([z.string().max(500), z.record(z.unknown())]).optional().nullable(),
    contactName: z.string().max(100).optional().nullable(),
    contactPhone: z.string().max(30).optional().nullable(),
    contactEmail: z.string().email().optional().nullable(),
    isDefault: z.boolean().optional(),
    allowNegative: z.boolean().optional(),
    isActive: z.boolean().optional(),
});

// Purchase Order
export const purchaseOrderSchema = z.object({
    status: z.enum(['DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CANCELLED']).optional(),
    expectedDate: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
});

// Category
export const categorySchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().nullable(),
    parentId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
});

// Product
export const productSchema = z.object({
    name: z.string().min(1).max(200),
    sku: z.string().max(50).optional().nullable(),
    barcode: z.string().max(50).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    unit: z.string().max(20).optional(),
    costPrice: z.number().nonnegative().optional(),
    salePrice: z.number().nonnegative().optional(),
    minStock: z.number().int().nonnegative().optional(),
    maxStock: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// JOB WORKFLOW EXTENDED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Confirmation Code Verification (for PUT /api/jobs/[id]/confirmation-code)
export const confirmationCodeSchema = z.object({
    code: z.string().min(1).max(10),
});

// Job Line Item Update (for PUT /api/jobs/[id]/line-items/[itemId])
export const jobLineItemUpdateSchema = z.object({
    description: z.string().max(500).optional(),
    quantity: z.number().positive().optional(),
    unitPrice: z.number().nonnegative().optional(),
    unit: z.string().max(20).optional(),
    notes: z.string().max(1000).optional().nullable(),
});

// Visit Pricing Update (for PUT /api/jobs/[id]/visits/[visitId]/pricing)
export const visitPricingSchema = z.object({
    estimatedPrice: z.number().nonnegative().optional(),
    actualPrice: z.number().nonnegative().optional(),
    techProposedPrice: z.number().nonnegative().optional(),
    priceVarianceReason: z.string().max(500).optional().nullable(),
    requiresDeposit: z.boolean().optional(),
    depositAmount: z.number().nonnegative().optional(),
});


// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Notification Preferences (for PUT /api/notifications/preferences)
export const notificationPreferencesFullSchema = z.object({
    webEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    whatsappEnabled: z.boolean().optional(),
    eventPreferences: z.record(z.record(z.boolean())).optional(),
    reminderIntervals: z.array(z.number().int().positive()).optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    quietHoursTimezone: z.string().max(50).optional(),
});

// Notification Mark as Read
export const notificationMarkReadSchema = z.object({
    notificationIds: z.array(z.string().uuid()).optional(),
});

// Notification Verification
export const notificationVerificationSchema = z.object({
    code: z.string().min(4).max(10),
    channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY EXTENDED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Stock Adjustment Schema (extended)
export const stockAdjustmentExtendedSchema = z.object({
    productId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    adjustmentType: z.string(),
    quantity: z.number(),
    reason: z.string().max(500).optional(),
    notes: z.string().max(500).optional(),
    costPerUnit: z.number().nonnegative().optional(),
});

// Stock Transfer
export const stockTransferSchema = z.object({
    productId: z.string().uuid(),
    fromWarehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    quantity: z.number().int().positive(),
    notes: z.string().max(500).optional(),
});

// Stock Count Create
export const stockCountCreateSchema = z.object({
    action: z.literal('create').optional(),
    warehouseId: z.string().uuid(),
    countType: z.enum(['FULL', 'PARTIAL', 'CYCLE']).optional(),
    productIds: z.array(z.string().uuid()).optional(),
    assignedToId: z.string().uuid().optional().nullable(),
    scheduledAt: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
});

// Stock Count Record
export const stockCountRecordSchema = z.object({
    action: z.literal('recordCount'),
    countItemId: z.string().uuid(),
    countedQty: z.number().int().nonnegative(),
    notes: z.string().max(500).optional(),
});

// Purchase Order Create
export const purchaseOrderCreateSchema = z.object({
    supplierId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    expectedDate: z.string().datetime().optional(),
    expectedDeliveryDate: z.string().datetime().optional(),
    taxAmount: z.number().nonnegative().optional(),
    notes: z.string().max(1000).optional(),
    items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative().optional(),
        unitCost: z.number().nonnegative().optional(),
        notes: z.string().max(500).optional(),
    })),
});

// Purchase Order Receive
export const purchaseOrderReceiveSchema = z.object({
    action: z.literal('receive'),
    orderId: z.string().uuid(),
    items: z.array(z.object({
        itemId: z.string().uuid(),
        quantity: z.union([z.number().int().nonnegative(), z.string()]),
        notes: z.string().max(500).optional(),
    })),
    notes: z.string().max(1000).optional(),
});

// Purchase Order Action (send/cancel)
export const purchaseOrderActionSchema = z.object({
    action: z.enum(['send', 'cancel']),
    orderId: z.string().uuid(),
    reason: z.string().max(500).optional(),
});

// Purchase Order Update
export const purchaseOrderUpdateSchema = z.object({
    id: z.string().uuid(),
    expectedDate: z.string().datetime().optional(),
    expectedDeliveryDate: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
    taxAmount: z.number().nonnegative().optional(),
    items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative().optional(),
        unitCost: z.number().nonnegative().optional(),
        notes: z.string().max(500).optional(),
    })).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// OTHER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

// Employee Schedule
export const employeeScheduleSchema = z.object({
    userId: z.string().uuid(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isAvailable: z.boolean().optional(),
});

export const employeeScheduleBulkSchema = z.object({
    schedules: z.array(employeeScheduleSchema),
});

// Change Request
export const changeRequestSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    reviewNotes: z.string().max(1000).optional(),
});

// Scheduled Report
export const scheduledReportSchema = z.object({
    name: z.string().min(1).max(100),
    type: z.string().max(50),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    recipients: z.array(z.string().email()),
    isActive: z.boolean().optional(),
});

// WhatsApp Conversation
export const whatsappConversationSchema = z.object({
    status: z.enum(['OPEN', 'CLOSED', 'PENDING']).optional(),
    assignedTo: z.string().uuid().optional().nullable(),
    notes: z.string().max(1000).optional(),
});

// WhatsApp Send Message
export const whatsappSendMessageSchema = z.object({
    to: z.string().min(1).max(20),
    type: z.enum(['text', 'template', 'image', 'document']).optional(),
    text: z.object({ body: z.string().max(4096) }).optional(),
    template: z.object({
        name: z.string(),
        language: z.object({ code: z.string() }),
        components: z.array(z.unknown()).optional(),
    }).optional(),
});

// WhatsApp Interactive
export const whatsappInteractiveSchema = z.object({
    conversationId: z.string().uuid(),
    type: z.enum(['button', 'list']),
    body: z.string().max(1024),
    buttons: z.array(z.object({
        id: z.string(),
        title: z.string().max(20),
    })).optional(),
    sections: z.array(z.unknown()).optional(),
});

