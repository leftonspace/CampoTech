SUPERSEDED by "campotech-architecture-complete.md"

# CampoTech: Argentina MVP Roadmap v4
## 12 Core Workflows | Modular Architecture | 14-Week Launch

---

# EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Core Workflows** | 12 (minimum viable for PMF) |
| **MVP Timeline** | 14 weeks (solo) / 9-10 weeks (team of 2-3) |
| **Architecture** | 8 independent modules |
| **Platforms** | Web App + Mobile (online-only V1) |
| **Monthly Infrastructure** | $150-400 USD (100 users) |
| **Target Price Point** | $12-25 USD/month |
| **Differentiator** | WhatsApp + Voice AI + AFIP + Mercado Pago |

---

# DOCUMENT CHANGELOG

| Version | Date | Changes |
|---------|------|---------|
| v1 | - | 88 features, 51 weeks (Workiz clone) |
| v2 | - | 88 features with Workiz parity |
| v3 | - | 12 workflows, 10 weeks (too aggressive) |
| **v4** | Dec 2025 | 12 workflows, 14 weeks, modular architecture, realistic timelines, error handling, onboarding |

---

# STRATEGIC CONTEXT

## Why This Works in Argentina

1. **High WhatsApp adoption** - 100% of tradespeople manage business via WhatsApp
2. **Mandatory digital invoicing** - AFIP Factura Electrónica is legally required
3. **Mercado Pago dominance** - Primary payment method, QR everywhere
4. **Weak local competition** - No WhatsApp-native FSM exists
5. **Foreign tools can't compete** - No AFIP, no MP cuotas, no WhatsApp

**The moat is localization, not features.**

## What We're NOT Building (Deferred to V1.5+)

| Feature | Defer Reason |
|---------|--------------|
| Offline-first sync | Complex; urban areas have coverage |
| Inventory management | Nice-to-have, not core pain |
| Service plans (abonos) | After PMF |
| Customer portal | Users don't need day one |
| Online booking widget | WhatsApp IS the booking |
| Location tracking | Privacy complexity |
| Equipment tracking | Can wait |
| Reserve with Google | Requires verification |
| Multi-location/franchise | Scale problem |
| Commission management | Excel works |
| Advanced AI scheduling | V2 feature |

---

# MODULAR ARCHITECTURE

## Module Overview

The system is divided into **8 independent modules**. Each module:
- Has clear boundaries and interfaces
- Can be developed and tested independently
- Can be modified without affecting other modules
- Has its own error handling and retry logic

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAMPOTECH MVP                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   MODULE 1  │  │   MODULE 2  │  │   MODULE 3  │             │
│  │    AUTH     │  │     CRM     │  │    JOBS     │             │
│  │  & ONBOARD  │  │  & CUSTOMERS│  │ & SCHEDULING│             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│  ┌──────┴────────────────┴────────────────┴──────┐             │
│  │              SHARED SERVICES LAYER            │             │
│  │   (Database, Queue, Storage, Notifications)   │             │
│  └──────┬────────────────┬────────────────┬──────┘             │
│         │                │                │                     │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐             │
│  │   MODULE 4  │  │   MODULE 5  │  │   MODULE 6  │             │
│  │    AFIP     │  │   MERCADO   │  │  WHATSAPP   │             │
│  │  INVOICING  │  │    PAGO     │  │   COMMS     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │   MODULE 7  │  │   MODULE 8  │                              │
│  │  VOICE AI   │  │   MOBILE    │                              │
│  │  PROCESSING │  │ TECHNICIAN  │                              │
│  └─────────────┘  └─────────────┘                              │
├─────────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE LAYER                         │
│   (Error Handling, Retry Queues, Rate Limiting, Monitoring)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## MODULE 1: Auth & Onboarding

**Purpose:** User authentication, organization setup, guided onboarding

**Workflows Covered:** Foundation for all workflows

### Components

```
modules/auth/
├── components/
│   ├── LoginForm.tsx
│   ├── PhoneOTPInput.tsx
│   ├── OrganizationSetup.tsx
│   └── OnboardingWizard.tsx
├── services/
│   ├── AuthService.ts
│   └── OnboardingService.ts
├── hooks/
│   ├── useAuth.ts
│   └── useOnboarding.ts
└── types/
    └── auth.types.ts
```

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Phone OTP Login | SMS verification for Argentine numbers | P0 |
| Email/Password | Alternative login method | P1 |
| Organization Setup | Company name, CUIT, IVA condition | P0 |
| User Roles | owner, dispatcher, technician | P0 |
| AFIP Certificate Wizard | Step-by-step cert upload with validation | P0 |
| MP Connection Flow | OAuth walkthrough with screenshots | P0 |
| WhatsApp Setup Guide | Phone verification instructions | P0 |
| Demo Job Creation | Interactive tutorial | P1 |
| Team Invites | Add team members | P1 |

### Onboarding Flow (NEW - Critic Requirement)

```typescript
// modules/auth/services/OnboardingService.ts
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  isComplete: boolean;
  component: React.ComponentType;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'company_info',
    title: 'Datos de tu empresa',
    description: 'Nombre, CUIT y condición de IVA',
    isRequired: true,
    component: CompanyInfoStep
  },
  {
    id: 'afip_certificate',
    title: 'Certificado AFIP',
    description: 'Subí tu certificado digital para facturar',
    isRequired: true,
    component: AfipCertificateStep
  },
  {
    id: 'mercadopago',
    title: 'Conectar Mercado Pago',
    description: 'Vinculá tu cuenta para cobrar',
    isRequired: true,
    component: MercadoPagoStep
  },
  {
    id: 'whatsapp',
    title: 'Configurar WhatsApp',
    description: 'Conectá tu número de WhatsApp Business',
    isRequired: true,
    component: WhatsAppSetupStep
  },
  {
    id: 'price_book',
    title: 'Servicios y precios',
    description: 'Agregá tus servicios más comunes',
    isRequired: false,
    component: PriceBookSetupStep
  },
  {
    id: 'demo_job',
    title: 'Crear trabajo de prueba',
    description: 'Probá el flujo completo',
    isRequired: false,
    component: DemoJobStep
  }
];

export class OnboardingService {
  async getProgress(orgId: string): Promise<OnboardingProgress> {
    const org = await getOrganization(orgId);
    
    return {
      currentStep: this.calculateCurrentStep(org),
      completedSteps: this.getCompletedSteps(org),
      isComplete: this.isOnboardingComplete(org),
      blockers: this.getBlockers(org)
    };
  }

  private getBlockers(org: Organization): string[] {
    const blockers: string[] = [];
    
    if (!org.afip_cert) blockers.push('AFIP certificate required');
    if (!org.mp_access_token) blockers.push('Mercado Pago not connected');
    if (!org.whatsapp_phone_id) blockers.push('WhatsApp not configured');
    
    return blockers;
  }
}
```

### Database Tables

```sql
-- Module 1: Auth & Onboarding
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cuit TEXT UNIQUE NOT NULL,
  iva_condition TEXT NOT NULL,
  -- AFIP
  afip_punto_venta INTEGER,
  afip_cert BYTEA,
  afip_key BYTEA,
  afip_cert_expiry DATE,
  afip_homologated BOOLEAN DEFAULT false,
  -- Mercado Pago
  mp_access_token TEXT,
  mp_refresh_token TEXT,
  mp_user_id TEXT,
  mp_connected_at TIMESTAMPTZ,
  -- WhatsApp
  whatsapp_phone_id TEXT,
  whatsapp_business_id TEXT,
  whatsapp_verified BOOLEAN DEFAULT false,
  -- Onboarding
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_current_step TEXT,
  -- Settings
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'technician',
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  invited_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Interfaces

```typescript
// Module 1 exposes these interfaces to other modules
export interface IAuthModule {
  // Authentication
  loginWithPhone(phone: string): Promise<void>;
  verifyOTP(phone: string, code: string): Promise<Session>;
  logout(): Promise<void>;
  
  // Session
  getCurrentUser(): User | null;
  getCurrentOrg(): Organization | null;
  
  // Onboarding
  getOnboardingProgress(): Promise<OnboardingProgress>;
  completeOnboardingStep(stepId: string): Promise<void>;
}
```

---

## MODULE 2: CRM & Customers

**Purpose:** Customer database with Argentina-specific fields

**Workflows Covered:** #2 Customer CRM

### Components

```
modules/crm/
├── components/
│   ├── CustomerList.tsx
│   ├── CustomerDetail.tsx
│   ├── CustomerForm.tsx
│   ├── CustomerSearch.tsx
│   └── CuitValidator.tsx
├── services/
│   ├── CustomerService.ts
│   └── CuitValidationService.ts
├── hooks/
│   ├── useCustomers.ts
│   ├── useCustomer.ts
│   └── useCuitValidation.ts
└── types/
    └── customer.types.ts
