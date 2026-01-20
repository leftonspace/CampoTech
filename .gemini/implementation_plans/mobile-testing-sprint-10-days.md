# CampoTech Mobile App - 10-Day Testing Sprint Implementation Plan

## Overview

**Goal:** Complete testing and bug fixing of the mobile app (apps/mobile) integrated with the web backend (apps/web) over 10 days, without publishing to app stores.

**Strategy:** Use EAS Preview Build + OTA Updates for rapid testing and iteration.

---

## Phase 1: Environment Setup (Day 1 - Morning)

### 1.1 Install EAS CLI
```bash
# Option A: Using npm (recommended for global CLI tools)
npm install -g eas-cli

# Option B: Using pnpm
pnpm add -g eas-cli
```

### 1.2 Login to Expo Account
```bash
eas login
# Enter your Expo account credentials
# Create account at https://expo.dev if needed
```

### 1.3 Configure EAS for the Project
```bash
cd d:\projects\CampoTech\apps\mobile
eas build:configure
```
This creates `eas.json` with build profiles.

### 1.4 Update eas.json Configuration
Ensure the following profiles exist:
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### 1.5 Configure API URL for Production
Update `apps/mobile/lib/api/client.ts`:
```typescript
// For preview/production builds, use your deployed backend
const PROD_API_URL = 'https://your-production-domain.com/api';
const DEV_API_URL = 'http://192.168.0.19:3000/api';

// Use __DEV__ to switch automatically
export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
```

---

## Phase 2: First Build (Day 1 - Afternoon)

### 2.1 Restore Native WatermelonDB
Update `apps/mobile/metro.config.js` to use real database on native:
- Remove the global WatermelonDB redirect
- Only redirect for web platform
- Native builds will use real SQLite

### 2.2 Build Preview APK
```bash
cd apps/mobile
eas build --profile preview --platform android
```
**Note:** First build takes 15-30 minutes. Subsequent builds are faster.

### 2.3 Download and Install APK
- EAS provides a download link when build completes
- Install on test phones (enable "Unknown Sources" in Android settings)
- You can also use QR code to download directly on phone

---

## Phase 3: Testing Infrastructure (Day 1 - End)

### 3.1 Test Accounts Setup
Create test accounts in the database for different roles:
| Role | Phone Number | Purpose |
|------|-------------|---------|
| OWNER | +54 9 351 600 0001 | Full access testing |
| TECHNICIAN 1 | +54 9 351 600 0002 | Field technician testing |
| TECHNICIAN 2 | +54 9 351 600 0003 | Multi-technician scenarios |
| DISPATCHER | +54 9 351 600 0004 | Dispatch operations |

### 3.2 Test Data Setup  
Ensure the database has:
- [ ] Jobs for today (various statuses)
- [ ] Jobs for the week (calendar testing)
- [ ] Customers with addresses (map testing)
- [ ] Price book items (materials/labor)
- [ ] Sample photos attached to jobs

---

## Phase 4: Feature Testing Checklist (Days 2-9)

### 4.1 Authentication & Roles (Day 2)
- [ ] Login with OTP (each role)
- [ ] Session persistence (close app, reopen)
- [ ] Role-based tab visibility
- [ ] Logout functionality
- [ ] Token refresh works
- [ ] Profile page shows correct user info

### 4.2 Today's Jobs Screen (Day 2-3)
- [ ] Jobs grouped correctly (Active, Upcoming, Completed)
- [ ] Pull-to-refresh sync
- [ ] Tap job opens details
- [ ] Stats show correct counts
- [ ] Route navigation button works
- [ ] Empty state displays properly

### 4.3 Job Details & Updates (Day 3-4)
- [ ] View job information
- [ ] Update job status (workflow)
  - [ ] Pending → En Camino
  - [ ] En Camino → Working
  - [ ] Working → Completed
- [ ] Add materials to job
- [ ] Add labor hours
- [ ] Customer information visible
- [ ] Notes/description editable

### 4.4 Maps & Location (Day 4-5)
- [ ] Map displays on job details
- [ ] Customer location pin correct
- [ ] "Navigate" opens Google Maps/Waze
- [ ] Technician location tracking
- [ ] Route optimization display
- [ ] Location permissions request works

