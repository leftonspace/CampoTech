---
description: Delegate heavy data processing tasks to Gemini CLI to conserve Antigravity context window. Use when working with large datasets, CSV/Excel extraction, or multi-step data processing.
---

# Gemini CLI Delegation Workflow — CampoTech

## Philosophy

**Antigravity = Architect. Gemini CLI = Builder.**

Antigravity should NOT waste context on:
- Running terminal commands that might fail, need retries, or produce verbose output
- Parsing files, extracting data, running scripts
- Debugging command errors, path issues, encoding problems
- Database queries that produce large outputs (Prisma, raw SQL)
- Build/lint debugging with multi-step retries
- Any work where the intermediate steps are noise — only the result matters

Instead, Antigravity writes a task file to the shared folder, sends it to Gemini CLI, and reads the clean output.

---

## When to Use This Pattern

**Default: ALWAYS delegate to Gemini CLI** for any task that involves:
- **Running terminal commands** — pnpm scripts, node scripts, data processing
- **Parsing files** — CSVs, Excel, JSON, any file reading/extraction
- **Data extraction & transformation** — building data files from raw datasets
- **Database operations** — Prisma seed scripts, SQL analysis, data audits
- **Running build/lint scripts** — `pnpm build`, `pnpm lint`, `pnpm type-check`
- **File inspection** — checking file structure, counting rows, sampling data
- **Multi-step processes** — if it might take 2+ commands, delegate it
- **Dependency audits** — `pnpm audit`, checking package versions

**Antigravity handles directly (do NOT delegate):**
- **Code editing** — writing/modifying source files (TS, TSX, CSS, SQL)
- **IDE-aware tasks** — responding to lint errors, cursor context, open files
- **Architecture decisions** — choosing data structures, designing APIs, Prisma schema design
- **Reading output files** — consuming the clean results that Gemini CLI produced
- **Component wiring** — integrating data into React components, dashboard pages

---

## Shared Folder Structure

```
Gemini_CLI_Interactions/
├── Prompt/          ← Antigravity WRITES task files here
│   ├── 001-db-audit.md
│   ├── 002-api-analysis.md
│   └── ...
└── Output/          ← Gemini CLI WRITES results here
    ├── 001-db-audit-report.md
    ├── 002-api-analysis.json
    └── ...
```

### Naming Convention (CRITICAL — both AIs use this)

**Prompt files:** `NNN-short-task-name.md`
- `NNN` = zero-padded sequential number (001, 002, 003...)
- `short-task-name` = kebab-case descriptor (max 4 words)
- Always `.md` format

**Output files:** `NNN-output-name.ext`
- `NNN` = SAME number as the prompt that generated it
- `output-name` = descriptive name of what the file contains
- Extension matches content (`.md`, `.json`, `.ts`, `.csv`, `.sql`)
- A single task can produce MULTIPLE output files, all sharing the same `NNN` prefix

---

## Prerequisites — Terminal Setup

**CRITICAL: Gemini CLI must always be running in a dedicated terminal.**

At the start of any session where delegation is needed:

1. **Check if Gemini CLI is already running** — look for `gemini` in the running terminals list.
2. **If NOT running**, start it with auto-approve:
   ```
   run_command: gemini -y
   Cwd: d:\projects\CampoTech
   WaitMsBeforeAsync: 8000
   ```
3. **When the IDE connection prompt appears** ("Do you want to connect Antigravity to Gemini CLI?"):
   - Send `1` + Enter to select **Yes** (connect to IDE)
   - Wait 5–8 seconds for it to install/load
   - It may show `✕ agy not found` — this is OK, Gemini CLI still works with its built-in file tools
4. **NEVER close or interrupt the Gemini CLI terminal** to run your own commands.
5. **If Antigravity needs to run its own commands**, always use a SEPARATE terminal.

### Terminal Discipline
| Terminal | Purpose | Rule |
|----------|---------|------|
| **Gemini Terminal** | Gemini CLI (always running) | ONLY for `send_command_input` delegation prompts |
| **Other Terminals** | Antigravity's own commands | Use for pnpm dev, prisma commands, etc. |

> ⚠️ **If you accidentally close Gemini CLI**, restart it immediately before continuing.

---

## Workflow Steps

### STEP 1: Antigravity writes the task file

Write a clear, self-contained task file to `Gemini_CLI_Interactions/Prompt/NNN-task-name.md`.

The file MUST include:
1. **Objective** — What to accomplish
2. **Input files** — Exact paths to source data (relative to project root)
3. **Output files** — Exact paths in `Gemini_CLI_Interactions/Output/`
4. **Output format** — Markdown report, JSON, TypeScript, SQL, etc.
5. **Constraints** — File size targets, aggregation rules, naming conventions
6. **Validation** — How to verify the output is correct

**CampoTech-specific context to include when relevant:**
- Package manager: `pnpm` (NEVER npm or yarn)
- Monorepo structure: `apps/web`, `apps/mobile`, `services/ai`, `packages/*`
- Database: PostgreSQL via Prisma (schema at `apps/web/prisma/schema.prisma`)
- Language: TypeScript strict mode
- Market: Argentina (es-AR, ARS currency, CUIT validation)

// turbo
### STEP 2: Antigravity sends the command to Gemini CLI

Use `send_command_input` to type the prompt:
```
Read the task in @Gemini_CLI_Interactions/Prompt/NNN-task-name.md and execute it. Write all output to Gemini_CLI_Interactions/Output/ with the NNN prefix.
```

