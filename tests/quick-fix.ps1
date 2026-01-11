# Bulk fix unused variables by prefixing with underscore
$webAppPath = "D:\projects\CampoTech\apps\web"
$lintOutput = pnpm lint 2>&1 | Out-String
$currentFile = $null
$changes = 0

foreach ($line in ($lintOutput -split "`n")) {
    if ($line -match "^\./(.+)`$") {
        $currentFile = Join-Path $webAppPath $Matches[1]
    }
    elseif ($line -match "(\d+):\d+\s+Warning: '([^']+)' is.*@typescript-eslint/no-unused-vars") {
        $lineNum = [int]$Matches[1]
        $varName = $Matches[2]
        
        if ($varName -notmatch "^_" -and (Test-Path $currentFile)) {
            $content = Get-Content $currentFile -Raw
            $lines = $content -split "`r?`n"
            $targetLine = $lines[$lineNum - 1]
            $newLine = $targetLine -replace "\b$([regex]::Escape($varName))\b", "_$varName"
            
            if ($newLine -ne $targetLine) {
                $lines[$lineNum - 1] = $newLine
                Set-Content $currentFile -Value ($lines -join "`r`n") -NoNewline
                Write-Host "Fixed: $currentFile :$lineNum  $varName -> _$varName" -ForegroundColor Green
                $changes++
            }
        }
    }
}

Write-Host "`nTotal fixes applied: $changes" -ForegroundColor Cyan
