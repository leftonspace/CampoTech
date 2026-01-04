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

# FEATURE 4: THE GROWTH ENGINE (Unclaimed Profile System)
**Assigned Phase:** Phase 4 (Onboarding) - Insert after Task 4.2.2
**Priority:** 🟠 MEDIUM (Growth/acquisition strategy)
**Estimated Effort:** 8 days (includes activation workflow)

## Overview
Pre-populate database with public professional data from validated sources to create "ghost profiles" that technicians can claim via SMS/WhatsApp verification. This is our **"land grab"** strategy to acquire users with zero CAC.

**Validated Data Sources - "The Gold Mines" (January 2026 Research):**
| Source | Region | Profession | Est. Records | Data Quality | Priority |
|--------|--------|------------|--------------|--------------|----------|
| ERSEP via volta.net.ar | Córdoba | Electricistas | **~33,000** | ⭐⭐⭐ Phone + Email | 🔴 CRITICAL |
| CACAAV | Nacional | HVAC/Refrigeración | **~23,000** | ⭐⭐ Mobile + City | 🟡 HIGH |
| Gasnor/GasNEA PDFs | Norte (Salta, Jujuy, Tucumán) | Gasistas | **~5,000** | ⭐⭐ Email + Matrícula | 🟢 MEDIUM |

**Total Addressable Profiles: ~61,000 professionals**

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
  matriculaType     String   // GASISTA, ELECTRICISTA, HVAC, etc.
  matriculaAuthority String  // ERSEP, CACAAV, GASNOR, GASNEA, ENARGAS
  phone             String?  // If available from public records
  mobilePhone       String?  // Mobile specifically (CACAAV)
  email             String?
  
  // Location (from registration)
  province          String?
  locality          String?
  
  // Source tracking
  dataSource        String   // "ERSEP_SCRAPER", "CACAAV_SCRAPER", "GASNOR_PDF", "GASNEA_PDF"
  sourceRecordId    String?  // ID from source system
  sourceUrl         String?  // URL where data was scraped from
  scrapedAt         DateTime? // When data was last scraped
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
  @@index([mobilePhone])
  @@index([email])
  @@index([status])
  @@index([matriculaType])
  @@index([province])
  @@index([dataSource])
  @@map("unclaimed_profiles")
}

enum UnclaimedStatus {
  unclaimed
  verification_pending
  claimed
  rejected // Fraudulent claim attempt
}
```

### Task 4.4.2: Build ERSEP Scraper (Córdoba - Electricity) 🔴 CRITICAL
**Source:** `volta.net.ar` (ERSEP public registry)
**Target Volume:** ~33,000 electricians
**Strategy:** Playwright script to iterate paginated HTML results
**Data Points:** Name, Phone, Email, Category, Matrícula
**Priority:** CRITICAL - Highest quality contact data (phone + email)

**Files to create:**
- `apps/worker/src/scrapers/ersep-scraper.ts`
- `apps/worker/src/scrapers/ersep-scraper.test.ts`

```typescript
// apps/worker/src/scrapers/ersep-scraper.ts
import { chromium } from 'playwright';
import { prisma } from '@/lib/prisma';

interface ERSEPRecord {
  name: string;
  phone: string | null;
  email: string | null;
  category: string; // "Instalador Electricista Categoría I", etc.
  matricula: string;
}

export class ERSEPScraper {
  private baseUrl = 'https://volta.net.ar';
  
  /**
   * Scrape ERSEP electrician registry from volta.net.ar
   * Iterates through paginated HTML results
   */
  async scrapeAll(): Promise<ERSEPRecord[]> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const records: ERSEPRecord[] = [];
    let currentPage = 1;
    let hasNextPage = true;
    
