# CampoTech — Field Service Platform for Argentina

> **Market:** Argentina (es-AR)
> **Stack:** Next.js 14+ App Router · TypeScript · Prisma · PostgreSQL (Supabase) · Tailwind CSS
> **Package Manager:** pnpm (monorepo with workspaces)

---

## Your Role

You are a **delegated worker** for an IDE-integrated AI agent (Antigravity) that is pair-programming with the developer. When you receive tasks here in the terminal, you should:

1. **Read the task file** — Tasks are written to `Gemini_CLI_Interactions/Prompt/NNN-task-name.md`.
2. **Execute the task completely** — run commands, parse files, extract data, write results.
3. **Write output to `Gemini_CLI_Interactions/Output/`** — ALWAYS write your final results to file(s) there, using the SAME `NNN` prefix as the task.
4. **Be concise in terminal output** — the developer will read your output files, not scroll through terminal history.
5. **If a command fails, retry with fixes** — don't stop on first error. Debug and resolve.

### ⛔ CRITICAL FILE SAFETY RULES

**You are connected to the IDE via option 1.** Your built-in file tools (`WriteFile`, `ReplaceInFile`) show diffs in the IDE that the developer can accept or reject — so those are safe to use on project files.

**However, shell scripts write files directly to disk, bypassing the IDE diff system.** The developer gets NO review option for those.

**Rules:**
- ✅ You CAN use `WriteFile`, `ReplaceInFile` on project files — the IDE shows diffs for review
- ✅ You CAN **read** any file in the project (for analysis, extraction, verification)
- ✅ You CAN **run** shell commands (node scripts, pnpm, etc.) for data processing
- ⚠️ **Shell scripts that WRITE files** must ONLY write to `Gemini_CLI_Interactions/Output/` — never to project source files (no diffs = no review)
- ❌ **NEVER** have shell scripts write directly to `apps/`, `packages/`, `services/`, `src/`, or root config files

The IDE-integrated agent (Antigravity) will review your Output/ files and integrate them into the project with proper diffs.

---

## Project Overview

A **field service management platform** for the Argentine market that:
1. Connects consumers with verified technicians (electricians, plumbers, HVAC, etc.)
2. Manages the full job lifecycle: lead → quote → dispatch → execution → invoicing → payment
3. Provides real-time tracking, AI-powered booking, and WhatsApp integration
4. Handles Argentine-specific compliance: CUIT validation (Mod-11), AFIP invoicing, Mercado Pago payments

### Key Business Context
- **Currency:** ARS (Argentine Peso) — all prices in ARS
- **Language:** Spanish (es-AR) for user-facing strings
- **Phone format:** +54 prefix
- **CUIT validation:** Mod-11 algorithm
- **Payment:** Mercado Pago, cash, bank transfer (Transferencia 3.0)

---

## Project Structure

```
CampoTech/
├── apps/
│   └── web/                    # Main Next.js web application
│       ├── app/                # App Router pages & API routes
│       │   ├── api/            # API route handlers
│       │   ├── dashboard/      # Authenticated dashboard pages
│       │   └── (public)/       # Public pages (landing, marketplace)
│       ├── components/         # React components
│       ├── lib/                # Shared utilities, hooks, config
│       │   ├── api-client.ts   # Frontend API client
│       │   ├── config/         # Feature flags, permissions, roles
│       │   └── degradation/    # Circuit breakers, resilience
│       ├── prisma/
│       │   ├── schema.prisma   # Database schema (source of truth)
│       │   ├── migrations/     # Applied migrations (DO NOT modify)
│       │   ├── seed.ts         # Database seeding
│       │   └── sql/            # Raw SQL scripts
│       └── scripts/            # Utility scripts (simulation, seeding)
├── packages/                   # Shared monorepo packages
├── services/
│   └── ai/                     # Python AI service (LangGraph agent)
├── core/                       # Shared core utilities
├── architecture/               # Architecture documentation (Obsidian)
│   └── Obsidian Architecture/  # Flows, app docs, references
├── database/                   # Database utilities and migrations
├── docs/                       # General documentation
├── infrastructure/             # Deployment configs
├── tests/                      # Test files
├── package.json                # Root package.json
├── pnpm-workspace.yaml         # Monorepo workspace config
└── vercel.json                 # Deployment config
```

---

