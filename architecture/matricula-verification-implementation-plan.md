# Matrícula Verification Implementation Plan
## CampoTech Professional Credential Verification System

**Created:** 2026-01-17
**Updated:** 2026-01-17
**Status:** ✅ Complete
**Priority:** High (Marketplace Differentiator)

---

## Executive Summary

This plan outlines the implementation of automatic matrícula verification against public registries (Gasnor, GasNEA) and eventually ERSEP, providing a competitive advantage for CampoTech's marketplace by offering verified professional credentials.

---

## 1. Current State Analysis

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| **Badge UI Components** | ✅ Complete | `components/verification/BadgesGrid.tsx` |
| **Verification Center** | ✅ Complete | `/dashboard/verificacion` |
| **Auto-Verifier Service** | ✅ Complete | `lib/services/auto-verifier.ts` |
| **Scrapers Infrastructure** | ✅ Complete | `lib/scrapers/*.ts` |
| **Approval System** | ✅ Complete | `/dashboard/approvals` |
| **Marketplace Moderation** | ✅ Complete | `/dashboard/marketplace/moderation` |
| **Admin Verification Queue** | ✅ Complete | `/dashboard/admin/verification-queue` |
| **Verification Queue API** | ✅ Complete | `/api/admin/verification-queue` |
| **VerificationRegistry Model** | ✅ Complete | `prisma/schema.prisma` |
| **Registry Populate Script** | ✅ Complete | `scripts/populate-verification-registry.ts` |
| **Registry Auto-Verification** | ✅ Complete | `lib/services/auto-verifier.ts` |
| **CredentialBadge Components** | ✅ Complete | `components/verification/CredentialBadge.tsx` |
| **Public Profile Badge Display** | ✅ Complete | `app/p/[slug]/page.tsx` |
| **Registry Search API** | ✅ Complete | `/api/admin/verification-queue/registry-search` |
| **Profile Claim Auto-Grant** | ✅ Complete | `lib/services/unclaimed-profile.service.ts` |

### Who Reviews/Approves What

| Approval Type | Who Approves | Dashboard Location |
|---------------|--------------|-------------------|
| **Price Changes** | Organization Owner | `/dashboard/approvals` |
| **Job Modifications** | Organization Owner | `/dashboard/approvals` |
| **Marketplace Reviews** | CampoTech Admin (YOU) | `/dashboard/marketplace/moderation` |
| **Matrícula Badges** | Currently: CampoTech Admin | NEW: Auto-verify + fallback |

### Data Available for Verification

| Source | Records | Specialties | Status |
|--------|---------|-------------|--------|
| **Gasnor/Naturgy** | ~3,000 | Gasista | 🟢 Scraper ready |
| **GasNEA** | ~3,500 | Gasista | 🟢 Scraper ready |
| **ERSEP (Córdoba)** | ~33,000 | Electricista | 🟡 Needs access from Argentina |
| **CACAAV** | ~23,000 (limited) | Refrigeración | 🟡 Website limits public data - needs account or request |

**Total Available Now:** ~6,500 (Gasnor + GasNEA)
**Total Potential:** ~60,000+ (after ERSEP + CACAAV access)

**Note:** Previous scraped data was lost in a cleanup. Scripts exist to re-scrape.

---

## 2. Approval Flow Clarification

### Organization-Level Approvals (OWNER approves)
```
Organization Owner/ADMIN → /dashboard/approvals
├── Price changes
├── Job modifications  
├── Employee attribute changes
└── Vehicle updates
```

### Platform-Level Moderation (YOU/CampoTech Admin approve)
```
CampoTech Admin → /dashboard/marketplace/moderation
├── Marketplace review moderation
├── Fraud detection
└── Quality control

CampoTech Admin → NEW: /dashboard/admin/verification-queue
├── Matrícula submissions NOT found in registry
├── Manual document review
└── Simple Approve/Reject (no grace period needed)
```

### Manual Review Policy
- If matrícula not in registry → Manual review required
- If you can verify → Approve
- If you can't verify → Reject
- No grace period - simple yes/no decision
- User can contact Gasnor/ERSEP directly if rejected

