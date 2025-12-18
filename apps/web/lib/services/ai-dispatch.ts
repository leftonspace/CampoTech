/**
 * AI Dispatch Service
 * ====================
 *
 * Uses GPT-4o-mini to provide intelligent technician dispatch recommendations.
 * Analyzes technician data and provides contextual reasoning for assignments.
 */

import OpenAI from 'openai';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TechnicianData {
  id: string;
  name: string;
  specialty: string | null;
  skillLevel: string | null;
  currentStatus: string;
  distanceKm: number;
  etaMinutes: number;
  todaysWorkload: {
    totalJobs: number;
    completed: number;
    remaining: number;
  };
  performanceScore: number;
  avgRating: number | null;
}

export interface JobContext {
  serviceType: string | null;
  urgency: 'NORMAL' | 'URGENTE';
  requiredSkillLevel: string | null;
  customerName?: string;
  address?: string;
}

export interface AIRecommendation {
  technicianId: string;
  rank: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  estimatedSuccessRate: number;
}

export interface AIDispatchResult {
  recommendations: AIRecommendation[];
  summary: string;
  alternativeStrategy?: string;
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

const DISPATCH_SYSTEM_PROMPT = `Eres un sistema experto de despacho para una empresa de servicios técnicos en Argentina.
Tu trabajo es analizar los datos de técnicos disponibles y recomendar el mejor técnico para cada trabajo.

Factores a considerar (en orden de importancia):
1. **Disponibilidad**: Técnicos "disponible" son preferidos. "sin_conexion" debe evitarse.
2. **Proximidad**: Menor distancia = menor tiempo de llegada = mejor servicio al cliente.
3. **Carga de trabajo**: Distribuir trabajos equitativamente. Evitar sobrecargar técnicos.
4. **Especialidad**: Coincidir especialidad del técnico con tipo de servicio cuando sea posible.
5. **Desempeño**: Técnicos con mejor historial para trabajos críticos.

Para trabajos URGENTES:
- Prioriza disponibilidad inmediata y proximidad sobre otros factores
- Acepta técnicos con mayor carga si están más cerca

Responde SIEMPRE en español argentino, usando vocabulario técnico apropiado.
Sé conciso pero informativo en tus explicaciones.`;

function buildDispatchPrompt(
  technicians: TechnicianData[],
  job: JobContext
): string {
  const techList = technicians
    .map(
      (t, i) => `
${i + 1}. ${t.name} (ID: ${t.id})
   - Estado: ${translateStatus(t.currentStatus)}
   - Distancia: ${t.distanceKm.toFixed(1)} km (ETA: ${t.etaMinutes} min)
   - Especialidad: ${t.specialty || 'General'}
   - Nivel: ${t.skillLevel || 'No especificado'}
   - Trabajos hoy: ${t.todaysWorkload.completed}/${t.todaysWorkload.totalJobs} completados, ${t.todaysWorkload.remaining} pendientes
   - Calificación promedio: ${t.avgRating ? t.avgRating.toFixed(1) + '/5' : 'Sin datos'}
   - Score de desempeño: ${t.performanceScore}/100`
    )
    .join('\n');

  return `# Trabajo a Asignar
- Tipo de servicio: ${job.serviceType || 'No especificado'}
- Urgencia: ${job.urgency}
- Nivel requerido: ${job.requiredSkillLevel || 'Cualquiera'}
${job.customerName ? `- Cliente: ${job.customerName}` : ''}
${job.address ? `- Dirección: ${job.address}` : ''}

# Técnicos Disponibles
${techList}

# Instrucciones
Analiza los técnicos y devuelve un JSON con tus recomendaciones ordenadas de mejor a peor opción.
Incluye razonamiento específico para cada recomendación.

Formato de respuesta (JSON):
{
  "recommendations": [
    {
      "technicianId": "id del técnico",
      "rank": 1,
      "reasoning": "Explicación concisa de por qué es la mejor opción",
      "confidence": "high|medium|low",
      "warnings": ["lista de advertencias si hay"],
      "estimatedSuccessRate": 0.95
    }
  ],
  "summary": "Resumen breve de la situación general",
  "alternativeStrategy": "Sugerencia alternativa si ningún técnico es ideal (opcional)"
}`;
}

function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    disponible: 'Disponible',
    en_camino: 'En camino a otro trabajo',
    trabajando: 'Trabajando en otro trabajo',
    sin_conexion: 'Sin conexión',
  };
  return translations[status] || status;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI DISPATCH SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class AIDispatchService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model = 'gpt-4o-mini') {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = model;
  }

  /**
   * Get AI-powered dispatch recommendations
   */
  async getRecommendations(
    technicians: TechnicianData[],
    job: JobContext
  ): Promise<AIDispatchResult> {
    if (technicians.length === 0) {
      return {
        recommendations: [],
        summary: 'No hay técnicos disponibles para este trabajo.',
        generatedAt: new Date().toISOString(),
      };
    }

    try {
      const userPrompt = buildDispatchPrompt(technicians, job);

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1500,
        temperature: 0.3, // Low temperature for consistent, logical recommendations
        messages: [
          { role: 'system', content: DISPATCH_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new DispatchAIError('Empty response from AI');
      }

      const parsed = JSON.parse(content) as AIDispatchResult;

      // Validate that recommended technician IDs exist in our input
      const validTechIds = new Set(technicians.map((t) => t.id));
      parsed.recommendations = parsed.recommendations.filter(
        (r) => validTechIds.has(r.technicianId)
      );

      parsed.generatedAt = new Date().toISOString();
      return parsed;
    } catch (error) {
      if (error instanceof DispatchAIError) throw error;

      console.error('AI Dispatch error:', error);
      throw new DispatchAIError(
        `AI recommendation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Generate a brief explanation for a specific assignment
   */
  async explainAssignment(
    technician: TechnicianData,
    job: JobContext
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 200,
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content:
              'Eres un asistente que explica brevemente por qué un técnico fue asignado a un trabajo. Responde en español argentino, máximo 2 oraciones.',
          },
          {
            role: 'user',
            content: `Técnico: ${technician.name}, ${translateStatus(technician.currentStatus)}, a ${technician.distanceKm.toFixed(1)} km.
Trabajo: ${job.serviceType || 'servicio técnico'}, urgencia ${job.urgency}.
Explica brevemente esta asignación.`,
          },
        ],
      });

      return (
        response.choices[0]?.message?.content ||
        'Asignación basada en disponibilidad y proximidad.'
      );
    } catch (error) {
      console.error('AI explanation error:', error);
      return 'Asignación basada en disponibilidad y proximidad.';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class DispatchAIError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'DispatchAIError';
    this.cause = cause;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let dispatchService: AIDispatchService | null = null;

export function getAIDispatchService(): AIDispatchService {
  if (!dispatchService) {
    dispatchService = new AIDispatchService();
  }
  return dispatchService;
}

/**
 * Check if AI dispatch is available (API key configured)
 */
export function isAIDispatchAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
