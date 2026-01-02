# pnpm Command Reference for CampoTech
**Package Manager:** pnpm 10.25.0  
**Date:** January 2, 2026

---

## ✅ **ALWAYS USE THESE COMMANDS**

### Installing Dependencies
```powershell
# Install all dependencies (like npm install)
pnpm install

# Install from lock file only (like npm ci)
pnpm install --frozen-lockfile

# Install in specific workspace
cd apps/web
pnpm install
```

### Adding/Removing Packages
```powershell
# Add a package
pnpm add react

# Add a dev dependency
pnpm add -D typescript

# Add to specific workspace
pnpm --filter @campotech/web add axios

# Remove a package
pnpm remove react
```

### Running Scripts
```powershell
# From root (runs in apps/web workspace)
pnpm dev           # Start dev server
pnpm build         # Build for production
pnpm lint          # Run linter
pnpm type-check    # TypeScript check
pnpm test          # Run tests

# Or run directly in workspace
cd apps/web
pnpm dev
pnpm build
```

### Workspace Commands
```powershell
# Run command in specific workspace
pnpm --filter @campotech/web dev
pnpm --filter @campotech/mobile start

# Run command in all workspaces
pnpm -r build      # Build all workspaces
pnpm -r test       # Test all workspaces
```

---

## ❌ **NEVER USE THESE COMMANDS**

```powershell
npm install        # ❌ DON'T USE - Creates package-lock.json
npm ci             # ❌ DON'T USE - Wrong lock file
npm run dev        # ❌ DON'T USE - Use pnpm
npm add react      # ❌ DON'T USE - Use pnpm add

yarn install       # ❌ DON'T USE - Different package manager
yarn add react     # ❌ DON'T USE - Use pnpm
```

**Why?** Mixing package managers creates conflicting lock files and dependency issues.

---

## 📁 **Your Workspace Structure**

```
CampoTech/
├── pnpm-workspace.yaml    ← Defines workspaces
├── pnpm-lock.yaml         ← Lock file (DO NOT EDIT)
├── package.json           ← Root package
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   └── pnpm-lock.yaml
│   ├── mobile/
│   │   └── package.json
│   └── admin/
│       └── package.json
└── packages/
    └── (shared packages)
```

---

## 🔧 **Common Tasks**

### Starting Development
```powershell
# From root
pnpm dev

# Or from workspace
cd apps/web
pnpm dev
```

### Installing After Git Pull
```powershell
# Always use frozen lockfile in CI/after pull
pnpm install --frozen-lockfile
```

### Adding a New Package
```powershell
# To web app
pnpm --filter @campotech/web add axios

# To mobile app
pnpm --filter @campotech/mobile add react-native-maps
```

### Updating Dependencies
```powershell
# Update all packages
pnpm update

# Update specific package
pnpm update react

# Update to latest (ignoring semver)
pnpm update --latest
```

---

## 🚀 **Why pnpm is Better**

### Speed Comparison
```
npm install:  ~45 seconds
pnpm install: ~15 seconds (3x faster!)
```

### Disk Space
```
npm:  Each project = 500 MB node_modules
pnpm: Shared store = saves GBs across projects
```

### Monorepo Support
```
✅ pnpm handles workspaces natively
✅ Faster than npm/yarn for monorepos
✅ Better dependency hoisting
```

---

## ⚠️ **Important Notes**

### Lock Files
- ✅ **Keep:** `pnpm-lock.yaml` (commit to git)
- ❌ **Delete:** `package-lock.json` (already removed)
- ❌ **Delete:** `yarn.lock` (if exists)

### Workspace Configuration
- ✅ **Use:** `pnpm-workspace.yaml` (already created)
- ❌ **Don't use:** `workspaces` field in package.json (removed)

### CI/CD
- ✅ GitHub Actions now use `pnpm` (workflows updated)
- ✅ Vercel auto-detects `pnpm-lock.yaml`

---

## 🆘 **Troubleshooting**

### "pnpm: command not found"
```powershell
# Install pnpm globally
npm install -g pnpm

# Or use npx
npx pnpm install
```

### "Lockfile is up to date"
```powershell
# This is good! Means dependencies match lock file
pnpm install
```

### "ERR_PNPM_OUTDATED_LOCKFILE"
```powershell
# Update lock file
pnpm install

# Or force update
pnpm install --no-frozen-lockfile
```

### Workspace Not Found
```powershell
# Check pnpm-workspace.yaml includes the path
# Example: 'apps/web' should be listed
```

---

## 📚 **Quick Reference**

| Task | Command |
|------|---------|
| Install deps | `pnpm install` |
| Add package | `pnpm add <pkg>` |
| Add dev dep | `pnpm add -D <pkg>` |
| Remove package | `pnpm remove <pkg>` |
| Run script | `pnpm <script>` or `pnpm run <script>` |
| Update deps | `pnpm update` |
| Clean install | `pnpm install --frozen-lockfile` |
| Workspace cmd | `pnpm --filter <workspace> <cmd>` |
| All workspaces | `pnpm -r <cmd>` |

---

## 🔗 **Official Documentation**

- **pnpm Docs:** https://pnpm.io/
- **Workspaces:** https://pnpm.io/workspaces
- **CLI Commands:** https://pnpm.io/cli/add

---

**Remember:** ONLY use `pnpm` from now on. Never mix with `npm` or `yarn`!
