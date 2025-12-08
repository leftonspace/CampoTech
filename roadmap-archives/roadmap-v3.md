# CampoTech: Argentina MVP Roadmap
## 12 Core Workflows | WhatsApp-Native | 10-Week Launch

---

# EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Core Workflows** | 12 (the minimum to prove PMF) |
| **MVP Timeline** | 10 weeks (solo) / 6 weeks (team of 2-3) |
| **Platforms** | Web App + Mobile (online-only V1) |
| **Monthly Infrastructure** | $150-400 USD (100 users) |
| **Target Price Point** | $15-25 USD/month |
| **Differentiator** | WhatsApp + Voice AI + AFIP + Mercado Pago |

---

# THE THESIS

## Why This Works in Argentina

Argentina has a unique combination that exists almost nowhere else:

1. **High WhatsApp adoption** - 100% of tradespeople manage business via WhatsApp
2. **Mandatory digital invoicing** - AFIP Factura Electrónica is legally required
3. **Mercado Pago dominance** - 74.4% consumer adoption, QR everywhere
4. **Weak local competition** - Persat (GPS-only), SGTaller (legacy), no WhatsApp-native
5. **Foreign tools can't compete** - No AFIP, no MP cuotas, no WhatsApp integration

**The moat is not features. The moat is localization.**

## What We're NOT Building (Yet)

| Feature | Why Defer |
|---------|-----------|
| Offline-first sync | Complex; most urban areas have coverage |
| Full inventory management | Nice-to-have, not core pain |
| Service plans (abonos) | V1.5 feature after PMF |
| Customer portal | Users don't need it day one |
| Online booking widget | WhatsApp IS the booking widget |
| Location tracking | Privacy complexity, defer |
| Equipment tracking | Full version can wait |
| Reserve with Google | Requires verification, not urgent |
| Multi-location/franchise | Scale problem, not launch problem |
| Commission management | Excel works for now |
| Subcontractor management | V2 feature |
| Purchase orders | Not core workflow |
| Expense cards | Not available in Argentina properly |
| Advanced AI (scheduling, predictions) | Nice-to-have |

---

# THE 12 CORE WORKFLOWS

These 12 workflows complete the full business loop:
**Lead → Job → Execution → Invoice → Payment → Reporting**

| # | Workflow | Why Core |
|---|----------|----------|
| 1 | WhatsApp → Lead → Job | Main acquisition channel; #1 differentiator |
| 2 | Customer CRM | Required for AFIP + MP |
| 3 | Job Scheduling | Core to operations |
| 4 | Technician Mobile App | Where jobs actually happen |
| 5 | AFIP Electronic Invoicing | Mandatory for legal compliance |
| 6 | Mercado Pago Payments | Most common payment method |
| 7 | WhatsApp Unified Inbox | Central communication hub |
| 8 | Voice-to-Job AI | Removes friction; huge differentiator |
| 9 | Basic Price Book | Needed for accurate billing |
| 10 | PDF Invoice + WhatsApp Send | Professional workflow |
| 11 | Job Completion Flow | Converts jobs → invoices |
| 12 | Basic Reporting Dashboard | Visibility and business control |

---

# TECH STACK (Lean)

| Layer | Technology | Why |
|-------|------------|-----|
| **Web** | Next.js 14 (App Router) | Fast, SSR, great DX |
| **Mobile** | React Native + Expo SDK 52 | iOS + Android, one codebase |
| **UI** | shadcn/ui + Tailwind | Consistent, fast to build |
| **Backend** | Supabase | Postgres, Auth, Realtime, Storage |
| **Queue** | Supabase Edge Functions + pg_cron | Simple, no extra infra |
| **AI** | OpenAI (Whisper + GPT-4o) | Spanish transcription + extraction |
| **WhatsApp** | Twilio or Meta Cloud API | Reliable, documented |
| **Payments** | Mercado Pago SDK | Native Argentina support |
| **Invoicing** | Afip SDK | AFIP integration |
| **Maps** | Google Maps (geocoding only) | Address validation |
| **Deploy** | Vercel (web) + EAS (mobile) | Simple CI/CD |

**Total monthly infra (100 users): $150-400 USD**

---

# REPOSITORY STRUCTURE (Minimal)

