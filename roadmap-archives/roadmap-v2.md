# CampoTech: Complete Development Roadmap v2.0
## Full-Stack FSM Platform for Argentina | Web + iOS + Android
## 100% Workiz Feature Parity + Argentina-Specific Integrations

---

# EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Total Features** | 88 features across 6 phases |
| **Total Development Time** | 48-52 weeks (solo) / 26-32 weeks (team of 3) |
| **Platform Coverage** | Web App + iOS + Android + Customer Portal + Booking Widget |
| **One-Time Costs** | ~$1,500 USD |
| **Monthly Infrastructure (100 users)** | $400-1,200 USD |
| **Workiz Feature Parity** | 100% ✅ |

---

# FEATURE CHECKLIST vs. WORKIZ

## Essentials (9/9 ✅)
- [x] Client CRM
- [x] Scheduling
- [x] Dispatching
- [x] Invoicing
- [x] Estimates & proposals
- [x] Inventory management
- [x] Online booking
- [x] Mobile app
- [x] Advanced reporting

## Efficiency Tools (6/6 ✅)
- [x] Automations
- [x] Lead source integrations ← *Added*
- [x] Service plans
- [x] Equipment tracking
- [x] Price Book ← *Added*
- [x] Reserve with Google ← *Added*

## Financial Services (7/7 ✅)
- [x] Payment processing (Mercado Pago)
- [x] Expense management
- [x] Consumer financing (Cuotas sin Tarjeta)
- [x] Company expense card ← *Added (Optional)*
- [x] Branded client portal
- [x] Purchase orders
- [x] Accounting integration ← *Added (Xubio/local)*

## Communication & AI (6/6 ✅)
- [x] Built-in phone & messages (WhatsApp + Voice)
- [x] AI answering
- [x] AI leads capture
- [x] AI call insights
- [x] Call recordings & tags ← *Added*
- [x] Ad & source tracking ← *Added*

## Argentina-Exclusive Features (6 bonus)
- [x] AFIP Electronic Invoicing (Factura Electrónica)
- [x] Mercado Pago + Cuotas Integration
- [x] WhatsApp-Native Communications
- [x] Voice-to-Job AI (Spanish)
- [x] Offline-First Mobile Architecture
- [x] CUIT/CUIL/DNI Validation

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
| **Telephony** | Twilio | WhatsApp Business API + Voice + Call Recording |
| **Payments** | Mercado Pago SDK | Argentina payments + cuotas |
| **Invoicing** | Afip SDK → Direct AFIP | Electronic invoicing with CAE |
| **Maps** | Google Maps Platform | Routing, geocoding, places |
| **Email** | Resend or SendGrid | Transactional emails |
| **File Storage** | Supabase Storage or Cloudflare R2 | PDFs, photos, documents |
| **Deployment** | Vercel (web) + EAS (mobile) | CI/CD, preview deployments |
| **Monitoring** | Sentry | Error tracking, performance |
| **Call Tracking** | Twilio + Custom | Ad source attribution |

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
│   ├── portal/                 # Customer self-service portal
│   └── booking/                # Embeddable booking widget
├── packages/
│   ├── api/                   # Shared API types & clients
│   ├── db/                    # Database schema & migrations
│   ├── ui/                    # Shared UI components
│   └── utils/                 # Shared utilities
├── services/
│   ├── afip/                  # AFIP integration service
│   ├── mercadopago/           # Payment service
│   ├── whatsapp/              # WhatsApp Business API
│   ├── ai/                    # Voice-to-job, AI features
│   ├── call-tracking/         # Ad source tracking
│   └── accounting/            # Xubio/accounting sync
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
  lead_source TEXT,
  lead_source_detail TEXT,
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
  lead_source TEXT,
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
  invoice_type TEXT DEFAULT 'B',
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
  method TEXT,
  status TEXT DEFAULT 'pending',
  mp_payment_id TEXT,
  mp_preference_id TEXT,
  installments INTEGER DEFAULT 1,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price Book tables (NEW)
