/**
 * External Services Health Checkers
 * ==================================
 *
 * Checks connectivity to external APIs (WhatsApp, OpenAI, etc.)
 */

import type { HealthChecker, ComponentHealth } from '../health.types';

/**
 * WhatsApp API Health Checker
 */
export class WhatsAppHealthChecker implements HealthChecker {
  name = 'whatsapp';
  private phoneNumberId: string;
  private accessToken: string;
  private timeoutMs: number;

  constructor(phoneNumberId: string, accessToken: string, timeoutMs: number = 5000) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
    this.timeoutMs = timeoutMs;
  }

  async check(): Promise<ComponentHealth> {
    const startTime = Date.now();

    // Skip if not configured
    if (!this.phoneNumberId || !this.accessToken) {
      return {
        name: this.name,
        status: 'degraded',
        message: 'WhatsApp not configured',
        lastChecked: new Date(),
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.phoneNumberId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          name: this.name,
          status: 'unhealthy',
          latencyMs,
          message: `WhatsApp API error: ${response.status}`,
          details: { errorBody },
          lastChecked: new Date(),
        };
      }

      if (latencyMs > 2000) {
        return {
          name: this.name,
          status: 'degraded',
          latencyMs,
          message: 'WhatsApp API responding slowly',
          lastChecked: new Date(),
        };
      }

      return {
        name: this.name,
        status: 'healthy',
        latencyMs,
        message: 'WhatsApp API accessible',
        lastChecked: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown WhatsApp error';

      return {
        name: this.name,
        status: 'unhealthy',
        latencyMs,
        message,
        lastChecked: new Date(),
      };
    }
  }
}

/**
 * OpenAI API Health Checker
 */
export class OpenAIHealthChecker implements HealthChecker {
  name = 'openai';
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs: number = 5000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async check(): Promise<ComponentHealth> {
    const startTime = Date.now();

    // Skip if not configured
    if (!this.apiKey) {
      return {
        name: this.name,
        status: 'degraded',
        message: 'OpenAI not configured',
        lastChecked: new Date(),
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      // Check models endpoint (lightweight check)
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          name: this.name,
          status: 'unhealthy',
          latencyMs,
          message: `OpenAI API error: ${response.status}`,
          lastChecked: new Date(),
        };
      }

      if (latencyMs > 3000) {
        return {
          name: this.name,
          status: 'degraded',
          latencyMs,
          message: 'OpenAI API responding slowly',
          lastChecked: new Date(),
        };
      }

      return {
        name: this.name,
        status: 'healthy',
        latencyMs,
        message: 'OpenAI API accessible',
        lastChecked: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown OpenAI error';

      return {
        name: this.name,
        status: 'unhealthy',
        latencyMs,
        message,
        lastChecked: new Date(),
      };
    }
  }
}

/**
 * Generic HTTP Health Checker for any URL
 */
export class HTTPHealthChecker implements HealthChecker {
  name: string;
  private url: string;
  private expectedStatus: number;
  private timeoutMs: number;

  constructor(
    name: string,
    url: string,
    expectedStatus: number = 200,
    timeoutMs: number = 5000
  ) {
    this.name = name;
    this.url = url;
    this.expectedStatus = expectedStatus;
    this.timeoutMs = timeoutMs;
  }

  async check(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(this.url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.status !== this.expectedStatus) {
        return {
          name: this.name,
          status: 'unhealthy',
          latencyMs,
          message: `Expected status ${this.expectedStatus}, got ${response.status}`,
          lastChecked: new Date(),
        };
      }

      return {
        name: this.name,
        status: 'healthy',
        latencyMs,
        message: 'Service accessible',
        lastChecked: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      return {
        name: this.name,
        status: 'unhealthy',
        latencyMs,
        message,
        lastChecked: new Date(),
      };
    }
  }
}