```
campotech/
├── apps/
│   ├── web/                    # Next.js 14 web app
│   │   ├── app/
│   │   │   ├── (auth)/        # Login, register
│   │   │   ├── (dashboard)/   # Main app
│   │   │   │   ├── jobs/      # Job management
│   │   │   │   ├── customers/ # CRM
│   │   │   │   ├── calendar/  # Scheduling
│   │   │   │   ├── inbox/     # WhatsApp inbox
│   │   │   │   ├── invoices/  # AFIP invoices
│   │   │   │   └── reports/   # Dashboard
│   │   │   └── api/           # API routes
│   │   └── components/
│   └── mobile/                 # React Native + Expo
│       └── app/               # Expo Router
├── packages/
│   ├── db/                    # Supabase schema
│   └── shared/                # Shared types, utils
├── services/
│   ├── afip/                  # AFIP integration
│   ├── mercadopago/           # Payment service
│   ├── whatsapp/              # WhatsApp API
│   └── ai/                    # Voice-to-job
└── supabase/
    ├── migrations/
    └── functions/
```

---

# DATABASE SCHEMA (Minimal)

```sql
-- Core tables only - what's needed for 12 workflows

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cuit TEXT UNIQUE NOT NULL,
  iva_condition TEXT NOT NULL, -- responsable_inscripto, monotributista, etc.
  afip_punto_venta INTEGER,
  afip_cert BYTEA,
  afip_key BYTEA,
  mp_access_token TEXT,
  whatsapp_phone_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'technician', -- owner, dispatcher, technician
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL, -- Primary identifier in Argentina
  email TEXT,
  -- Argentina-specific (required for AFIP)
  doc_type TEXT DEFAULT 'dni', -- dni, cuit, cuil
  doc_number TEXT,
  iva_condition TEXT DEFAULT 'consumidor_final',
  -- Address
  address TEXT,
  neighborhood TEXT, -- Barrio (important in Buenos Aires)
  city TEXT DEFAULT 'Buenos Aires',
  province TEXT DEFAULT 'CABA',
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  -- Meta
  notes TEXT,
  whatsapp_thread_id TEXT, -- Link to WhatsApp conversation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  assigned_to UUID REFERENCES users(id),
  -- Job info
  title TEXT NOT NULL,
  description TEXT,
  job_type TEXT, -- plomeria, electricidad, aire_acondicionado, etc.
  -- Status workflow
  status TEXT DEFAULT 'pending', -- pending, scheduled, en_camino, working, completed, cancelled
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  -- Scheduling
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  -- Location
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  -- Completion
  photos TEXT[], -- Array of storage URLs
  notes TEXT,
  signature_url TEXT,
  -- Billing
  invoice_id UUID, -- Link when invoiced
  -- Source tracking
  source TEXT DEFAULT 'manual', -- manual, whatsapp, voice
  source_message_id TEXT, -- Original WhatsApp message ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE price_book (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT DEFAULT 'service', -- service, part
  price DECIMAL(12, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 21.00, -- IVA
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  job_id UUID REFERENCES jobs(id),
  -- AFIP fields
  invoice_number INTEGER NOT NULL,
  invoice_type TEXT NOT NULL, -- A, B, C, M
  punto_venta INTEGER NOT NULL,
  cae TEXT, -- AFIP authorization code
  cae_expiry DATE,
  -- Amounts
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'ARS',
  -- Line items
  line_items JSONB NOT NULL DEFAULT '[]',
  -- Status
  status TEXT DEFAULT 'pending', -- pending, issued, paid, cancelled
  -- PDF
  pdf_url TEXT,
  qr_data TEXT, -- AFIP QR code data
  -- Timestamps
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  invoice_id UUID REFERENCES invoices(id) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  method TEXT NOT NULL, -- mercadopago, cash, transfer
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  -- Mercado Pago fields
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  mp_status TEXT,
  installments INTEGER DEFAULT 1,
  -- Timestamps
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  job_id UUID REFERENCES jobs(id),
  -- Message data
  wa_message_id TEXT UNIQUE,
  direction TEXT NOT NULL, -- inbound, outbound
  message_type TEXT, -- text, audio, image, document, template
  content TEXT, -- Text content or caption
  media_url TEXT, -- For audio/image/document
  -- Audio processing
  transcription TEXT,
  ai_extracted_data JSONB, -- Extracted entities from voice
  -- Status
  status TEXT DEFAULT 'received', -- received, read, sent, delivered, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_jobs_org_status ON jobs(org_id, status);
CREATE INDEX idx_jobs_org_date ON jobs(org_id, scheduled_date);
CREATE INDEX idx_jobs_assigned ON jobs(assigned_to, scheduled_date);
CREATE INDEX idx_customers_org_phone ON customers(org_id, phone);
CREATE INDEX idx_invoices_org_status ON invoices(org_id, status);
CREATE INDEX idx_messages_org_customer ON whatsapp_messages(org_id, customer_id);

-- RLS policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
```

