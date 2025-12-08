# CampoTech: Complete Development Roadmap
## Full-Stack FSM Platform for Argentina | Web + iOS + Android

---

# EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Total Features** | 78 features across 6 phases |
| **Total Development Time** | 36-48 weeks (solo) / 20-28 weeks (team of 3) |
| **Platform Coverage** | Web App + iOS + Android + Customer Portal |
| **One-Time Costs** | ~$1,500 USD |
| **Monthly Infrastructure (100 users)** | $400-1,200 USD |

---

# TECHNICAL ARCHITECTURE

## Tech Stack (Final)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Web Frontend** | Next.js 14 (App Router) | SSR, API routes, SEO, great DX |
| **Mobile App** | React Native + Expo SDK 52 | iOS + Android from single codebase |
| **Component Library** | shadcn/ui + Tailwind CSS | Consistent UI across platforms |
| **Local DB (Mobile)** | WatermelonDB | Offline-first with sync |
| **Backend** | Supabase | Postgres, Auth, Realtime, Edge Functions, Storage |
| **API Layer** | tRPC or REST via Next.js API routes | Type-safe API calls |
| **Queue/Jobs** | Upstash Redis + BullMQ | Background jobs, automations |
| **AI/ML** | OpenAI (Whisper + GPT-4o) | Spanish transcription, entity extraction |
| **Telephony** | Twilio | WhatsApp Business API + Voice |
| **Payments** | Mercado Pago SDK | Argentina payments + cuotas |
| **Invoicing** | Afip SDK → Direct AFIP | Electronic invoicing with CAE |
| **Maps** | Google Maps Platform | Routing, geocoding, places |
| **Email** | Resend or SendGrid | Transactional emails |
| **File Storage** | Supabase Storage or Cloudflare R2 | PDFs, photos, documents |
| **Deployment** | Vercel (web) + EAS (mobile) | CI/CD, preview deployments |
| **Monitoring** | Sentry | Error tracking, performance |

## Repository Structure

```
campotech/
├── apps/
│   ├── web/                    # Next.js 14 web application
│   │   ├── app/               # App Router pages
│   │   ├── components/        # React components
│   │   └── lib/               # Utilities, API clients
│   ├── mobile/                 # React Native + Expo app
│   │   ├── app/               # Expo Router screens
│   │   ├── components/        # RN components
│   │   ├── db/                # WatermelonDB schemas
│   │   └── sync/              # Offline sync logic
│   └── portal/                 # Customer self-service portal
├── packages/
│   ├── api/                   # Shared API types & clients
│   ├── db/                    # Database schema & migrations
│   ├── ui/                    # Shared UI components
│   └── utils/                 # Shared utilities
├── services/
│   ├── afip/                  # AFIP integration service
│   ├── mercadopago/           # Payment service
│   ├── whatsapp/              # WhatsApp Business API
│   └── ai/                    # Voice-to-job, AI features
└── supabase/
    ├── migrations/            # Database migrations
    └── functions/             # Edge functions
```

---

# PHASE 0: PROJECT SETUP (Week 0)
*Foundation before any features*

## 0.1 Development Environment Setup
**Time:** 2-3 days

### Tasks
- [ ] Initialize monorepo with Turborepo
- [ ] Set up Next.js 14 with App Router
- [ ] Set up Expo SDK 52 with Expo Router
- [ ] Configure TypeScript across all packages
- [ ] Set up ESLint + Prettier
- [ ] Configure Tailwind CSS + shadcn/ui
- [ ] Set up Git repository + branching strategy
- [ ] Configure environment variables (.env structure)

### Commands
```bash
# Initialize monorepo
npx create-turbo@latest campotech

# Add web app
cd apps && npx create-next-app@latest web --typescript --tailwind --app

# Add mobile app
npx create-expo-app mobile --template tabs

# Add shared packages
mkdir -p packages/{api,db,ui,utils}
```

---

## 0.2 Supabase Project Setup
**Time:** 1 day

### Tasks
- [ ] Create Supabase project (production + staging)
- [ ] Configure authentication (email + phone)
- [ ] Set up Row Level Security (RLS) policies
- [ ] Create initial database schema
- [ ] Configure Supabase Storage buckets
- [ ] Set up Realtime subscriptions
- [ ] Configure Edge Functions environment

### Initial Database Tables
```sql
-- Core tables (create via Supabase migrations)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cuit TEXT UNIQUE,
  iva_condition TEXT,
  afip_punto_venta INTEGER,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id),
  role TEXT NOT NULL DEFAULT 'technician',
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  cuit TEXT,
  dni TEXT,
  iva_condition TEXT DEFAULT 'consumidor_final',
  address TEXT,
  neighborhood TEXT,
  city TEXT DEFAULT 'Buenos Aires',
  province TEXT DEFAULT 'CABA',
  notes TEXT,
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  assigned_to UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'scheduled',
  priority TEXT DEFAULT 'normal',
  job_type TEXT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  notes TEXT,
  photos TEXT[],
  signature_url TEXT,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  job_id UUID REFERENCES jobs(id),
  invoice_number TEXT NOT NULL,
  invoice_type TEXT DEFAULT 'B', -- A, B, C, E, M
  status TEXT DEFAULT 'draft',
  subtotal DECIMAL(12, 2),
  tax_amount DECIMAL(12, 2),
  total DECIMAL(12, 2),
  currency TEXT DEFAULT 'ARS',
  cae TEXT,
  cae_expiry DATE,
  qr_data TEXT,
  pdf_url TEXT,
  line_items JSONB DEFAULT '[]',
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  amount DECIMAL(12, 2) NOT NULL,
  method TEXT, -- mercadopago, cash, transfer
  status TEXT DEFAULT 'pending',
  mp_payment_id TEXT,
  mp_preference_id TEXT,
  installments INTEGER DEFAULT 1,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
```

---

## 0.3 External Service Accounts
**Time:** 1-2 days

### Tasks
- [ ] Create AFIP testing account (homologación)
- [ ] Generate AFIP digital certificates (testing)
- [ ] Create Mercado Pago developer account
- [ ] Set up Mercado Pago sandbox
- [ ] Create Meta Business account
- [ ] Apply for WhatsApp Business API access
- [ ] Create Twilio account
- [ ] Set up OpenAI API account
- [ ] Create Google Cloud project (Maps API)
- [ ] Set up Sentry project
- [ ] Create Resend/SendGrid account

### Credentials Needed
```env
# .env.local (example)
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AFIP
AFIP_CUIT=
AFIP_CERT_PATH=
AFIP_KEY_PATH=
AFIP_ENVIRONMENT=testing # or production

# Mercado Pago
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_WEBHOOK_SECRET=

# WhatsApp/Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ID=
WHATSAPP_ACCESS_TOKEN=

# OpenAI
OPENAI_API_KEY=

# Google
GOOGLE_MAPS_API_KEY=

# Email
RESEND_API_KEY=
```

---

## 0.4 CI/CD Pipeline Setup
**Time:** 1 day

