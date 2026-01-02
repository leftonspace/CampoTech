# Autonomous Loop Configuration

This directory contains hooks and configurations for the "Ralph Wiggum" autonomous loop.

## Scripts

### autonomous_loop.sh (Linux/Mac/WSL)
Bash version for Unix-like systems.

### autonomous_loop.ps1 (Windows)
PowerShell version for native Windows compatibility.

Both scripts implement identical logic:

### Workflow
1. **Loop Counter**: Prevents infinite loops. Max 15 attempts.
2. **Deletion Guardrail**: Checks if any files were deleted.
   - If yes, runs **relevant** tests immediately.
   - If tests fail, it **reverts changes** (`git checkout .`).
3. **Smart Test Selector**: Detects changed files to run the correct tests:
   - `apps/web/*` → `pnpm --filter @campotech/web test:run`
   - `apps/mobile/*` → `pnpm --filter campotech-mobile test:run`
   - `apps/admin/*` → `pnpm --filter admin test:run`
   - `packages/*` or root files → `pnpm -r test:run` (Global test)
4. **Task Management**: Reads `architecture/implementation-plan.md`.
   - Finds the first unchecked task (`- [ ]`).
   - If a task is found, prints it and exits `1` (signals "Keep Working").
   - If all tasks are checked, exits `0` (signals "Success/Done").

### Usage

**On Windows (PowerShell):**
```powershell
.\.claude\hooks\autonomous_loop.ps1
```

**On Linux/Mac/WSL:**
```bash
./.claude/hooks/autonomous_loop.sh
chmod +x .claude/hooks/autonomous_loop.sh  # First time only
```

### Resetting
To reset the loop counter manually, delete the `.loop_count` file in the root directory.
