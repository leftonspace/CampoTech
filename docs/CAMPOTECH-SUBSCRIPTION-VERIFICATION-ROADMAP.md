# CampoTech Subscription & Verification System - Complete Implementation Roadmap

## Overview

This document provides the complete implementation roadmap for two critical, interconnected systems:
1. **Subscription Billing System** - Handles trials, payments, and subscription management
2. **Verification & Compliance System** - Handles identity verification, document management, and legal compliance

These systems work together to control platform access:
- Users need BOTH an active subscription AND verified status to operate fully
- Each system has its own blocking logic, but they share a unified access control layer

---

## System Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED ACCESS CONTROL                              │
│                                                                             │
│  canAccessPlatform = hasActiveSubscription AND isVerified                  │
│  canReceiveJobs = canAccessPlatform AND verificationTier2Complete          │
│  canAssignEmployee = employee.isVerified                                   │
│  isMarketplaceVisible = canReceiveJobs AND noActiveBlocks                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                               │
        ┌───────────┴───────────┐       ┌──────────┴───────────┐
        │   SUBSCRIPTION        │       │   VERIFICATION       │
        │   SYSTEM              │       │   SYSTEM             │
        │                       │       │                      │
        │ • Trial management    │       │ • Document upload    │
        │ • Payment processing  │       │ • AFIP validation    │
        │ • Plan upgrades       │       │ • Employee verify    │
        │ • Billing cycles      │       │ • Expiration alerts  │
        │ • Cancellation        │       │ • Compliance badges  │
        └───────────────────────┘       └──────────────────────┘
```

---

## Business Rules

### Access Levels

| Scenario | Can Access Dashboard | Can Receive Jobs | In Marketplace |
|----------|---------------------|------------------|----------------|
| Trial active + Not verified | ✅ Limited | ❌ | ❌ |
| Trial active + Verified | ✅ Full | ✅ | ✅ |
| Trial expired + Not paid | ❌ Billing page only | ❌ | ❌ |
| Paid + Not verified | ✅ Limited | ❌ | ❌ |
| Paid + Verified | ✅ Full | ✅ | ✅ |
| Paid + Verification expired | ✅ Limited | ❌ | ❌ |
| Subscription cancelled | ✅ Until period end | ✅ Until period end | ❌ |

### Onboarding Flow

```
1. Signup (email + phone)
       ↓
2. Trial starts (14 days)
       ↓
3. Verification prompt shown
   "Completá tu verificación para empezar a trabajar"
       ↓
4. User completes Tier 2 verification
   • CUIT validation (AFIP)
   • DNI upload
   • Selfie verification
   • Legal acknowledgments
       ↓
5. User can now receive jobs (during trial)
       ↓
6. Trial ending → Payment prompt
       ↓
7. Payment completed → Full access continues
```

---

## Phase Overview

| Phase | Name | Prompts | Description |
|-------|------|---------|-------------|
| 0 | Discovery | 1 | Analyze existing codebase |
| 1 | Database Foundation | 2-3 | Schema for both systems |
| 2 | Subscription Core | 4-6 | Trial, checkout, webhooks |
| 3 | Verification Core | 7-10 | Requirements, submissions, AFIP |
| 4 | Access Control | 11-12 | Unified middleware, blocking |
| 5 | Owner Dashboard | 13-15 | Billing UI, verification UI |
| 6 | Employee System | 16-17 | Employee verification portal |
| 7 | Admin Panel | 18-20 | Review queue, subscription management |
| 8 | Notifications | 21-22 | Reminders, alerts |
| 9 | Integration | 23-24 | Combined flows, edge cases |
| 10 | Testing & Launch | 25 | Full testing, go-live |

**Total: 25 Prompts**

---

# PHASE 0: Discovery

## 0.1 Codebase Analysis

**Objective:** Understand existing implementation before making changes.

### Task 0.1.1: Database Schema Review
- [ ] Review `prisma/schema.prisma` for existing models
- [ ] Document current `organizations` table fields
- [ ] Document current `users` table fields
- [ ] Check for any existing subscription-related tables
- [ ] Check for any existing verification-related tables
- [ ] Document existing enum types

### Task 0.1.2: Authentication & Middleware Review
- [ ] Review current authentication flow
- [ ] Review existing middleware
- [ ] Document current access control patterns
- [ ] Identify where to inject new checks

### Task 0.1.3: Admin Panel Review
- [ ] Review existing admin panel structure
- [ ] Document current admin routes
- [ ] Identify existing admin components to extend
- [ ] Check for existing payment/subscription views

### Task 0.1.4: Notification System Review
- [ ] Check for existing email sending infrastructure
- [ ] Check for existing SMS/WhatsApp integration
- [ ] Review existing notification patterns
- [ ] Document cron job setup (if any)

**Output:** Create `docs/EXISTING-CODEBASE-ANALYSIS.md` with findings

---

# PHASE 1: Database Foundation

## 1.1 Subscription Database Schema

**Objective:** Create all subscription-related tables.

### Task 1.1.1: Create Subscription Tables Migration
```sql
-- organization_subscriptions
CREATE TABLE organization_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'INICIAL', 'PROFESIONAL', 'EMPRESA')),
  billing_cycle TEXT CHECK (billing_cycle IN ('MONTHLY', 'YEARLY')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'paused')),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  mp_subscription_id TEXT,
  mp_payer_id TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- subscription_payments
