---
tags:
  - index
  - moc
  - navigation
status: 🟢 Active
type: Index
---

# 🗂️ CampoTech Architecture Index

> [!INFO] **Welcome to the CampoTech Documentation Hub**
> This is the main entry point for understanding the CampoTech application architecture. Use the links below to navigate to specific pages, components, and flows.

---

## 📖 Getting Started

| Document | Description |
|:---|:---|
| [[Page Structure Reference]] | Standard patterns for page documentation |
| [[Sitemap.canvas]] | Visual map of application flow |

---

## 🌐 Public Pages

These pages are accessible without authentication.

| Page | Status | Description |
|:---|:---:|:---|
| [[Landing Page]] | 🟢 | Main marketing entry point |
| [[Login Flow]] | 🟢 | Passwordless authentication |
| [[Signup Flow]] | 🟡 | Account creation |
| [[Legal Compliance]] | 🔴 | Argentine legal requirements |
| [[Company Pages]] | 🟡 | Blog, About Us |
| [[Product Strategy]] | 🟡 | Integrations, API docs |

---

## 📊 Dashboard Pages

Core application pages accessible after login.

### Primary Navigation (Sidebar)

| Page | Route | Status | Description |
|:---|:---|:---:|:---|
| [[Dashboard Home]] | `/dashboard` | 🟢 | Main cockpit view |
| [[Map View]] | `/dashboard/map` | 🟡 | Real-time technician map |
| [[Calendar Page]] | `/dashboard/calendar` | 🟡 | Job scheduling |
| [[Jobs Page]] | `/dashboard/jobs` | 🟢 | Work order management |
| [[Customers Page]] | `/dashboard/customers` | 🟢 | Client management |
| [[Team Page]] | `/dashboard/team` | 🟢 | Technician management |
| [[Fleet Page]] | `/dashboard/fleet` | 🟡 | Vehicle management |
| [[Inventory Page]] | `/dashboard/inventory` | 🟢 | Parts & materials |
| [[Invoices Page]] | `/dashboard/invoices` | 🟢 | Billing & AFIP |
| [[Payments Page]] | `/dashboard/payments` | 🟢 | Payment tracking |
| [[Analytics Page]] | `/dashboard/analytics` | 🟡 | Business intelligence |
| [[Locations Page]] | `/dashboard/locations` | 🟡 | Service zones |
| [[WhatsApp Page]] | `/dashboard/whatsapp` | 🟢 | AI messaging |

### Secondary Pages

| Page | Route | Status | Description |
|:---|:---|:---:|:---|
| [[Settings Page]] | `/dashboard/settings` | 🟢 | Organization config |
| [[Profile Page]] | `/dashboard/profile` | 🟢 | Personal settings |
| [[New Job Page]] | `/dashboard/jobs/new` | 🟢 | Create work order |
| [[Verification Flow]] | `/dashboard/verificacion` | 🟡 | Identity verification |

### 🛡️ Platform Admin (Restricted)

> These pages are only accessible to CampoTech platform administrators.

| Page | Route | Status | Description |
|:---|:---|:---:|:---|
| [[Growth Engine]] | `/dashboard/admin/growth-engine` | 🟢 | Professional acquisition system |

---


## 🔄 User Flows

Multi-step processes and journeys.

| Flow | Status | Description |
|:---|:---:|:---|
| [[Signup Flow]] | 🟡 | Account creation journey |
| [[Login Flow]] | 🟢 | Authentication process |
| [[Verification Flow]] | 🟡 | Identity/CUIT verification |
| [[Subscription Flow]] | 🔴 | Payment & upgrade |
| [[Trial Lifecycle]] | 🟡 | Trial period management |
| [[App Onboarding]] | 🟡 | Feature education |
| [[Profile Claim Flow]] | 🟢 | Professional claims scraped profile |

---

## 🧩 Components

Reusable UI components documented.

### Dashboard Components
| Component | Status | Description |
|:---|:---:|:---|
| [[Sidebar Navigation]] | 🟢 | Main nav sidebar |
| [[User Menu]] | 🟢 | Top-right user dropdown |
| [[Stats Cards]] | 🟢 | KPI display cards |
| [[Quick Actions]] | 🟢 | Dashboard shortcuts |
| [[Team Status Widget]] | 🟢 | Technician status |
| [[Onboarding Checklist]] | 🟢 | Setup progress |

### System Components
| Component | Status | Description |
|:---|:---:|:---|
| [[Trial Banner]] | 🟢 | Trial status notification |
| [[Tier Upgrade Modal]] | 🟢 | Feature unlock prompt |

---

## 🎨 Status Legend

| Emoji | Meaning | Next Steps |
|:---:|:---|:---|
| 🟢 | Functional | May need refinement |
| 🟡 | In Progress | Actively developing |
| 🔴 | Missing/Blocked | Needs implementation |
| ⚪ | Planned | Designed, not started |

---

## 📁 Directory Structure

```text
architecture/Obsidian Architecture/
├── 📄 README.md (This file)
├── 📊 Sitemap.canvas
├── 📁 00_Flows/           # User Journeys (e.g., Signup, Checkout)
├── 📁 01_Website/         # Public Marketing & Legal Pages
├── 📁 02_App/             # The Authenticated Web Application
│   ├── Core/           # General Dashboard Pages
│   ├── CRM/            # Customer & Lead Management
│   ├── Operations/     # Jobs, Fleet, Inventory
│   ├── Admin/          # Admin & Settings
│   └── Communication/  # WhatsApp, Voice, Support
├── 📁 03_Auth/            # Authentication Pages
└── 📁 Components/         # Reusable UI Patterns
```

---

## 🔍 Quick Find

### By Feature Area
- **Jobs & Scheduling:** [[Jobs Page]], [[Calendar Page]], [[New Job Page]]
- **Customer Management:** [[Customers Page]], [[WhatsApp Page]]
- **Finance:** [[Invoices Page]], [[Payments Page]], [[Analytics Page]]
- **Team & Fleet:** [[Team Page]], [[Fleet Page]], [[Map View]]
- **Configuration:** [[Settings Page]], [[Profile Page]]
- **Platform Admin:** [[Growth Engine]]

### By User Role
- **Platform Admin:** [[Growth Engine]] (CampoTech staff only)
- **Owner:** All pages + [[Subscription Flow]], [[Verification Flow]]
- **Admin:** Most pages except billing
- **Technician:** [[Jobs Page]], [[Profile Page]]


---

## 📝 Contributing

When adding new documentation:
1. Follow [[Page Structure Reference]] guidelines
2. Use proper frontmatter with tags and status
3. Link to parent and child pages
4. Update this index
5. Add to [[Sitemap.canvas]] if major page

---

*Last updated: January 2026*