## Tech Stack & Conventions

### ⚠️ CRITICAL RULES
- **ALWAYS use `pnpm`** for any package operations — NEVER `npm`, NEVER `yarn`
- `npx -y` is acceptable ONLY for standalone CLI tools NOT installed in the project
- **TypeScript** in strict mode — no `any` unless absolutely necessary
- **Tailwind CSS** for all styling
- **Prisma ORM** for database access (PostgreSQL on Supabase)
- **Localization**: Argentina (ARS currency, es-AR locale, CUIT Mod-11 validation, +54 phone prefix)

### Commands
```bash
# Development
pnpm dev                        # Start web app (Next.js dev server)
pnpm --filter @campotech/web dev

# Database
pnpm prisma generate            # Generate Prisma client (after schema changes)
pnpm prisma migrate dev          # Run migrations (ONLY if schema.prisma was modified!)
pnpm prisma studio               # Open Prisma Studio (DB browser)

# Build & Quality
pnpm build                      # Production build
pnpm lint                       # ESLint
pnpm type-check                 # TypeScript type checking

# Cleanup (fast)
rimraf node_modules             # 10x faster than PowerShell Remove-Item
```

### Prisma Rules (IMPORTANT)
- **DO NOT run `prisma migrate dev` or `prisma db push`** unless `schema.prisma` was actually modified
- **`prisma generate`** only needs to run after schema changes or fresh install
- Data in dev/staging is script-generated but re-seeding takes time — avoid unnecessary resets
- **NEVER modify applied migration files** in `prisma/migrations/`

---

## Gemini_CLI_Interactions — Shared Communication Folder

```
Gemini_CLI_Interactions/
├── Prompt/          ← Antigravity writes task files here (you READ these)
│   ├── 001-db-audit.md
│   ├── 002-api-analysis.md
│   └── ...
└── Output/          ← YOU write results here
    ├── 001-db-audit-report.md
    ├── 002-api-analysis.json
    └── ...
```

### Naming Convention (CRITICAL)

**Output files:** `NNN-output-name.ext`
- `NNN` = SAME zero-padded number as the prompt task (001, 002, 003...)
- `output-name` = descriptive name of what the file contains
- Extension matches content (`.md`, `.json`, `.ts`, `.sql`, `.csv`)
- A single task can produce MULTIPLE output files, all sharing the same `NNN` prefix

### Writing Output Files

When writing analysis/summary files, use Markdown format:
```markdown
# NNN — Task Title
## Executive Summary
[findings]
## Detailed Analysis
[details with tables, code snippets, etc.]
## Sources Consulted
[list of files read]
```

When writing TypeScript/JSON data files:
```typescript
// Auto-generated by Gemini CLI — YYYY-MM-DD
// Source: [describe source files]
// Task: NNN-task-name

export const VARIABLE_NAME = {
  // ... data
};
```

---

## Key Domain Concepts

- **Organization** = A business entity (the technician's company) — multi-tenant isolation via `organizationId`
- **Job** = A service request with full lifecycle (PENDING → ASSIGNED → IN_PROGRESS → COMPLETED)
- **Lead** = A potential customer inquiry from marketplace or WhatsApp
- **Presupuesto** = Quote/estimate (Spanish term used in codebase)
- **Cobro** = Payment collection (cash, MercadoPago, transfer)
- **Técnico** = Technician / field worker
- **Despachador** = Dispatcher (office role)
- **CUIT** = Argentine tax ID (validated with Mod-11 algorithm)
- **RBAC** = Role-Based Access Control (OWNER, ADMIN, DISPATCHER, TECHNICIAN)
- **Terminal states** = COMPLETED and CANCELLED — immutable, cannot be modified

---

## Architecture Patterns

### API Routes
- All authenticated routes use `withAuth` wrapper for defense-in-depth
- Organization isolation is mandatory — every query filters by `organizationId`
- Use v2 API standard for new endpoints (SQL views, <200ms latency target)

### Frontend
- Persona-based navigation: Dispatcher vs. Technician views
- React Query v5 for data fetching
- Accent-insensitive search for Argentine names/addresses

### Database
- PostgreSQL with Prisma ORM
- Double-key IDOR prevention (e.g., `findFirst({ where: { id, organizationId } })`)
- 81/133 tables have direct `organizationId` — rest inherit through relations
