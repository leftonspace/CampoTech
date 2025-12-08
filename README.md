# CampoTech Documentation

> **Field Service Management Platform for Argentine Tradespeople**

---

## For Engineers: Start Here

This repository contains the complete technical specification for CampoTech. **Read this document first** to understand the documentation structure.

### Canonical Source of Truth

| Document | Status | Description |
|----------|--------|-------------|
| **[campotech-architecture-complete.md](./architecture/campotech-architecture-complete.md)** | ✅ CANONICAL | **THE** single source of truth for all system design |
| [campotech-database-schema-complete.md](./architecture/campotech-database-schema-complete.md) | ✅ Active | Complete database schema, ERD, enums, indexes, RLS |
| [campotech-openapi-spec.yaml](./architecture/campotech-openapi-spec.yaml) | ✅ Active | OpenAPI 3.1 REST API specification |
| [campotech-queue-worker-architecture.md](./architecture/campotech-queue-worker-architecture.md) | ✅ Active | BullMQ queues, workers, DLQ, ops playbook |
| [campotech-end-to-end-flows.md](./architecture/campotech-end-to-end-flows.md) | ✅ Active | Sequence diagrams for 6 major flows |
| [capabilities.md](./architecture/capabilities.md) | ✅ Active | Master kill-switch architecture (Capability Map) |

### Reading Order (Recommended)

1. **Start with:** `campotech-architecture-complete.md` - Full system overview
2. **Then:** `campotech-database-schema-complete.md` - Understand the data model
3. **For APIs:** `campotech-openapi-spec.yaml` - Endpoint details
4. **For background jobs:** `campotech-queue-worker-architecture.md` - Worker design
5. **For flows:** `campotech-end-to-end-flows.md` - Visual diagrams
6. **For kill switches:** `capabilities.md` - Feature toggle system

---

## Key Sections in Architecture Doc

| Section | What You'll Find |
|---------|------------------|
| §1 Overview | Product definition, goals, success metrics |
| §1.1 Module Classification | **Core vs Optional modules for launch** |
| §2 Core Principles | One-Shot Culture, Minimal Onboarding, Reliability-First |
| §2.1 SLIs/SLOs | **Concrete performance targets** |
| §5.5 Naming Conventions | **Single source for DB/API/Mobile naming** |
| §6 State Machines | Job, Invoice, Payment, Message state transitions |
| §8 External Integrations | AFIP, Mercado Pago, WhatsApp setup |
| §8.1 AFIP Compliance | **Invoice numbering rules, immutability** |
| §10 Security | **Secrets management, RLS policies** |
| §11 Offline Mode | **Conflict resolution scenarios** |
| §14 Workflows | 12 core workflows with step-by-step |
| §15 Fallbacks | **Voice AI guardrails, panic modes** |

### Key Sections in Capability Map Doc

| Section | What You'll Find |
|---------|------------------|
| §4 Master Matrix | Complete capability definitions with categories |
| §5 Fallback Behavior | What happens when each capability is disabled |
| §7 Guard Pattern | How to implement capability checks in code |
| §9 Operations | How to toggle, monitor, and troubleshoot capabilities |
| §10 Emergency | Runbooks for common failure scenarios |

---

## Archived Documentation

> ⚠️ **DO NOT USE** - These documents are superseded

The following files are **archived for historical reference only**. They contain outdated information and should NOT be used for implementation:

| Document | Status | Notes |
|----------|--------|-------|
| roadmap-archives/roadmap-v1.md | ❌ ARCHIVED | Initial 88-feature scope (too complex) |
| roadmap-archives/roadmap-v2.md | ❌ ARCHIVED | Workiz parity attempt |
| roadmap-archives/roadmap-v3.md | ❌ ARCHIVED | 12 workflows, 10 weeks (too aggressive) |
| roadmap-archives/roadmap-v4.md | ❌ ARCHIVED | Modular architecture draft |
| roadmap-archives/roadmap-v5.md | ❌ ARCHIVED | + Fallbacks, observability |
| roadmap-archives/roadmap-v6.md | ❌ ARCHIVED | + Voice AI, offline, costs |
| roadmap-archives/roadmap-v7.md | ❌ ARCHIVED | + Security, abuse prevention |
| roadmap-archives/roadmap-v7-part2.md | ❌ ARCHIVED | Continuation of v7 |

All content from these documents has been consolidated, refined, and corrected in `campotech-architecture-complete.md`.

---

## Quick Reference

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend (Web) | Next.js 14, React, TypeScript, TailwindCSS |
| Frontend (Mobile) | React Native, Expo, WatermelonDB |
| Backend | Node.js, Next.js API Routes |
| Database | PostgreSQL 15+ (Supabase), Redis 7+ (Upstash) |
| Queue | BullMQ |
| Storage | Supabase Storage (S3-compatible) |
| Auth | Supabase Auth + JWT |
| External APIs | AFIP WSFE, Mercado Pago, WhatsApp Cloud, OpenAI |

### Key Integrations

| Integration | Purpose | Docs Section |
|-------------|---------|--------------|
| AFIP | Electronic invoicing (Factura Electrónica) | §8.1 |
| Mercado Pago | Payments with installments (cuotas) | §8.2 |
| WhatsApp | Customer communication | §8.3 |
| OpenAI Whisper | Voice message transcription | §8.4, §15.3 |

### 12 Core Workflows

1. User Signup (2 fields only)
2. Customer Creation
3. Job Scheduling
4. WhatsApp Reception
5. AFIP Invoice Request
6. Mercado Pago Payment
7. Voice AI Processing
8. SMS Fallback
9. Payment Reconciliation
10. PDF Invoice Generation
11. Job Completion Flow
12. Panic Mode Activation

---

## Questions?

- **Implementation questions:** Refer to the canonical docs above
- **Clarification needed:** Open an issue in this repository
- **Something missing:** Check if it's in the architecture doc first

---

*Last updated: 2024-01*
