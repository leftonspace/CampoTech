---
description: Browser testing workflow with login credentials for CampoTech
---

# Browser Testing Workflow

## Login Credentials (ALWAYS USE THESE)

When testing CampoTech in the browser and you need to log in:

| Field | Value |
|-------|-------|
| **Phone Number** | `11 1234 5678` (Argentina +54) |
| **OTP Code** | `123456` |

**NEVER create new profiles or use different numbers.** Always use the fake admin profile above.

## Login Steps

1. Navigate to `http://localhost:3000`
2. If redirected to login, enter phone: `11 1234 5678`
3. When OTP is requested, enter: `123456`
4. Wait for redirect to dashboard

## Common Test URLs

- Dashboard: `http://localhost:3000/dashboard`
- Jobs: `http://localhost:3000/dashboard/jobs`
- Customers: `http://localhost:3000/dashboard/customers`
- Team: `http://localhost:3000/dashboard/team`
- Fleet: `http://localhost:3000/dashboard/fleet`

## Notes

- The dev server runs on port 3000
- OTP is mocked in development - always accepts `123456`
- The test account has OWNER role with full permissions
