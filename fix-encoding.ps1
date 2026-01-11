# PowerShell script to fix UTF-8 encoding issues in TSX files
# This script finds and fixes mojibake (garbled UTF-8 characters)

$appPath = "d:\projects\CampoTech\apps\web"

# Common mojibake patterns (using hex escapes for safety) and their correct UTF-8 equivalents
$replacements = @(
    @{ Pattern = [char]0xC3 + [char]0xA1; Replace = 'á' }
    @{ Pattern = [char]0xC3 + [char]0xA9; Replace = 'é' }
    @{ Pattern = [char]0xC3 + [char]0xAD; Replace = 'í' }
    @{ Pattern = [char]0xC3 + [char]0xB3; Replace = 'ó' }
    @{ Pattern = [char]0xC3 + [char]0xBA; Replace = 'ú' }
    @{ Pattern = [char]0xC3 + [char]0xB1; Replace = 'ñ' }
    @{ Pattern = [char]0xC3 + [char]0xBC; Replace = 'ü' }
    @{ Pattern = [char]0xC2 + [char]0xBF; Replace = '¿' }
    @{ Pattern = [char]0xC2 + [char]0xA1; Replace = '¡' }
    # Uppercase
    @{ Pattern = [char]0xC3 + [char]0x81; Replace = 'Á' }
    @{ Pattern = [char]0xC3 + [char]0x89; Replace = 'É' }
    @{ Pattern = [char]0xC3 + [char]0x8D; Replace = 'Í' }
    @{ Pattern = [char]0xC3 + [char]0x93; Replace = 'Ó' }
    @{ Pattern = [char]0xC3 + [char]0x9A; Replace = 'Ú' }
    @{ Pattern = [char]0xC3 + [char]0x91; Replace = 'Ñ' }
)

# Find all TSX/TS files
$files = Get-ChildItem -Path $appPath -Recurse -Include "*.tsx", "*.ts" -File

$fixedCount = 0

foreach ($file in $files) {
    try {
        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        
        $originalContent = $content
        
        foreach ($r in $replacements) {
            $content = $content.Replace($r.Pattern, $r.Replace)
        }
        
        # Also fix common string patterns that got double-encoded
        $content = $content -replace 'Ã¡', 'á'
        $content = $content -replace 'Ã©', 'é'
        $content = $content -replace 'Ã­', 'í'
        $content = $content -replace 'Ã³', 'ó'
        $content = $content -replace 'Ãº', 'ú'
        $content = $content -replace 'Ã±', 'ñ'
        $content = $content -replace 'Ã¼', 'ü'
        $content = $content -replace 'Â¿', '¿'
        $content = $content -replace 'Â¡', '¡'
        $content = $content -replace 'Ã‰', 'É'
        $content = $content -replace 'ðŸŒ', '🌍'
        $content = $content -replace 'â†', '←'
        $content = $content -replace 'â€¢', '•'
        
        if ($content -ne $originalContent) {
            [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.UTF8Encoding]::new($false))
            $fixedCount++
            Write-Host "Fixed: $($file.Name)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "Error processing $($file.Name): $_" -ForegroundColor Red
    }
}

Write-Host "`nFixed $fixedCount files" -ForegroundColor Cyan