    while (hasNextPage) {
      await page.goto(`${this.baseUrl}/matriculados?page=${currentPage}`);
      
      // Wait for table to load
      await page.waitForSelector('.matriculados-table', { timeout: 10000 });
      
      // Extract records from current page
      const pageRecords = await page.evaluate(() => {
        const rows = document.querySelectorAll('.matriculados-table tbody tr');
        return Array.from(rows).map(row => ({
          name: row.querySelector('.nombre')?.textContent?.trim() || '',
          phone: row.querySelector('.telefono')?.textContent?.trim() || null,
          email: row.querySelector('.email')?.textContent?.trim() || null,
          category: row.querySelector('.categoria')?.textContent?.trim() || '',
          matricula: row.querySelector('.matricula')?.textContent?.trim() || '',
        }));
      });
      
      records.push(...pageRecords);
      
      // Check for next page
      hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector('.pagination .next:not(.disabled)');
        return nextButton !== null;
      });
      
      currentPage++;
      
      // Rate limiting - be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await browser.close();
    return records;
  }
  
  /**
   * Import scraped records into UnclaimedProfile table
   */
  async importRecords(records: ERSEPRecord[]): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;
    
    for (const record of records) {
      if (!record.matricula || !record.name) continue;
      
      const result = await prisma.unclaimedProfile.upsert({
        where: {
          matriculaNumber_matriculaAuthority: {
            matriculaNumber: record.matricula,
            matriculaAuthority: 'ERSEP',
          }
        },
        create: {
          fullName: record.name,
          matriculaNumber: record.matricula,
          matriculaType: 'ELECTRICISTA',
          matriculaAuthority: 'ERSEP',
          phone: record.phone,
          email: record.email,
          province: 'Córdoba',
          dataSource: 'ERSEP_SCRAPER',
          sourceUrl: 'https://volta.net.ar/matriculados',
          scrapedAt: new Date(),
        },
        update: {
          fullName: record.name,
          phone: record.phone,
          email: record.email,
          scrapedAt: new Date(),
        }
      });
      
      if (result.createdAt === result.updatedAt) {
        imported++;
      } else {
        updated++;
      }
    }
    
    return { imported, updated };
  }
}
```

**Acceptance Criteria:**
- [ ] Scraper handles pagination correctly
- [ ] Extracts Name, Phone, Email, Category, Matricula
- [ ] Respects rate limiting (1 req/sec)
- [ ] Handles DOM changes gracefully (try/catch)
- [ ] Logs errors without crashing

### Task 4.4.3: Build CACAAV Scraper (National - HVAC)
**Source:** `cacaav.com.ar/matriculados/listado`
**Target Volume:** ~23,000 HVAC technicians
**Strategy:** JSDOM HTML Table DOM parsing (simpler than ERSEP)
**Data Points:** Name, Mobile Phone, City

**Files to create:**
- `apps/worker/src/scrapers/cacaav-scraper.ts`
- `apps/worker/src/scrapers/cacaav-scraper.test.ts`

```typescript
// apps/worker/src/scrapers/cacaav-scraper.ts
import { JSDOM } from 'jsdom';
import { prisma } from '@/lib/prisma';

interface CACAAVRecord {
  name: string;
  mobilePhone: string | null;
  city: string | null;
  matricula: string;
}

export class CACAAVScraper {
  private baseUrl = 'https://cacaav.com.ar/matriculados/listado';
  
