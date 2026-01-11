# Code Quality Commands Reference
**CampoTech - Complete Quality Check Commands**

## 🔍 **Essential Quality Checks**

### 1. **ESLint** (Code Style & Best Practices)
```powershell
pnpm lint
```
**What it checks**: JavaScript/TypeScript code quality, unused variables, React hooks, Next.js best practices
**Status**: ✅ **PASSING** (0 warnings, 0 errors)

---

### 2. **TypeScript Type Check** (Type Safety)
```powershell
pnpm type-check
```
**What it checks**: TypeScript type errors, incorrect types, missing type definitions
**Why important**: Catches type errors before runtime
**Expected output**: "Found 0 errors"

---

### 3. **Production Build** (Compilation)
```powershell
pnpm build
```
**What it checks**: 
- Full Next.js production build
- All pages compile correctly
- No build-time errors
- Bundle size warnings
**Time**: 2-5 minutes
**When to run**: Before deploying to production

---

### 4. **Tests** (Functionality)
```powershell
# Run all tests
pnpm test:run

# Run tests with coverage
pnpm test:coverage

# Run test in watch mode
pnpm test
```
**What it checks**: Unit tests, component tests, integration tests
**Framework**: Vitest

---

### 5. **Security Audit** (Dependencies)
```powershell
# Check for vulnerabilities
pnpm audit

# Get detailed JSON report
pnpm audit --json

# Fix auto-fixable vulnerabilities
pnpm audit --fix
```
**What it checks**: Known security vulnerabilities in dependencies
**Why important**: Prevents security exploits

---

### 6. **Database Schema** (Prisma)
```powershell
# Validate Prisma schema
pnpm db:generate

# Check migration status
cd apps/web
prisma migrate status

# Format Prisma schema
prisma format
```
**What it checks**: Database schema validity, migration consistency

---

## 🚀 **Advanced Quality Checks**

### 7. **Unused Dependencies**
```powershell
# Install depcheck globally if needed
npm install -g depcheck

# Run from project root
depcheck

# Or from apps/web
cd apps/web
depcheck
```
**What it checks**: Unused dependencies, missing dependencies

---

### 8. **Bundle Analysis** (Performance)
```powershell
# Analyze bundle size
pnpm build
# Then check .next/analyze/
```
**What it checks**: Large dependencies, bundle size optimization opportunities

---

### 9. **Format Check** (Code Formatting)
If you have Prettier configured:
```powershell
# Check formatting
prettier --check "**/*.{ts,tsx,js,jsx,json,md}"

# Fix formatting
prettier --write "**/*.{ts,tsx,js,jsx,json,md}"
```

---

## ⚡ **Quick Quality Check (All-in-One)**

I've created a comprehensive script for you: **`quality-check.ps1`**

Run all checks at once:
```powershell
.\quality-check.ps1
```

This script runs:
1. ✅ ESLint
2. ✅ TypeScript type check
3. ⏭️ Build (skipped by default - too slow)
4. ✅ Tests
5. ✅ Security audit
6. ✅ Prisma schema validation

**Score**: Gives you a quality score out of 100%

---

## 📋 **Pre-Commit Checklist**

Before committing code:
```powershell
# 1. Lint
pnpm lint

# 2. Type check
pnpm type-check

# 3. Run tests
pnpm test:run
```

---

## 🏗️ **Pre-Deployment Checklist**

Before deploying to production:
```powershell
# 1. All quality checks pass
.\quality-check.ps1

# 2. Production build succeeds
pnpm build

# 3. No security vulnerabilities
pnpm audit

# 4. Database migrations are up to date
cd apps/web
prisma migrate status
```

---

## 🎯 **Quality Tiers**

### **Tier 1: Essential (Run Always)**
- `pnpm lint` ✅
- `pnpm type-check` 
- `pnpm test:run`

### **Tier 2: Important (Run Often)**
- `pnpm build`
- `pnpm audit`
- `pnpm db:generate`

### **Tier 3: Periodic (Run Weekly)**
- `depcheck` (unused dependencies)
- Bundle analysis
- Security deep-dive

---

## 🔧 **Fix Commands**

### Auto-fix linting issues:
```powershell
pnpm lint --fix
```

### Auto-fix security vulnerabilities:
```powershell
pnpm audit --fix
```

### Update dependencies:
```powershell
# Check outdated packages
pnpm outdated

# Update all to latest compatible versions
pnpm update

# Update to latest (may include breaking changes)
pnpm update --latest
```

---

## 📊 **Current Status**

As of **2026-01-11 10:00**:
- ✅ **ESLint**: 0 errors, 0 warnings (100% clean)
- ❓ **TypeScript**: Running check...
- ❓ **Tests**: Status unknown
- ❓ **Security**: Not yet checked
- ✅ **Prisma**: Schema valid

Run `.\quality-check.ps1` for complete status!

---

## 💡 **Pro Tips**

1. **Add to GitHub Actions**: Automate these checks in CI/CD
2. **Pre-commit hooks**: Use Husky to run checks before commits
3. **Editor integration**: Configure VSCode to show type errors inline
4. **Regular audits**: Run security audits weekly
5. **Track metrics**: Monitor bundle size over time

---

## 🆘 **Common Issues**

### "Type check failing but lint passes"
- ESLint doesn't check all TypeScript types
- Run `pnpm type-check` to catch type errors

### "Build succeeds but runtime errors"
- Add more tests
- Use TypeScript strict mode
- Add runtime validation (Zod)

### "High security vulnerabilities"
- Check if they're in devDependencies (lower risk)
- Review if update is safe
- Use `npm audit fix` carefully

---

**Created by**: Antigravity AI  
**Last Updated**: 2026-01-11
