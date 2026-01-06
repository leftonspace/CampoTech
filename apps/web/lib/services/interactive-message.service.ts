/**
 * Interactive Message Service
 * ===========================
 *
 * Phase 3.1: Wire Interactive Messages
 *
 * Centralized service for sending WhatsApp interactive messages (buttons, lists).
 * Provides a clean interface for workflows to send interactive content without
 * dealing with API details.
 *
 * Usage:
 * ```typescript
 * const service = getInteractiveMessageService();
 *
 * // Send time slot buttons
 * await service.sendTimeSlotButtons({
 *   organizationId: 'org-123',
 *   phone: '+5491123456789',
 *   slots: [
 *     { id: 'morning', time: '09:00-12:00', label: 'Mañana 9-12hs' },
 *     { id: 'afternoon', time: '14:00-18:00', label: 'Tarde 14-18hs' },
 *   ],
 * });
 * ```
 */

import { prisma } from '@/lib/prisma';
import { WhatsAppClient } from '@/src/integrations/whatsapp/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface InteractiveButton {
    id: string;
    title: string;
}

export interface ListRow {
    id: string;
    title: string;
    description?: string;
}

export interface ListSection {
    title: string;
    rows: ListRow[];
}

export interface SendButtonsParams {
    organizationId: string;
    phone: string;
    bodyText: string;
    buttons: InteractiveButton[];
    headerText?: string;
    footerText?: string;
}

export interface SendListParams {
    organizationId: string;
    phone: string;
    bodyText: string;
    buttonText: string;
    sections: ListSection[];
    headerText?: string;
    footerText?: string;
}

export interface TimeSlotOption {
    id: string;
    time: string;
    label: string;
}

export interface ServiceOption {
    id: string;
    name: string;
    description?: string;
}

export interface SendResult {
    success: boolean;
    messageId?: string;
    waMessageId?: string;
    conversationId?: string;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_BUTTONS = 3;
const MAX_BUTTON_TITLE_LENGTH = 20;
const MAX_LIST_ROWS = 10;
const MAX_LIST_TITLE_LENGTH = 24;
const MAX_LIST_DESCRIPTION_LENGTH = 72;

// Pre-defined button sets for common scenarios
export const FAQ_BUTTONS = {
    pricing: [
        { id: 'faq_pricing', title: '💰 Precios' },
        { id: 'faq_payment', title: '💳 Formas de pago' },
        { id: 'faq_warranty', title: '✅ Garantía' },
    ],
    scheduling: [
        { id: 'faq_hours', title: '🕒 Horarios' },
        { id: 'faq_emergency', title: '🚨 Urgencias' },
        { id: 'faq_zones', title: '📍 Zonas' },
    ],
    confirmation: [
        { id: 'confirm_yes', title: '✅ Confirmar' },
        { id: 'confirm_no', title: '❌ Cancelar' },
        { id: 'confirm_reschedule', title: '📅 Reprogramar' },
    ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class InteractiveMessageService {
    /**
     * Get WhatsApp client for an organization
     */
    private async getClient(organizationId: string): Promise<WhatsAppClient | null> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                whatsappPhoneNumberId: true,
                whatsappAccessToken: true,
                whatsappBusinessAccountId: true,
            },
        });

        if (!org?.whatsappAccessToken || !org?.whatsappPhoneNumberId) {
            return null;
        }