  /**
   * Scrape CACAAV HVAC registry
   * Simple HTML table parsing - no pagination needed (single page)
   */
  async scrape(): Promise<CACAAVRecord[]> {
    const response = await fetch(this.baseUrl);
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const records: CACAAVRecord[] = [];
    
    // Find the matriculados table
    const table = document.querySelector('table.matriculados, #matriculados-table, .listado-table');
    if (!table) {
      console.error('CACAAV: Could not find matriculados table');
      return [];
    }
    
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        records.push({
          name: cells[0]?.textContent?.trim() || '',
          mobilePhone: cells[1]?.textContent?.trim() || null,
          city: cells[2]?.textContent?.trim() || null,
          matricula: cells[3]?.textContent?.trim() || this.generateMatriculaFromName(cells[0]?.textContent?.trim() || ''),
        });
      }
    });
    
    return records;
  }
  
  /**
   * Import scraped records into UnclaimedProfile table
   */
  async importRecords(records: CACAAVRecord[]): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;
    
    for (const record of records) {
      if (!record.name) continue;
      
      // Generate stable matricula if not provided
      const matricula = record.matricula || `CACAAV-${this.hashName(record.name)}`;
      
      const result = await prisma.unclaimedProfile.upsert({
        where: {
          matriculaNumber_matriculaAuthority: {
            matriculaNumber: matricula,
            matriculaAuthority: 'CACAAV',
          }
        },
        create: {
          fullName: record.name,
          matriculaNumber: matricula,
          matriculaType: 'HVAC',
          matriculaAuthority: 'CACAAV',
          mobilePhone: record.mobilePhone,
          locality: record.city,
          dataSource: 'CACAAV_SCRAPER',
          sourceUrl: 'https://cacaav.com.ar/matriculados/listado',
          scrapedAt: new Date(),
        },
        update: {
          fullName: record.name,
          mobilePhone: record.mobilePhone,
          locality: record.city,
          scrapedAt: new Date(),
        }
      });
      
      if (result.createdAt === result.updatedAt) {
        imported++;
      } else {
        updated++;
      }
    }
    
    return { imported, updated };
  }
  
  private hashName(name: string): string {
    // Simple hash for stable ID generation
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  private generateMatriculaFromName(name: string): string {
    return `CACAAV-${this.hashName(name)}`;
  }
}
```

**Acceptance Criteria:**
- [ ] Parses HTML table correctly
- [ ] Extracts Name, Mobile Phone, City
- [ ] Handles missing fields gracefully
- [ ] Generates stable matricula ID if not present
- [ ] Logs warnings for malformed rows

### Task 4.4.4: Build PDF Pipeline for Gasnor/GasNEA (North - Gas)
**Source:** Static PDF Lists from distributor websites
**Strategy:** Implement `pdfplumber` (Python) to extract tabular data from PDFs
**Data Points:** Name, Email (often present), Matricula ID

**Files to create:**
- `apps/worker/src/parsers/gasnor-pdf.py`
- `apps/worker/src/parsers/gasnea-pdf.py`
- `apps/worker/src/parsers/pdf-import-coordinator.ts`

```python
# apps/worker/src/parsers/gasnor-pdf.py
"""
PDF Parser for Gasnor/GasNEA matriculados lists
Uses pdfplumber for tabular data extraction
"""

import pdfplumber
import json
import sys
import re
from typing import List, Dict, Optional

def extract_matriculados(pdf_path: str) -> List[Dict]:
    """
    Extract matriculados data from Gasnor/GasNEA PDF
    
    Expected PDF format:
    | Nombre | Email | Matrícula | Localidad |
    |--------|-------|-----------|-----------|
    
    Returns list of dicts with extracted data
    """
    records = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            # Extract tables from page
            tables = page.extract_tables()
            
            for table in tables:
                if not table:
                    continue
                    
                # Skip header row
                for row in table[1:]:
                    if len(row) < 3:
                        continue
                    
                    # Clean and parse row data
                    name = clean_text(row[0]) if row[0] else None
                    email = extract_email(row[1]) if len(row) > 1 else None
                    matricula = clean_text(row[2]) if len(row) > 2 else None
                    locality = clean_text(row[3]) if len(row) > 3 else None
                    
                    if name and matricula:
                        records.append({
                            'name': name,
                            'email': email,
                            'matricula': matricula,
                            'locality': locality,
                            'page': page_num + 1
                        })
    
    return records

def clean_text(text: Optional[str]) -> Optional[str]:
    """Remove extra whitespace and normalize text"""
    if not text:
        return None
    return ' '.join(text.split()).strip()

def extract_email(text: Optional[str]) -> Optional[str]:
    """Extract email from text, handling common OCR issues"""
    if not text:
        return None
    
    # Email regex pattern
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    match = re.search(email_pattern, text)
    
    if match:
        return match.group(0).lower()
    return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No PDF path provided'}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    source = sys.argv[2] if len(sys.argv) > 2 else 'GASNOR'
    
    try:
        records = extract_matriculados(pdf_path)
        
        # Add source metadata
        for record in records:
            record['source'] = source
            record['source_file'] = pdf_path
        
        print(json.dumps({
            'success': True,
            'count': len(records),
            'records': records
        }))
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'success': False
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
```

```typescript
// apps/worker/src/parsers/pdf-import-coordinator.ts
import { spawn } from 'child_process';
import { prisma } from '@/lib/prisma';
import path from 'path';

