---
tags:
  - strategy
  - product
  - roadmap
status: 🟢 Active
type: Strategy Document
updated: 2026-02-13
---

# 🚀 Product Strategy & Vision

> [!SUCCESS] **Mission**
> CampoTech empowers Argentine field service professionals by eliminating operational chaos — replacing WhatsApp group chaos with **intelligent dispatch**, replacing paper receipts with **AFIP-compliant invoicing**, and replacing word-of-mouth with a **commission-free verified marketplace**.

---

## 🎯 Value Proposition: 5 Pillars

### 1. 📡 Intelligent Communication (WhatsApp AI)
| Feature | Description |
|:---|:---|
| **24/7 Virtual Assistant** | LangGraph AI agent handles customer inquiries, booking, and quotes |
| **Deep Link (Free Tier)** | Manual `wa.me` links for basic WhatsApp messaging |
| **Managed Numbers (Premium)** | Auto-provisioned WhatsApp Business lines via Meta Cloud API |
| **Voice Transcription** | Audio messages → searchable text via GPT-4 |
| **Shared Inbox** | Team-wide WhatsApp conversation management |
| **Interactive Menus** | Button/list messages for structured customer responses |

### 2. 🗺️ Real-Time Operations & Logistics
| Feature | Description |
|:---|:---|
| **Live Multi-Tenant Map** | GPS tracking of entire workforce with traffic overlay |
| **AI Dispatch** | Traffic-aware ETA ranking + multi-factor scoring |
| **Multi-Modal Routing** | Auto, bici, transporte público comparison during rush hour |
| **Route Intelligence** | Google Distance Matrix with Buenos Aires traffic context |
| **Scheduling Intelligence** | Conflict detection, availability, optimized scheduling |
| **Field Forensics** | Before/during/after photos, digital signatures, GPS trail |
| **Vehicle Management** | Fleet assignment + insurance/VTV compliance tracking |

### 3. 💰 Financial Compliance & Fintech
| Feature | Description |
|:---|:---|
| **AFIP Electronic Invoicing** | Direct CAE issuance (Factura C/B/A) |
| **Mobile Cobro** | Cash, MercadoPago (QR/Link), Bank Transfer on-site |
| **Multi-Trade Pricing Engine** | Universal pricing across all trades |
| **Inflation Indexing** | Price adjustment with BCRA exchange rates |
| **Smart Rounding** | Rounding drift detection (0.1% threshold) |
| **Payment Reconciliation** | Cross-reference payments vs invoices |
| **Fiscal Health Monitor** | AFIP compliance traffic light |

### 4. 🔐 Trust & Identity (Security Layer)
| Feature | Description |
|:---|:---|
| **CUIT/DNI Verification** | Mod-11 validation + document upload |
| **Digital Badge** | QR identity cards for building security |
| **Mutual Confirmation** | 4-digit code exchange ensures identity at job start |
| **Trade Licenses** | ENARGAS, electrician certifications tracked |
| **Insurance (ART)** | Verification of worker's compensation coverage |
| **Client Data Folder** | ARCO compliance (Ley 25.326) data export |

### 5. 🏪 Marketplace & Growth
| Feature | Description |
|:---|:---|
| **Commission-Free Leads** | No per-job referral fees |
| **Smart Matching** | Cross-org nearest search with real-time ETA |
| **Verified Profiles** | Auto-generated from performance + verification data |
| **Growth Engine** | Web scraper → unclaimed profiles → outreach campaigns |
| **Profile Claim** | Professionals claim their scraped profile via phone |
| **Marketplace Analytics** | Views, clicks, conversions tracked |

---

## 💲 Monetization: 4-Tier SaaS

| Tier | Price (ARS/mo) | Target | Key Unlocks |
|:---|:---:|:---|:---|
| **GRATIS** | $0 | Solo worker | 10 jobs, 20 customers, basic invoicing |
| **INICIAL** | ~$15,000 | Small team (2-5) | Calendar, WhatsApp, team (5), leads, payments |
| **PROFESIONAL** | ~$35,000 | Growing business (5-15) | Live map, fleet, inventory, dispatch, voice |
| **EMPRESA** | ~$65,000 | Large operation (15+) | Unlimited users, analytics, predictions, API |

