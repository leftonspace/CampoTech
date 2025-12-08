/**
 * Soak Test (Endurance Test)
 * ==========================
 *
 * Tests system stability over extended period
 * Duration: 2 hours
 * Target: Detect memory leaks, connection pool exhaustion, etc.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const apiErrors = new Counter('api_errors');
const apiSuccessRate = new Rate('api_success_rate');
const responseTime = new Trend('response_time');
const memoryLeakIndicator = new Trend('memory_leak_indicator');

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: 100,
      duration: '2h',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    api_success_rate: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.API_URL || 'https://staging-api.campotech.com.ar';

const TEST_USERS = [
  { email: 'loadtest1@campotech.com', password: 'LoadTest123!' },
  { email: 'loadtest2@campotech.com', password: 'LoadTest123!' },
  { email: 'loadtest3@campotech.com', password: 'LoadTest123!' },
];

let iterationCount = 0;
const START_TIME = Date.now();

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

  // Initial health baseline
  const healthRes = http.get(`${BASE_URL}/health`);
  const initialHealth = healthRes.status === 200 ? JSON.parse(healthRes.body) : null;

  return { tokens, initialHealth };
}

export default function (data) {
  iterationCount++;
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Realistic user workflow
  const workflows = [
    dashboardWorkflow,
    jobManagementWorkflow,
    customerSearchWorkflow,
    scheduleWorkflow,
  ];

  const workflow = workflows[Math.floor(Math.random() * workflows.length)];
  workflow(headers);

  // Periodic memory/health check (every 100 iterations)
  if (iterationCount % 100 === 0) {
    checkSystemHealth();
  }

  // Realistic user think time
  sleep(Math.random() * 3 + 1);
}

function dashboardWorkflow(headers) {
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/dashboard/stats`, null, { headers }],
    ['GET', `${BASE_URL}/api/dashboard/recent-jobs`, null, { headers }],
  ]);

  responses.forEach((res) => {
    responseTime.add(res.timings.duration);
    apiSuccessRate.add(res.status === 200);
    if (res.status !== 200) apiErrors.add(1);
  });
}

function jobManagementWorkflow(headers) {
  // List jobs
  const listRes = http.get(`${BASE_URL}/api/jobs?limit=20`, { headers });
  responseTime.add(listRes.timings.duration);
  apiSuccessRate.add(listRes.status === 200);

  if (listRes.status === 200) {
    const jobs = JSON.parse(listRes.body).data || [];
    if (jobs.length > 0) {
      // View random job
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      const detailRes = http.get(`${BASE_URL}/api/jobs/${job.id}`, { headers });
      responseTime.add(detailRes.timings.duration);
      apiSuccessRate.add(detailRes.status === 200);
    }
  }

  sleep(0.5);
}

function customerSearchWorkflow(headers) {
  const searches = ['maria', 'juan', 'palermo', 'belgrano', 'split'];
  const search = searches[Math.floor(Math.random() * searches.length)];

  const res = http.get(`${BASE_URL}/api/customers?search=${search}&limit=10`, { headers });
  responseTime.add(res.timings.duration);
  apiSuccessRate.add(res.status === 200);
  if (res.status !== 200) apiErrors.add(1);
}

function scheduleWorkflow(headers) {
  const today = new Date().toISOString().split('T')[0];

  const responses = http.batch([
    ['GET', `${BASE_URL}/api/schedule?date=${today}`, null, { headers }],
    ['GET', `${BASE_URL}/api/schedule/availability?date=${today}`, null, { headers }],
  ]);

  responses.forEach((res) => {
    responseTime.add(res.timings.duration);
    apiSuccessRate.add(res.status === 200);
    if (res.status !== 200) apiErrors.add(1);
  });
}

function checkSystemHealth() {
  const healthRes = http.get(`${BASE_URL}/health`);

  if (healthRes.status === 200) {
    const health = JSON.parse(healthRes.body);

    // Track response time degradation as potential memory leak indicator
    const elapsedMinutes = (Date.now() - START_TIME) / 60000;
    memoryLeakIndicator.add(healthRes.timings.duration);

    // Log health status periodically
    if (iterationCount % 1000 === 0) {
      console.log(`[${elapsedMinutes.toFixed(0)}m] Health: ${health.status}, Uptime: ${health.uptime}s`);
    }
  }
}

export function teardown(data) {
  // Final health check
  const finalHealthRes = http.get(`${BASE_URL}/health`);
  if (finalHealthRes.status === 200) {
    const finalHealth = JSON.parse(finalHealthRes.body);
    console.log('\n=== SOAK TEST SUMMARY ===');
    console.log(`Duration: ${((Date.now() - START_TIME) / 3600000).toFixed(2)} hours`);
    console.log(`Final Health Status: ${finalHealth.status}`);
    console.log(`Final Uptime: ${finalHealth.uptime}s`);
    console.log(`Total Iterations: ${iterationCount}`);
  }
}
