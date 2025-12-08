# CampoTech: Argentina MVP Roadmap v7
## 12 Core Workflows | Production-Grade | Enterprise Security

---

# EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Core Workflows** | 12 |
| **MVP Timeline** | 18 weeks |
| **Architecture** | 8 modules + Infrastructure + Governance |
| **Onboarding** | 2 fields only (CUIT + Company Name) |
| **Default Mode** | Simple (Advanced unlockable) |
| **Reliability Target** | Zero user-facing errors |
| **Offline Support** | Full technician workflow |
| **Data Retention** | 10 years (AFIP compliance) |
| **Security** | AES-256 at rest, TLS 1.3 in transit |

---

# CHANGELOG

| Version | Key Changes |
|---------|-------------|
| v4 | Modular + realistic timeline |
| v5 | + Minimal onboarding, fallbacks, observability |
| v6 | + Voice AI, offline, Android performance, costs |
| **v7** | + Event ownership, idempotency, UI states, permissions, security, abuse prevention |

---

# 16 ISSUES ADDRESSED

| # | Issue | Solution |
|---|-------|----------|
| 1 | Event ownership undefined | Domain ownership matrix, conflict resolution |
| 2 | No idempotency | Keys for AFIP/MP/WhatsApp with Redis |
| 3 | UI states missing | Status models for all entities |
| 4 | Notification chaos | Priority matrix, suppression rules |
| 5 | Job creation assumes clean input | 8 automation rules, spam detection |
| 6 | Tax integration shallow | Full IVA A/B/C, regional pricing |
| 7 | No dispute handling | Refund/chargeback workflows |
| 8 | Roles undefined | 5 roles, 40+ permissions |
| 9 | Offline details missing | Photo specs, conflict resolution |
| 10 | Mode navigation unclear | Role-based locking, persistence |
| 11 | No retention plan | 10-year archive, GDPR delete |
| 12 | No versioning | Immutable docs, audit chain |
| 13 | Panic mode uncontrolled | Metric triggers, hysteresis |
| 14 | No backpressure | Priority queues, overflow strategies |
| 15 | Security gaps | AES-256, key rotation, log redaction |
| 16 | No abuse prevention | Rate limiting, spam filters |

---

# SECTION 1: EVENT OWNERSHIP & SYSTEM OF RECORD

## Domain Ownership Matrix

| Domain | System of Record | Event Authority | Conflict Rule |
|--------|------------------|-----------------|---------------|
| **Jobs** | `jobs` table | JobService | Server wins, offline queued |
| **Invoices** | `invoices` table | InvoiceService | AFIP authoritative for CAE |
| **Payments** | `payments` table | PaymentService | MP webhook authoritative |
| **Messages** | `whatsapp_messages` | MessageService | WA delivery authoritative |
| **Customers** | `customers` table | CustomerService | Server wins, merge on sync |

## Event Bus

```typescript
type DomainEvent = 
  | { type: 'job.created'; payload: Job }
  | { type: 'job.status_changed'; payload: { job: Job; from: string; to: string } }
  | { type: 'job.completed'; payload: { job: Job; invoice?: Invoice } }
  | { type: 'invoice.created'; payload: Invoice }
  | { type: 'invoice.cae_received'; payload: { invoice: Invoice; cae: string } }
  | { type: 'payment.received'; payload: Payment }
  | { type: 'message.sent'; payload: WhatsAppMessage };

// Handlers
eventBus.subscribe('job.completed', async (event) => {
  if (event.payload.job.org.settings.auto_invoice_on_complete) {
    await invoiceService.createFromJob(event.payload.job);
  }
});

eventBus.subscribe('invoice.created', async (event) => {
  if (event.payload.invoice.org.settings.auto_send_whatsapp) {
    await messageService.sendInvoiceNotification(event.payload.invoice);
  }
});
```

## Conflict Resolution

```typescript
async function resolveJobConflict(serverJob: Job, mobileJob: Job): Promise<Job> {
  // Rule 1: Mobile completion wins (technician did the work)
  if (mobileJob.status === 'completed' && serverJob.status !== 'cancelled') {
    return { ...serverJob, status: 'completed', ...mobileJob.completionData };
  }
  
  // Rule 2: Server cancellation wins
  if (serverJob.status === 'cancelled') {
    return serverJob;
  }
  
  // Rule 3: Merge non-conflicting (photos, notes)
  return {
    ...serverJob,
    photos: [...serverJob.photos, ...mobileJob.newPhotos],
    notes: mergeNotes(serverJob.notes, mobileJob.notes)
  };
}
```

