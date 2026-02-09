# CampoTech Security - Prioritized Tech Debt & Maintenance Backlog

**Last Updated:** 2026-02-05T22:04:53-05:00  
**Status:** All Critical/High Remediations Complete  
**Next Audit:** Q2 2026 (see schedule below)

---

## 📋 Backlog Summary

| Priority | Category | Items | Status |
|----------|----------|-------|--------|
| **P0 - Urgent** | Security Hotfixes | 0 | ✅ All Resolved |
| **P1 - Short-Term** | Tech Debt | 2 | ⏳ Scheduled |
| **P2 - Medium-Term** | Major Upgrades | 5 | 📅 Planned |
| **P3 - Long-Term** | Enhancements | 4 | 🗓️ Backlog |

---

## 🔴 P0 - Urgent (Deploy ASAP)

**Status:** ✅ **NO PENDING ITEMS**

All critical and high-severity vulnerabilities have been remediated during the audit.

---

## 🟠 P1 - Short-Term Tech Debt (< 2 Weeks)

### TD-001: WatermelonDB Upgrade
| Field | Value |
|-------|-------|
| **Source** | Phase 12 (DEP-SEC) |
| **Severity** | LOW |
| **Current Version** | 0.27.1 |
| **Target Version** | 0.28.0 |
| **Effort** | 4-8 hours |
| **Risk** | Mobile sync regression |
| **Blocker** | Requires mobile app testing |
| **Status** | ⏳ Scheduled |

**Description:**  
Upgrade `@nozbe/watermelondb` to resolve bundled `@babel/runtime@7.21.0` (CVE-2025-27789). The current package.json override partially mitigates but doesn't affect the internal bundle.

**Action Items:**
1. [ ] Review WatermelonDB 0.28.0 changelog for breaking changes
2. [ ] Update `apps/mobile/package.json`
3. [ ] Run full mobile sync integration tests
4. [ ] Deploy to staging for manual QA
5. [ ] Production deploy after verification

---

### TD-002: SQLCipher Native Integration
| Field | Value |
|-------|-------|
| **Source** | Phase 5 (SYNC-SEC) |
| **Severity** | LOW |
| **Effort** | 8-16 hours |
| **Risk** | Native build complexity |
| **Blocker** | Requires iOS/Android build config |
| **Status** | ⏳ Scheduled |

**Description:**  
Complete WatermelonDB encryption by building with SQLCipher instead of standard SQLite. Key management infrastructure is already in place (Phase 5 remediation).

**Action Items:**
1. [ ] Configure native builds with SQLCipher
2. [ ] Test key rotation mechanism
3. [ ] Verify migration path for existing users
4. [ ] Performance benchmarking

---

## 🟡 P2 - Medium-Term Major Upgrades (< 4 Weeks)

### TD-003: Next.js 16 Migration
| Field | Value |
|-------|-------|
| **Current** | 15.5.10 |
| **Target** | 16.x |
| **Effort** | 16-24 hours |
| **Risk** | Breaking changes, App Router updates |
| **Timeline** | Q2 2026 |

**Dependencies:**
- Verify middleware compatibility
- Test all 337+ API routes
- Update Sentry integration

---

### TD-004: Prisma 7 Migration
| Field | Value |
|-------|-------|
| **Current** | 6.19.2 |
| **Target** | 7.x |
| **Effort** | 8-12 hours |
| **Risk** | Schema changes, client API updates |
| **Timeline** | Q2 2026 |

**Dependencies:**
- Review Prisma 7 migration guide
- Test all database operations
- Verify query performance

---

### TD-005: TailwindCSS 4 Migration
| Field | Value |
|-------|-------|
| **Current** | 3.4.19 |
| **Target** | 4.x |
| **Effort** | 8-16 hours |
| **Risk** | Major API changes, design system impact |
| **Timeline** | Q2 2026 |

**Dependencies:**
- Review TailwindCSS 4 migration guide
- Update custom CSS configurations
- Verify component styling

---

### TD-006: ESLint 9 Migration
| Field | Value |
|-------|-------|
| **Current** | 8.57.1 |
| **Target** | 9.x |
| **Effort** | 4-8 hours |
| **Risk** | Flat config migration |
| **Timeline** | Q2 2026 |

**Dependencies:**
- Migrate .eslintrc.js to eslint.config.js
- Update all eslint plugins
- Verify rule compatibility

---

### TD-007: Sentry SDK Major Upgrade
| Field | Value |
|-------|-------|
| **Current** | 8.55.0 |
| **Target** | 10.x |
| **Effort** | 4-8 hours |
| **Risk** | Breaking API changes |
| **Timeline** | Q2 2026 |

---

## 🟢 P3 - Long-Term Enhancements (< 3 Months)

### TD-008: Nonce-Based CSP
| Field | Value |
|-------|-------|
| **Source** | Phase 11 (UI-SEC) |
| **Effort** | 8-16 hours |
| **Benefit** | Eliminate 'unsafe-inline' |