Include `@file-path` references for key files Gemini should read.

**⚠️ CRITICAL — Double Enter Required for Submission:**

Gemini CLI requires TWO separate Enter presses to submit a prompt. Do this:

1. **First `send_command_input`**: Send the prompt text ending with a newline character
   - `WaitMs: 2000`
2. **Wait 5 seconds** (use `command_status` with `WaitDurationSeconds: 5`)
3. **Second `send_command_input`**: Send ONLY a newline character (empty input + Enter)
   - `WaitMs: 5000`
   - This second Enter triggers the actual submission
4. **Verify**: Check `command_status` — look for signs Gemini started processing:
   - Spinner text like "⠙ Considering..." or "⠹ Reading files..."
   - Tool calls like `ReadFile`, `Shell`, `WriteFile`

If you skip the second Enter, the prompt just sits in the input buffer and never executes!

### STEP 3: User pauses Antigravity

The USER stops Antigravity here (to save context). Gemini CLI processes the task independently.

### STEP 4: User resumes Antigravity when Gemini CLI finishes

The USER tells Antigravity to continue. At this point:
1. **List `Gemini_CLI_Interactions/Output/`** to see what was produced
2. **Read only the output file(s)** with the matching NNN prefix
3. Validate the output briefly (syntax check, key counts, etc.)
4. Continue with the next step (e.g., integrating findings into code)

---

## Common CampoTech Task Types

### Database Analysis
```markdown
# Task: Analyze Prisma schema for unused models
Input: apps/web/prisma/schema.prisma
Output: 001-schema-audit.md
```

### Build/Lint Debugging
```markdown
# Task: Run full build and categorize errors
Command: pnpm build 2>&1
Output: 002-build-errors.md (categorized by file/type)
```

### Data Processing
```markdown
# Task: Extract and transform seed data
Input: database/seed-data/*.csv
Output: 003-processed-seed.json
```

### Code Audit
```markdown
# Task: Find all API routes without auth guards
Input: apps/web/app/api/**/*.ts
Output: 004-unguarded-routes.md
```

### Dependency Analysis
```markdown
# Task: Audit dependencies for vulnerabilities
Command: pnpm audit --json
Output: 005-dep-audit.md
```

---

## Output Conventions

### Markdown Reports
- Written to `Gemini_CLI_Interactions/Output/NNN-report-name.md`
- Use structured headings and tables
- Include source file references
- Use Spanish for user-facing content, English for technical analysis

### TypeScript/JSON Data Files
- Gemini CLI writes to `Gemini_CLI_Interactions/Output/` first
- Antigravity then reviews and integrates into the appropriate app/package
- TypeScript files should include proper types
- JSON files should be valid and formatted

### SQL Scripts
- Written to `Gemini_CLI_Interactions/Output/NNN-script-name.sql`
- Include comments explaining what each query does
- NEVER include destructive operations (DROP, TRUNCATE) without explicit approval

---

## File Safety Rules

Gemini CLI may be connected to the IDE (option 1). This means:

- **Gemini's built-in file tools** (`WriteFile`, `ReplaceInFile`) → **OK on project files** — shows diffs in IDE for user to accept/reject ✅
- **Shell scripts** that write files → **Output/ folder ONLY** — these bypass the IDE diff system ❌

### CampoTech-Specific Safety Rules
- **NEVER run `prisma migrate dev` or `prisma db push`** unless the task explicitly requires schema changes
- **NEVER modify files in `node_modules/`**
- **NEVER commit `.env` files**
- **Use `pnpm`** for all package operations — NEVER `npm` or `yarn`
- **Data in dev/staging is script-generated** but re-seeding takes time — avoid unnecessary resets

---

## Error Handling

- If Gemini CLI fails and the output file doesn't exist or is malformed, Antigravity should:
  1. Check `Gemini_CLI_Interactions/Output/` for any partial output
  2. Write a corrected/clarified task file with a new NNN number
  3. Re-send the command to Gemini CLI

- If the task is too complex for Gemini CLI (e.g., it needs IDE context or lint error IDs), fall back to Antigravity handling it directly.

---

## Tracking Task Numbers

To find the next available NNN:
1. List files in `Gemini_CLI_Interactions/Prompt/`
2. Use the next number after the highest existing one
3. If the folder doesn't exist or is empty, start at 001

---

## Quick Reference — Full Startup Sequence

```
1. Start Gemini CLI:
   run_command: gemini -y
   Cwd: d:\projects\CampoTech
   WaitMsBeforeAsync: 8000

2. Select IDE connection (when prompted):
   send_command_input: "1\n"
   WaitMs: 8000

3. Write task file:
   write_to_file: Gemini_CLI_Interactions/Prompt/001-task-name.md

4. Send prompt (FIRST Enter):
   send_command_input: "Read the task in @Gemini_CLI_Interactions/Prompt/001-task-name.md and execute it...\n"
   WaitMs: 2000

5. Wait 5 seconds:
   command_status: WaitDurationSeconds: 5

6. Submit (SECOND Enter):
   send_command_input: "\n"
   WaitMs: 5000

7. Verify processing started:
   command_status: look for spinner/tool calls

8. Wait for completion (user pauses Antigravity)

9. Read output:
   view_file: Gemini_CLI_Interactions/Output/001-*.md
```