### Tasks
- [ ] Configure GitHub Actions for web deployment
- [ ] Configure EAS Build for mobile
- [ ] Set up preview deployments (Vercel)
- [ ] Configure staging environment
- [ ] Set up database migration workflow
- [ ] Configure Sentry release tracking

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build --filter=web
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

# PHASE 1: ARGENTINA CORE (Weeks 1-12)
*MVP with all legally-required Argentina integrations*

---

## Sprint 1: Authentication & Organization Setup (Week 1)

### 1.1 User Authentication
**Time:** 3 days

**Features:**
- [ ] Email/password login
- [ ] Phone number login (OTP via SMS)
- [ ] Magic link authentication
- [ ] Password reset flow
- [ ] Session management
- [ ] Protected routes (web + mobile)

**Implementation:**
```typescript
// lib/auth.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const signIn = async (email: string, password: string) => {
  const supabase = createClientComponentClient();
  return supabase.auth.signInWithPassword({ email, password });
};

export const signInWithPhone = async (phone: string) => {
  const supabase = createClientComponentClient();
  return supabase.auth.signInWithOtp({ phone });
};
```

### 1.2 Organization & User Management
**Time:** 2 days

**Features:**
- [ ] Organization creation (onboarding)
- [ ] User profile management
- [ ] Role assignment (owner, admin, dispatcher, technician)
- [ ] Invite team members
- [ ] Organization settings

**Database:**
```sql
-- User roles enum
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'dispatcher', 'technician', 'accountant');

-- Add role column
ALTER TABLE users ADD COLUMN role user_role DEFAULT 'technician';
```

---

## Sprint 2: Client Management CRM (Week 2)

### 1.3 Customer Database
**Time:** 4 days

**Features:**
- [ ] Customer CRUD operations
- [ ] Argentine-specific fields (CUIT/CUIL/DNI, IVA condition)
- [ ] CUIT validation against AFIP
- [ ] Address autocomplete (Buenos Aires neighborhoods)
- [ ] Customer search & filtering
- [ ] Tags and custom fields
- [ ] Customer notes & contact log
- [ ] Service history view

**UI Components:**
- Customer list with infinite scroll
- Customer detail page
- Add/edit customer modal
- CUIT lookup component
- Address autocomplete input

**API Endpoints:**
```typescript
// app/api/customers/route.ts
export async function GET(request: Request) {
  // List customers with pagination, search, filters
}

export async function POST(request: Request) {
  // Create new customer
}

// app/api/customers/[id]/route.ts
export async function GET(request: Request, { params }) {
  // Get single customer with service history
}

export async function PATCH(request: Request, { params }) {
  // Update customer
}

export async function DELETE(request: Request, { params }) {
  // Soft delete customer
}

// app/api/customers/validate-cuit/route.ts
export async function POST(request: Request) {
  // Validate CUIT against AFIP padron
}
```

### 1.4 CUIT/CUIL Validation Service
**Time:** 1 day

**Features:**
- [ ] Validate CUIT format (11 digits, check digit)
- [ ] Query AFIP padron for business info
- [ ] Auto-fill company name and IVA condition
- [ ] Cache validation results

**Implementation:**
```typescript
// services/afip/cuit-validator.ts
export function validateCuitFormat(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false;
  
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digits = cuit.split('').map(Number);
  const checkDigit = digits.pop()!;
  
  const sum = digits.reduce((acc, digit, i) => acc + digit * multipliers[i], 0);
  const remainder = sum % 11;
  const calculatedCheck = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  
  return calculatedCheck === checkDigit;
}

export async function lookupCuit(cuit: string) {
  // Query AFIP's public CUIT lookup service
  const response = await fetch(
    `https://afip.tangofactura.com/Rest/GetContribuyente?cuit=${cuit}`
  );
  return response.json();
}
```

---

## Sprint 3: Scheduling & Calendar (Weeks 3-4)

### 1.5 Calendar View
**Time:** 4 days

**Features:**
- [ ] Day/Week/Month views
- [ ] Technician resource view
- [ ] Drag-and-drop job scheduling
- [ ] Job status color coding
- [ ] Quick job creation from calendar
- [ ] Mobile-responsive calendar

**Dependencies:**
```bash
npm install @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid \
  @fullcalendar/timegrid @fullcalendar/resource-timeline @fullcalendar/interaction
```

**Implementation:**
```typescript
// components/calendar/ScheduleCalendar.tsx
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';

export function ScheduleCalendar({ jobs, technicians }) {
  return (
    <FullCalendar
      plugins={[resourceTimelinePlugin, interactionPlugin]}
      initialView="resourceTimelineDay"
      resources={technicians.map(t => ({
        id: t.id,
        title: t.full_name,
      }))}
      events={jobs.map(j => ({
        id: j.id,
        title: j.title,
        start: j.scheduled_start,
        end: j.scheduled_end,
        resourceId: j.assigned_to,
        backgroundColor: getStatusColor(j.status),
      }))}
      editable={true}
      eventDrop={handleEventDrop}
      eventResize={handleEventResize}
      selectable={true}
      select={handleDateSelect}
    />
  );
}
```

### 1.6 Job Management
**Time:** 4 days

**Features:**
- [ ] Job CRUD operations
- [ ] Job status workflow (scheduled → dispatched → in_progress → completed)
- [ ] Technician assignment
- [ ] Customer linking
- [ ] Address geocoding
- [ ] Job notes and photos
- [ ] Time tracking (actual start/end)
- [ ] Job templates

**Database Additions:**
```sql
CREATE TABLE job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  estimated_duration INTEGER, -- minutes
  default_price DECIMAL(12, 2),
  checklist JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT, -- before, during, after
  taken_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE job_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.7 Dispatch Board
**Time:** 2 days

**Features:**
- [ ] Unassigned jobs queue
- [ ] Drag jobs to technicians
- [ ] Technician availability status
- [ ] Map view of jobs and technicians
- [ ] Real-time updates via Supabase Realtime

---

## Sprint 4: AFIP Electronic Invoicing (Weeks 5-6)

### 1.8 AFIP Integration Service
**Time:** 5 days

**Features:**
- [ ] WSAA authentication (token management)
- [ ] WSFEv1 integration (Facturas A, B, C, M)
- [ ] CAE request and storage
- [ ] Invoice numbering (sequential, per punto de venta)
- [ ] QR code generation
- [ ] Credit note support
- [ ] Homologación testing
- [ ] Production certification