CREATE TABLE price_book_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE price_book_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  category_id UUID REFERENCES price_book_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT DEFAULT 'service', -- service, part, labor
  sku TEXT,
  unit_price DECIMAL(12, 2) NOT NULL,
  cost_price DECIMAL(12, 2),
  tax_rate DECIMAL(5, 2) DEFAULT 21.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead sources and tracking (NEW)
CREATE TABLE lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT, -- website, facebook, google, whatsapp, referral, other
  tracking_phone TEXT,
  tracking_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  cost_per_lead DECIMAL(12, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  lead_source_id UUID REFERENCES lead_sources(id),
  customer_id UUID REFERENCES customers(id),
  name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  service_needed TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new', -- new, contacted, qualified, converted, lost
  converted_job_id UUID REFERENCES jobs(id),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call recordings and tracking (NEW)
CREATE TABLE call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  job_id UUID REFERENCES jobs(id),
  lead_id UUID REFERENCES leads(id),
  lead_source_id UUID REFERENCES lead_sources(id),
  call_sid TEXT UNIQUE,
  from_number TEXT,
  to_number TEXT,
  direction TEXT, -- inbound, outbound
  duration INTEGER, -- seconds
  recording_url TEXT,
  transcription TEXT,
  summary TEXT,
  sentiment TEXT,
  tags TEXT[],
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_book_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_book_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
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
- [ ] Create Twilio account (WhatsApp + Voice + Recording)
- [ ] Set up OpenAI API account
- [ ] Create Google Cloud project (Maps API + Reserve with Google)
- [ ] Set up Sentry project
- [ ] Create Resend/SendGrid account
- [ ] Apply for Reserve with Google partnership (NEW)
- [ ] Create Xubio/accounting integration account (NEW)

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
AFIP_ENVIRONMENT=testing

# Mercado Pago
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_WEBHOOK_SECRET=

# WhatsApp/Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ID=
WHATSAPP_ACCESS_TOKEN=

# OpenAI
OPENAI_API_KEY=

# Google
GOOGLE_MAPS_API_KEY=
GOOGLE_RESERVE_PARTNER_ID=

# Email
RESEND_API_KEY=

# Accounting (Argentina)
XUBIO_API_KEY=
XUBIO_COMPANY_ID=
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

### 1.2 Organization & User Management
**Time:** 2 days

**Features:**
- [ ] Organization creation (onboarding)
- [ ] User profile management
- [ ] Role assignment (owner, admin, dispatcher, technician)
- [ ] Invite team members
- [ ] Organization settings

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
- [ ] Lead source tracking per customer (NEW)

### 1.4 CUIT/CUIL Validation Service
**Time:** 1 day

**Features:**
- [ ] Validate CUIT format (11 digits, check digit)
- [ ] Query AFIP padron for business info
- [ ] Auto-fill company name and IVA condition
- [ ] Cache validation results

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
- [ ] Lead source attribution (NEW)

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
- [ ] Quick add from Price Book (NEW)

---

## Sprint 5: Mercado Pago Integration (Weeks 7-8)

### 1.10 Mercado Pago Service
**Time:** 4 days

**Features:**
- [ ] Account connection (OAuth)
- [ ] QR code payment generation
- [ ] Payment link creation
- [ ] Cuotas (installments) support
- [ ] Cuotas sin Tarjeta (consumer financing)
- [ ] Webhook handling
- [ ] Payment status sync
- [ ] Refund processing

### 1.11 Payment UI Components
**Time:** 3 days

**Features:**
- [ ] Payment status display
- [ ] Cuotas selector with CFT/TEA display (legal compliance)
- [ ] QR code display component
- [ ] Payment link sharing (WhatsApp, email, copy)
- [ ] Payment confirmation screen
- [ ] Outstanding balance dashboard

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
- [ ] Schema definition (jobs, customers, invoices, price_book)
- [ ] Model classes with decorators
- [ ] Relationships
- [ ] Observable queries

### 2.2 Sync Engine
**Time:** 4 days

**Features:**
- [ ] Pull changes from server
- [ ] Push local changes
- [ ] Conflict resolution (last-write-wins + field merge)
- [ ] Delta sync (only changed records)
- [ ] Sync status tracking
- [ ] Background sync

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
- [ ] Add items from Price Book (NEW)

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

---

## Sprint 12: Mobile Invoicing & Payments (Week 16)

### 2.8 Mobile Invoice Creation
**Time:** 3 days

**Features:**
- [ ] Create invoice from job
- [ ] Add/edit line items
- [ ] Quick add from Price Book (NEW)
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

# PHASE 3: AUTOMATION & EFFICIENCY (Weeks 19-26)
*Workflow automation and productivity features*

---

## Sprint 15: Price Book (Week 19) ← NEW

### 3.1 Price Book Management
**Time:** 3 days

**Features:**
- [ ] Service catalog with flat-rate pricing
- [ ] Parts catalog with pricing
- [ ] Labor rate templates
- [ ] Categories and subcategories
- [ ] SKU management
- [ ] Cost vs. sell price
- [ ] Tax rate per item
- [ ] Search and filter
- [ ] Import/export CSV

**Implementation:**
```typescript
// components/price-book/PriceBookItem.tsx
interface PriceBookItem {
  id: string;
  name: string;
  description: string;
  itemType: 'service' | 'part' | 'labor';
  sku?: string;
  unitPrice: number;
  costPrice?: number;
  taxRate: number;
  categoryId: string;
  isActive: boolean;
}

// Quick add to invoice/estimate
export function QuickAddFromPriceBook({ onSelect }: Props) {
  const [search, setSearch] = useState('');
  const items = usePriceBookSearch(search);

  return (
    <Command>
      <CommandInput 
        placeholder="Buscar servicio o repuesto..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {items.map(item => (
          <CommandItem 
            key={item.id}
            onSelect={() => onSelect(item)}
          >
            <span>{item.name}</span>
            <span className="text-muted-foreground">${item.unitPrice}</span>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}
```

### 3.2 Price Book in Invoices/Estimates
**Time:** 2 days

**Features:**
- [ ] Quick-add button in line items
- [ ] Search price book inline
- [ ] Auto-fill description, price, tax
- [ ] Quantity adjustment
- [ ] Price override option
- [ ] Recent items shortcut

---

## Sprint 16: Estimates & Proposals (Week 20)

### 3.3 Estimate Builder
**Time:** 4 days

**Features:**
- [ ] Estimate creation
- [ ] Line item management from Price Book
- [ ] Good/Better/Best options
- [ ] Estimate templates
- [ ] Discount handling
- [ ] Deposit requirement
- [ ] Estimate expiration

### 3.4 Customer-Facing Estimate View
**Time:** 2 days

**Features:**
- [ ] Public estimate link
- [ ] Mobile-responsive view
- [ ] Option selection
- [ ] E-signature capture
- [ ] Accept/decline workflow
- [ ] Convert to job on accept

### 3.5 Estimate PDF Generation
**Time:** 1 day

**Features:**
- [ ] Professional PDF layout
- [ ] Company branding
- [ ] Terms and conditions
- [ ] WhatsApp/email delivery

---

## Sprint 17: Workflow Automations (Week 21)

### 3.6 Automation Engine
**Time:** 4 days

**Features:**
- [ ] Trigger → Condition → Action framework
- [ ] Event triggers (job created, status changed, payment received)
- [ ] Time-based triggers (before appointment, after completion)
- [ ] Multiple actions per automation
- [ ] Automation templates
- [ ] Automation logs

### 3.7 Automation UI
**Time:** 2 days

**Features:**
- [ ] Automation list/grid
- [ ] Visual automation builder
- [ ] Enable/disable toggle
- [ ] Execution history
- [ ] Error notifications

---

## Sprint 18: Service History & Equipment (Week 22)

### 3.8 Equipment Tracking
**Time:** 3 days

**Features:**
- [ ] Equipment database
- [ ] Link equipment to customers
- [ ] Model, serial, install date
- [ ] Warranty tracking
- [ ] Service history per equipment
- [ ] QR code labels
- [ ] Equipment photos

### 3.9 Service History View
**Time:** 2 days

**Features:**
- [ ] Complete job history per customer
- [ ] Equipment service timeline
- [ ] Photo history
- [ ] Invoice history
- [ ] Notes across visits
- [ ] Search and filter

---

## Sprint 19: Service Plans (Abonos) (Week 23)

### 3.10 Service Plan Management
**Time:** 4 days

**Features:**
- [ ] Plan templates (monthly, quarterly, annual)
- [ ] Customer enrollment
- [ ] Automatic job scheduling
- [ ] Recurring Mercado Pago payments
- [ ] Plan renewal reminders
- [ ] Plan expiration handling
- [ ] Revenue forecasting

---

## Sprint 20: Inventory Management (Week 24)

### 3.11 Parts & Materials Database
**Time:** 3 days

**Features:**
- [ ] Parts catalog (synced with Price Book)
- [ ] SKU management
- [ ] Cost price vs. sell price
- [ ] Supplier information
- [ ] Part photos
- [ ] Categories and tags
- [ ] Search and filter

### 3.12 Stock Management
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

## Sprint 21: Lead Source Integrations (Week 25) ← NEW

### 3.13 Lead Source Configuration
**Time:** 3 days

**Features:**
- [ ] Define lead sources (website, Facebook, Google, WhatsApp, referral)
- [ ] Tracking phone numbers per source
- [ ] UTM parameter tracking
- [ ] Cost per lead configuration
- [ ] Lead source categories

**Database:**
```sql
-- Lead source with tracking
CREATE TABLE lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  source_type TEXT, -- website, facebook, google, whatsapp, referral
  tracking_phone TEXT, -- Twilio number for call tracking
  webhook_url TEXT, -- For receiving leads
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  cost_per_month DECIMAL(12, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.14 Lead Capture Webhooks
**Time:** 3 days

**Features:**
- [ ] Generic webhook receiver
- [ ] Facebook Lead Ads integration
- [ ] Google Ads webhook
- [ ] Website form webhook
- [ ] WhatsApp inquiry capture
- [ ] Lead parsing and normalization
- [ ] Auto-create customer/lead records
- [ ] Lead assignment rules

**Implementation:**
```typescript
// app/api/webhooks/leads/route.ts
export async function POST(request: Request) {
  const { source } = request.nextUrl.searchParams;
  const payload = await request.json();

  let leadData: LeadData;

  switch (source) {
    case 'facebook':
      leadData = parseFacebookLead(payload);
      break;
    case 'google':
      leadData = parseGoogleLead(payload);
      break;
    case 'website':
      leadData = parseWebsiteLead(payload);
      break;
    default:
      leadData = parseGenericLead(payload);
  }

  // Create lead in database
  const lead = await createLead({
    ...leadData,
    leadSourceId: await getLeadSourceId(source),
    status: 'new'
  });

  // Trigger automation (e.g., send WhatsApp, assign to user)
  await triggerLeadAutomation(lead);

  return Response.json({ success: true, leadId: lead.id });
}
```

---

## Sprint 22: Ad & Source Tracking (Week 26) ← NEW

### 3.15 Call Tracking Numbers
**Time:** 3 days

**Features:**
- [ ] Provision Twilio numbers per ad source
- [ ] Call forwarding to main number
- [ ] Call recording with consent
- [ ] Caller ID capture
- [ ] Link calls to lead sources
- [ ] Call duration tracking

**Implementation:**
```typescript
// services/call-tracking/CallTrackingService.ts
export class CallTrackingService {
  async provisionTrackingNumber(leadSource: LeadSource): Promise<string> {
    // Buy a Twilio number
    const number = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: await findAvailableNumber('AR'), // Argentina
      voiceUrl: `${process.env.APP_URL}/api/webhooks/calls/incoming`,
      voiceMethod: 'POST',
      statusCallback: `${process.env.APP_URL}/api/webhooks/calls/status`,
      statusCallbackMethod: 'POST'
    });

    // Save tracking number
    await updateLeadSource(leadSource.id, {
      trackingPhone: number.phoneNumber
    });

    return number.phoneNumber;
  }

  async handleIncomingCall(callSid: string, from: string, to: string): Promise<TwiMLResponse> {
    // Find lead source by tracking number
    const leadSource = await findLeadSourceByPhone(to);

    // Create call record
    await createCallRecord({
      callSid,
      fromNumber: from,
      toNumber: to,
      leadSourceId: leadSource?.id,
      direction: 'inbound',
      startedAt: new Date()
    });

    // Forward to main business number with recording
    return new VoiceResponse()
      .say({ language: 'es-AR' }, 'Esta llamada puede ser grabada para mejorar nuestro servicio.')
      .dial({ 
        record: 'record-from-answer',
        recordingStatusCallback: `${process.env.APP_URL}/api/webhooks/calls/recording`
      }, process.env.MAIN_PHONE_NUMBER);
  }
}
```

### 3.16 Source Attribution Dashboard
**Time:** 2 days

**Features:**
- [ ] Leads by source chart
- [ ] Cost per lead by source
- [ ] Conversion rate by source
- [ ] Revenue by source
- [ ] ROI calculation
- [ ] Date range filtering

### 3.17 Call Recordings & Tags ← NEW
**Time:** 2 days

**Features:**
- [ ] Call recording storage
- [ ] Playback in web interface
- [ ] Manual tagging (hot lead, follow-up, etc.)
- [ ] Auto-tagging with AI
- [ ] Search recordings
- [ ] Download recordings
- [ ] Recording retention settings

---

## Sprint 23: Reporting Dashboard (Week 27)

### 3.18 Business Dashboard
**Time:** 4 days

**Features:**
- [ ] Revenue overview (daily/weekly/monthly)
- [ ] Jobs completed vs. scheduled
- [ ] Payment collection rate
- [ ] Outstanding balance
- [ ] Technician performance
- [ ] Customer acquisition
- [ ] Service plan MRR
- [ ] Lead source performance (NEW)

### 3.19 Advanced Reports
**Time:** 2 days

**Features:**
- [ ] Revenue by service type
- [ ] Revenue by zone/neighborhood
- [ ] Technician productivity
- [ ] Customer lifetime value
- [ ] Lead source ROI (NEW)
- [ ] Export to CSV/PDF

---

# PHASE 4: GROWTH FEATURES (Weeks 27-36)
*Multi-user, customer portal, and advanced features*

---

## Sprint 24: Multi-User & Permissions (Week 28)

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

## Sprint 25: Customer Portal (Week 29)

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

## Sprint 26: Online Booking (Week 30)

### 4.5 Booking Widget
**Time:** 3 days

**Features:**
- [ ] Embeddable widget
- [ ] Service selection (from Price Book)
- [ ] Available time slots
- [ ] Customer info form
- [ ] Booking confirmation
- [ ] Calendar integration
- [ ] Lead source tracking

### 4.6 Booking Management
**Time:** 2 days

**Features:**
- [ ] Booking requests queue
- [ ] Auto-assign or manual
- [ ] Booking rules (lead time, duration)
- [ ] Booking confirmations

---

## Sprint 27: Reserve with Google (Week 31) ← NEW

### 4.7 Google Business Integration
**Time:** 4 days

**Features:**
- [ ] Google Business Profile verification
- [ ] Reserve with Google API setup
- [ ] Availability feed to Google
- [ ] Real-time slot updates
- [ ] Booking receipt from Google
- [ ] Confirmation/cancellation sync

**Requirements:**
- Must be verified Google Business
- Pass Google's technical review
- Meet service quality standards

**Implementation:**
```typescript
// services/google-reserve/GoogleReserveService.ts
export class GoogleReserveService {
  // Feed availability to Google
  async generateAvailabilityFeed(): Promise<AvailabilityFeed> {
    const slots = await getAvailableSlots(next30Days);
    
    return {
      availability: slots.map(slot => ({
        startTime: slot.start.toISOString(),
        endTime: slot.end.toISOString(),
        spotsTotal: 1,
        spotsOpen: slot.isAvailable ? 1 : 0,
        serviceId: slot.serviceId,
        resourceId: slot.technicianId
      }))
    };
  }