```

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Customer CRUD | Create, read, update, delete | P0 |
| CUIT/DNI Fields | Argentine document types | P0 |
| CUIT Validation | Validate against AFIP padron | P0 |
| IVA Condition | Required for invoice type | P0 |
| Address + Barrio | Buenos Aires neighborhoods | P0 |
| Phone as Primary ID | WhatsApp linking | P0 |
| Customer Search | By name, phone, CUIT | P0 |
| Service History | Jobs linked to customer | P0 |
| Notes | Free text notes | P1 |
| WhatsApp Thread Link | Direct link to conversation | P0 |

### Database Tables

```sql
-- Module 2: CRM & Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  -- Identity
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  -- Argentina documents (required for AFIP)
  doc_type TEXT DEFAULT 'dni', -- dni, cuit, cuil
  doc_number TEXT,
  iva_condition TEXT DEFAULT 'consumidor_final',
  -- Address
  address TEXT,
  address_extra TEXT, -- piso, depto
  neighborhood TEXT, -- Barrio
  city TEXT DEFAULT 'Buenos Aires',
  province TEXT DEFAULT 'CABA',
  postal_code TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  -- WhatsApp
  whatsapp_thread_id TEXT,
  last_message_at TIMESTAMPTZ,
  -- Meta
  notes TEXT,
  tags TEXT[],
  source TEXT, -- manual, whatsapp, voice
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(org_id, phone)
);

CREATE INDEX idx_customers_org_phone ON customers(org_id, phone);
CREATE INDEX idx_customers_org_name ON customers(org_id, name);
CREATE INDEX idx_customers_org_doc ON customers(org_id, doc_type, doc_number);
```

### CUIT Validation Service

```typescript
// modules/crm/services/CuitValidationService.ts
export class CuitValidationService {
  // Validate CUIT format (11 digits + check digit)
  validateFormat(cuit: string): ValidationResult {
    const cleaned = cuit.replace(/\D/g, '');
    
    if (cleaned.length !== 11) {
      return { valid: false, error: 'CUIT debe tener 11 dígitos' };
    }

    // Validate check digit
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned[i]) * multipliers[i];
    }
    
    const checkDigit = 11 - (sum % 11);
    const expectedCheck = checkDigit === 11 ? 0 : checkDigit === 10 ? 9 : checkDigit;
    
    if (parseInt(cleaned[10]) !== expectedCheck) {
      return { valid: false, error: 'Dígito verificador inválido' };
    }

    return { valid: true };
  }

  // Query AFIP padron for business info
  async queryAfipPadron(cuit: string): Promise<AfipPadronResult | null> {
    try {
      const response = await this.afipClient.getPersona(cuit);
      
      return {
        cuit,
        razonSocial: response.razonSocial,
        ivaCondition: this.mapIvaCondition(response.impuestos),
        domicilioFiscal: response.domicilioFiscal,
        isActive: response.estadoClave === 'ACTIVO'
      };
    } catch (error) {
      // AFIP unavailable - allow manual entry
      console.error('AFIP padron query failed:', error);
      return null;
    }
  }
}
```

### Interfaces

```typescript
// Module 2 exposes these interfaces
export interface ICRMModule {
  // Customers
  getCustomers(filters?: CustomerFilters): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer>;
  createCustomer(data: CreateCustomerInput): Promise<Customer>;
  updateCustomer(id: string, data: UpdateCustomerInput): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
  
  // Search
  searchCustomers(query: string): Promise<Customer[]>;
  findByPhone(phone: string): Promise<Customer | null>;
  
  // Validation
  validateCuit(cuit: string): ValidationResult;
  queryAfipPadron(cuit: string): Promise<AfipPadronResult | null>;
}
```

---

## MODULE 3: Jobs & Scheduling

**Purpose:** Job management, calendar, technician assignment

**Workflows Covered:** #3 Job Scheduling, #11 Job Completion Flow

### Components

```
modules/jobs/
├── components/
│   ├── JobList.tsx
│   ├── JobDetail.tsx
│   ├── JobForm.tsx
│   ├── JobCard.tsx
│   ├── Calendar/
│   │   ├── CalendarView.tsx
│   │   ├── DayView.tsx
│   │   ├── WeekView.tsx
│   │   └── JobEvent.tsx
│   ├── DispatchBoard.tsx
│   └── StatusBadge.tsx
├── services/
│   ├── JobService.ts
│   └── SchedulingService.ts
├── hooks/
│   ├── useJobs.ts
│   ├── useJob.ts
│   ├── useCalendar.ts
│   └── useJobStatus.ts
└── types/
    └── job.types.ts
```

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Job CRUD | Create, read, update, delete | P0 |
| Status Workflow | pending → scheduled → en_camino → working → completed | P0 |
| Calendar View | Day/Week views | P0 |
| Technician Assignment | Assign jobs to users | P0 |
| Drag-and-Drop | Reschedule via calendar | P1 |
| Job Types | plomeria, electricidad, aire_acondicionado, etc. | P0 |
| Priority Levels | low, normal, high, urgent | P0 |
| Address + Geocoding | Google Maps integration | P0 |
| Photos Array | Before/after photos | P0 |
| Signature Capture | Completion proof | P0 |
| Source Tracking | manual, whatsapp, voice | P0 |

### Status Workflow

```
┌─────────┐     ┌───────────┐     ┌───────────┐     ┌─────────┐     ┌───────────┐
│ PENDING │ ──▶ │ SCHEDULED │ ──▶ │ EN_CAMINO │ ──▶ │ WORKING │ ──▶ │ COMPLETED │
└─────────┘     └───────────┘     └───────────┘     └─────────┘     └───────────┘
     │                │                                                    │
     │                ▼                                                    │
     │          ┌───────────┐                                             │
     └────────▶ │ CANCELLED │ ◀───────────────────────────────────────────┘
               └───────────┘
```

### Database Tables

```sql
-- Module 3: Jobs & Scheduling
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  assigned_to UUID REFERENCES users(id),
  -- Job info
  title TEXT NOT NULL,
  description TEXT,
  job_type TEXT,
  priority TEXT DEFAULT 'normal',
  -- Status
  status TEXT DEFAULT 'pending',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  -- Scheduling
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  estimated_duration INTEGER, -- minutes
  -- Actual times
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  -- Location
  address TEXT,
  address_extra TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  -- Completion
  photos TEXT[],
  notes TEXT,
  internal_notes TEXT,
  signature_url TEXT,
  -- Billing link
  invoice_id UUID,
  -- Source tracking
  source TEXT DEFAULT 'manual',
  source_message_id TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) NOT NULL,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_org_status ON jobs(org_id, status);
CREATE INDEX idx_jobs_org_date ON jobs(org_id, scheduled_date);
CREATE INDEX idx_jobs_assigned ON jobs(assigned_to, scheduled_date);
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
```

### Interfaces

```typescript
// Module 3 exposes these interfaces
export interface IJobsModule {
  // Jobs
  getJobs(filters?: JobFilters): Promise<Job[]>;
  getJob(id: string): Promise<Job>;
  createJob(data: CreateJobInput): Promise<Job>;
  updateJob(id: string, data: UpdateJobInput): Promise<Job>;
  deleteJob(id: string): Promise<void>;
  
  // Status
  updateStatus(id: string, status: JobStatus, notes?: string): Promise<Job>;
  getStatusHistory(id: string): Promise<JobStatusHistory[]>;
  
  // Scheduling
  getJobsForDate(date: Date): Promise<Job[]>;
  getJobsForDateRange(start: Date, end: Date): Promise<Job[]>;
  getJobsForTechnician(userId: string, date: Date): Promise<Job[]>;
  
  // Assignment
  assignTechnician(jobId: string, userId: string): Promise<Job>;
  unassignTechnician(jobId: string): Promise<Job>;
  
  // Completion
  completeJob(id: string, data: JobCompletionInput): Promise<Job>;
}
```

---

## MODULE 4: AFIP Invoicing

**Purpose:** Argentine electronic invoicing with CAE

**Workflows Covered:** #5 AFIP Electronic Invoicing, #10 PDF Invoice

### Components

```
modules/afip/
├── components/
│   ├── InvoiceList.tsx
│   ├── InvoiceDetail.tsx
│   ├── InvoiceForm.tsx
│   ├── InvoicePDF.tsx
│   ├── LineItemEditor.tsx
│   ├── AfipStatusBadge.tsx
│   └── QRCodeDisplay.tsx
├── services/
│   ├── AfipService.ts
│   ├── AfipAuthService.ts       # WSAA token management
│   ├── AfipInvoiceService.ts    # WSFEv1 integration
│   ├── InvoicePDFService.ts
│   └── AfipRetryService.ts      # NEW: Retry logic
├── queues/
│   ├── AfipQueue.ts             # NEW: Background processing
│   └── AfipRetryQueue.ts
├── hooks/
│   ├── useInvoices.ts
│   ├── useInvoice.ts
│   └── useAfipStatus.ts
└── types/
    └── invoice.types.ts
