---
tags:
  - page
  - app
  - crm
  - arco
  - compliance
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/customers/[id]/folder/page.tsx
---

# 📁 Client Data Folder

> [!SUCCESS] **Purpose**
> Unified view of all customer data for export, insurance claims, audits, and ARCO compliance per Ley 25.326 (Argentina Data Protection Law).

---

## 🧩 Page Structure

### Location
`/dashboard/customers/[id]/folder` - New tab on customer detail page

### Summary Section
| Stat | Description |
|:---|:---|
| Total Jobs | All jobs for customer |
| Completed Jobs | Successfully completed |
| Total Invoiced | Sum of all invoices |
| Total Paid | Sum of payments received |
| Average Rating | Customer satisfaction |
| WhatsApp Messages | Conversation count |

### Tab Navigation
| Tab | Content |
|:---|:---|
| Jobs | Complete job history with snapshots |
| Invoices | All invoices with status |
| Payments | Payment history with methods |

### Per-Job Snapshot Data
Each job entry shows immutable snapshot data captured at completion:

| Field | Source |
|:---|:---|
| Technician Name | Snapshot at job time |
| Driver's License | `Job.driverLicenseAtJob` |
| Vehicle Plate | `Job.vehiclePlateAtJob` |
| Mileage Start/End | Trip distance |
| Photos | Before/after evidence |
| Customer Signature | Digital confirmation |
| Resolution | Work summary |

---

## 📥 Export Options

### Available Exports
| Type | Format | Use Case |
|:---|:---|:---|
| Complete Customer Report | PDF | ARCO requests, audits |
| Single Job Report | PDF | Insurance claims, warranty |
| WhatsApp History | TXT/PDF | Communication records |
| Raw Data | JSON | Technical/legal needs |

### Delivery Methods
1. **Instant Download** - Generate PDF immediately
2. **Email Delivery** - Queue for async processing
3. **ARCO Request** - Formal request with verification

---

## 🔐 ARCO Compliance

Implements Argentine Ley 25.326 data protection requirements:

### Request Types
| Type | Spanish | Description |
|:---|:---|:---|
| Access | Acceso | Obtain copy of data |
| Rectification | Rectificación | Correct incorrect data |
| Cancellation | Cancelación | Delete data |
| Opposition | Oposición | Object to data use |

### Public Request Flow
1. Customer visits `/data-request?org=xxx`
2. Fills out request form
3. Email verification (6-digit code)
4. Request logged in audit trail
5. Data compiled within 10 business days
6. Secure download link (48hr expiry)

---

## 🛠️ Technical Context

### Component Files
- **Folder Page:** `apps/web/app/dashboard/customers/[id]/folder/page.tsx`
- **Folder API:** `apps/web/app/api/customers/[id]/folder/route.ts`
- **Export API:** `apps/web/app/api/customers/[id]/folder/export/route.ts`

### Service Files
- **Customer Folder Service:** `lib/services/customer-folder.ts`
- **Customer Report PDF:** `lib/reports/customer-report.ts`
- **Async Export Queue:** `lib/services/async-export.ts`
- **ARCO Request Service:** `lib/services/data-access-request.ts`

### API Endpoints
| Endpoint | Method | Purpose |
|:---|:---|:---|
| `/api/customers/[id]/folder` | GET | Get folder summary |
| `/api/customers/[id]/folder/export` | POST | Generate full PDF |
| `/api/exports/queue` | POST | Queue async export |
| `/api/exports/[token]/download` | GET | Secure download |
| `/api/public/data-request` | POST | Public ARCO request |

---

## 🔗 Connections

- **Parent:** [[Customers Page]]
- **Related:**
  - [[Job Completion Report]] (Per-job PDF export)
  - [[Invoices Page]] (Invoice data source)
  - [[WhatsApp Page]] (Conversation history)

---

## 🔒 Security Considerations

1. **Access Control** - Only organization members can access customer data
2. **Audit Logging** - All exports logged with user, timestamp, scope
3. **Signed URLs** - Download links expire after 1 hour
4. **Rate Limiting** - Prevent bulk data scraping
5. **Data Minimization** - Export only requested data

---

*Last updated: January 2026*
