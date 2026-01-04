# Implementation Plan Addendum: Strategic Features
## Version 1.1 | January 2026

This addendum adds **4 strategic growth features** to the existing implementation roadmap. Each feature is assigned to the most logical existing phase.

---

# FEATURE 1: FISCAL HEALTH DASHBOARD ("Traffic Light")
**Assigned Phase:** Phase 2 (Core Features) - Insert after Task 2.3.5
**Priority:** 🟡 HIGH (Monetributo compliance value-add)
**Estimated Effort:** 4 days

## Overview
A proactive dashboard widget warning Monotributistas when approaching their category billing limit. Uses "Green/Yellow/Red" indicators for immediate visual comprehension.

## Task 2.4: Fiscal Health Dashboard

### Task 2.4.1: Create Monotributo Category Reference Data
**Files to create:**
- `apps/web/lib/constants/monotributo-categories.ts`

```typescript
// Hardcoded 2024/2025 AFIP Monotributo limits (update annually)
export const MONOTRIBUTO_CATEGORIES = {
  A: { maxAnnual: 2108288.01, maxMonthly: 175690.67, name: 'Categoría A' },
  B: { maxAnnual: 3133941.63, maxMonthly: 261161.80, name: 'Categoría B' },
  C: { maxAnnual: 4387518.23, maxMonthly: 365626.52, name: 'Categoría C' },
  D: { maxAnnual: 5449094.55, maxMonthly: 454091.21, name: 'Categoría D' },
  E: { maxAnnual: 6416528.72, maxMonthly: 534710.73, name: 'Categoría E' },
  F: { maxAnnual: 8020661.10, maxMonthly: 668388.43, name: 'Categoría F' },
  G: { maxAnnual: 9614793.48, maxMonthly: 801232.79, name: 'Categoría G' },
  H: { maxAnnual: 11915838.24, maxMonthly: 992986.52, name: 'Categoría H' },
  I: { maxAnnual: 13337213.56, maxMonthly: 1111434.46, name: 'Categoría I (Solo servicios)' },
  J: { maxAnnual: 15285088.40, maxMonthly: 1273757.37, name: 'Categoría J (Solo servicios)' },
  K: { maxAnnual: 16957163.23, maxMonthly: 1413096.94, name: 'Categoría K (Solo servicios)' },
} as const;
```

**Acceptance Criteria:**
- [ ] All 2024/2025 Monotributo categories defined
- [ ] Easy to update annually when AFIP publishes new limits

### Task 2.4.2: Create Fiscal Health Service
**Files to create:**
- `apps/web/lib/services/fiscal-health.service.ts`

**Logic:**
```typescript
export class FiscalHealthService {
  async calculateFiscalHealth(orgId: string): Promise<FiscalHealthStatus> {
    // 1. Get org's declared Monotributo category from settings
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true }
    });
    
    const category = org.settings?.monotributoCategory || 'A';
    const limits = MONOTRIBUTO_CATEGORIES[category];
    
    // 2. Sum YTD invoiced amounts (AFIP CAE-issued only)
    const ytdTotal = await this.getYTDBilling(orgId);
    
    // 3. Calculate percentage and status
    const percentUsed = (ytdTotal / limits.maxAnnual) * 100;
    
    return {
      category,
      ytdBilling: ytdTotal,
      annualLimit: limits.maxAnnual,
      percentUsed,
      remainingAmount: limits.maxAnnual - ytdTotal,
      status: this.getTrafficLightStatus(percentUsed),
      recommendation: this.getComplianceRecommendation(percentUsed, category)
    };
  }
  
  private getTrafficLightStatus(percent: number): 'green' | 'yellow' | 'red' {
    if (percent < 70) return 'green';  // Healthy
    if (percent < 90) return 'yellow'; // Approaching limit
    return 'red';                       // At risk - consult accountant
  }
  
  private getComplianceRecommendation(percent: number, category: string): string {
    if (percent >= 90) {
      return 'Te recomendamos consultar con tu contador sobre la recategorización para mantener tu cumplimiento fiscal.';
    }
    if (percent >= 70) {
      return 'Estás acercándote al límite de tu categoría. Planificá con tu contador.';
    }
    return 'Tu facturación está dentro de los límites saludables de tu categoría.';
  }
}
```

### Task 2.4.3: Create Fiscal Health API Endpoint
**Files to create:**
- `apps/web/app/api/analytics/fiscal-health/route.ts`