```

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| WSAA Authentication | Token management with refresh | P0 |
| WSFEv1 Integration | Invoice creation | P0 |
| Invoice Types | A, B, C based on IVA conditions | P0 |
| CAE Request | Authorization code from AFIP | P0 |
| Sequential Numbering | Per punto de venta | P0 |
| QR Code Generation | RG 4291 compliance | P0 |
| PDF Generation | Professional layout with QR | P0 |
| Line Items | From Price Book | P0 |
| IVA Calculation | 21%, 10.5%, 27%, exempt | P0 |
| Credit Notes | Nota de crédito | P1 |
| Draft Mode | Save without AFIP submission | P0 |
| **Retry Queue** | Auto-retry on AFIP failure | P0 |
| **Offline Draft** | Create invoice when AFIP down | P0 |

### AFIP Error Handling (NEW - Critic Requirement)

```typescript
// modules/afip/services/AfipRetryService.ts
export class AfipRetryService {
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAYS = [1000, 5000, 30000, 120000, 300000]; // 1s, 5s, 30s, 2m, 5m

  async processInvoiceWithRetry(invoice: Invoice): Promise<AfipResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        // Check if AFIP is available
        const isAvailable = await this.checkAfipHealth();
        
        if (!isAvailable) {
          await this.queueForLater(invoice, 'afip_unavailable');
          return { status: 'queued', message: 'AFIP no disponible. Reintentando automáticamente.' };
        }

        // Attempt to get CAE
        const result = await this.afipService.requestCAE(invoice);
        
        // Update invoice with CAE
        await this.updateInvoiceWithCAE(invoice.id, result);
        
        return { status: 'success', cae: result.cae };
        
      } catch (error) {
        lastError = error as Error;
        
        // Categorize error
        const errorType = this.categorizeError(error);
        
        if (errorType === 'permanent') {
          // Don't retry - data issue
          await this.markAsFailed(invoice.id, error);
          throw error;
        }
        
        if (errorType === 'transient' && attempt < this.MAX_RETRIES - 1) {
          // Wait and retry
          await this.delay(this.RETRY_DELAYS[attempt]);
          continue;
        }
      }
    }

    // All retries exhausted
    await this.queueForManualReview(invoice, lastError);
    return { status: 'failed', error: lastError?.message };
  }

  private categorizeError(error: any): 'permanent' | 'transient' {
    const permanentErrors = [
      'CUIT inválido',
      'Punto de venta no autorizado',
      'Certificado expirado',
      'Tipo de comprobante inválido'
    ];

    const message = error.message || '';
    
    if (permanentErrors.some(e => message.includes(e))) {
      return 'permanent';
    }
    
    return 'transient';
  }

  async checkAfipHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl', {
        method: 'HEAD',
        timeout: 5000
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### AFIP Queue Processing (NEW)

```typescript
// modules/afip/queues/AfipQueue.ts
export class AfipQueue {
  private queue: Queue;

  constructor() {
    this.queue = new Queue('afip-invoices', {
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60000 // Start with 1 minute
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    this.setupProcessor();
  }

  private setupProcessor() {
    this.queue.process(async (job) => {
      const { invoiceId } = job.data;
      
      const invoice = await getInvoice(invoiceId);
      
      if (invoice.status === 'issued') {
        // Already processed
        return { status: 'already_processed' };
      }

      const result = await this.afipRetryService.processInvoiceWithRetry(invoice);
      
      if (result.status === 'success') {
        // Trigger next steps
        await this.mercadoPagoModule.createPaymentLink(invoiceId);
        await this.whatsAppModule.sendInvoice(invoiceId);
      }

      return result;
    });
  }

  async enqueue(invoiceId: string): Promise<void> {
    await this.queue.add({ invoiceId });
  }
}
```

### Database Tables

```sql
-- Module 4: AFIP Invoicing
CREATE TABLE price_book (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT DEFAULT 'service',
  sku TEXT,
  price DECIMAL(12, 2) NOT NULL,
  cost DECIMAL(12, 2),
  tax_rate DECIMAL(5, 2) DEFAULT 21.00,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  job_id UUID REFERENCES jobs(id),
  -- AFIP identification
  invoice_number INTEGER,
  invoice_type TEXT NOT NULL, -- A, B, C, M
  punto_venta INTEGER NOT NULL,
  -- AFIP authorization
  cae TEXT,
  cae_expiry DATE,
  qr_data TEXT,
  -- Amounts
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'ARS',
  -- Line items
  line_items JSONB NOT NULL DEFAULT '[]',
  -- Status
  status TEXT DEFAULT 'draft', -- draft, pending_cae, issued, paid, cancelled, failed
  afip_error TEXT,
  afip_attempts INTEGER DEFAULT 0,
  last_afip_attempt TIMESTAMPTZ,
  -- PDF
  pdf_url TEXT,
  -- Timestamps
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Queue for failed AFIP requests (NEW)
CREATE TABLE afip_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  next_attempt TIMESTAMPTZ,
  last_error TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_org_status ON invoices(org_id, status);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_afip_queue_next ON afip_retry_queue(next_attempt) WHERE status = 'pending';
```

### Invoice Type Logic

```typescript
// modules/afip/services/AfipInvoiceService.ts
export class AfipInvoiceService {
  /**
   * Determines invoice type based on seller and buyer IVA conditions
   * 
   * Seller: Responsable Inscripto
   *   → Buyer RI: Factura A
   *   → Buyer CF/Monotributista/Exento: Factura B
   * 
   * Seller: Monotributista
   *   → All buyers: Factura C
   */
  getInvoiceType(sellerIva: string, buyerIva: string): InvoiceType {
    if (sellerIva === 'monotributista') {
      return 'C';
    }

    if (sellerIva === 'responsable_inscripto') {
      if (buyerIva === 'responsable_inscripto') {
        return 'A';
      }
      return 'B';
    }

    // Default to B for safety
    return 'B';
  }

  async requestCAE(invoice: InvoiceData): Promise<CAEResult> {
    // 1. Get fresh token
    const token = await this.authService.getToken();
    
    // 2. Get next invoice number
    const lastNumber = await this.getLastInvoiceNumber(
      invoice.org.cuit,
      invoice.org.afip_punto_venta,
      invoice.invoiceType
    );
    
    // 3. Prepare AFIP request
    const afipRequest = {
      Auth: {
        Token: token.token,
        Sign: token.sign,
        Cuit: invoice.org.cuit
      },
      FeCAEReq: {
        FeCabReq: {
          CantReg: 1,
          PtoVta: invoice.org.afip_punto_venta,
          CbteTipo: this.getCbteTipo(invoice.invoiceType)
        },
        FeDetReq: {
          FECAEDetRequest: [{
            Concepto: 1, // Productos
            DocTipo: this.getDocTipo(invoice.customer),
            DocNro: invoice.customer.doc_number,
            CbteDesde: lastNumber + 1,
            CbteHasta: lastNumber + 1,
            CbteFch: this.formatDate(new Date()),
            ImpTotal: invoice.total,
            ImpTotConc: 0,
            ImpNeto: invoice.subtotal,
            ImpOpEx: 0,
            ImpIVA: invoice.tax_amount,
            ImpTrib: 0,
            MonId: 'PES',
            MonCotiz: 1,
            Iva: this.buildIvaArray(invoice.line_items)
          }]
        }
      }
    };

    // 4. Call AFIP
    const response = await this.wsfeClient.FECAESolicitar(afipRequest);
    
    // 5. Handle response
    if (response.FECAESolicitarResult.FeCabResp.Resultado === 'A') {
      const det = response.FECAESolicitarResult.FeDetResp.FECAEDetResponse[0];
      return {
        success: true,
        cae: det.CAE,
        caeExpiry: this.parseDate(det.CAEFchVto),
        invoiceNumber: det.CbteDesde
      };
    } else {
      const errors = response.FECAESolicitarResult.Errors?.Err || [];
      throw new AfipError(errors.map(e => e.Msg).join(', '));
    }
  }

  generateQRData(org: Organization, invoice: Invoice): string {
    // AFIP RG 4291 QR code format
    const data = {
      ver: 1,
      fecha: invoice.issued_at.toISOString().split('T')[0],
      cuit: parseInt(org.cuit),
      ptoVta: org.afip_punto_venta,
      tipoCmp: this.getCbteTipo(invoice.invoice_type),
      nroCmp: invoice.invoice_number,
      importe: parseFloat(invoice.total.toString()),
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: this.getDocTipo(invoice.customer),
      nroDocRec: parseInt(invoice.customer.doc_number || '0'),
      tipoCodAut: 'E',
      codAut: parseInt(invoice.cae)
    };

    const base64 = Buffer.from(JSON.stringify(data)).toString('base64');
    return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
  }
}
```

### Interfaces

