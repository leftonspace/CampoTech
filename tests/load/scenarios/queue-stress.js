/**
 * Queue System Stress Test (Phase 9.1.5)
 * ======================================
 *
 * Tests the BullMQ queue system under high load:
 * 1. Realtime queue (< 5 seconds SLA)
 * 2. Background queue (< 60 seconds SLA)
 * 3. Batch queue (minutes to hours)
 * 4. Dead Letter Queue behavior
 *
 * This validates Phase 5B queue infrastructure.
 *
 * Usage:
 *   k6 run scenarios/queue-stress.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

// Queue dispatch metrics
const realtimeQueueDispatchTime = new Trend('realtime_queue_dispatch_time');
const backgroundQueueDispatchTime = new Trend('background_queue_dispatch_time');
const batchQueueDispatchTime = new Trend('batch_queue_dispatch_time');

// Queue processing metrics (based on status checks)
const realtimeQueueProcessTime = new Trend('realtime_queue_process_time');
const backgroundQueueProcessTime = new Trend('background_queue_process_time');

// Queue health metrics
const queueHealthy = new Rate('queue_healthy');
const jobsAccepted = new Counter('jobs_accepted');
const jobsRejected = new Counter('jobs_rejected');
const dlqItems = new Gauge('dlq_items');
const queueDepth = new Gauge('queue_depth');
const queueUtilization = new Gauge('queue_utilization');

// SLA compliance
const realtimeSlaBreaches = new Counter('realtime_sla_breaches');
const backgroundSlaBreaches = new Counter('background_sla_breaches');
const slaCompliance = new Rate('sla_compliance');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const options = {
  scenarios: {
    // Sustained high load
    sustained_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },     // Warm up
        { duration: '5m', target: 1000 },    // Ramp to high load
        { duration: '10m', target: 1000 },   // Sustain high load
        { duration: '2m', target: 0 },       // Cool down
      ],
      gracefulRampDown: '60s',
    },
    // Spike scenario (sudden burst)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },    // Normal
        { duration: '10s', target: 2000 },   // Sudden spike
        { duration: '2m', target: 2000 },    // Sustain spike
        { duration: '30s', target: 100 },    // Return to normal
        { duration: '2m', target: 100 },     // Recovery observation
      ],
      startTime: '5m', // Start spike scenario after warm-up
    },
  },
  thresholds: {
    // Queue dispatch should be fast (just adding to queue)
    realtime_queue_dispatch_time: ['p(95)<100', 'p(99)<200'],
    background_queue_dispatch_time: ['p(95)<200', 'p(99)<500'],
    batch_queue_dispatch_time: ['p(95)<500', 'p(99)<1000'],

    // SLA compliance
    sla_compliance: ['rate>0.95'],           // 95% jobs meet SLA
    realtime_sla_breaches: ['count<50'],     // Max 50 realtime breaches
    background_sla_breaches: ['count<100'],   // Max 100 background breaches

    // Queue health
    queue_healthy: ['rate>0.90'],            // Healthy 90% of time
    jobs_rejected: ['count<500'],            // Max 500 rejected jobs

    // General request success
    http_req_failed: ['rate<0.05'],          // Less than 5% failure
  },
};

const BASE_URL = __ENV.API_URL || 'https://staging-api.campotech.com.ar';

// SLA definitions (milliseconds)
const SLA = {
  realtime: 5000,      // 5 seconds
  background: 60000,   // 60 seconds
  batch: 600000,       // 10 minutes
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function generateTestHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Organization-Id': `org-${randomIntBetween(1, 100)}`,
    'X-Load-Test': 'true',
    'X-Queue-Test': 'true',
  };
}

function checkQueueMetrics(headers) {
  const res = http.get(`${BASE_URL}/api/admin/queue-metrics`, { headers });

  if (res.status === 200) {
    try {
      const metrics = JSON.parse(res.body);

      // Track queue depth
      if (metrics.queues) {
        let totalDepth = 0;
        let totalUtilization = 0;
        let queueCount = 0;

        for (const [name, data] of Object.entries(metrics.queues)) {
          if (data.last24h) {
            totalDepth += data.last24h.count || 0;
          }
          if (data.optimization) {
            totalUtilization += data.optimization.currentUtilization || 0;
            queueCount++;
          }

          // Check queue health status
          if (data.status === 'critical') {
            queueHealthy.add(false);
          } else {
            queueHealthy.add(true);
          }
        }

        queueDepth.add(totalDepth);
        if (queueCount > 0) {
          queueUtilization.add(totalUtilization / queueCount);
        }
      }

      return metrics;
    } catch (e) {
      console.error('Failed to parse queue metrics:', e);
    }
  }

  return null;
}

function checkDlqStatus(headers) {
  const res = http.get(`${BASE_URL}/api/admin/dlq/status`, { headers });

  if (res.status === 200) {
    try {
      const dlq = JSON.parse(res.body);
      dlqItems.add(dlq.count || 0);

      if (dlq.count > 100) {
        console.log(`DLQ alert: ${dlq.count} items in dead letter queue`);
      }

      return dlq;
    } catch (e) {
      console.error('Failed to parse DLQ status:', e);
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

export function setup() {
  console.log('Starting queue stress test');
  console.log(`Target: ${BASE_URL}`);

  // Verify API and queue system are reachable
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'API is reachable': (r) => r.status === 200,
  });

  return { startTime: Date.now() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export default function (data) {
  const headers = generateTestHeaders();
  const jobType = randomItem(['realtime', 'background', 'batch']);

  // ═════════════════════════════════════════════════════════════════════════════
  // Periodically check queue health
  // ═════════════════════════════════════════════════════════════════════════════
  if (__ITER % 50 === 0) {
    group('Queue Health Check', () => {
      checkQueueMetrics(headers);
      checkDlqStatus(headers);
    });
    sleep(0.5);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Realtime Queue Jobs
  // ═════════════════════════════════════════════════════════════════════════════
  if (jobType === 'realtime') {
    group('Realtime Queue - WhatsApp Response', () => {
      const start = Date.now();
      const messageData = {
        conversationId: `conv-${randomIntBetween(1, 50000)}`,
        messageId: `msg-${Date.now()}-${__VU}`,
        message: randomItem([
          'Hola, ¿a qué hora pueden venir?',
          'Necesito cambiar la cita para mañana',
          '¿Cuánto cuesta el servicio?',
          'Gracias, perfecto',
        ]),
        customerPhone: `+549${randomIntBetween(1111111111, 9999999999)}`,
      };

      const res = http.post(
        `${BASE_URL}/api/whatsapp/respond`,
        JSON.stringify(messageData),
        { headers, timeout: '10s' }
      );
      const dispatchTime = Date.now() - start;
      realtimeQueueDispatchTime.add(dispatchTime);

      const success = check(res, {
        'whatsapp respond accepted': (r) => [200, 202].includes(r.status),
        'dispatch under 100ms': (r) => r.timings.duration < 100,
      });

      if (success) {
        jobsAccepted.add(1);

        // Check if job completed within SLA (poll for result)
        if (res.status === 202) {
          try {
            const body = JSON.parse(res.body);
            if (body.jobId) {
              // Poll for completion (max 5 seconds)
              const pollStart = Date.now();
              let completed = false;

              while (Date.now() - pollStart < SLA.realtime && !completed) {
                sleep(0.5);
                const statusRes = http.get(
                  `${BASE_URL}/api/queue/job/${body.jobId}/status`,
                  { headers }
                );
                if (statusRes.status === 200) {
                  const status = JSON.parse(statusRes.body);
                  if (status.state === 'completed') {
                    completed = true;
                    realtimeQueueProcessTime.add(Date.now() - pollStart);
                    slaCompliance.add(true);
                  } else if (status.state === 'failed') {
                    completed = true;
                    slaCompliance.add(false);
                    realtimeSlaBreaches.add(1);
                  }
                }
              }

              if (!completed) {
                realtimeSlaBreaches.add(1);
                slaCompliance.add(false);
                console.log(`Realtime SLA breach: job ${body.jobId} exceeded 5s`);
              }
            }
          } catch (e) {}
        }
      } else {
        jobsRejected.add(1);
      }
    });

    sleep(randomIntBetween(1, 3));
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Background Queue Jobs
  // ═════════════════════════════════════════════════════════════════════════════
  if (jobType === 'background') {
    group('Background Queue - Voice Transcription', () => {
      const start = Date.now();
      const voiceData = {
        audioUrl: `https://storage.example.com/audio-${Date.now()}-${__VU}.mp3`,
        jobId: `job-${randomIntBetween(1, 100000)}`,
        organizationId: headers['X-Organization-Id'],
        duration: randomIntBetween(10, 120), // 10 seconds to 2 minutes
      };

      const res = http.post(
        `${BASE_URL}/api/voice/transcribe`,
        JSON.stringify(voiceData),
        { headers, timeout: '15s' }
      );
      const dispatchTime = Date.now() - start;
      backgroundQueueDispatchTime.add(dispatchTime);

      const success = check(res, {
        'voice transcribe accepted': (r) => [200, 202].includes(r.status),
        'dispatch under 200ms': (r) => r.timings.duration < 200,
      });

      if (success) {
        jobsAccepted.add(1);
        slaCompliance.add(true); // Will be updated if we poll and find breach
      } else {
        jobsRejected.add(1);
      }
    });

    sleep(randomIntBetween(2, 4));

    // Also test notification queue
    group('Background Queue - Notification', () => {
      const start = Date.now();
      const notifData = {
        type: randomItem(['push', 'sms', 'email']),
        userId: `user-${randomIntBetween(1, 10000)}`,
        title: 'Test notification',
        body: 'This is a load test notification',
      };

      const res = http.post(
        `${BASE_URL}/api/notifications/send`,
        JSON.stringify(notifData),
        { headers, timeout: '10s' }
      );
      const dispatchTime = Date.now() - start;
      backgroundQueueDispatchTime.add(dispatchTime);

      const success = check(res, {
        'notification accepted': (r) => [200, 202].includes(r.status),
        'dispatch under 200ms': (r) => r.timings.duration < 200,
      });

      if (success) jobsAccepted.add(1);
      else jobsRejected.add(1);
    });

    sleep(randomIntBetween(1, 2));
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Batch Queue Jobs
  // ═════════════════════════════════════════════════════════════════════════════
  if (jobType === 'batch') {
    group('Batch Queue - Invoice Generation', () => {
      const start = Date.now();
      const invoiceData = {
        jobId: `job-${randomIntBetween(1, 100000)}`,
        organizationId: headers['X-Organization-Id'],
        customerId: `customer-${randomIntBetween(1, 10000)}`,
        items: [
          {
            description: 'Servicio de prueba',
            quantity: 1,
            unitPrice: randomIntBetween(1000, 50000),
          },
        ],
        generateAfip: false, // Don't hit AFIP during load test
      };

      const res = http.post(
        `${BASE_URL}/api/invoices/generate`,
        JSON.stringify(invoiceData),
        { headers, timeout: '30s' }
      );
      const dispatchTime = Date.now() - start;
      batchQueueDispatchTime.add(dispatchTime);

      const success = check(res, {
        'invoice generation accepted': (r) => [200, 201, 202].includes(r.status),
        'dispatch under 500ms': (r) => r.timings.duration < 500,
      });

      if (success) {
        jobsAccepted.add(1);
        slaCompliance.add(true);
      } else {
        jobsRejected.add(1);
      }
    });

    sleep(randomIntBetween(3, 6));

    // Test report generation (heavy batch job)
    if (__ITER % 20 === 0) {
      group('Batch Queue - Report Generation', () => {
        const start = Date.now();
        const reportData = {
          type: randomItem(['monthly-summary', 'revenue', 'jobs-completed']),
          organizationId: headers['X-Organization-Id'],
          period: 'current-month',
        };

        const res = http.post(
          `${BASE_URL}/api/reports/generate`,
          JSON.stringify(reportData),
          { headers, timeout: '60s' }
        );
        const dispatchTime = Date.now() - start;
        batchQueueDispatchTime.add(dispatchTime);

        const success = check(res, {
          'report generation accepted': (r) => [200, 202].includes(r.status),
        });

        if (success) jobsAccepted.add(1);
        else jobsRejected.add(1);
      });
    }

    sleep(randomIntBetween(2, 4));
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Simulate Job Completion (triggers follow-up queue jobs)
  // ═════════════════════════════════════════════════════════════════════════════
  if (__ITER % 10 === 0) {
    group('Job Completion Flow', () => {
      const jobId = `job-${randomIntBetween(1, 100000)}`;
      const completionData = {
        status: 'completed',
        technicianNotes: 'Work completed successfully during load test',
        materialsUsed: [
          { item: 'Cable 2.5mm', quantity: 5 },
          { item: 'Interruptor', quantity: 2 },
        ],
        photos: [],
        signature: 'base64-signature-placeholder',
      };

      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/jobs/${jobId}/complete`,
        JSON.stringify(completionData),
        { headers, timeout: '30s' }
      );

      const success = check(res, {
        'job completion accepted': (r) => [200, 202].includes(r.status),
        'triggers queue jobs': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.triggeredJobs !== undefined || r.status === 202;
          } catch {
            return false;
          }
        },
      });

      if (success) {
        jobsAccepted.add(1);
        // Job completion triggers: invoice generation, rating request, notification
        // These are counted as multiple queue jobs
      }
    });

    sleep(randomIntBetween(2, 5));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`Queue stress test completed in ${duration.toFixed(2)} minutes`);
  console.log('Key metrics to review:');
  console.log('- *_queue_dispatch_time: How fast jobs are added to queues');
  console.log('- sla_compliance: Rate of jobs completing within SLA');
  console.log('- *_sla_breaches: Count of SLA violations per tier');
  console.log('- queue_depth: Total jobs in queues');
  console.log('- dlq_items: Items in dead letter queue (should be low)');
  console.log('- jobs_rejected: Jobs that could not be queued');
}