interface PDFRecord {
  name: string;
  email: string | null;
  matricula: string;
  locality: string | null;
  source: string;
  source_file: string;
}

export class PDFImportCoordinator {
  
  /**
   * Process a Gasnor/GasNEA PDF and import records
   */
  async processGasnorPDF(pdfPath: string, source: 'GASNOR' | 'GASNEA'): Promise<{ imported: number; updated: number }> {
    const records = await this.extractFromPDF(pdfPath, source);
    return this.importRecords(records, source);
  }
  
  /**
   * Call Python pdfplumber script to extract data
   */
  private async extractFromPDF(pdfPath: string, source: string): Promise<PDFRecord[]> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'gasnor-pdf.py');
      const python = spawn('python3', [pythonScript, pdfPath, source]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          if (result.success) {
            resolve(result.records);
          } else {
            reject(new Error(result.error));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      });
    });
  }
  
  /**
   * Import extracted records into database
   */
  private async importRecords(records: PDFRecord[], source: 'GASNOR' | 'GASNEA'): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;
    
    const authority = source === 'GASNOR' ? 'GASNOR' : 'GASNEA';
    const provinces = source === 'GASNOR' 
      ? ['Salta', 'Jujuy', 'Tucumán', 'Santiago del Estero']
      : ['Corrientes', 'Chaco', 'Formosa', 'Misiones'];
    
    for (const record of records) {
      if (!record.matricula || !record.name) continue;
      
      // Infer province from locality if possible
      let province = provinces[0]; // Default to first province in region
      
      const result = await prisma.unclaimedProfile.upsert({
        where: {
          matriculaNumber_matriculaAuthority: {
            matriculaNumber: record.matricula,
            matriculaAuthority: authority,
          }
        },
        create: {
          fullName: record.name,
          matriculaNumber: record.matricula,
          matriculaType: 'GASISTA',
          matriculaAuthority: authority,
          email: record.email,
          locality: record.locality,
          province,
          dataSource: `${source}_PDF`,
          sourceUrl: record.source_file,
          scrapedAt: new Date(),
        },
        update: {
          fullName: record.name,
          email: record.email,
          locality: record.locality,
          scrapedAt: new Date(),
        }
      });
      
      if (result.createdAt === result.updatedAt) {
        imported++;
      } else {
        updated++;
      }
    }
    
    return { imported, updated };
  }
}
```

**Acceptance Criteria:**
- [ ] Python pdfplumber script extracts tables correctly
- [ ] Handles multi-page PDFs
- [ ] Email extraction with regex validation
- [ ] TypeScript coordinator calls Python subprocess
- [ ] Imports records to UnclaimedProfile table
- [ ] Logs extraction errors per page

### Task 4.4.5: Create Claim Profile API Flow
**Files to create:**
- `apps/web/app/api/claim-profile/search/route.ts`
- `apps/web/app/api/claim-profile/request/route.ts`
- `apps/web/app/api/claim-profile/verify/route.ts`

**Flow:**
1. `GET /claim-profile/search?matricula=12345` - Find unclaimed profile
2. `POST /claim-profile/request` - Send SMS/WhatsApp OTP to registered phone
3. `POST /claim-profile/verify` - Verify OTP, link to user account

### Task 4.4.6: Create Public Claim Landing Page
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
│ [Ente: ERSEP ▼]                        │
│       CACAAV                           │
│       GASNOR                           │
│       GASNEA                           │
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

### Task 4.4.7: Admin Import Dashboard & Scraper Management
**Files to create:**
- `apps/web/app/(dashboard)/admin/unclaimed-profiles/page.tsx`
- `apps/web/app/api/admin/scrapers/run/route.ts`
- `apps/web/app/api/admin/scrapers/status/route.ts`

**Admin can:**
- Trigger scraper runs manually (ERSEP, CACAAV)
- Upload Gasnor/GasNEA PDFs for processing
- View import status and history
- See claim conversion metrics by source
- Monitor scraper health (last run, errors)

**Metrics Dashboard:**
```
┌────────────────────────────────────────────────────────────┐
│ 📊 Unclaimed Profiles - Import Status                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Source          Records   Claimed   Conversion   Last Run │
│  ─────────────────────────────────────────────────────────│
│  ERSEP           1,247     89        7.1%        2h ago   │
│  CACAAV          623       34        5.5%        1d ago   │
│  Gasnor PDF      412       12        2.9%        3d ago   │
│  GasNEA PDF      156       4         2.6%        3d ago   │
│                                                            │
│  [Run ERSEP Scraper] [Run CACAAV Scraper] [Upload PDF]    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria (Phase 4.4 Complete):**
- [ ] UnclaimedProfile schema created with source tracking
- [ ] ERSEP scraper functional (volta.net.ar) - ~33k records
- [ ] CACAAV scraper functional (cacaav.com.ar) - ~23k records
- [ ] Gasnor/GasNEA PDF parser functional (pdfplumber) - ~5k records
- [ ] Search by matricula number
- [ ] Public landing page for claim flow
- [ ] Admin dashboard with scraper management
- [ ] Conversion metrics by source

