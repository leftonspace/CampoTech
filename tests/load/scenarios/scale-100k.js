/**
 * 100K Concurrent Users Load Test (Phase 9.1.1)
 * ==============================================
 *
 * Simulates CampoTech at full scale: 100,000 concurrent users
 * representing 100,000 businesses and 500,000 total users.
 *
 * This test should be run on k6 Cloud or distributed infrastructure.
 * Local machines cannot handle this load.
 *
 * Usage:
 *   k6 cloud scenarios/scale-100k.js
 *   # or distributed:
 *   k6 run --vus 100000 --duration 30m scenarios/scale-100k.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

const apiErrors = new Counter('api_errors');
const apiSuccessRate = new Rate('api_success_rate');
const concurrentUsers = new Gauge('concurrent_users');

// Per-endpoint metrics
const healthCheckTime = new Trend('health_check_time');
const dashboardTime = new Trend('dashboard_time');
const jobsListTime = new Trend('jobs_list_time');
const jobCreateTime = new Trend('job_create_time');
const customerSearchTime = new Trend('customer_search_time');
const invoiceGenerateTime = new Trend('invoice_generate_time');
const trackingUpdateTime = new Trend('tracking_update_time');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const options = {
  scenarios: {
    // Gradual ramp up to 100K concurrent users
    scale_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 1000 },     // Warm up to 1K
        { duration: '3m', target: 10000 },    // Ramp to 10K
        { duration: '5m', target: 50000 },    // Ramp to 50K
        { duration: '5m', target: 100000 },   // Ramp to 100K
        { duration: '10m', target: 100000 },  // Sustain 100K
        { duration: '5m', target: 0 },        // Ramp down
      ],
      gracefulRampDown: '60s',
    },
  },
  thresholds: {
    // Response time thresholds
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],  // 95% < 2s, 99% < 5s
    health_check_time: ['p(95)<200'],
    dashboard_time: ['p(95)<1000'],
    jobs_list_time: ['p(95)<500'],
    job_create_time: ['p(95)<1500'],
    customer_search_time: ['p(95)<300'],
    invoice_generate_time: ['p(95)<3000'],
    tracking_update_time: ['p(95)<200'],

    // Error rate thresholds
    http_req_failed: ['rate<0.05'],     // Error rate < 5% under extreme load
    api_success_rate: ['rate>0.95'],    // Success rate > 95%
    api_errors: ['count<10000'],        // Max 10K errors during entire test
  },
};

const BASE_URL = __ENV.API_URL || 'https://staging-api.campotech.com.ar';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

// Simulate different organization IDs (representing 100K businesses)
function getOrgId() {
  return `org-${randomIntBetween(1, 100000)}`;
}

// Simulate different user types
const USER_TYPES = ['owner', 'dispatcher', 'technician'];
function getUserType() {
  // Weighted: More technicians than owners
  const weights = [0.1, 0.3, 0.6]; // 10% owner, 30% dispatcher, 60% technician
  const random = Math.random();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) return USER_TYPES[i];
  }
  return 'technician';
}

// Simulate realistic job data
function generateJobData() {
  const services = [
    'Reparación de cañería',
    'Instalación de aire acondicionado',
    'Revisión de gas',
    'Instalación eléctrica',
    'Mantenimiento preventivo',
  ];

  return {
    title: randomItem(services),
    description: `Test job created during load test - VU ${__VU}`,
    customerId: `customer-${randomIntBetween(1, 1000)}`,
    scheduledDate: new Date(Date.now() + randomIntBetween(1, 7) * 24 * 60 * 60 * 1000).toISOString(),
    priority: randomItem(['low', 'medium', 'high', 'urgent']),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function setup() {
  console.log('Starting 100K scale test');
  console.log(`Target: ${BASE_URL}`);

  // Verify API is reachable
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`API not reachable: ${healthRes.status}`);
  }

  console.log('API health check passed');
  return { startTime: Date.now() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export default function (data) {
  const orgId = getOrgId();
  const userType = getUserType();

  // Simulate authentication (in production, use real tokens)
  const headers = {
    'Content-Type': 'application/json',
    'X-Organization-Id': orgId,
    'X-User-Type': userType,
    'X-Load-Test': 'true',
  };

  // Track concurrent users
  concurrentUsers.add(__VU);

  // ═════════════════════════════════════════════════════════════════════════════
  // Health Check (all users)
  // ═════════════════════════════════════════════════════════════════════════════
  group('Health Check', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/health`);
    healthCheckTime.add(Date.now() - start);

    const success = check(res, {
      'health check status is 200': (r) => r.status === 200,
    });
    apiSuccessRate.add(success);
    if (!success) apiErrors.add(1);
  });

  sleep(randomIntBetween(1, 3));

  // ═════════════════════════════════════════════════════════════════════════════
  // User-Type Specific Actions
  // ═════════════════════════════════════════════════════════════════════════════

  if (userType === 'owner' || userType === 'dispatcher') {
    // Dashboard access (owners and dispatchers)
    group('Dashboard', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/dashboard/stats`, { headers });
      dashboardTime.add(Date.now() - start);

      const success = check(res, {
        'dashboard status is 200': (r) => r.status === 200,
      });
      apiSuccessRate.add(success);
      if (!success) apiErrors.add(1);
    });

    sleep(randomIntBetween(2, 5));

    // Job listing
    group('Jobs List', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/jobs?limit=20&status=pending`, { headers });
      jobsListTime.add(Date.now() - start);

      const success = check(res, {
        'jobs list status is 200': (r) => r.status === 200,
        'jobs list response time acceptable': (r) => r.timings.duration < 1000,
      });
      apiSuccessRate.add(success);
      if (!success) apiErrors.add(1);
    });

    sleep(randomIntBetween(1, 3));
  }

  if (userType === 'dispatcher') {
    // 20% chance to create a new job
    if (Math.random() < 0.2) {
      group('Job Creation', () => {
        const start = Date.now();
        const jobData = generateJobData();
        const res = http.post(`${BASE_URL}/api/jobs`, JSON.stringify(jobData), { headers });
        jobCreateTime.add(Date.now() - start);

        const success = check(res, {
          'job creation status is 201': (r) => r.status === 201,
        });
        apiSuccessRate.add(success);
        if (!success) apiErrors.add(1);
      });

      sleep(randomIntBetween(2, 4));
    }

    // Customer search
    group('Customer Search', () => {
      const start = Date.now();
      const searchTerm = randomItem(['garcia', 'lopez', 'martinez', 'rodriguez']);
      const res = http.get(`${BASE_URL}/api/customers?search=${searchTerm}&limit=10`, { headers });
      customerSearchTime.add(Date.now() - start);

      const success = check(res, {
        'customer search status is 200': (r) => r.status === 200,
      });
      apiSuccessRate.add(success);
      if (!success) apiErrors.add(1);
    });

    sleep(randomIntBetween(1, 2));
  }

  if (userType === 'technician') {
    // Get assigned jobs
    group('My Jobs', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/jobs/assigned`, { headers });
      jobsListTime.add(Date.now() - start);

      const success = check(res, {
        'assigned jobs status is 200': (r) => r.status === 200,
      });
      apiSuccessRate.add(success);
      if (!success) apiErrors.add(1);
    });

    sleep(randomIntBetween(2, 5));

    // Location update (simulating GPS tracking)
    group('Location Update', () => {
      const start = Date.now();
      const locationData = {
        latitude: -34.6037 + (Math.random() - 0.5) * 0.1,
        longitude: -58.3816 + (Math.random() - 0.5) * 0.1,
        accuracy: randomIntBetween(5, 50),
      };
      const res = http.post(`${BASE_URL}/api/tracking/location`, JSON.stringify(locationData), { headers });
      trackingUpdateTime.add(Date.now() - start);

      const success = check(res, {
        'location update status is 200': (r) => r.status === 200,
      });
      apiSuccessRate.add(success);
      if (!success) apiErrors.add(1);
    });

    sleep(randomIntBetween(25, 35)); // Simulate 30-second GPS intervals
  }

  if (userType === 'owner') {
    // 10% chance to generate invoice
    if (Math.random() < 0.1) {
      group('Invoice Generation', () => {
        const start = Date.now();
        const invoiceData = {
          jobId: `job-${randomIntBetween(1, 10000)}`,
          generateAfip: false, // Don't hit AFIP during load test
        };
        const res = http.post(`${BASE_URL}/api/invoices`, JSON.stringify(invoiceData), { headers });
        invoiceGenerateTime.add(Date.now() - start);

        const success = check(res, {
          'invoice status is 201 or 202': (r) => r.status === 201 || r.status === 202,
        });
        apiSuccessRate.add(success);
        if (!success) apiErrors.add(1);
      });

      sleep(randomIntBetween(3, 6));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEARDOWN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`100K scale test completed in ${duration.toFixed(2)} minutes`);
}
