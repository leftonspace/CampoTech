# WhatsApp Failure Runbook

## Trigger

- Alert: `whatsapp_panic_mode_active`
- Manual: WhatsApp message delivery failures reported

## Severity: HIGH

WhatsApp is a primary communication channel for appointment reminders and customer notifications.

---

## Quick Actions

```bash
# Check panic status
npm run panic:status

# Enable panic mode if not auto-triggered
npm run panic:enable whatsapp "Manual trigger - investigating failure"

# Check queue status
npm run queue:status -- --queue=whatsapp-queue
```

---

## Diagnosis Steps

### Step 1: Identify Failure Type

Check recent errors:
```bash
grep -i "whatsapp\|waba" logs/app.log | tail -100
```

Common failure types:
| Error Pattern | Likely Cause |
|---------------|--------------|
| `rate_limit` | Meta rate limiting |
| `401/403` | Token expired/invalid |
| `invalid_phone` | Phone number format issue |
| `template_rejected` | Template not approved |
| `ECONNREFUSED` | Meta API unreachable |

### Step 2: Check Meta Status

1. Visit Meta Platform Status: https://metastatus.com/
2. Check WhatsApp Business API status
3. Review Meta developer dashboard for account issues

### Step 3: Check Rate Limits

```bash
# Check current rate limit status
npm run whatsapp:rate-status

# View recent message volume
npm run whatsapp:volume -- --hours=1
```

---

## Resolution by Cause

### Rate Limited

**Action**: Wait for rate limit reset

1. Confirm panic mode is active
2. Rate limits typically reset within 1 hour
3. Review if traffic spike caused the limit

**Prevention**:
- Implement message batching
- Spread high-volume sends over time

### Token Expired (401/403)

**Action**: Refresh access token

```bash
# Check token status
npm run whatsapp:token-status

# Refresh token
npm run whatsapp:refresh-token
```

If token refresh fails:
1. Check Meta Business Manager
2. Verify app permissions
3. May need to regenerate token in dashboard

### Template Issues

**Action**: Check template status

```bash
# List template statuses
npm run whatsapp:templates
```

If template rejected:
1. Review rejection reason in Meta Business Manager
2. Submit corrected template
3. Update code to use approved template

### Meta API Unreachable

**Action**: Wait for Meta recovery

1. Confirm on Meta status page
2. Panic mode provides fallback
3. System will auto-recover

---

## Fallback Behavior

When WhatsApp panic mode is active:

1. **Messages Queued**: Delivery attempts paused
2. **App Notifications**: Push notifications sent as backup
3. **Email Fallback**: Critical notifications sent via email
4. **User Impact**: May receive notification via alternate channel

Priority for fallback:
1. Push notification (if app installed)
2. Email (if available)
3. Queue for later WhatsApp delivery

---

## Recovery

### Automatic Recovery

System probes WhatsApp API every 15 seconds. After 3 successful probes:
1. Panic mode automatically disabled
2. Queue processing resumes
3. Queued messages sent (rate-limited to avoid re-triggering)

### Manual Recovery

```bash
# Manually test WhatsApp API
npm run whatsapp:test

# If successful, disable panic
npm run panic:disable whatsapp "Manual verification - API responding"

# Monitor queue recovery (slow drain to avoid rate limits)
watch -n 5 'npm run queue:status -- --queue=whatsapp-queue'
```

### Post-Recovery Queue Management

After recovery, queue may have backlog:

```bash
# Check backlog size
npm run queue:status -- --queue=whatsapp-queue

# If large backlog, consider delayed processing
npm run queue:set-rate -- --queue=whatsapp-queue --rate=10/s
```

---

## Special Considerations

### Voice AI (WhatsApp Voice Messages)

If Voice AI specifically failing:

```bash
# Check Voice AI status
npm run panic:status  # Look for openai_voice

# Voice AI has separate panic mode
npm run panic:enable openai_voice "Voice processing issues"
```

Voice AI fallback:
- Text transcription shown instead of voice
- User prompted to use text input

### High-Volume Events

During promotional campaigns or high-traffic periods:

1. Pre-enable panic mode if expecting rate limits
2. Implement message prioritization
3. Consider spreading sends over longer period

---

## Post-Incident

### If Meta Issue

- Document outage duration
- Review if fallbacks worked correctly
- No post-mortem needed unless fallback failed

### If Rate Limit Issue

- Review what caused traffic spike
- Implement throttling improvements
- Update rate limit thresholds if needed

### If Token/Auth Issue

- Review token refresh process
- Consider implementing proactive token refresh
- Update monitoring for token expiry

---

## Contacts

| Contact | When |
|---------|------|
| Meta Business Support | Account/verification issues |
| Engineering Lead | Token refresh failures |
| Marketing Team | If promotional messages affected |