---

# SECTION 2: IDEMPOTENCY FOR EXTERNAL SERVICES

## Idempotency Key Strategy

| Service | Key Format | TTL |
|---------|------------|-----|
| AFIP CAE | `afip:cae:{org}:{invoice}` | 7 days |
| MP Preference | `mp:pref:{org}:{invoice}` | 24 hours |
| MP Webhook | `mp:webhook:{webhook_id}` | 7 days |
| WA Message | `wa:msg:{org}:{template}:{to}:{job}` | 1 hour |

## Implementation

```typescript
class IdempotencyService {
  async executeOnce<T>(key: string, operation: () => Promise<T>, ttl: number): Promise<T> {
    // Check if already executed
    const existing = await redis.get(`result:${key}`);
    if (existing) return JSON.parse(existing);
    
    // Acquire lock
    const locked = await redis.set(`lock:${key}`, '1', 'NX', 'EX', 60);
    if (!locked) {
      // Wait for other process
      return await this.waitForResult(key);
    }
    
    try {
      const result = await operation();
      await redis.setex(`result:${key}`, ttl, JSON.stringify(result));
      return result;
    } finally {
      await redis.del(`lock:${key}`);
    }
  }
}

// Usage
async function createInvoiceIdempotent(data: InvoiceData): Promise<Invoice> {
  return idempotencyService.executeOnce(
    `afip:cae:${data.org_id}:${data.job_id}`,
    () => afipService.createInvoice(data),
    7 * 24 * 60 * 60
  );
}
```

---

# SECTION 3: USER-FACING STATUS MODELS

## Job Status

| Internal | Technician Sees | Customer Sees (WA) | Color |
|----------|-----------------|-------------------|-------|
| `pending` | "Pendiente" | - | Gray |
| `scheduled` | "Agendado [fecha]" | "Servicio agendado" | Blue |
| `en_camino` | "En camino" | "Técnico en camino" | Orange |
| `working` | "Trabajando" | - | Yellow |
| `completed` | "Completado ✓" | "Trabajo completado" | Green |
| `cancelled` | "Cancelado" | "Servicio cancelado" | Red |

## Invoice Status

| Internal | Business Sees | Customer Sees | Actions |
|----------|---------------|---------------|---------|
| `draft` | "Borrador (pendiente AFIP)" | - | Edit, Delete |
| `pending_cae` | "Procesando..." | - | - |
| `issued` | "Emitida ✓" | "Factura #X" | Send, Download |
| `paid` | "Pagada ✓" | "Pagada ✓" | Receipt |
| `cancelled` | "Anulada" | - | - |
| `refunded` | "Reembolsada" | "Reembolso procesado" | - |

## Payment Status

| Internal | Business Sees | Customer Sees |
|----------|---------------|---------------|
| `pending` | "Esperando pago" | "Pendiente" |
| `approved` | "Pagado ✓" | "Confirmado ✓" |
| `rejected` | "Rechazado" | "Rechazado - intentá de nuevo" |
| `refunded` | "Reembolsado" | "Reembolso acreditado" |
| `in_dispute` | "En disputa ⚠️" | "En revisión" |
| `chargedback` | "Contracargo ⚠️" | - |

## Message Status

| Internal | Business Sees |
|----------|---------------|
| `queued` | "En cola" |
| `sent` | "Enviado ✓" |
| `delivered` | "Entregado ✓✓" |
| `read` | "Leído ✓✓" |
| `failed` | "Error - reintentando" |
| `fallback_sms` | "Enviado por SMS" |

---

# SECTION 4: NOTIFICATION PRIORITY & SUPPRESSION

## Notification Matrix

| Event | Recipient | Channel | Priority | Max Retries | Suppression |
|-------|-----------|---------|----------|-------------|-------------|
| Job Confirmed | Customer | WhatsApp | Normal | 3 | 1/job |
| Tech En Route | Customer | WhatsApp | High | 3 | 1/job |
| Job Completed | Customer | WhatsApp | Normal | 3 | 1/job |
| Payment Received | Business | Push | Normal | 1 | None |
| AFIP Down | Business | In-App | Low | 0 | 1/4h |
| Voice Needs Review | Business | Push | Normal | 1 | Batch/5min |
| PANIC Mode | Admin | Slack+SMS | Critical | 5 | None |

