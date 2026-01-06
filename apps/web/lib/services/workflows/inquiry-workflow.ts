/**
 * Inquiry Workflow
 * ================
 *
 * Phase 3.1 Task 3.1.2: Service Type Selection with Lists
 *
 * Handles customer inquiries that don't have enough information to book.
 * Uses interactive list messages to help customers select service types.
 *
 * Flow:
 * 1. Detect incomplete inquiry (no service type specified)
 * 2. Fetch available services from organization config
 * 3. Send interactive list with service options
 * 4. Handle selection and transition to booking workflow
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

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceInfo {
    name: string;
    description?: string;
    priceRange?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW STEPS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Step 1: Fetch Available Services
 * Gets the list of services offered by the organization
 */
const fetchServicesStep: WorkflowStep = {
    id: 'fetch_services',
    name: 'Obtener servicios disponibles',

    async execute(context: WorkflowContext): Promise<StepResult> {
        try {
            // Get organization's AI configuration for available services
            const config = await prisma.aIConfiguration.findUnique({
                where: { organizationId: context.organizationId },
                select: { servicesOffered: true },
            });

            const services = (config?.servicesOffered as ServiceInfo[]) || [];

            if (services.length === 0) {
                // No services configured, return generic response
                return {
                    success: true,
                    data: { services: [], hasServices: false },
                    earlyReturn: {
                        response:
                            '¿En qué te podemos ayudar? Contanos qué tipo de servicio necesitás y te ayudamos a agendar una visita.',
                        action: 'respond',
                    },
                };
            }

            return {
                success: true,
                data: { services, hasServices: true },
            };
        } catch (error) {
            console.error('[InquiryWorkflow] Error fetching services:', error);
            return {
                success: true, // Non-critical failure
                data: { services: [], hasServices: false },
            };
        }
    },
};

/**
 * Step 2: Send Interactive Service List
 * Sends a WhatsApp list message with available services
 */
const sendServiceListStep: WorkflowStep = {
    id: 'send_service_list',
    name: 'Enviar lista de servicios',

    async execute(context: WorkflowContext): Promise<StepResult> {
        const servicesResult = context.stepResults.get('fetch_services');
        const servicesData = servicesResult?.data as { services: ServiceInfo[]; hasServices: boolean } | undefined;

        if (!servicesData?.hasServices) {
            // Already handled in previous step
            return {
                success: true,
                data: { sent: false },
            };
        }

        try {
            const interactiveService = getInteractiveMessageService();

            // Format services for the list
            const formattedServices = servicesData.services.map((svc, index) => ({
                id: `svc_${index}`,
                name: svc.name,
                description: svc.description || svc.priceRange || undefined,
            }));

            // Send the interactive list
            const result = await interactiveService.sendServiceTypeList({
                organizationId: context.organizationId,
                phone: context.customerPhone,
                services: formattedServices,
            });

            if (!result.success) {
                // Fall back to text response if interactive fails
                const serviceNames = servicesData.services.map((s) => s.name).join(', ');
                return {
                    success: true,
                    data: { sent: false, fallback: true },
                    earlyReturn: {
                        response: `Ofrecemos los siguientes servicios: ${serviceNames}. ¿Cuál necesitás?`,
                        action: 'respond',
                    },
                };
            }

            return {
                success: true,
                data: {
                    sent: true,
                    messageId: result.messageId,
                    conversationId: result.conversationId,
                },
                earlyReturn: {
                    response: '', // No text response needed, interactive message was sent
                    action: 'wait_input',
                },
            };
        } catch (error) {
            console.error('[InquiryWorkflow] Error sending service list:', error);
            return {
                success: true, // Non-critical
                data: { sent: false, error: true },
                earlyReturn: {
                    response:
                        '¿Qué tipo de servicio necesitás? Contanos y te ayudamos a agendar.',
                    action: 'respond',
                },
            };
        }
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// INQUIRY WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════

export class InquiryWorkflow extends BaseWorkflow {
    intent = 'inquiry' as const;

    steps: WorkflowStep[] = [fetchServicesStep, sendServiceListStep];

    canHandle(intent: string, entities: ExtractedEntities): boolean {
        // Handle inquiry intent when:
        // 1. Intent is explicitly 'inquiry'
        // 2. Intent is 'booking' but missing service type
        // 3. Generic greeting or question
        if (intent === 'inquiry') return true;

        if (intent === 'booking' && !entities.serviceType && !entities.preferredDate) {
            return true;
        }

        if (intent === 'greeting' || intent === 'question') {
            // Only handle if no specific entities that would trigger other workflows
            return !entities.serviceType && !entities.preferredDate;
        }

        return false;
    }

    generateResponse(context: WorkflowContext, result: WorkflowResult): string {
        // Check if we sent an interactive message
        const listResult = context.stepResults.get('send_service_list');
        const listData = listResult?.data as { sent?: boolean } | undefined;

        if (listData?.sent) {
            // Interactive message was sent, no additional text response needed
            return '';
        }

        // Fallback response if interactive didn't work
        if (!result.success) {
            return 'Disculpá, hubo un problema. ¿Podés contarnos qué servicio necesitás?';
        }

        // Default response (shouldn't reach here normally)
        return '¿En qué te podemos ayudar hoy?';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let inquiryWorkflowInstance: InquiryWorkflow | null = null;

export function getInquiryWorkflow(): InquiryWorkflow {
    if (!inquiryWorkflowInstance) {
        inquiryWorkflowInstance = new InquiryWorkflow();
    }
    return inquiryWorkflowInstance;
}