  // Receive booking from Google
  async handleBookingWebhook(booking: GoogleBooking): Promise<void> {
    // Create job from Google booking
    const job = await createJob({
      customerName: booking.clientInformation.givenName,
      customerPhone: booking.clientInformation.phoneNumber,
      scheduledStart: new Date(booking.slot.startTime),
      scheduledEnd: new Date(booking.slot.endTime),
      serviceId: booking.serviceId,
      leadSource: 'google_reserve',
      externalId: booking.bookingId
    });

    // Send confirmation to Google
    await this.confirmBooking(booking.bookingId, job.id);
  }
}
```

### 4.8 Google Reviews Integration
**Time:** 1 day

**Features:**
- [ ] Display Google reviews
- [ ] Review request after job completion
- [ ] Review link in follow-up messages

---

## Sprint 28: Location Tracking (Week 32)

### 4.9 Real-Time Location
**Time:** 4 days

**Features:**
- [ ] Background location tracking
- [ ] Privacy controls (work hours only)
- [ ] Map view of technician locations
- [ ] Location history/breadcrumbs
- [ ] Battery optimization

### 4.10 Geofencing
**Time:** 2 days

**Features:**
- [ ] Arrive at job site detection
- [ ] Leave job site detection
- [ ] Automatic time tracking
- [ ] Notifications to dispatcher

---

## Sprint 29: Purchase Orders (Week 33)

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

## Sprint 30: Expense Tracking (Week 34)

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

## Sprint 31: Accounting Integration (Week 35) ← NEW (replaces QuickBooks)

### 5.5 Xubio Integration (Argentina)
**Time:** 4 days

**Features:**
- [ ] OAuth connection to Xubio
- [ ] Sync customers (bidirectional)
- [ ] Sync invoices (AFIP invoices auto-sync)
- [ ] Sync payments
- [ ] Sync expenses
- [ ] Account mapping
- [ ] Sync status dashboard

**Alternative Options for Argentina:**
- Xubio (recommended)
- Colppy
- Tango Gestión
- Direct AFIP export

**Implementation:**
```typescript
// services/accounting/XubioService.ts
export class XubioService {
  async syncInvoice(invoice: Invoice): Promise<void> {
    // Xubio already receives AFIP invoices automatically
    // This syncs payment status and additional metadata
    
    const xubioInvoice = await this.findInvoiceByCae(invoice.cae);
    
    if (xubioInvoice && invoice.paid_at) {
      await this.xubioApi.payments.create({
        invoiceId: xubioInvoice.id,
        amount: invoice.total,
        date: invoice.paid_at,
        paymentMethod: this.mapPaymentMethod(invoice.payment_method)
      });
    }
  }

