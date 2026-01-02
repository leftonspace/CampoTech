# CampoTech Admin Guide

This guide covers administrative functions for managing subscriptions, verifications, and payments.

## Accessing the Admin Dashboard

1. Navigate to `/admin/dashboard`
2. Login with admin credentials
3. View real-time metrics and system health

## Dashboard Overview

### Key Metrics

| Metric | Description |
|--------|-------------|
| Conversion Rate | Trial to paid conversion percentage |
| Verification Rate | Document approval percentage |
| Payment Success | Payment completion rate |
| Active Blocks | Current soft/hard blocked accounts |

### Health Indicators

- **🟢 Healthy**: All systems operational
- **🟡 Degraded**: Some services experiencing issues
- **🔴 Critical**: Major system failures

---

## Managing Verifications

### Pending Verifications Queue

Access at: `/admin/verifications`

#### Document Types

| Type | Requirements | Review Priority |
|------|--------------|-----------------|
| `cuit` | Valid CUIT format, matches AFIP | High |
| `dni_front` | Clear photo, legible text | High |
| `dni_back` | Clear photo, legible text | High |
| `selfie` | Face visible, matches DNI | High |
| `driver_license` | Valid and current | Medium |
| `insurance` | Current policy, covers operations | Medium |

### Reviewing Documents

1. Open pending verification from queue
2. View submitted document
3. Check against requirements:
   - Is the document legible?
   - Does name match organization owner?
   - Is the document current/valid?
   - Does CUIT match AFIP records?
4. Approve or Reject with reason

### Approval Process

```
POST /api/admin/verifications/:id/approve
```

The system will:
- Update document status to `approved`
- Check if all required documents are now approved
- If tier complete, update organization verification status
- Send confirmation email to user

### Rejection Process

```
POST /api/admin/verifications/:id/reject
{
  "reason": "La imagen del DNI está borrosa y no se puede leer el número"
}
```

Common rejection reasons (in Spanish):
- "La imagen está borrosa o no es legible"
- "El documento está vencido"
- "El nombre no coincide con el titular de la cuenta"
- "El CUIT no coincide con los registros de AFIP"
- "Se requiere foto del reverso del documento"

### Verification Status Progression

```
unverified → in_review → pending_documents → verified
                ↓
             rejected
```

---

## Managing Subscriptions

### Subscription Tiers

| Tier | Monthly Price (ARS) | Max Jobs | Features |
|------|---------------------|----------|----------|
| FREE | $0 | 5 | Basic posting |
| INICIAL | $25,000 | 15 | Priority support |
| PROFESIONAL | $55,000 | 50 | Analytics, priority listing |
| EMPRESA | $120,000 | Unlimited | White-label, API access |

### Viewing Organization Subscription

1. Navigate to `/admin/organizations/:id`
2. View current subscription details:
   - Current tier
   - Status (active, trialing, expired, cancelled)
   - Billing cycle dates
   - Payment history

### Manual Subscription Actions

#### Grant Trial Extension

For exceptional cases (system issues, etc.):

```
POST /api/admin/organizations/:id/extend-trial
{
  "days": 7,
  "reason": "System downtime during onboarding"
}
```

#### Override Block

When customer has paid via alternate method:

```
POST /api/admin/organizations/:id/unblock
{
  "reason": "Customer paid via bank transfer",
  "newStatus": "active"
}
```

---

## Managing Payments

### Payment Statuses

| Status | Description |
|--------|-------------|
| `pending` | Awaiting payment |
| `processing` | Being processed by MercadoPago |
| `completed` | Successfully paid |
| `failed` | Payment failed |
| `refunded` | Fully refunded |
| `partially_refunded` | Partial refund processed |

### Viewing Payment History

Access at: `/admin/payments`

Filter by:
- Organization
- Status
- Date range
- Amount range

### Processing Refunds

#### Automatic Refund (Ley 24.240)

Within 10 days of payment:
- Customer can request full refund
- System processes automatically via MercadoPago
- Subscription reverts to previous state

#### Manual Refund

For special cases:

```
POST /api/admin/payments/:id/refund
{
  "reason": "Service issue",
  "amount": 25000
}
```

**Important**: Document all manual refunds with detailed reasons.

### Handling Failed Payments

1. Check MercadoPago dashboard for error details
2. Common issues:
   - Insufficient funds
   - Card expired
   - Security rejection
3. Contact customer if recurring failures
4. Apply soft block after 3 failures

---

## Managing Blocks

