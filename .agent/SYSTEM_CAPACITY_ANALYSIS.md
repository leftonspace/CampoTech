# CampoTech Unified System Monitoring

**Last Updated:** 2026-02-06  
**Environment:** Free tiers (except OpenAI: $10 credit)  
**Expected Usage:** Tradespeople, daily 8am-10pm Argentina

---

## Quick Reference

### Check System Status

| Method | Command/URL | Purpose |
|--------|-------------|---------|
| **Browser (JSON)** | `http://localhost:3000/api/system/capacity` | Full unified status |
| **Browser (Text)** | `http://localhost:3000/api/system/capacity?format=text` | Console-friendly |
| **Browser (Simple)** | `http://localhost:3000/api/system/capacity?format=simple` | Monitoring tools |
| **Service Health** | `http://localhost:3000/api/health` | Operational health only |
| **CLI** | `pnpm tsx scripts/check-capacity.ts` | Terminal output |

### Two Complementary Systems

| System | Endpoint | Purpose |
|--------|----------|---------|
| **Operational Health** | `/api/health` | Is it working right now? |
| **Unified Status** | `/api/system/capacity` | Full picture (health + capacity) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED SYSTEM STATUS                               │
│                    /api/system/capacity                                 │
├────────────────────────────────┬────────────────────────────────────────┤
│   OPERATIONAL HEALTH           │   INFRASTRUCTURE CAPACITY              │
│   (lib/degradation/*)          │   (lib/services/system-capacity.ts)    │
├────────────────────────────────┼────────────────────────────────────────┤
│ ✓ Circuit Breakers             │ ✓ Database Size/Connections            │
│ ✓ Service Status               │ ✓ API Quotas (OpenAI, Twilio)          │
│ ✓ Feature Availability         │ ✓ Business Metrics (orgs, jobs)        │
│ ✓ Active Incidents             │ ✓ Growth Projections                   │
│ ✓ Real-time Latency            │ ✓ Upgrade Recommendations              │
└────────────────────────────────┴────────────────────────────────────────┘
```

---

## Services Monitored

### Operational Health (Real-time)

| Service | Circuit Breaker | Fallback | Notes |
|---------|-----------------|----------|-------|
| **MercadoPago** | ✅ | Cobro presencial | Payment processing |
| **WhatsApp** | ✅ + Latency | SMS fallback | Messaging |
| **OpenAI** | ✅ | Pre-built responses | AI features |
| **AFIP** | ✅ Per-org | Queue diferida | Invoicing |
| **Database** | Ping check | ❌ Critical | Core system |
| **Redis** | Config check | No-cache mode | Optional |
| **Storage** | URL check | ❌ | Supabase Storage |

### Infrastructure Capacity (Quotas)

| Service | Tier | Primary Limit | Status |
|---------|------|---------------|--------|
| **Supabase** | Free | 500MB / 50 conn | 🟡 Watch |
| **Vercel** | Free | 100 GB-hours | ✅ OK |
| **OpenAI** | $10 credit | ~22,000 calls | 🟡 Watch |
| **Twilio** | Trial | ~150 SMS | 🔴 Must upgrade |
| **Resend** | Free | 100 emails/mo | 🔴 Must upgrade |
| **Google Maps** | Free $200 | ~28,000 loads | ✅ OK |

---

## Free Tier Limits Summary

### 🔴 Critical (Must Upgrade Before Launch)

| Service | Issue | Action | Cost |
|---------|-------|--------|------|
| **Twilio** | Trial restricts recipients | Upgrade to paid | ~$20/mo |
| **Resend** | 100 emails/month | Upgrade to Pro | $20/mo |

### 🟡 Watch (Upgrade at 50 Organizations)

| Service | Limit | Upgrade | Cost |
|---------|-------|---------|------|
| **Supabase** | 500MB, 50 conn | Pro | $25/mo |
| **OpenAI** | $10 credit | Auto-billing | ~$20-50/mo |

### ✅ OK (Free Tier Sufficient)

| Service | Limit | Notes |
|---------|-------|-------|
| **Vercel** | 100 GB-hours | Plenty for 100 customers |
| **Google Maps** | $200/mo credit | ~28,000 loads |

---

## Capacity Estimates

### By Customer Count

| Customers | DB | Vercel | OpenAI | Twilio | Resend | Verdict |
|-----------|-----|--------|--------|--------|--------|---------|
| 10 | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | Trial OK |
| 25 | ✅ | ✅ | ✅ | ❌ | ❌ | Must upgrade |
| 50 | ⚠️ | ✅ | ⚠️ | ❌ | ❌ | Upgrade all |
| 100 | ❌ | ✅ | ❌ | ❌ | ❌ | Full upgrade |

### Concurrent Users

| Tier | Max Concurrent | Why |
|------|----------------|-----|
| **Free** | ~50-100 | 50 pooled connections / 0.5 per user |
| **Pro** | ~120 | 60 pooled connections |
| **Team** | ~200 | 100 pooled connections |

### Database Growth

| Organizations | Est. DB Size | Free Tier Status |
|---------------|--------------|------------------|
| 50 | ~25 MB | ✅ 5% used |
| 200 | ~100 MB | ✅ 20% used |
| 500 | ~250 MB | ⚠️ 50% used |
| 1,000 | ~500 MB | ❌ 100% FULL |

---

## Upgrade Path

### Before First Paying Customer

```
Total: ~$60/month minimum

✅ Twilio - Paid account ($20/mo)
✅ Resend - Pro ($20/mo)  
✅ OpenAI - Auto-billing enabled (~$20/mo)
```

### At 50 Organizations

```
Total: ~$85/month

+ Supabase Pro ($25/mo)
```

### At 100 Organizations

```
Total: ~$200-300/month

+ Vercel Pro ($20/mo)
+ Consider Supabase Team if needed
+ Read replica for analytics
```

### At 100k Organizations (Target)

```
Total: ~$1,000-5,000/month

+ Supabase Enterprise
+ Vercel Enterprise
+ Redis (Upstash/ElastiCache)
+ Background job workers
+ CDN optimization
```

---

## Monitoring Setup

### Recommended (Free/Low-Cost)

1. **Sentry** (Free tier: 5k errors/mo)
   - Set `SENTRY_DSN` in environment
   - Already configured in codebase

2. **Uptime Robot** (Free: 50 monitors)
   - Monitor `/api/health`
   - Monitor `/api/system/capacity?format=simple`
   - Alert on non-200 responses

3. **Vercel Analytics** (Included with Pro)
   - Web Vitals
   - Function duration
   - Error rates

### API Response Format

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
  "timestamp": "2026-02-06T15:30:00.000Z"
}
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `lib/degradation/manager.ts` | Operational health manager |
| `lib/degradation/types.ts` | Service/feature definitions |
| `lib/degradation/use-health.ts` | React hook for client |
| `lib/services/system-capacity.service.ts` | Infrastructure capacity |
| `app/api/health/route.ts` | Health API endpoint |
| `app/api/system/capacity/route.ts` | Unified status endpoint |
| `scripts/check-capacity.ts` | CLI tool |
| `sentry.server.config.ts` | Sentry configuration |

---

## Troubleshooting

### "Connection pool exhausted"
- Cause: Too many concurrent connections
- Fix: Reduce concurrent users or upgrade Supabase

### "FUNCTION_INVOCATION_TIMEOUT"
- Cause: Function exceeded 10s limit
- Fix: Optimize query or upgrade Vercel Pro (60s)

### "insufficient_quota" (OpenAI)
- Cause: $10 credit depleted
- Fix: Add payment method at platform.openai.com

### "Circuit breaker open"
- Cause: Too many failures to external service
- Fix: Check service status, will auto-recover

---

## Architecture for 100k Scale

Your current architecture IS designed to scale. The patterns are correct:

| Pattern | Status | Notes |
|---------|--------|-------|
| Connection pooling | ✅ | PgBouncer via Supabase |
| Circuit breakers | ✅ | All external services |
| Graceful degradation | ✅ | Fallbacks defined |
| Read replica support | ✅ | Code exists, not deployed |
| Background jobs | ✅ | Cron-based |
| Multi-tenant isolation | ✅ | organizationId on all tables |

**What's needed for 100k:**
1. Upgrade service tiers
2. Deploy read replica
3. Add Redis caching layer
4. Add dedicated job queue (BullMQ/Inngest)
5. Implement sharding strategy (optional)

The CODE is ready. The INFRASTRUCTURE just needs scaling.
