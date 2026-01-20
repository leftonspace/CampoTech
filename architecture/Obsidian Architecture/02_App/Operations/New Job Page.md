---
tags:
  - page
  - app
  - form
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/jobs/new/page.tsx
---

# ➕ New Job Page (Nuevo Trabajo)

> [!SUCCESS] **Purpose**
> Create a new work order with customer details, service information, scheduling, and technician assignment.

---

## 📸 Preview
![[new-job-form.png]]

---

## 🧩 Form Sections

### 1. Customer Selection
| Field | Type | Required |
|:---|:---|:---:|
| Cliente | Search/Autocomplete | ✓ |
| `+ Nuevo Cliente` | Button | - |

**Autocomplete Features:**
- Search by name, phone, CUIT
- Shows recent customers first
- Quick create inline option

---

### 2. Service Details
| Field | Type | Options/Notes |
|:---|:---|:---|
| Tipo de Servicio | Dropdown | From service catalog |
| Descripción | Textarea | Problem description |
| Urgencia | Radio | Baja, Normal, Alta, Urgente |
| Equipo | Select | Customer's registered equipment |

---

### 3. Pricing Mode (Per-Visit Pricing - Jan 2026)

> [!SUCCESS] **Implemented**
> 3-way pricing mode selector supporting fixed total, per-visit, and hybrid pricing.

| Mode | Label | Description |
|:---|:---|:---|
| `FIXED_TOTAL` | Precio cerrado | Single price for entire job (default) |
| `PER_VISIT` | Por visita | Each visit priced separately |
| `HYBRID` | Híbrido | Diagnóstico + recurring rate |

**Mode-Specific Fields:**

| Field | FIXED_TOTAL | PER_VISIT | HYBRID |
|:---|:---:|:---:|:---:|
| Total estimado | ✓ | - | - |
| Tarifa por defecto | - | ✓ | - |
| Tarifa recurrente | - | - | ✓ |
| Seña/Anticipo | ✓ | ✓ | ✓ |
| Per-visit price input | - | ✓ | ✓ |

**See:** [[Multi-Trade Pricing]] | [[Per-Visit Pricing]]

---

### 4. Scheduling
| Field | Type | Notes |
|:---|:---|:---|
| Fecha | Date Picker | Default: today |
| Hora Inicio | Time Select | 15-minute intervals |
| Hora Fin | Time Select | Auto-set from service duration |
| Duración Estimada | Display | From service type |

---

### 5. Assignment
| Field | Type | Notes |
|:---|:---|:---|
| Técnico | Dropdown | Filter by availability, skills |
| Vehículo | Dropdown | Optional, per-visit assignment |
| Notas Internas | Textarea | Team-only notes |
| Field | Type | Required |
|:---|:---|:---:|
| Usar dirección del cliente | Toggle | Default: on |
| Calle | Text | Conditional |
| Número | Text | Conditional |
| Piso/Depto | Text | Optional |
| Ciudad | Text | Conditional |
| Código Postal | Text | Conditional |
| Zona | Auto-detect | From geocoding |

---

### 6. Materials (Optional)
| Field | Type | Notes |
|:---|:---|:---|
| Agregar Material | Search | From inventory |
| Cantidad | Number | Per item |
| Subtotal | Display | Auto-calculated |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Cliente Autocomplete | `Type` | Search customers |
| `+ Nuevo Cliente` | `Click` | Open inline create or modal |
| Fecha | `Click` | Open date picker |
| Técnico Dropdown | `Change` | Show calendar availability hint |
| Agregar Material | `Click` | Add row to materials list |
| Cancelar | `Click` | Confirm → Navigate back |
| Guardar | `Click` | Validate → Create → Navigate to detail |

---

## ✅ Form Validation

### Required Fields
- Customer
- Service type
- Date
- Start time

### Business Rules
- Cannot schedule in the past
- Customer must have valid address
- Technician availability check (warning if busy)

---

## 🔄 After Submit

### On Success:
1. Job created with status `PENDING`
2. If technician assigned → status `ASSIGNED`
3. Redirect to [[Job Detail Page]]
4. Toast notification: "Trabajo creado"

### Notifications:
- Assigned technician receives WhatsApp/push
- Customer receives confirmation (optional)

---

## 🔐 Access Control

| Role | Can Create |
|:---|:---:|
| OWNER | ✓ |
| ADMIN | ✓ |
| TECHNICIAN | ✓ (own jobs) |

---

## 🛠️ Technical Context

- **Component Path:** `apps/web/app/dashboard/jobs/new/page.tsx`
- **Form Library:** React Hook Form
- **Validation:** Zod schema

### API Endpoint
```typescript
POST /api/jobs
{
  customerId: string;
  serviceType: string;
  description?: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  scheduledDate: string;
  scheduledTimeSlot: { start: string; end: string };
  technicianId?: string;
  address: { ... };
  materials?: { itemId: string; quantity: number }[];
  // Per-Visit Pricing (Jan 2026)
  pricingMode?: 'FIXED_TOTAL' | 'PER_VISIT' | 'HYBRID';
  defaultVisitRate?: number;
  estimatedTotal?: number;
  depositAmount?: number;
  visits?: Array<{
    date: string;
    technicianIds: string[];
    estimatedPrice?: number;  // Per-visit price
    requiresDeposit?: boolean;
    depositAmount?: number;
  }>;
}
```

---

## 🔗 Connections

- **Parent:** [[Jobs Page]]
- **Previous:** [[Dashboard Home]] (Quick Action)
- **Next:** [[Job Detail Page]]
- **Related:**
  - [[New Customer Page]] (Inline create)
  - [[Calendar Page]] (Alternative entry)
  - [[Inventory Page]] (Materials)
  - [[Per-Visit Pricing]] (Pricing modes)
  - [[Multi-Trade Pricing]] (Pricing system)

---

## 📝 Notes

- [ ] TODO: Job templates for quick creation
- [x] ~~TODO: Recurring job setup~~ ✅ Implemented
- [x] ~~TODO: Multi-day job support~~ ✅ Implemented
- [ ] TODO: File attachments (photos)
- [x] ~~Consider: Voice-to-text for description~~ ✅ Voice-to-Invoice implemented

---

*Last updated: January 16, 2026*