**Service Architecture:**
```typescript
// services/afip/AfipService.ts
import Afip from '@afipsdk/afip.js';

export class AfipService {
  private afip: Afip;
  
  constructor(cuit: string, certPath: string, keyPath: string) {
    this.afip = new Afip({
      CUIT: cuit,
      cert: certPath,
      key: keyPath,
      production: process.env.AFIP_ENVIRONMENT === 'production'
    });
  }

  async createInvoice(data: InvoiceData): Promise<AFIPResponse> {
    const lastVoucher = await this.afip.ElectronicBilling.getLastVoucher(
      data.puntoVenta,
      data.tipoComprobante
    );
    
    const invoiceData = {
      CantReg: 1,
      PtoVta: data.puntoVenta,
      CbteTipo: data.tipoComprobante,
      Concepto: 1, // Productos
      DocTipo: data.docTipo,
      DocNro: data.docNro,
      CbteDesde: lastVoucher + 1,
      CbteHasta: lastVoucher + 1,
      CbteFch: formatDate(new Date()),
      ImpTotal: data.total,
      ImpTotConc: 0,
      ImpNeto: data.neto,
      ImpOpEx: 0,
      ImpIVA: data.iva,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1,
      Iva: data.ivaDetails
    };
    
    const response = await this.afip.ElectronicBilling.createVoucher(invoiceData);
    
    return {
      cae: response.CAE,
      caeExpiry: response.CAEFchVto,
      invoiceNumber: lastVoucher + 1,
      qrData: this.generateQRData(response, data)
    };
  }

  private generateQRData(response: any, data: InvoiceData): string {
    // Generate QR data per AFIP RG 4291
    const qrPayload = {
      ver: 1,
      fecha: formatDate(new Date()),
      cuit: this.afip.CUIT,
      ptoVta: data.puntoVenta,
      tipoCmp: data.tipoComprobante,
      nroCmp: response.CbteDesde,
      importe: data.total,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: data.docTipo,
      nroDocRec: data.docNro,
      tipoCodAut: 'E',
      codAut: response.CAE
    };
    
    const base64 = Buffer.from(JSON.stringify(qrPayload)).toString('base64');
    return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
  }
}
```

### 1.9 Invoice Management
**Time:** 4 days

**Features:**
- [ ] Invoice creation from jobs
- [ ] Line item management
- [ ] Tax calculation (IVA 21%, 10.5%, 27%, exempt)
- [ ] Automatic AFIP CAE request
- [ ] Invoice PDF generation
- [ ] PDF with QR code
- [ ] Invoice email delivery
- [ ] Invoice WhatsApp delivery
- [ ] Invoice status tracking (draft, issued, paid, cancelled)

**PDF Generation:**
```typescript
// services/pdf/InvoicePDF.tsx
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import QRCode from 'qrcode';

export async function generateInvoicePDF(invoice: Invoice): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(invoice.qr_data);
  
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with company info */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{invoice.organization.name}</Text>
          <Text>CUIT: {invoice.organization.cuit}</Text>
          <Text>IVA {invoice.organization.iva_condition}</Text>
        </View>
        
        {/* Invoice type and number */}
        <View style={styles.invoiceType}>
          <Text style={styles.invoiceTypeLetter}>{invoice.invoice_type}</Text>
          <Text>Factura N° {invoice.invoice_number}</Text>
          <Text>Fecha: {formatDate(invoice.issued_at)}</Text>
        </View>
        
        {/* Customer info */}
        <View style={styles.customer}>
          <Text>{invoice.customer.name}</Text>
          <Text>CUIT/DNI: {invoice.customer.cuit || invoice.customer.dni}</Text>
          <Text>{invoice.customer.address}</Text>
        </View>
        
        {/* Line items */}
        <View style={styles.items}>
          {invoice.line_items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text>{item.description}</Text>
              <Text>{item.quantity} x ${item.unit_price}</Text>
              <Text>${item.total}</Text>
            </View>
          ))}
        </View>
        
        {/* Totals */}
        <View style={styles.totals}>
          <Text>Subtotal: ${invoice.subtotal}</Text>
          <Text>IVA 21%: ${invoice.tax_amount}</Text>
          <Text style={styles.totalAmount}>Total: ${invoice.total}</Text>
        </View>
        
        {/* CAE and QR */}
        <View style={styles.footer}>
          <Text>CAE: {invoice.cae}</Text>
          <Text>Vto. CAE: {formatDate(invoice.cae_expiry)}</Text>
          <Image src={qrDataUrl} style={styles.qrCode} />
        </View>
      </Page>
    </Document>
  );
  
  return await renderToBuffer(doc);
}
```

---

## Sprint 5: Mercado Pago Integration (Weeks 7-8)

### 1.10 Mercado Pago Service
**Time:** 4 days

**Features:**
- [ ] Account connection (OAuth)
- [ ] QR code payment generation
- [ ] Payment link creation
- [ ] Cuotas (installments) support
- [ ] Cuotas sin Tarjeta
- [ ] Webhook handling
- [ ] Payment status sync
- [ ] Refund processing

**Implementation:**
```typescript
// services/mercadopago/MercadoPagoService.ts
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

export class MercadoPagoService {
  private client: MercadoPagoConfig;
  
  constructor(accessToken: string) {
    this.client = new MercadoPagoConfig({ accessToken });
  }

  async createPaymentPreference(invoice: Invoice): Promise<PreferenceResponse> {
    const preference = new Preference(this.client);
    
    const response = await preference.create({
      body: {
        items: [{
          id: invoice.id,
          title: `Factura #${invoice.invoice_number}`,
          description: invoice.line_items.map(i => i.description).join(', '),
          quantity: 1,
          unit_price: Number(invoice.total),
          currency_id: 'ARS'
        }],
        payment_methods: {
          installments: 12,
          default_installments: 1
        },
        back_urls: {
          success: `${process.env.APP_URL}/payments/success`,
          failure: `${process.env.APP_URL}/payments/failure`,
          pending: `${process.env.APP_URL}/payments/pending`
        },
        notification_url: `${process.env.APP_URL}/api/webhooks/mercadopago`,
        external_reference: invoice.id,
        expires: true,
        expiration_date_to: addDays(new Date(), 7).toISOString()
      }
    });
    
    return response;
  }

  async createPaymentLink(invoice: Invoice): Promise<string> {
    const preference = await this.createPaymentPreference(invoice);
    return preference.init_point; // Returns: https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=xxx
  }

  async getInstallmentOptions(amount: number, paymentMethodId: string): Promise<InstallmentOption[]> {
    // Returns installment options with TEA, CFT for legal compliance
    const response = await fetch(
      `https://api.mercadopago.com/v1/payment_methods/installments?` +
      `access_token=${this.accessToken}&amount=${amount}&payment_method_id=${paymentMethodId}`
    );
    return response.json();
  }

  async handleWebhook(data: WebhookPayload): Promise<void> {
    if (data.type === 'payment') {
      const payment = new Payment(this.client);
      const paymentData = await payment.get({ id: data.data.id });
      
      // Update payment status in database
      await updatePaymentStatus(paymentData.external_reference, {
        status: paymentData.status,
        mp_payment_id: paymentData.id,
        installments: paymentData.installments,
        received_at: paymentData.status === 'approved' ? new Date() : null
      });
    }
  }
}
```

### 1.11 Payment UI Components
**Time:** 3 days

**Features:**
- [ ] Payment status display
- [ ] Cuotas selector with CFT/TEA display
- [ ] QR code display component
- [ ] Payment link sharing (WhatsApp, email, copy)
- [ ] Payment confirmation screen
- [ ] Outstanding balance dashboard

**Legal Compliance (Resolution E 51/2017):**
```typescript
// components/payments/InstallmentSelector.tsx
export function InstallmentSelector({ amount, options }: Props) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <div key={option.installments} className="border rounded p-4">
          <div className="flex justify-between">
            <span>{option.installments} cuotas de ${option.installment_amount}</span>
            <span>Total: ${option.total_amount}</span>
          </div>
          
          {/* CFT must be displayed 5x larger per Argentine law */}
          <div className="text-xs text-muted-foreground mt-2">
            TEA: {option.tea}%
          </div>
          <div className="text-lg font-bold">
            CFT: {option.cft}%
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Sprint 6: WhatsApp Business Integration (Weeks 9-10)