  async syncExpense(expense: Expense): Promise<void> {
    await this.xubioApi.expenses.create({
      date: expense.date,
      amount: expense.amount,
      category: this.mapCategory(expense.category),
      description: expense.description,
      receipt: expense.receipt_url
    });
  }
}
```

### 5.6 Financial Export
**Time:** 1 day

**Features:**
- [ ] Export invoices to CSV
- [ ] Export payments to CSV
- [ ] Export expenses to CSV
- [ ] AFIP-compatible formats
- [ ] Date range selection

---

## Sprint 32: Company Expense Card (Week 36) ← NEW (Optional)

### 5.7 Virtual Card Setup
**Time:** 3 days

**Note:** Stripe Issuing is not available in Argentina. Consider these alternatives:
- Pomelo (Argentine fintech)
- Ualá Business
- Mercado Pago Business Cards
- Manual expense tracking with receipts

**Features (if using Pomelo/local provider):**
- [ ] Virtual card creation per employee
- [ ] Spending limits per card
- [ ] Category restrictions
- [ ] Real-time transaction notifications
- [ ] Auto-categorization
- [ ] Sync with expense tracking

**Implementation (using Pomelo API):**
```typescript
// services/expense-cards/PomeloService.ts
export class PomeloService {
  async createCard(employee: User): Promise<Card> {
    const card = await this.pomeloApi.cards.create({
      userId: employee.id,
      type: 'virtual',
      spendingLimit: employee.expenseLimit,
      allowedCategories: ['fuel', 'parts', 'supplies'],
      name: `${employee.fullName} - CampoTech`
    });

    return card;
  }