---

## Phase 4.5: THE ACTIVATION WORKFLOW (🛡️ Trust-First Strategy)
**Estimated Effort:** 2 days
**Priority:** 🔴 CRITICAL (Must launch WITH Phase 4.4)

### Overview: The "Trust Anchor" Problem
Sending unsolicited WhatsApp messages with links is a **phishing red flag**. We need a strategy that builds trust BEFORE asking for action.

**Core Insight:** If someone Googles "CampoTech" and finds our site, they trust us. If we ask them to Google us, we're leveraging their own verification process.

```
TRADITIONAL APPROACH (Risky):          OUR APPROACH (Trust-First):
┌─────────────────────┐                 ┌─────────────────────┐
│ "Click this link"    │                 │ "Google 'CampoTech'" │
│   [suspicious URL]   │                 │   (self-verify)      │
└─────────────────────┘                 └─────────────────────┘
         │                                          │
         ▼                                          ▼
   ❌ IGNORED                              ✅ TRUSTED
   (looks like spam)                      (they verified us)
```

### Task 4.5.1: SEO & Identity Setup (Prerequisite) 🏁
**Goal:** Ensure searching "CampoTech" or "CampoTech Matrícula" ranks #1 on Google immediately.

**Files to create/modify:**
- `apps/web/app/reclamar/page.tsx` (or `/claim`)
- `apps/web/app/sitemap.ts`
- Google Search Console configuration

**Actions:**
1. **Submit sitemap to Google Search Console**
   - Include `/reclamar` landing page
   - Priority: 1.0, changefreq: daily

2. **SEO Metadata for Claim Page:**
   ```tsx
   // apps/web/app/reclamar/page.tsx
   export const metadata: Metadata = {
     title: 'CampoTech | Reclamá tu Perfil de Matriculado',
     description: 'Encontrá y reclamá tu perfil profesional en CampoTech. Verificamos tu matrícula de ERSEP, CACAAV, Gasnor y más.',
     keywords: ['CampoTech', 'matriculado', 'reclamar perfil', 'ERSEP', 'CACAAV', 'gasista', 'electricista'],
     openGraph: {
       title: 'CampoTech - Perfil Profesional Verificado',
       description: 'Tu matrícula ya está en nuestro sistema. Reclamá tu perfil gratuito.',
       url: 'https://campotech.com.ar/reclamar',
     }
   };
   ```

3. **Google Business Profile** (if not exists)
   - Verify business for local search
   - Link to `/reclamar` page

**Acceptance Criteria:**
- [ ] "CampoTech" search shows our site as #1 result
- [ ] "CampoTech matricula" search shows claim page
- [ ] Sitemap submitted and indexed
- [ ] Meta descriptions optimized for trust

---

### Task 4.5.2: The "Trust Anchor" WhatsApp Template 📩
**Goal:** Send outreach messages that prioritize self-verification over direct links.

**Files to create:**
- `apps/web/lib/templates/unclaimed-outreach.ts`
- `apps/web/app/api/admin/outreach/send/route.ts`