### Block Types

| Type | Description | User Impact |
|------|-------------|-------------|
| `soft_block` | Warning state | Cannot post new jobs, can view existing |
| `hard_block` | Full restriction | No access to platform features |
| `none` | No block | Full access |

### Block Escalation Timeline

```
Day 0: Trial expires → soft_block
Day 7: Grace period ends → hard_block
```

### Removing Blocks

Once payment is received:

```
POST /api/admin/organizations/:id/unblock
{
  "reason": "Payment received - Invoice #12345"
}
```

### Emergency Unblock

For critical business situations:

1. Document reason thoroughly
2. Get approval from senior admin
3. Set temporary grace period
4. Follow up to ensure payment

---

## Monitoring & Alerts

### Key Alerts to Monitor

| Alert | Severity | Action |
|-------|----------|--------|
| AFIP service down | High | Switch to queue mode |
| MercadoPago errors spike | Critical | Check integration |
| Verification backlog > 50 | Medium | Increase review capacity |
| Payment failure rate > 10% | High | Investigate causes |

### Dashboard Refresh

- Metrics refresh every 30 seconds
- Health status refreshes every minute
- Critical alerts push immediately

### Audit Log

All admin actions are logged:
- Action type
- Admin user
- Timestamp
- Organization affected
- Reason provided

Access logs at: `/admin/audit-log`

---

## Common Scenarios

### Scenario 1: Customer Can't Complete Verification

**Symptoms**: Customer stuck in verification, multiple rejections

**Steps**:
1. Review rejection history
2. Contact customer for clarification
3. Provide specific guidance on document requirements
4. If document issues persist, offer video call verification

### Scenario 2: Payment Keeps Failing

**Symptoms**: Repeated payment failures for same customer

**Steps**:
1. Check MercadoPago error codes
2. Verify card hasn't expired
3. Check if bank is blocking transactions
4. Offer alternative payment methods
5. Consider manual bank transfer option

### Scenario 3: AFIP Validation Fails

**Symptoms**: CUIT shows invalid but customer insists it's correct

**Steps**:
1. Check AFIP service status
2. Manually verify CUIT on AFIP website
3. If AFIP shows active, may be temporary sync issue
4. Queue for retry in 24 hours
5. If persistent, customer may need to contact AFIP

### Scenario 4: Dispute/Chargeback

**Symptoms**: MercadoPago notifies of chargeback

**Steps**:
1. Document all communications with customer
2. Gather evidence of service delivery
3. Respond to MercadoPago dispute within 5 days
4. Apply hard block to organization
5. Note: Ley 24.240 refunds avoid chargebacks

### Scenario 5: Large Enterprise Onboarding

**Steps**:
1. Assign dedicated verification reviewer
2. Expedite document review (< 24 hours)
3. Offer payment via factura/bank transfer
4. Provide direct support contact
5. Monitor first month closely

---

## Security Guidelines

### Access Control

- Admin accounts require 2FA
- Session timeout: 30 minutes inactive
- All actions logged with IP address

### Data Handling

- Never share customer payment details
- PII must not be copied to personal devices
- Use secure channels for customer communication

### Incident Response

If you notice suspicious activity:
1. Don't take immediate action
2. Document the observation
3. Report to security team
4. Await instructions

---

## Support Escalation

### Level 1 - Admin Team
- Verification reviews
- Basic refunds
- Block management
- Standard inquiries

### Level 2 - Senior Admin
- Complex disputes
- Manual subscription adjustments
- Large refunds (> $100,000)
- System issues

### Level 3 - Technical Team
- Integration failures
- Data issues
- Security incidents
- Platform bugs

---

## Quick Reference

### Common API Endpoints

```bash
# Get organization details
GET /api/admin/organizations/:id

# List pending verifications
GET /api/admin/verifications/pending

# Approve verification
POST /api/admin/verifications/:id/approve

# Process refund
POST /api/admin/payments/:id/refund

# Unblock organization
POST /api/admin/organizations/:id/unblock

# Get dashboard metrics
GET /api/admin/dashboard/metrics
```

### Useful Filters

```
# Verifications pending > 24h
GET /api/admin/verifications/pending?olderThan=24h

# Failed payments this week
GET /api/admin/payments?status=failed&since=7d

# Organizations expiring today
GET /api/admin/organizations?trialEndsAt=today
```

---

## Contact

- Technical Issues: dev@campotech.com
- Security: security@campotech.com
- Escalations: admin-lead@campotech.com
