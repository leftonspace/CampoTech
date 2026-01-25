# CampoTech Mobile Build Validation Script
# Run this BEFORE submitting to EAS to catch errors early

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CampoTech Mobile Pre-Build Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$WarningCount = 0

# Set environment variables
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# 1. Check Node.js version
Write-Host "[1/7] Checking Node.js version..." -ForegroundColor Yellow
$nodeVersion = node -v
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Gray

# 2. Check TypeScript
Write-Host "[2/7] Running TypeScript check..." -ForegroundColor Yellow
npx tsc --noEmit 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X TypeScript errors found" -ForegroundColor Red
    $ErrorCount++
} else {
    Write-Host "  OK TypeScript check passed" -ForegroundColor Green
}

# 3. Check ESLint
Write-Host "[3/7] Running ESLint..." -ForegroundColor Yellow
npx eslint . --ext .ts,.tsx --max-warnings 0 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X ESLint errors found" -ForegroundColor Red
    $ErrorCount++
} else {
    Write-Host "  OK ESLint check passed" -ForegroundColor Green
}

# 4. Check Expo Doctor
Write-Host "[4/7] Running Expo Doctor..." -ForegroundColor Yellow
npx expo-doctor 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARN Expo Doctor warnings (may be OK)" -ForegroundColor Yellow
    $WarningCount++
} else {
    Write-Host "  OK Expo Doctor passed" -ForegroundColor Green
}

# 5. Check app.json validity
Write-Host "[5/7] Validating app.json..." -ForegroundColor Yellow
if (Test-Path "app.json") {
    $appJsonContent = Get-Content "app.json" -Raw
    $appJson = $appJsonContent | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($appJson -and $appJson.expo) {
        Write-Host "  OK app.json is valid" -ForegroundColor Green
    } else {
        Write-Host "  X app.json missing expo key" -ForegroundColor Red
        $ErrorCount++
    }
} else {
    Write-Host "  X app.json not found" -ForegroundColor Red
    $ErrorCount++
}

# 6. Check eas.json validity
Write-Host "[6/7] Validating eas.json..." -ForegroundColor Yellow
if (Test-Path "eas.json") {
    $easJsonContent = Get-Content "eas.json" -Raw
    $easJson = $easJsonContent | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($easJson -and $easJson.build) {
        Write-Host "  OK eas.json is valid" -ForegroundColor Green
    } else {
        Write-Host "  X eas.json missing build key" -ForegroundColor Red
        $ErrorCount++
    }
} else {
    Write-Host "  X eas.json not found" -ForegroundColor Red
    $ErrorCount++
}

# 7. Test Metro bundler
Write-Host "[7/7] Testing Metro bundler..." -ForegroundColor Yellow
npx expo export --platform android --output-dir .expo-test-export 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Metro bundler failed" -ForegroundColor Red
    $ErrorCount++
} else {
    Write-Host "  OK Metro bundler passed" -ForegroundColor Green
    Remove-Item -Recurse -Force ".expo-test-export" -ErrorAction SilentlyContinue
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Validation Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($ErrorCount -eq 0) {
    Write-Host "All checks passed! Ready to submit to EAS." -ForegroundColor Green
    Write-Host ""
    Write-Host "Run: npx eas-cli build --platform android --profile preview" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "$ErrorCount errors found. Fix them before submitting to EAS." -ForegroundColor Red
    exit 1
}