        return new WhatsAppClient({
            accessToken: org.whatsappAccessToken,
            phoneNumberId: org.whatsappPhoneNumberId,
            businessAccountId: org.whatsappBusinessAccountId || undefined,
        });
    }

    /**
     * Find or create conversation for customer
     */
    private async getOrCreateConversation(
        organizationId: string,
        phone: string
    ): Promise<string> {
        let conversation = await prisma.waConversation.findFirst({
            where: { organizationId, customerPhone: phone },
        });

        if (!conversation) {
            conversation = await prisma.waConversation.create({
                data: {
                    organizationId,
                    customerPhone: phone,
                    customerName: 'Unknown',
                    lastMessageAt: new Date(),
                },
            });
        }

        return conversation.id;
    }

    /**
     * Store sent message in database
     */
    private async storeMessage(
        organizationId: string,
        conversationId: string,
        phone: string,
        phoneNumberId: string,
        waMessageId: string | undefined,
        bodyText: string,
        type: 'button' | 'list',
        metadata: Record<string, unknown>
    ): Promise<string> {
        const message = await prisma.waMessage.create({
            data: {
                organizationId,
                conversationId,
                waMessageId,
                direction: 'outbound',
                type: 'interactive',
                from: phoneNumberId,
                to: phone,
                content: bodyText,
                metadata: {
                    interactiveType: type,
                    ...metadata,
                },
                status: 'sent',
            },
        });

        // Update conversation
        await prisma.waConversation.update({
            where: { id: conversationId },
            data: {
                lastMessageAt: new Date(),
                lastMessagePreview: `[${type === 'button' ? 'Botones' : 'Lista'}] ${bodyText.substring(0, 50)}`,
                windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });

        return message.id;
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PUBLIC METHODS
    // ───────────────────────────────────────────────────────────────────────────

    /**
     * Send button message
     */
    async sendButtons(params: SendButtonsParams): Promise<SendResult> {
        const { organizationId, phone, bodyText, buttons, headerText, footerText } = params;

        try {
            // Validate buttons
            if (buttons.length > MAX_BUTTONS) {
                return { success: false, error: `Maximum ${MAX_BUTTONS} buttons allowed` };
            }

            const client = await this.getClient(organizationId);
            if (!client) {
                return { success: false, error: 'WhatsApp not configured' };
            }

            // Truncate button titles if needed
            const formattedButtons = buttons.map((btn) => ({
                id: btn.id,
                title: btn.title.substring(0, MAX_BUTTON_TITLE_LENGTH),
            }));

            // Send the button message
            const result = await client.sendButtonMessage(
                phone,
                bodyText,
                formattedButtons,
                { headerText, footerText }
            );

            // Store the message
            const conversationId = await this.getOrCreateConversation(organizationId, phone);
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
                select: { whatsappPhoneNumberId: true },
            });

            const waMessageId = result.messages?.[0]?.id;
            const messageId = await this.storeMessage(
                organizationId,
                conversationId,
                phone,
                org?.whatsappPhoneNumberId || '',
                waMessageId,
                bodyText,
                'button',
                { headerText, footerText, buttons }
            );

            return {
                success: true,
                messageId,
                waMessageId,
                conversationId,
            };
        } catch (error) {
            console.error('[InteractiveMessage] Error sending buttons:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Send list message
     */
    async sendList(params: SendListParams): Promise<SendResult> {
        const { organizationId, phone, bodyText, buttonText, sections, headerText, footerText } =
            params;

        try {
            // Validate total rows
            const totalRows = sections.reduce((sum, s) => sum + (s.rows?.length || 0), 0);
            if (totalRows > MAX_LIST_ROWS) {
                return { success: false, error: `Maximum ${MAX_LIST_ROWS} total rows allowed` };
            }

            const client = await this.getClient(organizationId);
            if (!client) {
                return { success: false, error: 'WhatsApp not configured' };
            }

            // Format sections with truncated text
            const formattedSections = sections.map((section) => ({
                title: section.title,
                rows: section.rows.map((row) => ({
                    id: row.id,
                    title: row.title.substring(0, MAX_LIST_TITLE_LENGTH),
                    description: row.description?.substring(0, MAX_LIST_DESCRIPTION_LENGTH),
                })),
            }));

            // Send the list message
            const result = await client.sendListMessage(
                phone,
                bodyText,
                buttonText,
                formattedSections,
                { headerText, footerText }
            );

            // Store the message
            const conversationId = await this.getOrCreateConversation(organizationId, phone);
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
                select: { whatsappPhoneNumberId: true },
            });

            const waMessageId = result.messages?.[0]?.id;
            const messageId = await this.storeMessage(
                organizationId,
                conversationId,
                phone,
                org?.whatsappPhoneNumberId || '',
                waMessageId,
                bodyText,
                'list',
                { headerText, footerText, buttonText, sections }
            );

            return {
                success: true,
                messageId,
                waMessageId,
                conversationId,
            };
        } catch (error) {
            console.error('[InteractiveMessage] Error sending list:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // CONVENIENCE METHODS
    // ───────────────────────────────────────────────────────────────────────────

    /**
     * Send time slot selection buttons
     * Used in booking workflow when customer needs to choose a time
     */
    async sendTimeSlotButtons(params: {
        organizationId: string;
        phone: string;
        slots: TimeSlotOption[];
        includeCustomOption?: boolean;
    }): Promise<SendResult> {
        const { organizationId, phone, slots, includeCustomOption = true } = params;

        // Maximum 3 buttons, so take first 2 slots + custom option, or first 3 if no custom
        const maxSlots = includeCustomOption ? 2 : 3;
        const selectedSlots = slots.slice(0, maxSlots);

        const buttons: InteractiveButton[] = selectedSlots.map((slot) => ({
            id: `slot_${slot.id}`,
            title: slot.label,
        }));

        if (includeCustomOption && buttons.length < MAX_BUTTONS) {
            buttons.push({ id: 'slot_custom', title: '📅 Otro horario' });
        }

        return this.sendButtons({
            organizationId,
            phone,
            bodyText: '¿Cuándo te gustaría agendar el servicio?',
            buttons,
            footerText: 'Seleccioná una opción tocando el botón',
        });
    }

    /**
     * Send confirmation buttons
     * Used when a job is about to be created
     */
    async sendConfirmationButtons(params: {
        organizationId: string;
        phone: string;
        summary: string;
    }): Promise<SendResult> {
        const { organizationId, phone, summary } = params;

        return this.sendButtons({
            organizationId,
            phone,
            bodyText: `${summary}\n\n¿Confirmamos el turno?`,
            buttons: FAQ_BUTTONS.confirmation,
            footerText: 'Tocá un botón para continuar',
        });
    }

    /**
     * Send service type selection list
     * Used when customer asks for service but doesn't specify type
     */
    async sendServiceTypeList(params: {
        organizationId: string;
        phone: string;
        services: ServiceOption[];
    }): Promise<SendResult> {
        const { organizationId, phone, services } = params;

        // Group services (max 10 total)
        const mainServices = services.slice(0, 8);
        const hasOther = services.length > 8;

        const sections: ListSection[] = [
            {
                title: 'Servicios Disponibles',
                rows: mainServices.map((svc) => ({
                    id: `service_${svc.id}`,
                    title: svc.name,
                    description: svc.description,
                })),
            },
        ];

        if (hasOther) {
            sections.push({
                title: 'Otros',
                rows: [
                    {
                        id: 'service_other',
                        title: 'Otro servicio',
                        description: 'Contanos qué necesitás',
                    },
                ],
            });
        }

        return this.sendList({
            organizationId,
            phone,
            bodyText: '¿Qué tipo de servicio necesitás?',
            buttonText: 'Ver servicios',
            sections,
            headerText: 'Servicios Disponibles',
        });
    }

    /**
     * Send FAQ buttons based on topic
     */
    async sendFAQButtons(params: {
        organizationId: string;
        phone: string;
        topic: 'pricing' | 'scheduling';
    }): Promise<SendResult> {
        const { organizationId, phone, topic } = params;

        const topicButtons = FAQ_BUTTONS[topic] || FAQ_BUTTONS.pricing;
        const topicTexts: Record<string, string> = {
            pricing: '¿Qué información sobre precios necesitás?',
            scheduling: '¿Qué querés saber sobre nuestros horarios?',
        };

        return this.sendButtons({
            organizationId,
            phone,
            bodyText: topicTexts[topic] || 'Seleccioná una opción:',
            buttons: topicButtons,
        });
    }

    /**
     * Send quick reply buttons for yes/no questions
     */
    async sendYesNoButtons(params: {
        organizationId: string;
        phone: string;
        question: string;
        yesLabel?: string;
        noLabel?: string;
    }): Promise<SendResult> {
        const { organizationId, phone, question, yesLabel = '✅ Sí', noLabel = '❌ No' } = params;

        return this.sendButtons({
            organizationId,
            phone,
            bodyText: question,
            buttons: [
                { id: 'confirm_yes', title: yesLabel },
                { id: 'confirm_no', title: noLabel },
            ],
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let serviceInstance: InteractiveMessageService | null = null;

export function getInteractiveMessageService(): InteractiveMessageService {
    if (!serviceInstance) {
        serviceInstance = new InteractiveMessageService();
    }
    return serviceInstance;
}