---

# DEVELOPMENT PHASES

## Phase 0: Setup (3-4 days)

| Task | Time |
|------|------|
| Monorepo setup (Turborepo) | 0.5 day |
| Next.js 14 + Expo SDK 52 | 0.5 day |
| Supabase project + schema | 1 day |
| External accounts (AFIP test, MP sandbox, WhatsApp) | 1 day |
| CI/CD (Vercel + EAS) | 0.5 day |

**Deliverable:** Dev environment ready, all API keys configured

---

## Phase 1: Core Platform (Weeks 1-4)

### Week 1: Auth + CRM + Scheduling

**Workflow 2: Customer CRM**
- Customer CRUD with Argentina fields
- CUIT/DNI validation
- Phone number as primary identifier
- Address with neighborhood
- Customer search

**Workflow 3: Job Scheduling**
- Job CRUD
- Calendar view (day/week)
- Technician assignment
- Status workflow (pending → scheduled → en_camino → working → completed)
- Drag-and-drop scheduling

**Auth:**
- Phone OTP login (Argentine numbers)
- Organization onboarding
- User roles (owner, dispatcher, technician)

### Week 2: AFIP Integration

**Workflow 5: AFIP Electronic Invoicing**
- WSAA authentication service
- WSFEv1 integration
- Invoice types (A, B, C based on IVA condition)
- CAE request and storage
- Sequential numbering per punto de venta
- QR code generation (RG 4291)

**Workflow 10: PDF Invoice**
- Professional invoice PDF
- Company branding
- AFIP QR code embedded
- Line items with IVA

```typescript
// services/afip/AfipService.ts
export class AfipService {
  private wsaa: WSAAClient;
  private wsfe: WSFEClient;

  async createInvoice(org: Organization, invoice: InvoiceData): Promise<AfipResult> {
    // Get/refresh AFIP token
    const token = await this.wsaa.getToken(org.afip_cert, org.afip_key);

    // Determine invoice type based on IVA conditions
    const invoiceType = this.getInvoiceType(
      org.iva_condition,
      invoice.customer.iva_condition
    );

    // Request CAE from AFIP
    const caeResult = await this.wsfe.requestCAE({
      token,
      cuit: org.cuit,
      puntoVenta: org.afip_punto_venta,
      tipoComprobante: invoiceType,
      concepto: 1, // Productos
      docTipo: this.getDocType(invoice.customer),
      docNro: invoice.customer.doc_number,
      importeTotal: invoice.total,
      importeNeto: invoice.subtotal,
      importeIVA: invoice.tax_amount,
      fechaComprobante: new Date()
    });

    return {
      cae: caeResult.cae,
      caeExpiry: caeResult.cae_vencimiento,
      invoiceNumber: caeResult.numero_comprobante,
      qrData: this.generateQRData(org, caeResult, invoice)
    };
  }

  private getInvoiceType(sellerIva: string, buyerIva: string): string {
    // Responsable Inscripto → RI = A, CF = B
    // Monotributista → Always C
    if (sellerIva === 'monotributista') return 'C';
    if (buyerIva === 'responsable_inscripto') return 'A';
    return 'B';
  }
}
```

### Week 3: Mercado Pago + Price Book

**Workflow 6: Mercado Pago Payments**
- OAuth account connection
- Payment preference creation
- QR code generation
- Payment link generation
- Webhook handler for payment status
- Cuotas display with CFT/TEA (legal requirement)

**Workflow 9: Basic Price Book**
- Service catalog
- Price + IVA per item
- Quick add to invoice
- Search by name