```typescript
// Module 4 exposes these interfaces
export interface IAfipModule {
  // Price Book
  getPriceBook(): Promise<PriceBookItem[]>;
  createPriceBookItem(data: CreatePriceBookInput): Promise<PriceBookItem>;
  updatePriceBookItem(id: string, data: UpdatePriceBookInput): Promise<PriceBookItem>;
  
  // Invoices
  getInvoices(filters?: InvoiceFilters): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice>;
  createInvoice(data: CreateInvoiceInput): Promise<Invoice>;
  
  // AFIP
  requestCAE(invoiceId: string): Promise<CAEResult>;
  getInvoiceType(sellerIva: string, buyerIva: string): InvoiceType;
  
  // PDF
  generatePDF(invoiceId: string): Promise<string>; // Returns URL
  
  // Queue
  getQueueStatus(): Promise<QueueStatus>;
  retryFailed(invoiceId: string): Promise<void>;
}
```

---

## MODULE 5: Mercado Pago

**Purpose:** Payment processing with cuotas

**Workflows Covered:** #6 Mercado Pago Payments

### Components

```
modules/mercadopago/
├── components/
│   ├── PaymentStatus.tsx
│   ├── PaymentQR.tsx
│   ├── PaymentLink.tsx
│   ├── CuotasSelector.tsx      # With TEA/CFT display
│   ├── CuotasTable.tsx         # Legal compliance table
│   └── PaymentHistory.tsx
├── services/
│   ├── MercadoPagoService.ts
│   ├── CuotasService.ts        # TEA/CFT calculations
│   └── PaymentSyncService.ts   # Webhook + reconciliation
├── hooks/
│   ├── usePayments.ts
│   ├── usePaymentLink.ts
│   └── useCuotas.ts
└── types/
    └── payment.types.ts
```

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| OAuth Connection | Link MP account | P0 |
| Payment Preference | Create payment request | P0 |
| QR Code Generation | For in-person payments | P0 |
| Payment Link | Shareable URL | P0 |
| Cuotas (1-12) | Installment options | P0 |
| **TEA/CFT Display** | Legal requirement | P0 |
| **Interest Table** | Full disclosure | P0 |
| Webhook Handler | Payment status updates | P0 |
| Payment Sync | Reconciliation | P0 |
| Refunds | Process refunds | P1 |
| **Auto-Retry Sync** | Handle MP downtime | P0 |

### Cuotas Legal Compliance (NEW - Critic Requirement)

```typescript
// modules/mercadopago/services/CuotasService.ts
export interface CuotaOption {
  installments: number;
  installmentAmount: number;
  totalAmount: number;
  tea: number;  // Tasa Efectiva Anual
  cft: number;  // Costo Financiero Total
}

export class CuotasService {
  /**
   * Argentina law requires displaying:
   * - TEA (Tasa Efectiva Anual) - Annual Effective Rate
   * - CFT (Costo Financiero Total) - Total Financial Cost
   * - Per-installment amount
   * - Total amount
   * 
   * BCRA regulations require this information to be clearly visible
   */
  async getCuotasWithLegalInfo(
    amount: number,
    paymentMethodId: string
  ): Promise<CuotaOption[]> {
    // Get installment options from Mercado Pago
    const mpOptions = await this.mp.payment_methods.getInstallments({
      amount,
      payment_method_id: paymentMethodId
    });

    return mpOptions[0]?.payer_costs.map(cost => ({
      installments: cost.installments,
      installmentAmount: cost.installment_amount,
      totalAmount: cost.total_amount,
      tea: this.calculateTEA(amount, cost.total_amount, cost.installments),
      cft: cost.cft_percentage || this.calculateCFT(amount, cost.total_amount, cost.installments)
    })) || [];
  }

  private calculateTEA(principal: number, total: number, months: number): number {
    // TEA = ((Total / Principal) ^ (12/months) - 1) * 100
    const ratio = total / principal;
    const annualizedRatio = Math.pow(ratio, 12 / months);
    return (annualizedRatio - 1) * 100;
  }

  private calculateCFT(principal: number, total: number, months: number): number {
    // CFT includes all costs (TEA + fees + insurance)
    // Simplified: CFT ≈ TEA * 1.1 (10% additional costs)
    return this.calculateTEA(principal, total, months) * 1.1;
  }
}
```

### Cuotas UI Component (Legal Compliance)

```typescript
// modules/mercadopago/components/CuotasTable.tsx
export function CuotasTable({ amount, options }: CuotasTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Cuotas</th>
            <th className="px-4 py-2 text-right">Cuota</th>
            <th className="px-4 py-2 text-right">Total</th>
            <th className="px-4 py-2 text-right">TEA</th>
            <th className="px-4 py-2 text-right">CFT</th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr key={option.installments} className="border-t">
              <td className="px-4 py-2">
                {option.installments} {option.installments === 1 ? 'pago' : 'cuotas'}
              </td>
              <td className="px-4 py-2 text-right">
                ${formatNumber(option.installmentAmount)}
              </td>
              <td className="px-4 py-2 text-right">
                ${formatNumber(option.totalAmount)}
              </td>
              <td className="px-4 py-2 text-right">
                {option.tea.toFixed(2)}%
              </td>
              <td className="px-4 py-2 text-right font-medium">
                {option.cft.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Legal disclaimer - required by BCRA */}
      <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600">
        <p>
          <strong>TEA:</strong> Tasa Efectiva Anual. 
          <strong> CFT:</strong> Costo Financiero Total. 
          Incluye todos los costos del financiamiento.
        </p>
        <p className="mt-1">
          Información conforme Comunicación BCRA "A" 5593.
        </p>
      </div>
    </div>
  );
}
```

### Payment Sync Service (NEW)

```typescript
// modules/mercadopago/services/PaymentSyncService.ts
export class PaymentSyncService {
  /**
   * Handles Mercado Pago webhook events with retry logic
   */
  async handleWebhook(payload: MPWebhookPayload): Promise<void> {
    const event = {
      id: payload.id,
      type: payload.type,
      data: payload.data,
      received_at: new Date()
    };

    // Store event for idempotency
    await this.storeWebhookEvent(event);

    try {
      switch (payload.type) {
        case 'payment':
          await this.handlePaymentEvent(payload.data.id);
          break;
        case 'merchant_order':
          await this.handleMerchantOrderEvent(payload.data.id);
          break;
      }
    } catch (error) {
      // Queue for retry
      await this.queueForRetry(event, error);
    }
  }

  private async handlePaymentEvent(paymentId: string): Promise<void> {
    // Fetch payment details from MP
    const payment = await this.mp.payment.get(paymentId);
    
    // Find our payment record
    const ourPayment = await findPaymentByMPId(paymentId);
    
    if (!ourPayment) {
      // Find by preference ID
      const byPreference = await findPaymentByPreferenceId(payment.preference_id);
      if (!byPreference) {
        console.warn('Payment not found:', paymentId);
        return;
      }
    }

    // Update payment status
    await updatePayment(ourPayment.id, {
      mp_payment_id: payment.id,
      mp_status: payment.status,
      status: this.mapMPStatus(payment.status),
      installments: payment.installments,
      paid_at: payment.status === 'approved' ? new Date(payment.date_approved) : null
    });

    // If approved, update invoice
    if (payment.status === 'approved') {
      await updateInvoice(ourPayment.invoice_id, {
        status: 'paid',
        paid_at: new Date(payment.date_approved)
      });

      // Notify customer
      await this.whatsAppModule.sendPaymentConfirmation(ourPayment.invoice_id);
    }
  }

  /**
   * Periodic reconciliation to catch missed webhooks
   */
  async reconcilePendingPayments(): Promise<void> {
    const pendingPayments = await getPendingPayments();

    for (const payment of pendingPayments) {
      if (!payment.mp_preference_id) continue;

      try {
        // Search for payments on this preference
        const mpPayments = await this.mp.payment.search({
          criteria: 'desc',
          sort: 'date_created',
          external_reference: payment.invoice_id
        });

        for (const mpPayment of mpPayments.results) {
          if (mpPayment.status === 'approved') {
            await this.handlePaymentEvent(mpPayment.id);
          }
        }
      } catch (error) {
        console.error('Reconciliation error:', payment.id, error);
      }
    }
  }
}
```

### Database Tables

```sql
-- Module 5: Mercado Pago
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  invoice_id UUID REFERENCES invoices(id) NOT NULL,
  -- Amount
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'ARS',
  -- Method
  method TEXT NOT NULL, -- mercadopago, cash, transfer, other
  -- Mercado Pago fields
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  mp_status TEXT,
  mp_status_detail TEXT,
  installments INTEGER DEFAULT 1,
  -- Status
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, refunded
  -- Timestamps
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook events for idempotency (NEW)
CREATE TABLE mp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status) WHERE status = 'pending';
CREATE INDEX idx_mp_events_pending ON mp_webhook_events(created_at) WHERE processed = false;
```

### Interfaces