## Implementation

```typescript
const NOTIFICATION_CONFIGS = {
  'job.confirmed': {
    channels: ['whatsapp'],
    priority: 'normal',
    maxRetries: 3,
    fallback: 'sms',
    suppressionKey: (ctx) => `job_confirmed:${ctx.jobId}`,
    suppressionTTL: 86400
  },
  'tech.en_route': {
    channels: ['whatsapp'],
    priority: 'high',
    maxRetries: 3,
    fallback: 'sms',
    suppressionKey: (ctx) => `tech_en_route:${ctx.jobId}`,
    suppressionTTL: 3600
  },
  'panic.activated': {
    channels: ['slack', 'sms'],
    priority: 'critical',
    maxRetries: 5
    // No suppression for critical
  }
};

async function sendNotification(type: string, context: any): Promise<void> {
  const config = NOTIFICATION_CONFIGS[type];
  
  // Check suppression
  if (config.suppressionKey) {
    const key = config.suppressionKey(context);
    if (await isSuppressed(key)) return;
  }
  
  // Send via channels
  for (const channel of config.channels) {
    try {
      await sendViaChannel(channel, type, context);
      if (config.suppressionKey) {
        await suppress(config.suppressionKey(context), config.suppressionTTL);
      }
      return;
    } catch (error) {
      // Try fallback
    }
  }
  
  // Fallback
  if (config.fallback) {
    await sendViaChannel(config.fallback, type, context);
  }
}
```

---

# SECTION 5: JOB CREATION AUTOMATION RULES

## Message Classification

| Classification | Confidence | Action |
|----------------|------------|--------|
| Clear Request | ≥0.8 | Auto-create job |
| Probable Request | 0.5-0.8 | Create draft, notify |
| Inquiry | 0.3-0.5 | Create lead |
| Spam/Irrelevant | <0.3 | Ignore |

## Automation Rules

```typescript
const AUTOMATION_RULES = [
  // High confidence = auto-create
  {
    id: 'auto_create_complete',
    condition: (ext) => 
      ext.overall_confidence >= 0.7 &&
      ext.problem_description?.confidence >= 0.7,
    action: 'auto_create'
  },
  
  // Emergency keywords = always auto-create
  {
    id: 'auto_create_emergency',
    condition: (ext, meta) => 
      containsEmergency(meta.transcription), // "urgente", "inunda", "olor a gas"
    action: 'auto_create'
  },
  
  // Price inquiry = lead, not job
  {
    id: 'lead_price_inquiry',
    condition: (ext, meta) => 
      meta.transcription?.includes('cuánto') ||
      meta.transcription?.includes('precio'),
    action: 'create_lead'
  },
  
  // Existing conversation = human review
  {
    id: 'human_existing_conversation',
    condition: (ext, meta) => isExistingConversation(meta),
    action: 'human_review'
  },
  
  // Too vague = human review
  {
    id: 'human_too_vague',
    condition: (ext) => 
      !ext.problem_description?.value || 
      ext.problem_description.value.length < 10,
    action: 'human_review'
  },
  
  // Spam patterns = ignore
  {
    id: 'ignore_spam',
    condition: (ext, meta) => 
      isSpam(meta) || meta.transcription?.length < 5,
    action: 'ignore'
  }
];
```

---

# SECTION 6: PRICE BOOK TAX INTEGRATION

## Argentine Tax Rules

| Customer Type | Invoice Type | IVA Treatment |
|---------------|--------------|---------------|
| Responsable Inscripto | A | Discriminated (21%) |
| Monotributista | A | Discriminated (21%) |
| Consumidor Final | B | Included |
| Exento | B | Exempt |

## Price Book Schema

```sql
CREATE TABLE price_book (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'mano_de_obra', 'materiales', 'consumibles'
  service_type TEXT, -- 'plomería', 'electricidad', 'gas', 'aire'
  base_price DECIMAL(12, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 21.00,
  includes_tax BOOLEAN DEFAULT false,
  region_prices JSONB DEFAULT '{}', -- {"CABA": 15000, "GBA": 12000}
  afip_product_code TEXT,
  is_active BOOLEAN DEFAULT true
);
```

## Tax Calculation

