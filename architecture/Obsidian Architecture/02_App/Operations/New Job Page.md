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

### 3. Scheduling
| Field | Type | Notes |
|:---|:---|:---|
| Fecha | Date Picker | Default: today |
| Hora Inicio | Time Select | 15-minute intervals |
| Hora Fin | Time Select | Auto-set from service duration |
| Duración Estimada | Display | From service type |

---

### 4. Assignment
| Field | Type | Notes |
|:---|:---|:---|
| Técnico | Dropdown | Filter by availability, skills |
| Vehículo | Dropdown | Optional |
| Notas Internas | Textarea | Team-only notes |

---

### 5. Address
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

---

## 📝 Notes

- [ ] TODO: Job templates for quick creation
- [ ] TODO: Recurring job setup
- [ ] TODO: Multi-day job support
- [ ] TODO: File attachments (photos)
- [ ] Consider: Voice-to-text for description
