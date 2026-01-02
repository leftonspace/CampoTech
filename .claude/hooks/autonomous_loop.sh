#!/bin/bash

# Configuration
MAX_LOOPS=15
COUNTER_FILE=".loop_count"
PLAN_FILE="architecture/implementation-plan.md"

# ==========================================
# Helper Function: Determine Test Commands
# ==========================================
get_test_commands() {
  local files="$1"
  local commands=()
  local run_global=false
  local run_web=false
  local run_mobile=false
  local run_admin=false

  # If no files changed, we might assume global or just exit?
  # But usually this is called when we know things changed, or we are validating the current state.
  # If files is empty (e.g. manual run without changes), default to global? 
  # Or maybe checking for unstaged changes.
  
  if [ -z "$files" ]; then
    # Fallback: if no specific changes detected (maybe validating clean state), run global?
    # Or maybe we assume everything is fine? 
    # Let's assume global to be safe if we are forced to run tests.
    run_global=true
  else
    while IFS= read -r file; do
      if [[ "$file" == packages/* ]] || [[ "$file" != apps/* ]]; then
        # Use regex to verify it isn't in apps/
        # Actually simplest check: if it starts with packages/ OR doesn't start with apps/
        run_global=true
        break # Global overrides everything
      elif [[ "$file" == apps/web/* ]]; then
        run_web=true
      elif [[ "$file" == apps/mobile/* ]]; then
        run_mobile=true
      elif [[ "$file" == apps/admin/* ]]; then
        run_admin=true
      fi
    done <<< "$files"
  fi

  if [ "$run_global" = true ]; then
    commands+=("pnpm -r test:run")
  else
    if [ "$run_web" = true ]; then
      commands+=("pnpm --filter @campotech/web test:run")
    fi
    if [ "$run_mobile" = true ]; then
      commands+=("pnpm --filter campotech-mobile test:run")
    fi
    if [ "$run_admin" = true ]; then
      commands+=("pnpm --filter admin test:run")
    fi
  fi

  # Output newline-separated commands
  printf "%s\n" "${commands[@]}"
}

# ==========================================
# 1. Budget/Loop Breaker
# ==========================================
if [ ! -f "$COUNTER_FILE" ]; then
  echo 0 > "$COUNTER_FILE"
fi

count=$(<"$COUNTER_FILE")
count=$((count + 1))
echo "$count" > "$COUNTER_FILE"

if [ "$count" -gt "$MAX_LOOPS" ]; then
  echo "Max attempts reached ($MAX_LOOPS). Exiting to save resources."
  exit 0
fi

echo "Loop iteration: $count"

# ==========================================
# 2. Safety Guardrail (Deletions)
# ==========================================
# Detect files deleted in working tree or index
DELETED_FILES=$(git diff --diff-filter=D --name-only HEAD)

TESTS_RAN_IN_GUARDRAIL=false

if [ -n "$DELETED_FILES" ]; then
  echo "⚠️  Detected deleted files: $DELETED_FILES"
  echo "Determining relevant tests for verification..."
  
  # Get commands based on deleted files (deleted files are still 'changes' logic wise for what they surely broke)
  IFS=$'\n' read -d '' -r -a TEST_CMDS <<< "$(get_test_commands "$DELETED_FILES")"

  # If for some reason no commands found (shouldn't happen with get_test_commands logic), default to global
  if [ ${#TEST_CMDS[@]} -eq 0 ]; then
     TEST_CMDS=("pnpm -r test:run")
  fi

  echo "Running guardrail tests: ${TEST_CMDS[*]}"
  
  for cmd in "${TEST_CMDS[@]}"; do
    echo "Executing: $cmd"
    CI=true $cmd
    if [ $? -ne 0 ]; then
      echo "❌ CRITICAL: Deletion broke the build ($cmd failed)."
      echo "Reverting changes..."
      git checkout .
      echo "Changes reverted. Try again without breaking tests."
      exit 1
    fi
  done
  
  echo "✅ Deletions verified safely. Tests passed."
  TESTS_RAN_IN_GUARDRAIL=true
fi

# ==========================================
# 3. The Truth Command (Smart Test Selector)
# ==========================================
# If we didn't run tests in the guardrail step, we must run them now based on all changes
if [ "$TESTS_RAN_IN_GUARDRAIL" = false ]; then
  # Detect all changes (modified, added, deleted, renamed, etc) relative to HEAD
  ALL_CHANGES=$(git diff --name-only HEAD)
  
  echo "Checking for changes..."
  if [ -z "$ALL_CHANGES" ]; then
    echo "No file changes detected relative to HEAD."
    # If the working directory is clean, logic dictates we might skip tests 
    # OR run them all if we are just starting the loop to verify state.
    # But usually this loop runs AFTER an agent makes changes.
    # If no changes, arguably we are successful or stuck.
    # However, to be safe, let's run global tests if it's the 1st loop? 
    # Or just warn?
    # Let's assume if no changes, we don't need to test, but we proceed to check tasks.
    echo "Skipping tests as no changes detected."
  else
    echo "Detected changes in:"
    echo "$ALL_CHANGES" | head -n 5
    [ $(echo "$ALL_CHANGES" | wc -l) -gt 5 ] && echo "...and more."

    IFS=$'\n' read -d '' -r -a TEST_CMDS <<< "$(get_test_commands "$ALL_CHANGES")"
    
    # If logic returned empty (shouldn't happen if ALL_CHANGES not empty), force global
    if [ ${#TEST_CMDS[@]} -eq 0 ]; then
       TEST_CMDS=("pnpm -r test:run")
    fi

    echo "Running validation tests: ${TEST_CMDS[*]}"
    for cmd in "${TEST_CMDS[@]}"; do
      echo "Executing: $cmd"
      CI=true $cmd
      if [ $? -ne 0 ]; then
        echo "❌ Tests failed: $cmd"
        exit 1
      fi
    done
    echo "✅ All relevant tests passed."
  fi
fi

# ==========================================
# 4. Task Source (The Brain)
# ==========================================
if [ ! -f "$PLAN_FILE" ]; then
  echo "Error: Plan file $PLAN_FILE not found."
  exit 1
fi

# Look for the first unchecked task (- [ ])
FIRST_TASK=$(grep -m 1 "\- \[ \]" "$PLAN_FILE")

if [ -n "$FIRST_TASK" ]; then
  echo "Tasks remaining: $FIRST_TASK"
  exit 1
else
  echo "🎉 All tasks in $PLAN_FILE are checked!"
  rm -f "$COUNTER_FILE"
  exit 0
fi