```typescript
function calculateInvoice(customer: Customer, lineItems: LineItem[], org: Organization) {
  const invoiceType = determineInvoiceType(org.iva_condition, customer.iva_condition);
  
  const calculated = lineItems.map(item => {
    const priceBook = getPriceBookItem(item.id);
    const basePrice = item.region 
      ? priceBook.region_prices[item.region] || priceBook.base_price
      : priceBook.base_price;
    
    const netPrice = priceBook.includes_tax 
      ? basePrice / (1 + priceBook.tax_rate / 100)
      : basePrice;
    
    const taxAmount = invoiceType === 'A' 
      ? netPrice * (priceBook.tax_rate / 100)
      : 0; // Tax embedded for B/C
    
    return { ...item, netPrice, taxAmount, lineTotal: netPrice + taxAmount };
  });
  
  return {
    invoiceType,
    subtotal: sum(calculated.map(c => c.netPrice)),
    totalTax: sum(calculated.map(c => c.taxAmount)),
    total: sum(calculated.map(c => c.lineTotal)),
    lineItems: calculated
  };
}
```

---

# SECTION 7: PAYMENT DISPUTE HANDLING

## Payment State Machine

```
PENDING → APPROVED → REFUNDED
                  → IN_DISPUTE → DISPUTE_WON (→ APPROVED)
                              → DISPUTE_LOST (→ CHARGEDBACK)
       → REJECTED
       → CANCELLED
```

## Dispute Service

```typescript
class DisputeService {
  async handleChargeback(webhook: MPChargebackWebhook): Promise<void> {
    const payment = await paymentRepo.findByMPId(webhook.payment_id);
    
    // Update payment status
    await paymentRepo.update(payment.id, {
      status: 'chargedback',
      chargeback_id: webhook.id,
      chargeback_reason: webhook.reason
    });
    
    // Update invoice
    await invoiceRepo.update(payment.invoice_id, {
      status: 'disputed'
    });
    
    // Notify business immediately
    await notificationService.send('payment.chargedback', {
      payment,
      reason: webhook.reason,
      deadline: webhook.response_deadline
    });
    
    // Create dispute record
    await disputeRepo.create({
      payment_id: payment.id,
      type: 'chargeback',
      reason: webhook.reason,
      response_deadline: webhook.response_deadline,
      status: 'pending_response'
    });
  }
  
  async initiateRefund(paymentId: string, amount: number, reason: string): Promise<void> {
    return distributedLock.withLock(`refund:${paymentId}`, async () => {
      const payment = await paymentRepo.findById(paymentId);
      
      // Request refund from MP
      const mpRefund = await mpClient.createRefund(payment.mp_payment_id, amount);
      
      // Update payment
      await paymentRepo.update(paymentId, {
        status: amount >= payment.amount ? 'refunded' : 'partially_refunded',
        refunded_amount: amount
      });
      
      // Notify customer
      await notificationService.send('payment.refund_initiated', { amount, reason });
    });
  }
}
```

---

# SECTION 8: USER ROLES & PERMISSIONS

## Role Definitions

| Role | Description |
|------|-------------|
| **Owner** | Full access, billing, danger zone |
| **Admin** | Operational access, no billing |
| **Dispatcher** | Jobs & customers, no finances |
| **Technician** | Own jobs only, simple mode locked |
| **Accountant** | Invoices & payments only |

## Permissions Matrix

| Permission | Owner | Admin | Dispatcher | Technician | Accountant |
|------------|-------|-------|------------|------------|------------|
| View all jobs | ✅ | ✅ | ✅ | ❌ | ❌ |
| View own jobs | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create jobs | ✅ | ✅ | ✅ | ❌ | ❌ |
| Complete jobs | ✅ | ✅ | ✅ | ✅ (own) | ❌ |
| View invoices | ✅ | ✅ | ❌ | ❌ | ✅ |
| Create invoices | ✅ | ✅ | ❌ | ❌ | ✅ |
| Process refunds | ✅ | ✅ | ❌ | ❌ | ❌ |
| View reports | ✅ | ✅ | ❌ | ❌ | ✅ |
| Manage team | ✅ | ❌ | ❌ | ❌ | ❌ |
| AFIP config | ✅ | ❌ | ❌ | ❌ | ❌ |
| Billing | ✅ | ❌ | ❌ | ❌ | ❌ |

## Implementation

