---
tags:
  - component
  - onboarding
  - verification
status: 🟢 Functional
type: Component
path: apps/web/components/dashboard/OnboardingChecklist.tsx
---

# ✅ Onboarding Checklist

> [!SUCCESS] **Purpose**
> The onboarding checklist guides new users through the essential setup steps to fully unlock CampoTech features. It displays prominently on the dashboard until all required steps are completed.

---

## 📸 Preview
![[onboarding-checklist.png]]

---

## 🧩 Checklist Items

### Verification Steps (in order)

| Step | Status | Description | Required? |
|:---|:---:|:---|:---:|
| 1. Crear cuenta | ✅ | Account created via signup | Yes |
| 2. Verificar email | ✅ | Email confirmation link clicked | Yes |
| 3. Verificar CUIT | ⭕ | AFIP CUIT validation | Yes |
| 4. Subir DNI (frente) | ⭕ | Upload ID front photo | Yes |
| 5. Subir DNI (dorso) | ⭕ | Upload ID back photo | Yes |
| 6. Selfie con DNI | ⭕ | Identity verification photo | Yes |
| 7. Primer trabajo creado | ⭕ | Create first work order | Optional |

### Status Indicators
| Icon | Meaning |
|:---:|:---|
| ✅ (Green check) | Step completed |
| ⭕ (Empty circle) | Step pending |
| 🔵 (Blue dot) | Current step (active) |

---

## 🎨 Visual Design

### Container
```tsx
className="bg-white rounded-xl border shadow-sm p-4"
```

### Progress Bar
- Shows completion percentage (e.g., "33% completado")
- Green gradient fill based on progress

### Warning Banner
```tsx
className="bg-yellow-50 border-l-4 border-yellow-400 p-4"
// Shows blocked features when verification incomplete
```

**Blocked Features Message:**
> ⚠️ Funciones bloqueadas:
> - Recibir trabajos del marketplace

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Verificar CUIT | `Click` | Navigate → [[CUIT Verification]] |
| Subir DNI (frente) | `Click` | Open document upload → [[Document Upload]] |
| Subir DNI (dorso) | `Click` | Open document upload |
| Selfie con DNI | `Click` | Open camera/upload |
| Primer trabajo creado | `Click` | Navigate → [[New Job Page]] |
| "Continuar: Verificar CUIT →" | `Click` | Navigate to current pending step |

---

## 📊 Progress Calculation

```typescript
const completedSteps = steps.filter(s => s.completed).length;
const totalSteps = steps.filter(s => s.required).length;
const progress = Math.round((completedSteps / totalSteps) * 100);
```

---

## 🔒 Feature Gating

When verification is incomplete:
- **Blocked:** Marketplace job reception
- **Blocked:** Premium features access
- **Allowed:** Basic job creation, customer management

---

## 🛠️ Technical Context

- **Component Path:** `apps/web/components/dashboard/OnboardingChecklist.tsx`
- **Hook:** `useOnboardingStatus()` from `@/hooks/useOnboardingStatus`
- **API Endpoint:** `GET /api/organization/verification-status`

### Data Structure
```typescript
interface OnboardingStep {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  action: string | (() => void);
}
```

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[CUIT Verification]]
  - [[Document Upload]]
  - [[New Job Page]]
- **Related:**
  - [[Verification Flow]]
  - [[Access Banner]]
  - [[Feature Gating]]

---

## 📝 Notes

- [ ] TODO: Add progress persistence across sessions
- [ ] TODO: Implement document review status (pending/approved/rejected)
- [ ] Consider: Email reminders for incomplete verification
- [ ] Consider: Skip option for optional steps
