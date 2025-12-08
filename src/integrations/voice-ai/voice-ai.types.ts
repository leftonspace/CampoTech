/**
 * Voice AI Types
 * ==============
 *
 * Type definitions for voice message processing and extraction
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSCRIPTION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments: TranscriptionSegment[];
  confidence: number;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence: number;
  words?: TranscriptionWord[];
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACTION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtractedJobRequest {
  // Customer info
  customerName?: ExtractedField<string>;
  customerPhone?: ExtractedField<string>;
  customerAddress?: ExtractedField<string>;

  // Job details
  serviceType?: ExtractedField<ServiceType>;
  urgency?: ExtractedField<'normal' | 'urgente' | 'programado'>;
  description?: ExtractedField<string>;

  // Scheduling
  preferredDate?: ExtractedField<string>;
  preferredTimeSlot?: ExtractedField<string>;

  // Additional
  notes?: ExtractedField<string>;
  referenceNumber?: ExtractedField<string>;

  // Metadata
  overallConfidence: number;
  requiresReview: boolean;
  reviewReason?: string;
}

export interface ExtractedField<T> {
  value: T;
  confidence: number;
  source: 'extracted' | 'inferred' | 'default';
  rawText?: string;
}

export type ServiceType =
  | 'instalacion_split'
  | 'reparacion_split'
  | 'mantenimiento_split'
  | 'instalacion_calefactor'
  | 'reparacion_calefactor'
  | 'mantenimiento_calefactor'
  | 'otro';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceThresholds {
  high: number;
  medium: number;
  low: number;
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  high: 0.85,
  medium: 0.65,
  low: 0.0,
};

export interface ConfidenceScore {
  level: ConfidenceLevel;
  score: number;
  factors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  name: string;
  score: number;
  weight: number;
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type VoiceProcessingRoute =
  | 'auto_create' // High confidence - create job automatically
  | 'confirm_user' // Medium confidence - ask user to confirm
  | 'human_review' // Low confidence - route to human review
  | 'fallback'; // Processing failed - manual handling

export interface RoutingDecision {
  route: VoiceProcessingRoute;
  confidence: ConfidenceScore;
  extractedData?: ExtractedJobRequest;
  reason: string;
  suggestedAction: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE MESSAGE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VoiceMessage {
  id: string;
  waMessageId: string;
  conversationId: string;
  customerId?: string;
  customerPhone: string;

  // Audio info
  audioUrl: string;
  audioDuration: number;
  audioMimeType: string;
  audioSize: number;

  // Processing status
  status: VoiceMessageStatus;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;

  // Results
  transcription?: TranscriptionResult;
  extraction?: ExtractedJobRequest;
  routing?: RoutingDecision;

  // Review
  reviewerId?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  correctedData?: ExtractedJobRequest;

  // Outcome
  jobId?: string;
  outcome?: VoiceMessageOutcome;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
}

export type VoiceMessageStatus =
  | 'pending' // Waiting to be processed
  | 'downloading' // Downloading audio
  | 'transcribing' // Running through Whisper
  | 'extracting' // Running through GPT
  | 'routing' // Determining next step
  | 'awaiting_confirmation' // Waiting for user confirmation
  | 'awaiting_review' // In human review queue
  | 'completed' // Successfully processed
  | 'failed'; // Processing failed

export type VoiceMessageOutcome =
  | 'job_created' // Job was created
  | 'job_updated' // Existing job updated
  | 'rejected' // Request was rejected
  | 'duplicate' // Duplicate request
  | 'invalid' // Invalid/spam message
  | 'manual'; // Handled manually

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEW QUEUE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReviewQueueItem {
  voiceMessage: VoiceMessage;
  priority: number;
  assignedTo?: string;
  dueBy?: Date;
  tags: string[];
}

export interface ReviewAction {
  action: 'approve' | 'edit' | 'reject' | 'escalate';
  corrections?: Partial<ExtractedJobRequest>;
  notes?: string;
  createJob?: boolean;
}

export interface ReviewFeedback {
  voiceMessageId: string;
  originalExtraction: ExtractedJobRequest;
  correctedExtraction: ExtractedJobRequest;
  feedbackType: 'correction' | 'approval' | 'rejection';
  fieldCorrections: FieldCorrection[];
  timestamp: Date;
}

export interface FieldCorrection {
  field: string;
  originalValue: unknown;
  correctedValue: unknown;
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProcessVoiceMessageRequest {
  waMessageId: string;
  audioUrl: string;
  audioDuration: number;
  customerPhone: string;
  conversationId: string;
}

export interface ProcessVoiceMessageResponse {
  success: boolean;
  voiceMessageId: string;
  status: VoiceMessageStatus;
  route?: VoiceProcessingRoute;
  extractedData?: ExtractedJobRequest;
  error?: string;
}

export interface WhisperConfig {
  model: 'whisper-1';
  language?: string;
  prompt?: string;
  responseFormat: 'json' | 'verbose_json';
  temperature?: number;
}

export interface GPTExtractionConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}