```typescript
// services/mercadopago/MercadoPagoService.ts
export class MercadoPagoService {
  async createPaymentLink(invoice: Invoice): Promise<PaymentLink> {
    const preference = await this.mp.preferences.create({
      items: [{
        title: `Factura ${invoice.invoice_type}${invoice.invoice_number}`,
        quantity: 1,
        unit_price: Number(invoice.total),
        currency_id: 'ARS'
      }],
      payment_methods: {
        installments: 12, // Allow up to 12 cuotas
        default_installments: 1
      },
      back_urls: {
        success: `${process.env.APP_URL}/payments/success`,
        failure: `${process.env.APP_URL}/payments/failure`
      },
      notification_url: `${process.env.APP_URL}/api/webhooks/mercadopago`,
      external_reference: invoice.id
    });

    return {
      preferenceId: preference.id,
      initPoint: preference.init_point, // Payment URL
      qrData: await this.generateQR(preference.id)
    };
  }

  async handleWebhook(payload: MPWebhook): Promise<void> {
    if (payload.type === 'payment') {
      const payment = await this.mp.payment.get(payload.data.id);
      
      if (payment.status === 'approved') {
        await updatePayment(payment.external_reference, {
          status: 'approved',
          mp_payment_id: payment.id,
          installments: payment.installments,
          paid_at: new Date()
        });

        // Mark invoice as paid
        await updateInvoice(payment.external_reference, {
          status: 'paid',
          paid_at: new Date()
        });
      }
    }
  }
}
```

### Week 4: WhatsApp Integration

**Workflow 7: WhatsApp Unified Inbox**
- Meta Cloud API or Twilio setup
- Webhook receiver for incoming messages
- Send template messages
- Send free-form messages (24h window)
- Message status tracking
- Conversation list view
- Link messages to customers

**Workflow 1: WhatsApp → Lead → Job (Text)**
- Parse incoming text messages
- Match to existing customer by phone
- Create new customer if not found
- Create job from message content
- Send confirmation via WhatsApp

```typescript
// services/whatsapp/WhatsAppService.ts
export class WhatsAppService {
  async handleIncomingMessage(webhook: WAWebhook): Promise<void> {
    const message = webhook.entry[0].changes[0].value.messages[0];
    const from = message.from; // Phone number
    const org = await getOrgByWhatsAppNumber(webhook.entry[0].changes[0].value.metadata.phone_number_id);

    // Find or create customer
    let customer = await findCustomerByPhone(org.id, from);
    if (!customer) {
      customer = await createCustomer({
        org_id: org.id,
        phone: from,
        name: webhook.entry[0].changes[0].value.contacts[0].profile.name
      });
    }

    // Store message
    const storedMessage = await createMessage({
      org_id: org.id,
      customer_id: customer.id,
      wa_message_id: message.id,
      direction: 'inbound',
      message_type: message.type,
      content: message.type === 'text' ? message.text.body : null,
      media_url: message.type === 'audio' ? await this.downloadMedia(message.audio.id) : null
    });

    // Process based on type
    if (message.type === 'audio') {
      await this.processVoiceMessage(storedMessage, customer);
    } else if (message.type === 'text') {
      await this.processTextMessage(storedMessage, customer);
    }
  }

  async sendJobConfirmation(job: Job, customer: Customer): Promise<void> {
    await this.sendTemplate(customer.phone, 'job_confirmed', {
      customer_name: customer.name,
      job_date: formatDate(job.scheduled_date),
      job_time: formatTime(job.scheduled_time_start),
      technician_name: job.technician?.full_name || 'Por confirmar'
    });
  }

  async sendInvoiceWithPayment(invoice: Invoice, paymentLink: string): Promise<void> {
    // Send invoice PDF
    await this.sendDocument(
      invoice.customer.phone,
      invoice.pdf_url,
      `Factura-${invoice.invoice_type}${invoice.invoice_number}.pdf`
    );

    // Send payment link
    await this.sendTemplate(invoice.customer.phone, 'payment_request', {
      invoice_number: `${invoice.invoice_type}-${invoice.invoice_number}`,
      total: formatCurrency(invoice.total),
      payment_link: paymentLink
    });
  }
}
```

---

## Phase 2: Voice AI + Mobile (Weeks 5-7)

### Week 5: Voice-to-Job AI

**Workflow 8: Voice-to-Job AI** ⭐ KEY DIFFERENTIATOR
- Receive WhatsApp audio messages
- Transcribe with Whisper (Spanish-AR)
- Extract entities with GPT-4o:
  - Customer name
  - Phone number
  - Address / neighborhood
  - Problem description
  - Urgency level
  - Preferred date/time