CREATE TABLE subscription_payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL REFERENCES organization_subscriptions(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  payment_method TEXT,
  payment_type TEXT,
  mp_payment_id TEXT,
  mp_preference_id TEXT,
  billing_cycle TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- subscription_events (audit log)
CREATE TABLE subscription_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL REFERENCES organization_subscriptions(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_org_subscriptions_org ON organization_subscriptions(organization_id);
CREATE INDEX idx_sub_payments_sub ON subscription_payments(subscription_id);
CREATE INDEX idx_sub_payments_org ON subscription_payments(organization_id);
CREATE INDEX idx_sub_payments_status ON subscription_payments(status);
CREATE INDEX idx_sub_events_sub ON subscription_events(subscription_id);
```

### Task 1.1.2: Update Organizations Table for Subscription
```sql
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
```

### Task 1.1.3: Update Prisma Schema
- [ ] Add `OrganizationSubscription` model
- [ ] Add `SubscriptionPayment` model  
- [ ] Add `SubscriptionEvent` model
- [ ] Add relations to `Organization` model
- [ ] Add enums: `SubscriptionTier`, `SubscriptionStatus`, `PaymentStatus`

---

## 1.2 Verification Database Schema

**Objective:** Create all verification-related tables.

### Task 1.2.1: Create Verification Tables Migration
```sql
-- verification_requirements (master list)
CREATE TABLE verification_requirements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('identity', 'business', 'professional', 'insurance', 'background', 'financial')),
  applies_to TEXT NOT NULL CHECK (applies_to IN ('organization', 'owner', 'employee')),
  tier INTEGER NOT NULL DEFAULT 2,
  is_required BOOLEAN NOT NULL DEFAULT true,
  requires_document BOOLEAN NOT NULL DEFAULT false,
  requires_expiration BOOLEAN NOT NULL DEFAULT false,
  auto_verify_source TEXT,
  renewal_period_days INTEGER,
  reminder_days_before INTEGER[] DEFAULT '{30,14,7,1}',
  grace_period_days INTEGER DEFAULT 7,
  badge_icon TEXT,
  badge_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- verification_submissions
CREATE TABLE verification_submissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  requirement_id TEXT NOT NULL REFERENCES verification_requirements(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'expired')),
  submitted_value TEXT,
  document_url TEXT,
  document_type TEXT,
  verified_at TIMESTAMPTZ,
  verified_by TEXT CHECK (verified_by IN ('auto', 'admin')),
  verified_by_user_id TEXT,
  expires_at DATE,
  expiry_notified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  auto_verify_response JSONB,
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- verification_reminders
CREATE TABLE verification_reminders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id TEXT NOT NULL REFERENCES verification_submissions(id),
  recipient_user_id TEXT NOT NULL REFERENCES users(id),
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('expiring_soon', 'expired', 'action_required', 'renewal_due')),
  days_until_expiry INTEGER,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'in_app', 'sms', 'whatsapp')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- compliance_acknowledgments
CREATE TABLE compliance_acknowledgments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  acknowledgment_type TEXT NOT NULL CHECK (acknowledgment_type IN ('terms_of_service', 'verification_responsibility', 'employee_responsibility', 'data_accuracy', 'update_obligation')),
  version TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- compliance_blocks
CREATE TABLE compliance_blocks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT REFERENCES users(id),
  block_type TEXT NOT NULL CHECK (block_type IN ('soft_block', 'hard_block')),
  reason TEXT NOT NULL,
  related_submission_id TEXT REFERENCES verification_submissions(id),
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unblocked_at TIMESTAMPTZ,
  unblocked_by TEXT
);

-- Indexes
CREATE INDEX idx_ver_submissions_org ON verification_submissions(organization_id);
CREATE INDEX idx_ver_submissions_user ON verification_submissions(user_id);
CREATE INDEX idx_ver_submissions_status ON verification_submissions(status);
CREATE INDEX idx_ver_submissions_expires ON verification_submissions(expires_at);
CREATE INDEX idx_ver_reminders_recipient ON verification_reminders(recipient_user_id);
CREATE INDEX idx_compliance_blocks_org ON compliance_blocks(organization_id);
```

### Task 1.2.2: Update Organizations Table for Verification
```sql
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'partial', 'verified', 'suspended')),
  ADD COLUMN IF NOT EXISTS verification_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketplace_visible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_receive_jobs BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_compliance_check TIMESTAMPTZ;
```

### Task 1.2.3: Update Users Table for Verification
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'suspended')),
  ADD COLUMN IF NOT EXISTS verification_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS can_be_assigned_jobs BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT false;
```

