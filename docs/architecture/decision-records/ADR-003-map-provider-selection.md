# ADR-003: Map Provider Selection for Live Tracking

**Status:** Accepted
**Date:** December 2024

## Context

The live tracking feature requires map rendering and ETA calculation. Different provider options have varying costs, features, and reliability.

## Decision

Implement a **tiered map provider strategy** based on customer subscription level:

| Tier | Map Provider | ETA Provider | Features | Cost/1000 |
|------|-------------|--------------|----------|-----------|
| **BÁSICO** | Google Static Maps | Basic (Haversine) | Static image, text ETA | ~$2 |
| **PROFESIONAL** | Mapbox GL JS | Mapbox Directions | Interactive, route line | ~$5 |
| **EMPRESARIAL** | Google Maps Platform | Google Directions | Traffic-aware, street view | ~$15 |

### Implementation

1. **Abstract provider interface** - `MapProvider` and `ETAProvider`
2. **Factory pattern** - Select provider based on organization tier
3. **Graceful degradation** - Fall back to lower tier if API unavailable
4. **Usage tracking** - Monitor and enforce tier limits

### ETA Calculation

Basic tier uses Haversine distance formula:
```typescript
const distance = haversineDistance(current, destination);
const etaMinutes = (distance / estimatedSpeed) * 60;
```

Higher tiers use routing APIs with real-time traffic data.

## Consequences

### Positive
- Cost-effective for small businesses
- Premium features for paying customers
- Clear upgrade path
- Works without external APIs (basic tier)

### Negative
- Multiple provider integrations to maintain
- Testing complexity
- Different UX across tiers

### Cost Analysis (100 customers, 200 jobs/month)

**BÁSICO:**
- Static map loads: 3,200/month
- Cost: ~$6.40/month
- Per customer: ~$0.16/month

**PROFESIONAL:**
- Map loads: 20,250/month
- Direction requests: 4,050/month
- Cost: ~$125/month
- Per customer: ~$2.78/month

**EMPRESARIAL:**
- Map loads: 36,000/month
- Direction requests: 7,200/month
- Cost: ~$432/month
- Per customer: ~$28.80/month