- Create job from extracted data
- Send confirmation via WhatsApp

```typescript
// services/ai/VoiceToJobService.ts
export class VoiceToJobService {
  async processVoiceMessage(message: WhatsAppMessage, customer: Customer): Promise<Job> {
    // 1. Download audio from WhatsApp
    const audioBuffer = await this.downloadAudio(message.media_url);

    // 2. Transcribe with Whisper (Spanish)
    const transcription = await this.openai.audio.transcriptions.create({
      file: audioBuffer,
      model: 'whisper-1',
      language: 'es',
      prompt: 'Mensaje de voz de cliente solicitando servicio técnico en Argentina.'
    });

    // 3. Extract entities with GPT-4o
    const extraction = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: `Sos un asistente que extrae información de mensajes de clientes argentinos solicitando servicios técnicos (plomería, electricidad, aire acondicionado, etc.).

Extraé la siguiente información del mensaje:
- nombre_cliente: nombre si lo menciona
- telefono: número de teléfono si lo menciona
- direccion: dirección completa
- barrio: barrio de Buenos Aires si lo menciona
- problema: descripción del problema/servicio requerido
- urgencia: "urgente", "normal", o "cuando_puedan"
- fecha_preferida: si menciona cuándo lo necesitan
- hora_preferida: si menciona horario preferido

Respondé SOLO con JSON válido. Si no encontrás un campo, poné null.`
      }, {
        role: 'user',
        content: transcription.text
      }],
      response_format: { type: 'json_object' }
    });

    const extracted = JSON.parse(extraction.choices[0].message.content);

    // 4. Update customer if new info
    if (extracted.direccion || extracted.barrio) {
      await updateCustomer(customer.id, {
        address: extracted.direccion || customer.address,
        neighborhood: extracted.barrio || customer.neighborhood
      });
    }

    // 5. Create job
    const job = await createJob({
      org_id: customer.org_id,
      customer_id: customer.id,
      title: this.generateJobTitle(extracted.problema),
      description: extracted.problema,
      priority: this.mapUrgency(extracted.urgencia),
      address: extracted.direccion || customer.address,
      scheduled_date: this.parseDate(extracted.fecha_preferida),
      source: 'voice',
      source_message_id: message.wa_message_id
    });

    // 6. Update message with extraction
    await updateMessage(message.id, {
      transcription: transcription.text,
      ai_extracted_data: extracted,
      job_id: job.id
    });

    // 7. Send confirmation
    await this.whatsapp.sendJobConfirmation(job, customer);

    return job;
  }

  private mapUrgency(urgencia: string | null): string {
    if (urgencia === 'urgente') return 'urgent';
    if (urgencia === 'cuando_puedan') return 'low';
    return 'normal';
  }
}
```

### Week 6-7: Mobile App (Technician)

**Workflow 4: Technician Mobile App**
- Expo SDK 52 + Expo Router
- Phone OTP authentication
- Today's jobs view
- Job detail screen
- Status updates (en camino, working, completed)
- Photo capture (before/after)
- Notes field
- Signature capture
- Customer tap-to-call / tap-to-WhatsApp

**Workflow 11: Job Completion Flow**
- Mark job complete
- Add photos
- Add services/parts from Price Book
- Capture signature
- Auto-generate invoice
- Send invoice + payment link via WhatsApp

