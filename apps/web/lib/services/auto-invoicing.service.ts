/**
 * Auto-Invoicing Service
 * ======================
 *
 * Phase 2 of the Unified Billing Hub.
 *
 * Automatically creates invoices, submits to AFIP, and notifies customers
 * when a job is completed and payment is collected.
 *
 * Triggers:
 *   1. Mobile sync: technician collects payment → processPaymentSync → here
 *   2. Web dashboard: job status → COMPLETED → here
 *
 * Flow:
 *   Job COMPLETED + payment collected
 *     → Check org auto-invoicing settings
 *     → Create Factura C from job line items
 *     → (Optional) Submit to AFIP for CAE
 *     → (Optional) Send WhatsApp to customer with invoice
 *
 * Settings (stored in Organization.settings JSON):
 *   autoInvoiceEnabled:  boolean — create invoice on payment collection
 *   autoAfipSubmit:      boolean — auto-submit to AFIP queue (requires AFIP configured)
 *   autoWhatsappInvoice: boolean — auto-send invoice via WhatsApp
 *   defaultInvoiceType:  'C' | 'B' | 'A' — default invoice type (usually 'C' for monotributo)
 */

import { prisma } from '@/lib/prisma';
import { InvoiceService } from '@/services/invoice.service';
import { getAFIPClient } from '@/lib/integrations/afip/client';
import { onInvoiceCreated } from '@/src/modules/whatsapp/notification-triggers.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AutoInvoiceSettings {
    autoInvoiceEnabled: boolean;
    autoAfipSubmit: boolean;
    autoWhatsappInvoice: boolean;
    defaultInvoiceType: 'C' | 'B' | 'A';
}

export interface AutoInvoiceResult {
    triggered: boolean;
    invoiceId?: string;
    invoiceNumber?: string;
    afipQueued?: boolean;
    whatsappSent?: boolean;
    skippedReason?: string;
    error?: string;
}




// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get auto-invoicing settings for an organization.
 * Settings are stored in the Organization.settings JSON field.
 */
export async function getAutoInvoiceSettings(orgId: string): Promise<AutoInvoiceSettings> {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
    });

    const settings = (org?.settings as Record<string, unknown>) || {};

    return {
        autoInvoiceEnabled: settings.autoInvoiceEnabled === true,
        autoAfipSubmit: settings.autoAfipSubmit === true,
        autoWhatsappInvoice: settings.autoWhatsappInvoice === true,
        defaultInvoiceType: (['A', 'B', 'C'].includes(settings.defaultInvoiceType as string)
            ? settings.defaultInvoiceType
            : 'C') as 'C' | 'B' | 'A',
    };
}

/**
 * Update auto-invoicing settings for an organization.
 */
