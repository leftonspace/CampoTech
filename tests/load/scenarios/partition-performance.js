/**
 * Database Partition Performance Tests (Phase 9.1.4)
 * ==================================================
 *
 * Tests that database partitioning is working correctly:
 * 1. Recent data queries use partition pruning
 * 2. Historical queries complete within acceptable time
 * 3. Cross-partition queries don't cause timeouts
 *
 * This validates the Phase 5A partitioning implementation.
 *
 * Usage:
 *   k6 run scenarios/partition-performance.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

// Partition pruning effectiveness metrics
const recentQueryTime = new Trend('recent_query_time');        // Should be fast (partition pruned)
const historicalQueryTime = new Trend('historical_query_time'); // Expected slower
const crossPartitionTime = new Trend('cross_partition_time');   // Multi-partition queries
const aggregationQueryTime = new Trend('aggregation_query_time'); // Analytics queries

// Per-table metrics
const jobsQueryTime = new Trend('jobs_query_time');
const messagesQueryTime = new Trend('messages_query_time');
const locationsQueryTime = new Trend('locations_query_time');
const logsQueryTime = new Trend('logs_query_time');

// Success metrics
const partitionPruningSuccess = new Rate('partition_pruning_success');
const querySuccess = new Rate('query_success');
const slowQueries = new Counter('slow_queries');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const options = {
  scenarios: {
    // Simulate realistic query patterns
    mixed_queries: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // Warm up
        { duration: '5m', target: 200 },  // Normal load
        { duration: '5m', target: 200 },  // Sustain
        { duration: '2m', target: 0 },    // Cool down
      ],
    },
  },
  thresholds: {
    // Recent queries (partition pruning active) should be fast
    recent_query_time: ['p(95)<200', 'p(99)<500'],

    // Historical queries can be slower but must complete
    historical_query_time: ['p(95)<2000', 'p(99)<5000'],

    // Cross-partition queries have relaxed thresholds
    cross_partition_time: ['p(95)<3000', 'p(99)<8000'],

    // Aggregation queries (analytics)
    aggregation_query_time: ['p(95)<5000'],

    // Individual table thresholds
    jobs_query_time: ['p(95)<300'],
    messages_query_time: ['p(95)<400'],
    locations_query_time: ['p(95)<500'],

    // Overall success rates
    query_success: ['rate>0.95'],
    partition_pruning_success: ['rate>0.90'],

    // Don't have too many slow queries
    slow_queries: ['count<100'],
  },
};

const BASE_URL = __ENV.API_URL || 'https://staging-api.campotech.com.ar';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getDateRange(type) {
  const now = new Date();

  switch (type) {
    case 'today':
      return {
        since: now.toISOString().split('T')[0],
        until: now.toISOString().split('T')[0],
      };
    case 'this_week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      return {
        since: weekStart.toISOString().split('T')[0],
        until: now.toISOString().split('T')[0],
      };
    case 'this_month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        since: monthStart.toISOString().split('T')[0],
        until: now.toISOString().split('T')[0],
      };
    case 'last_3_months':
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      return {
        since: threeMonthsAgo.toISOString().split('T')[0],
        until: now.toISOString().split('T')[0],
      };
    case 'last_year':
      const yearAgo = new Date(now);
      yearAgo.setFullYear(now.getFullYear() - 1);
      return {
        since: yearAgo.toISOString().split('T')[0],
        until: now.toISOString().split('T')[0],
      };
    case 'all_time':
      return {
        since: '2020-01-01',
        until: now.toISOString().split('T')[0],
      };
    default:
      return {
        since: now.toISOString().split('T')[0],
        until: now.toISOString().split('T')[0],
      };
  }
}

function generateTestHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Organization-Id': `org-${randomIntBetween(1, 100)}`,
    'X-Load-Test': 'true',
    'X-Partition-Test': 'true',
  };
}

function checkResponseTime(duration, threshold, metricName) {
  if (duration > threshold) {
    slowQueries.add(1);
    console.log(`Slow query detected: ${metricName} took ${duration}ms (threshold: ${threshold}ms)`);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

export function setup() {
  console.log('Starting partition performance test');
  console.log(`Target: ${BASE_URL}`);

  // Verify API is reachable
  const healthRes = http.get(`${BASE_URL}/health`);
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

  // ═════════════════════════════════════════════════════════════════════════════
  // Jobs Table Partition Tests
  // ═════════════════════════════════════════════════════════════════════════════
  group('Jobs Table - Partition Tests', () => {
    // Test 1: Today's jobs (should hit single partition)
    const todayRange = getDateRange('today');
    let start = Date.now();
    let res = http.get(
      `${BASE_URL}/api/jobs?since=${todayRange.since}&until=${todayRange.until}&limit=50`,
      { headers }
    );
    let duration = Date.now() - start;
    recentQueryTime.add(duration);
    jobsQueryTime.add(duration);

    let success = check(res, {
      'today jobs query succeeds': (r) => r.status === 200,
      'today jobs query is fast (<200ms)': (r) => r.timings.duration < 200,
    });
    querySuccess.add(success);
    partitionPruningSuccess.add(checkResponseTime(duration, 200, 'today_jobs'));

    sleep(0.5);

    // Test 2: This month's jobs (single partition for monthly partitions)
    const monthRange = getDateRange('this_month');
    start = Date.now();
    res = http.get(
      `${BASE_URL}/api/jobs?since=${monthRange.since}&until=${monthRange.until}&limit=100`,
      { headers }
    );
    duration = Date.now() - start;
    recentQueryTime.add(duration);
    jobsQueryTime.add(duration);

    success = check(res, {
      'month jobs query succeeds': (r) => r.status === 200,
      'month jobs query acceptable (<500ms)': (r) => r.timings.duration < 500,
    });
    querySuccess.add(success);
    partitionPruningSuccess.add(checkResponseTime(duration, 500, 'month_jobs'));

    sleep(0.5);

    // Test 3: Last 3 months (crosses multiple partitions)
    const threeMonthRange = getDateRange('last_3_months');
    start = Date.now();
    res = http.get(
      `${BASE_URL}/api/jobs?since=${threeMonthRange.since}&until=${threeMonthRange.until}&limit=100`,
      { headers }
    );
    duration = Date.now() - start;
    crossPartitionTime.add(duration);
    jobsQueryTime.add(duration);

    success = check(res, {
      '3 month jobs query succeeds': (r) => r.status === 200,
      '3 month jobs query acceptable (<2000ms)': (r) => r.timings.duration < 2000,
    });
    querySuccess.add(success);

    sleep(0.5);

    // Test 4: Historical query (1+ year, many partitions)
    const yearRange = getDateRange('last_year');
    start = Date.now();
    res = http.get(
      `${BASE_URL}/api/jobs?since=${yearRange.since}&until=${yearRange.until}&limit=50`,
      { headers }
    );
    duration = Date.now() - start;
    historicalQueryTime.add(duration);
    jobsQueryTime.add(duration);

    success = check(res, {
      'year jobs query succeeds': (r) => r.status === 200,
      'year jobs query within limit (<5000ms)': (r) => r.timings.duration < 5000,
    });
    querySuccess.add(success);
  });

  sleep(1);

  // ═════════════════════════════════════════════════════════════════════════════
  // WhatsApp Messages Table Partition Tests (Weekly partitions)
  // ═════════════════════════════════════════════════════════════════════════════
  group('WhatsApp Messages - Partition Tests', () => {
    // Recent messages (single partition)
    const todayRange = getDateRange('today');
    let start = Date.now();
    let res = http.get(
      `${BASE_URL}/api/whatsapp/messages?since=${todayRange.since}&limit=50`,
      { headers }
    );
    let duration = Date.now() - start;
    recentQueryTime.add(duration);
    messagesQueryTime.add(duration);

    let success = check(res, {
      'today messages query succeeds': (r) => r.status === 200,
      'today messages query is fast': (r) => r.timings.duration < 300,
    });
    querySuccess.add(success);
    partitionPruningSuccess.add(checkResponseTime(duration, 300, 'today_messages'));

    sleep(0.5);

    // This week's messages
    const weekRange = getDateRange('this_week');
    start = Date.now();
    res = http.get(
      `${BASE_URL}/api/whatsapp/messages?since=${weekRange.since}&limit=100`,
      { headers }
    );
    duration = Date.now() - start;
    recentQueryTime.add(duration);
    messagesQueryTime.add(duration);

    success = check(res, {
      'week messages query succeeds': (r) => r.status === 200,
      'week messages query acceptable': (r) => r.timings.duration < 500,
    });
    querySuccess.add(success);

    sleep(0.5);

    // Conversation history (may cross partitions)
    const conversationId = `conv-${randomIntBetween(1, 1000)}`;
    start = Date.now();
    res = http.get(
      `${BASE_URL}/api/whatsapp/conversations/${conversationId}/messages?limit=100`,
      { headers }
    );
    duration = Date.now() - start;
    crossPartitionTime.add(duration);
    messagesQueryTime.add(duration);

    success = check(res, {
      'conversation history succeeds': (r) => r.status === 200 || r.status === 404,
      'conversation history acceptable': (r) => r.timings.duration < 1500,
    });
    if (res.status !== 404) querySuccess.add(success);
  });

  sleep(1);

  // ═════════════════════════════════════════════════════════════════════════════
  // Technician Locations Table Partition Tests (Daily partitions)
  // ═════════════════════════════════════════════════════════════════════════════
  group('Technician Locations - Partition Tests', () => {
    const technicianId = `tech-${randomIntBetween(1, 500)}`;

    // Today's locations (single partition)
    const todayRange = getDateRange('today');
    let start = Date.now();
    let res = http.get(
      `${BASE_URL}/api/tracking/history/${technicianId}?date=${todayRange.since}`,
      { headers }
    );
    let duration = Date.now() - start;
    recentQueryTime.add(duration);
    locationsQueryTime.add(duration);

    let success = check(res, {
      'today locations query succeeds': (r) => r.status === 200 || r.status === 404,
      'today locations query is fast': (r) => r.timings.duration < 200,
    });
    querySuccess.add(success);
    partitionPruningSuccess.add(checkResponseTime(duration, 200, 'today_locations'));

    sleep(0.5);

    // Last 7 days of locations (7 partitions)
    const weekRange = getDateRange('this_week');
    start = Date.now();
    res = http.get(
      `${BASE_URL}/api/tracking/history/${technicianId}?since=${weekRange.since}&until=${weekRange.until}`,
      { headers }
    );
    duration = Date.now() - start;
    crossPartitionTime.add(duration);
    locationsQueryTime.add(duration);

    success = check(res, {
      'week locations query succeeds': (r) => r.status === 200 || r.status === 404,
      'week locations query acceptable': (r) => r.timings.duration < 2000,
    });
    querySuccess.add(success);
  });

  sleep(1);

  // ═════════════════════════════════════════════════════════════════════════════
  // Analytics/Aggregation Queries (Cross-partition aggregations)
  // ═════════════════════════════════════════════════════════════════════════════
  group('Analytics - Aggregation Queries', () => {
    // Monthly summary (single partition)
    const monthRange = getDateRange('this_month');
    let start = Date.now();
    let res = http.get(
      `${BASE_URL}/api/analytics/jobs/summary?month=${monthRange.since.substring(0, 7)}`,
      { headers }
    );
    let duration = Date.now() - start;
    aggregationQueryTime.add(duration);

    let success = check(res, {
      'monthly summary succeeds': (r) => r.status === 200,
      'monthly summary acceptable': (r) => r.timings.duration < 3000,
    });
    querySuccess.add(success);

    sleep(0.5);

    // Quarterly trend (3 partitions)
    start = Date.now();
    res = http.get(
      `${BASE_URL}/api/analytics/revenue/trend?period=quarter`,
      { headers }
    );
    duration = Date.now() - start;
    aggregationQueryTime.add(duration);

    success = check(res, {
      'quarterly trend succeeds': (r) => r.status === 200,
      'quarterly trend within limit': (r) => r.timings.duration < 5000,
    });
    querySuccess.add(success);

    sleep(0.5);

    // Year-over-year comparison (12+ partitions)
    start = Date.now();
    res = http.get(
      `${BASE_URL}/api/analytics/performance/yoy`,
      { headers }
    );
    duration = Date.now() - start;
    historicalQueryTime.add(duration);

    success = check(res, {
      'YoY comparison succeeds': (r) => r.status === 200,
      'YoY comparison within limit': (r) => r.timings.duration < 8000,
    });
    querySuccess.add(success);
  });

  sleep(1);

  // ═════════════════════════════════════════════════════════════════════════════
  // Audit Logs Partition Tests
  // ═════════════════════════════════════════════════════════════════════════════
  group('Audit Logs - Partition Tests', () => {
    // Recent audit logs
    const todayRange = getDateRange('today');
    let start = Date.now();
    let res = http.get(
      `${BASE_URL}/api/admin/audit-logs?since=${todayRange.since}&limit=50`,
      { headers }
    );
    let duration = Date.now() - start;
    recentQueryTime.add(duration);
    logsQueryTime.add(duration);

    let success = check(res, {
      'today audit logs succeeds': (r) => r.status === 200,
      'today audit logs is fast': (r) => r.timings.duration < 300,
    });
    querySuccess.add(success);
  });

  sleep(randomIntBetween(1, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`Partition performance test completed in ${duration.toFixed(2)} minutes`);
  console.log('Key metrics to review:');
  console.log('- recent_query_time: Should show partition pruning effectiveness');
  console.log('- historical_query_time: Shows cross-partition query performance');
  console.log('- partition_pruning_success: Rate of queries meeting partition targets');
  console.log('- slow_queries: Count of queries exceeding thresholds');
}