---

## 3. Implementation Phases

### Phase 1: Registry Database & Scraping (Week 1)
**Goal:** Populate the database with verifiable matrículas

#### 1.1 Run Gasnor + GasNEA Scrapers
```bash
# Run scraper to populate unclaimed_profiles table
pnpm tsx scripts/scrape-gasnor.ts
pnpm tsx scripts/scrape-gasnea.ts
```

#### 1.2 Create Verification Registry Table
```prisma
model VerificationRegistry {
  id            String   @id @default(cuid())
  matricula     String   // e.g., "MG-12345"
  specialty     String   // GASISTA, ELECTRICISTA, REFRIGERACION
  source        String   // GASNOR, GASNEA, ERSEP, CACAAV
  fullName      String?  
  province      String?
  status        String   @default("active") // active, expired, suspended
  scrapedAt     DateTime @default(now())
  lastVerified  DateTime @default(now())
  
  @@unique([matricula, source])
  @@index([matricula])
  @@index([specialty])
  @@map("verification_registry")
}
```

#### 1.3 Migrate Scraped Data to Registry
- Copy from `unclaimed_profiles` to `verification_registry`
- Keep only essential verification fields

---

### Phase 2: Auto-Verification Logic (Week 1-2)
**Goal:** Enable automatic verification against registry

#### 2.1 Update Verification Requirements Seed
```typescript
// In seed-verification-requirements.ts
{
  code: 'gas_matricula',
  name: 'Matrícula de Gasista',
  autoVerifySource: 'registry',  // CHANGED from null
  // ...
}
```

#### 2.2 Add Registry Verification to AutoVerifier
```typescript
// In auto-verifier.ts
case 'registry':
  return this.verifyAgainstRegistry(submission);

private async verifyAgainstRegistry(
  submission: VerificationSubmission
): Promise<AutoVerifyResult> {
  const matricula = submission.submittedValue;
  const specialty = this.getSpecialtyFromCode(submission.requirement.code);
  
  const match = await prisma.verificationRegistry.findFirst({
    where: {
      matricula: { equals: matricula, mode: 'insensitive' },
      specialty: specialty,
      status: 'active',
    }
  });
  
  if (match) {
    return {
      success: true,
      shouldApprove: true,
      needsReview: false,
      reason: `Matrícula verificada en registro ${match.source}`,
      verificationData: {
        source: match.source,
        matricula: matricula,
        registryName: match.fullName,
        verifiedAt: new Date().toISOString(),
        registryUrl: this.getRegistryUrl(match.source),
      }
    };
  }
  
  // Not found - requires manual review
  return {
    success: true,
    shouldApprove: false,
    needsReview: true,
    reason: 'Matrícula no encontrada en registros públicos',
  };
}
```

#### 2.3 Specialty Code Mapping
```typescript
private getSpecialtyFromCode(requirementCode: string): string {
  const map: Record<string, string> = {
    'gas_matricula': 'GASISTA',
    'electrician_matricula': 'ELECTRICISTA',
    'plumber_matricula': 'PLOMERO',
    'refrigeration_license': 'REFRIGERACION',
  };
  return map[requirementCode] || 'UNKNOWN';
}
```

---

### Phase 3: Admin Verification Dashboard ✅ COMPLETE
**Goal:** Create interface for manual review of non-automated verifications

#### 3.1 Create Admin Verification Queue Page ✅
**Route:** `/dashboard/admin/verification-queue`

```typescript
// Features:
- List pending verification submissions
- Filter by: specialty, status, age
- View uploaded documents
- Approve / Reject with reason
- Link to registry search (if close match found)
```

#### 3.2 Page Structure
```
/dashboard/admin/verification-moderation
├── Stats Cards (pending, approved today, rejected today)
├── Filter Bar (specialty, status, date range)
├── Queue List
│   ├── Submission Card
│   │   ├── Organizacion info
│   │   ├── Submitted matricula
│   │   ├── Uploaded document preview
│   │   ├── "Search Registry" button
│   │   └── Approve / Reject buttons
│   └── ...more cards
└── Bulk Actions (approve selected)
```

