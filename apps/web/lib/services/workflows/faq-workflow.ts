/**
 * FAQ Workflow
 * ============
 *
 * Phase 3.1 Task 3.1.3: Quick Reply Buttons for Common Questions
 *
 * Handles frequently asked questions using interactive buttons
 * to reduce AI parsing needs and provide faster responses.
 *
 * Flow:
 * 1. Detect FAQ-type question (pricing, hours, warranty, etc.)
 * 2. Send quick reply buttons for related topics
 * 3. Handle button selection and provide answer
 */

import { prisma } from '@/lib/prisma';
import {
    BaseWorkflow,
    WorkflowContext,
    WorkflowResult,
    WorkflowStep,
    StepResult,
    ExtractedEntities,
} from './base-workflow';
import { getInteractiveMessageService } from '../interactive-message.service';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

type FAQTopic = 'pricing' | 'scheduling' | 'warranty' | 'zones' | 'general';

interface FAQAnswer {
    short: string;
    detailed?: string;
    followUp?: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FAQ ANSWERS (Default responses, can be customized per org)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const DEFAULT_FAQ_ANSWERS: Record<string, FAQAnswer> = {
    // Pricing FAQs
    faq_pricing: {
        short: 'Los precios varían según el tipo de trabajo. La visita técnica tiene un costo base que se descuenta del servicio.',
        detailed:
            'ðŸ’° *Cómo funcionan nuestros precios:*\n\n• Visita de diagnóstico: se descuenta del trabajo\n• Presupuesto sin cargo antes de comenzar\n• Precios finales sin sorpresas\n\n¿Querés que te pasemos un presupuesto?',
        followUp: '¿Te gustaría agendar una visita para un presupuesto sin cargo?',
    },
    faq_payment: {
        short: 'Aceptamos efectivo, transferencia, y tarjetas de crédito/débito.',
        detailed:
            'ðŸ’³ *Formas de pago:*\n\n• Efectivo\n• Transferencia bancaria\n• Mercado Pago\n• Tarjetas de crédito (hasta 12 cuotas)\n• Tarjetas de débito\n\n¿Tenés alguna preferencia?',
    },
    faq_warranty: {
        short: 'Todos nuestros trabajos tienen garantía escrita.',
        detailed:
            '✅ *Nuestra garantía:*\n\n• 90 días de garantía en mano de obra\n• Repuestos con garantía del fabricante\n• Respuesta inmediata ante reclamos\n• Certificado de garantía por escrito',
    },

    // Scheduling FAQs
    faq_hours: {
        short: 'Atendemos de lunes a viernes de 8 a 18hs, y sábados de 8 a 13hs.',
        detailed:
            'ðŸ•’ *Nuestros horarios:*\n\n*Lunes a Viernes:* 8:00 - 18:00\n*Sábados:* 8:00 - 13:00\n*Domingos:* Cerrado (solo emergencias)\n\n¿Querés agendar una visita?',
        followUp: '¿Te gustaría agendar para mañana o algún día de la semana?',
    },
    faq_emergency: {
        short: 'Sí, tenemos servicio de emergencias 24hs para urgencias.',
        detailed:
            'ðŸš¨ *Emergencias 24hs:*\n\n• Fugas de gas\n• Cortes de luz\n• Inundaciones\n• Otros problemas urgentes\n\nEl servicio de emergencia tiene un cargo adicional.',
    },
    faq_zones: {
        short: 'Cubrimos CABA y Gran Buenos Aires.',
        detailed:
            'ðŸ“ *Zonas de cobertura:*\n\n• CABA (todas las comunas)\n• Zona Norte GBA\n• Zona Oeste GBA\n• Zona Sur GBA\n\n¿Cuál es tu zona?',
    },
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Detect FAQ topic from message content
 */
function detectFAQTopic(message: string): FAQTopic | null {
    const lowerMessage = message.toLowerCase();

    // Pricing keywords
    if (
        lowerMessage.includes('precio') ||
        lowerMessage.includes('cuanto') ||
        lowerMessage.includes('cuánto') ||
        lowerMessage.includes('costo') ||
        lowerMessage.includes('tarifa') ||
        lowerMessage.includes('cobran') ||
        lowerMessage.includes('sale')
    ) {
        return 'pricing';
    }

    // Scheduling keywords
    if (
        lowerMessage.includes('horario') ||
        lowerMessage.includes('hora') ||
        lowerMessage.includes('cuando') ||
        lowerMessage.includes('cuándo') ||
        lowerMessage.includes('atienden') ||
        lowerMessage.includes('abierto')
    ) {
        return 'scheduling';
    }

    // Warranty keywords
    if (
        lowerMessage.includes('garantia') ||
        lowerMessage.includes('garantía') ||
        lowerMessage.includes('asegura')
    ) {
        return 'warranty';
    }

    // Zone keywords
    if (
        lowerMessage.includes('zona') ||
        lowerMessage.includes('llegan') ||
        lowerMessage.includes('vienen') ||
        lowerMessage.includes('cubren') ||
        lowerMessage.includes('direccion') ||
        lowerMessage.includes('dirección')
    ) {
        return 'zones';
    }

    return null;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WORKFLOW STEPS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Step 1: Detect FAQ Topic
 * Analyzes the message to determine which FAQ category it falls under
 */
const detectTopicStep: WorkflowStep = {
    id: 'detect_topic',
    name: 'Detectar tema de consulta',

    async execute(context: WorkflowContext): Promise<StepResult> {
        const message = context.metadata.originalMessage;
        const topic = detectFAQTopic(message);

        if (!topic) {
            return {
                success: false,
                error: 'No FAQ topic detected',
            };
        }

        return {
            success: true,
            data: { topic },
        };
    },
};

/**
 * Step 2: Fetch Custom FAQ Answers
 * Gets organization-specific FAQ answers if configured
 */
const fetchCustomAnswersStep: WorkflowStep = {
    id: 'fetch_custom_answers',
    name: 'Obtener respuestas personalizadas',
    required: false,

    async execute(context: WorkflowContext): Promise<StepResult> {
        try {
            // Get organization's AI configuration for custom FAQ answers
            const config = await prisma.aIConfiguration.findUnique({
                where: { organizationId: context.organizationId },
                select: {
                    faqResponses: true,
                    businessName: true,
                    workingHours: true,
                    coverageAreas: true,
                },
            });

            return {
                success: true,
                data: {
                    customAnswers: config?.faqResponses || {},
                    businessName: config?.businessName,
                    workingHours: config?.workingHours,
                    coverageAreas: config?.coverageAreas,
                },
            };
        } catch (_error) {
            // Non-critical, use defaults
            return {
                success: true,
                data: { customAnswers: {} },
            };
        }
    },
};

/**
 * Step 3: Send FAQ Buttons
 * Sends interactive buttons for the detected topic
 */
const sendFAQButtonsStep: WorkflowStep = {
    id: 'send_faq_buttons',
    name: 'Enviar botones de FAQ',

    async execute(context: WorkflowContext): Promise<StepResult> {
        const topicResult = context.stepResults.get('detect_topic');
        const topic = (topicResult?.data as { topic?: FAQTopic })?.topic;

        if (!topic) {
            return {
                success: false,
                error: 'No topic to handle',
            };
        }

        try {
            const interactiveService = getInteractiveMessageService();

            // Determine which button set to use
            let buttonTopic: 'pricing' | 'scheduling' = 'pricing';
            if (topic === 'scheduling' || topic === 'zones') {
                buttonTopic = 'scheduling';
            }

            // Send the FAQ buttons
            const result = await interactiveService.sendFAQButtons({
                organizationId: context.organizationId,
                phone: context.customerPhone,
                topic: buttonTopic,
            });

            if (!result.success) {
                // Fall back to direct answer
                return {
                    success: true,
                    data: { sent: false, fallback: true, topic },
                };
            }

            return {
                success: true,
                data: {
                    sent: true,
                    messageId: result.messageId,
                    topic,
                },
                earlyReturn: {
                    response: '', // Interactive message sent
                    action: 'wait_input',
                },
            };
        } catch (error) {
            console.error('[FAQWorkflow] Error sending buttons:', error);
            return {
                success: true,
                data: { sent: false, fallback: true },
            };
        }
    },
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FAQ WORKFLOW
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export class FAQWorkflow extends BaseWorkflow {
    intent = 'faq' as const;

    steps: WorkflowStep[] = [detectTopicStep, fetchCustomAnswersStep, sendFAQButtonsStep];

    canHandle(intent: string, entities: ExtractedEntities): boolean {
        // Handle FAQ intent explicitly
        if (intent === 'faq' || intent === 'question') {
            return true;
        }

        // Don't handle if there are booking-related entities
        if (entities.preferredDate || entities.preferredTime || entities.address) {
            return false;
        }

        return false;
    }

    generateResponse(context: WorkflowContext, _result: WorkflowResult): string {
        // Check if we sent interactive buttons
        const buttonResult = context.stepResults.get('send_faq_buttons');
        const buttonData = buttonResult?.data as {
            sent?: boolean;
            fallback?: boolean;
            topic?: FAQTopic;
        } | undefined;

        if (buttonData?.sent) {
            // Interactive message was sent
            return '';
        }

        // Provide fallback text answer based on topic
        const topic = buttonData?.topic;
        if (topic) {
            // Get the answer for the most likely FAQ based on topic
            let faqId: string;
            switch (topic) {
                case 'pricing':
                    faqId = 'faq_pricing';
                    break;
                case 'scheduling':
                    faqId = 'faq_hours';
                    break;
                case 'warranty':
                    faqId = 'faq_warranty';
                    break;
                case 'zones':
                    faqId = 'faq_zones';
                    break;
                default:
                    faqId = 'faq_pricing';
            }

            const answer = DEFAULT_FAQ_ANSWERS[faqId];
            if (answer) {
                return answer.detailed || answer.short;
            }
        }

        // Default response
        return '¿En qué te puedo ayudar? Contame tu consulta y te respondo lo antes posible.';
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FAQ RESPONSE HANDLER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Handle a button click from an FAQ message
 * This is called when the customer clicks one of the FAQ buttons
 */
export async function handleFAQButtonClick(
    buttonId: string,
    organizationId: string,
    _customerPhone: string
): Promise<{ response: string; followUp?: string }> {
    // Get the default answer
    const answer = DEFAULT_FAQ_ANSWERS[buttonId];

    if (!answer) {
        return {
            response: 'Disculpá, no tengo información sobre eso. ¿Puedo ayudarte con otra cosa?',
        };
    }

    // Try to get organization-specific answer
    try {
        const config = await prisma.aIConfiguration.findUnique({
            where: { organizationId },
            select: { faqResponses: true },
        });

        const customAnswers = (config?.faqResponses as Record<string, FAQAnswer>) || {};
        const customAnswer = customAnswers[buttonId];

        if (customAnswer) {
            return {
                response: customAnswer.detailed || customAnswer.short,
                followUp: customAnswer.followUp,
            };
        }
    } catch (error) {
        console.error('[FAQWorkflow] Error fetching custom answer:', error);
    }

    return {
        response: answer.detailed || answer.short,
        followUp: answer.followUp,
    };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SINGLETON
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let faqWorkflowInstance: FAQWorkflow | null = null;

export function getFAQWorkflow(): FAQWorkflow {
    if (!faqWorkflowInstance) {
        faqWorkflowInstance = new FAQWorkflow();
    }
    return faqWorkflowInstance;
}
