---
tags:
  - marketplace
  - moc
  - public
status: 🟢 Functional
type: Feature Index
updated: 2026-02-13
---

# 🏪 Marketplace Overview

> [!SUCCESS] **Goal**
> CampoTech's marketplace connects **consumers** with **verified field service organizations** — plumbers, electricians, HVAC technicians — without per-job commissions. Organizations build trust through verification badges, rating accumulation, and response metrics. Consumers find the nearest available professional with real-time ETA.

---

## 🏗️ Marketplace Ecosystem

```
                    MARKETPLACE ECOSYSTEM
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌──────────┐    ┌──────────────┐  ┌──────────┐
   │ SUPPLY   │    │ MATCHING v2  │  │ DEMAND   │
   │          │    │              │  │          │
   │ Growth   │    │ PostgreSQL   │  │ Public   │
   │ Engine   │    │ Spatial +    │  │ Search   │
   │ (Scrape  │    │ Schedule-    │  │ (Nearest │
   │  + Claim)│    │ Aware Filter │  │  + Browse│
   └──────────┘    └──────────────┘  └──────────┘
       │                │               │
       ▼                ▼               ▼
   ┌──────────────────────────────────────┐
   │        BusinessPublicProfile         │
   │   (Auto-created for every org)       │
   │                                      │
   │   name, logo, categories, rating,    │
   │   verification badges, service area, │
   │   response rate, total jobs          │
   └──────────────────────────────────────┘
```

---

## 🧩 Key Components

### Supply Side (Getting Professionals Onboard)

| Component | Status | Description |
|:---|:---:|:---|
| [[Growth Engine]] | 🟢 | Scrape professional directories → create unclaimed profiles |
| [[Profile Claim Flow]] | 🟢 | Professional claims their scraped profile via phone verification |
| [[Business Profile Service]] | 🟢 | Auto-creates BusinessPublicProfile for every organization |
| [[Verification Flow]] | 🟢 | CUIT, DNI, insurance, professional license verification |
| [[Marketplace Profile Editor]] | 🟢 | Orgs customize their marketplace listing |

### Matching Engine (v2 — Optimized Feb 2026)

| Component | Status | Description |
|:---|:---:|:---|
| [[Marketplace Smart Matching]] | 🟢 | **v2:** PostgreSQL `earth_distance()` spatial query + schedule-aware filtering (1,000+ org scale) |
| [[Route Intelligence]] | 🟢 | Traffic-aware Distance Matrix integration |
| [[Multi-Modal Comparison]] | 🟢 | Auto/bici/transporte comparison during rush hour |
| [[Team Availability Page]] | 🟢 | Schedule/vacation data consumed by marketplace SQL query |

### Demand Side (Consumer Experience)

| Component | Status | Description |
|:---|:---:|:---|
| [[Public Business Profile]] | 🟢 | `/perfil/[slug]` — SEO-optimized public page |
| [[Public AI Chat]] | 🟢 | Landing page chatbot for visitor support |
| [[Marketplace Analytics]] | 🟢 | Profile views, clicks, lead tracking |
| Marketplace Search UI | ⚪ | Consumer-facing search interface (planned) |

---

## 🏢 BusinessPublicProfile Model

Every organization automatically gets a marketplace profile:

| Field | Type | Description |
|:---|:---|:---|
| `displayName` | String | Public business name |
| `slug` | String | URL-safe identifier (`plomeria-garcia-sa`) |
| `logo` | String? | Company logo URL |
| `coverPhoto` | String? | Profile banner image |
| `description` | String? | Business description |
| `categories` | String[] | Trade categories (PLOMERO, ELECTRICISTA, etc.) |
| `services` | Json | Detailed service list |
| `serviceArea` | Json? | Coverage zones (radius, provinces, polygon) |
| `address` | String? | Business address |
| `whatsappNumber` | String | Primary contact |
| `phone` | String? | Secondary contact |
| `averageRating` | Float | Consumer feedback score |
| `totalReviews` | Int | Number of reviews |
| `totalJobs` | Int | Completed job count |
| `responseRate` | Float | Response rate (0-1) |
| `responseTime` | Int | Average response minutes |
| `cuitVerified` | Boolean | AFIP CUIT verification badge |
| `insuranceVerified` | Boolean | ART insurance badge |
| `backgroundCheck` | Boolean | Background verification |
| `professionalLicense` | Boolean | Trade license badge |
| `optionalBadges` | Json? | Additional badges (ENARGAS, etc.) |
| `isActive` | Boolean | Profile is live |