### Task 1.2.4: Update Prisma Schema for Verification
- [ ] Add `VerificationRequirement` model
- [ ] Add `VerificationSubmission` model
- [ ] Add `VerificationReminder` model
- [ ] Add `ComplianceAcknowledgment` model
- [ ] Add `ComplianceBlock` model
- [ ] Add verification fields to `Organization` model
- [ ] Add verification fields to `User` model

---

## 1.3 Seed Data

### Task 1.3.1: Seed Verification Requirements
```typescript
const verificationRequirements = [
  // Tier 2 - Required for business
  {
    code: 'owner_cuit',
    name: 'CUIT del Negocio',
    description: 'Clave Única de Identificación Tributaria',
    category: 'business',
    applies_to: 'organization',
    tier: 2,
    is_required: true,
    requires_document: false,
    auto_verify_source: 'afip',
  },
  {
    code: 'afip_status',
    name: 'Estado AFIP Activo',
    description: 'Verificación de estado activo en AFIP',
    category: 'business',
    applies_to: 'organization',
    tier: 2,
    is_required: true,
    auto_verify_source: 'afip',
    renewal_period_days: 30,
  },
  {
    code: 'activity_code_match',
    name: 'Actividad Registrada',
    description: 'Código de actividad coincide con servicios ofrecidos',
    category: 'business',
    applies_to: 'organization',
    tier: 2,
    is_required: true,
    auto_verify_source: 'afip',
  },
  {
    code: 'owner_dni',
    name: 'DNI del Titular',
    description: 'Documento Nacional de Identidad',
    category: 'identity',
    applies_to: 'owner',
    tier: 2,
    is_required: true,
    requires_document: true,
  },
  {
    code: 'owner_dni_selfie',
    name: 'Selfie con DNI',
    description: 'Foto sosteniendo el DNI',
    category: 'identity',
    applies_to: 'owner',
    tier: 2,
    is_required: true,
    requires_document: true,
  },
  {
    code: 'business_address',
    name: 'Domicilio Fiscal',
    description: 'Dirección del negocio',
    category: 'business',
    applies_to: 'organization',
    tier: 2,
    is_required: true,
    auto_verify_source: 'afip',
  },
  
  // Tier 3 - Required for employees
  {
    code: 'employee_cuil',
    name: 'CUIL del Empleado',
    description: 'Clave Única de Identificación Laboral',
    category: 'identity',
    applies_to: 'employee',
    tier: 3,
    is_required: true,
    auto_verify_source: 'afip',
  },
  {
    code: 'employee_dni',
    name: 'DNI del Empleado',
    description: 'Documento Nacional de Identidad',
    category: 'identity',
    applies_to: 'employee',
    tier: 3,
    is_required: true,
    requires_document: true,
  },
  {
    code: 'employee_dni_selfie',
    name: 'Selfie con DNI',
    description: 'Foto del empleado sosteniendo su DNI',
    category: 'identity',
    applies_to: 'employee',
    tier: 3,
    is_required: true,
    requires_document: true,
  },
  {
    code: 'employee_phone',
    name: 'Teléfono Verificado',
    description: 'Número de teléfono confirmado por SMS',
    category: 'identity',
    applies_to: 'employee',
    tier: 3,
    is_required: true,
    auto_verify_source: 'sms',
  },
  
  // Tier 4 - Optional badges
  {
    code: 'gas_matricula',
    name: 'Matrícula de Gasista',
    description: 'Registro en ENARGAS',
    category: 'professional',
    applies_to: 'organization',
    tier: 4,
    is_required: false,
    requires_document: true,
    requires_expiration: true,
    renewal_period_days: 365,
    badge_icon: 'flame',
    badge_label: 'Gasista Matriculado',
  },
  {
    code: 'electrician_matricula',
    name: 'Matrícula de Electricista',
    description: 'Registro de Instalador Electricista',
    category: 'professional',
    applies_to: 'organization',
    tier: 4,
    is_required: false,
    requires_document: true,
    requires_expiration: true,
    renewal_period_days: 365,
    badge_icon: 'zap',
    badge_label: 'Electricista Matriculado',
  },
  {
    code: 'antecedentes_owner',
    name: 'Certificado de Antecedentes (Titular)',
    description: 'Certificado del Registro Nacional de Reincidencia',
    category: 'background',
    applies_to: 'owner',
    tier: 4,
    is_required: false,
    requires_document: true,
    requires_expiration: true,
    renewal_period_days: 180,
    badge_icon: 'shield-check',
    badge_label: 'Antecedentes Verificados',
  },
  {
    code: 'antecedentes_employee',
    name: 'Certificado de Antecedentes (Empleado)',
    description: 'Certificado del Registro Nacional de Reincidencia',
    category: 'background',
    applies_to: 'employee',
    tier: 4,
    is_required: false,
    requires_document: true,
    requires_expiration: true,
    renewal_period_days: 180,
  },
  {
    code: 'seguro_responsabilidad_civil',
    name: 'Seguro de Responsabilidad Civil',
    description: 'Póliza de seguro vigente',
    category: 'insurance',
    applies_to: 'organization',
    tier: 4,
    is_required: false,
    requires_document: true,
    requires_expiration: true,
    renewal_period_days: 365,
    badge_icon: 'shield',
    badge_label: 'Asegurado',
  },
  {
    code: 'art_certificate',
    name: 'Certificado ART',
    description: 'Aseguradora de Riesgos del Trabajo',
    category: 'insurance',
    applies_to: 'organization',
    tier: 4,
    is_required: false,
    requires_document: true,
    requires_expiration: true,
    renewal_period_days: 30,
  },
  {
    code: 'constancia_afip',
    name: 'Constancia de Inscripción AFIP',
    description: 'Documento completo de AFIP',
    category: 'financial',
    applies_to: 'organization',
    tier: 4,
    is_required: false,
    requires_document: true,
    requires_expiration: true,
    renewal_period_days: 90,
    badge_icon: 'file-check',
    badge_label: 'Fiscalmente al Día',
  },
  {
    code: 'habilitacion_municipal',
    name: 'Habilitación Municipal',
    description: 'Permiso comercial municipal',
    category: 'business',
    applies_to: 'organization',
    tier: 4,
    is_required: false,
    requires_document: true,
    requires_expiration: true,
    renewal_period_days: 365,
    badge_icon: 'building',
    badge_label: 'Habilitación Municipal',
  },
];
```

