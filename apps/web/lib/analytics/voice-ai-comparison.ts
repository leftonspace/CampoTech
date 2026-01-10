/**
 * Voice AI Comparison Analytics
 * ============================
 * 
 * Tracking and comparison of Voice AI V1 vs V2 performance.
 * Used for data-driven decisions during the gradual migration.
 * 
 * Metrics tracked:
 * - Processing time (transcription + extraction)
 * - Accuracy (jobs created without correction)
 * - Confidence distribution
 * - Auto-create rate (high confidence)
 * - Confirmation rate (medium confidence)
 * - Human review rate (low confidence)
 * - Customer satisfaction (from ratings if available)
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type VoiceAIVersion = 'v1' | 'v2';

export interface VoiceProcessingEvent {
    messageId: string;
    organizationId: string;
    version: VoiceAIVersion;
    startedAt: Date;
    completedAt: Date;
    processingTimeMs: number;
    transcriptionTimeMs?: number;
    extractionTimeMs?: number;
    confidence?: number;
    outcome: 'auto_created' | 'confirmed' | 'human_review' | 'failed';
    jobId?: string;
    corrected: boolean;
    metadata?: Record<string, unknown>;
}

export interface VoiceAIMetrics {
    version: VoiceAIVersion;
    period: { start: Date; end: Date };

    // Volume
    totalProcessed: number;

    // Speed
    avgProcessingTimeMs: number;
    p95ProcessingTimeMs: number;

    // Quality
    accuracy: number; // % jobs created without correction

    // Routing distribution
    autoCreatedRate: number;   // % high confidence -> auto-created
    confirmationRate: number;  // % medium confidence -> confirmed
    humanReviewRate: number;   // % low confidence -> human review
    failureRate: number;       // % processing failures

    // Confidence stats
    avgConfidence: number;
    confidenceDistribution: {
        high: number;   // >= 0.85
        medium: number; // 0.50 - 0.84
        low: number;    // < 0.50
    };

    // Customer feedback (if available)
    customerSatisfaction?: number;
}

export interface VersionComparison {
    period: { start: Date; end: Date };
    v1: VoiceAIMetrics;
    v2: VoiceAIMetrics;

    // Improvement metrics (positive = V2 is better)
    improvements: {
        accuracy: number;           // Percentage points
        processingSpeed: number;    // Percentage faster
        autoCreateRate: number;     // Percentage points
        humanReviewReduction: number; // Percentage reduction
    };

    // Recommendation
    recommendation: 'expand_v2' | 'hold' | 'rollback_v2';
    recommendationReason: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log a voice processing event for analytics
 */
export async function logVoiceProcessingEvent(event: VoiceProcessingEvent): Promise<void> {
    try {
        // Store in database for analytics
        // Using a generic audit/event log table or dedicated voice analytics table
        await prisma.auditLog.create({
            data: {
                action: 'VOICE_PROCESSING',
                entityType: 'WhatsAppMessage',
                entityId: event.messageId,
                organizationId: event.organizationId,
                metadata: {
                    version: event.version,
                    processingTimeMs: event.processingTimeMs,
                    transcriptionTimeMs: event.transcriptionTimeMs,
                    extractionTimeMs: event.extractionTimeMs,
                    confidence: event.confidence,
                    outcome: event.outcome,
                    jobId: event.jobId,
                    corrected: event.corrected,
                    startedAt: event.startedAt.toISOString(),
                    completedAt: event.completedAt.toISOString(),
                    ...event.metadata,
                },
            },
        });

        console.log(`[VoiceAI Analytics] Logged event: ${event.version} - ${event.outcome}`);
    } catch (error) {
        // Don't fail on analytics errors
        console.error('[VoiceAI Analytics] Failed to log event:', error);
    }
}

/**
 * Create a processing event logger for timing
 */
export function createProcessingTimer(
    messageId: string,
    organizationId: string,
    version: VoiceAIVersion
): ProcessingTimer {
    return new ProcessingTimer(messageId, organizationId, version);
}

class ProcessingTimer {
    private startTime: Date;
    private transcriptionEndTime?: Date;
    private extractionEndTime?: Date;

    constructor(
        private messageId: string,
        private organizationId: string,
        private version: VoiceAIVersion
    ) {
        this.startTime = new Date();
    }

    markTranscriptionComplete(): void {
        this.transcriptionEndTime = new Date();
    }

    markExtractionComplete(): void {
        this.extractionEndTime = new Date();
    }