### 4.5 Camera & Photos (Day 5)
- [ ] Take photo from job
- [ ] Photo saved to job
- [ ] View photos gallery
- [ ] Delete photo
- [ ] Photos sync to server

### 4.6 Offline Functionality (Day 6)
- [ ] Enable airplane mode
- [ ] View cached jobs
- [ ] Update job status offline
- [ ] Queue shows pending changes
- [ ] Reconnect → changes sync
- [ ] Conflict resolution works

### 4.7 Calendar/Schedule View (Day 7)
- [ ] Week view displays jobs
- [ ] Day selection works
- [ ] Jobs for selected day shown
- [ ] Navigate between weeks
- [ ] Correct timezone (Argentina)

### 4.8 Team View (Day 7)
- [ ] (Owner/Dispatcher) See team members
- [ ] Technician availability status
- [ ] Assign technician to job
- [ ] View technician's workload

### 4.9 Chat/Messages (Day 8)
- [ ] View chat list
- [ ] Open conversation
- [ ] Send message
- [ ] Receive message (real-time)
- [ ] Push notifications work

### 4.10 Voice Features (Day 8)
- [ ] Voice recording works
- [ ] Transcription displays
- [ ] AI extracts job info
- [ ] Create job from voice

### 4.11 Reports & Completion (Day 9)
- [ ] Generate job completion report
- [ ] PDF generation works
- [ ] Share/download PDF
- [ ] Customer signature capture
- [ ] Send report via WhatsApp

### 4.12 Settings & Profile (Day 9)
- [ ] Digital badge displays
- [ ] Sync status accurate
- [ ] Advanced mode toggle
- [ ] Notifications settings
- [ ] GPS tracking toggle

---

## Phase 5: Bug Fix Workflow (Ongoing)

### Daily Iteration Cycle
```
1. Test feature on phone
2. Find bug → Document in issue tracker
3. Fix code on laptop
4. Push update:
   eas update --branch preview --message "Fix: description"
5. App updates automatically on phones
6. Verify fix
```

### OTA Update Commands
```bash
# Push update to preview branch
eas update --branch preview

# Push with message
eas update --branch preview --message "Fixed map markers"

# Check update status
eas update:list
```

---

## Phase 6: Final Verification (Day 10)

### 6.1 Full Regression Test
Run through entire checklist again with fresh test data.

### 6.2 Performance Check
- App startup time < 3 seconds
- Smooth scrolling on job lists
- Map loads within 2 seconds
- Photo capture is responsive

### 6.3 Error Handling
- No crash on network loss
- Graceful error messages
- Retry mechanisms work

### 6.4 Multi-Device Test
- Test with 2+ phones simultaneously
- Same job updated by different users
- Real-time sync between devices

---

## Required Configuration Files

### apps/mobile/eas.json
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "gradleCommand": ":app:assembleDebug"
      },
      "ios": {
        "buildConfiguration": "Debug"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  },
  "submit": {
    "production": {}
  }
}
```

### apps/mobile/app.json additions
Ensure these fields are set:
```json
{
  "expo": {
    "name": "CampoTech",
    "slug": "campotech-mobile",
    "version": "1.0.0",
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/[your-project-id]"
    },
    "android": {
      "package": "com.campotech.mobile"
    }
  }
}
```

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
eas build --profile preview --platform android --clear-cache
```

### OTA Update Not Appearing
```bash
# Force app to check for updates
# In app, shake phone → "Reload" or restart app
```

### Location Not Working
- Ensure location permissions granted
- Check Android location settings (High Accuracy mode)

### Map Not Displaying
- Verify Google Maps API key is set in app.json
- Check API key has correct restrictions

---

## Success Criteria

By Day 10:
- [ ] All core features working on mobile
- [ ] Sync with web backend verified
- [ ] All roles (Owner, Technician, Dispatcher) tested
- [ ] Offline mode stable
- [ ] Location/maps functional
- [ ] Camera/photos working
- [ ] No critical bugs remaining
- [ ] Ready for production build

---

## Next Steps After Testing

1. **Production Build:** `eas build --profile production --platform android`
2. **App Store Submission:** Use EAS Submit or manual upload
3. **iOS Testing:** Similar process with `--platform ios` (requires Apple Developer account)