```typescript
// Module 5 exposes these interfaces
export interface IMercadoPagoModule {
  // Connection
  getAuthUrl(): string;
  handleOAuthCallback(code: string): Promise<void>;
  isConnected(): Promise<boolean>;
  
  // Payments
  createPaymentLink(invoiceId: string): Promise<PaymentLink>;
  getPayment(id: string): Promise<Payment>;
  getPaymentsForInvoice(invoiceId: string): Promise<Payment[]>;
  
  // Cuotas
  getCuotasOptions(amount: number): Promise<CuotaOption[]>;
  
  // Cash
  recordCashPayment(invoiceId: string, amount: number): Promise<Payment>;
  
  // Refunds
  refundPayment(paymentId: string, amount?: number): Promise<void>;
  
  // Reconciliation
  reconcilePendingPayments(): Promise<void>;
}
```

---

## MODULE 6: WhatsApp Communications

**Purpose:** WhatsApp Business API integration

**Workflows Covered:** #1 WhatsApp → Lead → Job, #7 WhatsApp Inbox, #10 Send Invoice

### Components

```
modules/whatsapp/
├── components/
│   ├── Inbox/
│   │   ├── InboxView.tsx
│   │   ├── ConversationList.tsx
│   │   ├── ConversationThread.tsx
│   │   ├── MessageBubble.tsx
│   │   └── ComposeMessage.tsx
│   ├── MessageStatus.tsx
│   └── QuickReplies.tsx
├── services/
│   ├── WhatsAppService.ts
│   ├── MessageService.ts
│   ├── TemplateService.ts
│   ├── WebhookService.ts
│   └── MessageRetryService.ts  # NEW
├── queues/
│   ├── OutboundQueue.ts        # NEW
│   └── WebhookQueue.ts
├── hooks/
│   ├── useInbox.ts
│   ├── useConversation.ts
│   └── useMessages.ts
└── types/
    └── whatsapp.types.ts
```

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Meta Cloud API | Direct WhatsApp integration | P0 |
| Webhook Receiver | Incoming messages | P0 |
| Template Messages | Pre-approved messages | P0 |
| Free-form Messages | Within 24h window | P0 |
| Media Messages | Images, documents, audio | P0 |
| Unified Inbox | All conversations | P0 |
| Customer Linking | Link messages to customers | P0 |
| Message Status | sent, delivered, read | P0 |
| Quick Replies | Common responses | P1 |
| **Message Retry Queue** | Handle API failures | P0 |
| **Rate Limiting** | Respect API limits | P0 |

### Message Retry Service (NEW - Critic Requirement)

```typescript
// modules/whatsapp/services/MessageRetryService.ts
export class MessageRetryService {
  private readonly MAX_RETRIES = 3;
  private readonly RATE_LIMIT_DELAY = 60000; // 1 minute

  async sendWithRetry(message: OutboundMessage): Promise<SendResult> {
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        // Check rate limit
        await this.checkRateLimit(message.org_id);

        // Send message
        const result = await this.whatsAppService.send(message);
        
        // Track success for rate limiting
        await this.trackSend(message.org_id);
        
        return result;

      } catch (error) {
        const errorType = this.categorizeError(error);

        if (errorType === 'rate_limit') {
          // Wait and retry
          await this.delay(this.RATE_LIMIT_DELAY);
          continue;
        }

        if (errorType === 'temporary') {
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
          continue;
        }

        // Permanent error - don't retry
        throw error;
      }
    }

    // Queue for manual review
    await this.queueFailedMessage(message);
    throw new Error('Max retries exceeded');
  }

  private async checkRateLimit(orgId: string): Promise<void> {
    const key = `wa_rate_${orgId}`;
    const count = await this.redis.get(key);
    
    // WhatsApp Business API: ~80 messages per second per phone number
    // We'll be conservative: 50/minute
    if (parseInt(count || '0') >= 50) {
      throw new RateLimitError('WhatsApp rate limit reached');
    }
  }

  private async trackSend(orgId: string): Promise<void> {
    const key = `wa_rate_${orgId}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 60); // Reset every minute
  }

  private categorizeError(error: any): 'rate_limit' | 'temporary' | 'permanent' {
    const code = error.code || error.error?.code;
    
    if (code === 130429 || code === 'rate_limit_hit') {
      return 'rate_limit';
    }
    
    if (code >= 500 || code === 'ETIMEDOUT' || code === 'ECONNRESET') {
      return 'temporary';
    }
    
    return 'permanent';
  }
}
```

### Outbound Queue (NEW)

```typescript
// modules/whatsapp/queues/OutboundQueue.ts
export class WhatsAppOutboundQueue {
  private queue: Queue;

  constructor() {
    this.queue = new Queue('whatsapp-outbound', {
      limiter: {
        max: 50,      // Max 50 jobs
        duration: 60000 // Per minute
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    });

    this.setupProcessor();
  }

  private setupProcessor() {
    this.queue.process(async (job) => {
      const { type, data } = job.data;

      switch (type) {
        case 'template':
          return await this.sendTemplate(data);
        case 'text':
          return await this.sendText(data);
        case 'document':
          return await this.sendDocument(data);
        case 'image':
          return await this.sendImage(data);
      }
    });
  }

  // Convenience methods
  async queueJobConfirmation(job: Job, customer: Customer): Promise<void> {
    await this.queue.add({
      type: 'template',
      data: {
        to: customer.phone,
        template: 'job_confirmed',
        params: {
          customer_name: customer.name,
          job_date: formatDate(job.scheduled_date),
          job_time: formatTime(job.scheduled_time_start),
          technician_name: job.technician?.full_name || 'Por confirmar'
        }
      }
    });
  }

  async queueInvoice(invoice: Invoice, customer: Customer, paymentLink: string): Promise<void> {
    // Send PDF first
    await this.queue.add({
      type: 'document',
      data: {
        to: customer.phone,
        documentUrl: invoice.pdf_url,
        filename: `Factura-${invoice.invoice_type}${invoice.invoice_number}.pdf`,
        caption: `Factura ${invoice.invoice_type}-${invoice.invoice_number}`
      }
    });

    // Then payment link
    await this.queue.add({
      type: 'template',
      data: {
        to: customer.phone,
        template: 'payment_request',
        params: {
          invoice_number: `${invoice.invoice_type}-${invoice.invoice_number}`,
          total: formatCurrency(invoice.total),
          payment_link: paymentLink
        }
      }
    }, { delay: 2000 }); // Small delay between messages
  }
}
```

### Database Tables

```sql
-- Module 6: WhatsApp Communications
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  job_id UUID REFERENCES jobs(id),
  -- Message identification
  wa_message_id TEXT UNIQUE,
  direction TEXT NOT NULL, -- inbound, outbound
  message_type TEXT, -- text, audio, image, document, template
  -- Content
  content TEXT,
  media_url TEXT,
  template_name TEXT,
  template_params JSONB,
  -- Audio processing (for voice-to-job)
  transcription TEXT,
  ai_extracted_data JSONB,
  -- Status
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, read, failed
  error_message TEXT,
  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message retry queue (NEW)
CREATE TABLE whatsapp_outbound_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  message_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, sent, failed
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_org_customer ON whatsapp_messages(org_id, customer_id);
CREATE INDEX idx_messages_job ON whatsapp_messages(job_id);
CREATE INDEX idx_wa_queue_pending ON whatsapp_outbound_queue(created_at) WHERE status = 'pending';
```

### Message Templates (Submit Day 1)

```
Template: job_confirmed
Language: es_AR
Category: UTILITY
---
Hola {{1}}! 👋

Tu trabajo fue agendado:
📅 Fecha: {{2}}
🕐 Hora: {{3}}
👷 Técnico: {{4}}

Te avisamos cuando esté en camino.

¿Tenés alguna consulta? Respondé este mensaje.
```

```
Template: technician_en_route
Language: es_AR
Category: UTILITY
---
Hola {{1}}! 🚗

{{2}} está en camino a tu domicilio.
Tiempo estimado: {{3}} minutos.

📍 {{4}}
```

```
Template: payment_request
Language: es_AR
Category: UTILITY
---
Hola {{1}}!

Tu factura {{2}} está lista.
💰 Total: ${{3}}

Pagá fácil con Mercado Pago:
{{4}}

Aceptamos hasta 12 cuotas 💳

¡Gracias por elegirnos!
```

```
Template: job_completed
Language: es_AR
Category: UTILITY
---
Hola {{1}}! ✅

El trabajo fue completado.

📝 Detalle: {{2}}
💰 Total: ${{3}}

Tu factura y link de pago llegan en segundos.

¡Gracias por confiar en nosotros! ⭐
```

```
Template: payment_confirmed
Language: es_AR
Category: UTILITY
---
Hola {{1}}! 🎉

Recibimos tu pago de ${{2}}.

Gracias por tu confianza.
¡Hasta la próxima! 👋
```

### Interfaces

```typescript
// Module 6 exposes these interfaces
export interface IWhatsAppModule {
  // Messages
  sendTemplate(to: string, template: string, params: Record<string, string>): Promise<void>;
  sendText(to: string, text: string): Promise<void>;
  sendDocument(to: string, url: string, filename: string): Promise<void>;
  sendImage(to: string, url: string, caption?: string): Promise<void>;
  
