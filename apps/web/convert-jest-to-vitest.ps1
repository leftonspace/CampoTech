# Convert Jest to Vitest in test files
# This script converts Jest syntax to Vitest syntax

$files = @(
    "tests/unit/trial-manager.test.ts",
    "tests/unit/verification-manager.test.ts",
    "tests/unit/whatsapp/provisioning.test.ts",
    "tests/unit/whatsapp/dialog360-provider.test.ts"
)

foreach ($file in $files) {
    $path = "d:\projects\CampoTech\apps\web\$file"
    
    if (Test-Path $path) {
        Write-Host "Converting $file..."
        
        $content = Get-Content $path -Raw
        
        # Replace jest.mock with vi.mock
        $content = $content -replace 'jest\.mock\(', 'vi.mock('
        
        # Replace jest.fn with vi.fn
        $content = $content -replace 'jest\.fn\(', 'vi.fn('
        
        # Replace jest.clearAllMocks with vi.clearAllMocks
        $content = $content -replace 'jest\.clearAllMocks\(', 'vi.clearAllMocks('
        
        # Replace jest.mocked with vi.mocked
        $content = $content -replace 'jest\.mocked\(', 'vi.mocked('
        
        # Replace "// Using Jest globals" with vitest import
        $content = $content -replace '// Using Jest globals', "import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';"
        
        # Save the file
        Set-Content -Path $path -Value $content -NoNewline
        
        Write-Host "Converted $file"
    } else {
        Write-Host "File not found: $file"
    }
}

Write-Host "Conversion complete!"
