# Job Completion Report (PDF) Architecture

**Created:** 2026-01-14
**Status:** Planning
**Related:** Client Data Folder, Invoice PDF, Vehicle Insurance Tracking

---

## Overview

The **Job Completion Report** is a PDF document generated when a job is completed. It serves as operational documentation separate from the invoice, containing:

- Work performed details
- Technician and vehicle information (snapshots)
- Photos and customer signature
- Time and mileage records

---

## Invoice vs. Job Report

| Aspect | Invoice | Job Completion Report |
|--------|---------|----------------------|
| **Purpose** | Financial/tax document | Operational documentation |
| **Legal requirement** | Yes (AFIP) | No |
| **Contains** | Prices, taxes, CAE | Work details, photos, signatures |
| **Format** | AFIP-compliant | Flexible |
| **When generated** | When billing | When job completes |
| **Recipient** | Customer (for payment) | Customer + internal records |

### Can Invoice Include Work Summary?
**Yes, optionally.** The invoice can have a "Descripción del trabajo" section with:
- Service type performed
- Brief resolution summary

**But it should NOT include:**
- Photos (too large for invoice)
- Detailed technician info (not billing-relevant)
- Vehicle/mileage data (operational detail)
- Signatures (has its own digital stamp via CAE)

**Recommendation:** Invoice references job report for full details.

---

## Job Completion Report Contents

### Header
```
┌─────────────────────────────────────────────────────────────────┐
│                    [ORGANIZATION LOGO]                           │
│                                                                  │
│               REPORTE DE TRABAJO COMPLETADO                      │
│               ────────────────────────────                       │
│                                                                  │
│  Trabajo #: JOB-2026-0001234                                    │
│  Fecha Completado: 14 de Enero, 2026 - 15:30 hs                 │
│  Estado: COMPLETADO ✓                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Section 1: Customer Information
```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENTE                                                         │
│  ─────────────────────────────────────────────────────────────  │
│  Nombre: Juan Pérez                                              │
│  Teléfono: +54 9 351 123-4567                                   │
│  Dirección del servicio: Av. Colón 1234, Córdoba, Argentina     │
└─────────────────────────────────────────────────────────────────┘
```

### Section 2: Service Details
```
┌─────────────────────────────────────────────────────────────────┐
│  SERVICIO REALIZADO                                              │
│  ─────────────────────────────────────────────────────────────  │
│  Tipo: Mantenimiento Preventivo                                  │
│  Descripción: Limpieza y carga de gas de aire acondicionado     │
│                                                                  │
│  Fecha programada: 14 de Enero, 2026                            │
│  Hora inicio: 14:00 hs                                           │
│  Hora fin: 15:30 hs                                              │
│  Duración: 1h 30min                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Section 3: Technician & Vehicle (Snapshot Data)
```
┌─────────────────────────────────────────────────────────────────┐
│  TÉCNICO Y VEHÍCULO                                              │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Técnico: Kevin Conta                                            │
│  Licencia de conducir: B-12345678 (Categoría B1)                │
│                                                                  │
│  Vehículo: Ford Ranger XLT                                       │
│  Patente: ABC-123                                                │
│  Kilometraje inicial: 45,230 km                                  │
│  Kilometraje final: 45,245 km                                    │
│  Distancia recorrida: 15 km                                      │
│                                                                  │
│  ⚠️ Datos capturados al momento de completar el trabajo         │
└─────────────────────────────────────────────────────────────────┘
```

### Section 4: Work Resolution
```
┌─────────────────────────────────────────────────────────────────┐
│  RESOLUCIÓN DEL TRABAJO                                          │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Se realizó limpieza completa del equipo de aire acondicionado  │
│  split. Se cargó gas R410a (500g). El equipo queda funcionando  │
│  correctamente. Se recomienda próximo mantenimiento en 6 meses. │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Section 5: Photos (if available)
```
┌─────────────────────────────────────────────────────────────────┐
│  EVIDENCIA FOTOGRÁFICA                                           │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │              │  │              │  │              │          │
│  │   [PHOTO 1]  │  │   [PHOTO 2]  │  │   [PHOTO 3]  │          │
│  │              │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│    Antes            Durante          Después                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Section 6: Customer Signature (if captured)
```
┌─────────────────────────────────────────────────────────────────┐
│  CONFORMIDAD DEL CLIENTE                                         │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Firma: [SIGNATURE IMAGE]                                        │
│  Fecha: 14/01/2026 15:30 hs                                     │
│                                                                  │
│  ✓ El cliente confirma recepción del servicio                   │
└─────────────────────────────────────────────────────────────────┘
```