---

# PHASE 2: Subscription Core

## 2.1 Trial System

### Task 2.1.1: Create Trial Manager Service
```typescript
// lib/services/trial-manager.ts
export class TrialManager {
  async createTrial(organizationId: string): Promise<OrganizationSubscription>
  async isTrialActive(organizationId: string): Promise<boolean>
  async getTrialDaysRemaining(organizationId: string): Promise<number>
  async isTrialExpired(organizationId: string): Promise<boolean>
  async expireTrial(organizationId: string): Promise<void>
}
```

### Task 2.1.2: Update Signup Flow
- [ ] After organization creation, call `trialManager.createTrial()`
- [ ] Set trial_ends_at to 14 days from now
- [ ] Set status to 'trialing'
- [ ] Log subscription event

### Task 2.1.3: Create Trial Status Component
- [ ] Banner showing trial days remaining
- [ ] Upgrade CTA button
- [ ] Different states: active, expiring soon, expired

### Task 2.1.4: Create Trial Expiration Cron Job
- [ ] Run daily at midnight Buenos Aires time
- [ ] Find expired trials without payment
- [ ] Update status to 'expired'
- [ ] Create compliance block if needed

---

## 2.2 MercadoPago Integration

### Task 2.2.1: Configure MercadoPago SDK
```typescript
// lib/mercadopago/client.ts
import MercadoPago from 'mercadopago';

export const mpClient = new MercadoPago({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export const SUBSCRIPTION_PLANS = {
  INICIAL: {
    MONTHLY: { price: 25000, mp_plan_id: process.env.MP_PLAN_INICIAL_MONTHLY },
    YEARLY: { price: 250000, mp_plan_id: process.env.MP_PLAN_INICIAL_YEARLY },
  },
  PROFESIONAL: {
    MONTHLY: { price: 55000, mp_plan_id: process.env.MP_PLAN_PROFESIONAL_MONTHLY },
    YEARLY: { price: 550000, mp_plan_id: process.env.MP_PLAN_PROFESIONAL_YEARLY },
  },
  EMPRESA: {
    MONTHLY: { price: 120000, mp_plan_id: process.env.MP_PLAN_EMPRESA_MONTHLY },
    YEARLY: { price: 1200000, mp_plan_id: process.env.MP_PLAN_EMPRESA_YEARLY },
  },
};
```

### Task 2.2.2: Create Checkout Preference Builder
```typescript
// lib/mercadopago/checkout.ts
export async function createCheckoutPreference(
  organizationId: string,
  tier: SubscriptionTier,
  billingCycle: 'MONTHLY' | 'YEARLY'
): Promise<{ checkoutUrl: string; preferenceId: string }>
```

### Task 2.2.3: Create Checkout API Endpoint
- [ ] `POST /api/subscription/checkout`
- [ ] Validate organization exists
- [ ] Create MP preference
- [ ] Return checkout URL

### Task 2.2.4: Create Checkout Success/Failure/Pending Pages
- [ ] `/dashboard/settings/billing/success`
- [ ] `/dashboard/settings/billing/failure`
- [ ] `/dashboard/settings/billing/pending`

---

## 2.3 Webhook Processing

### Task 2.3.1: Create Webhook Endpoint
- [ ] `POST /api/webhooks/mercadopago`
- [ ] Validate HMAC signature
- [ ] Handle idempotency

### Task 2.3.2: Handle Payment Events
```typescript
// Handlers for each event type
async function handlePaymentApproved(data: PaymentData): Promise<void>
async function handlePaymentRejected(data: PaymentData): Promise<void>
async function handlePaymentPending(data: PaymentData): Promise<void>
async function handlePaymentRefunded(data: PaymentData): Promise<void>
async function handleSubscriptionUpdated(data: SubscriptionData): Promise<void>
```