---

## ✅ Verification Badges

Trust is built through progressive verification:

| Badge | Icon | Requirement | Priority |
|:---|:---:|:---|:---:|
| **CUIT Verificado** | ✅ | Mod-11 CUIT validation | Required |
| **Seguro (ART)** | 🛡️ | Insurance documentation | Required |
| **Antecedentes** | 📋 | Background check | Recommended |
| **Matrícula Profesional** | 🎓 | Trade license (ENARGAS, etc.) | Optional |
| **Gasista Matriculado** | 🔥 | Gas fitter license | Specialty |
| **Electricista Habilitado** | ⚡ | Electrician certification | Specialty |

---

## 📊 Marketplace Analytics

Tracked via `/api/analytics/marketplace` and `MarketplaceClick` model:

| Metric | Description |
|:---|:---|
| **Profile Views** | Times the public profile page was loaded |
| **Click-throughs** | Clicks to WhatsApp, phone, or request buttons |
| **Search Appearances** | Times the org appeared in nearest results |
| **Lead Conversions** | Marketplace views → actual job bookings |
| **Response Rate** | % of inquiries answered within 30 minutes |
| **Response Time** | Average time to first response |

---

## 💰 Business Model

| Feature | CampoTech Approach | vs. Competitors |
|:---|:---|:---|
| **Per-job commission** | ❌ None | Competitors charge 10-30% |
| **Listing fee** | ❌ None (included in tier) | Some charge listing fees |
| **Priority placement** | ⚪ Planned (paid boost) | Common in marketplaces |
| **Revenue model** | Monthly SaaS subscription | Commission-free leads as value-add |

> [!TIP] **Commission-Free Philosophy**
> CampoTech's marketplace is a value-add for SaaS subscribers, not a standalone marketplace business. This creates aligned incentives: organizations pay for the tools (dispatch, invoicing, AI), and marketplace visibility is a natural benefit of being verified on the platform.

---

## 🛠️ Technical Context

### Key Files
- **Profile Service:** `apps/web/lib/services/business-profile.service.ts`
- **Unclaimed Profiles:** `apps/web/lib/services/unclaimed-profile.service.ts`
- **Nearest API:** `apps/web/app/api/marketplace/nearest/route.ts`
- **Analytics API:** `apps/web/app/api/analytics/marketplace/route.ts`
- **Profile Editor:** `apps/web/app/dashboard/marketplace/profile/page.tsx`
- **Moderation:** `apps/web/app/dashboard/marketplace/moderation/page.tsx`
- **Cached Queries:** `apps/web/lib/cache/cached-queries.ts`

### Prisma Models
- `BusinessPublicProfile` — Public marketplace profile
- `MarketplaceClick` — Click tracking analytics
- `Organization` — Source org with `marketplace_visible`, `can_receive_jobs`
- `TechnicianLocation` — GPS data for nearest search
- `EmployeeSchedule` — Work shift schedules (consumed by marketplace SQL)
- `ScheduleException` — Vacation/sick/study days (consumed by marketplace SQL)

### PostgreSQL Extensions
- `cube` + `earthdistance` — Spatial distance calculations in SQL

---

## 🔗 Connections

- **Parent:** [[Platform Overview]]
- **Children:**
  - [[Marketplace Smart Matching]]
  - [[Public Business Profile]]
  - [[Growth Engine]]
  - [[Profile Claim Flow]]
  - [[Marketplace Profile Editor]]
  - [[Marketplace Analytics]]
- **Depends On:** [[Route Intelligence]], [[Verification Flow]], [[Business Profile Service]]
- **Related:** [[Dispatch System]], [[Public AI Chat]], [[Leads Page]]

---

## 📝 Notes & TODOs

- [x] Auto-created BusinessPublicProfile for every org
- [x] Verification badge system
- [x] Cross-org nearest search (Phase 3)
- [x] Marketplace click analytics
- [x] Profile claim flow for scraped professionals
- [ ] TODO: Consumer-facing search UI page
- [ ] TODO: "Solicitar presupuesto" request flow
- [ ] TODO: Priority placement (paid boost)
- [ ] TODO: Review/rating response system
- [ ] TODO: SEO sitemap generation for all profiles
- [ ] CONSIDER: Marketplace mobile app (consumer-facing)

---

*The marketplace turns verified professionals into discoverable businesses — zero commission, maximum trust.*