```typescript
const ROLE_PERMISSIONS = {
  owner: ['jobs.*', 'customers.*', 'invoices.*', 'payments.*', 'team.*', 'settings.*', 'billing.*'],
  admin: ['jobs.*', 'customers.*', 'invoices.*', 'payments.view', 'team.view', 'settings.view'],
  dispatcher: ['jobs.*', 'customers.*'],
  technician: ['jobs.view_own', 'jobs.complete_own', 'customers.view_own'],
  accountant: ['invoices.*', 'payments.view', 'reports.view']
};

function can(user: User, action: string, resource: string): boolean {
  const permissions = ROLE_PERMISSIONS[user.role];
  return permissions.includes(`${resource}.*`) || 
         permissions.includes(`${resource}.${action}`);
}

// RLS for technicians
CREATE POLICY technician_jobs ON jobs
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM users WHERE role != 'technician')
    OR assigned_to = auth.uid()
  );
```

---

# SECTION 9: PHOTO, SIGNATURE & OFFLINE

## Photo Specifications

| Aspect | Value | Reason |
|--------|-------|--------|
| Max Resolution | 1200x1200 | Quality vs size |
| Compression | 70% JPEG | Mobile-friendly |
| Max File Size | 500KB | 3G-compatible |
| Local Cache | 200MB | Won't fill cheap phones |
| Thumbnail | 200x200 @ 60% | Fast list rendering |
| Retention | 6 months active | Then cold storage |

## Signature Handling

```typescript
async function captureSignature(jobId: string): Promise<string> {
  const signature = await signatureRef.readSignature();
  const localPath = `${documentsDir}/signatures/${jobId}.png`;
  
  // Save locally first (works offline)
  await FileSystem.writeAsStringAsync(localPath, signature, { encoding: 'base64' });
  
  // Queue for upload
  await database.get('sync_queue').create({
    action_type: 'signature_upload',
    entity_id: jobId,
    payload: JSON.stringify({ local_path: localPath }),
    status: 'pending'
  });
  
  return localPath;
}
```

## Offline Conflict Resolution

```typescript
async function resolveConflicts(): Promise<ConflictReport> {
  const conflicts = await database.get('jobs')
    .query(Q.where('sync_status', 'conflict'))
    .fetch();
  
  for (const local of conflicts) {
    const server = await supabase.from('jobs').select('*').eq('id', local.server_id).single();
    
    if (!server.data) {
      // Deleted on server
      await discardLocal(local);
      continue;
    }
    
    if (local.status === 'completed' && server.data.status !== 'cancelled') {
      // Local completion wins
      await pushCompletion(local, server.data);
    } else if (server.data.updated_at > local.updated_at) {
      // Server newer
      await acceptServer(local, server.data);
    } else {
      // Merge
      await mergeChanges(local, server.data);
    }
  }
}
```

---

# SECTION 10: SIMPLE → ADVANCED MODE

## Mode Architecture

| Simple Mode (Default) | Advanced Mode |
|----------------------|---------------|
| Today's jobs only | Full calendar |
| One-tap actions | Status dropdown |
| Auto-invoice | Manual invoicing |
| No settings | Full settings |
| No reports | All reports |
| Big buttons | Dense UI |

## Role-Based Locking

| Role | Mode | Can Toggle? |
|------|------|-------------|
| Owner | Both | Yes |
| Admin | Both | Yes |
| Dispatcher | Both | Yes |
| Technician | Simple only | No |
| Accountant | Advanced only | No |

## Implementation

```typescript
function ModeProvider({ children }) {
  const { user } = useAuth();
  const [mode, setMode] = useState('simple');
  
  const canToggle = !['technician', 'accountant'].includes(user?.role);
  
  useEffect(() => {
    if (user?.role === 'technician') setMode('simple');
    if (user?.role === 'accountant') setMode('advanced');
  }, [user]);
  
  const isFeatureVisible = (feature: string) => {
    const simpleFeatures = ['today_jobs', 'inbox', 'quick_actions'];
    const advancedFeatures = [...simpleFeatures, 'calendar', 'reports', 'settings'];
    return (mode === 'simple' ? simpleFeatures : advancedFeatures).includes(feature);
  };
  
  return <ModeContext.Provider value={{ mode, canToggle, isFeatureVisible }}>
    {children}
  </ModeContext.Provider>;
}
```

---

# SECTION 11: DATA RETENTION & ARCHIVAL

## Retention Policy

