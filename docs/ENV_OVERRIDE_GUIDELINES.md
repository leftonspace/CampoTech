# Environment Capability Override Guidelines

## Overview

CampoTech uses a capability system that allows features to be enabled/disabled without code changes. While database-backed overrides are the preferred method, environment variable overrides provide an emergency escape hatch.

**⚠️ IMPORTANT: Environment overrides are for emergency use only!**

---

## When to Use Environment Overrides

### ✅ Appropriate Use Cases

1. **Active Incidents** - When a service is failing and you need immediate action
2. **Maintenance Windows** - Short-term disable during planned maintenance
3. **Emergency Rollback** - Quick disable after a problematic deployment
4. **Testing in Development** - Local testing of fallback behavior

### ❌ Inappropriate Use Cases

1. **Permanent Configuration** - Use database overrides instead
2. **Per-Customer Settings** - Use per-org database overrides
3. **Feature Flags** - Environment overrides don't support gradual rollout
4. **Production Configuration** - Avoid storing in environment permanently

---

## How to Use Environment Overrides

### Setting an Override

```bash
# Format: CAPABILITY_<CATEGORY>_<NAME>=true|false

# Disable AFIP integration
export CAPABILITY_EXTERNAL_AFIP=false

# Enable WhatsApp (if disabled by default)
export CAPABILITY_EXTERNAL_WHATSAPP=true

# Disable Voice AI
export CAPABILITY_EXTERNAL_WHATSAPP_VOICE_AI=false
```

### Available Environment Variables

| Category | Capability | Environment Variable |
|----------|------------|---------------------|
| **External** | | |
| | afip | `CAPABILITY_EXTERNAL_AFIP` |
| | mercadopago | `CAPABILITY_EXTERNAL_MERCADOPAGO` |
| | whatsapp | `CAPABILITY_EXTERNAL_WHATSAPP` |
| | whatsapp_voice_ai | `CAPABILITY_EXTERNAL_WHATSAPP_VOICE_AI` |
| | push_notifications | `CAPABILITY_EXTERNAL_PUSH_NOTIFICATIONS` |
| **Domain** | | |
| | invoicing | `CAPABILITY_DOMAIN_INVOICING` |
| | payments | `CAPABILITY_DOMAIN_PAYMENTS` |
| | scheduling | `CAPABILITY_DOMAIN_SCHEDULING` |
| | job_assignment | `CAPABILITY_DOMAIN_JOB_ASSIGNMENT` |
| | offline_sync | `CAPABILITY_DOMAIN_OFFLINE_SYNC` |
| | technician_gps | `CAPABILITY_DOMAIN_TECHNICIAN_GPS` |
| **Services** | | |
| | cae_queue | `CAPABILITY_SERVICES_CAE_QUEUE` |
| | whatsapp_queue | `CAPABILITY_SERVICES_WHATSAPP_QUEUE` |
| | payment_reconciliation | `CAPABILITY_SERVICES_PAYMENT_RECONCILIATION` |
| | abuse_detection | `CAPABILITY_SERVICES_ABUSE_DETECTION` |
| | rate_limiting | `CAPABILITY_SERVICES_RATE_LIMITING` |
| | analytics_pipeline | `CAPABILITY_SERVICES_ANALYTICS_PIPELINE` |
| **UI** | | |
| | simple_mode | `CAPABILITY_UI_SIMPLE_MODE` |
| | advanced_mode | `CAPABILITY_UI_ADVANCED_MODE` |
| | pricebook | `CAPABILITY_UI_PRICEBOOK` |
| | reporting_dashboard | `CAPABILITY_UI_REPORTING_DASHBOARD` |

---

## Priority Order

When resolving capability values, the system checks in this order:

1. **Environment Variables** (highest priority) - Emergency override
2. **Per-Organization Database Overrides** - Customer-specific settings
3. **Global Database Overrides** - System-wide persistent changes
4. **Static Defaults** - Code-defined defaults (usually `true`)

---

## Safety Measures

### Startup Warnings

When the application starts with active environment overrides, it will display a prominent warning:

```
════════════════════════════════════════════════════════════════
⚠️  ENVIRONMENT CAPABILITY OVERRIDES ACTIVE
   These should be temporary. Use DB overrides for persistence.
   Active overrides:
   - CAPABILITY_EXTERNAL_AFIP=false
════════════════════════════════════════════════════════════════
```

### Stale Override Detection

Overrides active for more than 24 hours are flagged as "stale" and generate additional warnings. This helps prevent environment overrides from becoming permanent configuration.

### Monitoring

Use the admin dashboard or CLI to check override status:

```bash
# Check current status
npm run capability:status

# Generate report of all overrides
npm run capability:report
```

---

## Incident Response Procedure

### Enabling an Override (Incident)

1. **Communicate** - Notify the team in #incidents channel
2. **Set Override** - `export CAPABILITY_EXTERNAL_AFIP=false`
3. **Restart** - Restart affected services
4. **Document** - Create incident ticket with timestamp
5. **Set Reminder** - Set 24-hour reminder to review/remove

### Removing an Override (Post-Incident)

1. **Verify Recovery** - Confirm the underlying issue is resolved
2. **Remove Override** - `unset CAPABILITY_EXTERNAL_AFIP`
3. **Restart** - Restart affected services
4. **Verify** - Confirm capability is functioning normally
5. **Document** - Update incident ticket with resolution

---

## Best Practices

### DO

- ✅ Document the reason when setting an override
- ✅ Set a calendar reminder to review overrides
- ✅ Use database overrides for changes > 24 hours
- ✅ Monitor for stale override alerts
- ✅ Review overrides during incident postmortems

### DON'T

- ❌ Commit override values to version control
- ❌ Use environment overrides for permanent configuration
- ❌ Forget to remove overrides after incidents
- ❌ Disable safety-critical capabilities without review
- ❌ Set multiple overrides without documentation

---

## Converting to Database Overrides

If you need a persistent override, convert it to a database override:

```typescript
// Via Admin API
await capabilityService.setOverride({
  capability_path: 'external.afip',
  enabled: false,
  reason: 'AFIP integration disabled per ticket INC-1234',
  expires_at: null, // Or set expiration date
});

// Then remove the environment override
// unset CAPABILITY_EXTERNAL_AFIP
```

Or use the admin dashboard:
1. Navigate to Admin > Capabilities
2. Find the capability
3. Click "Add Override"
4. Set the value and reason
5. Remove the environment variable

---

## Troubleshooting

### Override Not Taking Effect

1. Verify the environment variable is set: `echo $CAPABILITY_EXTERNAL_AFIP`
2. Verify the spelling matches exactly (case-sensitive)
3. Restart the application after setting the variable
4. Check logs for "ENVIRONMENT CAPABILITY OVERRIDES ACTIVE" message

### Can't Remove Override

1. Verify you're modifying the correct environment (production, staging, etc.)
2. Check for override in deployment configuration (Docker, K8s, etc.)
3. Use `npm run capability:clear-env-overrides` to generate removal script

### Multiple Conflicting Overrides

Environment overrides take precedence over database overrides. If behavior is unexpected:
1. Check environment variables first
2. Then check database overrides in admin dashboard
3. Verify no global override is conflicting with per-org override

---

## Related Documentation

- [Capability System Architecture](../architecture/capabilities.md)
- [Panic Mode Operations](../docs/ops/panic-mode.md)
- [Incident Response Runbook](../docs/ops/incident-response.md)

---

*Last Updated: 2024-01-15*
