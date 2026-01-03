# Batch convert vitest imports to Jest in all test files

$files = Get-ChildItem -Path "apps\web\tests" -Recurse -Filter "*.test.ts" | Select-Object -ExpandProperty FullName
$files += Get-ChildItem -Path "apps\web\__tests__" -Recurse -Filter "*.test.ts" | Select-Object -ExpandProperty FullName  
$files += Get-ChildItem -Path "src\modules" -Recurse -Filter "*.test.ts" | Select-Object -ExpandProperty FullName

$count = 0
foreach ($file in $files) {
    $content = Get-Content $file -Raw
    
    # Check if file contains vitest imports
    if ($content -match "from 'vitest'") {
        Write-Host "Converting: $file"
        
        # Replace vitest imports
        $content = $content -replace "import \{ describe, it, expect, vi, beforeEach, afterEach \} from 'vitest';", "// Using Jest globals"
        $content = $content -replace "import \{ describe, it, expect, vi, beforeEach \} from 'vitest';", "// Using Jest globals"
        $content = $content -replace "import \{ describe, it, expect, vi \} from 'vitest';", "// Using Jest globals"
        $content = $content -replace "import \{ describe, it, expect \} from 'vitest';", "// Using Jest globals"
        
        # Replace vi. with jest.
        $content = $content -replace "\bvi\.mock\(", "jest.mock("
        $content = $content -replace "\bvi\.fn\(\)", "jest.fn()"
        $content = $content -replace "\bvi\.clearAllMocks\(\)", "jest.clearAllMocks()"
        $content = $content -replace "\bvi\.spyOn\(", "jest.spyOn("
        $content = $content -replace "\bvi\.mocked\(", "jest.mocked("
        
        Set-Content -Path $file -Value $content -NoNewline
        $count++
    }
}

Write-Host ""
Write-Host "Converted $count files"
