# CampoTech - App Store Submission Guide

## Overview

This guide walks you through submitting CampoTech to the App Store (iOS) and Google Play (Android).

---

## Prerequisites

### Accounts Required

1. **Apple Developer Account** ($99/year)
   - Sign up: https://developer.apple.com/programs/
   - Takes 24-48 hours to approve

2. **Google Play Console** ($25 one-time)
   - Sign up: https://play.google.com/console/
   - Instant access

### Tools Required

- [EAS CLI](https://docs.expo.dev/eas/) - `npm install -g eas-cli`
- [Fastlane](https://fastlane.tools/) (optional) - `brew install fastlane`

---

## Step 1: Configure EAS

```bash
cd apps/mobile

# Login to EAS
eas login

# Configure project (if not done)
eas build:configure
```

---

## Step 2: Build the App

### Development Build (for testing)
```bash
eas build --profile development --platform all
```

### Preview Build (internal testing)
```bash
eas build --profile preview --platform all
```

### Production Build (store submission)
```bash
eas build --profile production --platform all
```

---

## Step 3: Submit to App Store (iOS)

### Option A: Using EAS Submit
```bash
eas submit --platform ios
```

### Option B: Manual via App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Create new app with bundle ID `tech.campo.app`
3. Fill in metadata (use files in `fastlane/metadata/es-AR/`)
4. Upload screenshots
5. Upload build from EAS
6. Submit for review

### Required Information

| Field | Value |
|-------|-------|
| Bundle ID | tech.campo.app |
| Primary Language | Spanish (Argentina) |
| Category | Business |
| Content Rating | 4+ |
| Encryption | No (standard HTTPS only) |

---

## Step 4: Submit to Google Play (Android)

### Option A: Using EAS Submit
```bash
eas submit --platform android
```

### Option B: Manual via Play Console

1. Go to https://play.google.com/console
2. Create new app with package `tech.campo.app`
3. Fill in store listing (use files in `fastlane/metadata/es-AR/`)
4. Upload screenshots and feature graphic
5. Upload AAB from EAS
6. Complete content rating questionnaire
7. Submit for review

### Required Information

| Field | Value |
|-------|-------|
| Package Name | tech.campo.app |
| Default Language | Spanish (Argentina) |
| App Category | Business |
| Content Rating | Everyone |
| Target Audience | 18+ (B2B app) |

---

## Step 5: Create Required Assets

See `ASSET-GENERATION-GUIDE.md` for detailed specifications.

### Quick Checklist

- [ ] App icon 1024x1024 (iOS)
- [ ] App icon 512x512 (Android)
- [ ] Feature graphic 1024x500 (Android)
- [ ] Screenshots (8 per device size)
- [ ] Splash screen

---

## Step 6: Fill Questionnaires

### iOS - App Privacy

1. Go to App Store Connect > App Privacy
2. Select data types collected:
   - **Location**: Precise location (for technician tracking)
   - **Contact Info**: Email, phone (for login)
   - **User Content**: Photos (for job documentation)

3. For each data type, specify:
   - Purpose: App functionality
   - Linked to user: Yes (for account features)

### Android - Content Rating

1. Go to Play Console > Content Rating
2. Answer questionnaire:
   - Violence: No
   - Sexual content: No
   - Drugs: No
   - Gambling: No
   - User-generated content: No (closed system)

3. Target audience: 18+ (business users only)

### Android - Data Safety

1. Go to Play Console > Data Safety
2. Data collected:
   - Location (required for service)
   - Email (for authentication)
   - Phone (for contact)
   - Photos (for documentation)

---

## Step 7: Review & Launch

### iOS Review Timeline
- First submission: 24-48 hours (may be longer)
- Updates: Usually same day or next day
- If rejected: Fix issues and resubmit

### Android Review Timeline
- First submission: 2-7 days
- Updates: Usually few hours
- If rejected: Fix issues and resubmit

---

## Common Rejection Reasons

### iOS
1. **Crash on launch** - Test thoroughly before submission
2. **Incomplete metadata** - Fill all required fields
3. **Placeholder content** - Remove all "Lorem ipsum" or test data
4. **Broken links** - Ensure privacy policy URL works
5. **Login issues** - Provide demo account for review

### Android
1. **Missing privacy policy** - Required URL
2. **Incorrect content rating** - Answer questionnaire honestly
3. **Deceptive behavior** - Don't request unnecessary permissions
4. **Target audience** - B2B apps should target 18+

---

## After Launch

### Monitor
- Check crash reports in App Store Connect / Play Console
- Respond to user reviews (especially negative ones)
- Monitor download and retention metrics

### Updates
```bash
# Bump version in app.json, then:
eas build --profile production --platform all
eas submit --platform all
```

---

## Support

- EAS Docs: https://docs.expo.dev/eas/
- Fastlane Docs: https://docs.fastlane.tools/
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Play Console Help: https://support.google.com/googleplay/android-developer/