  // Inbox
  getConversations(filters?: ConversationFilters): Promise<Conversation[]>;
  getMessages(customerId: string): Promise<Message[]>;
  markAsRead(messageId: string): Promise<void>;
  
  // Webhooks
  handleWebhook(payload: WAWebhookPayload): Promise<void>;
  
  // Convenience
  sendJobConfirmation(job: Job): Promise<void>;
  sendEnRouteNotification(job: Job): Promise<void>;
  sendInvoice(invoice: Invoice, paymentLink: string): Promise<void>;
  sendPaymentConfirmation(payment: Payment): Promise<void>;
}
```

---

## MODULE 7: Voice AI Processing

**Purpose:** Voice-to-job conversion

**Workflows Covered:** #8 Voice-to-Job AI

### Components

```
modules/voice-ai/
├── components/
│   ├── VoiceMessagePlayer.tsx
│   ├── TranscriptionView.tsx
│   ├── ExtractionReview.tsx
│   └── JobPreview.tsx
├── services/
│   ├── VoiceAIService.ts
│   ├── TranscriptionService.ts
│   ├── EntityExtractionService.ts
│   └── PromptService.ts
├── prompts/
│   ├── extraction.ts           # Extraction prompts
│   └── validation.ts           # Validation prompts
├── training/
│   ├── examples.ts             # Few-shot examples
│   └── edge-cases.ts           # Known difficult cases
├── hooks/
│   └── useVoiceProcessing.ts
└── types/
    └── voice.types.ts
```

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Audio Download | From WhatsApp | P0 |
| Whisper Transcription | Spanish-AR optimized | P0 |
| Entity Extraction | GPT-4o with few-shot | P0 |
| Job Creation | From extracted data | P0 |
| Confirmation Message | Via WhatsApp | P0 |
| **Iterative Prompts** | Improve over time | P0 |
| **Edge Case Handling** | Slang, noise, etc. | P0 |
| Human Review | For low-confidence | P1 |

### Voice AI Service (Iterative - Critic Requirement)

```typescript
// modules/voice-ai/services/VoiceAIService.ts
export class VoiceAIService {
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  async processVoiceMessage(message: WhatsAppMessage, customer: Customer): Promise<ProcessResult> {
    // 1. Download audio
    const audioBuffer = await this.downloadAudio(message.media_url);

    // 2. Transcribe with Whisper
    const transcription = await this.transcribe(audioBuffer);

    // 3. Extract entities with confidence scores
    const extraction = await this.extractEntities(transcription, customer);

    // 4. Validate extraction
    const validation = await this.validateExtraction(extraction);

    // 5. Decide action based on confidence
    if (validation.overallConfidence >= this.CONFIDENCE_THRESHOLD) {
      // Auto-create job
      const job = await this.createJobFromExtraction(customer, extraction);
      await this.sendConfirmation(customer, job, extraction);
      return { status: 'auto_created', job, extraction };
    } else {
      // Queue for human review
      await this.queueForReview(message, transcription, extraction, validation);
      await this.sendAcknowledgment(customer);
      return { status: 'needs_review', extraction, validation };
    }
  }

  private async transcribe(audio: Buffer): Promise<TranscriptionResult> {
    const response = await this.openai.audio.transcriptions.create({
      file: new File([audio], 'audio.ogg', { type: 'audio/ogg' }),
      model: 'whisper-1',
      language: 'es',
      prompt: this.getTranscriptionPrompt()
    });

    return {
      text: response.text,
      // Whisper doesn't provide confidence, so we estimate based on patterns
      estimatedConfidence: this.estimateTranscriptionConfidence(response.text)
    };
  }

  private getTranscriptionPrompt(): string {
    // Prime Whisper with Argentine Spanish context
    return `Transcripción de mensaje de voz de cliente argentino solicitando servicio técnico.
Vocabulario común: plomero, gasista, electricista, aire acondicionado, split, calefón, 
termotanque, pérdida, goteo, cortocircuito, disyuntor, Mercado Pago, barrio.
Barrios de Buenos Aires: Palermo, Belgrano, Recoleta, Caballito, Flores, Villa Crespo,
Almagro, Boedo, Núñez, Saavedra, Villa Urquiza, Colegiales.`;
  }