export async function updateAutoInvoiceSettings(
    orgId: string,
    updates: Partial<AutoInvoiceSettings>
): Promise<AutoInvoiceSettings> {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
    });

    const currentSettings = (org?.settings as Record<string, unknown>) || {};

    // Merge updates into existing settings
    const newSettings = {
        ...currentSettings,
        ...(updates.autoInvoiceEnabled !== undefined && { autoInvoiceEnabled: updates.autoInvoiceEnabled }),
        ...(updates.autoAfipSubmit !== undefined && { autoAfipSubmit: updates.autoAfipSubmit }),
        ...(updates.autoWhatsappInvoice !== undefined && { autoWhatsappInvoice: updates.autoWhatsappInvoice }),
        ...(updates.defaultInvoiceType !== undefined && { defaultInvoiceType: updates.defaultInvoiceType }),
    };

    await prisma.organization.update({
        where: { id: orgId },
        data: { settings: newSettings },
    });

    return getAutoInvoiceSettings(orgId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE: AUTO-INVOICE ON JOB COMPLETED
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main entry point: attempt to auto-create an invoice for a completed job.
 *
 * Call this after:
 *   1. processPaymentSync sets status to COMPLETED
 *   2. Job status API sets status to COMPLETED
 *
 * This function is fire-and-forget safe — all errors are caught and logged.
 */
export async function tryAutoInvoice(
    jobId: string,
    orgId: string,
    userId?: string
): Promise<AutoInvoiceResult> {
    const tag = `[AutoInvoice] job=${jobId}`;

    try {
        // ─────────────────────────────────────────────────────────────────────────
        // 1. Check settings
        // ─────────────────────────────────────────────────────────────────────────
        const settings = await getAutoInvoiceSettings(orgId);

        if (!settings.autoInvoiceEnabled) {
            console.log(`${tag} Skipped: auto-invoicing disabled`);
            return { triggered: false, skippedReason: 'Auto-facturación deshabilitada' };
        }

        // ─────────────────────────────────────────────────────────────────────────
        // 2. Fetch job with line items and customer
        // ─────────────────────────────────────────────────────────────────────────
        const job = await prisma.job.findFirst({
            where: { id: jobId, organizationId: orgId },
            include: {
                customer: { select: { id: true, name: true, phone: true, cuit: true } },
                lineItems: {
                    select: {
                        description: true,
                        quantity: true,
                        unitPrice: true,
                        taxRate: true,
                        total: true,
                        taxAmount: true,
                    },
                },
                invoice: { select: { id: true } }, // Check if invoice already exists
            },
        });

        if (!job) {
            console.error(`${tag} Skipped: job not found`);
            return { triggered: false, skippedReason: 'Trabajo no encontrado' };
        }

        // Guard: already has an invoice
        if (job.invoice) {
            console.log(`${tag} Skipped: invoice already exists (${job.invoice.id})`);
            return { triggered: false, skippedReason: 'Ya tiene factura generada' };
        }

        // Guard: not COMPLETED
        if (job.status !== 'COMPLETED') {
            console.log(`${tag} Skipped: job status is ${job.status}`);
            return { triggered: false, skippedReason: `Estado del trabajo: ${job.status}` };
        }

        // Guard: no customer
        if (!job.customerId || !job.customer) {
            console.warn(`${tag} Skipped: no customer linked to job`);
            return { triggered: false, skippedReason: 'Sin cliente asignado' };
        }

        // ─────────────────────────────────────────────────────────────────────────
        // 3. Build line items from job
        // ─────────────────────────────────────────────────────────────────────────
        let lineItems: Array<{
            description: string;
            quantity: number;
            unitPrice: number;
            ivaRate: number;
        }>;

        if (job.lineItems.length > 0) {
            // Use job line items
            lineItems = job.lineItems.map((item: { description: string; quantity: unknown; unitPrice: unknown; taxRate: unknown }) => ({
                description: item.description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                ivaRate: Number(item.taxRate),
            }));
        } else {
            // Fallback: create a single line item from job total
            const total = Number(job.finalTotal || job.estimatedTotal || 0);

            if (total <= 0) {
                console.warn(`${tag} Skipped: no line items and no total amount`);
                return { triggered: false, skippedReason: 'Sin ítems ni monto para facturar' };
            }

            // For Factura C (monotributo), IVA is 0% — the total IS the total
            const ivaRate = settings.defaultInvoiceType === 'C' ? 0 : 21;
            const unitPrice = ivaRate > 0 ? total / (1 + ivaRate / 100) : total;

            lineItems = [{
                description: job.serviceType
                    ? `Servicio de ${job.serviceType.toLowerCase()}`
                    : 'Servicio técnico',
                quantity: 1,
                unitPrice,
                ivaRate,
            }];
        }

        // ─────────────────────────────────────────────────────────────────────────
        // 4. Create invoice via InvoiceService
        // ─────────────────────────────────────────────────────────────────────────
        const shouldSubmitToAfip = settings.autoAfipSubmit;

        console.log(
            `${tag} Creating invoice: type=${settings.defaultInvoiceType}, ` +
            `items=${lineItems.length}, afip=${shouldSubmitToAfip}`
        );

        const invoice = await InvoiceService.createInvoice(
            orgId,
            {
                customerId: job.customerId,
                invoiceType: settings.defaultInvoiceType,
                jobId: job.id,
                lineItems,
                // If we're auto-submitting to AFIP, don't create as draft (status: PENDING)
                // If not, create as DRAFT so the owner can review first
                asDraft: !shouldSubmitToAfip,
            },
            userId
        );

        console.log(
            `${tag} ✅ Invoice created: id=${invoice.id}, number=${invoice.invoiceNumber}`
        );

        const result: AutoInvoiceResult = {
            triggered: true,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            afipQueued: false,
            whatsappSent: false,
        };

        // ─────────────────────────────────────────────────────────────────────────
        // 5. Submit to AFIP queue (if enabled + configured)
        // ─────────────────────────────────────────────────────────────────────────
        if (shouldSubmitToAfip) {
            try {
                const afipClient = getAFIPClient();

                // This will throw if AFIP is not configured
                await afipClient.requestCAE(invoice.id, orgId, { priority: 'normal' });

                console.log(`${tag} ✅ AFIP CAE request queued for invoice ${invoice.id}`);
                result.afipQueued = true;
            } catch (afipError) {
                // AFIP not configured or queue error — log but don't fail
                console.warn(
                    `${tag} ⚠️ AFIP submission failed (invoice still created as PENDING):`,
                    afipError instanceof Error ? afipError.message : afipError
                );

                // Revert invoice to DRAFT since AFIP submission failed
                try {
                    await prisma.invoice.update({
                        where: { id: invoice.id },
                        data: { status: 'DRAFT' },
                    });
                    console.log(`${tag} Reverted invoice ${invoice.id} to DRAFT (AFIP unavailable)`);
                } catch (revertError) {
                    console.error(`${tag} Failed to revert invoice to DRAFT:`, revertError);
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // 6. Send WhatsApp notification (if enabled + customer has phone)
        // ─────────────────────────────────────────────────────────────────────────
        if (settings.autoWhatsappInvoice && job.customer.phone) {
            try {
                await onInvoiceCreated(invoice.id, job.customerId, orgId);
                console.log(`${tag} ✅ WhatsApp notification sent to ${job.customer.name}`);
                result.whatsappSent = true;
            } catch (whatsappError) {
                console.warn(
                    `${tag} ⚠️ WhatsApp notification failed:`,
                    whatsappError instanceof Error ? whatsappError.message : whatsappError
                );
            }
        }

        return result;
    } catch (error) {
        console.error(`${tag} ❌ Auto-invoicing failed:`, error);
        return {
            triggered: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
        };
    }
}