### Revenue Philosophy
- **Subscription Revenue** = primary income
- **Marketplace** = value-add (commission-free, drives SaaS adoption)
- **WhatsApp Credits** = usage-based (Meta API costs passed through)
- **No per-job commissions** — aligned incentives with customers

---

## 🌎 Market: Argentina Field Service

### Target Trades

| Trade (Spanish) | Trade (English) | Market Size |
|:---|:---|:---|
| Plomero | Plumber | Large |
| Electricista | Electrician | Large |
| Gasista Matriculado | Licensed Gas Fitter | Medium |
| Climatización (HVAC) | HVAC Technician | Medium |
| Cerrajero | Locksmith | Medium |
| Pintor | Painter | Medium |
| Albañil | Mason/Builder | Large |
| Fumigador | Pest Control | Small |
| Limpieza Industrial | Commercial Cleaning | Medium |
| Técnico IT | IT Technician | Growing |

### Argentine Market Specifics

| Factor | CampoTech Approach |
|:---|:---|
| **Inflation** | Real-time exchange rates + smart rounding |
| **Tax System** | AFIP WSFE integration (CAE issuance) |
| **Consumer Law** | Ley 24.240 — 10-day right of withdrawal |
| **Data Privacy** | Ley 25.326 — ARCO compliance |
| **Payment Culture** | Cash + MercadoPago + Bank Transfer (Transferencia 3.0) |
| **Communication** | WhatsApp is dominant (90%+ adoption) |
| **Trust Deficit** | Verification badges solve "quién viene a mi casa" |
| **Connectivity** | Offline-first mobile for variable coverage |

---

## 🗺️ Product Roadmap (2026)

### ✅ Completed (Jan–Feb 2026)

| Feature | Status |
|:---|:---|
| LangGraph AI Agent v3.2.1 | ✅ Shipped |
| 12-Phase Security Audit | ✅ All PASS |
| Route Intelligence (Phase 1-3) | ✅ Shipped |
| Marketplace Smart Matching | ✅ Shipped |
| Multi-Modal Routing (transit) | ✅ Shipped |
| Consumer Feedback & Ratings | ✅ Shipped |
| Digital Badge System | ✅ Shipped |
| Mutual Confirmation Code | ✅ Shipped |
| Monorepo Cleanup Audit | ✅ Completed |
| Legislative Stress Test | ✅ Completed |

### 🔜 Q1 2026 (Remaining)

| Feature | Priority | Status |
|:---|:---:|:---|
| Consumer marketplace search UI | High | ⚪ Planned |
| "Solicitar presupuesto" flow | High | ⚪ Planned |
| WhatsApp Managed Numbers | Medium | 🟡 In Progress |
| Revenue prediction models | Medium | 🟡 In Progress |
| AFIP Factura A support | Medium | ⚪ Planned |

### 🔮 Q2 2026

| Feature | Priority | Status |
|:---|:---:|:---|
| Public API for large companies | High | ⚪ Designed |
| Bluetooth receipt printer | Medium | ⚪ Planned |
| Multi-currency support | Low | ⚪ Planned |
| Mobile dark mode | Low | ⚪ Planned |
| SOC 2 preparation | Medium | ⚪ Planned |

---

## 🏢 Competitive Landscape

| Competitor | Model | CampoTech Advantage |
|:---|:---|:---|
| **IguanaFix** | Per-job commission (15-30%) | Commission-free marketplace |
| **Hogares** | Lead generation | Full operations SaaS, not just leads |
| **Workiz/Jobber** | US-focused SaaS | Argentine localization (AFIP, CUIT, ARS) |
| **WhatsApp Groups** | Manual chaos | Structured operations + AI automation |
| **Paper/Excel** | Spreadsheets | Real-time dispatch + compliance |

---

## 🔗 Connections

- **Parent:** [[README]]
- **Related:** [[Marketplace Overview]], [[Financial System Overview]], [[Security Architecture]]
- **Implementation:** [[Dashboard Home]], [[AI Systems Overview]], [[Route Intelligence]]

---

*CampoTech: de la improvisación a la profesionalización del servicio técnico argentino.*