  async handleTransaction(webhook: TransactionWebhook): Promise<void> {
    // Auto-create expense from card transaction
    await createExpense({
      userId: webhook.cardHolder.id,
      amount: webhook.amount,
      category: this.mapMCC(webhook.merchantCategoryCode),
      merchantName: webhook.merchantName,
      cardLast4: webhook.cardLast4,
      status: 'pending_receipt'
    });

    // Notify user to upload receipt
    await sendPushNotification(webhook.cardHolder.id, {
      title: 'Gasto registrado',
      body: `$${webhook.amount} en ${webhook.merchantName}. Subí el comprobante.`
    });
  }
}
```

---

## Sprint 33: Commission Management (Week 37)

### 5.8 Commission Rules
**Time:** 2 days

**Features:**
- [ ] Commission rate configuration
- [ ] Flat fee or percentage
- [ ] Tiered commissions
- [ ] By service type

### 5.9 Commission Tracking
**Time:** 2 days

**Features:**
- [ ] Automatic calculation
- [ ] Commission reports
- [ ] Technician commission view
- [ ] Payroll export

---

## Sprint 34: Subcontractor Management (Week 38)

### 5.10 Subcontractor Profiles
**Time:** 2 days

**Features:**
- [ ] Subcontractor database
- [ ] Document storage (insurance, certifications)
- [ ] Limited portal access
- [ ] Assign jobs to subs

### 5.11 Subcontractor Payments
**Time:** 2 days

**Features:**
- [ ] Track payments owed
- [ ] Payment recording
- [ ] Payment history
- [ ] Tax document preparation

---

# PHASE 5: AI & INTELLIGENCE (Weeks 39-46)
*AI-powered features and optimization*

---

## Sprint 35: AI Call Answering (Week 39-40)

### 6.1 Voice AI Integration
**Time:** 6 days

**Features:**
- [ ] Vapi or Bland.ai integration
- [ ] Natural Spanish conversation
- [ ] Appointment booking
- [ ] FAQ responses
- [ ] Human transfer logic
- [ ] Call recording and transcription

### 6.2 AI Call Insights ← Enhanced
**Time:** 3 days

**Features:**
- [ ] Call summary generation
- [ ] Sentiment analysis
- [ ] Topic extraction
- [ ] Lead scoring
- [ ] Auto-tagging
- [ ] Coaching suggestions

---

## Sprint 36: Smart Scheduling (Week 41-42)

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

## Sprint 37: Smart Messaging & Lead Capture (Week 43)

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
- [ ] Source attribution

---

## Sprint 38: Predictive Features (Week 44)

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

## Sprint 39: Multi-Location (Week 45-46)

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

# PHASE 6: POLISH & LAUNCH (Weeks 47-52)
*Final polish, testing, and launch preparation*

---

## Sprint 40: Testing & QA (Week 47-48)

### Tasks
- [ ] End-to-end testing (web)
- [ ] Mobile testing (iOS + Android)
- [ ] Offline mode testing
- [ ] AFIP homologación testing
- [ ] Mercado Pago sandbox testing
- [ ] WhatsApp template testing
- [ ] Call tracking testing
- [ ] Performance testing
- [ ] Security audit
- [ ] Accessibility review

---

## Sprint 41: App Store Preparation (Week 49)

### Tasks
- [ ] App Store Connect setup
- [ ] Google Play Console setup
- [ ] App screenshots (both platforms)
- [ ] App description (Spanish)
- [ ] Privacy policy
- [ ] Terms of service
- [ ] App review preparation

---

## Sprint 42: Documentation & Training (Week 50)

### Tasks
- [ ] User documentation (Spanish)
- [ ] Video tutorials
- [ ] API documentation
- [ ] Admin guide
- [ ] Onboarding flow
- [ ] Help center setup

---

## Sprint 43: Launch (Week 51-52)

### Tasks
- [ ] Production environment verification
- [ ] AFIP production certificates
- [ ] Mercado Pago production credentials
- [ ] WhatsApp Business verification
- [ ] DNS and SSL configuration
- [ ] Monitoring and alerting setup
- [ ] Launch announcement
- [ ] Onboard first customers
- [ ] Support system setup

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
| Reserve with Google Certification | $0 (free but requires verification) |
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
| Twilio Voice (call tracking) | $20 | $100 |
| Call Recording Storage | $5 | $20 |
| Xubio (accounting) | $0 | $50 |
| **Total Monthly** | **$190** | **$1,070** |

## Per-Customer Communication (Estimated)

| Item | Monthly Cost |
|------|--------------|
| WhatsApp Messages (~50 msgs) | $0.50 |
| Voice Transcription (~10 min) | $0.06 |
| AI Processing | $0.10 |
| Call Tracking (~5 calls) | $0.15 |
| **Total Per Customer** | **~$0.81** |

---

# DEVELOPMENT TIMELINE SUMMARY

| Phase | Duration | Features |
|-------|----------|----------|
| Phase 0: Setup | 1 week | Environment, infrastructure |
| Phase 1: Argentina Core | 12 weeks | Auth, CRM, Calendar, AFIP, Mercado Pago, WhatsApp, Voice AI |
| Phase 2: Mobile Offline | 6 weeks | WatermelonDB, Sync, Photos, Signatures, Maps |
| Phase 3: Automation | 8 weeks | Price Book, Estimates, Workflows, Equipment, Plans, Inventory, Lead Sources, Ad Tracking, Reports |
| Phase 4: Growth | 10 weeks | Multi-user, Portal, Booking, Reserve with Google, Location, POs, Expenses, Accounting, Expense Cards |
| Phase 5: AI | 8 weeks | Call AI, Smart Scheduling, Predictions, Multi-location |
| Phase 6: Launch | 6 weeks | Testing, App Stores, Documentation, Launch |
| **Total** | **51 weeks** | **88 features** |

---

# MILESTONES

| Milestone | Week | Deliverable |
|-----------|------|-------------|
| **Alpha** | 12 | Web app + mobile with core Argentina features |
| **Beta** | 18 | Full offline mobile, ready for user testing |
| **V1.0** | 27 | Production-ready with automation features |
| **V1.5** | 38 | Full Workiz parity + Argentina extras |
| **V2.0** | 46 | Complete AI features, multi-location |
| **Launch** | 52 | Public launch, all features complete |

---

# WORKIZ FEATURE PARITY CHECKLIST (Final)

## Essentials ✅
| Feature | Status | Sprint |
|---------|--------|--------|
| Client CRM | ✅ | 2 |
| Scheduling | ✅ | 3 |
| Dispatching | ✅ | 3 |
| Invoicing | ✅ | 4 |
| Estimates & proposals | ✅ | 16 |
| Inventory management | ✅ | 20 |
| Online booking | ✅ | 26 |
| Mobile app | ✅ | 8-14 |
| Advanced reporting | ✅ | 23 |

## Efficiency Tools ✅
| Feature | Status | Sprint |
|---------|--------|--------|
| Automations | ✅ | 17 |
| Lead source integrations | ✅ | 21 |
| Service plans | ✅ | 19 |
| Equipment tracking | ✅ | 18 |
| Price Book | ✅ | 15 |
| Reserve with Google | ✅ | 27 |

## Financial Services ✅
| Feature | Status | Sprint |
|---------|--------|--------|
| Payment processing | ✅ | 5 |
| Expense management | ✅ | 30 |
| Consumer financing | ✅ | 5 (Cuotas) |
| Company expense card | ✅ | 32 (Optional) |
| Branded client portal | ✅ | 25 |
| Purchase orders | ✅ | 29 |
| Accounting integration | ✅ | 31 (Xubio) |

## Communication & AI ✅
| Feature | Status | Sprint |
|---------|--------|--------|
| Built-in phone & messages | ✅ | 6, 35 |
| AI answering | ✅ | 35 |
| AI leads capture | ✅ | 37 |
| AI call insights | ✅ | 35 |
| Call recordings & tags | ✅ | 22 |
| Ad & source tracking | ✅ | 22 |

---

**TOTAL FEATURES: 88**
**WORKIZ PARITY: 100%**
**ARGENTINA EXTRAS: 6 unique features**

---

*Document Version: 2.0*
*Last Updated: December 2025*
*Total Features: 88 (28 Workiz + 6 Argentina-exclusive + 54 supporting)*
*Estimated Development: 51 weeks (solo) / 28-32 weeks (team of 3)*