### Task 2.4.4: Create Dashboard Widget Component
**Files to create:**
- `apps/web/components/dashboard/FiscalHealthWidget.tsx`

**Placement:** 
- ✅ Web Dashboard (primary)
- ✅ Mobile App - Profile screen (secondary, simplified)

**UI Mockup:**
```
┌────────────────────────────────────────┐
│ 🏛️ Salud Fiscal - Monotributo         │
├────────────────────────────────────────┤
│                                        │
│  Categoría: D                          │
│                                        │
│  ████████████░░░░░░░░ 62%             │
│  🟢 SALUDABLE                          │
│                                        │
│  Facturado YTD: $3,378,438            │
│  Límite anual:  $5,449,094            │
│  Disponible:    $2,070,656            │
│                                        │
│  ℹ️ Tu facturación está dentro de     │
│     los límites saludables.           │
│                                        │
│  [Ver detalles]                        │
└────────────────────────────────────────┘
```

**Mobile Simplified (Profile screen):**
```
┌────────────────────────────────────────┐
│ Monotributo: 🟢 62% usado              │
│ Disponible: $2,070,656                 │
└────────────────────────────────────────┘
```

### Task 2.4.5: Add Monotributo Category to Org Settings
**Files to modify:**
- `apps/web/app/(dashboard)/settings/business/page.tsx`
- `apps/web/app/api/settings/business/route.ts`

**Add dropdown to select Monotributo category in business settings.**

**Acceptance Criteria (Phase 2.4 Complete):**
- [ ] Monotributo category selectable in settings
- [ ] YTD billing calculated from CAE-issued invoices
- [ ] Traffic light widget on web dashboard
- [ ] Simplified indicator on mobile profile
- [ ] Wording focuses on "compliance" not "evasion"
- [ ] Recommendations suggest consulting accountant

---

# FEATURE 2: DIGITAL ENTRY BADGE (Gated Community Access)
**Assigned Phase:** Phase 4 (Onboarding Automation) - Insert after Task 4.1.3
**Priority:** 🟠 MEDIUM (Differentiation for Countries/gated communities)
**Estimated Effort:** 5 days

## Overview
A "Passport" feature for technicians entering gated communities (Countries). Dynamic QR code displays identity, ART insurance status, and background check status.

## Task 4.3: Digital Entry Badge System

### Task 4.3.1: Extend User Schema for Verification Documents
**Files to modify:**
- `apps/web/prisma/schema.prisma`

```prisma
model User {
  // ... existing fields ...
  
  // Professional Verification Documents
  artCertificateUrl       String?   // ART insurance certificate PDF
  artExpiryDate           DateTime? // ART expiration date
  artProvider             String?   // Insurance company name (e.g., "Galeno ART")
  artPolicyNumber         String?   // Policy number
  
  backgroundCheckStatus   BackgroundCheckStatus @default(pending)
  backgroundCheckDate     DateTime?
  backgroundCheckProvider String?   // e.g., "Veraz", "Nosis"
  
  // QR Badge
  badgeToken              String?   @unique // Secure token for QR validation
  badgeTokenExpiresAt     DateTime? // Token rotation (monthly)
}

enum BackgroundCheckStatus {
  pending
  approved
  rejected
  expired
}
```

### Task 4.3.2: Create Badge Generation Service
**Files to create:**
- `apps/web/lib/services/digital-badge.service.ts`

```typescript
export class DigitalBadgeService {
  async generateBadgeData(userId: string): Promise<BadgeData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true }
    });
    
    // Generate or refresh badge token (valid 30 days)
    if (!user.badgeToken || user.badgeTokenExpiresAt < new Date()) {
      await this.refreshBadgeToken(userId);
    }
    
    return {
      technician: {
        name: user.name,
        photo: user.avatar,
        specialty: user.specialty,
      },
      organization: {
        name: user.organization.name,
        logo: user.organization.logo,
      },
      verification: {
        artStatus: this.getARTStatus(user),
        artExpiry: user.artExpiryDate,
        artProvider: user.artProvider,
        backgroundCheck: user.backgroundCheckStatus,
        backgroundCheckDate: user.backgroundCheckDate,
      },
      qrPayload: `${process.env.APP_URL}/verify-badge/${user.badgeToken}`,
      generatedAt: new Date(),
      validUntil: user.badgeTokenExpiresAt,
    };
  }
  
  private getARTStatus(user: User): 'valid' | 'expiring' | 'expired' | 'missing' {
    if (!user.artExpiryDate) return 'missing';
    const daysUntilExpiry = differenceInDays(user.artExpiryDate, new Date());
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry < 30) return 'expiring';
    return 'valid';
  }
}
```