| Data Type | Active | Archive | Total | Legal Basis |
|-----------|--------|---------|-------|-------------|
| Invoices | 2 years | 8 years | 10 years | AFIP requirement |
| Payments | 2 years | 8 years | 10 years | Matches invoices |
| Jobs | 2 years | 3 years | 5 years | Disputes |
| Customers | Active + 2y | 3 years | 5 years | After last job |
| Photos | 6 months | 5 years | 5.5 years | Evidence |
| Voice Audio | 30 days | None | 30 days | Privacy |
| Audit Logs | 1 year | 9 years | 10 years | Compliance |

## GDPR-Like Delete Request

```typescript
async function handleDeleteRequest(customerId: string): Promise<DeleteResult> {
  // Check for open invoices
  const openInvoices = await countOpenInvoices(customerId);
  if (openInvoices > 0) {
    return { status: 'rejected', reason: 'Open invoices exist' };
  }
  
  // Delete what we can
  await deleteMessages(customerId);
  await deleteVoiceAudio(customerId);
  
  // Anonymize what we must keep
  await anonymizeJobs(customerId);
  
  // Soft delete customer
  await softDeleteCustomer(customerId);
  
  return {
    status: 'completed',
    deleted: ['messages', 'voice_audio'],
    anonymized: ['jobs'],
    retained: ['invoices', 'payments'] // Legal requirement
  };
}
```

---

# SECTION 12: DOCUMENT VERSIONING & AUDIT

## Immutable Documents

```typescript
async function storeImmutableDocument(type: string, content: Buffer): Promise<ImmutableDoc> {
  // Calculate hash
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  
  // Check for duplicate
  const existing = await findByHash(hash);
  if (existing) return existing;
  
  // Get version
  const version = await getNextVersion(entityId, type);
  
  // Upload to immutable storage (S3 with object lock)
  const url = await uploadImmutable(content, { type, version, hash });
  
  // Sign document (for invoices)
  const signature = type === 'invoice' 
    ? await signDocument(content)
    : undefined;
  
  return documentRepo.create({
    type, version, content_hash: hash, storage_url: url, signature
  });
}
```

## Audit Log with Chain

```typescript
async function logAudit(entry: AuditEntry): Promise<void> {
  // Get previous entry for chain
  const previous = await getLatestEntry(entry.entity_type, entry.entity_id);
  
  // Calculate hash including previous
  const data = JSON.stringify({
    timestamp: entry.timestamp,
    user_id: entry.user_id,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    changes: entry.changes,
    previous_hash: previous?.entry_hash
  });
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  
  await auditRepo.create({
    ...entry,
    previous_hash: previous?.entry_hash,
    entry_hash: hash
  });
}

// Verify chain integrity
async function verifyIntegrity(entityType: string, entityId: string): Promise<boolean> {
  const entries = await auditRepo.findByEntity(entityType, entityId);
  
  for (let i = 0; i < entries.length; i++) {
    const calculated = calculateHash(entries[i]);
    if (calculated !== entries[i].entry_hash) return false;
    if (i > 0 && entries[i].previous_hash !== entries[i-1].entry_hash) return false;
  }
  return true;
}
```

---

# SECTION 13: PANIC MODE CONTROLS

## Configuration

| Service | Degraded At | Panic At | Recovery | Min Panic Time |
|---------|-------------|----------|----------|----------------|
| AFIP | 3 failures | 5 failures | 5 successes | 5 minutes |
| WhatsApp | 5 failures | 10 failures | 5 successes | 2 minutes |
| MercadoPago | 3 failures | 7 failures | 5 successes | 2 minutes |

## Metric-Based Triggers

```typescript
const PANIC_TRIGGERS = {
  afip: {
    consecutiveFailures: 5,
    errorRateThreshold: 0.5,   // 50% error rate
    latencyThreshold: 30000,   // 30s P99
    recoverySuccesses: 5,
    recoveryMinTime: 5 * 60 * 1000 // 5 minutes
  }
};

async function evaluateState(service: string, health: ServiceHealth): Promise<void> {
  const config = PANIC_TRIGGERS[service];
  const errorRate = await getErrorRate(service, 60);
  const p99Latency = await getP99Latency(service, 60);
  
  // Check panic entry
  const shouldPanic = 
    health.consecutiveFailures >= config.consecutiveFailures ||
    errorRate >= config.errorRateThreshold ||
    p99Latency >= config.latencyThreshold;
  
  if (shouldPanic && health.status !== 'panic') {
    await enterPanicMode(service, { errorRate, p99Latency });
  }
  
  // Check recovery (with hysteresis)
  const timeSincePanic = Date.now() - health.panicStartedAt;
  const canRecover = 
    timeSincePanic >= config.recoveryMinTime &&
    health.consecutiveSuccesses >= config.recoverySuccesses;
  
  if (canRecover && health.status === 'panic') {
    await recoverService(service);
  }
}
```