  private async extractEntities(
    transcription: TranscriptionResult,
    customer: Customer
  ): Promise<ExtractionResult> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: this.getExtractionSystemPrompt()
        },
        {
          role: 'user',
          content: this.buildExtractionPrompt(transcription.text, customer)
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1 // Low temperature for consistency
    });

    return JSON.parse(response.choices[0].message.content);
  }

  private getExtractionSystemPrompt(): string {
    return `Sos un asistente que extrae información de mensajes de clientes argentinos 
solicitando servicios técnicos (plomería, electricidad, aire acondicionado, gas, etc.).

IMPORTANTE: Usá español argentino. Los clientes pueden usar:
- Vocabulario informal (vos, che, boludo)
- Abreviaciones (aire = aire acondicionado, split = aire split)
- Direcciones parciales ("en Palermo", "cerca de Plaza Italia")
- Horarios vagos ("a la mañana", "después del mediodía")

Para cada campo, proporcioná:
- valor: el valor extraído (null si no se menciona)
- confianza: número entre 0 y 1
- fuente: la frase exacta del mensaje de donde extrajiste el dato

Campos a extraer:
- nombre_cliente
- telefono_alternativo
- direccion_completa
- barrio
- problema_descripcion
- tipo_servicio (plomeria, electricidad, aire_acondicionado, gas, cerrajeria, otro)
- urgencia (urgente, normal, flexible)
- fecha_preferida
- hora_preferida
- notas_adicionales

Respondé SOLO con JSON válido.`;
  }

  private buildExtractionPrompt(text: string, customer: Customer): string {
    // Include customer context for better extraction
    return `Cliente existente:
- Nombre: ${customer.name}
- Teléfono: ${customer.phone}
- Dirección conocida: ${customer.address || 'No registrada'}
- Barrio conocido: ${customer.neighborhood || 'No registrado'}

Mensaje de voz transcripto:
"${text}"

Extraé la información del mensaje. Si el cliente menciona "mi casa" o "acá", 
usá la dirección conocida si existe.`;
  }

  private async validateExtraction(extraction: ExtractionResult): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let totalConfidence = 0;
    let fieldCount = 0;

    // Required fields
    if (!extraction.problema_descripcion?.valor) {
      issues.push({ field: 'problema_descripcion', issue: 'missing', severity: 'critical' });
    } else {
      totalConfidence += extraction.problema_descripcion.confianza;
      fieldCount++;
    }

    // Address validation
    if (extraction.direccion_completa?.valor) {
      const isValidAddress = await this.validateAddress(extraction.direccion_completa.valor);
      if (!isValidAddress) {
        issues.push({ field: 'direccion_completa', issue: 'invalid_address', severity: 'warning' });
      }
      totalConfidence += extraction.direccion_completa.confianza;
      fieldCount++;
    }

    // Date validation
    if (extraction.fecha_preferida?.valor) {
      const parsedDate = this.parseArgentineDate(extraction.fecha_preferida.valor);
      if (!parsedDate) {
        issues.push({ field: 'fecha_preferida', issue: 'unparseable', severity: 'warning' });
      }
      totalConfidence += extraction.fecha_preferida.confianza;
      fieldCount++;
    }

    return {
      issues,
      overallConfidence: fieldCount > 0 ? totalConfidence / fieldCount : 0,
      needsReview: issues.some(i => i.severity === 'critical') || 
                   (totalConfidence / fieldCount) < this.CONFIDENCE_THRESHOLD
    };
  }
}
```

### Few-Shot Examples (Training)

```typescript
// modules/voice-ai/training/examples.ts
export const FEW_SHOT_EXAMPLES: TrainingExample[] = [
  {
    transcription: "Hola, soy María, necesito un plomero urgente porque tengo una pérdida en el baño, estoy en Palermo, en la calle Honduras 4500, pueden venir hoy?",
    expected: {
      nombre_cliente: { valor: "María", confianza: 0.95, fuente: "soy María" },
      problema_descripcion: { valor: "pérdida en el baño", confianza: 0.95, fuente: "tengo una pérdida en el baño" },
      tipo_servicio: { valor: "plomeria", confianza: 0.9, fuente: "un plomero" },
      urgencia: { valor: "urgente", confianza: 0.95, fuente: "urgente" },
      direccion_completa: { valor: "Honduras 4500", confianza: 0.9, fuente: "Honduras 4500" },
      barrio: { valor: "Palermo", confianza: 0.95, fuente: "en Palermo" },
      fecha_preferida: { valor: "hoy", confianza: 0.9, fuente: "pueden venir hoy" }
    }
  },
  {
    transcription: "Che, el aire no enfría, debe ser el gas, podés mandar alguien mañana a la tarde? Estoy en Belgrano cerca del Chino",
    expected: {
      problema_descripcion: { valor: "aire no enfría, posible falta de gas", confianza: 0.85, fuente: "el aire no enfría, debe ser el gas" },
      tipo_servicio: { valor: "aire_acondicionado", confianza: 0.9, fuente: "el aire" },
      urgencia: { valor: "normal", confianza: 0.7, fuente: null },
      barrio: { valor: "Belgrano", confianza: 0.95, fuente: "en Belgrano" },
      direccion_completa: { valor: null, confianza: 0, fuente: null }, // "cerca del Chino" is not specific
      fecha_preferida: { valor: "mañana", confianza: 0.9, fuente: "mañana" },
      hora_preferida: { valor: "tarde", confianza: 0.85, fuente: "a la tarde" }
    }
  },
  {
    transcription: "[ruido de fondo] ...saltó la térmica... [inaudible] ...no tengo luz en la cocina...",
    expected: {
      problema_descripcion: { valor: "térmica saltó, sin luz en cocina", confianza: 0.7, fuente: "saltó la térmica... no tengo luz en la cocina" },
      tipo_servicio: { valor: "electricidad", confianza: 0.85, fuente: "térmica... luz" },
      urgencia: { valor: "normal", confianza: 0.5, fuente: null },
      notas_adicionales: { valor: "Audio con ruido, verificar detalles", confianza: 1.0, fuente: null }
    }
  }
];
```

### Database Tables

```sql
-- Module 7: Voice AI Processing
CREATE TABLE voice_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  message_id UUID REFERENCES whatsapp_messages(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  -- Processing
  audio_url TEXT,
  transcription TEXT,
  extraction JSONB,
  validation JSONB,
  -- Confidence
  overall_confidence DECIMAL(3, 2),
  -- Result
  status TEXT DEFAULT 'pending', -- pending, processing, completed, needs_review, failed
  created_job_id UUID REFERENCES jobs(id),
  -- Review
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Training data for improving prompts (NEW)
CREATE TABLE voice_ai_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  processing_job_id UUID REFERENCES voice_processing_jobs(id),
  -- Original
  transcription TEXT NOT NULL,
  extraction JSONB NOT NULL,
  -- Corrections
  corrected_extraction JSONB,
  correction_notes TEXT,
  -- Usage
  used_for_training BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_jobs_status ON voice_processing_jobs(status) WHERE status = 'needs_review';
```

### Interfaces

```typescript
// Module 7 exposes these interfaces
export interface IVoiceAIModule {
  // Processing
  processVoiceMessage(message: WhatsAppMessage, customer: Customer): Promise<ProcessResult>;
  
  // Review
  getPendingReviews(): Promise<VoiceProcessingJob[]>;
  approveExtraction(jobId: string, corrections?: Partial<ExtractionResult>): Promise<Job>;
  rejectExtraction(jobId: string, reason: string): Promise<void>;
  
  // Training
  addTrainingExample(jobId: string, corrections: ExtractionResult): Promise<void>;
  
  // Stats
  getAccuracyStats(): Promise<AccuracyStats>;
}
```

---

## MODULE 8: Mobile Technician App

**Purpose:** Field technician mobile application

**Workflows Covered:** #4 Technician Mobile App, #11 Job Completion Flow

### Components

```
modules/mobile/
├── app/                        # Expo Router
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx           # Today's jobs
│   │   ├── jobs/
│   │   │   ├── index.tsx       # Job list
│   │   │   ├── [id].tsx        # Job detail
│   │   │   └── [id]/
│   │   │       └── complete.tsx
│   │   └── settings.tsx
│   └── _layout.tsx
├── components/
│   ├── JobCard.tsx
│   ├── JobDetail.tsx
│   ├── StatusButtons.tsx
│   ├── PhotoCapture.tsx
│   ├── SignaturePad.tsx
│   ├── PriceBookPicker.tsx
│   ├── CustomerCard.tsx
│   └── NavigationButton.tsx
├── services/
│   ├── ApiService.ts
│   ├── AuthService.ts
│   ├── PhotoService.ts
│   ├── LocationService.ts
│   └── NotificationService.ts
├── hooks/
│   ├── useJobs.ts
│   ├── useJob.ts
│   ├── useAuth.ts
│   └── useLocation.ts
└── utils/
    ├── permissions.ts
    └── storage.ts
```

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Phone OTP Login | Argentine numbers | P0 |
| Today's Jobs | Dashboard view | P0 |
| Job List | With filters | P0 |
| Job Detail | Full information | P0 |
| Status Updates | Workflow buttons | P0 |
| "En Camino" | With WhatsApp notification | P0 |
| Photo Capture | Before/after | P0 |
| Signature Pad | Completion proof | P0 |
| Price Book Selection | Add line items | P0 |
| Tap-to-Call | Customer phone | P0 |
| Tap-to-WhatsApp | Direct chat | P0 |
| Navigate | Open in Maps/Waze | P0 |
| Push Notifications | New jobs, updates | P0 |
| **Error Handling** | Graceful degradation | P0 |
| **Retry on Failure** | For API calls | P0 |

### Mobile App Structure

```typescript
// modules/mobile/app/(tabs)/index.tsx
export default function TodayScreen() {
  const { jobs, isLoading, error, refetch } = useTodaysJobs();

  if (error) {
    return <ErrorView error={error} onRetry={refetch} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Hoy" subtitle={formatDate(new Date())} />
      
      <FlatList
        data={jobs}
        keyExtractor={(job) => job.id}
        renderItem={({ item }) => (
          <JobCard 
            job={item}
            onPress={() => router.push(`/jobs/${item.id}`)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <EmptyState 
            icon="calendar-check"
            title="Sin trabajos hoy"
            subtitle="No tenés trabajos agendados para hoy"
          />
        }
      />
    </SafeAreaView>
  );
}
```

```typescript
// modules/mobile/app/(tabs)/jobs/[id]/complete.tsx
export default function JobCompleteScreen() {
  const { id } = useLocalSearchParams();
  const { job } = useJob(id as string);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    if (!signature) {
      Alert.alert('Error', 'Se requiere firma del cliente');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload photos with retry
      const photoUrls = await uploadPhotosWithRetry(photos);

      // 2. Upload signature
      const signatureUrl = await uploadSignature(signature);

      // 3. Complete job
      await api.post(`/jobs/${id}/complete`, {
        photos: photoUrls,
        signature_url: signatureUrl,
        line_items: lineItems,
        actual_end: new Date().toISOString()
      });

      // 4. Navigate back
      Alert.alert(
        'Trabajo completado',
        'La factura y link de pago fueron enviados al cliente',
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );

    } catch (error) {
      Alert.alert(
        'Error',
        'No se pudo completar el trabajo. ¿Querés reintentar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Reintentar', onPress: handleComplete }
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Completar Trabajo</Text>

      {/* Photos */}
      <Section title="Fotos">
        <PhotoCapture
          photos={photos}
          onPhotosChange={setPhotos}
          maxPhotos={6}
        />
      </Section>

      {/* Services */}
      <Section title="Servicios Realizados">
        <PriceBookPicker
          items={lineItems}
          onItemsChange={setLineItems}
        />
        <TotalDisplay items={lineItems} />
      </Section>

      {/* Signature */}
      <Section title="Firma del Cliente">
        <SignaturePad
          signature={signature}
          onSignatureChange={setSignature}
        />
      </Section>

      {/* Submit */}
      <Button
        title="Completar y Facturar"
        onPress={handleComplete}
        loading={isSubmitting}
        disabled={!signature || isSubmitting}
        style={styles.submitButton}
      />
    </ScrollView>
  );
}
```

### Photo Upload with Retry

```typescript
// modules/mobile/services/PhotoService.ts
export class PhotoService {
  private readonly MAX_RETRIES = 3;

  async uploadPhotosWithRetry(photos: Photo[]): Promise<string[]> {
    const results: string[] = [];

    for (const photo of photos) {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
        try {
          // Compress photo
          const compressed = await this.compressPhoto(photo);

          // Upload to storage
          const url = await this.uploadToStorage(compressed);

          results.push(url);
          break;

        } catch (error) {
          lastError = error as Error;
          
          // Wait before retry
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }

      if (lastError && results.length < photos.length) {
        throw lastError;
      }
    }

    return results;
  }

  private async compressPhoto(photo: Photo): Promise<Blob> {
    const result = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    const response = await fetch(result.uri);
    return await response.blob();
  }
}
```

### Interfaces

```typescript
// Module 8 exposes these interfaces (for testing)
export interface IMobileModule {
  // Auth
  login(phone: string): Promise<void>;
  verifyOTP(phone: string, code: string): Promise<void>;
  logout(): Promise<void>;
  
  // Jobs
  getTodaysJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job>;
  updateJobStatus(id: string, status: JobStatus): Promise<void>;
  completeJob(id: string, data: CompletionData): Promise<void>;
  
  // Photos
  uploadPhotos(photos: Photo[]): Promise<string[]>;
  uploadSignature(signature: string): Promise<string>;
  
  // Navigation
  openNavigation(address: string): Promise<void>;
  openWhatsApp(phone: string): Promise<void>;
  openPhone(phone: string): Promise<void>;
}
```

---

# INFRASTRUCTURE LAYER

## Rate Limiting (NEW - Critic Requirement)

```typescript
// infrastructure/rate-limiting/RateLimiter.ts
export class RateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async checkLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    // Use sorted set for sliding window
    const multi = this.redis.multi();
    
    // Remove old entries
    multi.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries
    multi.zcard(key);
    
    // Add current request
    multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
    
    // Set expiry
    multi.expire(key, windowSeconds);

    const results = await multi.exec();
    const currentCount = results[1][1] as number;

    if (currentCount >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(windowStart + (windowSeconds * 1000))
      };
    }

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetAt: new Date(now + (windowSeconds * 1000))
    };
  }
}

