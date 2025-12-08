/**
 * Spike Test
 * ==========
 *
 * Tests system behavior during sudden traffic spikes
 * Simulates flash crowd scenarios
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const apiErrors = new Counter('api_errors');
const apiSuccessRate = new Rate('api_success_rate');
const responseTime = new Trend('response_time');

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },    // Warm up
        { duration: '30s', target: 500 },  // SPIKE!
        { duration: '2m', target: 500 },   // Hold spike
        { duration: '30s', target: 50 },   // Quick recovery
        { duration: '2m', target: 50 },    // Normal load
        { duration: '30s', target: 300 },  // Second spike
        { duration: '1m', target: 300 },   // Hold
        { duration: '1m', target: 0 },     // Cool down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // Allow longer response during spikes
    http_req_failed: ['rate<0.10'],      // Allow up to 10% errors during spikes
  },
};

const BASE_URL = __ENV.API_URL || 'https://staging-api.campotech.com.ar';

const TEST_USERS = [
  { email: 'loadtest1@campotech.com', password: 'LoadTest123!' },
  { email: 'loadtest2@campotech.com', password: 'LoadTest123!' },
  { email: 'loadtest3@campotech.com', password: 'LoadTest123!' },
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

  // Focus on high-traffic endpoints during spikes
  const endpoints = [
    { path: '/api/dashboard/stats', weight: 0.25 },
    { path: '/api/jobs?status=pending&limit=10', weight: 0.30 },
    { path: '/api/customers?limit=10', weight: 0.20 },
    { path: '/api/schedule/availability', weight: 0.15 },
    { path: '/health', weight: 0.10 },
  ];

  // Select endpoint based on weight
  const rand = Math.random();
  let cumWeight = 0;
  let selectedPath = endpoints[0].path;

  for (const endpoint of endpoints) {
    cumWeight += endpoint.weight;
    if (rand < cumWeight) {
      selectedPath = endpoint.path;
      break;
    }
  }

  const res = http.get(`${BASE_URL}${selectedPath}`, { headers });

  responseTime.add(res.timings.duration);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 3s': (r) => r.timings.duration < 3000,
  });

  apiSuccessRate.add(success);
  if (!success) {
    apiErrors.add(1);
    if (res.status === 429) {
      console.log('Rate limited - backing off');
      sleep(2);
    }
  }

  // Minimal sleep during spikes
  sleep(Math.random() * 0.5);
}