```typescript
// apps/mobile/app/(tabs)/jobs/[id].tsx
export default function JobDetailScreen() {
  const { id } = useLocalSearchParams();
  const { job, customer, updateStatus } = useJob(id);

  const handleStatusChange = async (newStatus: string) => {
    await updateStatus(newStatus);
    
    if (newStatus === 'en_camino') {
      // Notify customer via WhatsApp
      await api.post(`/jobs/${id}/notify-en-route`);
    }
  };

  const handleComplete = async () => {
    // Navigate to completion flow
    router.push(`/jobs/${id}/complete`);
  };

  return (
    <ScrollView>
      <JobHeader job={job} customer={customer} />
      
      <CustomerCard 
        customer={customer}
        onCall={() => Linking.openURL(`tel:${customer.phone}`)}
        onWhatsApp={() => Linking.openURL(`whatsapp://send?phone=${customer.phone}`)}
        onNavigate={() => openMapsWithAddress(job.address)}
      />

      <StatusButtons 
        currentStatus={job.status}
        onStatusChange={handleStatusChange}
      />

      <JobNotes notes={job.notes} onUpdate={updateNotes} />
      
      <PhotoGrid 
        photos={job.photos} 
        onAddPhoto={handleAddPhoto}
      />

      {job.status === 'working' && (
        <Button onPress={handleComplete}>
          Finalizar Trabajo
        </Button>
      )}
    </ScrollView>
  );
}
```

```typescript
// apps/mobile/app/jobs/[id]/complete.tsx
export default function JobCompleteScreen() {
  const { id } = useLocalSearchParams();
  const [photos, setPhotos] = useState<string[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [signature, setSignature] = useState<string | null>(null);

  const handleComplete = async () => {
    // 1. Upload photos
    const photoUrls = await uploadPhotos(photos);

    // 2. Update job
    await api.patch(`/jobs/${id}`, {
      status: 'completed',
      photos: photoUrls,
      signature_url: signature,
      actual_end: new Date()
    });

    // 3. Create invoice
    const invoice = await api.post('/invoices', {
      job_id: id,
      line_items: lineItems
    });

    // 4. Request AFIP CAE
    await api.post(`/invoices/${invoice.id}/afip`);

    // 5. Create Mercado Pago link
    const payment = await api.post(`/invoices/${invoice.id}/payment-link`);

    // 6. Send via WhatsApp (happens server-side)
    await api.post(`/invoices/${invoice.id}/send-whatsapp`);

    router.replace('/jobs');
  };

  return (
    <ScrollView>
      <Text style={styles.title}>Finalizar Trabajo</Text>

      <PhotoCapture 
        photos={photos} 
        onPhotosChange={setPhotos}
        labels={['Antes', 'Después']}
      />

      <PriceBookSelector 
        items={lineItems}
        onItemsChange={setLineItems}
      />

      <TotalDisplay items={lineItems} />

      <SignaturePad 
        signature={signature}
        onSignatureChange={setSignature}
      />

      <Button onPress={handleComplete} disabled={!signature}>
        Completar y Facturar
      </Button>
    </ScrollView>
  );
}
```

---

## Phase 3: Polish + Launch (Weeks 8-10)

### Week 8: Reporting + Testing

**Workflow 12: Basic Reporting Dashboard**
Only 5 metrics for V1:
- Completed jobs (today/week/month)
- Pending jobs
- Revenue (AFIP invoices)
- Payments collected (MP)
- Outstanding payments

```typescript
// app/(dashboard)/reports/page.tsx
export default async function ReportsPage() {
  const stats = await getOrgStats();

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <StatCard 
        title="Trabajos Completados" 
        value={stats.completedJobs.thisMonth}
        change={stats.completedJobs.vsLastMonth}
      />
      <StatCard 
        title="Trabajos Pendientes" 
        value={stats.pendingJobs}
      />
      <StatCard 
        title="Facturado" 
        value={formatCurrency(stats.invoiced.thisMonth)}
        change={stats.invoiced.vsLastMonth}
      />
      <StatCard 
        title="Cobrado" 
        value={formatCurrency(stats.collected.thisMonth)}
        change={stats.collected.vsLastMonth}
      />
      <StatCard 
        title="Por Cobrar" 
        value={formatCurrency(stats.outstanding)}
        variant="warning"
      />
    </div>
  );
}
```

**Testing:**
- AFIP homologación testing
- Mercado Pago sandbox testing
- WhatsApp template approval
- End-to-end job flow
- Mobile testing (iOS + Android)

### Week 9: Polish + App Stores

- Fix bugs from testing
- Performance optimization
- App Store screenshots (Spanish)
- App Store descriptions
- Privacy policy (Spanish)
- Terms of service
- Submit to App Store + Google Play

### Week 10: Launch

- AFIP production certificates
- Mercado Pago production credentials
- WhatsApp Business verification complete
- Production deployment
- Onboard first 5-10 pilot customers
- Gather feedback
- Iterate

---

# WHATSAPP MESSAGE TEMPLATES

Templates must be pre-approved by Meta. Submit these during Week 4:

```
Template: job_confirmed
Language: es_AR
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
---
Hola {{1}}! 🚗

{{2}} está en camino a tu domicilio.
Tiempo estimado de llegada: {{3}} minutos.

