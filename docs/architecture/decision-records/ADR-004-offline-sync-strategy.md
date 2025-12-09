# ADR-004: Offline Sync Strategy

**Status:** Accepted
**Date:** December 2024

## Context

Field technicians often work in areas with poor connectivity. The mobile app must function offline and sync when connectivity is restored.

## Decision

Implement a **bidirectional sync** system with the following characteristics:

### Local Database
- **WatermelonDB** for offline storage
- 7 tables: jobs, customers, price_book_items, job_photos, sync_queue, sync_conflicts, user_session
- Lazy sync with eager write

### Offline Capabilities

| Feature | Offline Support | Sync Behavior |
|---------|-----------------|---------------|
| View schedule | ✅ Cached | Auto on reconnect |
| View customer details | ✅ Cached | Auto on reconnect |
| Update job status | ✅ Queued | Auto sync |
| Take photos | ✅ Stored locally | Background upload |
| Record notes | ✅ Queued | Auto sync |
| View maps | ❌ Network required | - |
| Send messages | ✅ Queued | Auto send |
| Create invoice | ❌ Network required | - |

### Conflict Resolution

When conflicts occur (data modified both locally and on server):

1. **Server-wins** (default) - Server data takes precedence
2. **Last-write-wins** - Most recent timestamp wins
3. **User resolution** - Present conflict UI for manual decision

For most cases, server-wins is appropriate since field updates are typically additive.

### Sync Queue

- Maximum 50 pending operations
- Priority-based processing
- Retry with exponential backoff
- DLQ for persistent failures

## Consequences

### Positive
- Works in subway, rural areas, basements
- No data loss
- Transparent to user

### Negative
- Complexity in conflict handling
- Stale data risk
- Storage requirements on device

### Implementation

Location: `/apps/mobile/lib/sync/`

Key components:
- `sync-engine.ts` - Core sync logic
- `sync-queue.ts` - Operation queuing
- `conflict-resolver.ts` - Conflict handling
- `network-monitor.ts` - Connectivity detection

### UI Indicators

- Offline banner when disconnected
- Pending sync indicator (count)
- Conflict resolution modal
- Sync progress during large syncs
