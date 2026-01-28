# Fix Plan: settings/team Deprecation & Cleanup

> **Created:** January 25, 2026
> 
> **Status:** Ready for implementation
> 
> **Complexity:** Medium (affects multiple files)

---

## 📋 Summary

The `settings/team` page is an **older, simpler version** of team management that should be removed. The main `team/` page has all the functionality needed, making `settings/team` redundant.

### Comparison

| Feature | `team/page.tsx` | `settings/team/page.tsx` |
|---------|-----------------|--------------------------|
| Lines of code | 2,507 | 922 |
| Employee list | ✅ | ✅ |
| Add member modal | ✅ Modern | ⚠️ Old "Nuevo miembro" |
| Edit member modal | ✅ Modern | ⚠️ Old "Editar miembro" |
| Delete member | ✅ | ✅ |
| Availability calendar | ✅ | ❌ |
| Live status | ✅ | ❌ |
| Team stats | ✅ | ❌ |
| Pending verifications | ✅ | ✅ |
| Driver license management | ✅ | ❌ |

**Verdict:** Keep `team/`, delete `settings/team/`

---

## 🔍 Files That Reference `settings/team`

These files link TO `settings/team` and need to be updated:

### 1. Settings Hub (`app/dashboard/settings/page.tsx`)
**Line 88:** Links to `/dashboard/settings/team`
```tsx
{
  title: 'Equipo',
  description: 'Gestión de usuarios y roles',
  href: '/dashboard/settings/team',  // ← Change to /dashboard/team
  icon: Users,
  adminOnly: true,
},
```
**Action:** Change href to `/dashboard/team`

---

### 2. Main Dashboard (`app/dashboard/page.tsx`)
**Line 578:** Has a team link
```tsx
href="/dashboard/settings/team"
```
**Action:** Change to `/dashboard/team`

---

### 3. New Job Page (`app/dashboard/jobs/new/page.tsx`)
**Lines 445, 1096:** Opens settings/team for scheduling
```tsx
window.open(`/dashboard/settings/team?employee=${warning.details.technicianId}&tab=schedule`, '_blank');
...
href="/dashboard/settings/team"
```
**Action:** Change to `/dashboard/team` (note: may need to update query params)

---

### 4. NewJobModal Component (`components/jobs/NewJobModal.tsx`)
**Line 551:** Opens for schedule
```tsx
window.open(`/dashboard/settings/team?employee=${warning.details.technicianId}&tab=schedule`, '_blank');
```
**Action:** Change to `/dashboard/team`

---

### 5. EditJobModal Component (`components/jobs/EditJobModal.tsx`)
**Line 723:** Same pattern
```tsx
window.open(`/dashboard/settings/team?employee=${warning.details.technicianId}&tab=schedule`, '_blank');
```
**Action:** Change to `/dashboard/team`

---

### 6. NotificationCenter Component (`components/notifications/NotificationCenter.tsx`)
**Line 219:** Notification link
```tsx
user: `/dashboard/settings/team`,
```
**Action:** Change to `/dashboard/team`

---

### 7. Dispatch Page (`app/dashboard/dispatch/page.tsx`)
**Line 315:** Link to team
```tsx
href="/dashboard/settings/team"
```
**Action:** Change to `/dashboard/team`

---

### 8. Employee Verification Notifications Service (`lib/services/employee-verification-notifications.ts`)
**Line 388:** Action URL in notifications
```tsx
const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com'}/dashboard/settings/team`;
```
**Action:** Change to `/dashboard/team`

---

### 9. Job Assign API Route (`app/api/jobs/[id]/assign/route.ts`)
**Line 66:** Verification link
```tsx
verificationLink: `/dashboard/settings/team?employee=${userId}&tab=verification`,
```
**Action:** Change to `/dashboard/team?employee=${userId}` (verify tab param works)

---

## 🗑️ Files to DELETE

| File/Folder | Size | Notes |
|-------------|------|-------|
| `app/dashboard/settings/team/` | 922 lines | Entire folder |

Contents:
- `app/dashboard/settings/team/page.tsx` - The old page with outdated modals

---

## ⚙️ Query Parameter Compatibility

The old `settings/team` page used these query params:
- `?employee=<id>` - Select an employee
- `?tab=schedule` - Open schedule tab
- `?tab=verification` - Open verification tab

**Check:** Ensure `team/page.tsx` handles these query params correctly (it should already, but verify).

---

## 📍 Vehicle Schedule Page - DELETED ✅

**Status:** DELETED on January 26, 2026

The `/dashboard/team/[id]/vehicle-schedule` page has been intentionally removed. The functionality to assign drivers to vehicles permanently is already available in the existing team tabs, making this dedicated page redundant.

**What was deleted:**
- `app/dashboard/team/[id]/vehicle-schedule/page.tsx` - The schedule management page
- `app/api/scheduling/vehicle-assignment/route.ts` - The API route for schedule CRUD operations

**What was kept:**
- `lib/services/vehicle-schedule.service.ts` - The service (still used by job modals for vehicle suggestions)
- `app/api/scheduling/vehicle-for-job/route.ts` - The API for getting vehicle assignments (used by NewJobModal, EditJobModal)

---

## 📝 Implementation Checklist

### Phase 1: Update References (do first) ✅ COMPLETED
- [x] `app/dashboard/settings/page.tsx` - Changed href
- [x] `app/dashboard/page.tsx` - Changed href
- [x] `app/dashboard/jobs/new/page.tsx` - Changed 2 references
- [x] `components/jobs/NewJobModal.tsx` - Changed href
- [x] `components/jobs/EditJobModal.tsx` - Changed href
- [x] `components/notifications/NotificationCenter.tsx` - Changed href
- [x] `app/dashboard/dispatch/page.tsx` - Changed href
- [x] `lib/services/employee-verification-notifications.ts` - Changed URL
- [x] `app/api/jobs/[id]/assign/route.ts` - Changed URL

### Phase 2: Delete Old Page ✅ COMPLETED
- [x] Delete entire `app/dashboard/settings/team/` folder

### Phase 3: Delete Vehicle Schedule Page ✅ COMPLETED (January 26, 2026)
- [x] Delete `app/dashboard/team/[id]/vehicle-schedule/` folder - Redundant functionality
- [x] Delete `app/api/scheduling/vehicle-assignment/` folder - Only served the deleted page

### Phase 4: Test
- [ ] Test all updated links work correctly
- [ ] Test query params (employee, tab) work on team page
- [ ] Test vehicle schedule access from modal
- [ ] Verify no 404s in the app

---

## 🚨 Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Broken links in emails | Medium | Update email service last |
| Users bookmarked old URL | Low | Consider redirect in Next.js |
| Query params not working | Low | Test thoroughly |

### Optional: Add Redirect

In `next.config.mjs`, add:
```js
async redirects() {
  return [
    {
      source: '/dashboard/settings/team',
      destination: '/dashboard/team',
      permanent: true,
    },
  ];
}
```

This ensures any old bookmarks or links still work.

---

## ⏱️ Estimated Time

| Task | Time |
|------|------|
| Update 9 references | 10 min |
| Add vehicle button | 5 min |
| Delete old folder | 1 min |
| Add redirect (optional) | 2 min |
| Testing | 10 min |
| **Total** | ~30 min |
