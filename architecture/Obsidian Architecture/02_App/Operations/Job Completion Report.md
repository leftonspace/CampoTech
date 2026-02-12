---
tags:
  - page
  - app
  - operations
  - pdf
  - reports
status: 🟢 Functional
type: Feature
path: apps/web/lib/reports/job-completion-report.ts
---

# 📄 Job Completion Report

> [!SUCCESS] **Purpose**
> PDF documentation for completed jobs, separate from invoices. Contains work details, technician/vehicle snapshots, photos, and customer signatures for operational records and insurance claims.

---

## Invoice vs. Job Report

| Aspect | Invoice | Job Completion Report |
|:---|:---|:---|
| **Purpose** | Financial/tax document | Operational documentation |
| **Legal Requirement** | Yes (AFIP) | No |
| **Contains** | Prices, taxes, CAE | Work details, photos, signatures |
| **Format** | AFIP-compliant | Flexible |
| **When Generated** | When billing | When job completes |
| **Size** | Compact | May include photos |

---

## 🧩 Report Contents

### Header Section
- Organization logo
- Report title: "REPORTE DE TRABAJO COMPLETADO"
- Job number (e.g., JOB-2026-0001234)
- Completion date and status

### Section 1: Customer Information
- Customer name, phone, service address

### Section 2: Service Details
- Service type, description, scheduled date/time, duration

### Section 3: Technician & Vehicle (Snapshot Data)
| Field | Description |
|:---|:---|
| Technician Name | Captured at job time |
| Driver's License | License number and category |
| Vehicle | Make, model, plate |
| Mileage Start/End | Trip distance calculation |

> ⚠️ Data captured at moment of job completion - immutable snapshot

### Section 4: Work Resolution
- Detailed work summary and recommendations

### Section 5: Photos (if available)
- Before/During/After photos in grid layout

### Section 6: Customer Signature
- Digital signature image with timestamp

---

## 🔄 Multi-Visit Jobs

| Option | Description |
|:---|:---|
| Per-Visit Report | Individual report for specific visit |
| Combined Report | All visits in single document |

---

## 💵 Per-Visit Pricing Breakdown (Jan 2026)

> [!SUCCESS] **Implemented**
> When a job uses `PER_VISIT` or `HYBRID` pricing mode, the report includes a detailed pricing breakdown table.

### Pricing Table Columns

| Column | Description |
|:---|:---|
| Visita | Visit number (HYBRID: "(Diagnóstico)" for first) |
| Fecha | Scheduled date |
| Estado | Status badge (Programada, Completada, etc.) |
| Estimado | ADMIN-set price |
| Real | Technician-reported actual price |
| Variación | Percentage variance with color coding |

### Variance Color Coding

| Variance | Class | Display |
|:---|:---|:---|
| > 10% | `variance-high` | Red, requires justification |
| > 0% | `variance-up` | Amber, allowed |
| < 0% | `variance-down` | Green, reduction |

### Totals Footer

- **Total Estimated:** Sum of all visit estimated prices
- **Total Actual:** Sum of all visit actual prices (if completed)

### Example HTML Output

```html
<div class="section">
  <div class="section-title">💵 Desglose de Precios por Visita</div>
  <table class="visits-pricing-table">
    <thead>
      <tr>
        <th>Visita</th>
        <th>Fecha</th>
        <th>Estado</th>
        <th>Estimado</th>
        <th>Real</th>
        <th>Variación</th>
      </tr>
    </thead>
    <!-- Visit rows with pricing data -->
  </table>
</div>
```

**See:** [[Per-Visit Pricing]] | [[Multi-Trade Pricing]]

---

## 🛠️ Technical Context

### Component Files
- **Report Generator:** `apps/web/lib/reports/job-completion-report.ts`
- **Report API:** `apps/web/app/api/jobs/[id]/report/route.ts`

### PDF Generation Stack
| Technology | Use Case |
|:---|:---|
| PDFKit | Structured documents (primary) |
| Puppeteer | Complex layouts with images (fallback) |

---

## 🔗 Connections

- **Parent:** [[Jobs Page]]
- **Related:**
  - [[Client Data Folder]] (Includes job reports)
  - [[Invoices Page]] (Financial counterpart)
  - [[Fleet Page]] (Vehicle snapshot source)
  - [[Per-Visit Pricing]] (Pricing breakdown section)
  - [[Multi-Trade Pricing]] (Pricing system)

---

*Last updated: January 16, 2026*

