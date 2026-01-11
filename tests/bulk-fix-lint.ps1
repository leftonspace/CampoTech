# Bulk Lint Fixer - Automated remediation for @typescript-eslint/no-unused-vars
# Processes files systematically to prefix unused variables with underscore

param(
    [switch]$DryRun = $false
)

$webAppPath = "D:\projects\CampoTech\apps\web"
$stats = @{
    FilesProcessed = 0
    VariablesPrefixed = 0
    Errors = 0
}

Write-Host "🔧 Bulk Lint Fixer" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "Running in DRY RUN mode - no files will be modified`n" -ForegroundColor Yellow
}

# Parse current lint output
Write-Host "Parsing lint warnings..." -ForegroundColor Gray
$lintOutput = & pnpm lint 2>&1 | Out-String
$lines = $lintOutput -split "`n"

# Group warnings by file for batch processing
$fileWarnings = @{}
$currentFile = $null

foreach ($line in $lines) {
    # Match file path
    if ($line -match '^\./(.+)$') {
        $currentFile = $Matches[1]
        if (-not $fileWarnings.ContainsKey($currentFile)) {
            $fileWarnings[$currentFile] = @()
        }
    }
    # Match warning with variable name
    elseif ($line -match '(\d+):(\d+)\s+Warning: ''([^'']+)'' is (defined but never used|assigned a value but never used).*@typescript-eslint/no-unused-vars') {
        if ($currentFile) {
            $fileWarnings[$currentFile] += @{
                Line = [int]$Matches[1]
                Column = [int]$Matches[2]
                Variable = $Matches[3]
                Type = $Matches[4]
            }
        }
    }
}

Write-Host "Found $($fileWarnings.Count) files with unused variable warnings`n" -ForegroundColor Yellow

# Process each file
foreach ($file in $fileWarnings.Keys | Sort-Object) {
    $fullPath = Join-Path $webAppPath $file
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "⚠ Skipping $file - file not found" -ForegroundColor Red
        $stats.Errors++
        continue
    }
    
    Write-Host "📄 Processing: $file" -ForegroundColor Cyan
    
    try {
        $content = Get-Content $fullPath -Raw
        $modifiedContent = $content
        $changesInFile = 0
        
        # Sort warnings by line number (descending) to avoid offset issues
        $warnings = $fileWarnings[$file] | Sort-Object -Property Line -Descending
        
        foreach ($warning in $warnings) {
            $varName = $warning.Variable
            $lineNum = $warning.Line
            
            # Skip if already prefixed
            if ($varName -match '^_') {
                continue
            }
            
            # Read the specific line
            $lines = $modifiedContent -split "`r?`n"
            if ($lineNum -gt $lines.Count) {
                Write-Host "  ⚠ Line $lineNum out of bounds" -ForegroundColor Yellow
                continue
            }
            
            $targetLine = $lines[$lineNum - 1]
            $originalLine = $targetLine
            
            # Build regex pattern for this specific variable (whole word match)
            $wordBoundaryPattern = "\b" + [regex]::Escape($varName) + "\b"
            
            # Strategy: Simply prefix the first occurrence of the variable name with underscore
            # This works for most cases: imports, declarations, parameters, catch blocks
            if ($targetLine -match $wordBoundaryPattern) {
                $targetLine = $targetLine -replace $wordBoundaryPattern, "_$varName"
            }
            
            # Apply change if modified
            if ($targetLine -ne $originalLine) {
                $lines[$lineNum - 1] = $targetLine
                $modifiedContent = $lines -join "`r`n"
                $changesInFile++
                Write-Host "  ✓ Line $lineNum : $varName → _$varName" -ForegroundColor Green
                $stats.VariablesPrefixed++
            }
            else {
                Write-Host "  ⚠ Line $lineNum : Could not auto-fix '$varName'" -ForegroundColor Yellow
            }
        }
        
        # Write back to file if changes were made
        if ($changesInFile -gt 0) {
            if (-not $DryRun) {
                Set-Content -Path $fullPath -Value $modifiedContent -NoNewline -Encoding UTF8
                Write-Host "  💾 Saved $changesInFile changes" -ForegroundColor Cyan
            } else {
                Write-Host "  [DRY RUN] Would save $changesInFile changes" -ForegroundColor Yellow
            }
            $stats.FilesProcessed++
        }
        
    }
    catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
        $stats.Errors++
    }
    
    Write-Host ""
}

# Summary
Write-Host "`n📊 Summary" -ForegroundColor Cyan
Write-Host "==========" -ForegroundColor Cyan
Write-Host "Files modified: $($stats.FilesProcessed)" -ForegroundColor White
Write-Host "Variables prefixed: $($stats.VariablesPrefixed)" -ForegroundColor Green
Write-Host "Errors: $($stats.Errors)" -ForegroundColor $(if ($stats.Errors -gt 0) { "Red" } else { "Gray" })

if ($DryRun) {
    Write-Host "`n💡 This was a DRY RUN. Run without -DryRun to apply changes." -ForegroundColor Yellow
} else {
    Write-Host "`n✅ Done! Run 'pnpm lint' to verify remaining issues." -ForegroundColor Green
}
