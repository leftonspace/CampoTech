# CampoTech Quick Start Testing Guide

**Admin Account:** +18199685685

## Pre-Test Setup (5 minutes)

### Step 1: Verify Deployment

1. Open your Vercel deployment URL
2. You should see the login page
3. Check browser console for any errors

### Step 2: Create Admin Account

1. Go to login page
2. Enter phone: `+18199685685`
3. Click "Send OTP"
4. Enter the OTP you receive
5. Complete onboarding:
   - CUIT: `20-12345678-9`
   - Company Name: `CampoTech Test Org`

### Step 3: Seed Test Data

1. Go to Supabase Dashboard > SQL Editor
2. Open and run: `tests/seed/test-data-seed.sql`
3. Verify no errors in output
4. Check that test data appears in Tables view

---

## Quick Smoke Tests (15 minutes)

Run these tests first to verify basic functionality:

### Test 1: Authentication ✅/❌

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to app URL | Login page loads |
| 2 | Enter +18199685685 | Phone accepted |
| 3 | Click Send OTP | OTP sent (check phone) |
| 4 | Enter OTP | Login successful |
| 5 | Check dashboard | Dashboard displays |

**Pass Criteria:** All steps complete without errors

---

### Test 2: Customer List ✅/❌

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to Customers | List page loads |
| 2 | Verify 5 test customers | Juan, Maria, Pedro, Ana, Test Offline |
| 3 | Click on Juan Perez | Customer detail loads |
| 4 | Verify CUIT | 20-11111111-1 |

**Pass Criteria:** All test customers visible and accessible

---

### Test 3: Job List & Status ✅/❌

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to Jobs | List page loads |
| 2 | Verify 5 test jobs | Various statuses visible |
| 3 | Filter by "pending" | Only pending job shown |
| 4 | Filter by "scheduled" | Only scheduled job shown |
| 5 | Click on a job | Job detail loads |

**Pass Criteria:** Filtering works, detail pages load

---

### Test 4: Create New Job ✅/❌

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click "New Job" | Form loads |
| 2 | Select customer: Juan Perez | Customer selected |
| 3 | Enter title: "Test Job" | Text accepted |
| 4 | Select type: plomeria | Type selected |
| 5 | Set date: Tomorrow | Date set |
| 6 | Click Save | Job created, redirects to list |

**Pass Criteria:** Job appears in list with status "pending"

---

### Test 5: Job Status Update ✅/❌

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open test job | Detail page loads |
| 2 | Assign to Tech Carlos | Technician assigned |
| 3 | Status changes to "scheduled" | Status updated |
| 4 | Click "En Camino" | Status → en_camino |

**Pass Criteria:** Status transitions work correctly

---

## Feature-Specific Test Scenarios

### Scenario A: Complete Customer Journey (30 min)

**Goal:** Test end-to-end flow from job creation to invoice

```
1. Create new customer: "Test E2E Customer"
   Phone: +5491199990001

2. Create job for this customer:
   Title: "E2E Test - Bathroom Repair"
   Type: plomeria
   Priority: normal
   Schedule: Today + 2 hours

3. Assign to Tech Carlos

4. Update status: scheduled → en_camino → working

5. Complete job:
   - Click "Complete"
   - Upload test photo (or skip if mobile not available)
   - Add notes: "E2E test completed successfully"

6. Create invoice:
   - Verify line items
   - Add "Reparacion canilla" from price book
   - Check IVA calculation

7. If AFIP connected:
   - Request CAE
   - Verify CAE received
   - Download PDF

8. If MercadoPago connected:
   - Generate payment link
   - Open in incognito
   - Complete test payment
```

**Success Criteria:**
- [ ] Customer created
- [ ] Job created and visible
- [ ] Status transitions all work
- [ ] Invoice created with correct totals
- [ ] CAE received (if AFIP connected)
- [ ] Payment processed (if MP connected)

---

### Scenario B: AFIP Invoice Types (20 min)

**Goal:** Verify correct invoice types based on customer IVA condition

| Customer | IVA Condition | Expected Invoice Type |
|----------|---------------|----------------------|
| Juan Perez | responsable_inscripto | Factura A |
| Maria Garcia | monotributista | Factura C |
| Pedro Lopez | consumidor_final | Factura B |
| Ana Martinez | exento | Factura B |

**Test Steps for each:**
1. Create completed job for customer
2. Create invoice
3. Verify invoice type auto-selected
4. Verify IVA calculation correct

---

