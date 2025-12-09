# ADR-001: WhatsApp Message Aggregator Model

**Status:** Accepted
**Date:** December 2024

## Context

Customers in Argentina typically send multiple WhatsApp messages in quick succession rather than composing a single complete message. For example:

```
14:30:01  "Hola"
14:30:03  "Como estas?"
14:30:08  "Necesito ayuda"
14:30:15  "Se me rompió el aire, no enfría nada, pueden venir hoy?"
```

Processing each message individually would result in fragmented, robotic responses that don't match customer expectations.

## Decision

Implement a message aggregation system that:

1. **Buffers messages** in Redis with an 8-second sliding window
2. **Detects trigger patterns** that indicate a complete thought:
   - Request verbs (necesito, quiero, pueden)
   - Question marks
   - Long messages (>100 chars)
   - Urgency words
   - Voice messages
   - Address/schedule patterns

3. **Maintains conversation context** in PostgreSQL:
   - Last 10 messages
   - Customer identification
   - Active job reference
   - 24-hour expiration

4. **Falls back gracefully** to immediate processing if Redis is unavailable

## Consequences

### Positive
- Natural conversation flow
- Better GPT extraction accuracy with full context
- Reduced API costs (fewer GPT calls)
- Matches Argentine communication patterns

### Negative
- Added complexity
- 8-second latency for non-triggered messages
- Redis dependency for optimal experience

### Mitigations
- Graceful degradation without Redis
- Configurable trigger patterns per organization
- Monitoring dashboard for buffer statistics

## Implementation

Location: `/src/integrations/whatsapp/aggregation/`

Key files:
- `message-aggregator.service.ts` - Core aggregation logic
- `trigger-detector.ts` - Pattern matching
- `conversation-context.service.ts` - Context management
