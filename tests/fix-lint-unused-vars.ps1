# Automated ESLint Unused Variables Remediation Script
# Based on the January 2026 cleanup patterns

Write-Host "Starting automated lint fixes..." -ForegroundColor Cyan

# Parse lint output and extract file/line/variable information
$lintOutput = pnpm lint 2>&1 | Out-String
$lines = $lintOutput -split "`n"

# Track statistics
$stats = @{
    TotalProcessed = 0
    ErrorsRemoved = 0
    VariablesPrefixed = 0
    ImportsRemoved = 0
    FilesModified = @{}
}

# Pattern categories for bulk fixing
$catchBlockErrors = @()
$unusedImports = @()
$unusedVariables = @()
$alreadyPrefixed = @()

Write-Host "`nAnalyzing lint warnings..." -ForegroundColor Yellow

foreach ($line in $lines) {
    if ($line -match "Warning:.*@typescript-eslint/no-unused-vars") {
        $stats.TotalProcessed++
        
        # Extract variable name
        if ($line -match "'([^']+)' is (defined but never used|assigned a value but never used)") {
            $varName = $Matches[1]
            
            # Categorize the issue
            if ($varName -match "^(err|error)$") {
                # Catch block errors without underscore
                $catchBlockErrors += $line
            }
            elseif ($varName -match "^_") {
                # Already prefixed - these should be suppressed with ESLint config
                $alreadyPrefixed += $line
            }
            else {
                # General unused variable
                $unusedVariables += $line
            }
        }
    }
}

Write-Host "`n📊 Analysis Results:" -ForegroundColor Cyan
Write-Host "  Total unused variable warnings: $($stats.TotalProcessed)" -ForegroundColor White
Write-Host "  - Catch block errors (err/error): $($catchBlockErrors.Count)" -ForegroundColor Yellow
Write-Host "  - Already prefixed with _: $($alreadyPrefixed.Count)" -ForegroundColor Green
Write-Host "  - Other unused variables: $($unusedVariables.Count)" -ForegroundColor Magenta

# Function to fix a specific file
function Fix-UnusedVariable {
    param(
        [string]$FilePath,
        [int]$LineNumber,
        [string]$VarName,
        [string]$FixType
    )
    
    try {
        $fullPath = Join-Path "D:\projects\CampoTech\apps\web" $FilePath
        if (!(Test-Path $fullPath)) {
            Write-Host "  ⚠ File not found: $fullPath" -ForegroundColor Red
            return $false
        }
        
        $content = Get-Content $fullPath -Raw
        $lines = $content -split "`r?`n"
        
        if ($LineNumber -gt $lines.Count) {
            Write-Host "  ⚠ Line $LineNumber out of range in $FilePath" -ForegroundColor Red
            return $false
        }
        
        $targetLine = $lines[$LineNumber - 1]
        
        # Apply fix based on type
        switch ($FixType) {
            "PrefixWithUnderscore" {
                # Replace variable name with underscore-prefixed version
                # Match whole word boundaries to avoid partial replacements
                $newLine = $targetLine -replace "\b$VarName\b", "_$VarName"
                if ($newLine -ne $targetLine) {
                    $lines[$LineNumber - 1] = $newLine
                    $content = $lines -join "`r`n"
                    Set-Content -Path $fullPath -Value $content -NoNewline
                    return $true
                }
            }
            "RemoveCatchVariable" {
                # Change catch (err) to catch
                $newLine = $targetLine -replace "catch\s*\(\s*$VarName\s*\)", "catch"
                if ($newLine -ne $targetLine) {
                    $lines[$LineNumber - 1] = $newLine
                    $content = $lines -join "`r`n"
                    Set-Content -Path $fullPath -Value $content -NoNewline
                    return $true
                }
            }
        }
        
        return $false
    }
    catch {
        Write-Host "  ❌ Error processing $FilePath : $_" -ForegroundColor Red
        return $false
    }
}

# Fix catch block errors (remove unused error variables)
Write-Host "`n🔧 Phase 1: Fixing catch block error variables..." -ForegroundColor Cyan
foreach ($errorLine in $catchBlockErrors) {
    if ($errorLine -match "^\./(.*)`r?`n(\d+):") {
        $file = $Matches[1]
        $lineNum = [int]$Matches[2]
        
        if ($errorLine -match "'(err|error)' is defined but never used") {
            $varName = $Matches[1]
            Write-Host "  Fixing $file:$lineNum ($varName)" -ForegroundColor Gray
            
            if (Fix-UnusedVariable -FilePath $file -LineNumber $lineNum -VarName $varName -FixType "RemoveCatchVariable") {
                $stats.ErrorsRemoved++
                $stats.FilesModified[$file] = $true
            }
        }
    }
}

Write-Host "  ✓ Removed $($stats.ErrorsRemoved) catch block error variables" -ForegroundColor Green

# Generate ESLint configuration to suppress already-prefixed warnings
Write-Host "`n🔧 Phase 2: Generating ESLint rule for underscore-prefixed variables..." -ForegroundColor Cyan
Write-Host "  Found $($alreadyPrefixed.Count) variables already prefixed with _" -ForegroundColor Yellow
Write-Host "  These should be configured in ESLint to be ignored." -ForegroundColor Yellow
Write-Host @"

  Add this to your .eslintrc.json:
  {
    "rules": {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ]
    }
  }
"@ -ForegroundColor Cyan

# Summary
Write-Host "`n📈 Summary:" -ForegroundColor Cyan
Write-Host "  Files modified: $($stats.FilesModified.Count)" -ForegroundColor White
Write-Host "  Catch errors fixed: $($stats.ErrorsRemoved)" -ForegroundColor Green
Write-Host "  Variables to be ignored by config: $($alreadyPrefixed.Count)" -ForegroundColor Yellow
Write-Host "  Remaining to review manually: $($unusedVariables.Count)" -ForegroundColor Magenta

Write-Host "`n⚡ Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Review the ESLint config above and add to .eslintrc.json" -ForegroundColor White
Write-Host "  2. Run 'pnpm lint' to see remaining issues" -ForegroundColor White
Write-Host "  3. For remaining unused imports/variables, consider if they're truly unused" -ForegroundColor White
Write-Host "     - Large files may use imports in sub-components lower in the file" -ForegroundColor Gray
Write-Host "     - Icon mappings often appear unused but are referenced dynamically" -ForegroundColor Gray

Write-Host "`nDone! 🎉" -ForegroundColor Green
