---
tags:
  - infrastructure
  - monitoring
  - health
  - capacity
  - devops
status: 🟢 Active
type: Technical Reference
---

# 🔧 System Health & Capacity Monitoring

> [!INFO] **Real-time System Visibility**
> CampoTech has two complementary monitoring systems that provide complete visibility into both operational health and infrastructure capacity.

---

## 📊 Quick Links (Live Endpoints)

### Local Development
| Endpoint | Purpose |
|:---|:---|
| [🔗 Full Status (JSON)](http://localhost:3000/api/system/capacity) | Complete unified status |
| [🔗 Console Format](http://localhost:3000/api/system/capacity?format=text) | Human-readable output |
| [🔗 Simple Status](http://localhost:3000/api/system/capacity?format=simple) | For monitoring tools |
| [🔗 Health Only](http://localhost:3000/api/health) | Operational health only |
| [🔗 Health (Prometheus)](http://localhost:3000/api/health?format=prometheus) | Prometheus metrics |

### Production (when deployed)
| Endpoint | Purpose |
|:---|:---|
| [🔗 Full Status](https://campo-tech-rho.vercel.app/api/system/capacity) | Production unified status |
| [🔗 Health Check](https://campo-tech-rho.vercel.app/api/health) | Production health only |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GET /api/system/capacity                             │
│                    UNIFIED SYSTEM STATUS                                │
├─────────────────────────────┬───────────────────────────────────────────┤
│   OPERATIONAL HEALTH         │   INFRASTRUCTURE CAPACITY                │
│   lib/degradation/*          │   lib/services/system-capacity.service   │
├─────────────────────────────┼───────────────────────────────────────────┤
│ ✓ Circuit Breakers          │ ✓ Database Size (MB/500MB free tier)     │
│ ✓ Service Status            │ ✓ Connection Pool (50 limit)             │
│ ✓ Feature Availability      │ ✓ OpenAI Credit ($10 balance)            │
│ ✓ Active Incidents          │ ✓ Twilio SMS (trial $15)                 │
│ ✓ Real-time Latency         │ ✓ Resend Emails (100/mo)                 │
│ ✓ Recovery ETAs             │ ✓ Google Maps ($200/mo)                  │
│                              │ ✓ Bottleneck Detection                   │
│                              │ ✓ Upgrade Recommendations                │
└─────────────────────────────┴───────────────────────────────────────────┘
```

---

## 📈 What Each System Monitors

### Operational Health (`/api/health`)

**Question: "Is it working right now?"**

| Service | Circuit Breaker | Fallback | Impact |
|:---|:---:|:---|:---:|
| **MercadoPago** | ✅ | Cobro presencial | High |
| **WhatsApp** | ✅ + Latency | SMS fallback | High |
| **OpenAI** | ✅ | Pre-built responses | Medium |
| **AFIP** | ✅ Per-org | Queue diferida | Critical |
| **Database** | Ping | ❌ None | Critical |
| **Redis** | Config check | Sin caché | Low |
| **Storage** | URL check | ❌ None | Medium |

### Infrastructure Capacity (`/api/system/capacity`)

**Question: "How much room do we have left?"**

| Service | Current Tier | Primary Limit | Status |
|:---|:---|:---|:---:|
| **Supabase** | Free | 500MB / 50 connections | 🟡 Watch |
| **Vercel** | Free | 100 GB-hours/month | ✅ OK |
| **OpenAI** | $10 credit | ~22,000 AI calls | 🟡 Watch |
| **Twilio** | Trial $15 | ~150 SMS | 🔴 Upgrade |
| **Resend** | Free | 100 emails/month | 🔴 Upgrade |
| **Google Maps** | Free $200/mo | ~28,000 loads | ✅ OK |

---

## 🚨 Breaking Points

### Where Things Break (In Order)

| Priority | Service | Breaking Point | Error You'll See |
|:---:|:---|:---|:---|
| 🔴 1 | **Database Connections** | >50 concurrent | `Connection pool exhausted` |
| 🔴 2 | **Database Size** | 500MB | `Could not create record` |
| 🔴 3 | **Twilio Trial** | $0 balance | `Insufficient funds` |
| 🟡 4 | **OpenAI Credit** | $0 balance | `insufficient_quota` |
| 🟡 5 | **Vercel Timeout** | 10 seconds | `FUNCTION_INVOCATION_TIMEOUT` |
| 🟡 6 | **Resend Quota** | 100 emails | Emails stop sending |

### Capacity by Customer Count

| Customers | DB | API Limits | Verdict |
|:---:|:---:|:---:|:---|
| 10 | ✅ | ⚠️ Trial limits | OK for testing |
| 25 | ✅ | ❌ Twilio/Resend | Must upgrade |
| 50 | ⚠️ | ❌ | Upgrade all services |
| 100 | ❌ | ❌ | Full production tier needed |

---

## 💰 Upgrade Path

### Before First Paying Customer (~$60/month)

| Service | Cost | Notes |
|:---|:---|:---|
| Twilio Paid | $20/mo | Required for real SMS |
| Resend Pro | $20/mo | Required for emails |
| OpenAI Billing | ~$20/mo | Usage-based |

### At 50 Organizations (~$85/month)

| Service | Cost | Notes |
|:---|:---|:---|
| + Supabase Pro | $25/mo | 8GB, 60 connections |

### At 100 Organizations (~$200/month)

| Service | Cost | Notes |
|:---|:---|:---|
| + Vercel Pro | $20/mo | 60s timeout, more concurrency |
| + Consider Redis | $10/mo | Upstash for caching |

---

## 🧪 How to Test

### CLI Commands

```bash
# Formatted console output
pnpm tsx scripts/check-capacity.ts

# JSON output
pnpm tsx scripts/check-capacity.ts --json

# Simple one-line for scripts
pnpm tsx scripts/check-capacity.ts --simple
```

### API Testing

```bash
# Local development
curl http://localhost:3000/api/system/capacity?format=simple

# Production
curl https://campo-tech-rho.vercel.app/api/health
```

### Exit Codes (for CI/CD)

| Code | Status | Meaning |
|:---:|:---|:---|
| 0 | ✅ Healthy | All systems operational |
| 1 | ⚠️ Warning | Some services degraded |
| 2 | 🔴 Critical | Major issues detected |

---

## 📁 File References

| File | Purpose |
|:---|:---|
| `lib/degradation/manager.ts` | Operational health manager (705 lines) |
| `lib/degradation/types.ts` | Service/feature type definitions |
| `lib/degradation/use-health.ts` | React hook for client-side |
| `lib/services/system-capacity.service.ts` | Infrastructure capacity |
| `app/api/health/route.ts` | Health API endpoint |
| `app/api/system/capacity/route.ts` | Unified status endpoint |
| `scripts/check-capacity.ts` | CLI tool |
| `sentry.server.config.ts` | Error monitoring config |
| `.agent/SYSTEM_CAPACITY_ANALYSIS.md` | Detailed analysis doc |

---

## 🔔 Monitoring Integration

### Recommended Setup (Free/Low-Cost)

1. **Sentry** - Error tracking
   - Free tier: 5k errors/month
   - Set `SENTRY_DSN` in environment
   - Already configured in codebase

2. **Uptime Robot** - Availability monitoring
   - Free tier: 50 monitors
   - Monitor `/api/health?format=simple`
   - Alert on non-200 responses

3. **Vercel Analytics** - Performance
   - Included with Vercel Pro
   - Web Vitals, function duration

### Simple Status Response Format

```json
// GET /api/system/capacity?format=simple
{
  "healthy": true,
  "status": "healthy",
  "operationalStatus": "operational",
  "bottleneckCount": 2,
  "organizations": 15,
  "databasePercent": 8.5,
  "recommendations": 3,
  "timestamp": "2026-02-06T16:04:59.000Z"
}
```

---

## 🏛️ Architecture for Scale (100k)

Your current architecture IS designed to scale. The patterns are correct:

| Pattern | Status | Notes |
|:---|:---:|:---|
| Connection pooling | ✅ | PgBouncer via Supabase (port 6543) |
| Circuit breakers | ✅ | All external services |
| Graceful degradation | ✅ | Fallbacks defined |
| Read replica support | ✅ | Code exists, not deployed |
| Background jobs | ✅ | Cron-based |
| Multi-tenant isolation | ✅ | organizationId on all tables |
| **Spatial extensions** | ✅ | `cube` + `earthdistance` for marketplace 1,000+ org queries |
| **Composite indexes** | ✅ | `technician_locations`, `employee_schedules`, `schedule_exceptions` |

**What's needed for 100k organizations:**
1. ✅ Upgrade service tiers (infrastructure)
2. ⬜ Deploy read replica (analytics)
3. ⬜ Add Redis caching layer
4. ⬜ Add dedicated job queue (BullMQ/Inngest)
5. ⬜ Implement sharding (optional, at extreme scale)

> [!TIP] **The CODE is ready. The INFRASTRUCTURE just needs scaling.**

---

## Related Pages

- [[Settings Page]] - Organization configuration
- [[Dashboard Home]] - Main cockpit view
- [[Analytics Page]] - Business intelligence

---

*Last updated: February 2026*