### Footer
```
────────────────────────────────────────────────────────────────────
Documento generado por CampoTech
Registros para uso operativo interno - No constituye documentación certificada
Para reclamos de seguro, adjuntar documentación oficial adicional

Generado: 2026-01-14 15:45:00 (America/Argentina/Buenos_Aires)
Organización: TechnoClima SRL
ID Reporte: RPT-JOB-2026-0001234
────────────────────────────────────────────────────────────────────
```

---

## Generation Triggers

### Automatic Generation
```
Job marked COMPLETED
    → Job Completion Service runs
    → Snapshot data saved to database
    → PDF generation queued (optional)
    → Customer notification sent with download link (optional)
```

### On-Demand Generation
```
User clicks "Descargar Reporte" on job detail page
    → PDF generated from stored snapshot data
    → Download link returned
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/jobs/[id]/report` | GET | Generate/download job report PDF |
| `/api/jobs/[id]/report/send` | POST | Send report to customer via email |

---

## PDF Generation Stack

### Primary: PDFKit (Already in use)
- Used for invoice PDFs
- Works server-side
- Good for structured documents

### Fallback: Puppeteer (Already in use)
- HTML to PDF conversion
- Better for complex layouts with images
- Used for reports with photos

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `lib/reports/job-completion-report.ts` | PDF generation logic |
| `app/api/jobs/[id]/report/route.ts` | API endpoint |
| `components/jobs/JobReportButton.tsx` | UI component |

---

## Multi-Visit Jobs

For jobs with multiple visits:
- Each visit can have its own report
- OR generate combined report with all visits
- User chooses on download

```
Option: 
○ Reporte de visita individual (Visit #2 - 14 Ene 2026)
○ Reporte completo del trabajo (3 visitas)
```

---

## Vehicle Assignments Per Visit

With the new multi-vehicle assignment feature:
- Each visit can have multiple vehicles with different drivers
- Report should list ALL vehicle assignments for the visit

```
VEHÍCULOS UTILIZADOS
────────────────────
Vehículo 1: Ford Ranger (ABC-123)
  • Conductores: Kevin Conta (Lic: B-12345678)
  
Vehículo 2: Fiat Fiorino (DEF-456)
  • Conductores: María García (Lic: B-87654321), Juan López
```

---

## Storage

Reports can be:
1. **Generated on-demand** - Not stored, created when requested
2. **Cached for 24 hours** - Stored temporarily for repeat downloads
3. **Permanently stored** - Saved to Supabase Storage with job

**Recommendation:** Generate on-demand, cache for performance. Permanent storage only if customer requests archival.

---

## Implementation Phases

### Phase 1: Basic Report
- [ ] Create PDF template
- [ ] Include job details, technician, vehicle
- [ ] Add basic footer

### Phase 2: Photos & Signature
- [ ] Embed photos in PDF
- [ ] Include signature image
- [ ] Handle missing data gracefully

### Phase 3: Multi-Visit Support
- [ ] Generate per-visit reports
- [ ] Generate combined reports
- [ ] Add visit selector UI

### Phase 4: Email Delivery
- [ ] Queue report generation
- [ ] Send via email with download link
- [ ] Track delivery status

---

## Security

1. **Access Control**: Only org members can generate reports
2. **Audit Logging**: Log all report generations
3. **Signed URLs**: Download links expire after 1 hour
4. **No External Access**: Reports are not publicly accessible

---

## Notes

### Why Separate from Invoice?

1. **Legal compliance**: Invoice must follow AFIP format, report is flexible
2. **Different recipients**: Invoice goes to billing, report goes to contact
3. **Different timing**: Invoice may be delayed, report is immediate
4. **Different use**: Invoice = payment, Report = work documentation
5. **Size**: Photos make report too large for invoice attachment
