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
| [[Map View]] | `/dashboard/map` | � | Real-time technician map |
| [[Calendar Page]] | `/dashboard/calendar` | � | Job scheduling |
| [[Jobs Page]] | `/dashboard/jobs` | 🟢 | Work order management |
| [[Customers Page]] | `/dashboard/customers` | 🟢 | Client management |
| [[Team Page]] | `/dashboard/team` | 🟢 | Technician management |
| [[Fleet Page]] | `/dashboard/fleet` | � | Vehicle management |
| [[Inventory Page]] | `/dashboard/inventory` | 🟢 | Parts & materials |
| [[Invoices Page]] | `/dashboard/invoices` | 🟢 | Billing & AFIP |
| [[Payments Page]] | `/dashboard/payments` | 🟢 | Payment tracking |
| [[Analytics Page]] | `/dashboard/analytics` | � | Business intelligence |
| [[Locations Page]] | `/dashboard/locations` | � | Service zones |
| [[WhatsApp Page]] | `/dashboard/whatsapp` | 🟢 | AI messaging |

### Secondary Pages

| Page | Route | Status | Description |
|:---|:---|:---:|:---|
| [[Settings Page]] | `/dashboard/settings` | 🟢 | Organization config |
| [[Profile Page]] | `/dashboard/profile` | 🟢 | Personal settings |
| [[New Job Page]] | `/dashboard/jobs/new` | 🟢 | Create work order |
| [[Verification Flow]] | `/dashboard/verificacion` | 🟡 | Identity verification |
| [[Client Data Folder]] | `/dashboard/customers/[id]/folder` | 🟢 | Customer data export & ARCO |
| [[Job Completion Report]] | (Feature) | 🟢 | PDF job documentation |

### 🛡️ Platform Admin (Restricted)

> These pages are only accessible to CampoTech platform administrators.

| Page | Route | Status | Description |
|:---|:---|:---:|:---|
| [[Growth Engine]] | `/dashboard/admin/growth-engine` | 🟢 | Professional acquisition system |
| [[Support Queue]] | `/dashboard/admin/support-queue` | 🟢 | Public visitor escalations |

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

## 🏗️ Feature Architectures

Complex features with detailed implementation documentation.

| Feature | Location | Status | Description |
|:---|:---|:---:|:---|
| [[Client Data Folder]] | `02_App/CRM/` | 🟢 | Customer data consolidation & ARCO compliance |
| [[Job Completion Report]] | `02_App/Operations/` | 🟢 | PDF job documentation with snapshots |
| [[Multi-Trade Pricing]] | `02_App/Admin/` | 🟡 | Universal pricing for all trades |
| [[Support Queue]] | `02_App/Communication/` | 🟢 | AI-to-human escalation system |
| [[WhatsApp AI Translation]] | `02_App/Communication/` | 🟢 | Multi-language AI capabilities |
| [[Technician Verification Security]] | `02_App/Operations/` | 🟢 | QR badge & confirmation code systems |

---

## 🤖 AI Systems

CampoTech implements three distinct AI systems:

| System | Location | Status | Description |
|:---|:---|:---:|:---|
| [[AI Systems Overview]] | `02_App/AI/` | 🟢 | Master index for all AI systems |
| [[Public AI Chat]] | `02_App/AI/` | 🟢 | Landing page visitor support |
| [[Staff Help AI]] | `02_App/AI/` | 🟢 | Dashboard help (any tab) |
| [[WhatsApp AI Copilot]] | `02_App/AI/` | 🟡 | Customer WhatsApp automation |
| [[AI Settings Page]] | `02_App/AI/` | 🟢 | Configuration for WhatsApp AI |

---

## 🔧 Infrastructure & Monitoring

System health, capacity monitoring, and DevOps documentation.

| System | Location | Status | Description |
|:---|:---|:---:|:---|
| [[System Health and Capacity]] | `02_App/Infrastructure/` | 🟢 | Unified health + capacity monitoring |

### Quick Health Check Links
- **Local:** [System Status](http://localhost:3000/api/system/capacity?format=text) | [Health Check](http://localhost:3000/api/health)
- **Production:** [System Status](https://campo-tech-rho.vercel.app/api/system/capacity?format=simple) | [Health Check](https://campo-tech-rho.vercel.app/api/health)

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
│   ├── AI/                # AI Systems (3 types)
│   ├── Core/              # General Dashboard Pages
│   ├── CRM/               # Customer & Lead Management
│   ├── Operations/        # Jobs, Fleet, Inventory
│   ├── Admin/             # Admin & Settings
│   ├── Communication/     # WhatsApp, Voice, Support
│   └── Infrastructure/    # Health, Capacity, Monitoring
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

*Last updated: February 2026*
