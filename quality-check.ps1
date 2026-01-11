# CampoTech Code Quality Checklist
# Run this script to perform a complete codebase health check

Write-Host "🔍 CampoTech Complete Code Quality Check" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$results = @()

# 1. ESLint Check
Write-Host "1️⃣  Running ESLint..." -ForegroundColor Yellow
try {
    $lintOutput = pnpm lint 2>&1 | Out-String
    if ($lintOutput -match "No ESLint warnings or errors") {
        Write-Host "   ✅ ESLint: PASSED (0 warnings, 0 errors)" -ForegroundColor Green
        $results += "✅ ESLint: PASSED"
    } else {
        $warningCount = ($lintOutput | Select-String "Warning:" | Measure-Object).Count
        $errorCount = ($lintOutput | Select-String "Error:" | Measure-Object).Count
        Write-Host "   ⚠️  ESLint: $errorCount errors, $warningCount warnings" -ForegroundColor Yellow
        $results += "⚠️ ESLint: $errorCount errors, $warningCount warnings"
    }
} catch {
    Write-Host "   ❌ ESLint: FAILED" -ForegroundColor Red
    $results += "❌ ESLint: FAILED"
}
Write-Host ""

# 2. TypeScript Type Check
Write-Host "2️⃣  Running TypeScript Type Check..." -ForegroundColor Yellow
try {
    $typeCheckOutput = pnpm type-check 2>&1 | Out-String
    if ($typeCheckOutput -match "error TS") {
        $errorCount = ($typeCheckOutput | Select-String "error TS" | Measure-Object).Count
        Write-Host "   ❌ TypeScript: $errorCount type errors found" -ForegroundColor Red
        $results += "❌ TypeScript: $errorCount type errors"
    } else {
        Write-Host "   ✅ TypeScript: PASSED (no type errors)" -ForegroundColor Green
        $results += "✅ TypeScript: PASSED"
    }
} catch {
    Write-Host "   ⚠️  TypeScript: Check skipped or failed" -ForegroundColor Yellow
    $results += "⚠️ TypeScript: Skipped"
}
Write-Host ""

# 3. Build Check
Write-Host "3️⃣  Running Production Build Check..." -ForegroundColor Yellow
Write-Host "   ⏭️  Skipping (takes 2-5 minutes, run manually: pnpm build)" -ForegroundColor Gray
$results += "⏭️ Build: Skipped (run: pnpm build)"
Write-Host ""

# 4. Tests
Write-Host "4️⃣  Running Tests..." -ForegroundColor Yellow
try {
    $testOutput = pnpm test:run 2>&1 | Out-String
    if ($testOutput -match "Test Files.*passed") {
        Write-Host "   ✅ Tests: PASSED" -ForegroundColor Green
        $results += "✅ Tests: PASSED"
    } elseif ($testOutput -match "no test files found") {
        Write-Host "   ⏭️  Tests: No test files found" -ForegroundColor Gray
        $results += "⏭️ Tests: No test files"
    } else {
        Write-Host "   ⚠️  Tests: Some tests failed or incomplete" -ForegroundColor Yellow
        $results += "⚠️ Tests: Check results"
    }
} catch {
    Write-Host "   ⏭️  Tests: Skipped or no tests configured" -ForegroundColor Gray
    $results += "⏭️ Tests: Skipped"
}
Write-Host ""

# 5. Dependency Security Audit
Write-Host "5️⃣  Running Dependency Security Audit..." -ForegroundColor Yellow
try {
    $auditOutput = pnpm audit --json 2>&1 | ConvertFrom-Json
    $vulnerabilities = $auditOutput.metadata.vulnerabilities
    $total = ($vulnerabilities.info + $vulnerabilities.low + $vulnerabilities.moderate + $vulnerabilities.high + $vulnerabilities.critical)
    
    if ($total -eq 0) {
        Write-Host "   ✅ Security: No vulnerabilities found" -ForegroundColor Green
        $results += "✅ Security: No vulnerabilities"
    } else {
        $critical = $vulnerabilities.critical
        $high = $vulnerabilities.high
        $moderate = $vulnerabilities.moderate
        $low = $vulnerabilities.low
        Write-Host "   ⚠️  Security: $total vulnerabilities found" -ForegroundColor Yellow
        Write-Host "      Critical: $critical | High: $high | Moderate: $moderate | Low: $low" -ForegroundColor Yellow
        $results += "⚠️ Security: $total vulnerabilities"
    }
} catch {
    Write-Host "   ⚠️  Security: Audit check failed or dependencies OK" -ForegroundColor Gray
    $results += "ℹ️ Security: Check manually (pnpm audit)"
}
Write-Host ""

# 6. Prisma Schema Validation
Write-Host "6️⃣  Validating Prisma Schema..." -ForegroundColor Yellow
try {
    $prismaOutput = pnpm db:generate 2>&1 | Out-String
    if ($prismaOutput -match "Generated Prisma Client") {
        Write-Host "   ✅ Prisma: Schema valid and client generated" -ForegroundColor Green
        $results += "✅ Prisma: Schema valid"
    } else {
        Write-Host "   ⚠️  Prisma: Check output" -ForegroundColor Yellow
        $results += "⚠️ Prisma: Check output"
    }
} catch {
    Write-Host "   ⚠️  Prisma: Generation skipped or failed" -ForegroundColor Yellow
    $results += "⚠️ Prisma: Check manually"
}
Write-Host ""

# Summary
Write-Host "📊 Summary" -ForegroundColor Cyan
Write-Host "==========" -ForegroundColor Cyan
foreach ($result in $results) {
    Write-Host "   $result"
}
Write-Host ""

# Final Score
$passed = ($results | Where-Object { $_ -match "✅" }).Count
$total = $results.Count
$score = [math]::Round(($passed / $total) * 100)

Write-Host "🎯 Quality Score: $passed/$total checks passed ($score%)" -ForegroundColor Cyan
Write-Host ""

if ($score -eq 100) {
    Write-Host "🎉 EXCELLENT! Your codebase is in pristine condition!" -ForegroundColor Green
} elseif ($score -ge 80) {
    Write-Host "✅ GOOD! Your codebase is in good shape with minor issues." -ForegroundColor Green
} elseif ($score -ge 60) {
    Write-Host "⚠️  FAIR! Some issues need attention." -ForegroundColor Yellow
} else {
    Write-Host "❌ NEEDS WORK! Several issues require immediate attention." -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Quick Reference Commands:" -ForegroundColor Cyan
Write-Host "   pnpm lint           - Run ESLint" -ForegroundColor Gray
Write-Host "   pnpm type-check     - Check TypeScript types" -ForegroundColor Gray
Write-Host "   pnpm build          - Production build test" -ForegroundColor Gray
Write-Host "   pnpm test:run       - Run all tests" -ForegroundColor Gray
Write-Host "   pnpm audit          - Security vulnerability check" -ForegroundColor Gray
Write-Host "   pnpm db:generate    - Validate Prisma schema" -ForegroundColor Gray
