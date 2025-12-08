/**
 * API Baseline Load Test
 * ======================
 *
 * Tests standard API performance under normal load
 * Target: 100 concurrent users
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const apiErrors = new Counter('api_errors');
const apiSuccessRate = new Rate('api_success_rate');
const jobCreationTime = new Trend('job_creation_time');
const customerLookupTime = new Trend('customer_lookup_time');

// Test configuration
export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 100 },  // Ramp up to 100 users
        { duration: '10m', target: 100 }, // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'],                   // Error rate < 1%
    api_success_rate: ['rate>0.99'],                  // Success rate > 99%
  },
};

const BASE_URL = __ENV.API_URL || 'https://staging-api.campotech.com.ar';

// Test users (pre-created for load testing)
const TEST_USERS = [
  { email: 'loadtest1@campotech.com', password: 'LoadTest123!' },
  { email: 'loadtest2@campotech.com', password: 'LoadTest123!' },
  { email: 'loadtest3@campotech.com', password: 'LoadTest123!' },
];

export function setup() {
  // Login all test users and get tokens
  const tokens = TEST_USERS.map((user) => {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(user), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (loginRes.status !== 200) {
      console.error(`Failed to login ${user.email}: ${loginRes.status}`);
      return null;
    }

    const body = JSON.parse(loginRes.body);
    return body.accessToken;
  }).filter(Boolean);

  return { tokens };
}

export default function (data) {
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Group: Health Check
  // ═══════════════════════════════════════════════════════════════════════════
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
    });
  });

  sleep(0.5);

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Group: Dashboard
  // ═══════════════════════════════════════════════════════════════════════════
  group('Dashboard', () => {
    const responses = http.batch([
      ['GET', `${BASE_URL}/api/dashboard/stats`, null, { headers }],
      ['GET', `${BASE_URL}/api/dashboard/recent-jobs`, null, { headers }],
      ['GET', `${BASE_URL}/api/dashboard/upcoming`, null, { headers }],
    ]);

    responses.forEach((res, i) => {
      const success = check(res, {
        [`dashboard endpoint ${i} is successful`]: (r) => r.status === 200,
      });
      if (!success) apiErrors.add(1);
      apiSuccessRate.add(success);
    });
  });

  sleep(1);

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Group: Job Operations
  // ═══════════════════════════════════════════════════════════════════════════
  group('Job Operations', () => {
    // List jobs
    const listRes = http.get(`${BASE_URL}/api/jobs?status=pending&limit=20`, { headers });
    check(listRes, {
      'job list is successful': (r) => r.status === 200,
      'job list response time < 300ms': (r) => r.timings.duration < 300,
    });

    // Get single job (if any exist)
    if (listRes.status === 200) {
      const jobs = JSON.parse(listRes.body).data;
      if (jobs && jobs.length > 0) {
        const jobId = jobs[0].id;
        const detailRes = http.get(`${BASE_URL}/api/jobs/${jobId}`, { headers });
        check(detailRes, {
          'job detail is successful': (r) => r.status === 200,
        });
      }
    }
  });

  sleep(1);

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Group: Customer Operations
  // ═══════════════════════════════════════════════════════════════════════════
  group('Customer Operations', () => {
    const startTime = Date.now();

    // Search customers
    const searchRes = http.get(`${BASE_URL}/api/customers?search=test&limit=10`, { headers });
    const lookupTime = Date.now() - startTime;
    customerLookupTime.add(lookupTime);

    const success = check(searchRes, {
      'customer search is successful': (r) => r.status === 200,
      'customer search response time < 200ms': (r) => r.timings.duration < 200,
    });
    if (!success) apiErrors.add(1);
    apiSuccessRate.add(success);
  });

  sleep(1);

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Group: Schedule Operations
  // ═══════════════════════════════════════════════════════════════════════════
  group('Schedule Operations', () => {
    const today = new Date().toISOString().split('T')[0];

    // Get technician availability
    const availRes = http.get(`${BASE_URL}/api/schedule/availability?date=${today}`, { headers });
    check(availRes, {
      'availability check is successful': (r) => r.status === 200,
    });

    // Get schedule for today
    const scheduleRes = http.get(`${BASE_URL}/api/schedule?date=${today}`, { headers });
    check(scheduleRes, {
      'schedule is successful': (r) => r.status === 200,
    });
  });

  sleep(0.5);
}

export function teardown(data) {
  console.log('Load test completed');
  console.log(`Total tokens used: ${data.tokens.length}`);
}
