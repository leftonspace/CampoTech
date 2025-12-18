/**
 * AI Assistant Test Endpoint
 *
 * Allows testing the AI assistant with custom configuration
 * without saving it. Returns AI analysis and response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceInfo {
  name: string;
  description: string;
  priceRange?: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface TestConfig {
  companyName: string;
  companyDescription: string;
  servicesOffered: ServiceInfo[];
  businessHours: Record<string, { open: string; close: string } | null>;
  serviceAreas: string;
  pricingInfo: string;
  cancellationPolicy: string;
  paymentMethods: string;
  warrantyInfo: string;
  faqItems: FAQItem[];
  customInstructions: string;
  aiTone: string;
  minConfidenceToRespond: number;
  minConfidenceToCreateJob: number;
  transferKeywords: string[];
}

interface TestRequest {
  message: string;
  config: TestConfig;
  conversationHistory?: Array<{ role: 'customer' | 'assistant'; content: string }>;
}

interface TechnicianAvailability {
  id: string;
  name: string;
  phone: string;
  specialty: string | null;
  status: 'disponible' | 'ocupado' | 'en_camino' | 'sin_conexion';
  currentLocation: { lat: number; lng: number } | null;
  todaysJobs: number;
  nextAvailableSlot: string | null;
}

interface ScheduleSlot {
  date: string;
  timeSlots: Array<{
    start: string;
    end: string;
    available: boolean;
    technicianId?: string;
    technicianName?: string;
  }>;
}

// Prisma query result types
interface TechnicianJob {
  id: string;
  status: string;
  scheduledTimeSlot: unknown;
}

interface TechnicianWithJobs {
  id: string;
  name: string;
  phone: string;
  specialty: string | null;
  currentLocation: { latitude: unknown; longitude: unknown } | null;
  assignedJobs: TechnicianJob[];
}

interface JobWithTechnician {
  id: string;
  technicianId: string | null;
  scheduledTimeSlot: unknown;
  technician: { id: string; name: string } | null;
}

interface ScheduleWithUser {
  userId: string;
  startTime: string;
  endTime: string;
  user: { id: string; name: string };
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Test AI Response
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body: TestRequest = await request.json();
    const { message, config, conversationHistory = [] } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    // Check for transfer keywords BEFORE calling AI
    const messageLower = message.toLowerCase();
    const transferKeywords = config.transferKeywords || [];
    const matchedKeyword = transferKeywords.find((keyword) =>
      messageLower.includes(keyword.toLowerCase())
    );

    if (matchedKeyword) {
      // Immediate transfer - don't call AI
      return NextResponse.json({
        success: true,
        analysis: {
          intent: 'transfer_keyword',
          confidence: 100,
          extractedEntities: {},
          suggestedResponse: `[TRANSFERENCIA AUTOMÁTICA] Se detectó la palabra clave "${matchedKeyword}". Transfiriendo a un humano...`,
          shouldCreateJob: false,
          shouldTransfer: true,
          transferReason: `Palabra clave detectada: "${matchedKeyword}"`,
          suggestedTechnician: null,
          suggestedTimeSlot: null,
          warnings: [`Transferencia automática por palabra clave: ${matchedKeyword}`],
        },
        context: {
          availableTechnicians: 0,
          totalTechnicians: 0,
          availableSlots: 0,
        },
      });
    }

    // Get real-time data from database
    const [technicians, scheduleSlots] = await Promise.all([
      getTechnicianAvailability(session.organizationId),
      getAvailableSlots(session.organizationId),
    ]);

    // Build system prompt with real data
    const systemPrompt = buildTestSystemPrompt(config, technicians, scheduleSlots);

    // Build conversation messages
    const messages = buildMessages(conversationHistory, message);

    // Call OpenAI
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty AI response');
    }

    const analysis = JSON.parse(content);

    return NextResponse.json({
      success: true,
      analysis: {
        intent: analysis.intent || 'other',
        confidence: Math.min(100, Math.max(0, analysis.confidence || 50)),
        extractedEntities: analysis.extractedEntities || {},
        suggestedResponse: analysis.suggestedResponse || '',
        shouldCreateJob: analysis.shouldCreateJob || false,
        shouldTransfer: analysis.shouldTransfer || false,
        transferReason: analysis.transferReason,
        suggestedTechnician: analysis.suggestedTechnician || null,
        suggestedTimeSlot: analysis.suggestedTimeSlot || null,
        warnings: analysis.warnings || [],
      },
      // Include context for debugging
      context: {
        availableTechnicians: technicians.filter((t) => t.status === 'disponible').length,
        totalTechnicians: technicians.length,
        availableSlots: scheduleSlots.reduce(
          (acc, s) => acc + s.timeSlots.filter((t) => t.available).length,
          0
        ),
      },
    });
  } catch (error) {
    console.error('AI test error:', error);
    return NextResponse.json(
      { error: 'Error procesando mensaje' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

async function getTechnicianAvailability(
  organizationId: string
): Promise<TechnicianAvailability[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get technicians with their current location and today's jobs
  const technicians = await prisma.user.findMany({
    where: {
      organizationId,
      role: 'TECHNICIAN',
      isActive: true,
    },
    include: {
      currentLocation: true,
      assignedJobs: {
        where: {
          scheduledDate: {
            gte: today,
            lt: tomorrow,
          },
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
        select: {
          id: true,
          status: true,
          scheduledTimeSlot: true,
        },
      },
    },
  });

  return (technicians as TechnicianWithJobs[]).map((tech: TechnicianWithJobs) => {
    // Determine status based on jobs
    let status: TechnicianAvailability['status'] = 'disponible';
    const activeJob = tech.assignedJobs.find(
      (j: TechnicianJob) => j.status === 'IN_PROGRESS' || j.status === 'EN_ROUTE'
    );
    if (activeJob) {
      status = activeJob.status === 'EN_ROUTE' ? 'en_camino' : 'ocupado';
    }
    if (!tech.currentLocation) {
      status = 'sin_conexion';
    }

    // Calculate next available slot (simplified)
    let nextAvailableSlot: string | null = null;
    if (status !== 'disponible' && tech.assignedJobs.length > 0) {
      // Estimate based on last job end time
      const lastJob = tech.assignedJobs[tech.assignedJobs.length - 1];
      const timeSlot = lastJob.scheduledTimeSlot as { start?: string; end?: string } | null;
      if (timeSlot?.end) {
        nextAvailableSlot = timeSlot.end;
      }
    }

    return {
      id: tech.id,
      name: tech.name,
      phone: tech.phone,
      specialty: tech.specialty,
      status,
      currentLocation: tech.currentLocation
        ? {
            lat: Number(tech.currentLocation.latitude),
            lng: Number(tech.currentLocation.longitude),
          }
        : null,
      todaysJobs: tech.assignedJobs.length,
      nextAvailableSlot,
    };
  });
}

async function getAvailableSlots(organizationId: string): Promise<ScheduleSlot[]> {
  const today = new Date();
  const slots: ScheduleSlot[] = [];

  // Generate slots for next 7 days
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // Get existing jobs for this day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existingJobs = await prisma.job.findMany({
      where: {
        organizationId,
        scheduledDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: {
          notIn: ['CANCELLED'],
        },
      },
      select: {
        id: true,
        technicianId: true,
        scheduledTimeSlot: true,
        technician: {
          select: { id: true, name: true },
        },
      },
    });

    // Get available technicians for this day
    const dayOfWeek = date.getDay();
    const schedules = await prisma.employeeSchedule.findMany({
      where: {
        organizationId,
        dayOfWeek,
        isAvailable: true,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    // Generate time slots (9:00-18:00, 2-hour blocks)
    const timeSlots: ScheduleSlot['timeSlots'] = [];
    const slotHours = ['09:00', '11:00', '13:00', '15:00', '17:00'];

    for (const startTime of slotHours) {
      const [h] = startTime.split(':').map(Number);
      const endTime = `${String(h + 2).padStart(2, '0')}:00`;

      // Check if any technician is available for this slot
      const busyTechs = (existingJobs as JobWithTechnician[])
        .filter((j: JobWithTechnician) => {
          const timeSlot = j.scheduledTimeSlot as { start?: string; end?: string } | null;
          if (!timeSlot?.start) return false;
          const jobStart = timeSlot.start;
          return jobStart >= startTime && jobStart < endTime;
        })
        .map((j: JobWithTechnician) => j.technicianId)
        .filter((id: string | null): id is string => id !== null);

      const availableTech = (schedules as ScheduleWithUser[]).find(
        (s: ScheduleWithUser) =>
          !busyTechs.includes(s.userId) &&
          s.startTime <= startTime &&
          s.endTime >= endTime
      );

      timeSlots.push({
        start: startTime,
        end: endTime,
        available: !!availableTech,
        technicianId: availableTech?.user.id,
        technicianName: availableTech?.user.name,
      });
    }

    slots.push({ date: dateStr, timeSlots });
  }

  return slots;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDING
// ═══════════════════════════════════════════════════════════════════════════════

function buildTestSystemPrompt(
  config: TestConfig,
  technicians: TechnicianAvailability[],
  scheduleSlots: ScheduleSlot[]
): string {
  const toneInstructions: Record<string, string> = {
    friendly_professional:
      'Sé amigable pero profesional. Usá "vos" en lugar de "tú". Sé cálido pero eficiente.',
    formal: 'Mantené un tono formal y respetuoso. Usá "usted" para dirigirte al cliente.',
    casual: 'Sé relajado y cercano, como hablando con un vecino. Usá expresiones argentinas.',
  };

  const servicesText =
    config.servicesOffered.length > 0
      ? config.servicesOffered
          .map(
            (s) =>
              `- ${s.name}: ${s.description}${s.priceRange ? ` (${s.priceRange})` : ''}`
          )
          .join('\n')
      : 'No hay servicios configurados.';

  const faqText =
    config.faqItems.length > 0
      ? config.faqItems.map((f) => `P: ${f.question}\nR: ${f.answer}`).join('\n\n')
      : '';

  // Build technician status text
  const availableTechs = technicians.filter((t) => t.status === 'disponible');
  const techStatusText =
    technicians.length > 0
      ? `
TÉCNICOS DISPONIBLES AHORA (${availableTechs.length}/${technicians.length}):
${technicians
  .map(
    (t) =>
      `- ${t.name} (${t.specialty || 'General'}): ${
        t.status === 'disponible'
          ? '✅ Disponible'
          : t.status === 'ocupado'
            ? '🔧 Ocupado'
            : t.status === 'en_camino'
              ? '🚗 En camino'
              : '⚫ Sin conexión'
      }${t.todaysJobs > 0 ? ` - ${t.todaysJobs} trabajos hoy` : ''}${
        t.nextAvailableSlot ? ` - Libre desde ${t.nextAvailableSlot}` : ''
      }`
  )
  .join('\n')}`
      : 'No hay técnicos registrados.';

  // Build schedule slots text (next 3 days only for prompt)
  const slotsText = scheduleSlots
    .slice(0, 3)
    .map((day) => {
      const availableSlots = day.timeSlots.filter((s) => s.available);
      const dateObj = new Date(day.date);
      const dayName = dateObj.toLocaleDateString('es-AR', { weekday: 'long' });
      const dateStr = dateObj.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'short',
      });

      if (availableSlots.length === 0) {
        return `${dayName} ${dateStr}: Sin disponibilidad`;
      }

      return `${dayName} ${dateStr}: ${availableSlots.map((s) => `${s.start}-${s.end}`).join(', ')}`;
    })
    .join('\n');

  return `Sos el asistente virtual de ${config.companyName || 'la empresa'} por WhatsApp.

SOBRE LA EMPRESA:
${config.companyDescription || 'Empresa de servicios técnicos.'}

SERVICIOS:
${servicesText}

ZONAS DE SERVICIO:
${config.serviceAreas || 'Consultar disponibilidad'}

PRECIOS:
${config.pricingInfo || 'Los precios varían según el trabajo.'}

MÉTODOS DE PAGO:
${config.paymentMethods || 'Efectivo, transferencia'}

POLÍTICA DE CANCELACIÓN:
${config.cancellationPolicy || 'Cancelaciones con 24hs de anticipación.'}

GARANTÍA:
${config.warrantyInfo || 'Consultar según servicio.'}

${faqText ? `PREGUNTAS FRECUENTES:\n${faqText}` : ''}

═══════════════════════════════════════════════════════════
DATOS EN TIEMPO REAL (USÁLOS PARA DAR RESPUESTAS PRECISAS)
═══════════════════════════════════════════════════════════

${techStatusText}

TURNOS DISPONIBLES PRÓXIMOS DÍAS:
${slotsText}

═══════════════════════════════════════════════════════════

${config.customInstructions ? `INSTRUCCIONES ADICIONALES:\n${config.customInstructions}` : ''}

COMPORTAMIENTO:
1. ${toneInstructions[config.aiTone] || toneInstructions.friendly_professional}
2. Respondé SIEMPRE en español argentino.
3. Sé conciso - mensajes cortos para WhatsApp.
4. Si quieren agendar:
   - Consultá los TURNOS DISPONIBLES arriba
   - Sugerí horarios específicos disponibles
   - Pedí: tipo de servicio, dirección, confirmación de horario
5. Si pregunta por disponibilidad, usá los datos reales de arriba.
6. Si no hay turnos disponibles pronto, ofrecé lista de espera.
7. Si el cliente está enojado o el tema es delicado, sugerí transferir a humano.

RESPUESTA JSON:
{
  "intent": "booking|question|status|complaint|greeting|confirmation|cancellation|other",
  "confidence": 0-100,
  "extractedEntities": {
    "serviceType": "string o null",
    "preferredDate": "YYYY-MM-DD o null",
    "preferredTime": "HH:MM o null",
    "address": "string o null",
    "urgency": "normal|urgente o null",
    "problemDescription": "string o null"
  },
  "suggestedResponse": "Tu respuesta al cliente en español argentino",
  "shouldCreateJob": true/false,
  "shouldTransfer": true/false,
  "transferReason": "razón si shouldTransfer es true",
  "suggestedTechnician": {"id": "string", "name": "string"} o null,
  "suggestedTimeSlot": {"date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM"} o null,
  "warnings": ["lista de advertencias si hay"]
}`;
}

function buildMessages(
  history: Array<{ role: 'customer' | 'assistant'; content: string }>,
  currentMessage: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of history.slice(-10)) {
    messages.push({
      role: msg.role === 'customer' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  messages.push({ role: 'user', content: currentMessage });
  return messages;
}
