# CampoTech Comprehensive Test Plan

**Version:** 1.0
**Date:** December 2024
**Admin Test Account:** +18199685685
**Environment:** Vercel (Web) + Supabase (Database/Auth)

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Test Data Requirements](#2-test-data-requirements)
3. [Phase 1: Authentication & Onboarding Tests](#3-phase-1-authentication--onboarding-tests)
4. [Phase 2: Core Domain Services Tests](#4-phase-2-core-domain-services-tests)
5. [Phase 3: AFIP Integration Tests](#5-phase-3-afip-integration-tests)
6. [Phase 4: MercadoPago Integration Tests](#6-phase-4-mercadopago-integration-tests)
7. [Phase 5: Web Portal Tests](#7-phase-5-web-portal-tests)
8. [Phase 6: WhatsApp Integration Tests](#8-phase-6-whatsapp-integration-tests)
9. [Phase 7: Mobile Technician App Tests](#9-phase-7-mobile-technician-app-tests)
10. [Phase 8: Voice AI Processing Tests](#10-phase-8-voice-ai-processing-tests)
11. [Phase 9: Observability & Hardening Tests](#11-phase-9-observability--hardening-tests)
12. [End-to-End Workflow Tests](#12-end-to-end-workflow-tests)
13. [Success Metrics Summary](#13-success-metrics-summary)

---

## 1. Test Environment Setup

### Prerequisites

```bash
# Environment URLs
WEB_URL=https://your-app.vercel.app
API_URL=https://your-app.vercel.app/api
SUPABASE_URL=https://your-project.supabase.co

# Admin Test Account
ADMIN_PHONE=+18199685685
```

### Pre-Test Checklist

- [ ] Verify Vercel deployment is running
- [ ] Verify Supabase connection is active
- [ ] Verify Redis/Upstash queue is operational
- [ ] Verify AFIP homologation credentials are configured
- [ ] Verify MercadoPago sandbox credentials are configured
- [ ] Verify WhatsApp Business API is connected (if enabled)

---

## 2. Test Data Requirements

### Organization Test Data

| Field | Value | Notes |
|-------|-------|-------|
| Name | CampoTech Test Org | Test organization |
| CUIT | 20-12345678-9 | Valid AFIP homologation CUIT |
| IVA Condition | responsable_inscripto | For testing Factura A/B |
| Admin Phone | +18199685685 | Your admin account |

### Customer Test Data (Create These)

| Customer | Phone | CUIT | IVA Condition | Purpose |
|----------|-------|------|---------------|---------|
| Juan Perez | +5491155551001 | 20-11111111-1 | responsable_inscripto | Factura A tests |
| Maria Garcia | +5491155551002 | 27-22222222-2 | monotributista | Factura C tests |
| Pedro Lopez | +5491155551003 | - (DNI: 33333333) | consumidor_final | Factura B tests |
| Ana Martinez | +5491155551004 | 23-44444444-4 | exento | IVA exemption tests |
| Test Offline | +5491155551005 | - | consumidor_final | Offline sync tests |

### Technician Test Data (Create These)

| Technician | Phone | Role | Purpose |
|------------|-------|------|---------|
| Tech Carlos | +5491155552001 | technician | Mobile app tests |
| Tech Diego | +5491155552002 | technician | Offline/conflict tests |
| Admin Sofia | +5491155552003 | admin | Dashboard tests |
| Dispatch Elena | +5491155552004 | dispatcher | Job assignment tests |

### Price Book Test Data

| Item | Category | Base Price | Tax Rate |
|------|----------|------------|----------|
| Visita diagnostico | mano_de_obra | $5,000 ARS | 21% |
| Reparacion canilla | mano_de_obra | $8,000 ARS | 21% |
| Instalacion aire | mano_de_obra | $25,000 ARS | 21% |
| Caño PVC 1/2 | materiales | $500 ARS | 21% |
| Cinta teflon | consumibles | $200 ARS | 21% |

---

## 3. Phase 1: Authentication & Onboarding Tests

### TEST-AUTH-001: Phone OTP Login Flow

**Scenario:** New user signs up with phone number

**Execution Steps:**
1. Navigate to login page
2. Enter phone number: +18199685685
3. Click "Send OTP"
4. Check phone for SMS/WhatsApp OTP
5. Enter 6-digit OTP code
6. Verify redirect to onboarding/dashboard

**Success Benchmarks:**
- [ ] OTP sent within 5 seconds
- [ ] OTP expires after 5 minutes
- [ ] Max 3 OTP attempts before lockout
- [ ] Session token received with 15-min access token
- [ ] Refresh token received with 7-day TTL

**Verification Query:**
```sql
SELECT * FROM users WHERE phone = '+18199685685';
SELECT * FROM auth.sessions WHERE user_id = (SELECT id FROM users WHERE phone = '+18199685685');
```

---

### TEST-AUTH-002: Organization Onboarding

**Scenario:** New organization setup with minimal fields

**Execution Steps:**
1. After first login, verify onboarding screen appears
2. Enter CUIT: 20-12345678-9
3. Verify company name auto-fills from AFIP (if AFIP accessible)
4. Enter company name: "CampoTech Test Org"
5. Click "Complete Setup"
6. Verify redirect to dashboard

**Success Benchmarks:**
- [ ] Only 2 required fields (CUIT + Name)
- [ ] CUIT validation format check passes
- [ ] Organization created in database
- [ ] User linked to organization with 'owner' role
- [ ] Total time < 90 seconds

**Verification Query:**
```sql
SELECT o.*, u.role FROM organizations o
JOIN users u ON u.org_id = o.id
WHERE u.phone = '+18199685685';
```

---

### TEST-AUTH-003: Session Refresh

**Scenario:** Access token expires and refreshes automatically

**Execution Steps:**
1. Login and note access token expiry
2. Wait 15+ minutes OR manually expire token
3. Make an API request
4. Verify automatic token refresh
5. Continue using the app without re-login

**Success Benchmarks:**
- [ ] Token refreshes silently
- [ ] No login redirect during refresh
- [ ] New access token received
- [ ] Old refresh token invalidated (rotation)

---

### TEST-AUTH-004: Role-Based Access Control

**Scenario:** Different roles see different features

**Execution Steps:**
1. Login as Owner (+18199685685)
2. Verify full menu access
3. Create a Technician user
4. Login as Technician
5. Verify restricted menu (only "Today's Jobs", "Profile")

**Success Benchmarks:**
- [ ] Owner sees: Dashboard, Jobs, Customers, Invoices, Payments, Settings, Team
- [ ] Admin sees: Dashboard, Jobs, Customers, Invoices, Payments
- [ ] Dispatcher sees: Dashboard, Jobs, Customers
- [ ] Technician sees: Today's Jobs, Profile only
- [ ] Accountant sees: Invoices, Payments, Reports only

---

## 4. Phase 2: Core Domain Services Tests

### TEST-CUST-001: Customer Creation

**Scenario:** Create a new customer with full details

**Execution Steps:**
1. Navigate to Customers > New Customer
2. Enter Name: "Juan Perez"
3. Enter Phone: +5491155551001
4. Enter CUIT: 20-11111111-1
5. Verify IVA condition auto-fetches: "responsable_inscripto"
6. Enter Address: "Av. Corrientes 1234, CABA"
7. Enter Barrio: "Palermo"
8. Click "Save"

**Success Benchmarks:**
- [ ] Customer created in < 2 seconds
- [ ] Phone uniqueness enforced (org_id, phone)
- [ ] CUIT validation passes
- [ ] IVA condition stored correctly
- [ ] Geocoding populates lat/lng (if enabled)

**Verification Query:**
```sql
SELECT * FROM customers WHERE phone = '+5491155551001';
```

---

### TEST-CUST-002: Customer Duplicate Prevention

**Scenario:** Prevent duplicate customers by phone

**Execution Steps:**
1. Create customer with phone +5491155551001
2. Try to create another customer with same phone
3. Verify error message appears

**Success Benchmarks:**
- [ ] Error message: "Customer with this phone already exists"
- [ ] Option to view existing customer
- [ ] No duplicate created

---

### TEST-JOB-001: Job Creation & Scheduling

**Scenario:** Create and schedule a new job

**Execution Steps:**
1. Navigate to Jobs > New Job
2. Select Customer: "Juan Perez"
3. Enter Title: "Repair bathroom leak"
4. Select Type: "plomeria"
5. Set Priority: "normal"
6. Set Date: Tomorrow
7. Set Time: 10:00 - 12:00
8. Assign Technician: "Tech Carlos"
9. Click "Create Job"

**Success Benchmarks:**
- [ ] Job created with status: "scheduled"
- [ ] Technician receives push notification (if enabled)
- [ ] Customer receives WhatsApp confirmation (if enabled)
- [ ] Job appears in calendar view

**Verification Query:**
```sql
SELECT j.*, c.name as customer_name, u.full_name as technician_name
FROM jobs j
LEFT JOIN customers c ON j.customer_id = c.id
LEFT JOIN users u ON j.assigned_to = u.id
WHERE j.title LIKE '%bathroom leak%';
```

---

### TEST-JOB-002: Job Status Transitions

**Scenario:** Complete job status flow

**Execution Steps:**
1. Start with job in "pending" status
2. Assign technician → status becomes "scheduled"
3. Technician taps "En Camino" → status becomes "en_camino"
4. Technician taps "Arrived" → status becomes "working"
5. Technician taps "Complete" with photos/signature → status becomes "completed"

**Success Benchmarks:**
- [ ] Each transition logged with timestamp
- [ ] Invalid transitions rejected (e.g., pending → completed)
- [ ] WhatsApp notifications sent for each status (if enabled)
- [ ] Auto-invoice triggered on completion (if setting enabled)

**State Machine Verification:**
```
pending → scheduled ✓
pending → cancelled ✓
scheduled → en_camino ✓
scheduled → cancelled ✓
en_camino → working ✓
en_camino → cancelled ✓
working → completed ✓
working → cancelled ✓
completed → (terminal)
cancelled → (terminal)
```

---

### TEST-JOB-003: Job Cancellation

**Scenario:** Cancel a scheduled job

**Execution Steps:**
1. Select a scheduled job
2. Click "Cancel Job"
3. Enter reason: "Customer requested cancellation"
4. Confirm cancellation

**Success Benchmarks:**
- [ ] Status changes to "cancelled"
- [ ] Cancellation reason stored
- [ ] Technician notified (if assigned)
- [ ] Customer notified (WhatsApp, if enabled)
- [ ] Job cannot be modified after cancellation

---

### TEST-INV-001: Invoice Draft Creation

**Scenario:** Create invoice draft for a completed job

**Execution Steps:**
1. Navigate to completed job
2. Click "Create Invoice"
3. Verify line items populated from job
4. Add line item: "Reparacion canilla" - $8,000
5. Add line item: "Cinta teflon x2" - $400
6. Verify tax calculation: IVA 21%
7. Click "Save as Draft"

**Success Benchmarks:**
- [ ] Invoice created with status: "draft"
- [ ] Subtotal: $8,400 ARS
- [ ] IVA (21%): $1,764 ARS
- [ ] Total: $10,164 ARS
- [ ] Invoice type auto-determined based on customer IVA condition

**Invoice Type Verification:**
```
Org: responsable_inscripto
Customer: responsable_inscripto → Factura A
Customer: monotributista → Factura C
Customer: consumidor_final → Factura B
Customer: exento → Factura B (with exemption)
```

---

### TEST-INV-002: Invoice Immutability After CAE

**Scenario:** Verify fiscal fields cannot be modified after CAE

**Execution Steps:**
1. Create and submit invoice for CAE
2. Wait for CAE to be received
3. Try to modify invoice_number → Expect failure
4. Try to modify total_amount → Expect failure
5. Try to modify internal_notes → Should succeed

**Success Benchmarks:**
- [ ] Invoice number locked
- [ ] CUIT locked
- [ ] Amount locked
- [ ] CAE locked
- [ ] Only internal_notes editable
- [ ] Database trigger fires on violation attempt

---

### TEST-PAY-001: Manual Payment Recording

**Scenario:** Record a cash payment

**Execution Steps:**
1. Select an issued invoice
2. Click "Record Payment"
3. Select method: "Cash"
4. Enter amount: Full invoice amount
5. Enter reference: "Receipt #12345"
6. Click "Record Payment"

**Success Benchmarks:**
- [ ] Payment record created
- [ ] Invoice status changes to "paid"
- [ ] payment_method = "cash"
- [ ] Audit log created

---

## 5. Phase 3: AFIP Integration Tests

### TEST-AFIP-001: CAE Request Success

**Scenario:** Successfully obtain CAE from AFIP (Homologation)

**Prerequisites:**
- AFIP certificate uploaded
- Punto de venta configured
- Test in homologation mode

**Execution Steps:**
1. Create invoice draft for customer with valid CUIT
2. Click "Request CAE"
3. Verify queue status shows "Processing"
4. Wait for AFIP response (usually < 30 seconds in homo)
5. Verify CAE received and stored

**Success Benchmarks:**
- [ ] Invoice number assigned (sequential, no gaps)
- [ ] CAE received (14-digit number)
- [ ] CAE expiry date set (typically +10 days)
- [ ] QR code generated
- [ ] PDF generated with all required fields
- [ ] Invoice status: "issued"

**Verification Query:**
```sql
SELECT id, invoice_number, cae, cae_expiry, qr_data, status, pdf_url
FROM invoices
WHERE org_id = (SELECT id FROM organizations WHERE cuit = '20-12345678-9')
ORDER BY created_at DESC LIMIT 1;
```

---

### TEST-AFIP-002: Invoice Numbering Sequence

**Scenario:** Verify sequential invoice numbering with no gaps

**Execution Steps:**
1. Check current last invoice number from AFIP
2. Create and submit 5 invoices for CAE
3. Verify all get sequential numbers

**Success Benchmarks:**
- [ ] Invoice 1: N
- [ ] Invoice 2: N+1
- [ ] Invoice 3: N+2
- [ ] Invoice 4: N+3
- [ ] Invoice 5: N+4
- [ ] No gaps even if one fails

**Verification:**
```sql
SELECT invoice_number, punto_venta, invoice_type, status
FROM invoices
WHERE org_id = ?
ORDER BY invoice_number DESC LIMIT 10;
```

---

### TEST-AFIP-003: AFIP Failure & Fallback

**Scenario:** AFIP unavailable, invoice saved as draft

**Execution Steps:**
1. Disable AFIP capability: `CAPABILITY_EXTERNAL_AFIP=false`
2. Create invoice and request CAE
3. Verify invoice saved as "draft" with queued flag
4. Re-enable AFIP capability
5. Verify queue processor submits pending invoices

**Success Benchmarks:**
- [ ] Invoice not rejected, saved as draft
- [ ] User sees: "Invoice saved. CAE will be requested when AFIP available."
- [ ] Retry happens automatically when AFIP recovers
- [ ] Invoice eventually gets CAE

---

### TEST-AFIP-004: AFIP Error Handling

**Scenario:** Handle various AFIP rejection errors

**Test Cases:**

| Error Code | Cause | Expected Behavior |
|------------|-------|-------------------|
| 10016 | Invalid CUIT | Show "CUIT inválido", block resubmit |
| 10048 | Duplicate | Check existing CAE, recover if exists |
| 10013 | Invalid punto de venta | Show "Contact admin", flag config issue |
| 10018 | Date out of range | Auto-adjust to today, retry |

---

## 6. Phase 4: MercadoPago Integration Tests

### TEST-MP-001: OAuth Connection

**Scenario:** Connect organization's MercadoPago account

**Execution Steps:**
1. Navigate to Settings > MercadoPago
2. Click "Connect MercadoPago"
3. Redirect to MP authorization page
4. Authorize the app
5. Verify redirect back with success

**Success Benchmarks:**
- [ ] Access token stored (encrypted)
- [ ] Refresh token stored (encrypted)
- [ ] MP user ID stored
- [ ] Connected status shown in dashboard

**Verification Query:**
```sql
SELECT mp_user_id, mp_connected_at
FROM organizations
WHERE id = ?;
```

---

### TEST-MP-002: Payment Preference Creation

**Scenario:** Create payment link for invoice

**Execution Steps:**
1. Select an issued invoice
2. Click "Generate Payment Link"
3. Verify preference created in MP (sandbox)
4. Copy payment link
5. Verify link format: checkout.mercadopago.com.ar/...

**Success Benchmarks:**
- [ ] Preference ID stored
- [ ] init_point URL generated
- [ ] Items match invoice line items
- [ ] notification_url points to webhook endpoint
- [ ] external_reference = invoice_id

---

### TEST-MP-003: Payment Webhook Processing

**Scenario:** Process approved payment webhook

**Execution Steps:**
1. Open payment link in incognito window
2. Complete payment with test card (sandbox)
3. Verify webhook received
4. Verify payment record created
5. Verify invoice marked as paid

**MercadoPago Sandbox Test Cards:**
```
Visa: 4509 9535 6623 3704
Mastercard: 5031 7557 3453 0604
CVV: 123
Expiry: Any future date
Name: APRO (for approved) / OTHE (for rejected)
```

**Success Benchmarks:**
- [ ] Webhook received within 30 seconds
- [ ] Signature validated
- [ ] Payment record created with correct amount
- [ ] Invoice status → "paid"
- [ ] Customer notification sent (WhatsApp)
- [ ] Idempotency prevents duplicate processing

---

### TEST-MP-004: Payment Reconciliation

**Scenario:** Catch missed webhooks via reconciliation

**Execution Steps:**
1. Process a payment but simulate webhook failure
2. Wait for reconciliation job (or trigger manually)
3. Verify missing payment detected and created

**Success Benchmarks:**
- [ ] Reconciliation runs every 15 minutes
- [ ] Missing payments detected
- [ ] Payment records created
- [ ] Alert sent if discrepancies found

---

### TEST-MP-005: Cuotas Display

**Scenario:** Display installment options with TEA/CFT

**Execution Steps:**
1. Generate payment preference with installments enabled
2. Open payment link
3. Select "3 cuotas"
4. Verify TEA/CFT displayed per BCRA regulations

**Success Benchmarks:**
- [ ] Installment options 1-12 shown
- [ ] Per-installment amount shown
- [ ] Total with interest shown
- [ ] TEA percentage displayed
- [ ] CFT percentage displayed

---

## 7. Phase 5: Web Portal Tests

### TEST-WEB-001: Dashboard Overview

**Scenario:** Verify dashboard displays correct data

**Execution Steps:**
1. Login as Owner
2. Navigate to Dashboard
3. Verify Today's Summary widget
4. Verify System Health panel
5. Verify Recent Activity feed

**Success Benchmarks:**
- [ ] Jobs count matches database
- [ ] Revenue calculation correct
- [ ] AFIP status shows green/red correctly
- [ ] WhatsApp status shows correctly
- [ ] MercadoPago status shows correctly
- [ ] Queue health shows pending/failed counts

---

### TEST-WEB-002: Jobs List & Filtering

**Scenario:** Filter and search jobs

**Execution Steps:**
1. Navigate to Jobs
2. Filter by status: "pending"
3. Filter by date: Today
4. Filter by technician: "Tech Carlos"
5. Search by customer name: "Juan"

**Success Benchmarks:**
- [ ] Filters combine correctly (AND logic)
- [ ] Results update immediately
- [ ] Pagination works for > 20 results
- [ ] Export to CSV works (if implemented)

---

### TEST-WEB-003: Calendar View

**Scenario:** View jobs in calendar format

**Execution Steps:**
1. Navigate to Jobs > Calendar
2. Switch between Day/Week views
3. Click on a job to see details
4. Drag job to reschedule (if enabled)

**Success Benchmarks:**
- [ ] Jobs displayed on correct dates
- [ ] Color coding by status
- [ ] Technician filter works
- [ ] Drag-and-drop updates database

---

### TEST-WEB-004: Invoice PDF Preview

**Scenario:** View and download invoice PDF

**Execution Steps:**
1. Navigate to Invoices
2. Click on issued invoice
3. Click "View PDF"
4. Verify PDF contains all required elements
5. Click "Download"

**PDF Required Elements:**
- [ ] Company header (logo, name, CUIT, address)
- [ ] Invoice type (A/B/C)
- [ ] Invoice number (formatted: 0001-00000001)
- [ ] Date
- [ ] Customer details
- [ ] Line items with prices
- [ ] Subtotal
- [ ] IVA breakdown
- [ ] Total
- [ ] CAE number
- [ ] CAE expiry date
- [ ] QR code (AFIP RG 4291 format)

---

### TEST-WEB-005: Team Management

**Scenario:** Invite and manage team members

**Execution Steps:**
1. Navigate to Settings > Team
2. Click "Invite Member"
3. Enter phone: +5491155552005
4. Select role: "technician"
5. Click "Send Invitation"
6. New user receives OTP and completes signup

**Success Benchmarks:**
- [ ] Invitation sent (OTP to phone)
- [ ] New user linked to organization
- [ ] Role correctly assigned
- [ ] User appears in team list
- [ ] Can deactivate user

---

### TEST-WEB-006: Settings Configuration

**Scenario:** Configure organization settings

**Execution Steps:**
1. Navigate to Settings > Organization
2. Update settings:
   - UI Mode: "advanced"
   - Auto-invoice on complete: enabled
   - Auto-send WhatsApp: enabled
   - Voice AI threshold: 0.7
3. Save settings

**Success Benchmarks:**
- [ ] Settings saved to database
- [ ] Changes reflected immediately
- [ ] Feature flags applied

**Verification Query:**
```sql
SELECT settings FROM organizations WHERE id = ?;
```

---

## 8. Phase 6: WhatsApp Integration Tests

### TEST-WA-001: Template Message Sending

**Scenario:** Send job confirmation via WhatsApp

**Prerequisites:**
- WhatsApp Business API configured
- Template "job_confirmation" approved by Meta

**Execution Steps:**
1. Create and schedule a job
2. Verify WhatsApp notification sent
3. Check customer's phone for message
4. Verify message content matches template

**Success Benchmarks:**
- [ ] Message queued within 2 seconds
- [ ] Message delivered within 10 seconds
- [ ] Template variables populated correctly
- [ ] Delivery status tracked (sent → delivered → read)

---

### TEST-WA-002: Inbound Message Handling

**Scenario:** Customer sends WhatsApp message

**Execution Steps:**
1. Send WhatsApp message to business number: "Hola, necesito un plomero"
2. Verify message received in system
3. Verify customer matched or created
4. Verify message appears in conversation thread

**Success Benchmarks:**
- [ ] Webhook received
- [ ] Message stored in database
- [ ] Customer linked (or created if new)
- [ ] Notification sent to dispatcher

---

### TEST-WA-003: Rate Limiting

**Scenario:** WhatsApp rate limit handling

**Execution Steps:**
1. Send 50 messages in rapid succession
2. Verify rate limit kicks in at 50/min
3. Verify messages queued, not rejected
4. Verify messages sent after window resets

**Success Benchmarks:**
- [ ] Internal rate limit: 50/min per org
- [ ] Messages queued when limit hit
- [ ] No messages dropped
- [ ] Resume sending after 1 minute

---

### TEST-WA-004: SMS Fallback

**Scenario:** WhatsApp fails, fallback to SMS for critical messages

**Execution Steps:**
1. Disable WhatsApp capability temporarily
2. Complete a job (triggers payment notification)
3. Verify SMS sent instead of WhatsApp
4. Check message_status = 'fallback_sms'

**Success Benchmarks:**
- [ ] Only critical messages fallback to SMS
- [ ] Non-critical messages queued for later
- [ ] SMS content is condensed version
- [ ] Status tracked correctly

**Critical Messages (Always Fallback):**
- job_confirmation
- tech_en_route
- payment_received
- invoice_sent

---

## 9. Phase 7: Mobile Technician App Tests

### TEST-MOB-001: Login & Sync

**Scenario:** Technician logs in and syncs jobs

**Execution Steps:**
1. Install/open mobile app
2. Enter phone: +5491155552001
3. Enter OTP
4. Verify initial sync completes
5. Verify today's jobs displayed

**Success Benchmarks:**
- [ ] Login completes in < 10 seconds
- [ ] Initial sync downloads assigned jobs
- [ ] Jobs display correctly
- [ ] App usable immediately

---

### TEST-MOB-002: Job Status Updates

**Scenario:** Update job status from mobile

**Execution Steps:**
1. Select a scheduled job
2. Tap "En Camino"
3. Verify status changes (local + server)
4. Tap "Arrived" (working)
5. Verify timestamp recorded

**Success Benchmarks:**
- [ ] Status updates in < 2 seconds
- [ ] WhatsApp notification sent to customer
- [ ] GPS location captured (if enabled)
- [ ] Sync completes successfully

---

### TEST-MOB-003: Job Completion Flow

**Scenario:** Complete a job with photos and signature

**Execution Steps:**
1. Select a job in "working" status
2. Tap "Complete Job"
3. Take 3 photos (before, during, after)
4. Capture customer signature
5. Add notes: "Replaced faucet, tested OK"
6. Tap "Confirm Completion"

**Success Benchmarks:**
- [ ] Minimum 1 photo required
- [ ] Photos compressed to < 500KB each
- [ ] Signature captured and stored
- [ ] Job status → completed
- [ ] Auto-invoice triggered (if enabled)
- [ ] If offline: queued for sync

---

### TEST-MOB-004: Offline Operation

**Scenario:** Work offline, then sync

**Execution Steps:**
1. Enable airplane mode on device
2. Verify "Offline" banner appears
3. Update job status to "working"
4. Complete job with photos
5. Disable airplane mode
6. Verify sync completes

**Success Benchmarks:**
- [ ] Offline indicator visible
- [ ] Status changes saved locally
- [ ] Photos saved to local storage
- [ ] Queue shows pending operations
- [ ] Sync completes within 30 seconds of reconnection
- [ ] Server data matches mobile data

---

### TEST-MOB-005: Conflict Resolution

**Scenario:** Dispatcher and technician edit simultaneously

**Execution Steps:**
1. Technician goes offline
2. Technician marks job "completed" at 10:15
3. Dispatcher cancels same job at 10:00 (while tech offline)
4. Technician comes online at 10:30
5. Verify conflict detected
6. Resolve conflict via UI

**Success Benchmarks:**
- [ ] Conflict detected (completed vs cancelled)
- [ ] Conflict UI displays both versions
- [ ] User can choose which to keep
- [ ] Resolution synced to server
- [ ] Audit log captures conflict resolution

---

### TEST-MOB-006: Performance Metrics

**Scenario:** Measure app performance on target device

**Target Device:** Samsung Galaxy A10 or equivalent

**Metrics to Capture:**
- [ ] Cold start: < 5 seconds
- [ ] Job list load (200 items): < 1.5 seconds
- [ ] Photo capture to queue: < 500ms
- [ ] Memory usage: < 150MB
- [ ] Bundle size: < 5MB compressed

---

## 10. Phase 8: Voice AI Processing Tests

### TEST-VOICE-001: High Confidence Auto-Create

**Scenario:** Voice message creates job automatically

**Execution Steps:**
1. Send voice message to WhatsApp number:
   "Hola, soy María García. Tengo una pérdida de agua en la cocina. Vivo en Belgrano, Cabildo 2500. Pueden venir mañana a la mañana?"
2. Wait for processing (< 30 seconds)
3. Verify job created automatically
4. Check confidence scores

**Success Benchmarks:**
- [ ] Transcription confidence: > 0.9
- [ ] Extraction confidence: > 0.7
- [ ] Job auto-created
- [ ] Customer matched or created
- [ ] Confirmation WhatsApp sent

**Expected Extraction:**
```json
{
  "customerName": {"value": "María García", "confidence": 0.95},
  "address": {"value": "Cabildo 2500, Belgrano", "confidence": 0.92},
  "problemDescription": {"value": "pérdida de agua en la cocina", "confidence": 0.98},
  "preferredTime": {"value": "mañana mañana", "confidence": 0.88}
}
```

---

### TEST-VOICE-002: Low Confidence Human Review

**Scenario:** Voice message requires human review

**Execution Steps:**
1. Send mumbled/unclear voice message
2. Verify message queued for review
3. Check dispatcher inbox
4. Review and correct extraction
5. Approve job creation

**Success Benchmarks:**
- [ ] Low confidence detected (< 0.7)
- [ ] Message appears in review queue
- [ ] Audio playback works
- [ ] Transcript displayed
- [ ] AI extraction shown (editable)
- [ ] Manual correction saved
- [ ] Job created after approval

---

### TEST-VOICE-003: Very Low Confidence Rejection

**Scenario:** Unintelligible voice message

**Execution Steps:**
1. Send very poor quality voice (background noise, etc.)
2. Verify processing fails gracefully
3. Check customer receives "please resend" message

**Success Benchmarks:**
- [ ] Confidence < 0.3 detected
- [ ] No job created
- [ ] No review queue item
- [ ] Customer notified: "No pudimos entender. ¿Podés enviarlo de nuevo?"

---

### TEST-VOICE-004: Argentine Spanish Handling

**Scenario:** Handle lunfardo and local expressions

**Test Phrases:**
- "Che, se me rompió la canilla del baño" → "canilla" = faucet
- "Tengo un quilombo con el aire" → "quilombo" = problem, "aire" = AC
- "Vivo en Once" → "Once" = neighborhood in Buenos Aires

**Success Benchmarks:**
- [ ] "canilla" extracted, not "tap" or "faucet"
- [ ] Service type: "aire_acondicionado" from "aire"
- [ ] Neighborhood recognized from local names

---

## 11. Phase 9: Observability & Hardening Tests

### TEST-OBS-001: Health Check Endpoints

**Scenario:** Verify health check endpoints

**Execution Steps:**
1. GET /api/health → Basic health
2. GET /api/health/ready → Readiness (DB, Redis)
3. GET /api/health/live → Liveness (all dependencies)

**Success Benchmarks:**
- [ ] /health returns 200 + uptime
- [ ] /health/ready checks database connection
- [ ] /health/ready checks Redis connection
- [ ] /health/live checks AFIP (ping)
- [ ] /health/live checks WhatsApp (ping)
- [ ] /health/live checks MercadoPago (ping)

---

### TEST-OBS-002: Queue Status Dashboard

**Scenario:** View queue health in admin panel

**Execution Steps:**
1. Navigate to Admin > Queues
2. Verify queue stats displayed
3. Check DLQ items
4. Retry a failed job manually

**Success Benchmarks:**
- [ ] All 5 queues displayed
- [ ] Pending count accurate
- [ ] Failed count accurate
- [ ] DLQ items listed
- [ ] Manual retry works

---

### TEST-OBS-003: Panic Mode Activation

**Scenario:** Test automatic panic mode

**Execution Steps:**
1. Simulate 5 consecutive AFIP failures
2. Verify circuit breaker opens
3. Verify panic mode activated
4. Verify alerts sent
5. Verify fallback behavior (invoices saved as drafts)

**Success Benchmarks:**
- [ ] Circuit breaker opens after 5 failures
- [ ] Panic mode activates after 15 min open
- [ ] Admin alerted (Slack/email)
- [ ] New invoices saved as drafts
- [ ] Recovery happens when service restored

---

### TEST-OBS-004: Rate Limiting

**Scenario:** Verify API rate limiting

**Execution Steps:**
1. Make 100 API requests in 1 minute
2. Verify rate limit triggered
3. Verify 429 response returned
4. Wait for window reset
5. Verify requests work again

**Success Benchmarks:**
- [ ] 100 req/min per organization
- [ ] 429 returned with Retry-After header
- [ ] No requests lost, just delayed
- [ ] Sliding window works correctly

---

### TEST-OBS-005: Audit Logging

**Scenario:** Verify audit trail

**Execution Steps:**
1. Create a job
2. Update job status
3. Create invoice
4. Complete payment
5. Query audit logs for all actions

**Success Benchmarks:**
- [ ] All actions logged
- [ ] User ID captured
- [ ] Timestamp captured
- [ ] Old/new values captured
- [ ] Hash chain intact

**Verification Query:**
```sql
SELECT action, entity_type, entity_id, old_data, new_data, created_at
FROM audit_logs
WHERE org_id = ?
ORDER BY created_at DESC LIMIT 20;
```

---

## 12. End-to-End Workflow Tests

### E2E-001: Complete Customer Journey

**Scenario:** Full flow from customer contact to payment

**Execution Steps:**
1. Customer sends WhatsApp voice message
2. Voice AI creates job automatically
3. Dispatcher reviews and assigns technician
4. Technician receives push notification
5. Technician marks "en_camino"
6. Customer receives "technician on the way" notification
7. Technician arrives and marks "working"
8. Technician completes job with photos/signature
9. Invoice auto-created and CAE requested
10. Invoice sent to customer via WhatsApp
11. Customer pays via MercadoPago link
12. Payment confirmation sent to customer

**Success Benchmarks:**
- [ ] Total time voice → job: < 1 minute
- [ ] All status notifications sent
- [ ] CAE received from AFIP
- [ ] PDF generated correctly
- [ ] Payment processed
- [ ] All audit logs present

**Duration Target:** End-to-end < 30 minutes (excluding actual work time)

---

### E2E-002: Offline Technician Complete Flow

**Scenario:** Technician works entirely offline

**Execution Steps:**
1. Technician syncs in morning (online)
2. Goes to location (offline)
3. Updates status: en_camino → working
4. Completes job with photos
5. Comes back online
6. Sync completes
7. Invoice created and sent

**Success Benchmarks:**
- [ ] All offline operations queued
- [ ] No data lost
- [ ] Sync resolves correctly
- [ ] Invoice created after sync
- [ ] Customer notified after sync

---

### E2E-003: Multi-Service Failure Recovery

**Scenario:** AFIP and WhatsApp fail simultaneously

**Execution Steps:**
1. Complete a job while AFIP and WhatsApp are down
2. Verify invoice saved as draft
3. Verify notifications queued (not failed)
4. Restore services
5. Verify backlog processed

**Success Benchmarks:**
- [ ] Job completion not blocked
- [ ] Invoice queued for CAE
- [ ] Notifications queued (not sent via SMS unless critical)
- [ ] Recovery processes all queued items
- [ ] No user intervention required

---

## 13. Success Metrics Summary

### Launch Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Signup to first job | < 2 minutes | Time from phone entry to job saved |
| Voice AI accuracy | ≥ 70% auto-create | % of voice messages that auto-create jobs |
| Mobile cold start | < 4 seconds | Samsung A10 or equivalent |
| Duplicate invoices | 0 | Count of duplicate invoice numbers |
| API response time | < 200ms (p95) | Measured via monitoring |
| System uptime | 99.5% | Monthly availability |

### Test Pass Criteria

| Category | Pass Threshold |
|----------|----------------|
| Auth Tests | 100% |
| Customer Tests | 100% |
| Job Tests | 100% |
| Invoice Tests | 100% |
| AFIP Tests | 95% (homo environment may have issues) |
| MercadoPago Tests | 100% |
| WhatsApp Tests | 95% (depends on Meta API) |
| Mobile Tests | 100% |
| Voice AI Tests | 90% |
| Observability Tests | 100% |
| E2E Tests | 100% |

### Quality Gates

Before production deployment:
- [ ] All critical path tests pass
- [ ] No P1/P2 bugs outstanding
- [ ] Performance budgets met
- [ ] Security review completed
- [ ] Load test passed (10K concurrent users simulated)

---

## Appendix: SQL Verification Queries

### Full Data Check Query

```sql
-- Organization and users
SELECT
  o.id as org_id,
  o.name as org_name,
  o.cuit,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT c.id) as customer_count,
  COUNT(DISTINCT j.id) as job_count,
  COUNT(DISTINCT i.id) as invoice_count,
  COUNT(DISTINCT p.id) as payment_count
FROM organizations o
LEFT JOIN users u ON u.org_id = o.id
LEFT JOIN customers c ON c.org_id = o.id
LEFT JOIN jobs j ON j.org_id = o.id
LEFT JOIN invoices i ON i.org_id = o.id
LEFT JOIN payments p ON p.org_id = o.id
GROUP BY o.id, o.name, o.cuit;
```

### Job Status Distribution

```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM jobs
WHERE org_id = ?
GROUP BY status
ORDER BY count DESC;
```

### Invoice Health Check

```sql
-- Check for any sequence gaps
SELECT
  invoice_number,
  LAG(invoice_number) OVER (ORDER BY invoice_number) as prev_number,
  invoice_number - LAG(invoice_number) OVER (ORDER BY invoice_number) as gap
FROM invoices
WHERE org_id = ? AND punto_venta = ?
HAVING gap > 1;
```

---

*Document generated for CampoTech comprehensive testing. Update version number after each test cycle.*