### Task 4.3.3: Create Badge Verification Public Endpoint
**Files to create:**
- `apps/web/app/verify-badge/[token]/page.tsx` (Public page)
- `apps/web/app/api/verify-badge/[token]/route.ts`

**When security guard scans QR, they see:**
```
┌────────────────────────────────────────┐
│ ✅ VERIFICACIÓN DE ACCESO             │
├────────────────────────────────────────┤
│                                        │
│  [PHOTO]  Juan Pérez                   │
│           Electricista                 │
│           TechCorp SA                  │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  ✅ ART Vigente                        │
│     Galeno ART - Vence 15/06/2026     │
│                                        │
│  ✅ Antecedentes Verificados          │
│     Verificado el 01/12/2025          │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  🕐 Verificado: 04/01/2026 13:45      │
│                                        │
└────────────────────────────────────────┘
```

### Task 4.3.4: Mobile Badge Screen
**Files to create:**
- `apps/mobile/app/(tabs)/profile/badge.tsx`
- `apps/mobile/components/DigitalBadge.tsx`

**Mobile UI:**
```
┌────────────────────────────────────────┐
│ 🪪 Mi Credencial Digital               │
├────────────────────────────────────────┤
│                                        │
│          [QR CODE - Dynamic]           │
│                                        │
│  Mostrá este código al ingresar       │
│  a countries/barrios cerrados         │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  ART: ✅ Vigente (vence en 165 días)  │
│  Antecedentes: ✅ Verificados         │
│                                        │
│  [Actualizar documentos]               │
│                                        │
└────────────────────────────────────────┘
```

### Task 4.3.5: ART Certificate Upload Flow
**Files to modify:**
- `apps/web/app/(dashboard)/team/[userId]/page.tsx`
- `apps/web/app/api/verification/employee/route.ts`

**Add section for uploading ART certificate with expiry date picker.**

**Acceptance Criteria (Phase 4.3 Complete):**
- [ ] User schema extended with ART and background check fields
- [ ] Badge generation with rotating secure token
- [ ] QR code displays in mobile app
- [ ] Public verification page for security guards
- [ ] ART certificate upload with expiry tracking
- [ ] Expiry warnings (30 days before)

---

# FEATURE 3: ANTI-EXCEL INVENTORY SCANNING
**Assigned Phase:** Phase 2 (Core Features) - Insert after Task 2.2.3
**Priority:** 🟡 HIGH (Mobile-native stock management)
**Estimated Effort:** 4 days

## Overview
Mobile camera barcode scanning for instant stock deduction. Scan → Select quantity → Auto-deduct from vehicle with warehouse fallback.

## Task 2.2.4: Barcode Scanning Integration

### Task 2.2.4.1: Add Expo Barcode Scanner
**Files to modify:**
- `apps/mobile/package.json`
- `apps/mobile/app.json`

```bash
pnpm add expo-barcode-scanner expo-camera
```

### Task 2.2.4.2: Create Barcode Scanner Component
**Files to create:**
- `apps/mobile/components/inventory/BarcodeScanner.tsx`

```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';

export function BarcodeScanner({ onScan }: { onScan: (barcode: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    onScan(data);
  };
  
  return (
    <CameraView
      style={{ flex: 1 }}
      barcodeScannerSettings={{
        barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr'],
      }}
      onBarcodeScanned={handleBarcodeScanned}
    />
  );
}
```

### Task 2.2.4.3: Create Scan & Deduct Flow Screen
**Files to create:**
- `apps/mobile/app/(tabs)/inventory/scan.tsx`

**Flow:**
1. Open scanner
2. Scan product barcode
3. If found: Show product info + quantity picker
4. If not found: "Producto no encontrado en inventario"
5. Confirm → Call cascade deduction API
6. Show success/error + source summary

**UI:**
```
┌────────────────────────────────────────┐
│ 📷 Escanear Material                   │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │         [CAMERA VIEW]            │  │
│  │                                  │  │
│  │     Apuntá al código de barras   │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Último escaneado:                     │
│  ✓ Caño 1/2" (x2) - de Camioneta     │
│                                        │
└────────────────────────────────────────┘

[After scan - Bottom Sheet]
┌────────────────────────────────────────┐
│ Caño de cobre 1/2"                     │
│ Código: 7891234567890                  │
├────────────────────────────────────────┤
│                                        │
│  Cantidad:  [-] 1 [+]                  │
│                                        │
│  En camioneta: 5 disponibles          │
│  En depósito: 23 disponibles          │
│                                        │
│  [Descontar del stock]                 │
│                                        │
└────────────────────────────────────────┘
```