### Task 2.3.3: Create Payment Processing Service
```typescript
// lib/services/payment-processor.ts
export class PaymentProcessor {
  async processApprovedPayment(paymentId: string): Promise<void>
  async processFailedPayment(paymentId: string, reason: string): Promise<void>
  async processPendingPayment(paymentId: string): Promise<void>
  async processRefund(paymentId: string): Promise<void>
}
```

---

# PHASE 3: Verification Core

## 3.1 AFIP Integration

### Task 3.1.1: Create AFIP Client
```typescript
// lib/afip/client.ts
export class AFIPClient {
  async validateCUIT(cuit: string): Promise<CUITValidationResult>
  async getPersonaInfo(cuit: string): Promise<AFIPPersonaInfo>
  async checkActiveStatus(cuit: string): Promise<boolean>
  async getActivityCodes(cuit: string): Promise<string[]>
}

interface CUITValidationResult {
  isValid: boolean;
  exists: boolean;
  isActive: boolean;
  razonSocial: string;
  domicilioFiscal: string;
  actividadesPrincipales: ActivityCode[];
  categoriaTributaria: string;
}
```

### Task 3.1.2: Create CUIT Validation Endpoint
- [ ] `POST /api/verification/validate-cuit`
- [ ] Call AFIP API
- [ ] Store result in verification_submissions
- [ ] Auto-approve if valid

### Task 3.1.3: Activity Code Mapping
```typescript
// Map AFIP activity codes to CampoTech service types
const ACTIVITY_CODE_MAP = {
  '432110': ['plumbing'], // Instalaciones de gas, agua, sanitarios
  '432200': ['electrical', 'hvac'], // Instalaciones eléctricas
  '432901': ['hvac'], // Instalación de aire acondicionado
  // ... more mappings
};
```

---

## 3.2 Document Upload System

### Task 3.2.1: Create Document Upload Endpoint
- [ ] `POST /api/verification/upload`
- [ ] Accept file upload
- [ ] Store in secure location (Supabase Storage)
- [ ] Create verification_submission record

### Task 3.2.2: Create Document Viewer Component
- [ ] Image zoom/pan for DNI photos
- [ ] PDF viewer for certificates
- [ ] Rotate functionality
- [ ] Download button

### Task 3.2.3: Create Selfie Verification Flow
- [ ] Camera capture component
- [ ] Compare with DNI photo (optional AI)
- [ ] Store both images

---

## 3.3 Verification Service

### Task 3.3.1: Create Verification Manager
```typescript
// lib/services/verification-manager.ts
export class VerificationManager {
  async getRequirementsForOrg(orgId: string): Promise<RequirementStatus[]>
  async getRequirementsForUser(userId: string): Promise<RequirementStatus[]>
  async submitVerification(submission: SubmissionInput): Promise<VerificationSubmission>
  async approveSubmission(submissionId: string, adminId: string): Promise<void>
  async rejectSubmission(submissionId: string, adminId: string, reason: string): Promise<void>
  async checkTier2Complete(orgId: string): Promise<boolean>
  async checkEmployeeVerified(userId: string): Promise<boolean>
  async updateOrgVerificationStatus(orgId: string): Promise<void>
}
```

### Task 3.3.2: Create Auto-Verification Service
```typescript
// lib/services/auto-verifier.ts
export class AutoVerifier {
  async verifySubmission(submission: VerificationSubmission): Promise<AutoVerifyResult>
  async verifyCUIT(cuit: string): Promise<CUITVerifyResult>
  async verifyCUIL(cuil: string): Promise<CUILVerifyResult>
  async verifyPhone(phone: string, code: string): Promise<boolean>
}
```

---

## 3.4 Legal Acknowledgments

### Task 3.4.1: Create Acknowledgment Components
- [ ] Terms modal with checkbox
- [ ] Version tracking
- [ ] IP/User agent capture

### Task 3.4.2: Create Acknowledgment API
- [ ] `POST /api/verification/acknowledge`
- [ ] Store in compliance_acknowledgments
- [ ] Required before certain actions

### Task 3.4.3: Acknowledgment Text Content
```typescript
const ACKNOWLEDGMENTS = {
  verification_responsibility: {
    title: 'Responsabilidad de Verificación',
    text: `Declaro bajo juramento que toda la información...`,
    version: '1.0',
  },
  employee_responsibility: {
    title: 'Responsabilidad sobre Empleados',
    text: `Como titular del negocio, asumo total responsabilidad...`,
    version: '1.0',
  },
  update_obligation: {
    title: 'Obligación de Actualización',
    text: `Entiendo que es mi responsabilidad mantener...`,
    version: '1.0',
  },
};
```

---

# PHASE 4: Unified Access Control

## 4.1 Access Control Middleware

