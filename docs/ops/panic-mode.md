# Panic Mode Operations Guide

## Overview

Panic mode is an automatic circuit breaker that disables failing external integrations to:
- Prevent cascade failures
- Protect user experience
- Allow graceful degradation

## Quick Reference

| Integration | Failure Threshold | Recovery Check |
|-------------|-------------------|----------------|
| AFIP | 5 failures / 5 min | Every 30 sec |
| WhatsApp | 10 failures / 1 min | Every 15 sec |
| MercadoPago | 5 failures / 2 min | Every 30 sec |
| Voice AI | 3 failures / 30 sec | Every 10 sec |

---

## Checking Status

```bash
# View all integration statuses
npm run panic:status
```

Output shows:
- Current state (healthy/degraded/panic)
- Failure count in current window
- Time in panic mode (if active)
- Configured thresholds

---

## Manual Panic Enable

Use when you know an integration is failing before auto-detection triggers:

```bash
# Enable panic mode with reason
npm run panic:enable <integration> "<reason>"

# Examples:
npm run panic:enable afip "AFIP scheduled maintenance 14:00-16:00"
npm run panic:enable whatsapp "Meta reporting service degradation"
npm run panic:enable mercadopago "Payment gateway timeout issues"
```

---

## Manual Panic Disable

Use to restore service after confirming recovery:

```bash
# Disable panic mode
npm run panic:disable <integration> "<reason>"

# Examples:
npm run panic:disable afip "Maintenance window complete, tested OK"
npm run panic:disable whatsapp "Meta reports service restored"
```

---

## Fallback Behaviors

When panic mode is active, the system uses fallback behaviors:

### AFIP (Invoicing)
- Invoices queued for later processing
- Users see "Invoice pending" status
- Queue processes when AFIP recovers
- **User Impact**: Delayed invoice delivery (not immediate)

### WhatsApp
- Messages queued for later delivery
- App notifications used as backup
- Email notifications sent for critical items
- **User Impact**: May receive notification via alternate channel

### MercadoPago
- Payment links still generated
- Webhook processing paused
- Manual reconciliation may be needed
- **User Impact**: Payment confirmation slightly delayed

### Voice AI
- Voice features temporarily disabled
- Text-based interactions continue
- **User Impact**: Voice commands unavailable

---

## Auto-Recovery Process

1. **Detection**: System detects failure threshold crossed
2. **Panic Enabled**: Integration disabled, fallbacks activate
3. **Recovery Probes**: Periodic health checks to integration
4. **Success Threshold**: 3 consecutive successful probes
5. **Auto-Recovery**: Integration re-enabled automatically

Monitor recovery:
```bash
# Watch status changes
watch -n 5 'npm run panic:status'
```

---

## Troubleshooting

### Panic Won't Disable

1. Check if failures are ongoing:
   ```bash
   npm run panic:status
   ```

2. Force disable if external issue is resolved:
   ```bash
   npm run panic:disable <integration> "Force disable - external confirmed OK"
   ```

3. Check logs for probe failures:
   ```bash
   grep "panic.*probe" logs/app.log | tail -20
   ```

### Panic Keeps Re-triggering

1. The underlying issue is not resolved
2. Check external service status pages
3. Consider keeping in panic until confirmed stable
4. May need to increase thresholds temporarily

### Integration Not Recovering

1. Manually test the integration:
   ```bash
   npm run integration:test <integration>
   ```

2. Check for configuration issues
3. Verify credentials/tokens are valid
4. Check network connectivity to external service

---

## Monitoring & Alerts

### Key Metrics

| Metric | Alert Threshold |
|--------|-----------------|
| `panic_mode_active` | Any value = 1 |
| `panic_mode_duration_seconds` | > 30 min |
| `panic_mode_auto_recoveries` | > 3 in 1 hour |

### Alert Response

1. **Panic Active Alert**
   - Check integration status
   - Verify fallbacks are working
   - Monitor for auto-recovery

2. **Long Panic Duration Alert**
   - Escalate to engineering
   - Check external service status
   - Consider customer communication

3. **Frequent Recovery Alert**
   - Integration is unstable
   - May need investigation
   - Consider keeping in panic until stable

---

## Scheduled Maintenance

For known maintenance windows:

```bash
# Before maintenance
npm run panic:enable afip "Scheduled maintenance until 16:00"

# After maintenance confirmed complete
npm run panic:disable afip "Maintenance complete, verified OK"
```

Best practice: Enable panic 5 minutes before maintenance starts.

---

## Related Documentation

- [Incident Response Runbooks](./incident-response/README.md)
- [Capability System](../../architecture/capabilities.md)
- [Environment Override Guidelines](../ENV_OVERRIDE_GUIDELINES.md)