### Scenario C: Error Handling (15 min)

**Goal:** Verify system handles errors gracefully

| Test | Action | Expected |
|------|--------|----------|
| Duplicate phone | Create customer with existing phone | Error message, no duplicate |
| Invalid CUIT | Enter CUIT: 99-99999999-9 | Validation error |
| Invalid status | Try pending → completed | Transition blocked |
| Required field | Create job without title | Validation error |

---

### Scenario D: Settings Configuration (10 min)

**Goal:** Verify settings are saved and applied

1. Navigate to Settings > Organization
2. Toggle "Auto-invoice on complete" OFF
3. Save
4. Complete a job
5. Verify NO auto-invoice created
6. Toggle back ON
7. Complete another job
8. Verify auto-invoice IS created

---

## API Health Checks

Run these curl commands to verify API endpoints:

```bash
# Base URL (update with your deployment)
BASE_URL="https://your-app.vercel.app"

# Health check
curl -s "$BASE_URL/api/health" | jq .

# Auth check (should return 401)
curl -s "$BASE_URL/api/auth/me" | jq .

# With auth (replace TOKEN with actual JWT)
curl -s -H "Authorization: Bearer TOKEN" "$BASE_URL/api/customers" | jq .
```

---

## Database Verification Queries

Run in Supabase SQL Editor:

```sql
-- Count all entities for your org
SELECT
    (SELECT COUNT(*) FROM users WHERE org_id = o.id) as users,
    (SELECT COUNT(*) FROM customers WHERE org_id = o.id) as customers,
    (SELECT COUNT(*) FROM jobs WHERE org_id = o.id) as jobs,
    (SELECT COUNT(*) FROM invoices WHERE org_id = o.id) as invoices,
    (SELECT COUNT(*) FROM payments WHERE org_id = o.id) as payments
FROM organizations o
WHERE EXISTS (SELECT 1 FROM users WHERE org_id = o.id AND phone = '+18199685685');

-- Job status distribution
SELECT status, COUNT(*)
FROM jobs j
JOIN organizations o ON j.org_id = o.id
WHERE EXISTS (SELECT 1 FROM users WHERE org_id = o.id AND phone = '+18199685685')
GROUP BY status;

-- Recent activity
SELECT
    j.title,
    j.status,
    j.updated_at,
    u.full_name as technician
FROM jobs j
LEFT JOIN users u ON j.assigned_to = u.id
JOIN organizations o ON j.org_id = o.id
WHERE EXISTS (SELECT 1 FROM users WHERE org_id = o.id AND phone = '+18199685685')
ORDER BY j.updated_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Common Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| OTP not received | Phone format | Use international format: +18199685685 |
| Login fails | Session expired | Clear cookies, retry |
| Page not loading | Build error | Check Vercel logs |
| Data not appearing | Seed not run | Run SQL seed script |
| 500 errors | API crash | Check Vercel function logs |

### Debug Mode

Enable verbose logging:
1. In Supabase: Enable "Debug mode" in logs
2. In browser: Open DevTools > Network tab
3. In Vercel: Check Function Logs

### Reset Test Data

To start fresh:
```sql
-- WARNING: Deletes all data for your org!
DELETE FROM jobs WHERE org_id = (SELECT org_id FROM users WHERE phone = '+18199685685');
DELETE FROM customers WHERE org_id = (SELECT org_id FROM users WHERE phone = '+18199685685');
DELETE FROM invoices WHERE org_id = (SELECT org_id FROM users WHERE phone = '+18199685685');
-- Then re-run seed script
```

---

## Test Results Template

Copy and fill out after testing:

```
Date: ____________
Tester: ____________
Environment: ____________

SMOKE TESTS:
[ ] Authentication: PASS / FAIL
[ ] Customer List: PASS / FAIL
[ ] Job List: PASS / FAIL
[ ] Create Job: PASS / FAIL
[ ] Status Update: PASS / FAIL

FEATURES:
[ ] AFIP Integration: PASS / FAIL / NOT CONFIGURED
[ ] MercadoPago: PASS / FAIL / NOT CONFIGURED
[ ] WhatsApp: PASS / FAIL / NOT CONFIGURED
[ ] Voice AI: PASS / FAIL / NOT CONFIGURED

NOTES:
________________________________
________________________________
________________________________

BLOCKING ISSUES:
________________________________
________________________________
```

---

**Next Steps After Testing:**
1. Document any bugs found
2. Note performance observations
3. Review error logs
4. Plan fixes for failed tests