**Description:**  
Migrate from `'unsafe-inline'` scripts to nonce-based CSP for enhanced XSS protection.

---

### TD-009: React Error Boundaries
| Field | Value |
|-------|-------|
| **Source** | Phase 11 (UI-SEC) |
| **Effort** | 4-8 hours |
| **Benefit** | Error message exposure prevention |

---

### TD-010: Sync Operations Dashboard
| Field | Value |
|-------|-------|
| **Source** | Phase 5 (SYNC-SEC) |
| **Effort** | 16-24 hours |
| **Benefit** | Fraud alerting, payment variance reports |

---

### TD-011: Consent Version Migration Strategy
| Field | Value |
|-------|-------|
| **Source** | Phase 9 (COMPLIANCE-SEC) |
| **Effort** | 4-8 hours |
| **Benefit** | Policy update workflow |

---

## 🛡️ Dependency Watch List

These packages should be monitored for updates:

| Package | Current | Watch Reason |
|---------|---------|--------------|
| `@babel/runtime` | 7.26.10 (override) | Bundled in WatermelonDB |
| `jose` | 5.10.0 | JWT handling, security-critical |
| `bcryptjs` | 2.4.3 | Password hashing |
| `zod` | 3.25.76 | v4 migration coming |
| `zustand` | 4.5.7 | v5 major changes |
| `react` | 19.1.0 | Core framework |
| `openai` | 1.10.0 | AI provider |
| `langchain` | 0.1.0 | AI framework |

---

## 📅 Follow-Up Audit Schedule

### Quarterly Security Reviews

| Quarter | Date | Focus Areas | Agent(s) |
|---------|------|-------------|----------|
| **Q2 2026** | 2026-04-15 | Dependency Audit, New Features | DEP-SEC |
| **Q3 2026** | 2026-07-15 | Full 12-Phase Re-Audit | All Agents |
| **Q4 2026** | 2026-10-15 | Compliance Annual Review | COMPLIANCE-SEC |
| **Q1 2027** | 2027-01-15 | Infrastructure & Auth | INFRA-SEC, AUTH-SEC |

### Monthly Automated Checks

| Check | Schedule | Automation |
|-------|----------|------------|
| `pnpm audit` | Weekly (Monday) | GitHub Action |
| `pip-audit` | Weekly (Monday) | GitHub Action |
| License Compliance | Monthly | `npx license-checker` |
| Outdated Dependencies | Monthly | `pnpm outdated` |
| Secrets Scan | Every PR | Pre-commit hook |

### Recommended GitHub Actions Workflow

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  schedule:
    - cron: '0 8 * * 1'  # Mondays at 8 AM UTC
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Run security audit
        run: pnpm audit --audit-level=high
        continue-on-error: true
        
      - name: Check for outdated
        run: pnpm outdated || true
```

---

## 🔍 Pre-Deployment Security Checklist

Before every production deployment, verify:

### Automated Checks
- [ ] `pnpm audit --audit-level=high` returns 0 HIGH/CRITICAL
- [ ] `pnpm type-check` passes (0 errors)
- [ ] `pnpm lint` passes
- [ ] All tests pass

### Manual Verification (Major Releases)
- [ ] Review `package.json` overrides still effective
- [ ] Verify environment variables for new features
- [ ] Check security headers in browser DevTools
- [ ] Test authentication flow end-to-end
- [ ] Verify webhook signatures in staging

---

## 📊 KPI Tracking

### Security Metrics to Monitor

| Metric | Target | Current |
|--------|--------|---------|
| Days Since Last Critical | > 90 days | ∞ (None found) |
| Dependency Vulnerabilities (HIGH) | 0 | 0 ✅ |
| Dependency Vulnerabilities (MOD) | < 5 | 1 ✅ |
| Failed Auth Attempts (24h) | < 100 | N/A |
| Webhook Signature Failures | < 10/day | N/A |
| Rate Limited AI Requests | < 1% | N/A |

---

## 📝 Notes

1. **Override Maintenance:** When upgrading packages in `package.json`, review if any overrides can be removed because the patched version is now the default.

2. **Python Dependencies:** The AI service (`services/ai`) has been updated but should be monitored separately. Consider adding `pip-audit` to CI/CD.

3. **Mobile Sync Testing:** Any changes to WatermelonDB or sync routes require comprehensive mobile testing before production deployment.

4. **Vercel Cron:** The retention cleanup cron (`/api/cron/retention-cleanup`) runs weekly on Sundays at 2 AM UTC. Verify it's executing via Vercel dashboard.

---

**Document Owner:** Security Team  
**Review Frequency:** Monthly  
**Last Reviewed:** 2026-02-05

---

*This backlog is maintained in `.agent/audit-results/REMEDIATION_BACKLOG.md`*
