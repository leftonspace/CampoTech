/**
 * Button Response Handler
 * =======================
 *
 * Phase 3.1 Task 3.1.1: Handle Interactive Message Responses
 *
 * Routes button clicks and list selections from WhatsApp to the appropriate
 * workflow handlers. This bridges the gap between interactive messages sent
 * by workflows and the automated processing of customer responses.
 *
 * Button ID Prefixes:
 * - `slot_*` - Time slot selection (BookingWorkflow)
 * - `confirm_*` - Confirmation buttons (BookingWorkflow)
 * - `service_*` - Service type selection (InquiryWorkflow)
 * - `faq_*` - FAQ topic buttons (FAQWorkflow)
 * - `svc_*` - Service selection from list (InquiryWorkflow)
 */

import { prisma } from '@/lib/prisma';
import { handleFAQButtonClick } from './faq-workflow';
import { getInteractiveMessageService } from '../interactive-message.service';
import { getAttributionService } from '../attribution.service';
import { parseDateTimeAsArgentina } from '@/lib/timezone';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ButtonClickContext {
    organizationId: string;
    conversationId: string;
    customerPhone: string;
    customerName?: string;
    buttonId: string;
    buttonTitle: string;
    messageId?: string;
}

export interface ButtonClickResult {
    handled: boolean;
    response?: string;
    action?: 'respond' | 'continue_workflow' | 'create_job' | 'transfer';
    data?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PENDING STATE STORAGE (in-memory for now, can be moved to Redis)
// ═══════════════════════════════════════════════════════════════════════════════

interface PendingInteraction {
    type: 'time_slot_selection' | 'confirmation' | 'service_selection';
    organizationId: string;
    conversationId: string;
    customerPhone: string;
    expiresAt: Date;
    data: Record<string, unknown>;
}

// Store pending interactions by conversationId
const pendingInteractions = new Map<string, PendingInteraction>();

// Cleanup old pending interactions every 5 minutes
const INTERACTION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Store a pending interaction for later processing
 */
export function setPendingInteraction(
    conversationId: string,
    interaction: Omit<PendingInteraction, 'expiresAt'>
): void {
    pendingInteractions.set(conversationId, {
        ...interaction,
        expiresAt: new Date(Date.now() + INTERACTION_TTL_MS),
    });
}

/**
 * Get and clear a pending interaction
 */
export function consumePendingInteraction(conversationId: string): PendingInteraction | null {
    const interaction = pendingInteractions.get(conversationId);
    if (!interaction) return null;

    // Check if expired
    if (interaction.expiresAt < new Date()) {
        pendingInteractions.delete(conversationId);
        return null;
    }

    pendingInteractions.delete(conversationId);
    return interaction;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON CLICK HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle a time slot selection button click
 */
async function handleTimeSlotSelection(
    ctx: ButtonClickContext,
    pending: PendingInteraction
): Promise<ButtonClickResult> {
    const { buttonId } = ctx;

    // Extract slot info from button ID (e.g., 'slot_morning', 'slot_afternoon', 'slot_custom')
    if (buttonId === 'slot_custom') {
        // Customer wants a custom time, ask for it
        return {
            handled: true,
            response: '¿A qué hora te queda mejor? Podés indicarnos un horario y vemos disponibilidad.',
            action: 'respond',
        };
    }

    // Get the slot data from pending interaction
    const slotId = buttonId.replace('slot_', '');
    const slots = (pending.data.slots as Array<{ id: string; time: string; label: string }>) || [];
    const selectedSlot = slots.find(s => s.id === slotId);

    if (!selectedSlot) {
        return {
            handled: true,
            response: 'No pudimos encontrar ese horario. ¿Podés indicarnos a qué hora preferís?',
            action: 'respond',
        };
    }

    // Store the selection and continue the booking
    const bookingData = pending.data.bookingData as Record<string, unknown> || {};

    // Now send confirmation
    const interactiveService = getInteractiveMessageService();
    const confirmResult = await interactiveService.sendConfirmationButtons({
        organizationId: ctx.organizationId,
        phone: ctx.customerPhone,
        summary: buildBookingSummary({
            ...bookingData,
            time: selectedSlot.time,
            timeLabel: selectedSlot.label,
        }),
    });

    if (confirmResult.success) {
        // Store pending confirmation
        setPendingInteraction(ctx.conversationId, {
            type: 'confirmation',
            organizationId: ctx.organizationId,
            conversationId: ctx.conversationId,
            customerPhone: ctx.customerPhone,
            data: {
                ...bookingData,
                selectedTime: selectedSlot.time,
                selectedTimeLabel: selectedSlot.label,
            },
        });

        return {
            handled: true,
            response: '', // Interactive message sent
            action: 'continue_workflow',
            data: { selectedSlot },
        };
    }

    // Fallback to text response
    return {
        handled: true,
        response: `Perfecto, agendamos para las ${selectedSlot.label}. ¿Confirmamos el turno?`,
        action: 'respond',
        data: { selectedSlot },
    };
}

/**
 * Handle a confirmation button click
 */
async function handleConfirmation(
    ctx: ButtonClickContext,
    pending: PendingInteraction
): Promise<ButtonClickResult> {
    const { buttonId } = ctx;

    switch (buttonId) {
        case 'confirm_yes':
            // Create the job
            return await createJobFromPending(ctx, pending);

        case 'confirm_no':
            return {
                handled: true,
                response: 'Entendido, cancelamos la reserva. ¿Necesitás algo más?',
                action: 'respond',
            };

        case 'confirm_reschedule':
            // Ask for new date/time
            return {
                handled: true,
                response: '¿Para cuándo te gustaría reprogramar? Indicanos el día y horario que preferís.',
                action: 'respond',
            };

        default:
            return { handled: false };
    }
}

/**
 * Handle service selection from list
 */
async function handleServiceSelection(
    ctx: ButtonClickContext,
    _pending: PendingInteraction
): Promise<ButtonClickResult> {
    const { buttonId, buttonTitle } = ctx;

    // Extract service ID (e.g., 'service_plomeria' or 'svc_0')
    const serviceId = buttonId.replace(/^(service_|svc_)/, '');

    if (serviceId === 'other') {
        return {
            handled: true,
            response: '¿Qué servicio necesitás? Contanos y te ayudamos.',
            action: 'respond',
        };
    }

    // Service was selected, continue with booking context
    return {
        handled: true,
        response: `Perfecto, necesitás ${buttonTitle}. ¿Para cuándo te gustaría agendar el servicio?`,
        action: 'respond',
        data: { serviceType: buttonTitle, serviceId },
    };
}

/**
 * Handle FAQ button click
 */
async function handleFAQClick(ctx: ButtonClickContext): Promise<ButtonClickResult> {
    const result = await handleFAQButtonClick(
        ctx.buttonId,
        ctx.organizationId,
        ctx.customerPhone
    );

    let response = result.response;
    if (result.followUp) {
        response += `\n\n${result.followUp}`;
    }

    return {
        handled: true,
        response,
        action: 'respond',
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Route a button click to the appropriate handler
 */
export async function handleButtonClick(ctx: ButtonClickContext): Promise<ButtonClickResult> {
    const { buttonId, conversationId } = ctx;

    console.log('[ButtonHandler] Processing button click:', buttonId);

    // Check for pending interaction
    const pending = consumePendingInteraction(conversationId);

    // Route based on button ID prefix
    if (buttonId.startsWith('slot_') && pending?.type === 'time_slot_selection') {
        return handleTimeSlotSelection(ctx, pending);
    }

    if (buttonId.startsWith('confirm_') && pending?.type === 'confirmation') {
        return handleConfirmation(ctx, pending);
    }

    if ((buttonId.startsWith('service_') || buttonId.startsWith('svc_')) && pending?.type === 'service_selection') {
        return handleServiceSelection(ctx, pending);
    }

    // FAQ buttons don't need pending state
    if (buttonId.startsWith('faq_')) {
        return handleFAQClick(ctx);
    }

    // Handle confirmation without pending state (button expired but user clicked anyway)
    if (buttonId.startsWith('confirm_')) {
        if (buttonId === 'confirm_yes') {
            return {
                handled: true,
                response: 'Disculpá, la sesión expiró. ¿Podés contarnos nuevamente qué servicio necesitás?',
                action: 'respond',
            };
        }
        return {
            handled: true,
            response: 'Entendido. ¿En qué más te podemos ayudar?',
            action: 'respond',
        };
    }

    // Slot selection without pending state
    if (buttonId.startsWith('slot_')) {
        return {
            handled: true,
            response: 'Disculpá, la sesión expiró. ¿Podés contarnos nuevamente qué servicio necesitás y para cuándo?',
            action: 'respond',
        };
    }

    // Unknown button
    console.log('[ButtonHandler] Unknown button ID:', buttonId);
    return { handled: false };
}

/**
 * Check if a message content indicates an interactive response
 * (e.g., "[Button: Mañana 9-12hs]" or "[Selected: Plomería]")
 */
export function parseInteractiveResponse(content: string): { buttonId: string; buttonTitle: string } | null {
    // Match button response format: [Button: <title>] or [Selected: <title>]
    const buttonMatch = content.match(/^\[Button:\s*(.+?)\]$/);
    if (buttonMatch) {
        // Try to reverse-engineer the button ID from the title
        // This is a fallback for when we only have the display text
        return {
            buttonId: inferButtonIdFromTitle(buttonMatch[1]),
            buttonTitle: buttonMatch[1],
        };
    }

    const listMatch = content.match(/^\[Selected:\s*(.+?)\]$/);
    if (listMatch) {
        return {
            buttonId: inferButtonIdFromTitle(listMatch[1]),
            buttonTitle: listMatch[1],
        };
    }

    return null;
}

/**
 * Try to infer button ID from title
 * This is used when the webhook only provides the button title, not the ID
 */
function inferButtonIdFromTitle(title: string): string {
    const lowerTitle = title.toLowerCase();

    // FAQ buttons
    if (lowerTitle.includes('precios') || lowerTitle.includes('💰')) return 'faq_pricing';
    if (lowerTitle.includes('pago') || lowerTitle.includes('💳')) return 'faq_payment';
    if (lowerTitle.includes('garantía') || lowerTitle.includes('garantia') || lowerTitle.includes('✅')) return 'faq_warranty';
    if (lowerTitle.includes('horario') || lowerTitle.includes('🕒')) return 'faq_hours';
    if (lowerTitle.includes('urgenc') || lowerTitle.includes('🚨')) return 'faq_emergency';
    if (lowerTitle.includes('zona') || lowerTitle.includes('📍')) return 'faq_zones';

    // Confirmation buttons
    if (lowerTitle.includes('confirmar') || lowerTitle === 'sí') return 'confirm_yes';
    if (lowerTitle.includes('cancelar') || lowerTitle === 'no') return 'confirm_no';
    if (lowerTitle.includes('reprogramar')) return 'confirm_reschedule';

    // Time slots - harder to infer, use generic
    if (lowerTitle.includes('mañana') && lowerTitle.includes('9')) return 'slot_morning';
    if (lowerTitle.includes('tarde') || lowerTitle.includes('14')) return 'slot_afternoon';
    if (lowerTitle.includes('otro')) return 'slot_custom';

    // Fallback: create a slug from the title
    return `unknown_${title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a summary string for booking confirmation
 */
function buildBookingSummary(data: Record<string, unknown>): string {
    const parts: string[] = ['📋 *Resumen de tu turno:*', ''];

    if (data.serviceType) {
        parts.push(`🔧 Servicio: ${data.serviceType}`);
    }

    if (data.date || data.preferredDate) {
        const dateStr = data.date || data.preferredDate;
        parts.push(`📅 Fecha: ${dateStr}`);
    }

    if (data.timeLabel || data.time) {
        parts.push(`🕐 Horario: ${data.timeLabel || data.time}`);
    }

    if (data.address) {
        parts.push(`📍 Dirección: ${data.address}`);
    }

    return parts.join('\n');
}

/**
 * Create a job from pending confirmation data
 */
async function createJobFromPending(
    ctx: ButtonClickContext,
    pending: PendingInteraction
): Promise<ButtonClickResult> {
    try {
        const data = pending.data;

        // Find or create customer
        let customer = await prisma.customer.findFirst({
            where: {
                organizationId: ctx.organizationId,
                phone: ctx.customerPhone,
            },
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    organizationId: ctx.organizationId,
                    phone: ctx.customerPhone,
                    name: ctx.customerName || 'Cliente WhatsApp',
                    source: 'whatsapp_interactive',
                },
            });
        }

        // Generate job number
        const jobCount = await prisma.job.count({
            where: { organizationId: ctx.organizationId },
        });
        const jobNumber = `JOB-${String(jobCount + 1).padStart(5, '0')}`;

        // Parse date with time
        let scheduledDate: Date | undefined;
        if (data.preferredDate || data.date) {
            const dateStr = (data.preferredDate || data.date) as string;
            const timeStr = (data.selectedTime || data.time) as string | undefined;
            scheduledDate = parseDateTimeAsArgentina(dateStr, timeStr);
        }

        // Create the job
        const job = await prisma.job.create({
            data: {
                organizationId: ctx.organizationId,
                customerId: customer.id,
                jobNumber,
                serviceType: (data.serviceType as string) || 'OTRO',
                description: `Trabajo agendado via WhatsApp interactivo`,
                urgency: 'NORMAL',
                status: 'PENDING',
                scheduledDate,
                scheduledTimeSlot: data.selectedTime ? {
                    start: data.selectedTime,
                    label: data.selectedTimeLabel,
                } : null,
            },
        });

        console.log('[ButtonHandler] Job created:', job.jobNumber);

        // 🎯 Phase 3.2: Attribute job to marketplace click (if any)
        try {
            const attributionService = getAttributionService();
            await attributionService.attributeJobToClick(job.id);
        } catch (attrError) {
            console.error('[ButtonHandler] Attribution failed:', attrError);
            // Don't fail the job creation if attribution fails
        }

        return {
            handled: true,
            response: `¡Listo! Tu turno está confirmado.\n\n📋 Número: ${job.jobNumber}\n📅 Fecha: ${data.preferredDate || 'A confirmar'}\n🕐 Horario: ${data.selectedTimeLabel || data.selectedTime || 'A confirmar'}\n\nTe enviaremos un recordatorio antes de la visita. ¡Gracias por confiar en nosotros!`,
            action: 'create_job',
            data: { jobId: job.id, jobNumber: job.jobNumber },
        };
    } catch (error) {
        console.error('[ButtonHandler] Error creating job:', error);
        return {
            handled: true,
            response: 'Hubo un problema al confirmar tu turno. Por favor, intentá nuevamente o escribí "hablar con alguien" para contactar a un agente.',
            action: 'respond',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

// Clean up expired interactions periodically
setInterval(() => {
    const now = new Date();
    let cleaned = 0;
    for (const [conversationId, interaction] of pendingInteractions.entries()) {
        if (interaction.expiresAt < now) {
            pendingInteractions.delete(conversationId);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`[ButtonHandler] Cleaned up ${cleaned} expired pending interactions`);
    }
}, 5 * 60 * 1000); // Every 5 minutes