### Task 4.1.1: Create Unified Access Checker
```typescript
// lib/access-control/checker.ts
export interface AccessStatus {
  canAccessDashboard: boolean;
  canReceiveJobs: boolean;
  canAssignEmployees: boolean;
  isMarketplaceVisible: boolean;
  blockReasons: BlockReason[];
  subscriptionStatus: SubscriptionStatus;
  verificationStatus: VerificationStatus;
}

export async function checkAccess(organizationId: string): Promise<AccessStatus>
```

### Task 4.1.2: Create Access Control Middleware
```typescript
// middleware/access-control.ts
export function withAccessControl(
  handler: NextApiHandler,
  requiredAccess: 'dashboard' | 'jobs' | 'employees' | 'marketplace'
): NextApiHandler
```

### Task 4.1.3: Update Dashboard Layout
- [ ] Check access on every page load
- [ ] Show appropriate warnings/blocks
- [ ] Redirect to appropriate page if blocked

---

## 4.2 Blocking System

### Task 4.2.1: Create Block Manager
```typescript
// lib/services/block-manager.ts
export class BlockManager {
  async createBlock(input: CreateBlockInput): Promise<ComplianceBlock>
  async removeBlock(blockId: string, adminId: string): Promise<void>
  async getActiveBlocks(orgId: string): Promise<ComplianceBlock[]>
  async getBlockReasons(orgId: string): Promise<string[]>
  async applySoftBlock(orgId: string, reason: string): Promise<void>
  async applyHardBlock(orgId: string, reason: string): Promise<void>
  async checkAndUpdateBlocks(orgId: string): Promise<void>
}
```

### Task 4.2.2: Create Unified Block Screen
```tsx
// components/BlockScreen.tsx
// Shows combined status of subscription + verification
// With CTAs to resolve each issue
```

### Task 4.2.3: Block Screen Routes
- [ ] `/blocked` - Full block screen
- [ ] Redirect logic in middleware
- [ ] Different messages per block reason

---

# PHASE 5: Owner Dashboard

## 5.1 Billing UI

### Task 5.1.1: Create Billing Page
- [ ] `/dashboard/settings/billing`
- [ ] Current plan display
- [ ] Payment history
- [ ] Upgrade/downgrade buttons
- [ ] Cancel subscription (with Ley 24.240 compliance)

### Task 5.1.2: Create Plan Selector Component
- [ ] Monthly/Yearly toggle
- [ ] Three plan cards
- [ ] Feature comparison
- [ ] Savings display for yearly

### Task 5.1.3: Create Payment Methods Display
- [ ] Icons for all Argentine payment methods
- [ ] Cuotas information
- [ ] Cash payment instructions

### Task 5.1.4: Create Payment History Table
- [ ] Date, amount, status, method
- [ ] Download invoice link
- [ ] Retry failed payment

---

## 5.2 Verification Dashboard

### Task 5.2.1: Create Verification Center Page
- [ ] `/dashboard/verificacion`
- [ ] Overall status display
- [ ] Alerts section
- [ ] Tabbed interface

### Task 5.2.2: Create Requirements Table Component
- [ ] Requirement name, status, value/document, expiration
- [ ] Action buttons (upload, update)
- [ ] Status badges with colors

### Task 5.2.3: Create Badges Display Component
- [ ] Grid of optional badges
- [ ] Earned vs not earned
- [ ] "Obtener" button for each

### Task 5.2.4: Create Employee Compliance Table
- [ ] List of all employees
- [ ] Verification status per employee
- [ ] Pending documents count
- [ ] Next expiration date
- [ ] "Send reminder" button

---

## 5.3 Combined Status Components

### Task 5.3.1: Create Dashboard Alerts Component
- [ ] Shows both subscription and verification alerts
- [ ] Priority ordering
- [ ] Dismissible where appropriate
- [ ] Action buttons

### Task 5.3.2: Create Onboarding Checklist
- [ ] Combined checklist for new users
- [ ] Subscription status
- [ ] Verification progress
- [ ] First job guidance

---

# PHASE 6: Employee Verification Portal

## 6.1 Employee Self-Service

### Task 6.1.1: Create Employee Verification Page
- [ ] `/dashboard/mi-verificacion`
- [ ] Personal status display
- [ ] Document upload forms
- [ ] Alerts for expiring documents

### Task 6.1.2: Create Employee Document Upload Flow
- [ ] CUIL entry with validation
- [ ] DNI photo upload (front)
- [ ] Selfie capture
- [ ] Phone verification

### Task 6.1.3: Create Employee Badge Section
- [ ] Optional badges they can earn
- [ ] Background check upload
- [ ] Professional certifications

---

## 6.2 Owner-Employee Interaction

### Task 6.2.1: Create Employee Invite with Verification
- [ ] When inviting employee, explain verification requirement
- [ ] Email includes verification instructions
- [ ] Track verification during onboarding

### Task 6.2.2: Create Employee Reminder System
- [ ] Owner can send manual reminders
- [ ] Automatic reminders for expiring docs
- [ ] Notification to owner when employee non-compliant

