---
tags:
  - mobile
  - technician
  - expo
  - react-native
status: 🟢 Functional
type: Platform Overview
path: apps/mobile/
updated: 2026-02-13
---

# 📱 Mobile App Architecture

> [!SUCCESS] **Goal**
> The mobile app is the **technician's primary tool** in the field. It provides offline-first job management, real-time GPS tracking, on-site payment collection, digital identity badges, and mutual job-start verification — all optimized for Argentina's variable connectivity.

---

## 🏗️ Technology Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Framework** | Expo (React Native) | Cross-platform iOS + Android |
| **Navigation** | Expo Router | File-based routing |
| **Local Database** | WatermelonDB (SQLite) | Offline-first data persistence |
| **State** | Zustand | Lightweight global state |
| **Auth Storage** | expo-secure-store | Hardware-backed token storage |
| **Maps** | react-native-maps | Google Maps for navigation |
| **Camera** | expo-camera | Job photo documentation |
| **Location** | expo-location | Background GPS tracking |
| **Push** | expo-notifications | Job assignment alerts |
| **Updates** | EAS OTA | Over-the-air code updates |
| **Build** | EAS Build + Fastlane | CI/CD pipelines |

---

## 📱 Screen Map

### Bottom Tab Navigation

| Tab | Screen | Description |
|:---|:---|:---|
| 🏠 **Inicio** | Dashboard | Today's jobs, quick stats, next job card |
| 📋 **Trabajos** | Job List | All assigned jobs by status |
| 🗺️ **Mapa** | Map View | Live map with job pins + navigation |
| 👤 **Perfil** | Profile | Settings, availability toggle, badge |

### Job Screens (Stack Navigator)

| Screen | Route | Description |
|:---|:---|:---|
| Job Detail | `/jobs/[id]` | Full job info + customer contact |
| Job Execution | `/jobs/[id]/execute` | Start → Pause → Complete workflow |
| Photo Capture | `/jobs/[id]/photos` | Before/during/after documentation |
| Cobro (Collection) | `/jobs/[id]/cobro` | On-site payment collection |
| Invoice | `/jobs/[id]/invoice` | Create + send invoice from field |
| Confirmation Code | `/jobs/[id]/confirm` | 4-digit mutual verification |
| Route Navigation | `/jobs/[id]/navigate` | Turn-by-turn directions |

### Identity & Security

| Screen | Description |
|:---|:---|
| Digital Badge | QR code identity card for security checkpoints |
| Verification Status | View personal verification progress |
| Confirmation Code Entry | Enter 4-digit code from customer |

---

## 🔄 Offline Sync Architecture

### WatermelonDB Schema

```
Local SQLite (WatermelonDB)
    ├── jobs
    ├── customers
    ├── invoices
    ├── payments
    ├── photos
    ├── location_reports
    └── sync_queue
```

### Sync Protocol

| Direction | Trigger | Behavior |
|:---|:---|:---|
| **Pull** (Server → Mobile) | App foreground, manual refresh | Fetch changes since `lastSyncAt` |
| **Push** (Mobile → Server) | Connectivity regained, periodic | Upload queued local changes |
| **Conflict Resolution** | Pull time | Server wins with 0.01 variance threshold |

### SyncOperation Audit Trail

Every synchronization attempt is logged with:
- `deviceId`, `userId`, `organizationId`
- `recordsPushed`, `recordsPulled`
- `conflictsDetected`, `conflictsResolved`
- Duration, errors, network type

### Truth Reconciliation

| Field | Threshold | Rule |
|:---|:---|:---|
| Financial amounts | 0.01 ARS | Server value wins if delta > threshold |
| Job status | N/A | Status transitions enforced server-side |
| Photos/documents | N/A | Last-write-wins (append-only) |

---

## 💰 On-Site Payment Collection (Cobro)

The Cobro screen supports three payment methods for the Argentine market:

| Method | Flow | Details |
|:---|:---|:---|
| **Efectivo (Cash)** | Record amount → Mark as paid | No digital verification needed |
| **MercadoPago** | Generate QR/link → Customer pays → Webhook confirms | Real-time confirmation via webhook |
| **Transferencia (Bank Transfer)** | Show CBU/Alias → Customer transfers → Manual confirmation | Transferencia 3.0 compatible |

