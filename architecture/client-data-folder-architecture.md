# Client Data Folder Architecture

**Created:** 2026-01-14  
**Updated:** 2026-01-16  
**Status:** ✅ IMPLEMENTED  
**Related:** Job Completion Reports (✅ COMPLETE), Insurance Documentation, ARCO Compliance

---

## Overview

This document defines the "Client Data Folder" feature - a unified view of all data related to a customer (client of our user's organization). This enables:

1. **Easy access** to all customer-related information in one place
2. **Data export** for insurance claims, audits, or customer requests
3. **ARCO compliance** (Ley 25.326) for data access requests
4. **Professional documentation** for customers and service records

---

## Data Included in Customer Folder

### Core Information
| Data Type | Source | Description |
|-----------|--------|-------------|
| Customer Profile | `Customer` table | Name, contact info, addresses |
| Job History | `Job` table | All jobs for this customer |
| Visit Details | `JobVisit` table | Individual visits within jobs |
| Invoices | `Invoice` table | All invoices issued |
| Payments | `Payment` table | Payment history |
| Ratings | `CustomerRating` table | Ratings received |
| WhatsApp History | `WhatsAppMessage` table | Conversation logs |

### Per-Job Details (Snapshot Data)
| Data Type | Source | Description |
|-----------|--------|-------------|
| Technician Assigned | `Job.technician` + snapshot | Who performed the work |
| Vehicle Used | `Job.vehicle` + snapshot | Which vehicle was used |
| Driver's License | `Job.driverLicenseAtJob` | License at time of job |
| Mileage | `Job.vehicleMileageStart/End` | Trip distance |
| Photos | `Job.photos` | Before/after photos |
| Customer Signature | `Job.customerSignature` | Digital signature if captured |
| Completion Notes | `Job.resolution` | Work summary |

---

## UI Design

### Location
`/dashboard/customers/[id]` → Add new "Carpeta de Datos" tab

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Cliente: Juan Pérez                              [📥 Exportar] │
├─────────────────────────────────────────────────────────────────┤
│  [Información] [Trabajos] [Facturas] [📁 Carpeta de Datos]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 Resumen                                                      │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │ Total Jobs   │ Completados  │ Facturado    │ Rating Prom  │  │
│  │     15       │     12       │ $45,000      │    ⭐ 4.8    │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
│                                                                  │
│  📋 Historial Completo                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 📅 2026-01-10 | Mantenimiento AC | COMPLETADO             │  │
│  │    Técnico: Kevin Conta                                    │  │
│  │    Vehículo: Ford Ranger (ABC-123)                        │  │
│  │    Kilometraje: 45,230 → 45,245 (15 km)                   │  │
│  │    📸 3 fotos | ✍️ Firmado                                 │  │
│  │    [Ver Detalles] [Descargar Reporte]                     │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ 📅 2025-12-15 | Instalación Split | COMPLETADO            │  │
│  │    Técnico: María García                                   │  │
│  │    Vehículo: Fiat Fiorino (DEF-456)                       │  │
│  │    📸 5 fotos | ✍️ Firmado                                 │  │
│  │    [Ver Detalles] [Descargar Reporte]                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  📄 Documentos Disponibles                                       │
│  • Reporte completo de servicios (PDF)                          │
│  • Historial de facturas (PDF)                                   │
│  • Conversaciones WhatsApp (exportable)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Export Options

### 1. Complete Customer Report (PDF)
Contains all data for the customer in a single document.

**Use cases:**
- Customer requests their data (ARCO)
- Insurance documentation
- Audit compliance

**Contents:**
- Customer information
- Complete job history with snapshots
- Invoice summary
- Payment history

### 2. Single Job Report (PDF)
Detailed report for one specific job.

**Use cases:**
- Insurance claim for specific incident
- Work documentation for warranty
- Customer receipt

**Contents:**
- Job details (date, time, location)
- Technician info (name, license snapshot)
- Vehicle info (plate, mileage snapshot)
- Work description and resolution
- Photos (if attached)
- Customer signature (if captured)

### 3. WhatsApp Export (TXT/PDF)
Conversation history with timestamps.

### 4. Raw Data Export (JSON)
For technical/legal needs - all data in machine-readable format.

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/customers/[id]/folder` | GET | Get customer folder summary |
| `/api/customers/[id]/folder/jobs` | GET | List all jobs with snapshots |
| `/api/customers/[id]/folder/export` | POST | Generate full PDF report |
| `/api/customers/[id]/folder/export/[jobId]` | POST | Generate single job PDF |
| `/api/customers/[id]/folder/whatsapp` | GET | Get WhatsApp history |

---

## Export Request Flow

### Option A: Instant Download
For smaller datasets, generate PDF immediately and return download URL.

```
User clicks [Exportar] 
    → API generates PDF 
    → Returns signed URL 
    → Browser downloads
```

### Option B: Email Delivery
For larger datasets or scheduled reports.

```
User clicks [Enviar por Email]
    → Job queued 
    → PDF generated async
    → Email sent with attachment or download link
```

### Option C: Data Request (ARCO Compliance)
Formal request with verification.

```
Customer requests data via form
    → Verification (email/phone confirmation)
    → Request logged in audit trail
    → Data compiled within 10 business days
    → Secure download link sent
```

---

## PDF Footer (All Exports)

```
────────────────────────────────────────────────────────────
Documento generado por CampoTech
Registros para uso operativo interno - No constituye documentación certificada
Para reclamos de seguro, adjuntar documentación oficial adicional

Generado: 2026-01-14 08:15:00 (America/Argentina/Buenos_Aires)
Organización: TechnoClima SRL (CUIT: 30-12345678-9)
ID Documento: doc_abc123xyz
────────────────────────────────────────────────────────────
```

---

## Implementation Phases

### ✅ Phase 1: Read-Only Folder View - COMPLETE
- [x] Create folder tab in customer detail page
- [x] Display job history with snapshot data
- [x] Show summary statistics

### ✅ Phase 2: Single Job PDF Export - COMPLETE (via Phase 2 Job Completion Report)
- [x] Create job report template
- [x] Generate PDF with snapshot data
- [x] Include photos if available
- [x] Add disclaimer footer

### ✅ Phase 3: Full Customer Export - COMPLETE
- [x] Create comprehensive report template
- [x] Compile all jobs, invoices, payments
- [x] Queue large exports for async processing (`lib/services/async-export.ts`)
- [x] Email delivery option (modal in folder page, `/api/exports/queue`)

### ✅ Phase 4: ARCO Request Handling - COMPLETE
- [x] Customer-facing request form (`/data-request?org=xxx`)
- [x] Verification flow (email verification with 6-digit code)
- [x] Audit logging (`DataRequestAuditLog` model)
- [x] Secure delivery (token-based download links, 48hr expiry)

---

## Files Created (2026-01-16)

| File | Purpose | Status |
|------|---------|--------|
| `app/dashboard/customers/[id]/folder/page.tsx` | Folder tab UI with tabs for jobs/invoices/payments | ✅ Created |
| `app/api/customers/[id]/folder/route.ts` | Folder data API | ✅ Created |
| `app/api/customers/[id]/folder/export/route.ts` | PDF export endpoint | ✅ Created |
| `lib/services/customer-folder.ts` | Business logic for unified data access | ✅ Created |
| `lib/reports/customer-report.ts` | PDF generation for complete customer folder | ✅ Created |
| `lib/reports/job-completion-report.ts` | Single job PDF (existing from Phase 2) | ✅ Existing |
| `lib/services/async-export.ts` | Async export queue with email delivery (Phase 3.4) | ✅ Created |
| `app/api/exports/queue/route.ts` | Queue export API endpoint (Phase 3.4) | ✅ Created |
| `app/api/exports/[token]/download/route.ts` | Secure download endpoint (Phase 3.4) | ✅ Created |
| `lib/services/data-access-request.ts` | ARCO data request service (Phase 4) | ✅ Created |
| `app/api/public/data-request/route.ts` | Public ARCO request API (Phase 4) | ✅ Created |
| `app/data-request/page.tsx` | Customer-facing ARCO request form (Phase 4) | ✅ Created |

---

## Security Considerations

1. **Access Control**: Only organization members can access customer data
2. **Audit Logging**: All exports are logged with user, timestamp, and scope
3. **Signed URLs**: Download links expire after 1 hour
4. **Rate Limiting**: Prevent bulk scraping of customer data
5. **Data Minimization**: Export only requested data, not entire database

---

## Notes

### Invoice vs. Job Report
- **Invoice**: Financial document with CAE, totals, tax info (AFIP requirement)
- **Job Report**: Operational document with work details, photos, signatures

**They are separate documents** because:
1. Invoice has legal requirements (AFIP format)
2. Job may have multiple visits but one invoice
3. Job report includes data not relevant to billing (mileage, photos)

**However**: Invoice can include a work summary section if desired, but it should reference the full job report for detailed operational data.