### Task 2.2.4.4: Offline Queue for Scanned Items
**Files to modify:**
- `apps/mobile/watermelon/models/index.ts` (add PendingStockDeduction model)
- `apps/mobile/lib/sync/sync-operations.ts`

**Offline behavior:**
- Scanned items queued in WatermelonDB
- Sync to server when online
- Show pending count: "3 materiales pendientes de sincronizar"

**Acceptance Criteria (Task 2.2.4 Complete):**
- [ ] Camera permissions requested
- [ ] Barcode scanner works (EAN-13, Code128, QR)
- [ ] Product lookup by barcode
- [ ] Quantity picker with cascade deduction
- [ ] Offline queue for scanned items
- [ ] Sync indicator for pending deductions

---

# FEATURE 4: UNCLAIMED PROFILE GROWTH ENGINE
**Assigned Phase:** Phase 4 (Onboarding) - Insert after Task 4.2.2
**Priority:** 🟠 MEDIUM (Growth/acquisition strategy)
**Estimated Effort:** 6 days

## Overview
Pre-populate database with public professional data (Gasnor/ENARGAS matriculas) to create "ghost profiles" that technicians can claim via SMS/WhatsApp verification.

## Task 4.4: Unclaimed Profile System

### Task 4.4.1: Create Unclaimed Profile Schema
**Files to modify:**
- `apps/web/prisma/schema.prisma`

```prisma
model UnclaimedProfile {
  id                String   @id @default(cuid())
  
  // Professional identity (from public data)
  fullName          String
  matriculaNumber   String   // Professional license number
  matriculaType     String   // GASISTA, ELECTRICISTA, etc.
  matriculaAuthority String  // ENARGAS, ENRE, provincial body
  phone             String?  // If available from public records
  email             String?
  
  // Location (from registration)
  province          String?
  locality          String?
  
  // Source tracking
  dataSource        String   // "GASNOR_CSV", "ENARGAS_API", "MANUAL"
  sourceRecordId    String?  // ID from source system
  importedAt        DateTime @default(now())
  
  // Claim status
  status            UnclaimedStatus @default(unclaimed)
  claimedByUserId   String?  @unique
  claimedAt         DateTime?
  claimVerificationCode String? // SMS/WhatsApp OTP
  claimVerificationExpiry DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  claimedBy         User?    @relation(fields: [claimedByUserId], references: [id])
  
  @@unique([matriculaNumber, matriculaAuthority])
  @@index([phone])
  @@index([status])
  @@index([matriculaType])
  @@index([province])
  @@map("unclaimed_profiles")
}

enum UnclaimedStatus {
  unclaimed
  verification_pending
  claimed
  rejected // Fraudulent claim attempt
}
```

### Task 4.4.2: Create Data Import Worker
**Files to create:**
- `apps/web/lib/workers/unclaimed-profile-import.worker.ts`

```typescript
// Ingest CSV/JSON of professionals
// Expected format:
// { name, matricula, type, authority, phone?, province? }

export async function importProfiles(source: string, data: ProfileImport[]) {
  for (const record of data) {
    await prisma.unclaimedProfile.upsert({
      where: {
        matriculaNumber_matriculaAuthority: {
          matriculaNumber: record.matricula,
          matriculaAuthority: record.authority,
        }
      },
      create: {
        fullName: record.name,
        matriculaNumber: record.matricula,
        matriculaType: record.type,
        matriculaAuthority: record.authority,
        phone: record.phone,
        province: record.province,
        dataSource: source,
        sourceRecordId: record.sourceId,
      },
      update: {
        fullName: record.name,
        phone: record.phone,
        province: record.province,
      }
    });
  }
}
```

### Task 4.4.3: Create Claim Profile API Flow
**Files to create:**
- `apps/web/app/api/claim-profile/search/route.ts`
- `apps/web/app/api/claim-profile/request/route.ts`
- `apps/web/app/api/claim-profile/verify/route.ts`

**Flow:**
1. `GET /claim-profile/search?matricula=12345` - Find unclaimed profile
2. `POST /claim-profile/request` - Send SMS/WhatsApp OTP to registered phone
3. `POST /claim-profile/verify` - Verify OTP, link to user account