---

# PHASE 7: Admin Panel

## 7.1 Subscription Admin

### Task 7.1.1: Create Admin Subscriptions Page
- [ ] `/admin/subscriptions`
- [ ] List all organizations with subscription status
- [ ] Revenue metrics (MRR, ARR)
- [ ] Filters: status, tier, date range

### Task 7.1.2: Create Admin Subscription Detail
- [ ] Full subscription history
- [ ] Payment history
- [ ] Manual actions: extend trial, process refund, change tier

### Task 7.1.3: Create Revenue Dashboard
- [ ] Total revenue chart
- [ ] Conversion rate (trial → paid)
- [ ] Churn rate
- [ ] Failed payment alerts

---

## 7.2 Verification Admin

### Task 7.2.1: Create Admin Review Queue Page
- [ ] `/admin/verificaciones`
- [ ] Pending submissions list
- [ ] Priority indicators
- [ ] Quick filters

### Task 7.2.2: Create Review Modal
- [ ] Document viewer (zoom, rotate)
- [ ] Submission info
- [ ] Previous submissions
- [ ] Approve/Reject/Request correction buttons
- [ ] Rejection reason selector

### Task 7.2.3: Create Admin Organization Compliance View
- [ ] List all organizations with compliance status
- [ ] Verification progress
- [ ] Block status
- [ ] Manual block/unblock

### Task 7.2.4: Create Admin Employee Verification View
- [ ] List employees needing verification
- [ ] Bulk actions
- [ ] Filter by organization

---

## 7.3 Combined Admin Dashboard

### Task 7.3.1: Create Admin Home Dashboard
- [ ] Key metrics from both systems
- [ ] Pending actions count
- [ ] Alerts and warnings
- [ ] Quick links

### Task 7.3.2: Create Admin Alerts System
- [ ] Failed payments needing attention
- [ ] Verifications pending review
- [ ] Expired documents
- [ ] Blocked organizations

---

# PHASE 8: Notification System

## 8.1 Subscription Notifications

### Task 8.1.1: Create Trial Reminder Emails
- [ ] 7 days before expiry
- [ ] 3 days before expiry
- [ ] 1 day before expiry
- [ ] Trial expired

### Task 8.1.2: Create Payment Notification Emails
- [ ] Payment successful
- [ ] Payment failed
- [ ] Payment pending (cash)
- [ ] Subscription cancelled
- [ ] Subscription renewed

### Task 8.1.3: Create Subscription Cron Jobs
- [ ] Trial expiration check (daily)
- [ ] Payment reminder (3 days before renewal)
- [ ] Failed payment retry reminder

---

## 8.2 Verification Notifications

### Task 8.2.1: Create Document Expiration Emails
- [ ] 30 days before expiry
- [ ] 14 days before expiry
- [ ] 7 days before expiry
- [ ] 1 day before expiry
- [ ] Document expired

### Task 8.2.2: Create Verification Status Emails
- [ ] Document approved
- [ ] Document rejected (with reason)
- [ ] Verification complete
- [ ] Account blocked
- [ ] Account unblocked

### Task 8.2.3: Create Employee Verification Emails
- [ ] Welcome email with verification instructions
- [ ] Reminder to complete verification
- [ ] Document expiring notification to employee
- [ ] Notification to owner about employee compliance

### Task 8.2.4: Create Verification Cron Jobs
- [ ] Document expiration check (daily)
- [ ] AFIP status revalidation (weekly)
- [ ] Compliance status update (daily)

---

## 8.3 In-App Notifications

### Task 8.3.1: Create Notification System
- [ ] Bell icon in header
- [ ] Notification dropdown
- [ ] Mark as read
- [ ] Notification preferences

### Task 8.3.2: Create Notification Types
- [ ] Trial expiring
- [ ] Payment due/failed
- [ ] Document expiring
- [ ] Document status change
- [ ] Employee compliance alert
- [ ] Account blocked/unblocked

---

# PHASE 9: Integration & Edge Cases

## 9.1 Combined Flows

### Task 9.1.1: New User Onboarding Flow
- [ ] Signup → Trial created
- [ ] Show verification prompt
- [ ] Progress tracking
- [ ] First job guidance

### Task 9.1.2: Subscription Change Flow
- [ ] Upgrade mid-period (prorate)
- [ ] Downgrade at period end
- [ ] Cancel with refund (Ley 24.240)
- [ ] Reactivate after cancellation

### Task 9.1.3: Verification Renewal Flow
- [ ] Document expiring reminders
- [ ] Renewal submission
- [ ] Grace period handling
- [ ] Block and unblock

---

## 9.2 Edge Cases

### Task 9.2.1: Handle Edge Cases
- [ ] Payment approved but verification incomplete
- [ ] Verification complete but trial expired
- [ ] Employee verified but owner not verified
- [ ] Multiple organizations same CUIT (prevent)
- [ ] Owner changes (transfer verification)
- [ ] Organization deletion (cleanup)

