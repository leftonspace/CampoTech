/**
 * Booking Workflow
 * ================
 *
 * Handles the complete flow of booking a service via WhatsApp:
 * 1. Find or create customer
 * 2. Validate service type
 * 3. Check scheduling availability
 * 4. Select best technician
 * 5. Create job
 * 6. Assign technician
 * 7. Send confirmations
 *
 * This workflow ensures all business rules are enforced and
 * provides a consistent booking experience.
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
import { getSchedulingIntelligenceService } from '../scheduling-intelligence';

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW STEPS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Step 1: Find or Create Customer
 * Looks up customer by phone number, creates if not exists
 */
const findOrCreateCustomerStep: WorkflowStep = {
  id: 'find_or_create_customer',
  name: 'Buscar o crear cliente',

  async execute(context: WorkflowContext): Promise<StepResult> {
    try {
      // Look for existing customer by phone
      let customer = await prisma.customer.findFirst({
        where: {
          organizationId: context.organizationId,
          phone: context.customerPhone,
        },
      });

      if (customer) {
        context.customerId = customer.id;
        return {
          success: true,
          data: { id: customer.id, name: customer.name, isNew: false },
        };
      }

      // Create new customer
      const name = context.customerName || context.extractedEntities.customerName || 'Cliente WhatsApp';

      customer = await prisma.customer.create({
        data: {
          organizationId: context.organizationId,
          phone: context.customerPhone,
          name,
          source: 'whatsapp_ai',
        },
      });

      context.customerId = customer.id;

      return {
        success: true,
        data: { id: customer.id, name: customer.name, isNew: true },
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al buscar/crear cliente: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  },

  async rollback(context: WorkflowContext): Promise<void> {
    // Only rollback if we created a new customer
    const result = context.stepResults.get('find_or_create_customer');
    if (result?.data && (result.data as { isNew?: boolean }).isNew && context.customerId) {
      await prisma.customer.delete({
        where: { id: context.customerId },
      }).catch(() => {
        // Ignore delete errors
      });
    }
  },
};

/**
 * Step 2: Validate Service Type
 * Checks if the requested service is offered by the organization
 */
const validateServiceTypeStep: WorkflowStep = {
  id: 'validate_service_type',
  name: 'Validar tipo de servicio',
  required: false, // Can proceed without specific service

  async execute(context: WorkflowContext): Promise<StepResult> {
    const requestedService = context.extractedEntities.serviceType;

    if (!requestedService) {
      // No specific service mentioned, that's okay
      return {
        success: true,
        data: { serviceType: 'general', validated: false },
      };
    }

    try {
      // Get organization's AI configuration for available services
      const config = await prisma.aIConfiguration.findUnique({
        where: { organizationId: context.organizationId },
        select: { servicesOffered: true },
      });

      type ServiceInfo = { name: string; description?: string; priceRange?: string };
      const services = (config?.servicesOffered as ServiceInfo[]) || [];

      // Find matching service (case-insensitive partial match)
      const normalizedRequest = requestedService.toLowerCase();
      const matchedService = services.find(s =>
        s.name.toLowerCase().includes(normalizedRequest) ||
        normalizedRequest.includes(s.name.toLowerCase())
      );

      if (matchedService) {
        return {
          success: true,
          data: { serviceType: matchedService.name, validated: true, priceRange: matchedService.priceRange },
        };
      }

      // No exact match, use the requested service anyway
      return {
        success: true,
        data: { serviceType: requestedService, validated: false },
      };
    } catch (error) {
      return {
        success: true, // Non-critical failure
        data: { serviceType: requestedService, validated: false },
      };
    }
  },
};

/**
 * Step 3: Fetch Scheduling Context
 * Gets availability data for the requested date
 */
const fetchSchedulingStep: WorkflowStep = {
  id: 'fetch_scheduling',
  name: 'Consultar disponibilidad',

  async execute(context: WorkflowContext): Promise<StepResult> {
    try {
      // If we already have scheduling context, use it
      if (context.schedulingContext) {
        return {
          success: true,
          data: context.schedulingContext,
        };
      }

      // Parse date from entities
      const dateStr = context.extractedEntities.preferredDate;
      if (!dateStr) {
        // No date specified, check tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        context.extractedEntities.preferredDate = tomorrow.toISOString().split('T')[0];
      }

      const schedulingService = getSchedulingIntelligenceService();
      const schedulingContext = await schedulingService.getSchedulingContext({
        organizationId: context.organizationId,
        date: context.extractedEntities.preferredDate!,
        requestedTime: context.extractedEntities.preferredTime,
        serviceType: context.extractedEntities.serviceType,
      });

      context.schedulingContext = schedulingContext;

      // Check if there's a conflict
      if (schedulingContext.hasConflict) {
        return {
          success: true,
          data: schedulingContext,
          earlyReturn: {
            response: schedulingContext.summary,
            action: 'respond',
          },
        };
      }

      // Check if it's a working day
      if (!schedulingContext.isWorkingDay) {
        return {
          success: true,
          data: schedulingContext,
          earlyReturn: {
            response: schedulingContext.summary,
            action: 'respond',
          },
        };
      }

      return {
        success: true,
        data: schedulingContext,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al consultar disponibilidad: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  },
};

/**
 * Step 4: Validate Time Slot
 * Ensures the requested time has availability
 */
const validateTimeSlotStep: WorkflowStep = {
  id: 'validate_time_slot',
  name: 'Validar horario',

  async execute(context: WorkflowContext): Promise<StepResult> {
    const scheduling = context.schedulingContext;
    const requestedTime = context.extractedEntities.preferredTime;

    if (!scheduling) {
      return {
        success: false,
        error: 'No hay información de disponibilidad',
      };
    }

    // If no specific time requested, find best slot
    if (!requestedTime) {
      const bestSlot = scheduling.bestSlot;
      if (bestSlot) {
        context.extractedEntities.preferredTime = bestSlot.start;
        return {
          success: true,
          data: {
            timeSlot: bestSlot,
            isRecommended: true,
          },
        };
      }

      // No available slots
      return {
        success: false,
        error: 'No hay horarios disponibles para esta fecha',
        earlyReturn: {
          response: scheduling.summary,
          action: 'respond',
        },
      };
    }

    // Validate requested time
    const availableSlots = scheduling.availableSlots.filter(s => s.availableTechnicians > 0);
    const requestedMinutes = timeToMinutes(requestedTime);

    const matchingSlot = availableSlots.find(slot => {
      const slotStart = timeToMinutes(slot.start);
      const slotEnd = timeToMinutes(slot.end);
      return requestedMinutes >= slotStart && requestedMinutes < slotEnd;
    });

    if (matchingSlot) {
      return {
        success: true,
        data: {
          timeSlot: matchingSlot,
          isRecommended: false,
        },
      };
    }

    // Time not available, suggest alternatives
    const alternatives = availableSlots.slice(0, 3).map(s => s.start);
    return {
      success: true,
      data: { unavailable: true, alternatives },
      earlyReturn: {
        response: `El horario ${requestedTime} no está disponible. Tenemos disponibilidad a las: ${alternatives.join(', ')}. ¿Cuál te queda mejor?`,
        action: 'respond',
      },
    };
  },
};

/**
 * Step 5: Select Technician
 * Picks the best available technician based on workload and specialty
 */
const selectTechnicianStep: WorkflowStep = {
  id: 'select_technician',
  name: 'Asignar técnico',

  async execute(context: WorkflowContext): Promise<StepResult> {
    const scheduling = context.schedulingContext;
    const timeSlotResult = context.stepResults.get('validate_time_slot');
    const timeSlot = timeSlotResult?.data as { timeSlot?: { bestTechnician?: { id: string; name: string } } } | undefined;

    // Use the best technician from the time slot
    if (timeSlot?.timeSlot?.bestTechnician) {
      return {
        success: true,
        data: {
          technicianId: timeSlot.timeSlot.bestTechnician.id,
          technicianName: timeSlot.timeSlot.bestTechnician.name,
        },
      };
    }

    // Find any available technician
    const availableTech = scheduling?.technicians.find(
      t => t.isAvailable && t.workloadLevel !== 'full'
    );

    if (availableTech) {
      return {
        success: true,
        data: {
          technicianId: availableTech.id,
          technicianName: availableTech.name,
        },
      };
    }

    // No technician available - this shouldn't happen if scheduling said there's availability
    return {
      success: false,
      error: 'No hay técnicos disponibles',
    };
  },
};

/**
 * Step 6: Create Job
 * Creates the job record in the database
 */
const createJobStep: WorkflowStep = {
  id: 'create_job',
  name: 'Crear trabajo',

  async execute(context: WorkflowContext): Promise<StepResult> {
    const serviceResult = context.stepResults.get('validate_service_type');
    const serviceData = serviceResult?.data as { serviceType?: string } | undefined;

    try {
      // Generate job number
      const jobCount = await prisma.job.count({
        where: { organizationId: context.organizationId },
      });
      const jobNumber = `JOB-${String(jobCount + 1).padStart(5, '0')}`;

      // Parse scheduled date
      let scheduledDate: Date | undefined;
      if (context.extractedEntities.preferredDate) {
        scheduledDate = new Date(context.extractedEntities.preferredDate);
      }

      // Create the job
      const preferredTime = context.extractedEntities.preferredTime;
      const job = await prisma.job.create({
        data: {
          organizationId: context.organizationId,
          customerId: context.customerId!,
          jobNumber,
          serviceType: serviceData?.serviceType || context.extractedEntities.serviceType || 'OTRO',
          description: context.extractedEntities.problemDescription || `Trabajo creado por WhatsApp AI: ${context.metadata.originalMessage.substring(0, 200)}`,
          urgency: context.extractedEntities.urgency === 'urgente' ? 'URGENT' : 'NORMAL',
          status: 'PENDING',
          scheduledDate,
          scheduledTimeSlot: preferredTime ? { start: preferredTime, end: null } : null,
        },
      });

      return {
        success: true,
        data: { id: job.id, jobNumber: job.jobNumber },
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al crear trabajo: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  },

  async rollback(context: WorkflowContext): Promise<void> {
    const result = context.stepResults.get('create_job');
    if (result?.data) {
      const jobData = result.data as { id?: string };
      if (jobData.id) {
        await prisma.job.delete({
          where: { id: jobData.id },
        }).catch(() => {
          // Ignore delete errors
        });
      }
    }
  },
};

/**
 * Step 7: Assign Technician
 * Creates the job assignment
 */
const assignTechnicianStep: WorkflowStep = {
  id: 'assign_technician',
  name: 'Asignar técnico al trabajo',

  async execute(context: WorkflowContext): Promise<StepResult> {
    const jobResult = context.stepResults.get('create_job');
    const techResult = context.stepResults.get('select_technician');

    const jobData = jobResult?.data as { id?: string } | undefined;
    const techData = techResult?.data as { technicianId?: string } | undefined;

    if (!jobData?.id || !techData?.technicianId) {
      return {
        success: false,
        error: 'Faltan datos para asignar técnico',
      };
    }

    try {
      const assignment = await prisma.jobAssignment.create({
        data: {
          jobId: jobData.id,
          technicianId: techData.technicianId,
          status: 'ASSIGNED',
          assignedAt: new Date(),
        },
      });

      // Update job with technician
      await prisma.job.update({
        where: { id: jobData.id },
        data: {
          technicianId: techData.technicianId,
          status: 'ASSIGNED',
        },
      });

      return {
        success: true,
        data: { assignmentId: assignment.id },
      };
    } catch (error) {
      return {
        success: false,
        error: `Error al asignar técnico: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  },

  async rollback(context: WorkflowContext): Promise<void> {
    const result = context.stepResults.get('assign_technician');
    if (result?.data) {
      const assignmentData = result.data as { assignmentId?: string };
      if (assignmentData.assignmentId) {
        await prisma.jobAssignment.delete({
          where: { id: assignmentData.assignmentId },
        }).catch(() => {
          // Ignore delete errors
        });
      }
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKING WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════

export class BookingWorkflow extends BaseWorkflow {
  intent = 'booking' as const;

  steps: WorkflowStep[] = [
    findOrCreateCustomerStep,
    validateServiceTypeStep,
    fetchSchedulingStep,
    validateTimeSlotStep,
    selectTechnicianStep,
    createJobStep,
    assignTechnicianStep,
  ];

  canHandle(intent: string, entities: ExtractedEntities): boolean {
    // Handle booking intent with at least some booking-related entity
    if (intent !== 'booking') return false;

    // Must have at least one of: service type, date, or time
    return Boolean(
      entities.serviceType ||
      entities.preferredDate ||
      entities.preferredTime ||
      entities.address
    );
  }

  generateResponse(context: WorkflowContext, result: WorkflowResult): string {
    if (!result.success) {
      return `Hubo un problema al procesar tu reserva: ${result.error}. Por favor, intentá nuevamente o escribí "hablar con alguien" para contactar a un agente.`;
    }

    const jobResult = context.stepResults.get('create_job');
    const techResult = context.stepResults.get('select_technician');
    const customerResult = context.stepResults.get('find_or_create_customer');

    const jobData = jobResult?.data as { jobNumber?: string } | undefined;
    const techData = techResult?.data as { technicianName?: string } | undefined;
    const customerData = customerResult?.data as { name?: string; isNew?: boolean } | undefined;

    const date = context.extractedEntities.preferredDate
      ? new Date(context.extractedEntities.preferredDate).toLocaleDateString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      : 'fecha a confirmar';

    const time = context.extractedEntities.preferredTime || 'horario a confirmar';

    let response = `¡Listo! Tu turno está confirmado.\n\n`;
    response += `📋 Número: ${jobData?.jobNumber || 'Pendiente'}\n`;
    response += `📅 Fecha: ${date}\n`;
    response += `🕐 Hora: ${time}\n`;

    if (techData?.technicianName) {
      response += `👷 Técnico: ${techData.technicianName}\n`;
    }

    if (context.extractedEntities.serviceType) {
      response += `🔧 Servicio: ${context.extractedEntities.serviceType}\n`;
    }

    response += `\nTe enviaremos un recordatorio antes de la visita.`;

    if (customerData?.isNew) {
      response += ` ¡Bienvenido/a!`;
    }

    return response;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let bookingWorkflowInstance: BookingWorkflow | null = null;

export function getBookingWorkflow(): BookingWorkflow {
  if (!bookingWorkflowInstance) {
    bookingWorkflowInstance = new BookingWorkflow();
  }
  return bookingWorkflowInstance;
}