### Post-Payment
1. Payment recorded in local DB
2. Invoice auto-generated (optional)
3. Synced to server on next connection
4. Payment audit trail created (via `payment-audit-logger.ts`)

---

## 📍 GPS Tracking

### Background Location

| Setting | Value |
|:---|:---|
| **Update interval** | Every 30 seconds (active job) |
| **Accuracy** | High accuracy (GPS + Network) |
| **Battery mode** | Balanced (during active job only) |
| **Idle reporting** | Every 5 minutes |

### Location Data Transmitted

| Field | Type | Description |
|:---|:---|:---|
| latitude | Decimal(10,8) | GPS latitude |
| longitude | Decimal(11,8) | GPS longitude |
| accuracy | Decimal(6,2) | Position accuracy in meters |
| heading | Decimal(5,2) | Direction in degrees |
| speed | Decimal(6,2) | Speed in km/h |
| altitude | Decimal(10,2) | Elevation in meters |

---

## 🔐 Security Features

### Hardware-Backed Storage
- JWT tokens stored in `expo-secure-store` (Keychain on iOS, Keystore on Android)
- Never stored in AsyncStorage or plain text

### Digital Badge
- Unique QR code per technician
- Encodes: tech name, org name, verification status, badge ID
- Scannable by building security / administrators
- Daily push notification to promote badge usage

### Mutual Confirmation Code
- **Flow:** Customer receives 4-digit code → Technician enters on arrival → Job "unlocked"
- **Mandatory:** Cannot skip (enforced by server)
- **TTL:** Code expires after 24 hours
- **UI:** Large digit input, designed for outdoor visibility

---

## 🔄 OTA Updates

| Channel | Target | Auto-Update |
|:---|:---|:---|
| `production` | App Store / Play Store builds | ✅ Yes |
| `preview` | Internal testing builds | ✅ Yes |
| `development` | Dev simulator builds | Manual |

### Update Strategy
- **Non-breaking updates:** Applied silently on next app launch
- **Breaking updates:** Force-update screen with app store redirect
- **Rollback:** EAS supports instant rollback to previous version

---

## 🛠️ Technical Context

- **Root Path:** `apps/mobile/`
- **Entry Point:** `apps/mobile/app/_layout.tsx`
- **Metro Config:** `apps/mobile/metro.config.js`
- **EAS Config:** `apps/mobile/eas.json`
- **WatermelonDB:** `apps/mobile/watermelon/`
- **Fastlane:** `apps/mobile/fastlane/`

### Key Dependencies
```json
{
  "expo": "~51.x",
  "react-native": "0.74.x",
  "expo-router": "~3.x",
  "@nozbe/watermelondb": "^0.27.x",
  "zustand": "^4.x",
  "react-native-maps": "^1.x"
}
```

---

## 🔗 Connections

- **Parent:** [[Platform Overview]]
- **Syncs With:** [[Offline Sync Architecture]], [[Mobile Offline Sync]]
- **APIs Used:**
  - `POST /api/tracking/location` — GPS reporting
  - `GET /api/mobile/sync` — WatermelonDB pull
  - `POST /api/mobile/sync` — WatermelonDB push
  - `POST /api/payments` — Payment recording
  - `POST /api/invoices` — Invoice creation
  - `GET /api/verification/badge` — Digital badge data
  - `POST /api/confirmation-code/validate` — Job unlock
- **Related:** [[Map View]], [[Jobs Page]], [[Digital Badge System]], [[Technician Verification Security]]

---

## 📝 Notes & TODOs

- [x] Offline-first with WatermelonDB
- [x] Background GPS tracking
- [x] On-site Cobro (Cash, MP, Transfer)
- [x] Digital badge QR system
- [x] Mutual confirmation code
- [x] EAS OTA update pipeline
- [ ] TODO: Voice notes for job documentation
- [ ] TODO: Material usage tracking from inventory
- [ ] TODO: Dark mode support
- [ ] TODO: Bluetooth receipt printer integration
- [ ] TODO: Argentina-specific map features (AMBA zones)

---

*The mobile app is where CampoTech meets the real world — every feature is designed for one-handed outdoor use.*
