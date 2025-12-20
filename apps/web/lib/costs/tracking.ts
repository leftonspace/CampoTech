/**
 * CampoTech Cost Tracking Helpers (Phase 8A.1.3)
 * ===============================================
 *
 * Convenient functions to track costs from various services.
 * Use these helpers to automatically track costs when making API calls.
 *
 * Usage:
 * ```typescript
 * // After OpenAI call
 * await trackOpenAICost('gpt-4-turbo', inputTokens, outputTokens, orgId);
 *
 * // After Twilio SMS
 * await trackTwilioCost(messageBody, false, orgId);
 *
 * // After Google Maps geocode
 * await trackMapsCost('geocode', orgId);
 * ```
 */

import {
  costs,
  calculateOpenAICost,
  calculateTwilioCost,
  calculateMapsCost,
  calculateWhatsAppCost,
  SERVICE_COSTS,
} from './aggregator';

/**
 * Track OpenAI API cost
 *
 * @param model - The model used (gpt-4-turbo, gpt-4, gpt-3.5-turbo, whisper-1)
 * @param inputTokens - Number of input tokens (for chat models)
 * @param outputTokens - Number of output tokens (for chat models)
 * @param organizationId - Optional organization ID
 * @param audioMinutes - Audio duration in minutes (for whisper)
 */
export async function trackOpenAICost(
  model: keyof typeof SERVICE_COSTS.openai,
  inputTokens: number = 0,
  outputTokens: number = 0,
  organizationId?: string,
  audioMinutes?: number
): Promise<number> {
  const amount = calculateOpenAICost(model, inputTokens, outputTokens, audioMinutes);

  if (amount > 0) {
    await costs.track({
      service: 'openai',
      amount,
      organizationId,
      metadata: {
        model,
        inputTokens,
        outputTokens,
        audioMinutes,
      },
    });
  }

  return amount;
}

/**
 * Track Twilio SMS cost
 *
 * @param messageBody - The SMS message content (to calculate segments)
 * @param isInbound - Whether this is an inbound message
 * @param organizationId - Optional organization ID
 */
export async function trackTwilioCost(
  messageBody: string,
  isInbound: boolean = false,
  organizationId?: string
): Promise<number> {
  const amount = calculateTwilioCost(messageBody.length, isInbound);

  await costs.track({
    service: 'twilio',
    amount,
    organizationId,
    metadata: {
      direction: isInbound ? 'inbound' : 'outbound',
      segments: Math.ceil(messageBody.length / 160),
    },
  });

  return amount;
}

/**
 * Track Google Maps API cost
 *
 * @param operation - The Maps API operation (geocode, directions, places)
 * @param organizationId - Optional organization ID
 */
export async function trackMapsCost(
  operation: keyof typeof SERVICE_COSTS.maps,
  organizationId?: string
): Promise<number> {
  const amount = calculateMapsCost(operation);

  await costs.track({
    service: 'maps',
    amount,
    organizationId,
    metadata: { operation },
  });

  return amount;
}

/**
 * Track WhatsApp Business API cost
 *
 * @param isBusinessInitiated - Whether message was initiated by business
 * @param organizationId - Optional organization ID
 */
export async function trackWhatsAppCost(
  isBusinessInitiated: boolean,
  organizationId?: string
): Promise<number> {
  const amount = calculateWhatsAppCost(isBusinessInitiated);

  await costs.track({
    service: 'whatsapp',
    amount,
    organizationId,
    metadata: {
      type: isBusinessInitiated ? 'business_initiated' : 'user_initiated',
    },
  });

  return amount;
}

/**
 * Track Supabase usage cost
 * Note: Supabase costs are typically billed monthly, but we track estimates
 *
 * @param operation - Type of operation (database, storage, auth)
 * @param amount - Estimated cost
 * @param organizationId - Optional organization ID
 */
export async function trackSupabaseCost(
  operation: 'database' | 'storage' | 'auth' | 'egress',
  amount: number,
  organizationId?: string
): Promise<number> {
  await costs.track({
    service: 'supabase',
    amount,
    organizationId,
    metadata: { operation },
  });

  return amount;
}

/**
 * Create a cost tracker wrapper for async functions
 * Automatically tracks cost after function completes
 *
 * @example
 * const trackedGeocode = withCostTracking(
 *   geocodeAddress,
 *   (result) => ({ service: 'maps', amount: 0.005 })
 * );
 * const location = await trackedGeocode('123 Main St');
 */
export function withCostTracking<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  getCost: (result: TResult, args: TArgs) => {
    service: 'openai' | 'twilio' | 'maps' | 'whatsapp' | 'supabase';
    amount: number;
    organizationId?: string;
    metadata?: Record<string, unknown>;
  }
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const result = await fn(...args);
    const costData = getCost(result, args);

    await costs.track({
      service: costData.service,
      amount: costData.amount,
      organizationId: costData.organizationId,
      metadata: costData.metadata,
    });

    return result;
  };
}