📍 {{4}}
```

```
Template: payment_request
Language: es_AR
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
---
Hola {{1}}! ✅

El trabajo fue completado.

📝 Detalle:
{{2}}

💰 Total: ${{3}}

Tu factura y link de pago llegan en unos segundos.

¡Gracias por confiar en nosotros! ⭐
```

---

# PRICING STRATEGY (Argentina Reality)

## Forget Workiz Pricing

Workiz charges $65-260+/month. That doesn't work in Argentina.

## Argentine Market Reality

| Segment | Monthly Willingness | Users |
|---------|---------------------|-------|
| Solo plumber/electrician | $8-15 USD | 1 |
| Small HVAC company | $15-25 USD | 2-3 |
| Medium trades company | $40-80 USD | 4-10 |
| Larger operations | $100-200 USD | 10+ |

## Recommended Pricing

| Plan | Price (USD) | Price (ARS)* | Features |
|------|-------------|--------------|----------|
| **Inicio** | $12/month | ~$15,000 | 1 user, 50 jobs/month, WhatsApp, AFIP, MP |
| **Profesional** | $25/month | ~$30,000 | 3 users, 200 jobs/month, Voice AI, Priority support |
| **Empresa** | $60/month | ~$72,000 | 10 users, Unlimited jobs, All features |

*ARS pricing updated monthly to maintain USD parity

## Why This Works

- A plumber doing 10 jobs/month at $20,000 ARS each = $200,000/month revenue
- CampoTech at $15,000 ARS = 7.5% of ONE job
- If software saves 30 min/day = easily pays for itself

---

# POST-MVP ROADMAP (After PMF)

Only build these AFTER you have 100+ paying customers:

## V1.5 (Months 4-6)
- Offline-first mobile sync
- Service plans (abonos)
- Equipment tracking (basic)
- Lead source tracking
- Automated follow-up messages

## V2.0 (Months 7-12)
- Customer portal
- Online booking widget
- Inventory management
- Multi-user permissions
- Advanced reporting
- Route optimization

## V3.0 (Year 2)
- AI call answering
- Multi-location
- Franchise support
- Integrations (accounting)

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

| Service | Cost |
|---------|------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| AFIP SDK (Afip SDK) | $50-100 |
| Twilio (WhatsApp) | $20-50 |
| OpenAI (Whisper + GPT) | $30-80 |
| **Total** | **$145-275** |

## Unit Economics

| Metric | Value |
|--------|-------|
| ARPU | $20/month |
| Infra cost per user | ~$2.50/month |
| Gross margin | ~87% |
| CAC target | $20-40 |
| LTV (24 months, 10% churn) | $200+ |
| LTV:CAC | 5-10x |

---

# SUCCESS METRICS

## Week 10 (Launch)
- [ ] 5-10 pilot customers onboarded
- [ ] 100+ jobs created through platform
- [ ] AFIP integration working (real CAEs)
- [ ] MP payments processing
- [ ] Voice-to-job working reliably

## Month 3
- [ ] 50 paying customers
- [ ] <10% monthly churn
- [ ] $1,000+ MRR
- [ ] Voice AI used by 50%+ of customers
- [ ] 4+ star App Store rating

## Month 6
- [ ] 150 paying customers
- [ ] <8% monthly churn
- [ ] $3,000+ MRR
- [ ] 30%+ referral growth
- [ ] Ready to raise seed round

## Month 12
- [ ] 500 paying customers
- [ ] <5% monthly churn
- [ ] $10,000+ MRR
- [ ] Unit economics proven
- [ ] Expansion to Córdoba/Rosario

---

# KEY REMINDERS

1. **WhatsApp + Voice AI is the product** - Everything else is support
2. **Don't build Workiz** - Build the 12 workflows that solve Argentine problems
3. **Ship fast** - 10 weeks to market, not 52 weeks
4. **Price for Argentina** - $12-25/month, not $65
5. **AFIP + MP reliability matters** - These integrations must be rock solid
6. **Mobile is where work happens** - Technician app must be excellent
7. **Defer everything else** - No inventory, no portals, no booking widgets until PMF

---

*Document Version: 3.0 (Argentina MVP Focus)*
*Last Updated: December 2025*
*Core Workflows: 12*
*Timeline: 10 weeks*
*Target: PMF with first 50 customers*
