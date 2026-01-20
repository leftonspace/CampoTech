# CampoTech WhatsApp Platform - Technical Documentation

## For Meta BSP Partnership Application

**Version:** 1.0  
**Date:** January 2026  
**Status:** Draft (to be finalized when applying)

---

## 1. Company Overview

### About CampoTech
CampoTech is an Argentine SaaS platform connecting service professionals (plumbers, electricians, HVAC technicians, gas installers) with customers. Our WhatsApp AI integration allows professionals to:
- Receive leads via WhatsApp
- Auto-respond with AI to common inquiries
- Schedule appointments
- Send quotes and invoices

### Company Details
| Field | Value |
|-------|-------|
| Company Name | CampoTech S.A.S. |
| Country | Argentina |
| Founded | [YEAR] |
| Team Size | [NUMBER] |
| Technical Team | [NUMBER] |
| Website | https://campotech.com.ar |

---

## 2. Platform Statistics

*Update these values before submitting application*

| Metric | Value | Period |
|--------|-------|--------|
| Active Organizations | __ | Current |
| Organizations with WhatsApp AI | __ | Current |
| Monthly Messages (Inbound) | __ | Last 30 days |
| Monthly Messages (Outbound) | __ | Last 30 days |
| Template Messages Sent | __ | Last 30 days |
| Average Webhook Response Time | __ ms | Last 30 days |
| Platform Uptime | __% | Last 90 days |
| Message Delivery Success Rate | __% | Last 30 days |

---

## 3. Technical Architecture

### 3.1 Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAMPOTECH INFRASTRUCTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Vercel    │    │  Supabase   │    │   Redis     │    │   Meta      │  │
│  │  (Edge)     │◄──►│ (Postgres)  │    │  (Upstash)  │◄──►│  WhatsApp   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│        │                  │                  │                  │          │
│        ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                        BullMQ Message Queue                          │  │
│  │                     (Reliable message processing)                    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | Next.js 15 (React) | Web dashboard |
| Backend | Next.js API Routes | REST API |
| Database | PostgreSQL (Supabase) | Persistent storage |
| ORM | Prisma | Database access |
| Queue | BullMQ + Redis (Upstash) | Async job processing |
| AI | OpenAI GPT-4 | WhatsApp AI responses |
| Hosting | Vercel | Global edge deployment |
| Monitoring | Sentry | Error tracking |
| Analytics | PostHog | Product analytics |

### 3.3 WhatsApp Message Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WHATSAPP MESSAGE FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INBOUND:                                                                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │ Customer │───►│  Meta    │───►│  BSP     │───►│ CampoTech│             │
│  │ WhatsApp │    │ Platform │    │ (Twilio) │    │ Webhook  │             │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘             │
│                                         │              │                    │
│                                         │              ▼                    │
│                                         │        ┌──────────┐              │
│                                         │        │  AI      │              │
│                                         │        │ Process  │              │
│                                         │        └──────────┘              │
│                                         │              │                    │
│  OUTBOUND:                              │              ▼                    │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │ Customer │◄───│  Meta    │◄───│  BSP     │◄───│ CampoTech│             │
│  │ WhatsApp │    │ Platform │    │ (Twilio) │    │ Response │             │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘             │
│                                                                             │
│  Processing Time: < 200ms average                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Current BSP Integration

### 4.1 Supported BSP Providers

CampoTech currently supports multiple BSP providers:

| Provider | Status | Features |
|----------|--------|----------|
| Twilio | ✅ Active | Full Cloud API |
| 360dialog | ✅ Active | Cost-effective option |
| Meta Direct (Cloud API) | 🔄 In Progress | Direct integration |

### 4.2 Integration Capabilities

- **Webhook Processing:** Real-time message handling
- **Template Messages:** Pre-approved message templates
- **Media Support:** Images, documents, voice messages
- **Interactive Messages:** Buttons, lists, quick replies
- **Session Management:** 24-hour window tracking

### 4.3 API Implementation

```typescript
// Example webhook handler structure
// Location: apps/web/app/api/whatsapp/webhook/route.ts

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    
    // 1. Validate webhook signature
    if (!validateSignature(body, signature)) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // 2. Enqueue for async processing (< 100ms)
    await messageQueue.add('process-whatsapp', body);
    
    // 3. Return 200 immediately
    const processingTime = Date.now() - startTime;
    console.log(`Webhook processed in ${processingTime}ms`);
    
    return Response.json({ success: true });
    
  } catch (error) {
    // Log to Sentry for monitoring
    Sentry.captureException(error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

## 5. Reliability & Performance

### 5.1 Uptime SLA

| Component | Target SLA | Current Performance |
|-----------|------------|---------------------|
| API Endpoints | 99.9% | __% |
| Webhook Processing | 99.9% | __% |
| Message Delivery | 99.5% | __% |
| Dashboard Access | 99.9% | __% |

### 5.2 Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Webhook Response Time | < 500ms | __ ms |
| Message Processing Time | < 2s | __ ms |
| API Latency (p95) | < 200ms | __ ms |
| Database Query Time | < 50ms | __ ms |

### 5.3 Message Queue Reliability

```
┌─────────────────────────────────────────────────────────────────┐
│                    MESSAGE PROCESSING PIPELINE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. RECEIVE      2. QUEUE       3. PROCESS     4. DELIVER      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │ Webhook │───►│ BullMQ  │───►│ Worker  │───►│ BSP API │     │
│  │ Handler │    │ Redis   │    │ Process │    │ Outbound│     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│       │              │              │              │           │
│       ▼              ▼              ▼              ▼           │
│   Immediate      Persistent    Retry on       Confirmation    │
│   Response       Storage       Failure        Callback         │
│   (< 100ms)      (7 days)      (3 attempts)   (DLQ if fail)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Error Handling