### 1.12 WhatsApp Cloud API Setup
**Time:** 3 days

**Features:**
- [ ] Meta Business verification
- [ ] WhatsApp Business API connection
- [ ] Webhook configuration
- [ ] Message template creation and approval
- [ ] Phone number registration

**Message Templates:**
```typescript
// services/whatsapp/templates.ts
export const MESSAGE_TEMPLATES = {
  JOB_CONFIRMATION: {
    name: 'job_confirmation',
    language: 'es_AR',
    components: [
      {
        type: 'BODY',
        text: 'Hola {{1}}, tu cita con {{2}} está confirmada para el {{3}} a las {{4}}. Dirección: {{5}}. Respondé a este mensaje si necesitás hacer cambios.'
      }
    ]
  },
  ON_MY_WAY: {
    name: 'technician_en_route',
    language: 'es_AR',
    components: [
      {
        type: 'BODY',
        text: '{{1}} está en camino a tu domicilio. Tiempo estimado de llegada: {{2}} minutos. Podés seguir la ubicación en tiempo real: {{3}}'
      }
    ]
  },
  PAYMENT_REQUEST: {
    name: 'payment_request',
    language: 'es_AR',
    components: [
      {
        type: 'BODY',
        text: '{{1}}, acá tenés el link para pagar tu servicio de {{2}}:\n💳 {{3}}\nTotal: ${{4}}\nPodés pagar en hasta 12 cuotas con Mercado Pago.'
      }
    ]
  },
  INVOICE_DELIVERY: {
    name: 'invoice_delivery',
    language: 'es_AR',
    components: [
      {
        type: 'BODY',
        text: '{{1}}, adjuntamos la factura electrónica #{{2}} por tu servicio.\n📄 Ver factura: {{3}}\nGracias por confiar en nosotros.'
      }
    ]
  }
};
```

### 1.13 WhatsApp Messaging Service
**Time:** 4 days

**Features:**
- [ ] Send template messages
- [ ] Send free-form messages (within 24h window)
- [ ] Receive incoming messages (webhook)
- [ ] Send media (images, PDFs)
- [ ] Message status tracking
- [ ] Conversation threading
- [ ] Auto-reply bot

**Implementation:**
```typescript
// services/whatsapp/WhatsAppService.ts
export class WhatsAppService {
  private baseUrl = 'https://graph.facebook.com/v18.0';
  
  constructor(
    private phoneNumberId: string,
    private accessToken: string
  ) {}

  async sendTemplateMessage(
    to: string,
    templateName: string,
    parameters: string[]
  ): Promise<MessageResponse> {
    const response = await fetch(
      `${this.baseUrl}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formatArgentinePhone(to),
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'es_AR' },
            components: [{
              type: 'body',
              parameters: parameters.map(p => ({ type: 'text', text: p }))
            }]
          }
        })
      }
    );
    
    return response.json();
  }

  async sendJobConfirmation(job: Job): Promise<void> {
    await this.sendTemplateMessage(
      job.customer.phone,
      'job_confirmation',
      [
        job.customer.name,
        job.technician.full_name,
        formatDate(job.scheduled_start),
        formatTime(job.scheduled_start),
        job.address
      ]
    );
  }

  async sendPaymentLink(invoice: Invoice, paymentLink: string): Promise<void> {
    await this.sendTemplateMessage(
      invoice.customer.phone,
      'payment_request',
      [
        invoice.customer.name,
        invoice.job?.title || 'Servicio Técnico',
        paymentLink,
        invoice.total.toString()
      ]
    );
  }

  async sendInvoice(invoice: Invoice): Promise<void> {
    // First send the PDF
    await this.sendDocument(
      invoice.customer.phone,
      invoice.pdf_url,
      `Factura_${invoice.invoice_number}.pdf`
    );
    
    // Then send the template message
    await this.sendTemplateMessage(
      invoice.customer.phone,
      'invoice_delivery',
      [
        invoice.customer.name,
        invoice.invoice_number,
        invoice.pdf_url
      ]
    );
  }
}
```

### 1.14 WhatsApp Inbox
**Time:** 3 days

**Features:**
- [ ] Unified inbox for all WhatsApp conversations
- [ ] Real-time message updates
- [ ] Message search
- [ ] Link conversations to customers
- [ ] Quick replies
- [ ] File/image viewing

---

## Sprint 7: Voice-to-Job AI Feature (Week 11)

### 1.15 Audio Message Processing
**Time:** 4 days

**Features:**
- [ ] Receive WhatsApp voice messages
- [ ] Audio transcription (Whisper API)
- [ ] Spanish language optimization
- [ ] Entity extraction (GPT-4)
- [ ] Job creation from transcript
- [ ] Confirmation message

**Implementation:**
```typescript
// services/ai/VoiceToJobService.ts
import OpenAI from 'openai';

export class VoiceToJobService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async processVoiceMessage(audioBuffer: Buffer): Promise<JobData> {
    // Step 1: Transcribe audio
    const transcription = await this.openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' }),
      language: 'es',
      prompt: 'Transcripción de mensaje de voz sobre trabajo de servicio técnico en Buenos Aires, Argentina.'
    });

    // Step 2: Extract job details
    const extraction = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Sos un asistente que extrae información de trabajos de servicio técnico en Argentina.
          
Extraé la siguiente información del mensaje:
- customer_name: Nombre del cliente
- phone: Teléfono del cliente (formato argentino)
- address: Dirección completa
- neighborhood: Barrio de Buenos Aires
- scheduled_date: Fecha del trabajo (formato ISO)
- scheduled_time: Hora del trabajo
- job_type: Tipo de trabajo (plomería, electricidad, HVAC, etc.)
- description: Descripción del problema
- urgency: Urgencia (normal, urgente, emergencia)
- notes: Notas adicionales