**WhatsApp Template (Submit to Meta for Approval):**
```
Template Name: profile_claim_trust_anchor
Category: UTILITY
Language: es_AR

👋 Hola {{1}},

Detectamos que tu matrícula {{2}} figura en los registros públicos de {{3}}.

🔍 **Buscános en Google como "CampoTech"** para ver y reclamar tu perfil de trabajo gratuito.

O accedé directo acá: {{4}}

✅ Sin costo
✅ Sin compromiso  
✅ Tu matrícula ya está verificada

¿Preguntas? Respondé este mensaje.
```

**Template Variables:**
- `{{1}}` = First name (e.g., "Juan")
- `{{2}}` = Matricula number (e.g., "12345")
- `{{3}}` = Authority (e.g., "ERSEP Córdoba")
- `{{4}}` = Short URL (e.g., "campotech.com.ar/r/abc123")

**Key Design Decisions:**
1. **"Buscános en Google"** comes BEFORE the link
2. Uses **third-party validation** (Google) as trust signal
3. Mentions they're in **public records** (transparency)
4. Includes matricula number as **proof we have their data**
5. "Respondé este mensaje" enables **two-way conversation**

**Outreach Throttling Logic:**
```typescript
// apps/web/lib/services/outreach.service.ts
export class OutreachService {
  private readonly DAILY_LIMIT = 1000; // Messages per day
  private readonly BATCH_SIZE = 50;     // Messages per batch
  private readonly BATCH_DELAY = 60000; // 1 minute between batches
  
  async sendCampaign(source: 'ERSEP' | 'CACAAV' | 'GASNOR') {
    const profiles = await this.getUncontactedProfiles(source, this.DAILY_LIMIT);
    
    for (let i = 0; i < profiles.length; i += this.BATCH_SIZE) {
      const batch = profiles.slice(i, i + this.BATCH_SIZE);
      await this.sendBatch(batch);
      await this.delay(this.BATCH_DELAY);
    }
  }
}
```

**Acceptance Criteria:**
- [ ] WhatsApp template submitted to Meta
- [ ] Template approved for UTILITY category
- [ ] Outreach service with rate limiting
- [ ] Tracking: sent, delivered, clicked, claimed
- [ ] "Google search" instruction prioritized in message

---

### Task 4.5.3: The "Pre-Validation" Search Page (✅ Trust Builder) 
**Goal:** When they search, immediately prove we have their data before asking for action.

**URL:** `/reclamar` (primary) or `/claim` (redirect)

**Files to create:**
- `apps/web/app/reclamar/page.tsx`
- `apps/web/app/api/claim/validate/route.ts`
- `apps/web/components/claim/ProfilePreview.tsx`

**UX Flow:**
```
┌────────────────────────────────────────────────┐
│                                                │
│   🔍 Verificá si tu perfil ya existe            │
│                                                │
│   Ingresá tu número de matrícula:              │
│   ┌────────────────────────────────────────┐  │
│   │ 12345                              🔍 │  │
│   └────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
                         │
                         ▼ (API call)
┌────────────────────────────────────────────────┐
│                                                │
│   ✅ ¡Matrícula Verificada!                     │
│                                                │
│   ┌────────────────────────────────────────┐  │
│   │ 👤 Juan P****z                          │  │
│   │    Electricista - ERSEP Córdoba        │  │
│   │    Matrícula: 12345                    │  │
│   │                                        │  │
│   │    📱 Tel: ****-1234                    │  │
│   │    📧 Email: j***@***.com               │  │
│   └────────────────────────────────────────┘  │
│                                                │
│   ¿Este sos vos?                               │
│                                                │
│   [ ✅ Sí, reclamar mi perfil ]                │
│                                                │
└────────────────────────────────────────────────┘
```

**Privacy-First Data Masking:**
```typescript
// apps/web/lib/utils/mask-pii.ts
export function maskName(name: string): string {
  // "Juan Pérez" -> "Juan P****z"
  const parts = name.split(' ');
  return parts.map((part, i) => {
    if (i === 0) return part; // Keep first name
    if (part.length <= 2) return part;
    return part[0] + '****' + part[part.length - 1];
  }).join(' ');
}

export function maskPhone(phone: string): string {
  // "3514123456" -> "****-3456"
  return '****-' + phone.slice(-4);
}

export function maskEmail(email: string): string {
  // "juan@empresa.com" -> "j***@***.com"
  const [local, domain] = email.split('@');
  const [name, tld] = domain.split('.');
  return `${local[0]}***@***.${tld}`;
}
```

