# Configuration
$MAX_LOOPS = 15
$COUNTER_FILE = ".loop_count"
$PLAN_FILE = "architecture/implementation-plan.md"

# ==========================================
# Helper Function: Determine Test Commands
# ==========================================
function Get-TestCommands {
    param([string[]]$Files)
    
    $commands = @()
    $runGlobal = $false
    $runWeb = $false
    $runMobile = $false
    $runAdmin = $false

    if ($Files.Count -eq 0) {
        $runGlobal = $true
    } else {
        foreach ($file in $Files) {
            if ($file -like "packages/*" -or $file -notlike "apps/*") {
                $runGlobal = $true
                break
            } elseif ($file -like "apps/web/*") {
                $runWeb = $true
            } elseif ($file -like "apps/mobile/*") {
                $runMobile = $true
            } elseif ($file -like "apps/admin/*") {
                $runAdmin = $true
            }
        }
    }

    if ($runGlobal) {
        $commands += "pnpm -r test:run"
    } else {
        if ($runWeb) { $commands += "pnpm --filter @campotech/web test:run" }
        if ($runMobile) { $commands += "pnpm --filter campotech-mobile test:run" }
        if ($runAdmin) { $commands += "pnpm --filter admin test:run" }
    }

    return $commands
}

# ==========================================
# 1. Budget/Loop Breaker
# ==========================================
if (-not (Test-Path $COUNTER_FILE)) {
    Set-Content -Path $COUNTER_FILE -Value "0"
}

$count = [int](Get-Content $COUNTER_FILE)
$count++
Set-Content -Path $COUNTER_FILE -Value $count

if ($count -gt $MAX_LOOPS) {
    Write-Host "Max attempts reached ($MAX_LOOPS). Exiting to save resources."
    exit 0
}

Write-Host "Loop iteration: $count"

# ==========================================
# 2. Safety Guardrail (Deletions)
# ==========================================
$deletedFiles = git diff --diff-filter=D --name-only HEAD 2>$null
$testsRanInGuardrail = $false

if ($deletedFiles) {
    Write-Host "⚠️  Detected deleted files:"
    $deletedFiles | ForEach-Object { Write-Host "  $_" }
    Write-Host "Determining relevant tests for verification..."
    
    $testCmds = Get-TestCommands -Files $deletedFiles
    
    if ($testCmds.Count -eq 0) {
        $testCmds = @("pnpm -r test:run")
    }

    Write-Host "Running guardrail tests: $($testCmds -join ', ')"
    
    foreach ($cmd in $testCmds) {
        Write-Host "Executing: $cmd"
        $env:CI = "true"
        Invoke-Expression $cmd
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ CRITICAL: Deletion broke the build ($cmd failed)."
            Write-Host "Reverting changes..."
            git checkout .
            Write-Host "Changes reverted. Try again without breaking tests."
            exit 1
        }
    }
    
    Write-Host "✅ Deletions verified safely. Tests passed."
    $testsRanInGuardrail = $true
}

# ==========================================
# 3. The Truth Command (Smart Test Selector)
# ==========================================
if (-not $testsRanInGuardrail) {
    $allChanges = git diff --name-only HEAD 2>$null
    
    Write-Host "Checking for changes..."
    if (-not $allChanges) {
        Write-Host "No file changes detected relative to HEAD."
        Write-Host "Skipping tests as no changes detected."
    } else {
        Write-Host "Detected changes in:"
        $allChanges | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" }
        if ($allChanges.Count -gt 5) {
            Write-Host "  ...and more."
        }

        $testCmds = Get-TestCommands -Files $allChanges
        
        if ($testCmds.Count -eq 0) {
            $testCmds = @("pnpm -r test:run")
        }

        Write-Host "Running validation tests: $($testCmds -join ', ')"
        foreach ($cmd in $testCmds) {
            Write-Host "Executing: $cmd"
            $env:CI = "true"
            Invoke-Expression $cmd
            if ($LASTEXITCODE -ne 0) {
                Write-Host "❌ Tests failed: $cmd"
                exit 1
            }
        }
        Write-Host "✅ All relevant tests passed."
    }
}

# ==========================================
# 4. Task Source (The Brain)
# ==========================================
if (-not (Test-Path $PLAN_FILE)) {
    Write-Host "Error: Plan file $PLAN_FILE not found."
    exit 1
}

$firstTask = Get-Content $PLAN_FILE | Select-String -Pattern "^- \[ \]" | Select-Object -First 1

if ($firstTask) {
    Write-Host "Tasks remaining: $($firstTask.Line)"
    exit 1
} else {
    Write-Host "🎉 All tasks in $PLAN_FILE are checked!"
    if (Test-Path $COUNTER_FILE) {
        Remove-Item $COUNTER_FILE
    }
    exit 0
}