#### 3.3 API Endpoints ✅
```
GET  /api/admin/verification-queue              ✅ Implemented
POST /api/admin/verification-queue/[id]/approve ✅ Implemented
POST /api/admin/verification-queue/[id]/reject  ✅ Implemented
GET  /api/admin/verification-queue/registry-search (Future)
```

---

### Phase 4: Marketplace Badge Display (Week 3)
**Goal:** Show verified badges in marketplace profiles

#### 4.1 Badge Display Logic
```typescript
// In marketplace profile display
function CredentialBadge({ credential }) {
  const variant = {
    registry_verified: {
      icon: 'verified',
      color: 'success',
      tooltip: `Verificado en ${credential.source}`,
    },
    manually_verified: {
      icon: 'check',
      color: 'primary',
      tooltip: 'Verificado por CampoTech',
    },
    self_declared: {
      icon: 'info',
      color: 'gray',
      tooltip: 'Declarado, no verificado',
    },
  }[credential.verificationType];
  
  return <Badge {...variant} />;
}
```

#### 4.2 Verification Level Display
| Level | Badge | Tooltip |
|-------|-------|---------|
| **Registry Verified** | ✅ Green check | "Matrícula verificada en registro oficial (Gasnor)" |
| **Manually Verified** | ✓ Blue check | "Verificado por CampoTech" |
| **Self-Declared** | ℹ Gray | "Dato proporcionado por el profesional" |

---

### Phase 5: Profile Claim Auto-Verification (Week 3-4)
**Goal:** When scraped profiles claim their account, auto-grant badges

#### 5.1 Profile Claim Flow Enhancement
```typescript
// When user claims a scraped profile:
async function processProfileClaim(userId, unclaimedProfileId) {
  const profile = await prisma.unclaimedProfile.findUnique({
    where: { id: unclaimedProfileId }
  });
  
  // Auto-verify and grant badge
  if (profile.matricula && profile.source) {
    await grantMatriculaBadge(userId, {
      matricula: profile.matricula,
      specialty: profile.specialty,
      source: profile.source,
      verificationMethod: 'registry_claim',
    });
  }
}
```

---

## 4. Admin Access Locations

### Where YOU (CampoTech Admin) Review Things:

| What | Location | Access |
|------|----------|--------|
| **Marketplace Reviews** | `/dashboard/marketplace/moderation` | 🟢 Exists |
| **Matrícula Verifications** | `/dashboard/admin/verification-queue` | � **NEW - Implemented** |
| **Growth Engine / Scrapers** | `/dashboard/admin/growth-engine` | 🟢 Exists |
| **System Health** | `/dashboard/admin/health` | 🟢 Exists |
| **Audit Logs** | `/dashboard/admin/audit-logs` | 🟢 Exists |

### Where Organization OWNERS Review Things:

| What | Location |
|------|----------|
| **Price/Job Approvals** | `/dashboard/approvals` |
| **Their Own Verification Status** | `/dashboard/verificacion` |
| **Employee Verifications** | `/dashboard/verificacion` (employees tab) |

---

## 5. Verification Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER SUBMITS MATRÍCULA                          │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   AUTO-VERIFIER CHECKS REGISTRY                     │
│                                                                     │
│   SELECT * FROM verification_registry                               │
│   WHERE matricula = '...' AND specialty = '...'                     │
└─────────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
     ┌────────────────┐                 ┌────────────────┐
     │   FOUND ✅      │                 │  NOT FOUND ❌   │
     │                │                 │                │
     │ Auto-Approve   │                 │ Manual Review  │
     │ Grant Badge    │                 │ Required       │
     │ Show: "Registro│                 │                │
     │      Gasnor"   │                 │ → Send to Admin│
     └────────────────┘                 │   Queue        │
                                        └────────────────┘
                                                │
                                                ▼
                                  ┌──────────────────────┐
                                  │  ADMIN REVIEWS       │
                                  │                      │
                                  │  /dashboard/admin/   │
                                  │  verification-       │
                                  │  moderation          │
                                  └──────────────────────┘
                                                │
                              ┌─────────────────┴─────────────────┐
                              │                                   │
                              ▼                                   ▼
                     ┌────────────────┐                 ┌────────────────┐
                     │   APPROVE      │                 │   REJECT       │
                     │                │                 │                │
                     │ Grant Badge    │                 │ Notify User    │
                     │ Show:"CampoTech│                 │ Request Docs   │
                     │      Verified" │                 │                │
                     └────────────────┘                 └────────────────┘
