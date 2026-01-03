---
description: Package manager rules - ALWAYS use pnpm, never npm or yarn
---

# ⚠️ CRITICAL: Package Manager Rules

This project uses **pnpm** exclusively. **NEVER use npm or yarn**.

## Quick Reference

| Task | Correct Command | ❌ WRONG |
|------|-----------------|----------|
| Install all deps | `pnpm install` | `npm install` |
| Add a package | `pnpm add <pkg>` | `npm install <pkg>` |
| Add dev dependency | `pnpm add -D <pkg>` | `npm install --save-dev <pkg>` |
| Run a script | `pnpm <script>` | `npm run <script>` |
| Run in workspace | `pnpm --filter <pkg> <cmd>` | `npm run --workspace=<pkg>` |
| Clean install | `pnpm install --frozen-lockfile` | `npm ci` |

## Why pnpm?

1. **Faster installs** - Uses hard links and a content-addressable store
2. **Disk space efficient** - Packages are shared across projects  
3. **Strict by default** - Only declared dependencies are accessible
4. **Monorepo native** - Built-in workspace support with filtering

## Common Mistakes to Avoid

### ❌ Never do this:
```powershell
npm install           # Creates package-lock.json
npm run dev           # Wrong package manager
yarn add something    # Wrong package manager
npx some-tool         # Use pnpm dlx instead
```

### ✅ Always do this:
```powershell
pnpm install          # Uses pnpm-lock.yaml
pnpm dev              # Correct
pnpm add something    # Correct
pnpm dlx some-tool    # Correct (for one-off tools)
```

## Workspace Commands

This is a monorepo. To run commands in specific workspaces:

```powershell
# Run dev in web app
pnpm --filter @campotech/web dev

# Run lint in all packages
pnpm -r lint

# Add package to specific workspace
pnpm --filter @campotech/web add lodash

# Run command in apps/mobile
pnpm --filter @campotech/mobile start
```

## Lockfile Rules

1. **Only `pnpm-lock.yaml` should exist** at the root
2. If you see `package-lock.json` or `yarn.lock`, **DELETE THEM**
3. Never commit npm or yarn lockfiles

## If You Made a Mistake

If you accidentally ran npm/yarn:

```powershell
# Delete the wrong lockfile (Windows)
del package-lock.json

# Clean and reinstall
pnpm install
```