// Rate limits by service
export const RATE_LIMITS = {
  whatsapp: { limit: 50, windowSeconds: 60 },      // 50/minute
  afip: { limit: 10, windowSeconds: 60 },          // 10/minute (conservative)
  mercadopago: { limit: 100, windowSeconds: 60 },  // 100/minute
  openai: { limit: 20, windowSeconds: 60 }         // 20/minute
};
```

## Error Handling (NEW - Critic Requirement)

```typescript
// infrastructure/errors/ErrorHandler.ts
export class ErrorHandler {
  async handleError(error: Error, context: ErrorContext): Promise<void> {
    // 1. Log error
    console.error('Error:', {
      message: error.message,
      stack: error.stack,
      context
    });

    // 2. Report to Sentry
    Sentry.captureException(error, {
      extra: context
    });

    // 3. Categorize and handle
    if (error instanceof AfipError) {
      await this.handleAfipError(error, context);
    } else if (error instanceof WhatsAppError) {
      await this.handleWhatsAppError(error, context);
    } else if (error instanceof MercadoPagoError) {
      await this.handleMercadoPagoError(error, context);
    }
  }

  private async handleAfipError(error: AfipError, context: ErrorContext): Promise<void> {
    // Queue for retry if transient
    if (error.isTransient) {
      await this.afipQueue.enqueue(context.invoiceId);
    } else {
      // Notify admin for permanent errors
      await this.notifyAdmin('AFIP Error', error.message, context);
    }
  }
}
```

## Queue System (NEW)

```typescript
// infrastructure/queues/QueueManager.ts
export class QueueManager {
  private queues: Map<string, Queue> = new Map();

  constructor() {
    // Initialize queues
    this.queues.set('afip', new Queue('afip-invoices', this.getQueueConfig('afip')));
    this.queues.set('whatsapp', new Queue('whatsapp-outbound', this.getQueueConfig('whatsapp')));
    this.queues.set('payments', new Queue('payment-sync', this.getQueueConfig('payments')));
  }

  private getQueueConfig(name: string): QueueOptions {
    const configs: Record<string, QueueOptions> = {
      afip: {
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 60000 }
        }
      },
      whatsapp: {
        limiter: { max: 50, duration: 60000 },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 }
        }
      },
      payments: {
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'fixed', delay: 30000 }
        }
      }
    };

    return configs[name] || {};
  }

  getQueue(name: string): Queue {
    const queue = this.queues.get(name);
    if (!queue) throw new Error(`Queue ${name} not found`);
    return queue;
  }
}
```

---

# DEVELOPMENT TIMELINE (Realistic - 14 Weeks)

## Pre-Development (Day -7 to 0)

| Task | Duration | Notes |
|------|----------|-------|
| Submit WhatsApp templates | Day -7 | Takes 1-5 days approval |
| Generate AFIP certificates | Day -7 | Start homologación process |
| Create MP sandbox account | Day -5 | |
| Set up Supabase project | Day -3 | |
| Initialize repository | Day -1 | |

## Week 1-2: Foundation

| Week | Focus | Modules | Deliverables |
|------|-------|---------|--------------|
| 1 | Core Setup | Auth, CRM | Login, customers, basic UI |
| 2 | Jobs | Jobs | Calendar, job CRUD, scheduling |

**QA Checkpoint:** Auth flow works, customers created, jobs scheduled

## Week 3-5: Argentina Integrations (Critical Path)

| Week | Focus | Modules | Deliverables |
|------|-------|---------|--------------|
| 3 | AFIP Part 1 | AFIP | WSAA tokens, invoice types |
| 4 | AFIP Part 2 | AFIP | CAE requests, PDF generation |
| 5 | AFIP Part 3 | AFIP | Retry logic, queue, homologación complete |

**QA Checkpoint:** Real CAEs from AFIP homologación

## Week 6-7: Payments & WhatsApp

| Week | Focus | Modules | Deliverables |
|------|-------|---------|--------------|
| 6 | Mercado Pago | MP | OAuth, payments, cuotas with TEA/CFT |
| 7 | WhatsApp | WhatsApp | Inbox, templates, send/receive |

**QA Checkpoint:** Payment links work, WhatsApp messages send

## Week 8-9: Voice AI (Iterative)

| Week | Focus | Modules | Deliverables |
|------|-------|---------|--------------|
| 8 | Voice AI v1 | Voice AI | Basic transcription, extraction |
| 9 | Voice AI v2 | Voice AI | Refinement, edge cases, confidence scoring |

**QA Checkpoint:** Voice messages create jobs with 70%+ accuracy

## Week 10-12: Mobile App

| Week | Focus | Modules | Deliverables |
|------|-------|---------|--------------|
| 10 | Mobile Core | Mobile | Auth, job list, job detail |
| 11 | Mobile Actions | Mobile | Status updates, photos, signature |
| 12 | Mobile Complete | Mobile | Full completion flow, polish |

**QA Checkpoint:** Complete job from mobile, invoice sent

## Week 13: Full Integration Testing

| Day | Focus |
|-----|-------|
| 1-2 | End-to-end flow testing |
| 3 | AFIP production testing |
| 4 | MP production testing |
| 5 | WhatsApp final approval |

## Week 14: Launch

| Day | Focus |
|-----|-------|
| 1 | App Store submissions |
| 2-3 | Wait for approval (buffer) |
| 4 | Production deployment |
| 5 | First 5 pilot customers |

---

# COST SUMMARY

## One-Time Costs

| Item | Cost (USD) |
|------|------------|
| Apple Developer | $99/year |
| Google Play | $25 |
| Domain | $15/year |
| **Total** | **~$140** |

## Monthly Infrastructure (100 users)

| Service | Low | High | Notes |
|---------|-----|------|-------|
| Supabase Pro | $25 | $50 | Database, auth, storage |
| Vercel Pro | $20 | $30 | Web hosting |
| Afip SDK | $50 | $100 | AFIP integration |
| Twilio/WhatsApp | $30 | $60 | Messages + phone |
| OpenAI | $30 | $80 | Whisper + GPT-4o |
| Upstash Redis | $10 | $20 | Queues, rate limiting |
| Sentry | $0 | $26 | Error tracking |
| **Total** | **$165** | **$366** | |

## Per-Customer Communication

| Item | Monthly Cost |
|------|--------------|
| WhatsApp (~30 msgs) | $0.30 |
| Voice transcription (~5 min) | $0.03 |
| AI extraction | $0.05 |
| **Total** | **~$0.40** |

---

# SUCCESS METRICS

## Week 14 (Launch)
- [ ] 5-10 pilot customers onboarded
- [ ] 100+ jobs created through platform
- [ ] AFIP integration working (real CAEs)
- [ ] MP payments processing
- [ ] Voice AI working with 70%+ confidence
- [ ] Mobile app in stores

## Month 3
- [ ] 50 paying customers
- [ ] <10% monthly churn
- [ ] $1,000+ MRR
- [ ] Voice AI 80%+ accuracy
- [ ] 4+ star App Store rating

## Month 6
- [ ] 150 paying customers
- [ ] <8% monthly churn
- [ ] $3,000+ MRR
- [ ] 30%+ referral growth

---

# POST-MVP ROADMAP

Only build after 100+ paying customers:

## V1.5 (Months 4-6)
- Offline-first mobile (WatermelonDB)
- Service plans (abonos)
- Basic equipment tracking
- Automated follow-up messages

## V2.0 (Months 7-12)
- Customer portal
- Online booking widget
- Inventory management
- Multi-user permissions
- Advanced reporting

---

# KEY REMINDERS

1. **WhatsApp templates first** - Submit Day -7, not Week 4
2. **AFIP takes 3 weeks minimum** - Don't underestimate
3. **Voice AI needs iteration** - Plan for 2 weeks of refinement
4. **Mobile needs 4 weeks** - Photos, signature, permissions
5. **QA throughout** - Not just Week 8
6. **Retry logic everywhere** - AFIP, WhatsApp, MP all fail
7. **Rate limiting** - Respect API quotas
8. **Onboarding is critical** - Users need guidance

---

*Document Version: 4.0 (Modular + Realistic Timeline)*
*Last Updated: December 2025*
*Core Workflows: 12*
*Modules: 8*
*Timeline: 14 weeks*
*Architecture: Modular with clear interfaces*
