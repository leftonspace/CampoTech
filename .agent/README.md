# AI Agent Instructions for CampoTech

This directory contains workflows and rules for AI coding assistants working on CampoTech.

---

## 📖 Primary References

### 1. Architecture Document (Main Reference)
**File:** `architecture/campotech-architecture-complete.md`

This is the **primary reference** for understanding the codebase structure, APIs, database schema, and system design.

> ⚠️ **IMPORTANT CAVEAT:** This document is NOT guaranteed to be 100% accurate or up-to-date. 
> The codebase is currently undergoing cleanup. When in doubt:
> - **Verify against actual code** before making assumptions
> - **Check for discrepancies** between docs and implementation
> - **Report inconsistencies** to the user when found

### 2. Implementation Plan (Future Work)
**File:** `architecture/implementation-plan.md`

This defines the **next steps** for the project AFTER the current cleanup phase is complete.
- Do NOT start implementation plan tasks unless explicitly asked
- Current focus is on codebase cleanup and stabilization

---

## 🚨 Critical Rules

### 1. Package Manager: pnpm ONLY
- **NEVER** use `npm` or `yarn`
- Always use `pnpm install`, `pnpm add`, `pnpm <script>`
- See `workflows/package-manager.md` for details

### 2. Verification After Changes
**ALWAYS run verification commands after making code changes.**
See `workflows/verify-changes.md` for the full checklist.

Quick reference:
```powershell
# After ANY code change
pnpm type-check    # TypeScript errors
pnpm lint          # ESLint errors

# After significant changes
pnpm build         # Build errors
pnpm test:run      # Test failures
```

### 3. Monorepo Structure
- **Root:** `d:\projects\CampoTech`
- **Web app:** `apps/web` (Next.js 14, App Router)
- **Mobile app:** `apps/mobile` (Expo/React Native)
- **Shared packages:** `packages/*`

### 4. Database
- Uses **Prisma** with **PostgreSQL** (Supabase)
- Schema: `apps/web/prisma/schema.prisma`
- Migrations: `apps/web/prisma/migrations`

---

## 📋 Available Workflows

| Slash Command | Description |
|---------------|-------------|
| `/cleanup` | **Codebase cleanup workflow** (see `docs/CLEANUP-BIBLE.md`) |
| `/package-manager` | pnpm usage rules and commands |
| `/verify-changes` | Verification commands after code changes |
| `/codebase-context` | How to reference architecture docs |
| `/database` | Prisma migrations and schema changes |
| `/testing` | How to write and run tests |
| `/debugging` | Common issues and troubleshooting |
| `/argentina` | AFIP, CUIT, phone validation, localization |
| `/error-handling` | Error handling patterns and standards |

### 📖 Key Documents

| Document | Purpose |
|----------|---------|
| `docs/CLEANUP-BIBLE.md` | **Master cleanup guide** - the "bible" for post-vibe-coding cleanup |
| `architecture/campotech-architecture-complete.md` | Primary codebase reference |
| `architecture/implementation-plan.md` | Future work (after cleanup) |

---

## 🔍 Before Making Changes

1. **Check the architecture doc** for context on the area you're modifying
2. **Verify current implementation** matches documentation
3. **Note any discrepancies** to report to the user

## ✅ After Making Changes

1. **Run verification commands** (type-check, lint, build, test)
2. **Report any new errors** introduced
3. **Update documentation** if the change affects documented behavior
