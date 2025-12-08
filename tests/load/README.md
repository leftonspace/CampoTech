# CampoTech Load Testing

Load testing suite using [k6](https://k6.io/) for performance validation.

## Quick Start

```bash
# Install k6
brew install k6  # macOS
# or
sudo apt-get install k6  # Ubuntu

# Run baseline test against staging
k6 run --env API_URL=https://staging-api.campotech.com.ar scenarios/api-baseline.js
```

## Test Scenarios

### 1. API Baseline (`api-baseline.js`)

Standard load test for normal operations.

- **Target:** 100 concurrent users
- **Duration:** 19 minutes (ramp up + steady + ramp down)
- **Thresholds:**
  - p95 response time < 500ms
  - p99 response time < 1000ms
  - Error rate < 1%

```bash
k6 run scenarios/api-baseline.js
```

### 2. Stress Test (`stress-test.js`)

Find system breaking point under extreme load.

- **Target:** Up to 500 concurrent users
- **Duration:** 25 minutes
- **Thresholds:**
  - p95 response time < 2000ms
  - Error rate < 5%

```bash
k6 run scenarios/stress-test.js
```

### 3. Spike Test (`spike-test.js`)

Test system behavior during sudden traffic spikes.

- **Pattern:** Sudden jumps to 500 users
- **Duration:** 9 minutes
- **Focus:** Flash crowd scenarios

```bash
k6 run scenarios/spike-test.js
```

### 4. Soak Test (`soak-test.js`)

Long-running test to detect memory leaks and resource exhaustion.

- **Target:** 100 concurrent users
- **Duration:** 2 hours
- **Focus:** Stability over time

```bash
k6 run scenarios/soak-test.js
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Target API URL | `https://staging-api.campotech.com.ar` |

### Test Users

Load tests use pre-created test accounts:

```
loadtest1@campotech.com - loadtest5@campotech.com
Password: LoadTest123!
```

**Important:** Create these users in the target environment before running tests.

## Running in CI/CD

```yaml
# .github/workflows/load-test.yml
- name: Run Load Tests
  run: |
    k6 run --out json=results.json scenarios/api-baseline.js
  env:
    API_URL: https://staging-api.campotech.com.ar

- name: Check Results
  run: |
    # Parse results and fail if thresholds not met
    cat results.json | jq '.metrics.http_req_duration.values["p(95)"]'
```

## Analyzing Results

### Cloud Dashboard

```bash
# Send results to k6 Cloud
k6 run --out cloud scenarios/api-baseline.js
```

### Local Output

```bash
# JSON output for processing
k6 run --out json=results.json scenarios/api-baseline.js

# CSV output for spreadsheets
k6 run --out csv=results.csv scenarios/api-baseline.js

# InfluxDB for Grafana
k6 run --out influxdb=http://localhost:8086/k6 scenarios/api-baseline.js
```

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| p50 Response Time | < 100ms | < 200ms |
| p95 Response Time | < 500ms | < 1000ms |
| p99 Response Time | < 1000ms | < 2000ms |
| Error Rate | < 0.1% | < 1% |
| Throughput | > 100 req/s | > 50 req/s |

## Test Schedule

| Test | Frequency | Environment |
|------|-----------|-------------|
| Baseline | Every deploy | Staging |
| Stress | Weekly | Staging |
| Spike | Weekly | Staging |
| Soak | Before major release | Staging |

## Troubleshooting

### Rate Limiting

If you see 429 errors, the test accounts may be hitting rate limits:
- Increase sleep time between requests
- Add more test accounts
- Temporarily raise rate limits in staging

### Connection Errors

```bash
# Check if API is reachable
curl https://staging-api.campotech.com.ar/health

# Test with lower concurrency first
k6 run --vus 10 --duration 1m scenarios/api-baseline.js
```

### Memory Issues

For soak tests, ensure the k6 machine has sufficient resources:
- Minimum 4GB RAM recommended
- Use k6 Cloud for distributed testing
