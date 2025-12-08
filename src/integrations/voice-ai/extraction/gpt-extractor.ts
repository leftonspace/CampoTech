/**
 * GPT Extractor
 * =============
 *
 * Extract structured job request data from transcriptions using GPT-4o
 */

import OpenAI from 'openai';
import {
  ExtractedJobRequest,
  ExtractedField,
  ServiceType,
  GPTExtractionConfig,
} from '../voice-ai.types';
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
  CONFIRMATION_SYSTEM_PROMPT,
  buildConfirmationPrompt,
  CLARIFICATION_SYSTEM_PROMPT,
  buildClarificationPrompt,
} from './prompts/extraction.prompt';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: GPTExtractionConfig = {
  model: 'gpt-4o',
  maxTokens: 2000,
  temperature: 0.1, // Low temperature for consistent extraction
  systemPrompt: EXTRACTION_SYSTEM_PROMPT,
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACTOR
// ═══════════════════════════════════════════════════════════════════════════════

export class GPTExtractor {
  private client: OpenAI;
  private config: GPTExtractionConfig;

  constructor(apiKey?: string, config?: Partial<GPTExtractionConfig>) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract job request data from transcription
   */
  async extract(
    transcription: string,
    customerPhone?: string,
    previousContext?: string
  ): Promise<ExtractedJobRequest> {
    const userPrompt = buildExtractionUserPrompt(
      transcription,
      customerPhone,
      previousContext
    );

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new ExtractionError('Empty response from GPT');
      }

      // Parse and validate the response
      const parsed = JSON.parse(content) as RawExtractionResponse;
      return this.normalizeResponse(parsed, customerPhone);
    } catch (error) {
      if (error instanceof ExtractionError) throw error;

      throw new ExtractionError(
        `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Generate confirmation message for medium confidence extractions
   */
  async generateConfirmationMessage(
    extractedData: ExtractedJobRequest
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: 500,
        temperature: 0.7,
        messages: [
          { role: 'system', content: CONFIRMATION_SYSTEM_PROMPT },
          { role: 'user', content: buildConfirmationPrompt(this.toPlainObject(extractedData)) },
        ],
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw new ExtractionError('Failed to generate confirmation message', error);
    }
  }

  /**
   * Generate clarification request for missing fields
   */
  async generateClarificationMessage(
    missingFields: string[],
    partialData: ExtractedJobRequest
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: 400,
        temperature: 0.7,
        messages: [
          { role: 'system', content: CLARIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: buildClarificationPrompt(missingFields, this.toPlainObject(partialData)) },
        ],
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw new ExtractionError('Failed to generate clarification message', error);
    }
  }

  /**
   * Normalize and validate the extraction response
   */
  private normalizeResponse(
    raw: RawExtractionResponse,
    customerPhone?: string
  ): ExtractedJobRequest {
    // Use provided phone if not extracted
    const phoneField = raw.customerPhone || createEmptyField<string>();
    if (!phoneField.value && customerPhone) {
      phoneField.value = this.normalizePhone(customerPhone);
      phoneField.confidence = 0.95;
      phoneField.source = 'inferred';
    }

    // Normalize service type
    const serviceTypeField = raw.serviceType || createEmptyField<ServiceType>();
    if (serviceTypeField.value) {
      serviceTypeField.value = this.normalizeServiceType(serviceTypeField.value as string);
    }

    // Calculate overall confidence
    const fields = [
      raw.customerName,
      phoneField,
      raw.customerAddress,
      serviceTypeField,
      raw.description,
    ].filter(Boolean);

    const overallConfidence = fields.length > 0
      ? fields.reduce((sum, f) => sum + (f?.confidence || 0), 0) / fields.length
      : 0;

    // Determine if review is needed
    const requiresReview = this.shouldRequireReview(raw, overallConfidence);

    return {
      customerName: raw.customerName,
      customerPhone: phoneField,
      customerAddress: raw.customerAddress,
      serviceType: serviceTypeField,
      urgency: raw.urgency || createDefaultField('normal'),
      description: raw.description,
      preferredDate: raw.preferredDate,
      preferredTimeSlot: raw.preferredTimeSlot,
      notes: raw.notes,
      referenceNumber: raw.referenceNumber,
      overallConfidence: raw.overallConfidence ?? overallConfidence,
      requiresReview: raw.requiresReview ?? requiresReview,
      reviewReason: raw.reviewReason,
    };
  }

  /**
   * Normalize phone number to standard format
   */
  private normalizePhone(phone: string): string {
    // Remove all non-numeric characters except +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Add Argentina country code if missing
    if (!normalized.startsWith('+')) {
      if (normalized.startsWith('54')) {
        normalized = '+' + normalized;
      } else if (normalized.length === 10) {
        // Assume it's a local number
        normalized = '+54' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Normalize service type to valid enum
   */
  private normalizeServiceType(type: string): ServiceType {
    const typeMap: Record<string, ServiceType> = {
      'instalacion_split': 'instalacion_split',
      'instalacion split': 'instalacion_split',
      'instalar split': 'instalacion_split',
      'instalar aire': 'instalacion_split',
      'reparacion_split': 'reparacion_split',
      'reparacion split': 'reparacion_split',
      'reparar split': 'reparacion_split',
      'reparar aire': 'reparacion_split',
      'arreglar aire': 'reparacion_split',
      'mantenimiento_split': 'mantenimiento_split',
      'mantenimiento split': 'mantenimiento_split',
      'limpieza split': 'mantenimiento_split',
      'limpiar aire': 'mantenimiento_split',
      'service aire': 'mantenimiento_split',
      'instalacion_calefactor': 'instalacion_calefactor',
      'instalacion calefactor': 'instalacion_calefactor',
      'instalar calefactor': 'instalacion_calefactor',
      'instalar estufa': 'instalacion_calefactor',
      'reparacion_calefactor': 'reparacion_calefactor',
      'reparacion calefactor': 'reparacion_calefactor',
      'reparar calefactor': 'reparacion_calefactor',
      'arreglar calefactor': 'reparacion_calefactor',
      'mantenimiento_calefactor': 'mantenimiento_calefactor',
      'mantenimiento calefactor': 'mantenimiento_calefactor',
    };

    const normalized = type.toLowerCase().trim();
    return typeMap[normalized] || 'otro';
  }

  /**
   * Determine if extraction requires human review
   */
  private shouldRequireReview(
    raw: RawExtractionResponse,
    overallConfidence: number
  ): boolean {
    // Low overall confidence
    if (overallConfidence < 0.65) return true;

    // Missing critical fields
    if (!raw.customerAddress?.value && !raw.customerPhone?.value) return true;
    if (!raw.serviceType?.value && !raw.description?.value) return true;

    // Any field with very low confidence
    const criticalFields = [
      raw.customerAddress,
      raw.serviceType,
      raw.description,
    ];

    for (const field of criticalFields) {
      if (field?.value && field.confidence < 0.5) return true;
    }

    return false;
  }

  /**
   * Convert ExtractedJobRequest to plain object for prompts
   */
  private toPlainObject(data: ExtractedJobRequest): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'value' in value) {
        result[key] = (value as ExtractedField<unknown>).value;
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function createEmptyField<T>(): ExtractedField<T> {
  return {
    value: null as unknown as T,
    confidence: 0,
    source: 'default',
  };
}

function createDefaultField<T>(value: T): ExtractedField<T> {
  return {
    value,
    confidence: 0.5,
    source: 'default',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RawExtractionResponse {
  customerName?: ExtractedField<string>;
  customerPhone?: ExtractedField<string>;
  customerAddress?: ExtractedField<string>;
  serviceType?: ExtractedField<string>;
  urgency?: ExtractedField<'normal' | 'urgente' | 'programado'>;
  description?: ExtractedField<string>;
  preferredDate?: ExtractedField<string>;
  preferredTimeSlot?: ExtractedField<string>;
  notes?: ExtractedField<string>;
  referenceNumber?: ExtractedField<string>;
  overallConfidence?: number;
  requiresReview?: boolean;
  reviewReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class ExtractionError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ExtractionError';
    this.cause = cause;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let gptExtractor: GPTExtractor | null = null;

export function getGPTExtractor(): GPTExtractor {
  if (!gptExtractor) {
    gptExtractor = new GPTExtractor();
  }
  return gptExtractor;
}