## Manual Override

```typescript
async function forceStatus(service: string, status: string, operatorId: string, reason: string): Promise<void> {
  await auditLog.log({
    action: 'manual_status_override',
    entity_id: service,
    user_id: operatorId,
    metadata: { previousStatus: health.status, newStatus: status, reason }
  });
  
  await alertService.sendWarning({
    title: `Manual override: ${service}`,
    message: `${operatorId} set ${service} to ${status}. Reason: ${reason}`
  });
  
  health.status = status;
  health.manualOverride = { by: operatorId, at: new Date(), reason };
}
```

---

# SECTION 14: QUEUE BACKPRESSURE

## Queue Configuration

| Queue | Concurrency | Rate Limit | Max Size | Overflow Strategy |
|-------|-------------|------------|----------|-------------------|
| afip-invoices | 2 | 10/min | 1000 | Priority only |
| whatsapp-outbound | 10 | 50/min | 5000 | Drop oldest |
| photo-upload | 5 | - | 10000 | Reject |
| payment-reconciliation | 3 | - | 500 | Reject |

## Implementation

```typescript
async function addJob(queueName: string, data: any, priority: number = 5): Promise<AddResult> {
  const config = QUEUE_CONFIGS[queueName];
  const currentSize = await queue.count();
  
  // Check overflow
  if (currentSize >= config.maxSize) {
    switch (config.overflowStrategy) {
      case 'reject':
        return { status: 'rejected', error: 'QUEUE_OVERFLOW' };
      case 'drop_oldest':
        await dropOldestLowPriority(queueName, 10);
        break;
      case 'priority_only':
        if (priority < 8) {
          return { status: 'rejected', error: 'LOW_PRIORITY_REJECTED' };
        }
        break;
    }
  }
  
  // Check rate limit
  if (config.rateLimit) {
    const allowed = await checkRateLimit(queueName, config.rateLimit);
    if (!allowed) {
      return { status: 'rate_limited', retryAfter: getRetryAfter(queueName) };
    }
  }
  
  // Add job
  const job = await queue.add(data, { priority });
  return { status: 'queued', jobId: job.id };
}
```

---

# SECTION 15: SECURITY & ENCRYPTION

## Encryption Strategy

| Data | At Rest | Key Rotation |
|------|---------|--------------|
| AFIP Certificates | AES-256-GCM | Manual (2yr cert life) |
| MP Access Tokens | AES-256-GCM | On refresh (~6h) |
| Customer PII | AES-256-GCM | Yearly |
| Passwords | bcrypt (cost 12) | N/A |

## Implementation

```typescript
class EncryptionService {
  async encrypt(data: string, purpose: string): Promise<EncryptedData> {
    const key = await getKey(purpose);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key.value, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    
    return {
      ciphertext: encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyId: key.id
    };
  }
  
  async decrypt(encrypted: EncryptedData): Promise<string> {
    const key = await getKeyById(encrypted.keyId);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key.value,
      Buffer.from(encrypted.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
    
    let decrypted = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
```

## Log Redaction

```typescript
const SENSITIVE_PATTERNS = [
  { pattern: /\b\d{2}-\d{8}-\d{1}\b/g, replacement: 'CUIT:[REDACTED]' },
  { pattern: /\b\d{10,11}\b/g, replacement: 'PHONE:[REDACTED]' },
  { pattern: /\b\d{22}\b/g, replacement: 'CBU:[REDACTED]' },
  { pattern: /Bearer\s+[A-Za-z0-9\-_]+/gi, replacement: 'Bearer [REDACTED]' }
];

const ALWAYS_REDACT = ['password', 'token', 'api_key', 'certificate', 'cuit', 'cbu'];

function redact(data: any): any {
  if (typeof data === 'string') {
    return SENSITIVE_PATTERNS.reduce((s, p) => s.replace(p.pattern, p.replacement), data);
  }
  if (typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        ALWAYS_REDACT.includes(k.toLowerCase()) ? '[REDACTED]' : redact(v)
      ])
    );
  }
  return data;
}
```

---

# SECTION 16: ABUSE PREVENTION

