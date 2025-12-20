/**
 * External API Degradation Tests (Phase 9.1.3)
 * ============================================
 *
 * Tests system behavior when external APIs (AFIP, OpenAI, MercadoPago)
 * are degraded, slow, or unavailable.
 *
 * This test validates:
 * 1. Circuit breakers open correctly
 * 2. System degrades gracefully
 * 3. Fallback mechanisms work
 * 4. Users receive appropriate messaging
 *
 * Usage:
 *   k6 run scenarios/api-degradation.js
 *   k6 run --env SCENARIO=afip scenarios/api-degradation.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

const gracefulDegradations = new Counter('graceful_degradations');
const fallbackActivations = new Counter('fallback_activations');
const circuitBreakerOpens = new Counter('circuit_breaker_opens');
const userErrorsShown = new Counter('user_errors_shown');
const queuedOperations = new Counter('queued_operations');
const systemHealthy = new Rate('system_healthy');
const degradedResponses = new Rate('degraded_responses');

// Endpoint-specific metrics
const afipResponseTime = new Trend('afip_response_time');
const aiResponseTime = new Trend('ai_response_time');
const paymentResponseTime = new Trend('payment_response_time');
const healthEndpointTime = new Trend('health_endpoint_time');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const options = {
  scenarios: {
    // Normal baseline load
    normal_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15m',
    },
    // Simulate AFIP degradation starting at 2 minutes
    afip_degradation: {
      executor: 'constant-vus',
      vus: 50,
      duration: '8m',
      startTime: '2m',
      env: { DEGRADATION_TARGET: 'afip' },
    },
    // Simulate OpenAI budget exceeded at 5 minutes
    ai_limited: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      startTime: '5m',
      env: { DEGRADATION_TARGET: 'openai' },
    },
    // Simulate MercadoPago issues at 8 minutes
    payment_degradation: {
      executor: 'constant-vus',
      vus: 30,
      duration: '4m',
      startTime: '8m',
      env: { DEGRADATION_TARGET: 'mercadopago' },
    },
  },
  thresholds: {
    // System MUST degrade gracefully, not crash
    http_req_failed: ['rate<0.1'],          // Max 10% total failures
    system_healthy: ['rate>0.5'],           // System should be healthy > 50% of time
    graceful_degradations: ['count>0'],     // We expect graceful degradations

    // Response times can be slower during degradation, but must complete
    http_req_duration: ['p(95)<10000'],     // 95% < 10s even during degradation
    health_endpoint_time: ['p(95)<1000'],   // Health endpoint always responsive

    // Fallbacks should activate
    fallback_activations: ['count>0'],
  },
};

const BASE_URL = __ENV.API_URL || 'https://staging-api.campotech.com.ar';
const DEGRADATION_TARGET = __ENV.DEGRADATION_TARGET || 'none';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function checkSystemHealth() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/health`);
  healthEndpointTime.add(Date.now() - start);

  if (res.status === 200) {
    const health = JSON.parse(res.body);

    // Track overall health
    systemHealthy.add(health.status === 'healthy');

    // Track if any features are degraded
    if (health.features) {
      const degradedCount = Object.values(health.features)
        .filter(f => f.status !== 'healthy').length;

      if (degradedCount > 0) {
        gracefulDegradations.add(degradedCount);
        degradedResponses.add(true);
      } else {
        degradedResponses.add(false);
      }
    }

    return health;
  }

  return null;
}

function generateTestHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Organization-Id': `org-${randomIntBetween(1, 1000)}`,
    'X-Load-Test': 'true',
    'X-Degradation-Test': DEGRADATION_TARGET,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

export function setup() {
  console.log('Starting API degradation test');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Degradation target: ${DEGRADATION_TARGET}`);

  // Verify baseline health
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'initial health check passed': (r) => r.status === 200,
  });

  return { startTime: Date.now() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export default function (data) {
  const headers = generateTestHeaders();

  // ═════════════════════════════════════════════════════════════════════════════
  // Always check system health first
  // ═════════════════════════════════════════════════════════════════════════════
  group('System Health', () => {
    const health = checkSystemHealth();

    check(health, {
      'health endpoint responds': (h) => h !== null,
      'health contains status': (h) => h && h.status !== undefined,
    });
  });

  sleep(1);

  // ═════════════════════════════════════════════════════════════════════════════
  // Test AFIP-related operations
  // ═════════════════════════════════════════════════════════════════════════════
  if (DEGRADATION_TARGET === 'afip' || DEGRADATION_TARGET === 'none') {
    group('AFIP Operations', () => {
      // Try to generate an invoice (triggers AFIP)
      const start = Date.now();
      const invoiceData = {
        jobId: `job-${randomIntBetween(1, 10000)}`,
        customerId: `customer-${randomIntBetween(1, 1000)}`,
        items: [
          { description: 'Servicio de prueba', quantity: 1, unitPrice: 1000 },
        ],
      };

      const res = http.post(`${BASE_URL}/api/invoices`, JSON.stringify(invoiceData), { headers });
      afipResponseTime.add(Date.now() - start);

      // Check for graceful handling
      const success = check(res, {
        'invoice request accepted': (r) => [200, 201, 202, 503].includes(r.status),
        'response contains status info': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.status !== undefined || body.queued !== undefined || body.error !== undefined;
          } catch {
            return false;
          }
        },
      });

      // Track specific degradation behaviors
      if (res.status === 202) {
        queuedOperations.add(1);
        console.log('Invoice queued due to AFIP degradation');
      }

      if (res.status === 503) {
        fallbackActivations.add(1);
        console.log('AFIP service unavailable - fallback activated');
      }
    });

    sleep(2);

    // Check AFIP status endpoint
    group('AFIP Status', () => {
      const res = http.get(`${BASE_URL}/api/admin/afip-status`, { headers });

      check(res, {
        'afip status endpoint responds': (r) => r.status === 200,
        'circuit breaker status reported': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.circuitBreaker !== undefined;
          } catch {
            return false;
          }
        },
      });

      // Track circuit breaker state
      if (res.status === 200) {
        try {
          const status = JSON.parse(res.body);
          if (status.circuitBreaker && status.circuitBreaker.opened) {
            circuitBreakerOpens.add(1);
          }
        } catch {}
      }
    });

    sleep(1);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Test OpenAI/AI-related operations
  // ═════════════════════════════════════════════════════════════════════════════
  if (DEGRADATION_TARGET === 'openai' || DEGRADATION_TARGET === 'none') {
    group('AI Operations', () => {
      // Simulate WhatsApp AI conversation
      const start = Date.now();
      const messageData = {
        conversationId: `conv-${randomIntBetween(1, 10000)}`,
        message: 'Hola, necesito programar una visita para revisar el aire acondicionado',
        customerPhone: `+549${randomIntBetween(1111111111, 9999999999)}`,
      };

      const res = http.post(`${BASE_URL}/api/whatsapp/process`, JSON.stringify(messageData), { headers });
      aiResponseTime.add(Date.now() - start);

      const success = check(res, {
        'whatsapp process accepted': (r) => [200, 202, 503].includes(r.status),
        'response indicates handling': (r) => {
          try {
            const body = JSON.parse(r.body);
            // Either AI responded or escalated to human
            return body.response !== undefined || body.escalated === true || body.error !== undefined;
          } catch {
            return false;
          }
        },
      });

      // Check if escalated to human (fallback behavior)
      if (res.status === 200) {
        try {
          const response = JSON.parse(res.body);
          if (response.escalated === true || response.aiHandled === false) {
            fallbackActivations.add(1);
            console.log('AI unavailable - escalated to human');
          }
        } catch {}
      }
    });

    sleep(2);

    // Test voice transcription (Whisper)
    group('Voice Transcription', () => {
      const start = Date.now();
      const voiceData = {
        audioUrl: 'https://example.com/test-audio.mp3',
        jobId: `job-${randomIntBetween(1, 1000)}`,
      };

      const res = http.post(`${BASE_URL}/api/voice/transcribe`, JSON.stringify(voiceData), { headers });
      aiResponseTime.add(Date.now() - start);

      check(res, {
        'voice transcription handled': (r) => [200, 202, 503].includes(r.status),
        'fallback message if degraded': (r) => {
          if (r.status === 503) {
            try {
              const body = JSON.parse(r.body);
              return body.message !== undefined;
            } catch {
              return false;
            }
          }
          return true;
        },
      });
    });

    sleep(1);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Test MercadoPago/Payment operations
  // ═════════════════════════════════════════════════════════════════════════════
  if (DEGRADATION_TARGET === 'mercadopago' || DEGRADATION_TARGET === 'none') {
    group('Payment Operations', () => {
      const start = Date.now();
      const paymentData = {
        invoiceId: `inv-${randomIntBetween(1, 10000)}`,
        amount: randomIntBetween(1000, 50000),
        description: 'Test payment during degradation test',
      };

      const res = http.post(`${BASE_URL}/api/payments/create-preference`, JSON.stringify(paymentData), { headers });
      paymentResponseTime.add(Date.now() - start);

      const success = check(res, {
        'payment request handled': (r) => [200, 201, 503].includes(r.status),
        'provides fallback if degraded': (r) => {
          if (r.status === 503 || r.status === 200) {
            try {
              const body = JSON.parse(r.body);
              // Either payment link or manual instructions
              return body.preferenceId !== undefined || body.manualPaymentInstructions !== undefined;
            } catch {
              return false;
            }
          }
          return true;
        },
      });

      // Track manual payment fallback
      if (res.status === 200) {
        try {
          const response = JSON.parse(res.body);
          if (response.fallback === true || response.manualPaymentInstructions) {
            fallbackActivations.add(1);
            console.log('Payment system degraded - manual instructions provided');
          }
        } catch {}
      }
    });

    sleep(2);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Test core operations continue working during degradation
  // ═════════════════════════════════════════════════════════════════════════════
  group('Core Operations During Degradation', () => {
    // Job listing should always work
    const jobsRes = http.get(`${BASE_URL}/api/jobs?limit=10`, { headers });
    check(jobsRes, {
      'job listing works during degradation': (r) => r.status === 200,
      'job listing response time acceptable': (r) => r.timings.duration < 2000,
    });

    // Customer search should always work
    const customersRes = http.get(`${BASE_URL}/api/customers?search=test&limit=5`, { headers });
    check(customersRes, {
      'customer search works during degradation': (r) => r.status === 200,
    });

    // Dashboard should always work (may show degradation warnings)
    const dashboardRes = http.get(`${BASE_URL}/api/dashboard/stats`, { headers });
    check(dashboardRes, {
      'dashboard works during degradation': (r) => r.status === 200,
    });
  });

  sleep(randomIntBetween(1, 3));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`API degradation test completed in ${duration.toFixed(2)} minutes`);
  console.log('Check metrics for graceful_degradations and fallback_activations');
}