**API Response:**
```typescript
// apps/web/app/api/claim/validate/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matricula = searchParams.get('matricula');
  
  const profile = await prisma.unclaimedProfile.findFirst({
    where: {
      matriculaNumber: matricula,
      status: 'unclaimed'
    }
  });
  
  if (!profile) {
    return Response.json({ 
      found: false,
      message: 'No encontramos esta matrícula. ¿Está bien escrita?' 
    });
  }
  
  // Return MASKED data only - prove we have it without exposing PII
  return Response.json({
    found: true,
    preview: {
      name: maskName(profile.fullName),
      type: profile.matriculaType,
      authority: profile.matriculaAuthority,
      phone: profile.phone ? maskPhone(profile.phone) : null,
      email: profile.email ? maskEmail(profile.email) : null,
      province: profile.province,
    },
    claimToken: generateClaimToken(profile.id), // Short-lived token
  });
}
```

**Why This Works (Psychology):**
1. **Instant gratification** - They see their name immediately
2. **Proof we're legit** - We already have their public data
3. **Privacy respected** - Masked data shows we're careful
4. **Low commitment** - Just "confirm this is you"
5. **No login required** - Reduce friction to zero

**Acceptance Criteria:**
- [ ] `/reclamar` page with search box
- [ ] API returns masked preview of profile
- [ ] "Matrícula Verificada" success state
- [ ] Claim button leads to SMS/WhatsApp verification
- [ ] Track: searches, found, not found, claimed
- [ ] Mobile-first responsive design

---

### Task 4.5.4: Claim Verification Flow (SMS/WhatsApp OTP)
**Goal:** Verify ownership of the profile via the phone number on file.

**Files to create:**
- `apps/web/app/api/claim/request-otp/route.ts`
- `apps/web/app/api/claim/verify-otp/route.ts`
- `apps/web/app/reclamar/verificar/page.tsx`