## Abuse Patterns

| Pattern | Threshold | Action |
|---------|-----------|--------|
| Message flood | 20/min | Rate limit |
| Spam content | Score > 0.8 | Flag for review |
| URL spam | > 2 URLs | Block |
| New number flood | 5 msgs in 5 min | Block |
| Duplicate messages | > 3 same | Rate limit |
| Known bad actor | Blacklisted | Block |

## Implementation

```typescript
const ABUSE_PATTERNS = [
  {
    type: 'message_flood',
    check: async (event) => {
      const count = await getMessageCount(event.sender, 60);
      return { triggered: count > 20, score: count / 20 };
    },
    action: 'rate_limit'
  },
  {
    type: 'url_spam',
    check: (event) => {
      const urlCount = (event.content.match(/https?:\/\//g) || []).length;
      return { triggered: urlCount > 2, score: urlCount / 2 };
    },
    action: 'block'
  },
  {
    type: 'known_bad_actor',
    check: async (event) => ({ triggered: await isBlacklisted(event.sender), score: 1 }),
    action: 'block'
  }
];

async function checkAbuse(event: IncomingEvent): Promise<AbuseResult> {
  let maxScore = 0;
  let action = 'allow';
  
  for (const pattern of ABUSE_PATTERNS) {
    const result = await pattern.check(event);
    if (result.triggered && result.score > maxScore) {
      maxScore = result.score;
      action = pattern.action;
    }
  }
  
  if (action !== 'allow') {
    await logAbuseAttempt(event, action);
  }
  
  return { allowed: action === 'allow', action, score: maxScore };
}
```

## Rate Limiting

```typescript
async function checkRateLimit(orgId: string, sender: string, type: string): Promise<boolean> {
  const limits = {
    message: { max: 10, window: 60 },
    voice: { max: 5, window: 3600 },
    job: { max: 50, window: 86400 }
  };
  
  const config = limits[type];
  const key = `ratelimit:${orgId}:${sender}:${type}`;
  
  // Sliding window with Redis sorted set
  const now = Date.now();
  await redis.zremrangebyscore(key, 0, now - config.window * 1000);
  const count = await redis.zcard(key);
  
  if (count >= config.max) return false;
  
  await redis.zadd(key, now, `${now}-${Math.random()}`);
  await redis.expire(key, config.window);
  return true;
}
```

---

# TIMELINE (18 Weeks)

| Week | Focus | Deliverables |
|------|-------|--------------|
| -2 to 0 | Pre-dev | Voice samples, WA templates, AFIP certs |
| 1-2 | Foundation | Auth, CRM, Jobs, Simple UI |
| 3-5 | AFIP | CAE, draft fallback, queue, idempotency |
| 6-7 | Payments + WA | MP OAuth, webhooks, WA templates |
| 8-10 | Voice AI | Transcription, extraction, human review |
| 11-14 | Mobile | Offline, photos, signature, performance |
| 15 | Security | Encryption, audit, abuse prevention |
| 16-17 | Testing | E2E, panic mode, security audit |
| 18 | Launch | App stores, production deploy, pilots |

---

# SUCCESS METRICS

## Launch Day

| Metric | Target |
|--------|--------|
| Signup to first job | < 2 minutes |
| Voice AI accuracy | ≥ 70% |
| Cold start (Samsung A10) | < 4 seconds |
| Duplicate invoices | 0 |
| Security audit | Passed |

## Month 3

| Metric | Target |
|--------|--------|
| Paying customers | 50 |
| Monthly churn | < 10% |
| Gross margin | > 65% |
| Abuse incidents | < 5 |
| Data breaches | 0 |

---

# COST SUMMARY

## Per-User Monthly Cost: ~$6.40

| Category | Cost |
|----------|------|
| Voice AI (Whisper + GPT-4o) | $0.34 |
| WhatsApp | $3.60 |
| SMS (fallback) | $1.20 |
| AFIP SDK (amortized) | $1.00 |
| Infrastructure | $0.25 |

## Unit Economics

| Metric | Value |
|--------|-------|
| ARPU | $20 |
| Cost per user | $6.40 |
| Gross margin | 68% |
| LTV (24 months) | $326 |
| CAC | $30 |
| LTV:CAC | 10.9x |
| Payback | 2.2 months |

---

*Document Version: 7.0*
*Timeline: 18 weeks*
*Budget: ~$720/month at 100 users*