    async complete(
        outcome: VoiceProcessingEvent['outcome'],
        options: {
            confidence?: number;
            jobId?: string;
            corrected?: boolean;
            metadata?: Record<string, unknown>;
        } = {}
    ): Promise<void> {
        const completedAt = new Date();

        const event: VoiceProcessingEvent = {
            messageId: this.messageId,
            organizationId: this.organizationId,
            version: this.version,
            startedAt: this.startTime,
            completedAt,
            processingTimeMs: completedAt.getTime() - this.startTime.getTime(),
            transcriptionTimeMs: this.transcriptionEndTime ?
                this.transcriptionEndTime.getTime() - this.startTime.getTime() : undefined,
            extractionTimeMs: this.extractionEndTime && this.transcriptionEndTime ?
                this.extractionEndTime.getTime() - this.transcriptionEndTime.getTime() : undefined,
            confidence: options.confidence,
            outcome,
            jobId: options.jobId,
            corrected: options.corrected ?? false,
            metadata: options.metadata,
        };

        await logVoiceProcessingEvent(event);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get metrics for a specific version over a time period
 */
export async function getVoiceAIMetrics(
    version: VoiceAIVersion,
    startDate: Date,
    endDate: Date,
    organizationId?: string
): Promise<VoiceAIMetrics> {
    // Query audit logs for voice processing events
    const where = {
        action: 'VOICE_PROCESSING',
        createdAt: {
            gte: startDate,
            lte: endDate,
        },
        ...(organizationId ? { organizationId } : {}),
    };

    const events = await prisma.auditLog.findMany({
        where,
        select: {
            metadata: true,
        },
    });

    // Filter for this version
    type VoiceMetadata = {
        version: VoiceAIVersion;
        processingTimeMs: number;
        confidence?: number;
        outcome: string;
        corrected: boolean;
    };

    type AuditLogEntry = {
        metadata: Record<string, unknown> | null;
    };

    const versionEvents = events.filter((e: AuditLogEntry) => {
        const metadata = e.metadata as Record<string, unknown> | null;
        return metadata?.version === version;
    }).map((e: AuditLogEntry) => e.metadata as VoiceMetadata);

    if (versionEvents.length === 0) {
        return createEmptyMetrics(version, startDate, endDate);
    }

    // Calculate metrics
    const processingTimes = versionEvents.map((e: VoiceMetadata) => e.processingTimeMs).sort((a: number, b: number) => a - b);
    const confidences = versionEvents
        .filter((e: VoiceMetadata) => e.confidence !== undefined)
        .map((e: VoiceMetadata) => e.confidence!);

    const outcomes = {
        auto_created: versionEvents.filter((e: VoiceMetadata) => e.outcome === 'auto_created').length,
        confirmed: versionEvents.filter((e: VoiceMetadata) => e.outcome === 'confirmed').length,
        human_review: versionEvents.filter((e: VoiceMetadata) => e.outcome === 'human_review').length,
        failed: versionEvents.filter((e: VoiceMetadata) => e.outcome === 'failed').length,
    };

    const total = versionEvents.length;
    const corrected = versionEvents.filter((e: VoiceMetadata) => e.corrected).length;

    // Confidence distribution
    const highConfidence = confidences.filter((c: number) => c >= 0.85).length;
    const mediumConfidence = confidences.filter((c: number) => c >= 0.50 && c < 0.85).length;
    const lowConfidence = confidences.filter((c: number) => c < 0.50).length;

    return {
        version,
        period: { start: startDate, end: endDate },
        totalProcessed: total,
        avgProcessingTimeMs: processingTimes.reduce((a: number, b: number) => a + b, 0) / total,
        p95ProcessingTimeMs: processingTimes[Math.floor(processingTimes.length * 0.95)] || 0,
        accuracy: total > 0 ? (1 - corrected / total) * 100 : 0,
        autoCreatedRate: total > 0 ? (outcomes.auto_created / total) * 100 : 0,
        confirmationRate: total > 0 ? (outcomes.confirmed / total) * 100 : 0,
        humanReviewRate: total > 0 ? (outcomes.human_review / total) * 100 : 0,
        failureRate: total > 0 ? (outcomes.failed / total) * 100 : 0,
        avgConfidence: confidences.length > 0 ?
            confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length : 0,
        confidenceDistribution: {
            high: confidences.length > 0 ? (highConfidence / confidences.length) * 100 : 0,
            medium: confidences.length > 0 ? (mediumConfidence / confidences.length) * 100 : 0,
            low: confidences.length > 0 ? (lowConfidence / confidences.length) * 100 : 0,
        },
    };
}

function createEmptyMetrics(
    version: VoiceAIVersion,
    startDate: Date,
    endDate: Date
): VoiceAIMetrics {
    return {
        version,
        period: { start: startDate, end: endDate },
        totalProcessed: 0,
        avgProcessingTimeMs: 0,
        p95ProcessingTimeMs: 0,
        accuracy: 0,
        autoCreatedRate: 0,
        confirmationRate: 0,
        humanReviewRate: 0,
        failureRate: 0,
        avgConfidence: 0,
        confidenceDistribution: { high: 0, medium: 0, low: 0 },
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION COMPARISON
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compare V1 vs V2 metrics over a time period
 */
export async function compareVoiceAIVersions(
    startDate: Date,
    endDate: Date,
    organizationId?: string
): Promise<VersionComparison> {
    const [v1Metrics, v2Metrics] = await Promise.all([
        getVoiceAIMetrics('v1', startDate, endDate, organizationId),
        getVoiceAIMetrics('v2', startDate, endDate, organizationId),
    ]);

    // Calculate improvements
    const accuracyImprovement = v2Metrics.accuracy - v1Metrics.accuracy;
    const speedImprovement = v1Metrics.avgProcessingTimeMs > 0 ?
        ((v1Metrics.avgProcessingTimeMs - v2Metrics.avgProcessingTimeMs) / v1Metrics.avgProcessingTimeMs) * 100 : 0;
    const autoCreateImprovement = v2Metrics.autoCreatedRate - v1Metrics.autoCreatedRate;
    const humanReviewReduction = v1Metrics.humanReviewRate - v2Metrics.humanReviewRate;

    // Determine recommendation
    let recommendation: VersionComparison['recommendation'] = 'hold';
    let recommendationReason = '';

    if (v2Metrics.totalProcessed < 50) {
        recommendation = 'hold';
        recommendationReason = 'Insufficient V2 data for comparison (< 50 messages processed)';
    } else if (v2Metrics.failureRate > 10) {
        recommendation = 'rollback_v2';
        recommendationReason = `V2 failure rate too high: ${v2Metrics.failureRate.toFixed(1)}%`;
    } else if (accuracyImprovement > 5 && speedImprovement > 0 && autoCreateImprovement > 0) {
        recommendation = 'expand_v2';
        recommendationReason = `V2 showing significant improvements across all metrics`;
    } else if (accuracyImprovement > 0 && v2Metrics.failureRate < 5) {
        recommendation = 'expand_v2';
        recommendationReason = `V2 accuracy improved by ${accuracyImprovement.toFixed(1)}% with stable failure rate`;
    } else if (accuracyImprovement < -5 || speedImprovement < -20) {
        recommendation = 'rollback_v2';
        recommendationReason = `V2 showing regressions: accuracy ${accuracyImprovement.toFixed(1)}%, speed ${speedImprovement.toFixed(1)}%`;
    } else {
        recommendation = 'hold';
        recommendationReason = `V2 performance neutral - continue monitoring`;
    }

    return {
        period: { start: startDate, end: endDate },
        v1: v1Metrics,
        v2: v2Metrics,
        improvements: {
            accuracy: accuracyImprovement,
            processingSpeed: speedImprovement,
            autoCreateRate: autoCreateImprovement,
            humanReviewReduction,
        },
        recommendation,
        recommendationReason,
    };
}

/**
 * Get weekly comparison report
 */
export async function getWeeklyComparisonReport(): Promise<VersionComparison> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    return compareVoiceAIVersions(startDate, endDate);
}

/**
 * Print comparison to console (for debugging/monitoring)
 */
export async function printVersionComparison(): Promise<void> {
    const comparison = await getWeeklyComparisonReport();

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('📊 VOICE AI V1 vs V2 COMPARISON (Last 7 Days)');
    console.log('════════════════════════════════════════════════════════════════\n');

    console.log('VOLUME:');
    console.log(`  V1: ${comparison.v1.totalProcessed} messages`);
    console.log(`  V2: ${comparison.v2.totalProcessed} messages\n`);

    console.log('ACCURACY (% jobs created without correction):');
    console.log(`  V1: ${comparison.v1.accuracy.toFixed(1)}%`);
    console.log(`  V2: ${comparison.v2.accuracy.toFixed(1)}%`);
    console.log(`  Improvement: ${comparison.improvements.accuracy > 0 ? '+' : ''}${comparison.improvements.accuracy.toFixed(1)}%\n`);

    console.log('PROCESSING SPEED (avg ms):');
    console.log(`  V1: ${comparison.v1.avgProcessingTimeMs.toFixed(0)}ms`);
    console.log(`  V2: ${comparison.v2.avgProcessingTimeMs.toFixed(0)}ms`);
    console.log(`  Improvement: ${comparison.improvements.processingSpeed > 0 ? '+' : ''}${comparison.improvements.processingSpeed.toFixed(1)}%\n`);

    console.log('AUTO-CREATE RATE (high confidence):');
    console.log(`  V1: ${comparison.v1.autoCreatedRate.toFixed(1)}%`);
    console.log(`  V2: ${comparison.v2.autoCreatedRate.toFixed(1)}%`);
    console.log(`  Improvement: ${comparison.improvements.autoCreateRate > 0 ? '+' : ''}${comparison.improvements.autoCreateRate.toFixed(1)}%\n`);

    console.log('HUMAN REVIEW RATE:');
    console.log(`  V1: ${comparison.v1.humanReviewRate.toFixed(1)}%`);
    console.log(`  V2: ${comparison.v2.humanReviewRate.toFixed(1)}%`);
    console.log(`  Reduction: ${comparison.improvements.humanReviewReduction > 0 ? '+' : ''}${comparison.improvements.humanReviewReduction.toFixed(1)}%\n`);

    console.log('FAILURE RATE:');
    console.log(`  V1: ${comparison.v1.failureRate.toFixed(1)}%`);
    console.log(`  V2: ${comparison.v2.failureRate.toFixed(1)}%\n`);

    console.log('════════════════════════════════════════════════════════════════');
    console.log(`📋 RECOMMENDATION: ${comparison.recommendation.toUpperCase()}`);
    console.log(`   ${comparison.recommendationReason}`);
    console.log('════════════════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLLOUT TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export interface RolloutStatus {
    currentPhase: number;
    phaseName: string;
    v2EnabledOrgs: number;
    totalOrgs: number;
    percentEnabled: number;
    phaseStartDate: Date | null;
    nextPhaseDate: Date | null;
    canAdvance: boolean;
    advanceRequirements: string[];
}

/**
 * Get the current V2 rollout status
 */
export async function getV2RolloutStatus(): Promise<RolloutStatus> {
    // Count organizations with V2 enabled
    const orgs = await prisma.organization.findMany({
        select: {
            id: true,
            settings: true,
            subscriptionTier: true,
        },
    });

    type OrgWithSettings = {
        id: string;
        settings: unknown;
        subscriptionTier: string | null;
    };

    const totalOrgs = orgs.length;
    const v2EnabledOrgs = orgs.filter((org: OrgWithSettings) => {
        const settings = org.settings as Record<string, unknown> | null;
        return settings?.voiceAIV2Enabled === true;
    }).length;

    const percentEnabled = totalOrgs > 0 ? (v2EnabledOrgs / totalOrgs) * 100 : 0;

    // Determine current phase
    let currentPhase = 0;
    let phaseName = 'Not Started';

    if (percentEnabled >= 100) {
        currentPhase = 5;
        phaseName = 'Full Rollout (100%)';
    } else if (percentEnabled >= 50) {
        currentPhase = 4;
        phaseName = 'Majority Rollout (50%+)';
    } else if (percentEnabled >= 25) {
        currentPhase = 3;
        phaseName = 'Expanded Rollout (25%+)';
    } else if (percentEnabled >= 5) {
        currentPhase = 2;
        phaseName = 'Early Adopters (5%+)';
    } else if (percentEnabled > 0) {
        currentPhase = 1;
        phaseName = 'Beta Testing';
    }

    // Check if we can advance
    const comparison = await getWeeklyComparisonReport();
    const canAdvance = comparison.recommendation === 'expand_v2';
    const advanceRequirements: string[] = [];

    if (!canAdvance) {
        if (comparison.v2.totalProcessed < 50) {
            advanceRequirements.push('Need at least 50 V2 messages processed');
        }
        if (comparison.v2.failureRate > 5) {
            advanceRequirements.push(`Reduce failure rate from ${comparison.v2.failureRate.toFixed(1)}% to < 5%`);
        }
        if (comparison.improvements.accuracy < 0) {
            advanceRequirements.push('V2 accuracy should match or exceed V1');
        }
    }

    return {
        currentPhase,
        phaseName,
        v2EnabledOrgs,
        totalOrgs,
        percentEnabled,
        phaseStartDate: null, // Would come from a rollout tracking table
        nextPhaseDate: null,
        canAdvance,
        advanceRequirements,
    };
}
