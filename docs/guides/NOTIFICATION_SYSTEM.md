# CampoTech Notification System

This document explains how notifications work in CampoTech and how to add, modify, or remove notification types.

## Table of Contents
1. [Overview](#overview)
2. [Notification Categories](#notification-categories)
3. [File Locations](#file-locations)
4. [How to Add a New Notification](#how-to-add-a-new-notification)
5. [How to Remove a Notification](#how-to-remove-a-notification)
6. [Delivery Channels](#delivery-channels)
7. [Complete Notification Reference](#complete-notification-reference)

---

## Overview

CampoTech uses a multi-channel notification system that delivers notifications via:
- **Web** (in-app bell icon)
- **Push** (mobile push notifications)
- **WhatsApp** (preferred for Argentina)
- **Email**
- **SMS** (for critical alerts only)

Notifications are stored in the database and shown in the notification center (bell icon in the dashboard header).

---

## Notification Categories

### 1. Job Notifications
Triggered by job lifecycle events (created, assigned, completed, etc.)

### 2. Verification Notifications
Triggered by document verification events (approved, rejected, expiring, etc.)

### 3. Subscription Notifications
Triggered by billing/subscription events (trial expiring, payment failed, etc.)

### 4. System Notifications
General system alerts and custom notifications

---

## File Locations

### Core Notification Files

| File | Purpose |
|------|---------|
| `src/modules/notifications/notification.service.ts` | Main notification service - handles delivery to all channels |
| `apps/web/components/notifications/NotificationCenter.tsx` | Bell icon component in dashboard header |
| `apps/web/lib/notifications/verification-notifications.ts` | Verification-related notification helpers |
| `apps/web/lib/notifications/subscription-notifications.ts` | Subscription-related notification helpers |
| `src/workers/notifications/job-notification.worker.ts` | Job notification processing worker |

### API Routes

| File | Purpose |
|------|---------|
| `apps/web/app/api/notifications/route.ts` | GET notifications list |
| `apps/web/app/api/notifications/read/route.ts` | Mark notifications as read |
| `apps/web/app/api/notifications/read-all/route.ts` | Mark all as read |
| `apps/web/app/api/notifications/preferences/route.ts` | User notification preferences |

### Settings Pages

| File | Purpose |
|------|---------|
| `apps/web/app/dashboard/settings/notifications/page.tsx` | User notification preferences UI |

---

## How to Add a New Notification

### Step 1: Define the notification type

Open `src/modules/notifications/notification.service.ts` and add your new type:

```typescript
// Find this type definition (around line 19)
export type NotificationEventType =
  | 'job_assigned'
  | 'job_updated'
  // ... existing types ...
  | 'your_new_notification_type';  // <-- Add your new type here
```

### Step 2: Set channel restrictions (optional)

In the same file, add channel preferences for your notification:

```typescript
// Find CHANNEL_RESTRICTIONS (around line 71)
const CHANNEL_RESTRICTIONS: Record<NotificationEventType, ChannelRestriction> = {
  // ... existing entries ...
  your_new_notification_type: 'whatsapp_preferred',  // or 'any' or 'sms_only'
};
```

### Step 3: Create a helper function

For verification notifications, add to `apps/web/lib/notifications/verification-notifications.ts`:

```typescript
/**
 * Create your new notification
 */
export async function notifyYourNewEvent(
  organizationId: string,
  userId: string,
  customData: string  // Add any custom parameters you need
): Promise<VerificationNotification> {
  return createVerificationNotification({
    organizationId,
    userId,
    type: 'your_new_notification_type',
    title: 'Your Notification Title',
    message: `Your message with ${customData}`,
    actionUrl: '/dashboard/relevant-page',  // Where clicking takes the user
    actionLabel: 'View Details',  // Button text
    severity: 'info',  // 'info' | 'warning' | 'error' | 'success'
    metadata: { customData },  // Any extra data to store
  });
}
```

For subscription notifications, add to `apps/web/lib/notifications/subscription-notifications.ts`:

```typescript
export async function notifyYourSubscriptionEvent(
  organizationId: string,
  userId: string,
  amount: number
): Promise<SubscriptionNotification> {
  return createSubscriptionNotification({
    organizationId,
    userId,
    type: 'your_new_type',
    title: 'Your Title',
    message: `Message with ${amount}`,
    actionUrl: '/dashboard/settings/subscription',
    actionLabel: 'Take Action',
    severity: 'warning',
    metadata: { amount },
  });
}
```

### Step 4: Trigger the notification

Call your helper function from wherever the event occurs:

```typescript
import { notifyYourNewEvent } from '@/lib/notifications/verification-notifications';

// In your business logic:
await notifyYourNewEvent(organizationId, userId, 'some data');
```

### Step 5: Add icon and color (optional)

To customize how the notification appears in the bell dropdown, edit `apps/web/components/notifications/NotificationCenter.tsx`:

```typescript
// Find EVENT_ICONS (around line 47)
const EVENT_ICONS: Record<string, React.ElementType> = {
  // ... existing icons ...
  your_new_notification_type: Bell,  // Import from lucide-react
};

// Find EVENT_COLORS (around line 64)
const EVENT_COLORS: Record<string, string> = {
  // ... existing colors ...
  your_new_notification_type: 'bg-blue-100 text-blue-600',
};
```

---

## How to Remove a Notification

### Option 1: Remove the trigger (recommended)

Find where the notification is sent and remove or comment out that code.

Example - to stop sending `job_completed` notifications:

```typescript
// In the job completion handler, remove or comment:
// await sendNotification({
//   eventType: 'job_completed',
//   ...
// });
```

### Option 2: Disable the notification type

In `src/modules/notifications/notification.service.ts`, you can add a check:

```typescript
// Add to the sendNotification function (around line 95)
const DISABLED_NOTIFICATIONS: NotificationEventType[] = [
  'job_completed',  // Add types you want to disable
];

if (DISABLED_NOTIFICATIONS.includes(eventType)) {
  return; // Skip sending
}
```

### Option 3: Remove from default preferences

Edit `src/modules/notifications/notification.service.ts`:

```typescript
// Find getDefaultPreferences() around line 363
function getDefaultPreferences(): NotificationPreferences {
  return {
    // ...
    eventPreferences: {
      // Remove or set to false:
      job_completed: { whatsapp: false, push: false, email: false, sms: false },
      // ...
    },
  };
}
```

---

## Delivery Channels

### Channel Priority (Argentine Market)

1. **WhatsApp** - Primary channel, most users have WhatsApp
2. **Push** - Mobile app notifications
3. **Web** - In-app notifications (always enabled)
4. **Email** - Secondary, for invoices and receipts
5. **SMS** - Only for OTP and critical alerts (expensive)

### Channel Restrictions

| Restriction | Behavior |
|-------------|----------|
| `whatsapp_preferred` | Sends via WhatsApp + Push, only email if explicitly enabled |
| `any` | Respects all user preferences |
| `sms_only` | Only sends via SMS (for OTP codes) |

---

## Complete Notification Reference

### Job Notifications

| Type | When Triggered | Default Channels |
|------|----------------|------------------|
| `job_created` | New job created | WhatsApp, Push |
| `job_assigned` | Job assigned to technician | WhatsApp, Push |
| `job_scheduled` | Job scheduled with date/time | WhatsApp, Push |
| `job_started` | Technician starts work | WhatsApp, Push |
| `job_completed` | Job marked complete | WhatsApp, Push |
| `job_cancelled` | Job cancelled | WhatsApp, Push |
| `job_rescheduled` | Job date changed | WhatsApp, Push |
| `tech_en_route` | Technician heading to location | WhatsApp, Push |
| `tech_arrived` | Technician arrived | WhatsApp, Push |
| `invoice_ready` | Invoice generated | WhatsApp, Email |
| `payment_received` | Payment received | WhatsApp, Push |

### Verification Notifications

| Type | When Triggered | Severity |
|------|----------------|----------|
| `document_expiring` | Document expires in X days | warning/error |
| `document_expired` | Document has expired | error |
| `document_approved` | Document verified | success |
| `document_rejected` | Document rejected | error |
| `verification_complete` | All docs approved | success |
| `verification_incomplete` | Pending documents | warning |
| `account_blocked` | Account blocked | error |
| `account_unblocked` | Account restored | success |
| `employee_doc_expiring` | Employee's doc expiring | warning |
| `employee_compliance_alert` | Employee verification issues | error |
| `employee_verified` | Employee completed verification | success |
| `employee_not_verified` | Employee needs to verify | warning |
| `afip_status_changed` | AFIP status changed | info/error |
| `badge_earned` | New badge earned | success |

### Subscription Notifications

| Type | When Triggered | Severity |
|------|----------------|----------|
| `trial_expiring` | Trial ends in X days | warning/error |
| `trial_expired` | Trial period ended | error |
| `payment_successful` | Payment processed | success |
| `payment_failed` | Payment failed | error |
| `payment_pending` | Awaiting payment | warning |
| `subscription_activated` | Plan activated | success |
| `subscription_cancelled` | Subscription cancelled | warning |
| `subscription_renewed` | Auto-renewed | success |
| `subscription_paused` | Subscription paused | info |
| `plan_upgraded` | Upgraded to higher tier | success |
| `plan_downgraded` | Downgraded to lower tier | info |
| `grace_period_started` | Payment grace period began | warning |
| `grace_period_ending` | Grace period ending soon | error |
| `account_suspended` | Account suspended | error |

### System Notifications

| Type | When Triggered | Default Channels |
|------|----------------|------------------|
| `system_alert` | Critical system message | All channels |
| `custom` | Custom notification | User preference |
| `team_member_added` | New team member | WhatsApp |
| `team_member_removed` | Team member removed | WhatsApp |
| `schedule_change` | Schedule modified | WhatsApp, Push |

---

## Testing Notifications

To test a notification manually, you can use the API or create a test script:

```typescript
// Create a test file: scripts/test-notification.ts
import { sendNotification } from '../src/modules/notifications/notification.service';

async function testNotification() {
  await sendNotification({
    eventType: 'system_alert',
    userId: 'your-user-id',
    organizationId: 'your-org-id',
    title: 'Test Notification',
    body: 'This is a test notification',
  });
}

testNotification();
```

---

## Troubleshooting

### Notifications not appearing in bell icon
1. Check if WebSocket connection is active (bell icon vs bell-off icon)
2. Verify the notification was created in the database
3. Check browser console for errors

### WhatsApp notifications not sending
1. Verify WhatsApp is configured for the organization
2. Check the user has a valid phone number
3. Review logs in the notification worker

### Email notifications not sending
1. Check if email is enabled in user preferences
2. Verify email provider is configured
3. Check the notification queue status
