---
tags:
  - page
  - app
  - crm
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/customers/new/page.tsx
---

# ➕ New Customer Page

> [!SUCCESS] **Purpose**
> Create new customer records with contact information, address, and optional CUIT for business clients.

---

## 🧩 Page Structure

### Form Fields
| Field | Type | Required |
|:---|:---|:---:|
| Name | Text | ✅ |
| Phone | International (with country code) | ✅ |
| Email | Email | ❌ |
| Address | Text with Google Autocomplete | ❌ |
| CUIT | Argentine tax ID (validated) | ❌ |
| Notes | Textarea | ❌ |

### Phone Input Features
- Country code dropdown with flags
- Supported countries: Argentina (+54), Brazil, Chile, Uruguay, Paraguay, Bolivia, Peru, Colombia, Mexico, USA/Canada
- "Other" option for custom country codes
- Phone number formatting per country

### Address Input
- Google Places Autocomplete integration
- Parses street, city, province, postal code
- Extracts coordinates for map display

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Country Dropdown | `Click` | Open country code list with flags |
| Address Input | `Type` | Google suggestions appear |
| Address Suggestion | `Click` | Auto-fill address fields |
| `Crear Cliente` | `Click` | Submit form, navigate to customer detail |
| `Cancelar` | `Click` | Navigate back to customers list |

---

## 🛠️ Technical Context

### Component Path
- **Page:** `apps/web/app/dashboard/customers/new/page.tsx` (445 lines)

### Key Features
- `FlagImage` component for country flags via flagcdn.com
- `formatPhoneNumber()` for country-specific formatting
- `handleAddressSelect()` parses Google Places result

### API Endpoints
| Endpoint | Method | Purpose |
|:---|:---|:---|
| `/api/customers` | POST | Create new customer |

---

## 🔗 Connections

- **Parent:** [[Customers Page]]
- **Related:** [[Jobs Page]] (Create job for new customer)

---

*Last updated: January 2026*
