/**
 * Confidence Router
 * =================
 *
 * Route voice message processing based on extraction confidence
 */

import {
  ExtractedJobRequest,
  TranscriptionResult,
  RoutingDecision,
  VoiceProcessingRoute,
  ConfidenceScore,
  ConfidenceThresholds,
  DEFAULT_CONFIDENCE_THRESHOLDS,
} from '../voice-ai.types';
import { ConfidenceScorer, getConfidenceScorer } from '../extraction/confidence-scorer';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Route-specific thresholds
const ROUTE_THRESHOLDS = {
  autoCreate: 0.85, // High confidence - auto-create job
  confirmUser: 0.65, // Medium confidence - ask for confirmation
  humanReview: 0.0, // Low confidence - route to human
};

// Actions per route
const ROUTE_ACTIONS: Record<VoiceProcessingRoute, string> = {
  auto_create: 'Crear trabajo automaticamente y notificar al cliente',
  confirm_user: 'Enviar mensaje de confirmacion al cliente via WhatsApp',
  human_review: 'Agregar a cola de revision para operador',
  fallback: 'Notificar al cliente que no se pudo procesar y derivar a operador',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

export class ConfidenceRouter {
  private scorer: ConfidenceScorer;
  private thresholds: typeof ROUTE_THRESHOLDS;

  constructor(
    thresholds?: Partial<typeof ROUTE_THRESHOLDS>,
    confidenceThresholds?: Partial<ConfidenceThresholds>
  ) {
    this.scorer = confidenceThresholds
      ? new ConfidenceScorer(confidenceThresholds)
      : getConfidenceScorer();
    this.thresholds = { ...ROUTE_THRESHOLDS, ...thresholds };
  }

  /**
   * Determine processing route based on extraction results
   */
  route(
    extraction: ExtractedJobRequest,
    transcription?: TranscriptionResult
  ): RoutingDecision {
    // Score the extraction
    const confidence = this.scorer.score(extraction, transcription);

    // Check minimum requirements
    const requirements = this.scorer.meetsMinimumRequirements(extraction);

    // If doesn't meet requirements, route to human review
    if (!requirements.meets) {
      return {
        route: 'human_review',
        confidence,
        extractedData: extraction,
        reason: `Missing required information: ${requirements.missing.join(', ')}`,
        suggestedAction: ROUTE_ACTIONS.human_review,
      };
    }

    // Check if explicitly marked for review
    if (extraction.requiresReview) {
      return {
        route: 'human_review',
        confidence,
        extractedData: extraction,
        reason: extraction.reviewReason || 'Extraction flagged for review',
        suggestedAction: ROUTE_ACTIONS.human_review,
      };
    }

    // Route based on confidence score
    const route = this.determineRoute(confidence.score);

    return {
      route,
      confidence,
      extractedData: extraction,
      reason: this.getRouteReason(route, confidence),
      suggestedAction: ROUTE_ACTIONS[route],
    };
  }

  /**
   * Route with fallback handling
   */
  routeWithFallback(
    extraction: ExtractedJobRequest | null,
    transcription?: TranscriptionResult,
    error?: Error
  ): RoutingDecision {
    // If extraction failed completely
    if (!extraction) {
      return {
        route: 'fallback',
        confidence: {
          level: 'low',
          score: 0,
          factors: [],
        },
        reason: error?.message || 'Extraction failed',
        suggestedAction: ROUTE_ACTIONS.fallback,
      };
    }

    // Normal routing
    return this.route(extraction, transcription);
  }

  /**
   * Check if a route allows automatic job creation
   */
  canAutoCreate(decision: RoutingDecision): boolean {
    return decision.route === 'auto_create';
  }

  /**
   * Check if confirmation is needed
   */
  needsConfirmation(decision: RoutingDecision): boolean {
    return decision.route === 'confirm_user';
  }

  /**
   * Check if human review is required
   */
  needsHumanReview(decision: RoutingDecision): boolean {
    return decision.route === 'human_review' || decision.route === 'fallback';
  }

  /**
   * Get fields that need confirmation (medium confidence)
   */
  getFieldsNeedingConfirmation(extraction: ExtractedJobRequest): string[] {
    const mediumConfidenceFields: string[] = [];

    const fieldEntries: [string, unknown][] = Object.entries(extraction);

    for (const [key, value] of fieldEntries) {
      if (
        value &&
        typeof value === 'object' &&
        'confidence' in value &&
        value.value !== null
      ) {
        const field = value as { confidence: number; value: unknown };
        // Medium confidence: between 0.5 and 0.85
        if (field.confidence >= 0.5 && field.confidence < 0.85) {
          mediumConfidenceFields.push(key);
        }
      }
    }

    return mediumConfidenceFields;
  }

  /**
   * Get fields that are missing or very low confidence
   */
  getMissingOrUncertainFields(extraction: ExtractedJobRequest): string[] {
    const problematicFields: string[] = [];
    const criticalFields = [
      'customerAddress',
      'customerPhone',
      'serviceType',
      'description',
    ];

    for (const key of criticalFields) {
      const value = extraction[key as keyof ExtractedJobRequest];

      if (!value) {
        problematicFields.push(key);
        continue;
      }

      if (typeof value === 'object' && 'confidence' in value) {
        const field = value as { confidence: number; value: unknown };
        if (field.value === null || field.confidence < 0.5) {
          problematicFields.push(key);
        }
      }
    }

    return problematicFields;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private determineRoute(score: number): VoiceProcessingRoute {
    if (score >= this.thresholds.autoCreate) {
      return 'auto_create';
    }
    if (score >= this.thresholds.confirmUser) {
      return 'confirm_user';
    }
    return 'human_review';
  }

  private getRouteReason(route: VoiceProcessingRoute, confidence: ConfidenceScore): string {
    switch (route) {
      case 'auto_create':
        return `Alta confianza (${(confidence.score * 100).toFixed(0)}%) - Datos completos y claros`;

      case 'confirm_user':
        const lowFactors = confidence.factors
          .filter((f) => f.score < 0.7)
          .map((f) => f.reason || f.name)
          .filter(Boolean);

        return lowFactors.length > 0
          ? `Confianza media (${(confidence.score * 100).toFixed(0)}%) - ${lowFactors.join(', ')}`
          : `Confianza media (${(confidence.score * 100).toFixed(0)}%) - Requiere confirmacion`;

      case 'human_review':
        const issues = confidence.factors
          .filter((f) => f.reason)
          .map((f) => f.reason)
          .join(', ');

        return issues
          ? `Baja confianza (${(confidence.score * 100).toFixed(0)}%) - ${issues}`
          : `Baja confianza (${(confidence.score * 100).toFixed(0)}%) - Requiere revision manual`;

      case 'fallback':
        return 'No se pudo procesar el mensaje';

      default:
        return 'Unknown route';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let confidenceRouter: ConfidenceRouter | null = null;

export function getConfidenceRouter(): ConfidenceRouter {
  if (!confidenceRouter) {
    confidenceRouter = new ConfidenceRouter();
  }
  return confidenceRouter;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quick route check without full scoring
 */
export function quickRouteCheck(
  overallConfidence: number,
  requiresReview: boolean
): VoiceProcessingRoute {
  if (requiresReview) return 'human_review';
  if (overallConfidence >= ROUTE_THRESHOLDS.autoCreate) return 'auto_create';
  if (overallConfidence >= ROUTE_THRESHOLDS.confirmUser) return 'confirm_user';
  return 'human_review';
}