- **Retry Logic:** Exponential backoff (3 attempts: 1s, 10s, 60s)
- **Dead Letter Queue:** Failed messages stored for manual review
- **Alerting:** Sentry + custom alerts for failures
- **Circuit Breaker:** Auto-disable on repeated failures

---

## 6. Security

### 6.1 Data Protection

| Measure | Implementation |
|---------|----------------|
| Encryption in Transit | TLS 1.3 for all connections |
| Encryption at Rest | AES-256 database encryption |
| API Authentication | JWT tokens with rotation |
| Webhook Validation | HMAC signature verification |
| Access Control | Role-based permissions (RBAC) |

### 6.2 Compliance

- [ ] GDPR compliant data handling
- [ ] Argentina Habeas Data Law compliance
- [ ] WhatsApp Business Policy adherence
- [ ] Regular security audits

### 6.3 Data Retention

| Data Type | Retention Period | Deletion Method |
|-----------|------------------|-----------------|
| Messages | 90 days | Automatic purge |
| Conversations | 1 year | Soft delete |
| User Data | Until account deletion | Hard delete on request |
| Logs | 30 days | Automatic rotation |

---

## 7. Use Cases

### 7.1 AI-Powered Customer Inquiry Handling

**Scenario:** Customer messages a service professional on WhatsApp at midnight.

**Flow:**
1. Customer: "Hola, tengo una pérdida de gas, ¿pueden venir?"
2. AI analyzes: Emergency detection → Gas leak → Urgent
3. AI responds: "¡Emergencia de gas detectada! Te paso con urgencias..."
4. AI creates: Lead record + notification to owner
5. Professional sees notification in morning, calls customer

**Metrics:**
- Response time: < 5 seconds
- AI accuracy: 85%+
- Lead capture rate: 90%+

### 7.2 Appointment Scheduling

**Scenario:** Customer wants to schedule a service visit.

**Flow:**
1. Customer: "Quiero agendar una visita para revisar el aire"
2. AI checks: Available slots for this professional
3. AI offers: "Tengo disponible martes 10am o jueves 3pm"
4. Customer: "Martes está bien"
5. AI confirms: Creates job, sends confirmation, updates calendar

### 7.3 Quote Generation

**Scenario:** Customer asks for a price estimate.

**Flow:**
1. Customer: "¿Cuánto cuesta instalar un split de 3000 frigorías?"
2. AI retrieves: Price list for this professional
3. AI responds: "La instalación tiene un costo de $45,000 + materiales"
4. Customer: "Ok, agendemos"
5. AI: Proceeds to scheduling flow

---

## 8. Client Success Metrics

### Organization Adoption

| Metric | Value |
|--------|-------|
| Organizations using WhatsApp AI | __ |
| Average messages per org per month | __ |
| AI resolution rate (no human needed) | __% |
| Customer satisfaction (CSAT) | __% |

### Business Impact

| Metric | Before AI | After AI | Improvement |
|--------|-----------|----------|-------------|
| Response Time | 4 hours | < 5 sec | 99%+ |
| Lead Capture Rate | __% | __% | __% |
| After-hours Inquiries Handled | 0% | 100% | ∞ |

---

## 9. Scalability

### Current Capacity
- Messages per second: __
- Concurrent conversations: __
- Storage capacity: __ GB

### Growth Handling
- Horizontal scaling via Vercel Edge
- Redis cluster for queue scaling
- Database read replicas ready
- CDN for media storage

---

## 10. Support & Monitoring

### 10.1 Monitoring Stack

| Tool | Purpose |
|------|---------|
| Sentry | Error tracking & alerting |
| Vercel Analytics | Performance monitoring |
| PostHog | User behavior analytics |
| Custom Dashboards | Business metrics |

### 10.2 Alerting

| Alert Type | Channel | Response Time |
|------------|---------|---------------|
| Critical (downtime) | SMS + Slack | < 15 min |
| Error spike | Slack | < 1 hour |
| Performance degradation | Email | < 4 hours |
| Business anomaly | Dashboard | Next business day |

### 10.3 Support SLA

| Severity | Description | Response Time |
|----------|-------------|---------------|
| P1 | Complete outage | 15 minutes |
| P2 | Major feature broken | 1 hour |
| P3 | Minor issue | 4 hours |
| P4 | Enhancement request | 24 hours |

---

## 11. Roadmap

### Planned Enhancements
- [ ] Voice message transcription
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Custom AI training per organization
- [ ] WhatsApp Flows integration

### Direct BSP Migration Plan
1. Apply for BSP status
2. Set up direct Meta API integration
3. Migrate organizations in batches
4. Maintain Twilio as fallback
5. Full cutover after validation

---

## 12. Contact Information

| Role | Name | Contact |
|------|------|---------|
| CEO | [Name] | [email] |
| CTO | [Name] | [email] |
| Technical Lead | [Name] | [email] |
| Support | Support Team | soporte@campotech.com.ar |

---

*This document is confidential and intended for Meta BSP Partnership application purposes.*
