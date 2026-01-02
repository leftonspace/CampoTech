# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the CampoTech project.

---

## 📋 Active Workflows

### `ci.yml` - Continuous Integration
**Triggers:** 
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Purpose:** Code quality checks before merge

**Steps:**
1. **Lint** - ESLint code quality check
2. **Type Check** - TypeScript validation
3. **Unit Tests** - Vitest test suite
4. **Build** - Next.js production build test

**Duration:** ~3-5 minutes

**Package Manager:** pnpm (standardized across all workflows)

---

### `e2e.yml` - End-to-End Tests
**Triggers:**
- Pull requests to `main` or `develop`
- Daily at 6 AM UTC (3 AM Argentina time)
- Manual trigger via GitHub Actions UI

**Purpose:** Automated browser testing with Playwright

**Test Coverage:**
- Admin dashboard flows (`e2e/admin.spec.ts`)
- Subscription management (`e2e/subscription.spec.ts`)
- WhatsApp integration (`e2e/whatsapp.spec.ts`)

**Infrastructure:**
- PostgreSQL 15 (test database)
- Redis 7 (caching)
- Chromium browser (Playwright)

**Duration:** ~10-15 minutes

**Artifacts:** 
- Playwright HTML report (30 days retention)
- Test screenshots/videos (7 days retention)

---

## 🚀 Deployment

**Platform:** Vercel (Serverless)

Vercel handles all deployments automatically via GitHub integration:

### Preview Deployments
- **Trigger:** Every pull request
- **URL:** Unique URL per PR (e.g., `campotech-pr-123.vercel.app`)
- **Purpose:** Test changes before merge
- **Auto-cleanup:** Deleted when PR is closed

### Staging Deployment
- **Trigger:** Push to `develop` branch
- **URL:** `staging.campotech.com.ar`
- **Purpose:** Pre-production testing
- **Environment:** Staging database and services

### Production Deployment
- **Trigger:** Push to `main` branch
- **URL:** `app.campotech.com.ar`
- **Purpose:** Live production environment
- **Rollback:** Instant via Vercel dashboard

**No GitHub Actions workflows needed for deployment** - Vercel handles this automatically.

---

## ❌ Removed Workflows

### `deploy-production.yml` (DELETED)
**Reason:** Project uses Vercel (serverless), not AWS ECS (containers)  
**Deleted:** January 2, 2026  
**Lines Removed:** 313

**Why it was removed:**
- Referenced non-existent Dockerfiles
- Configured for AWS ECS deployment
- Project architecture uses Vercel instead
- Would have failed on every run

### `deploy-staging.yml` (DELETED)
**Reason:** Same as above - AWS ECS not used  
**Deleted:** January 2, 2026  
**Lines Removed:** 192

---

## 🔧 Local Development

### Run CI Checks Locally

Before pushing code, run the same checks that CI will run:

```bash
cd apps/web

# 1. Lint
pnpm lint

# 2. Type check
pnpm type-check

# 3. Unit tests
pnpm test:run

# 4. Build
pnpm build
```

### Run E2E Tests Locally

```bash
cd apps/web

# Run all E2E tests
pnpm test:e2e

# Run with UI (interactive)
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e:debug
```

---

## 📊 Workflow Status

Check workflow status:
- **GitHub UI:** Actions tab in repository
- **PR Checks:** Bottom of pull request page
- **Branch Protection:** Required checks must pass before merge

---

## 🛠️ Maintenance

### Updating Workflows

When modifying workflows:
1. Test changes on a feature branch first
2. Verify workflow runs successfully
3. Check that all steps complete
4. Merge to main only after validation

### Package Manager

**All workflows use pnpm** (standardized January 2, 2026)

**Do NOT use:**
- ❌ `npm install` or `npm ci`
- ❌ `yarn install`

**Always use:**
- ✅ `pnpm install --frozen-lockfile`
- ✅ `pnpm lint`, `pnpm build`, etc.

---

## 📝 Environment Variables

### CI Workflows
- `DATABASE_URL` - Dummy value for build (not used at runtime)
- `NEXTAUTH_SECRET` - Dummy value for build
- `JWT_SECRET` - Dummy value for build

### E2E Workflows
- `DATABASE_URL` - Points to test PostgreSQL container
- `REDIS_URL` - Points to test Redis container
- `BASE_URL` - Test server URL (http://localhost:3000)

**Production secrets** are managed in Vercel dashboard, not GitHub Actions.

---

## 🔍 Troubleshooting

### CI Workflow Fails

**Lint errors:**
```bash
pnpm lint --fix  # Auto-fix issues
```

**Type errors:**
```bash
pnpm type-check  # See all errors
```

**Test failures:**
```bash
pnpm test:run  # Run tests locally
```

**Build failures:**
```bash
pnpm build 2>&1 | Out-File build-errors.txt
Get-Content build-errors.txt
```

### E2E Workflow Fails

**Check Playwright report:**
- Download artifact from GitHub Actions
- Open `playwright-report/index.html`

**Run locally:**
```bash
pnpm test:e2e  # Reproduces CI environment
```

---

## 📚 Related Documentation

- **pnpm Guide:** `/docs/PNPM-GUIDE.md`
- **Command Reference:** `/docs/MY-COMMANDS.md`
- **Architecture:** `/architecture/campotech-architecture-complete.md`
- **Cleanup Audit:** `/docs/audits/CODEBASE-CLEANUP-AUDIT.md`

---

## 🎯 Quick Reference

| Workflow | Trigger | Duration | Purpose |
|----------|---------|----------|---------|
| `ci.yml` | PR, Push | 3-5 min | Code quality |
| `e2e.yml` | PR, Daily | 10-15 min | Browser tests |
| Vercel | Push | 2-3 min | Deployment |

---

**Last Updated:** January 2, 2026  
**Maintained By:** CampoTech Development Team
