/**
 * Confidence Scorer
 * =================
 *
 * Score and evaluate extraction confidence for routing decisions
 */

import {
  ExtractedJobRequest,
  ExtractedField,
  ConfidenceScore,
  ConfidenceLevel,
  ConfidenceFactor,
  ConfidenceThresholds,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  TranscriptionResult,
} from '../voice-ai.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Weights for different factors in overall confidence
const FACTOR_WEIGHTS = {
  transcriptionQuality: 0.20,
  fieldCompleteness: 0.25,
  fieldConfidence: 0.30,
  addressValidity: 0.15,
  serviceTypeClarity: 0.10,
};

// Required fields for a valid job request
const REQUIRED_FIELDS = ['customerAddress', 'serviceType', 'description'];
const OPTIONAL_FIELDS = ['customerName', 'customerPhone', 'preferredDate', 'preferredTimeSlot'];

// ═══════════════════════════════════════════════════════════════════════════════
// SCORER
// ═══════════════════════════════════════════════════════════════════════════════

export class ConfidenceScorer {
  private thresholds: ConfidenceThresholds;

  constructor(thresholds?: Partial<ConfidenceThresholds>) {
    this.thresholds = { ...DEFAULT_CONFIDENCE_THRESHOLDS, ...thresholds };
  }

  /**
   * Calculate overall confidence score for an extraction
   */
  score(
    extraction: ExtractedJobRequest,
    transcription?: TranscriptionResult
  ): ConfidenceScore {
    const factors: ConfidenceFactor[] = [];

    // Factor 1: Transcription Quality
    if (transcription) {
      const transcriptionFactor = this.scoreTranscriptionQuality(transcription);
      factors.push(transcriptionFactor);
    }

    // Factor 2: Field Completeness
    const completenessFactor = this.scoreFieldCompleteness(extraction);
    factors.push(completenessFactor);

    // Factor 3: Individual Field Confidence
    const fieldConfidenceFactor = this.scoreFieldConfidence(extraction);
    factors.push(fieldConfidenceFactor);

    // Factor 4: Address Validity
    const addressFactor = this.scoreAddressValidity(extraction);
    factors.push(addressFactor);

    // Factor 5: Service Type Clarity
    const serviceTypeFactor = this.scoreServiceTypeClarity(extraction);
    factors.push(serviceTypeFactor);

    // Calculate weighted score
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight;

    // Determine confidence level
    const level = this.determineLevel(weightedScore);

    return {
      level,
      score: weightedScore,
      factors,
    };
  }

  /**
   * Score a single field
   */
  scoreField<T>(field?: ExtractedField<T>): number {
    if (!field || field.value === null || field.value === undefined) {
      return 0;
    }

    // Base score from field confidence
    let score = field.confidence;

    // Boost for extracted (vs inferred/default) source
    if (field.source === 'extracted') {
      score = Math.min(1, score * 1.1);
    } else if (field.source === 'default') {
      score = score * 0.7;
    }

    return score;
  }

