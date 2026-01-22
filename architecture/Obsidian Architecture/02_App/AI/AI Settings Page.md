---
tags:
  - page
  - ai
  - settings
  - admin
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/settings/ai-assistant/page.tsx
---

# ⚙️ AI Settings Page

> [!SUCCESS] **Purpose**
> Configuration interface for the WhatsApp AI Copilot. Allows organization owners to customize AI behavior, knowledge base, and automation rules.

---

## 📍 Location

**Route:** `/dashboard/settings/ai-assistant`
**File:** `apps/web/app/dashboard/settings/ai-assistant/page.tsx` (71KB)

---

## 🧩 Settings Sections

### 1. Master Toggle
| Setting | Type | Default |
|:---|:---|:---|
| AI Enabled | Toggle | `false` |
| Auto-Response Enabled | Toggle | `true` |

### 2. Confidence Thresholds
| Setting | Type | Default | Description |
|:---|:---|:---|:---|
| Min Confidence to Respond | Slider | 70% | Below this, transfers to human |
| Min Confidence to Create Job | Slider | 85% | Auto-create jobs above this |

### 3. Company Information
| Field | Type |
|:---|:---|
| Company Name | Text |
| Company Description | Textarea |
| Services Offered | Multi-item list |
| Service Areas | Text |
| Pricing Info | Textarea |

### 4. Business Hours
| Day | Open Time | Close Time |
|:---|:---|:---|
| Monday-Friday | Configurable | Configurable |
| Saturday | Configurable | Configurable |
| Sunday | Configurable | Configurable |

### 5. AI Personality
| Setting | Options |
|:---|:---|
| Tone | Friendly Professional, Formal, Casual |
| Greeting Message | Custom text |
| Away Message | Custom text (outside hours) |

### 6. FAQ Management
Interactive list to add/edit/remove FAQ items:
- Question field
- Answer field
- Drag to reorder

### 7. Transfer Keywords
List of words that trigger immediate human handoff:
- "hablar con humano"
- "queja"
- "problema grave"

### 8. Escalation User
Dropdown to select which user receives escalated conversations.

### 9. Data Access Permissions
| Permission | Default |
|:---|:---|
| Company Info | ✅ |
| Services | ✅ |
| Pricing | ✅ |
| Business Hours | ✅ |
| Service Areas | ✅ |
| Technician Names | ❌ |
| Technician Availability | ✅ |
| Schedule Slots | ✅ |
| FAQ | ✅ |
| Policies | ✅ |

### 10. Workflow Permissions
| Permission | Default |
|:---|:---|
| Suggest Responses | ✅ |
| Translate Messages | ✅ |
| Suggest Actions | ✅ |
| Access Database | ✅ |
| Access Schedule | ✅ |
| Auto-Approve Small Price Adjustments | ❌ |
| Auto-Approve Threshold % | 5% |
| Auto-Assign Technicians | ❌ |

---

## 🔗 API Integration

### GET `/api/settings/ai-assistant`
Returns current `AIConfiguration` for organization.

### PUT `/api/settings/ai-assistant`
Updates `AIConfiguration` with partial data.

---

## 🛠️ Technical Context

| Aspect | Details |
|:---|:---|
| **Page File** | `app/dashboard/settings/ai-assistant/page.tsx` |
| **Size** | 71KB (comprehensive) |
| **State Management** | `ai-assistant-context.tsx` |
| **Database Model** | `AIConfiguration` |
| **Validation** | Client-side + Server-side |

---

## 🔐 Access Control

| Role | Access |
|:---|:---|
| OWNER | Full access |
| ADMIN | View only (configurable) |
| TECHNICIAN | No access |

---

## ⚠️ Important Notes

> [!WARNING] **Scope**
> These settings **ONLY affect the WhatsApp AI Copilot** (AI #3). They do not affect:
> - Public AI Chat (AI #1)
> - Staff Help AI (AI #2)

---

## 🔗 Connections

- **Parent:** [[Settings Page]]
- **Configures:** [[WhatsApp AI Copilot]]
- **Related:**
  - [[WhatsApp Page]]
  - [[AI Systems Overview]]

---

## 📝 Notes

- [x] All AIConfiguration fields editable
- [x] Real-time sync via context
- [x] Validation and error handling
- [ ] TODO: Import/export settings
- [ ] TODO: A/B testing for tone
- [ ] TODO: Analytics dashboard

---

*Last updated: January 2026*
