/**
 * Stress Test
 * ===========
 *
 * Tests system behavior under extreme load
 * Target: Find breaking point (up to 500 concurrent users)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const apiErrors = new Counter('api_errors');
const apiSuccessRate = new Rate('api_success_rate');
const responseTime = new Trend('response_time');

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // Normal load
        { duration: '5m', target: 200 },   // Peak load
        { duration: '5m', target: 300 },   // High stress
        { duration: '5m', target: 400 },   // Extreme stress
        { duration: '5m', target: 500 },   // Breaking point test
        { duration: '3m', target: 0 },     // Recovery
      ],
      gracefulRampDown: '1m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% < 2s under stress
    http_req_failed: ['rate<0.05'],      // Allow up to 5% errors under stress
  },
};

const BASE_URL = __ENV.API_URL || 'https://staging-api.campotech.com.ar';

const TEST_USERS = [
  { email: 'loadtest1@campotech.com', password: 'LoadTest123!' },
  { email: 'loadtest2@campotech.com', password: 'LoadTest123!' },
  { email: 'loadtest3@campotech.com', password: 'LoadTest123!' },
  { email: 'loadtest4@campotech.com', password: 'LoadTest123!' },
  { email: 'loadtest5@campotech.com', password: 'LoadTest123!' },
];

export function setup() {
  const tokens = TEST_USERS.map((user) => {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(user), {
      headers: { 'Content-Type': 'application/json' },
    });
    if (loginRes.status === 200) {
      return JSON.parse(loginRes.body).accessToken;
    }
    return null;
  }).filter(Boolean);

  return { tokens };
}

export default function (data) {
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Randomly select operation to simulate real traffic patterns
  const operation = Math.random();

  if (operation < 0.3) {
    // 30% - List operations (read-heavy)
    group('Read Operations', () => {
      const endpoints = [
        '/api/jobs?status=pending&limit=20',
        '/api/customers?limit=20',
        '/api/dashboard/stats',
        '/api/schedule/availability',
      ];
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

      const res = http.get(`${BASE_URL}${endpoint}`, { headers });
      const success = res.status === 200;

      responseTime.add(res.timings.duration);
      apiSuccessRate.add(success);
      if (!success) apiErrors.add(1);
    });
  } else if (operation < 0.5) {
    // 20% - Search operations
    group('Search Operations', () => {
      const queries = ['maria', 'split', 'calefactor', 'urgente', 'palermo'];
      const query = queries[Math.floor(Math.random() * queries.length)];

      const res = http.get(`${BASE_URL}/api/customers?search=${query}`, { headers });
      const success = res.status === 200;

      responseTime.add(res.timings.duration);
      apiSuccessRate.add(success);
      if (!success) apiErrors.add(1);
    });
  } else if (operation < 0.7) {
    // 20% - Detail views
    group('Detail Views', () => {
      const listRes = http.get(`${BASE_URL}/api/jobs?limit=5`, { headers });
      if (listRes.status === 200) {
        const jobs = JSON.parse(listRes.body).data;
        if (jobs && jobs.length > 0) {
          const jobId = jobs[Math.floor(Math.random() * jobs.length)].id;
          const res = http.get(`${BASE_URL}/api/jobs/${jobId}`, { headers });
          responseTime.add(res.timings.duration);
          apiSuccessRate.add(res.status === 200);
        }
      }
    });
  } else if (operation < 0.85) {
    // 15% - Dashboard
    group('Dashboard Load', () => {
      const responses = http.batch([
        ['GET', `${BASE_URL}/api/dashboard/stats`, null, { headers }],
        ['GET', `${BASE_URL}/api/dashboard/recent-jobs`, null, { headers }],
        ['GET', `${BASE_URL}/api/dashboard/upcoming`, null, { headers }],
        ['GET', `${BASE_URL}/api/notifications/unread`, null, { headers }],
      ]);

      let allSuccess = true;
      responses.forEach((res) => {
        responseTime.add(res.timings.duration);
        if (res.status !== 200) {
          allSuccess = false;
          apiErrors.add(1);
        }
      });
      apiSuccessRate.add(allSuccess);
    });
  } else {
    // 15% - Write operations (simulated)
    group('Write Operations', () => {
      // Update job status (idempotent operation safe for stress testing)
      const listRes = http.get(`${BASE_URL}/api/jobs?status=pending&limit=1`, { headers });
      if (listRes.status === 200) {
        const jobs = JSON.parse(listRes.body).data;
        if (jobs && jobs.length > 0) {
          const jobId = jobs[0].id;
          const res = http.patch(
            `${BASE_URL}/api/jobs/${jobId}`,
            JSON.stringify({ notes: `Stress test update ${Date.now()}` }),
            { headers }
          );
          responseTime.add(res.timings.duration);
          apiSuccessRate.add(res.status === 200);
        }
      }
    });
  }

  // Variable sleep to simulate realistic user behavior
  sleep(Math.random() * 2 + 0.5);
}

export function handleSummary(data) {
  return {
    'stress-test-results.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  let output = '\n' + indent + '=== STRESS TEST RESULTS ===\n\n';

  output += indent + `Total Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  output += indent + `Failed Requests: ${data.metrics.http_req_failed?.values?.passes || 0}\n`;
  output += indent + `Success Rate: ${((data.metrics.api_success_rate?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  output += '\n';
  output += indent + 'Response Times:\n';
  output += indent + `  p50: ${(data.metrics.http_req_duration?.values?.['p(50)'] || 0).toFixed(2)}ms\n`;
  output += indent + `  p95: ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  output += indent + `  p99: ${(data.metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms\n`;

  return output;
}
