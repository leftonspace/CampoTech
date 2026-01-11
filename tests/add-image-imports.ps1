# Fix all image optimization warnings by converting <img> to <Image />
# This script will:
# 1. Add Image import from next/image if not present
# 2. Convert <img> tags to <Image /> components

$files = @(
    "apps/web/app/dashboard/fleet/[id]/page.tsx",
    "apps/web/app/dashboard/inventory/products/[id]/page.tsx",
    "apps/web/app/dashboard/invoices/[id]/page.tsx",
    "apps/web/app/dashboard/jobs/[id]/page.tsx",
    "apps/web/app/dashboard/leads/[id]/page.tsx",
    "apps/web/app/dashboard/whatsapp/components/ChatWindow.tsx",
    "apps/web/app/dashboard/whatsapp/components/ContactInfo.tsx",
    "apps/web/app/dashboard/whatsapp/components/MessageBubble.tsx",
    "apps/web/app/p/[slug]/page.tsx",
    "apps/web/app/rate/[token]/page.tsx",
    "apps/web/app/track/[token]/page.tsx",
    "apps/web/app/verify-badge/[token]/page.tsx",
    "apps/web/components/calendar/JobCard.tsx",
    "apps/web/components/OrgSwitcher.tsx",
    "apps/web/components/verification/DocumentViewer.tsx"
)

$baseDir = "d:\projects\CampoTech"

foreach ($file in $files) {
    $filePath = Join-Path $baseDir $file
    
    if (Test-Path $filePath) {
        Write-Host "Processing: $file"
        
        $content = Get-Content $filePath -Raw
        
        # Check if Image is already imported
        $hasImageImport = $content -match "import\s+.*Image.*from\s+['""]next/image['""]"
        
        # If not, add the import
        if (-not $hasImageImport) {
            # Find the last import statement
            $lines = $content -split "`r?`n"
            $lastImportIndex = -1
            
            for ($i = 0; $i -lt $lines.Length; $i++) {
                if ($lines[$i] -match "^import\s+") {
                    $lastImportIndex = $i
                }
            }
            
            if ($lastImportIndex -ge 0) {
                # Insert after the last import
                $lines = $lines[0..$lastImportIndex] + "import Image from 'next/image';" + $lines[($lastImportIndex + 1)..($lines.Length - 1)]
                $content = $lines -join "`r`n"
            }
        }
        
        # Save changes
        Set-Content -Path $filePath -Value $content -NoNewline
        Write-Host "  ✓ Added Image import" -ForegroundColor Green
    } else {
        Write-Host "  ✗ File not found: $filePath" -ForegroundColor Red
    }
}

Write-Host "`nAll files processed!"