Respondé SOLO con un JSON válido.`
        },
        {
          role: 'user',
          content: transcription.text
        }
      ],
      response_format: { type: 'json_object' }
    });

    const jobData = JSON.parse(extraction.choices[0].message.content);
    
    return {
      ...jobData,
      source: 'voice_message',
      original_transcript: transcription.text
    };
  }

  async handleWhatsAppAudio(messageId: string, from: string): Promise<void> {
    // Download audio from WhatsApp
    const audioBuffer = await this.downloadWhatsAppMedia(messageId);
    
    // Process and extract job
    const jobData = await this.processVoiceMessage(audioBuffer);
    
    // Find or create customer
    const customer = await findOrCreateCustomer({
      phone: from,
      name: jobData.customer_name,
      address: jobData.address,
      neighborhood: jobData.neighborhood
    });
    
    // Create job
    const job = await createJob({
      customer_id: customer.id,
      title: `${jobData.job_type} - ${jobData.description.slice(0, 50)}`,
      description: jobData.description,
      address: jobData.address,
      scheduled_start: parseDateTime(jobData.scheduled_date, jobData.scheduled_time),
      priority: jobData.urgency,
      notes: `Creado por voz: "${jobData.original_transcript}"\n\n${jobData.notes}`
    });
    
    // Send confirmation
    await whatsapp.sendMessage(from, 
      `✅ Trabajo creado:\n` +
      `📋 ${job.title}\n` +
      `👤 ${customer.name}\n` +
      `📍 ${job.address}\n` +
      `📅 ${formatDate(job.scheduled_start)} ${formatTime(job.scheduled_start)}`
    );
  }
}
```

---

## Sprint 8: Mobile App Foundation (Week 12)

### 1.16 Expo Project Setup
**Time:** 2 days

**Features:**
- [ ] Expo SDK 52 configuration
- [ ] Expo Router setup
- [ ] Authentication flow
- [ ] Push notifications setup
- [ ] App icons and splash screen
- [ ] EAS Build configuration

### 1.17 Mobile Core Screens
**Time:** 3 days