```

---

## 6. Technical Checklist

### Phase 1: Database ✅ PARTIAL
- [x] Create `verification_registry` table migration (via db push)
- [x] Create populate script: `scripts/populate-verification-registry.ts`
- [ ] Run Gasnor scraper
- [ ] Run GasNEA scraper  
- [ ] Populate registry from scraped data

### Phase 2: Auto-Verification ✅ COMPLETE
- [x] Add `registry` case to auto-verifier
- [x] Implement `verifyAgainstRegistry()` method with Prisma lookup
- [x] Add helper methods: `getSpecialtyFromRequirementCode()`, `getRegistryUrl()`
- [x] Update seed to set `autoVerifySource: 'registry'` for gas, electrician, plumber badges
- [x] Re-seed verification requirements (26 requirements updated)

### Phase 3: Admin Dashboard ✅ COMPLETE
- [x] Create `/dashboard/admin/verification-queue` page
- [x] Create moderation queue API
- [x] Create approve/reject endpoints
- [x] Create registry search endpoint
- [x] Add registry search panel to admin queue page
- [x] Add admin panel navigation link

### Phase 4: Marketplace Display ✅ COMPLETE
- [x] Create `CredentialBadge` component with verification levels
- [x] Create `CredentialVerificationCard` for detailed display
- [x] Create `CredentialBadgeList` for badge collections
- [x] Add `VerificationDisclaimer` component
- [x] Update public profile `/p/[slug]` to fetch approved badges
- [x] Add inline badges in profile header
- [x] Add verification section with credential cards
- [x] Add verification level indicator (registry/manual/self-declared)
- [x] Add tooltips with source info (Gasnor, ERSEP, etc.)

### Phase 5: Profile Claim ✅ COMPLETE
- [x] Enhance `verifyClaim()` to auto-grant badges after claim
- [x] Add `autoGrantMatriculaBadge()` method to create approved submissions
- [x] Add `getRequirementCodeFromProfession()` to map professions to badge codes
- [x] Support `registry_claim` verification method
- [x] Update public profile to recognize `registry_claim` as registry-verified

---

## 7. Legal Considerations

### What CampoTech IS Doing:
- Matching submitted matrículas against public registry data
- Displaying source of verification (Gasnor, ERSEP, etc.)
- Timestamping verification

### What CampoTech is NOT Doing:
- Guaranteeing professional competence
- Verifying current validity (just that matrícula existed in registry)
- Taking responsibility for work performed

### Recommended Disclaimer (shown on badges):
> "Matrícula verificada contra registro público de [SOURCE]. Última sincronización: [DATE]. Para verificar vigencia actual, consulte el registro oficial."

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Auto-verification rate | >80% of submissions in covered areas |
| Manual review queue | <50 per week |
| Time to verification | <24 hours average |
| Marketplace trust score | Measurable increase in conversions |

---

## Next Steps

1. **Immediate:** Run Gasnor + GasNEA scrapers
2. **This Week:** Implement Phase 1 + 2 (Database + Auto-Verify)
3. **Next Week:** Implement Phase 3 (Admin Dashboard)
4. **Following:** Phase 4 + 5 (Display + Claim)

---

## Questions for Product Decision

1. **Grace Period:** If a matrícula expires from registry, how long until badge is removed?
2. **Partial Match:** If name doesn't match but matrícula does, auto-approve or review?
3. **Non-Covered Areas:** For locations without scraper data, show "Self-Declared" badge?
