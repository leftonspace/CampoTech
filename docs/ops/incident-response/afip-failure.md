# AFIP Failure Runbook

## Trigger

- Alert: `afip_panic_mode_active`
- Manual: AFIP integration errors reported

## Severity: HIGH

AFIP handles electronic invoicing. Failure means invoices cannot be legally processed.

---

## Quick Actions

```bash
# Check panic status
npm run panic:status

# Enable panic mode if not auto-triggered
npm run panic:enable afip "Manual trigger - investigating failure"

# Check queue status
npm run queue:status -- --queue=cae-queue
```

---

## Diagnosis Steps

### Step 1: Identify Failure Type

Check recent errors:
```bash
grep -i "afip" logs/app.log | tail -100
```

Common failure types:
| Error Pattern | Likely Cause |
|---------------|--------------|
| `ECONNREFUSED` | AFIP server unreachable |
| `ETIMEDOUT` | Network timeout |
| `401/403` | Authentication issue |
| `500` | AFIP internal error |
| `certificate` | Certificate expiry/issue |

### Step 2: Check AFIP Status

1. Visit AFIP status page: https://www.afip.gob.ar/estado-servicios/
2. Check for scheduled maintenance
3. Check Argentine tech news for outage reports

### Step 3: Check Our Infrastructure

```bash
# Test connectivity to AFIP
curl -v https://wsaa.afip.gov.ar/ws/services/LoginCms

# Check certificate expiry
npm run afip:check-cert
```

---

## Resolution by Cause

### AFIP Server Unreachable

**Action**: Wait for AFIP recovery

1. Confirm panic mode is active (auto-fallback)
2. Monitor AFIP status page
3. No action needed - system will auto-recover

**Customer Communication**:
> Electronic invoicing is temporarily unavailable due to AFIP service disruption. Invoices are being queued and will be processed automatically when service resumes.

### Authentication Failure (401/403)

**Action**: Check and refresh credentials

```bash
# Check token expiry
npm run afip:token-status

# Force token refresh
npm run afip:refresh-token

# If still failing, regenerate certificate
npm run afip:regen-cert
```

### Certificate Issue

**Action**: Certificate renewal

```bash
# Check certificate status
npm run afip:check-cert

# If expired, follow certificate renewal process
# (requires admin access to AFIP portal)
```

**Escalation**: Certificate renewal requires AFIP portal access. Escalate to Engineering Lead.

### Network/Timeout Issues

**Action**: Check infrastructure

```bash
# Check DNS resolution
nslookup wsaa.afip.gov.ar

# Check if firewall is blocking
npm run network:check-afip

# Check for high latency
npm run network:latency-afip
```

---

## Fallback Behavior

When AFIP panic mode is active:

1. **Queue Processing**: Paused for CAE queue
2. **Invoice Creation**: Succeeds but marked "Pending CAE"
3. **User Experience**: Users see "Invoice pending electronic authorization"
4. **Data Safety**: All invoice data saved, CAE will be obtained on recovery

---

## Recovery

### Automatic Recovery

System probes AFIP every 30 seconds. After 3 successful probes:
1. Panic mode automatically disabled
2. Queue processing resumes
3. Pending invoices processed in order

### Manual Recovery

If confident AFIP is working:

```bash
# Manually test AFIP
npm run afip:test

# If successful, disable panic
npm run panic:disable afip "Manual verification - AFIP responding"

# Monitor queue recovery
watch -n 5 'npm run queue:status -- --queue=cae-queue'
```

---

## Post-Incident

### If External AFIP Issue

- Note outage duration
- No post-mortem needed unless our fallback failed

### If Internal Issue

- Schedule post-mortem
- Review certificate management
- Review monitoring gaps

---

## Contacts

| Contact | When |
|---------|------|
| AFIP Support | Only for certificate/credential issues |
| Engineering Lead | Certificate expiry, auth issues |
| Finance Team | Customer communication if > 4 hours |