**Screens:**
- [ ] Login/Phone OTP
- [ ] Dashboard (today's jobs)
- [ ] Job list with filters
- [ ] Job detail view
- [ ] Customer quick view
- [ ] Settings

---

# PHASE 2: MOBILE OFFLINE-FIRST (Weeks 13-18)
*Full mobile app with offline capabilities*

---

## Sprint 9: WatermelonDB Integration (Week 13)

### 2.1 Local Database Schema
**Time:** 4 days

**Features:**
- [ ] WatermelonDB setup
- [ ] Schema definition (jobs, customers, invoices)
- [ ] Model classes with decorators
- [ ] Relationships
- [ ] Observable queries

**Implementation:**
```typescript
// mobile/db/schema.ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'jobs',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'customer_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'priority', type: 'string' },
        { name: 'address', type: 'string' },
        { name: 'lat', type: 'number', isOptional: true },
        { name: 'lng', type: 'number', isOptional: true },
        { name: 'scheduled_start', type: 'number', isIndexed: true },
        { name: 'scheduled_end', type: 'number', isOptional: true },
        { name: 'actual_start', type: 'number', isOptional: true },
        { name: 'actual_end', type: 'number', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'photos', type: 'string', isOptional: true }, // JSON array
        { name: 'signature_data', type: 'string', isOptional: true },
        { name: 'is_synced', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),
    tableSchema({
      name: 'customers',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string', isIndexed: true },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'cuit', type: 'string', isOptional: true },
        { name: 'address', type: 'string', isOptional: true },
        { name: 'neighborhood', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'is_synced', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),
    tableSchema({
      name: 'offline_queue',
      columns: [
        { name: 'operation_type', type: 'string' },
        { name: 'payload', type: 'string' }, // JSON
        { name: 'status', type: 'string' },
        { name: 'retries', type: 'number' },
        { name: 'error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' }
      ]
    })
  ]
});

// mobile/db/models/Job.ts
import { Model } from '@nozbe/watermelondb';
import { field, date, relation, readonly, writer } from '@nozbe/watermelondb/decorators';

export default class Job extends Model {
  static table = 'jobs';

  static associations = {
    customers: { type: 'belongs_to', key: 'customer_id' }
  };

  @field('server_id') serverId;
  @field('customer_id') customerId;
  @field('title') title;
  @field('description') description;
  @field('status') status;
  @field('priority') priority;
  @field('address') address;
  @field('lat') lat;
  @field('lng') lng;
  @date('scheduled_start') scheduledStart;
  @date('scheduled_end') scheduledEnd;
  @date('actual_start') actualStart;
  @date('actual_end') actualEnd;
  @field('notes') notes;
  @field('photos') photosJson;
  @field('signature_data') signatureData;
  @field('is_synced') isSynced;
  @readonly @date('created_at') createdAt;
  @date('updated_at') updatedAt;

  @relation('customers', 'customer_id') customer;

  get photos() {
    return this.photosJson ? JSON.parse(this.photosJson) : [];
  }

  @writer async updateStatus(newStatus) {
    await this.update(job => {
      job.status = newStatus;
      job.updatedAt = new Date();
      job.isSynced = false;
      if (newStatus === 'in_progress' && !job.actualStart) {
        job.actualStart = new Date();
      }
      if (newStatus === 'completed') {
        job.actualEnd = new Date();
      }
    });
  }
}
```

### 2.2 Sync Engine
**Time:** 4 days

**Features:**
- [ ] Pull changes from server
- [ ] Push local changes
- [ ] Conflict resolution (last-write-wins + field merge)
- [ ] Delta sync (only changed records)
- [ ] Sync status tracking
- [ ] Background sync

**Implementation:**
```typescript
// mobile/sync/syncEngine.ts
import { synchronize } from '@nozbe/watermelondb/sync';
import NetInfo from '@react-native-community/netinfo';

export class SyncEngine {
  private database: Database;
  private isSyncing = false;

  async sync(): Promise<SyncResult> {
    if (this.isSyncing) return { status: 'already_syncing' };
    
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      return { status: 'offline' };
    }

    this.isSyncing = true;

    try {
      await synchronize({
        database: this.database,
        
        pullChanges: async ({ lastPulledAt, schemaVersion }) => {
          const response = await fetch(
            `${API_URL}/sync/pull?last_pulled_at=${lastPulledAt || 0}&schema_version=${schemaVersion}`,
            { headers: { Authorization: `Bearer ${await getToken()}` } }
          );
          
          if (!response.ok) throw new Error('Pull failed');
          
          const { changes, timestamp } = await response.json();
          return { changes, timestamp };
        },
        
        pushChanges: async ({ changes, lastPulledAt }) => {
          const response = await fetch(`${API_URL}/sync/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${await getToken()}`
            },
            body: JSON.stringify({ changes, lastPulledAt })
          });
          
          if (!response.ok) throw new Error('Push failed');
        },
        
        migrationsEnabledAtVersion: 1
      });

      // Process offline queue after successful sync
      await this.processOfflineQueue();

      return { status: 'success' };
    } catch (error) {
      console.error('Sync failed:', error);
      return { status: 'error', error };
    } finally {
      this.isSyncing = false;
    }
  }

  async processOfflineQueue(): Promise<void> {
    const queue = await this.database
      .get('offline_queue')
      .query(Q.where('status', 'pending'))
      .fetch();

    for (const item of queue) {
      try {
        const payload = JSON.parse(item.payload);
        
        switch (item.operationType) {
          case 'CREATE_INVOICE':
            await this.createInvoiceOnServer(payload);
            break;
          case 'UPLOAD_PHOTO':
            await this.uploadPhotoToServer(payload);
            break;
          // ... other operations
        }

        await item.update(q => { q.status = 'completed'; });
      } catch (error) {
        await item.update(q => {
          q.retries += 1;
          q.error = error.message;
          if (q.retries >= 3) q.status = 'failed';
        });
      }
    }
  }
}
```

---

## Sprint 10: Mobile Job Management (Week 14)

### 2.3 Job List Screen
**Time:** 2 days

**Features:**
- [ ] Today's jobs view
- [ ] Upcoming jobs
- [ ] Job search
- [ ] Filter by status
- [ ] Pull-to-refresh
- [ ] Optimistic updates

### 2.4 Job Detail Screen
**Time:** 3 days

**Features:**
- [ ] Full job details
- [ ] Customer info with tap-to-call/WhatsApp
- [ ] Status update buttons
- [ ] Navigate to address
- [ ] Add notes
- [ ] View/add photos
- [ ] View service history

### 2.5 "En Camino" Feature
**Time:** 2 days

**Features:**
- [ ] One-tap "On My Way" button
- [ ] Automatic WhatsApp notification
- [ ] ETA calculation
- [ ] Location sharing link
- [ ] Status update to "dispatched"

---

## Sprint 11: Mobile Photo & Signature (Week 15)

### 2.6 Photo Capture
**Time:** 3 days

**Features:**
- [ ] Camera integration
- [ ] Photo gallery picker
- [ ] Before/After photo types
- [ ] Photo compression
- [ ] Offline storage
- [ ] Background upload when online
- [ ] Photo viewer with zoom

### 2.7 Signature Capture
**Time:** 2 days

**Features:**
- [ ] Canvas-based signature pad
- [ ] Clear and redo
- [ ] Save as base64
- [ ] Display on completed jobs
- [ ] Attach to invoices

**Implementation:**
```typescript
// mobile/components/SignaturePad.tsx
import SignatureScreen from 'react-native-signature-canvas';

export function SignaturePad({ onSave, onClear }) {
  const ref = useRef<SignatureScreen>(null);

  const handleSave = (signature: string) => {
    // signature is base64 data URL
    onSave(signature);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Firma del cliente</Text>
      <SignatureScreen
        ref={ref}
        onOK={handleSave}
        webStyle={`
          .m-signature-pad { box-shadow: none; border: 1px solid #ccc; border-radius: 8px; }
          .m-signature-pad--body { border: none; }
        `}
        descriptionText="Firme aquí"
        clearText="Borrar"
        confirmText="Guardar"
      />
    </View>
  );
}
```

---

## Sprint 12: Mobile Invoicing & Payments (Week 16)

### 2.8 Mobile Invoice Creation
**Time:** 3 days

**Features:**
- [ ] Create invoice from job
- [ ] Add/edit line items
- [ ] Calculate totals with tax
- [ ] Queue AFIP request (offline)
- [ ] View invoice PDF
- [ ] Send via WhatsApp

### 2.9 Mobile Payment Collection
**Time:** 3 days

**Features:**
- [ ] Display Mercado Pago QR
- [ ] Share payment link
- [ ] Cash payment recording
- [ ] Payment confirmation display
- [ ] Outstanding balance

---

## Sprint 13: Mobile Maps & Navigation (Week 17)

### 2.10 Map Integration
**Time:** 3 days

**Features:**
- [ ] Map view of today's jobs
- [ ] Job pins with status colors
- [ ] Current location display
- [ ] Tap pin for job details

### 2.11 Navigation Integration
**Time:** 2 days

**Features:**
- [ ] One-tap navigate (Google Maps/Waze)
- [ ] Address geocoding
- [ ] ETA display
- [ ] Route optimization suggestion

---

## Sprint 14: Push Notifications & Background (Week 18)

### 2.12 Push Notifications
**Time:** 3 days

**Features:**
- [ ] Expo Push Notifications setup
- [ ] New job assignment alerts
- [ ] Job reminder (30 min before)
- [ ] Payment received notification
- [ ] WhatsApp message notification
- [ ] Notification preferences

### 2.13 Background Sync
**Time:** 2 days

**Features:**
- [ ] Background fetch configuration
- [ ] Silent sync on network change
- [ ] Battery-efficient scheduling
- [ ] Sync when app backgrounds

---

# PHASE 3: AUTOMATION & EFFICIENCY (Weeks 19-24)
*Workflow automation and productivity features*

---

## Sprint 15: Estimates & Proposals (Week 19)

### 3.1 Estimate Builder
**Time:** 4 days

**Features:**
- [ ] Estimate creation
- [ ] Line item management
- [ ] Good/Better/Best options
- [ ] Estimate templates
- [ ] Discount handling
- [ ] Deposit requirement
- [ ] Estimate expiration

### 3.2 Customer-Facing Estimate View
**Time:** 2 days

**Features:**
- [ ] Public estimate link
- [ ] Mobile-responsive view
- [ ] Option selection
- [ ] E-signature capture
- [ ] Accept/decline workflow
- [ ] Convert to job on accept

### 3.3 Estimate PDF Generation
**Time:** 1 day

**Features:**
- [ ] Professional PDF layout
- [ ] Company branding
- [ ] Terms and conditions
- [ ] WhatsApp/email delivery

---

## Sprint 16: Workflow Automations (Week 20)

### 3.4 Automation Engine
**Time:** 4 days

**Features:**
- [ ] Trigger → Condition → Action framework
- [ ] Event triggers (job created, status changed, payment received)
- [ ] Time-based triggers (before appointment, after completion)
- [ ] Multiple actions per automation
- [ ] Automation templates
- [ ] Automation logs

**Automation Types:**
```typescript
// Automation examples
const AUTOMATION_TEMPLATES = [
  {
    name: 'Job Confirmation',
    trigger: { type: 'job_created' },
    actions: [
      { type: 'send_whatsapp', template: 'job_confirmation', delay: 0 }
    ]
  },
  {
    name: 'Day-Before Reminder',
    trigger: { type: 'time_before_job', hours: 24 },
    actions: [
      { type: 'send_whatsapp', template: 'appointment_reminder' }
    ]
  },
  {
    name: 'Payment Follow-Up',
    trigger: { type: 'invoice_sent', days_after: 3 },
    conditions: [{ type: 'invoice_unpaid' }],
    actions: [
      { type: 'send_whatsapp', template: 'payment_reminder' }
    ]
  },
  {
    name: 'Review Request',
    trigger: { type: 'job_completed' },
    actions: [
      { type: 'send_whatsapp', template: 'review_request', delay: 86400000 } // 24h later
    ]
  }
];
```

### 3.5 Automation UI
**Time:** 2 days

**Features:**
- [ ] Automation list/grid
- [ ] Visual automation builder
- [ ] Enable/disable toggle
- [ ] Execution history
- [ ] Error notifications

---

## Sprint 17: Service History & Equipment (Week 21)

### 3.6 Equipment Tracking
**Time:** 3 days

**Features:**
- [ ] Equipment database
- [ ] Link equipment to customers
- [ ] Model, serial, install date
- [ ] Warranty tracking
- [ ] Service history per equipment
- [ ] QR code labels
- [ ] Equipment photos

### 3.7 Service History View
**Time:** 2 days

**Features:**
- [ ] Complete job history per customer
- [ ] Equipment service timeline
- [ ] Photo history
- [ ] Invoice history
- [ ] Notes across visits
- [ ] Search and filter

---

## Sprint 18: Service Plans (Abonos) (Week 22)

### 3.8 Service Plan Management
**Time:** 4 days

**Features:**
- [ ] Plan templates (monthly, quarterly, annual)
- [ ] Customer enrollment
- [ ] Automatic job scheduling
- [ ] Recurring Mercado Pago payments
- [ ] Plan renewal reminders
- [ ] Plan expiration handling
- [ ] Revenue forecasting

**Database:**
```sql
CREATE TABLE service_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT, -- monthly, quarterly, biannual, annual
  price DECIMAL(12, 2),
  includes JSONB DEFAULT '[]', -- list of services included
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customer_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  customer_id UUID REFERENCES customers(id),
  plan_id UUID REFERENCES service_plans(id),
  status TEXT DEFAULT 'active',
  start_date DATE,
  next_billing_date DATE,
  next_service_date DATE,
  mp_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Sprint 19: Inventory Management (Week 23)

### 3.9 Parts & Materials Database
**Time:** 3 days

**Features:**
- [ ] Parts catalog
- [ ] SKU management
- [ ] Cost price vs. sell price
- [ ] Supplier information
- [ ] Part photos
- [ ] Categories and tags
- [ ] Search and filter

### 3.10 Stock Management
**Time:** 3 days

**Features:**
- [ ] Stock levels by location (warehouse, trucks)
- [ ] Low-stock alerts
- [ ] Stock adjustments
- [ ] Stock transfers
- [ ] Barcode/QR scanning
- [ ] Parts usage per job
- [ ] Usage reports

---

## Sprint 20: Reporting Dashboard (Week 24)

### 3.11 Business Dashboard
**Time:** 4 days

**Features:**
- [ ] Revenue overview (daily/weekly/monthly)
- [ ] Jobs completed vs. scheduled
- [ ] Payment collection rate
- [ ] Outstanding balance
- [ ] Technician performance
- [ ] Customer acquisition
- [ ] Service plan MRR

### 3.12 Advanced Reports
**Time:** 2 days

**Features:**
- [ ] Revenue by service type
- [ ] Revenue by zone/neighborhood
- [ ] Technician productivity
- [ ] Customer lifetime value
- [ ] Export to CSV/PDF

---

# PHASE 4: GROWTH FEATURES (Weeks 25-32)
*Multi-user, customer portal, and advanced features*

---

## Sprint 21: Multi-User & Permissions (Week 25)

### 4.1 Role-Based Access Control
**Time:** 3 days

**Features:**
- [ ] Role definitions (owner, admin, dispatcher, technician, accountant)
- [ ] Granular permissions
- [ ] Feature access control
- [ ] Data visibility rules

### 4.2 Team Management
**Time:** 2 days

**Features:**
- [ ] User list and management
- [ ] Invite team members
- [ ] Role assignment
- [ ] Deactivate users
- [ ] User activity log

---

## Sprint 22: Customer Portal (Week 26)

### 4.3 Portal Authentication
**Time:** 2 days

**Features:**
- [ ] Magic link login
- [ ] Phone OTP login
- [ ] Session management

### 4.4 Portal Features
**Time:** 4 days

**Features:**
- [ ] View upcoming appointments
- [ ] Service history
- [ ] Pay outstanding invoices
- [ ] Request new service
- [ ] View equipment/warranties
- [ ] Update contact info
- [ ] Download invoices

---

## Sprint 23: Online Booking (Week 27)

### 4.5 Booking Widget
**Time:** 3 days

**Features:**
- [ ] Embeddable widget
- [ ] Service selection
- [ ] Available time slots
- [ ] Customer info form
- [ ] Booking confirmation
- [ ] Calendar integration

### 4.6 Booking Management
**Time:** 2 days

**Features:**
- [ ] Booking requests queue
- [ ] Auto-assign or manual
- [ ] Booking rules (lead time, duration)
- [ ] Booking confirmations

---

## Sprint 24: Location Tracking (Week 28)

### 4.7 Real-Time Location
**Time:** 4 days

**Features:**
- [ ] Background location tracking
- [ ] Privacy controls (work hours only)
- [ ] Map view of technician locations
- [ ] Location history/breadcrumbs
- [ ] Battery optimization

### 4.8 Geofencing
**Time:** 2 days

**Features:**
- [ ] Arrive at job site detection
- [ ] Leave job site detection
- [ ] Automatic time tracking
- [ ] Notifications to dispatcher

---

## Sprint 25: Purchase Orders (Week 29)

### 5.1 PO Management
**Time:** 3 days

**Features:**
- [ ] Create purchase orders
- [ ] Vendor database
- [ ] Link POs to jobs
- [ ] Approval workflow
- [ ] PO PDF generation

### 5.2 Receiving
**Time:** 2 days

**Features:**
- [ ] Receive against PO
- [ ] Partial receiving
- [ ] Inventory update
- [ ] Discrepancy handling

---

## Sprint 26: Expense Tracking (Week 30)

### 5.3 Expense Entry
**Time:** 3 days

**Features:**
- [ ] Manual expense entry
- [ ] Receipt photo capture
- [ ] OCR extraction
- [ ] Category assignment
- [ ] Link to jobs
- [ ] Approval workflow

### 5.4 Expense Reports
**Time:** 2 days

**Features:**
- [ ] Expense summary
- [ ] By category breakdown
- [ ] By technician
- [ ] Reimbursement tracking
- [ ] Export for accounting

---

## Sprint 27: Commission Management (Week 31)

### 5.5 Commission Rules
**Time:** 2 days

**Features:**
- [ ] Commission rate configuration
- [ ] Flat fee or percentage
- [ ] Tiered commissions
- [ ] By service type

### 5.6 Commission Tracking
**Time:** 2 days

**Features:**
- [ ] Automatic calculation
- [ ] Commission reports
- [ ] Technician commission view
- [ ] Payroll export

---

## Sprint 28: Subcontractor Management (Week 32)

### 5.7 Subcontractor Profiles
**Time:** 2 days

**Features:**
- [ ] Subcontractor database
- [ ] Document storage (insurance, certifications)
- [ ] Limited portal access
- [ ] Assign jobs to subs

### 5.8 Subcontractor Payments
**Time:** 2 days

**Features:**
- [ ] Track payments owed
- [ ] Payment recording
- [ ] Payment history
- [ ] 1099 preparation

---

# PHASE 5: AI & INTELLIGENCE (Weeks 33-40)
*AI-powered features and optimization*

---

## Sprint 29: AI Call Answering (Week 33-34)

### 6.1 Voice AI Integration
**Time:** 6 days

**Features:**
- [ ] Vapi or Bland.ai integration
- [ ] Natural Spanish conversation
- [ ] Appointment booking
- [ ] FAQ responses
- [ ] Human transfer logic
- [ ] Call recording and transcription

### 6.2 Call Analytics
**Time:** 2 days

**Features:**
- [ ] Call summary generation
- [ ] Sentiment analysis
- [ ] Topic extraction
- [ ] Lead scoring

---

## Sprint 30: Smart Scheduling (Week 35-36)

### 6.3 AI Scheduling Assistant
**Time:** 5 days

**Features:**
- [ ] Suggest optimal time slots
- [ ] Consider technician skills
- [ ] Travel time optimization
- [ ] Workload balancing
- [ ] Customer preference learning

### 6.4 Route Optimization
**Time:** 3 days

**Features:**
- [ ] Daily route optimization
- [ ] Multi-stop optimization
- [ ] Traffic consideration
- [ ] Manual override

---

## Sprint 31: Smart Messaging (Week 37)

### 6.5 AI Message Suggestions
**Time:** 3 days

**Features:**
- [ ] Context-aware reply suggestions
- [ ] Tone adjustment
- [ ] Template recommendations
- [ ] Auto-fill customer details

### 6.6 AI Lead Capture
**Time:** 2 days

**Features:**
- [ ] Email parsing for leads
- [ ] WhatsApp inquiry extraction
- [ ] Auto-create leads in CRM
- [ ] Lead scoring

---

## Sprint 32: Predictive Features (Week 38)

### 6.7 Predictive Maintenance
**Time:** 3 days

**Features:**
- [ ] Equipment age analysis
- [ ] Service interval tracking
- [ ] Proactive maintenance alerts
- [ ] Customer outreach suggestions

### 6.8 Revenue Forecasting
**Time:** 2 days

**Features:**
- [ ] Monthly revenue prediction
- [ ] Service plan revenue forecast
- [ ] Seasonal trend analysis
- [ ] Goal tracking

---

## Sprint 33: Multi-Location (Week 39-40)

### 6.9 Branch Management
**Time:** 4 days

**Features:**
- [ ] Multiple locations/branches
- [ ] Branch-level settings
- [ ] Cross-branch reporting
- [ ] Branch-specific inventory
- [ ] Branch permissions

### 6.10 Franchise Support
**Time:** 3 days

**Features:**
- [ ] Franchise hierarchy
- [ ] Corporate dashboard
- [ ] Franchisee analytics
- [ ] Shared templates

---

# PHASE 6: POLISH & LAUNCH (Weeks 41-44)
*Final polish, testing, and launch preparation*

---

## Sprint 34: Testing & QA (Week 41-42)

### Tasks
- [ ] End-to-end testing (web)
- [ ] Mobile testing (iOS + Android)
- [ ] Offline mode testing
- [ ] AFIP homologación testing
- [ ] Mercado Pago sandbox testing
- [ ] WhatsApp template testing
- [ ] Performance testing
- [ ] Security audit
- [ ] Accessibility review

---

## Sprint 35: App Store Preparation (Week 43)

### Tasks
- [ ] App Store Connect setup
- [ ] Google Play Console setup
- [ ] App screenshots (both platforms)
- [ ] App description (Spanish)
- [ ] Privacy policy
- [ ] Terms of service
- [ ] App review preparation

---

## Sprint 36: Launch (Week 44)

### Tasks
- [ ] Production environment verification
- [ ] AFIP production certificates
- [ ] Mercado Pago production credentials
- [ ] WhatsApp Business verification
- [ ] DNS and SSL configuration
- [ ] Monitoring and alerting setup
- [ ] Launch announcement
- [ ] Onboard first customers

---

# COST SUMMARY

## One-Time Costs

| Item | Cost (USD) |
|------|------------|
| FullCalendar Scheduler License | $499 |
| Background Location Library | $299 |
| Apple Developer Account | $99/year |
| Google Play Developer | $25 |
| Domain + SSL | $50 |
| Miscellaneous | $200 |
| **Total One-Time** | **~$1,172** |

## Monthly Infrastructure (100 Active Users)

| Service | Low | High |
|---------|-----|------|
| Supabase (Pro) | $25 | $100 |
| Vercel Pro | $20 | $50 |
| Expo EAS | $0 | $29 |
| AFIP SDK | $50 | $200 |
| WhatsApp BSP (Twilio) | $0 | $50 |
| WhatsApp Messages | $20 | $50 |
| OpenAI (Whisper + GPT) | $50 | $150 |
| Google Maps | $0 | $200 |
| Resend Email | $0 | $20 |
| Sentry | $0 | $26 |
| Redis (Upstash) | $0 | $25 |
| **Total Monthly** | **$165** | **$900** |

## Per-Customer Communication (Estimated)

| Item | Monthly Cost |
|------|--------------|
| WhatsApp Messages (~50 msgs) | $0.50 |
| Voice Transcription (~10 min) | $0.06 |
| AI Processing | $0.10 |
| **Total Per Customer** | **~$0.66** |

---

# DEVELOPMENT TIMELINE SUMMARY

| Phase | Duration | Features |
|-------|----------|----------|
| Phase 0: Setup | 1 week | Environment, infrastructure |
| Phase 1: Argentina Core | 12 weeks | Auth, CRM, Calendar, AFIP, Mercado Pago, WhatsApp, Voice AI |
| Phase 2: Mobile Offline | 6 weeks | WatermelonDB, Sync, Photos, Signatures, Maps |
| Phase 3: Automation | 6 weeks | Estimates, Workflows, Equipment, Plans, Inventory, Reports |
| Phase 4: Growth | 8 weeks | Multi-user, Portal, Booking, Location, POs, Expenses |
| Phase 5: AI | 8 weeks | Call AI, Smart Scheduling, Predictions |
| Phase 6: Launch | 4 weeks | Testing, App Stores, Launch |
| **Total** | **45 weeks** | **78 features** |

---

# MILESTONES

| Milestone | Week | Deliverable |
|-----------|------|-------------|
| **Alpha** | 12 | Web app + mobile with core Argentina features |
| **Beta** | 18 | Full offline mobile, ready for user testing |
| **V1.0** | 28 | Production-ready with all essential features |
| **V1.5** | 36 | AI features, full automation |
| **V2.0** | 44 | Complete platform, multi-location |

---

*Document Version: 2.0*
*Last Updated: December 2025*
*Total Features: 78*
*Estimated Development: 45 weeks (solo) / 24-28 weeks (team of 3)*
