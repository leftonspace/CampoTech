# CampoTech Mobile OTA Update Script
# Use this to push updates to phones that already have the app installed

param(
    [Parameter(Mandatory=$false)]
    [string]$Channel = "preview",
    
    [Parameter(Mandatory=$false)]
    [string]$Message = "App update"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CampoTech OTA Update Publisher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Confirm the update
Write-Host "Channel: $Channel" -ForegroundColor Yellow
Write-Host "Message: $Message" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Push this update to all devices on '$Channel' channel? (y/n)"

if ($confirmation -ne 'y') {
    Write-Host "Update cancelled." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "Publishing update..." -ForegroundColor Green
Write-Host ""

# Run the EAS update command
npx eas-cli update --channel $Channel --message $Message --non-interactive

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Update published successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Users will receive the update next time they:" -ForegroundColor Cyan
    Write-Host "  - Open the app" -ForegroundColor Gray
    Write-Host "  - Or restart the app (depending on update settings)" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Update failed. Check the error above." -ForegroundColor Red
    exit 1
}