  /**
   * Get the confidence level from a score
   */
  determineLevel(score: number): ConfidenceLevel {
    if (score >= this.thresholds.high) return 'high';
    if (score >= this.thresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Check if extraction meets minimum requirements
   */
  meetsMinimumRequirements(extraction: ExtractedJobRequest): {
    meets: boolean;
    missing: string[];
  } {
    const missing: string[] = [];

    // Check for address OR phone (need at least one way to contact/locate)
    const hasContactInfo = extraction.customerAddress?.value || extraction.customerPhone?.value;
    if (!hasContactInfo) {
      missing.push('contactInfo');
    }

    // Check for service indication
    const hasServiceInfo = extraction.serviceType?.value || extraction.description?.value;
    if (!hasServiceInfo) {
      missing.push('serviceInfo');
    }

    return {
      meets: missing.length === 0,
      missing,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE SCORING METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  private scoreTranscriptionQuality(transcription: TranscriptionResult): ConfidenceFactor {
    let score = transcription.confidence;

    // Penalize very short transcriptions
    if (transcription.text.length < 20) {
      score *= 0.7;
    }

    // Boost for longer, more detailed transcriptions
    if (transcription.text.length > 100) {
      score = Math.min(1, score * 1.1);
    }

    // Check segment confidence variance
    if (transcription.segments.length > 0) {
      const avgSegmentConfidence =
        transcription.segments.reduce((sum, s) => sum + s.confidence, 0) /
        transcription.segments.length;

      // Penalize if segment confidence is much lower than overall
      if (avgSegmentConfidence < transcription.confidence * 0.8) {
        score *= 0.9;
      }
    }

    return {
      name: 'transcriptionQuality',
      score,
      weight: FACTOR_WEIGHTS.transcriptionQuality,
      reason: score < 0.7 ? 'Poor transcription quality' : undefined,
    };
  }

  private scoreFieldCompleteness(extraction: ExtractedJobRequest): ConfidenceFactor {
    let filledRequired = 0;
    let filledOptional = 0;

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      const value = extraction[field as keyof ExtractedJobRequest];
      if (value && typeof value === 'object' && 'value' in value && value.value) {
        filledRequired++;
      }
    }

    // Check optional fields
    for (const field of OPTIONAL_FIELDS) {
      const value = extraction[field as keyof ExtractedJobRequest];
      if (value && typeof value === 'object' && 'value' in value && value.value) {
        filledOptional++;
      }
    }

    // Calculate score: required fields are more important
    const requiredScore = filledRequired / REQUIRED_FIELDS.length;
    const optionalScore = filledOptional / OPTIONAL_FIELDS.length;
    const score = requiredScore * 0.7 + optionalScore * 0.3;

    const missingRequired = REQUIRED_FIELDS.length - filledRequired;

    return {
      name: 'fieldCompleteness',
      score,
      weight: FACTOR_WEIGHTS.fieldCompleteness,
      reason: missingRequired > 0 ? `Missing ${missingRequired} required field(s)` : undefined,
    };
  }

  private scoreFieldConfidence(extraction: ExtractedJobRequest): ConfidenceFactor {
    const fieldScores: number[] = [];

    // Score all fields with values
    const fields = [
      extraction.customerName,
      extraction.customerPhone,
      extraction.customerAddress,
      extraction.serviceType,
      extraction.description,
      extraction.urgency,
    ];

    for (const field of fields) {
      if (field?.value) {
        fieldScores.push(field.confidence);
      }
    }

    // Average confidence of filled fields
    const score = fieldScores.length > 0
      ? fieldScores.reduce((sum, s) => sum + s, 0) / fieldScores.length
      : 0;

    // Find lowest confidence field
    const lowestConfidence = Math.min(...fieldScores, 1);

    return {
      name: 'fieldConfidence',
      score,
      weight: FACTOR_WEIGHTS.fieldConfidence,
      reason: lowestConfidence < 0.6 ? 'Some fields have low confidence' : undefined,
    };
  }

  private scoreAddressValidity(extraction: ExtractedJobRequest): ConfidenceFactor {
    const address = extraction.customerAddress;

    if (!address?.value) {
      return {
        name: 'addressValidity',
        score: 0,
        weight: FACTOR_WEIGHTS.addressValidity,
        reason: 'No address provided',
      };
    }

    let score = address.confidence;

    // Check for address components
    const addressValue = address.value.toLowerCase();

    // Look for street indicators
    const hasStreet = /calle|av\.|avenida|pasaje|boulevard/.test(addressValue);
    const hasNumber = /\d+/.test(addressValue);
    const hasNeighborhood = /barrio|villa|zona|centro/.test(addressValue);
    const hasCity = /ciudad|capital|buenos aires|córdoba|rosario/.test(addressValue);

    // Boost for complete addresses
    if (hasStreet && hasNumber) {
      score = Math.min(1, score * 1.1);
    }

    // Boost for additional details
    if (hasNeighborhood || hasCity) {
      score = Math.min(1, score * 1.05);
    }

    // Penalize very short addresses
    if (address.value.length < 10) {
      score *= 0.7;
    }

    return {
      name: 'addressValidity',
      score,
      weight: FACTOR_WEIGHTS.addressValidity,
      reason: !hasStreet && !hasNumber ? 'Address may be incomplete' : undefined,
    };
  }

  private scoreServiceTypeClarity(extraction: ExtractedJobRequest): ConfidenceFactor {
    const serviceType = extraction.serviceType;
    const description = extraction.description;

    // Need at least one
    if (!serviceType?.value && !description?.value) {
      return {
        name: 'serviceTypeClarity',
        score: 0,
        weight: FACTOR_WEIGHTS.serviceTypeClarity,
        reason: 'No service type or description',
      };
    }

    let score = 0;

    // Service type is most reliable
    if (serviceType?.value && serviceType.value !== 'otro') {
      score = serviceType.confidence;
    } else if (description?.value) {
      // Fall back to description confidence
      score = description.confidence * 0.9;
    }

    // Boost if both are present and consistent
    if (serviceType?.value && description?.value) {
      score = Math.min(1, score * 1.1);
    }

    return {
      name: 'serviceTypeClarity',
      score,
      weight: FACTOR_WEIGHTS.serviceTypeClarity,
      reason: serviceType?.value === 'otro' ? 'Service type unclear' : undefined,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let confidenceScorer: ConfidenceScorer | null = null;

export function getConfidenceScorer(): ConfidenceScorer {
  if (!confidenceScorer) {
    confidenceScorer = new ConfidenceScorer();
  }
  return confidenceScorer;
}