**Flow:**
```
[ Reclamar mi perfil ]
         │
         ▼
┌────────────────────────────────────────┐
│  Enviamos un código al:              │
│  📱 ****-1234                         │
│                                        │
│  [WhatsApp] [SMS]                      │
└────────────────────────────────────────┘
         │
         ▼ (OTP sent)
┌────────────────────────────────────────┐
│  Ingresá el código de 6 dígitos:      │
│                                        │
│  [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ] [ 6 ]  │
│                                        │
│  ¿No lo recibiste? [Reenviar]         │
└────────────────────────────────────────┘
         │
         ▼ (OTP verified)
┌────────────────────────────────────────┐
│  🎉 ¡Perfil Reclamado!                  │
│                                        │
│  Bienvenido a CampoTech, Juan.        │
│  Tu matrícula está verificada.         │
│                                        │
│  [ Completar mi perfil → ]            │
└────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] OTP via WhatsApp (preferred) or SMS
- [ ] 6-digit code, 10-minute expiry
- [ ] Rate limiting: 3 attempts per hour
- [ ] On success: create User, link to profile
- [ ] Redirect to onboarding flow

---

**Acceptance Criteria (Phase 4.5 Complete):**
- [ ] SEO optimized claim page ranking on Google
- [ ] WhatsApp template approved and ready
- [ ] Pre-validation search shows masked preview
- [ ] OTP verification flow working
- [ ] End-to-end claim journey < 2 minutes
- [ ] Tracking: funnel conversion at each step

---

## Growth Engine Metrics Dashboard

**KPIs to Track:**
```
┌────────────────────────────────────────────────────────────────┐
│ 📊 GROWTH ENGINE - Conversion Funnel                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Step                    Count      Rate      Cumulative       │
│  ─────────────────────────────────────────────────────────────  │
│  1. Profiles Imported    61,000     100%      100%             │
│  2. WhatsApp Sent        12,000     19.7%     19.7%            │
│  3. Message Delivered    10,800     90%       17.7%            │
│  4. Link Clicked         1,620      15%       2.7%             │
│  5. Search Performed     1,458      90%       2.4%             │
│  6. Profile Found        1,312      90%       2.2%             │
│  7. Claim Started        919        70%       1.5%             │
│  8. OTP Verified         826        90%       1.4%             │
│  9. Profile Claimed      743        90%       1.2%             │
│                                                                │
│  🎯 Target: 1% claim rate = 610 new users (zero CAC)           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```
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
├── Phase 4: Onboarding & Growth (5 days + 8 days growth)
│   └── 4.1: OAuth Flows (4d)
│   └── 4.2: Dead Code Cleanup (1d)
│   └── 4.3: Digital Entry Badge (5d) ← NEW
│   └── 4.4: The Growth Engine - Data Pipelines (6d) ← NEW
│       └── 4.4.1: Schema Setup (0.5d)
│       └── 4.4.2: ERSEP Scraper - 33k records (1.5d) 🔴 CRITICAL
│       └── 4.4.3: CACAAV Scraper - 23k records (1d)
│       └── 4.4.4: PDF Pipeline - 5k records (1.5d)
│       └── 4.4.5-7: Claim API + Admin UI (1.5d)
│   └── 4.5: The Activation Workflow - Trust-First (2d) ← NEW
│       └── 4.5.1: SEO & Identity Setup (0.5d)
│       └── 4.5.2: Trust Anchor WhatsApp Template (0.5d)
│       └── 4.5.3: Pre-Validation Search Page (0.5d)
│       └── 4.5.4: OTP Verification Flow (0.5d)
└── Phase 5: Voice AI Migration (12.5 days)

NEW TOTAL TIMELINE:
├── Original: 8-10 weeks (42.5 days)
├── Addendum: +21 days (was 19, +2 for activation workflow)
└── New Total: 12-14 weeks (63.5 days)

GROWTH ENGINE IMPACT:
├── Total Profiles to Import: ~61,000 professionals
├── Target Claim Rate: 1% = ~610 new users
├── Cost per Acquisition: $0 (zero CAC)
└── Potential Revenue: 610 × $40/mo = $24,400 MRR
```

---

# FEATURE SUMMARY TABLE

| Feature | Phase | Effort | Files Touched | Priority | Impact |
|---------|-------|--------|---------------|----------|--------|
| Fiscal Health Dashboard | 2.4 | 4 days | 5 new, 2 modified | HIGH | Compliance |
| Digital Entry Badge | 4.3 | 5 days | 8 new, 3 modified | MEDIUM | Differentiation |
| Barcode Scanning | 2.2.4 | 4 days | 4 new, 2 modified | HIGH | Efficiency |
| Growth Engine (Data) | 4.4 | 6 days | 12 new, 1 modified | HIGH | **61k leads** |
| Growth Engine (Activation) | 4.5 | 2 days | 6 new, 2 modified | CRITICAL | **Zero CAC** |


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
    └── Requires: Python 3.9+ with pdfplumber (for PDF parsing)
    └── Requires: Playwright or JSDOM (for web scraping)
```

---

# RISK ASSESSMENT

| Feature | Risk | Mitigation |
|---------|------|------------|
| Fiscal Health | Monotributo limits change annually | Easy constant update, add AFIP update reminder |
| Digital Badge | ART verification accuracy | Manual admin review option, clear disclaimers |
| Barcode Scanner | Camera compatibility on low-end devices | Fallback to manual SKU entry |
| Unclaimed Profiles | Privacy concerns with public data | Only use publicly available matricula data, clear consent |
| **ERSEP/CACAAV Scrapers** | **DOM structure changes break scraper** | **Build with try/catch, log errors, add health monitoring. Scrapers should fail gracefully and alert admin.** |
| **ERSEP/CACAAV Scrapers** | **Rate limiting / IP blocking** | **Implement 1 req/sec throttling, rotate user agents, consider proxy rotation for production** |
| **PDF Pipeline** | **PDF format changes** | **Table extraction is format-dependent. Keep original PDFs, log extraction issues per page** |