### Task 4.4.4: Create Public Claim Landing Page
**Files to create:**
- `apps/web/app/claim/page.tsx`
- `apps/web/app/claim/[matricula]/page.tsx`

**Marketing page where professionals can search for and claim their profile:**
```
┌────────────────────────────────────────┐
│ 🔍 ¿Sos profesional matriculado?      │
├────────────────────────────────────────┤
│                                        │
│ Buscá tu matrícula para reclamar     │
│ tu perfil en CampoTech                │
│                                        │
│ [Número de matrícula: ________]       │
│ [Ente: ENARGAS ▼]                     │
│                                        │
│ [Buscar mi perfil]                    │
│                                        │
│ ─────────────────────────────────────│
│                                        │
│ ✅ Tu perfil ya tiene:                │
│    • Matrícula verificada             │
│    • Datos profesionales cargados     │
│    • Listo para recibir trabajos      │
│                                        │
└────────────────────────────────────────┘
```

### Task 4.4.5: Admin Import Dashboard
**Files to create:**
- `apps/web/app/(dashboard)/admin/unclaimed-profiles/page.tsx`

**Admin can:**
- Upload CSV/JSON files
- View import status
- See claim conversion metrics

**Acceptance Criteria (Phase 4.4 Complete):**
- [ ] UnclaimedProfile schema created
- [ ] CSV/JSON import worker functional
- [ ] Search by matricula number
- [ ] SMS/WhatsApp OTP verification for claim
- [ ] Profile linked to user account on claim
- [ ] Public landing page for claim flow
- [ ] Admin dashboard for imports and metrics

---

# REVISED TIMELINE

```
ORIGINAL PHASES (unchanged):
├── Phase 1: Security & Infrastructure (5 days)
├── Phase 2: Core Features (14 days) 
│   └── 2.1: Vehicle Scheduling (6d)
│   └── 2.2: Inventory Cascade (3d)
│   └── 2.2.4: Barcode Scanning (4d) ← NEW
│   └── 2.3: Multi-stop Navigation (5d)
│   └── 2.4: Fiscal Health Dashboard (4d) ← NEW
├── Phase 3: WhatsApp Enhancements (6 days)
├── Phase 4: Onboarding Automation (5 days)
│   └── 4.1: OAuth Flows (4d)
│   └── 4.2: Dead Code Cleanup (1d)
│   └── 4.3: Digital Entry Badge (5d) ← NEW
│   └── 4.4: Unclaimed Profile Engine (6d) ← NEW
└── Phase 5: Voice AI Migration (12.5 days)

NEW TOTAL TIMELINE:
├── Original: 8-10 weeks (42.5 days)
├── Addendum: +19 days
└── New Total: 12-14 weeks (61.5 days)
```

---

# FEATURE SUMMARY TABLE

| Feature | Phase | Effort | Files Touched | Priority |
|---------|-------|--------|---------------|----------|
| Fiscal Health Dashboard | 2.4 | 4 days | 5 new, 2 modified | HIGH |
| Digital Entry Badge | 4.3 | 5 days | 8 new, 3 modified | MEDIUM |
| Barcode Scanning | 2.2.4 | 4 days | 4 new, 2 modified | HIGH |
| Unclaimed Profile Engine | 4.4 | 6 days | 7 new, 1 modified | MEDIUM |

---

# DEPENDENCIES

```
Feature Dependencies:
├── Fiscal Health Dashboard
│   └── Requires: AFIP invoicing working (Phase 1 complete)
│
├── Digital Entry Badge
│   └── Requires: User verification framework (existing)
│   └── Requires: Supabase storage for certificates
│
├── Barcode Scanning
│   └── Requires: Inventory cascade logic (Task 2.2.1-2.2.3)
│   └── Requires: Product barcode field populated
│
└── Unclaimed Profile Engine
    └── Requires: SMS/WhatsApp OTP service (existing)
    └── Requires: Admin dashboard access
```

---

# RISK ASSESSMENT

| Feature | Risk | Mitigation |
|---------|------|------------|
| Fiscal Health | Monotributo limits change annually | Easy constant update, add AFIP update reminder |
| Digital Badge | ART verification accuracy | Manual admin review option, clear disclaimers |
| Barcode Scanner | Camera compatibility on low-end devices | Fallback to manual SKU entry |
| Unclaimed Profiles | Privacy concerns with public data | Only use publicly available matricula data, clear consent |

