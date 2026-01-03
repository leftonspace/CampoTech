# Fix remaining syntax errors in test files

$fixes = @(
    # Fix 'as const' syntax - replace with type annotation
    @{
        Pattern = ' as const,'
        Replacement = ','
        Files = @('apps\web\__tests__\whatsapp\webhook.test.ts')
    },
    # Fix 'as any' in object literals - remove the cast
    @{
        Pattern = ' as any,'
        Replacement = ','
        Files = @('apps\web\tests\unit\rating.test.ts', 'apps\web\__tests__\whatsapp\notifications.test.ts')
    },
    # Fix type-only imports - separate them
    @{
        Pattern = '  type UserRole,'
        Replacement = '} from ''@/lib/config/field-permissions'';' + "`nimport type { UserRole,"
        Files = @('apps\web\tests\unit\permissions.test.ts')
    }
)

foreach ($fix in $fixes) {
    foreach ($file in $fix.Files) {
        $fullPath = Join-Path $PSScriptRoot $file
        if (Test-Path $fullPath) {
            Write-Host "Fixing: $file"
            $content = Get-Content $fullPath -Raw
            $content = $content -replace [regex]::Escape($fix.Pattern), $fix.Replacement
            Set-Content -Path $fullPath -Value $content -NoNewline
            Write-Host "  ✓ Fixed"
        }
    }
}

Write-Host ""
Write-Host "Syntax fixes applied"