### Task 9.2.2: Error Handling
- [ ] AFIP API down → fallback to manual
- [ ] MercadoPago webhook retry
- [ ] Document upload failures
- [ ] Network errors during verification

---

# PHASE 10: Testing & Launch

## 10.1 Testing

### Task 10.1.1: Unit Tests
- [ ] Trial manager tests
- [ ] Payment processor tests
- [ ] Verification manager tests
- [ ] Access control tests
- [ ] Block manager tests

### Task 10.1.2: Integration Tests
- [ ] Full signup → trial → verify → pay flow
- [ ] Webhook processing
- [ ] AFIP integration
- [ ] Email sending

### Task 10.1.3: E2E Tests
- [ ] User signup and trial
- [ ] Document upload and approval
- [ ] Payment with all methods
- [ ] Cancellation flow
- [ ] Admin review flow

---

## 10.2 Launch Preparation

### Task 10.2.1: Production Configuration
- [ ] MercadoPago production credentials
- [ ] Create MP subscription plans
- [ ] AFIP production access
- [ ] Email sending configured
- [ ] Cron jobs scheduled

### Task 10.2.2: Legal Review
- [ ] Terms of service
- [ ] Privacy policy (Ley 25.326)
- [ ] Cancellation policy (Ley 24.240)
- [ ] Verification acknowledgments

### Task 10.2.3: Launch Checklist
- [ ] All tests passing
- [ ] Admin panel functional
- [ ] Notifications working
- [ ] Monitoring in place
- [ ] Support process ready

---

# Environment Variables

```bash
# MercadoPago
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_WEBHOOK_SECRET=
MP_PLAN_INICIAL_MONTHLY=
MP_PLAN_INICIAL_YEARLY=
MP_PLAN_PROFESIONAL_MONTHLY=
MP_PLAN_PROFESIONAL_YEARLY=
MP_PLAN_EMPRESA_MONTHLY=
MP_PLAN_EMPRESA_YEARLY=

# AFIP
AFIP_ENVIRONMENT=production
AFIP_CERT_PATH=
AFIP_KEY_PATH=
AFIP_CUIT=

# Settings
TRIAL_DAYS=14
GRACE_PERIOD_DAYS=7
DEFAULT_TIMEZONE=America/Argentina/Buenos_Aires

# File Storage
SUPABASE_STORAGE_BUCKET=verifications
```

---

# File Structure

```
apps/web/
├── lib/
│   ├── services/
│   │   ├── trial-manager.ts
│   │   ├── subscription-manager.ts
│   │   ├── payment-processor.ts
│   │   ├── verification-manager.ts
│   │   ├── auto-verifier.ts
│   │   ├── block-manager.ts
│   │   └── notification-manager.ts
│   ├── mercadopago/
│   │   ├── client.ts
│   │   ├── checkout.ts
│   │   └── webhooks.ts
│   ├── afip/
│   │   ├── client.ts
│   │   └── activity-codes.ts
│   ├── access-control/
│   │   ├── checker.ts
│   │   └── middleware.ts
│   └── config/
│       ├── subscription-tiers.ts
│       └── verification-requirements.ts
├── app/
│   ├── api/
│   │   ├── subscription/
│   │   │   ├── checkout/route.ts
│   │   │   ├── cancel/route.ts
│   │   │   └── status/route.ts
│   │   ├── verification/
│   │   │   ├── upload/route.ts
│   │   │   ├── validate-cuit/route.ts
│   │   │   ├── acknowledge/route.ts
│   │   │   └── status/route.ts
│   │   └── webhooks/
│   │       └── mercadopago/route.ts
│   ├── dashboard/
│   │   ├── settings/
│   │   │   └── billing/
│   │   │       ├── page.tsx
│   │   │       ├── checkout/page.tsx
│   │   │       ├── success/page.tsx
│   │   │       └── pending/page.tsx
│   │   └── verificacion/
│   │       └── page.tsx
│   └── blocked/
│       └── page.tsx
├── components/
│   ├── billing/
│   │   ├── PlanSelector.tsx
│   │   ├── PaymentMethods.tsx
│   │   ├── TrialBanner.tsx
│   │   ├── PaymentHistory.tsx
│   │   └── UpgradeWall.tsx
│   └── verification/
│       ├── RequirementsTable.tsx
│       ├── DocumentUpload.tsx
│       ├── VerificationStatus.tsx
│       ├── BadgesGrid.tsx
│       ├── EmployeeComplianceTable.tsx
│       └── AcknowledgmentModal.tsx
└── prisma/
    └── migrations/
        ├── YYYYMMDD_subscription_tables/
        └── YYYYMMDD_verification_tables/

apps/admin/
├── app/
│   ├── dashboard/
│   │   ├── subscriptions/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── verificaciones/
│   │       ├── page.tsx
│   │       └── review/[id]/page.tsx
└── lib/
    └── api/
        ├── subscriptions.ts
        └── verifications.ts
```

---

*Document Version: 1.0*
*Created: December 2025*
*Total Prompts: 25*
