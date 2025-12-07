# Android Screenshot Capture Script for StockFinderAI
# Run this script after launching the app and navigating to each screen

$screenshotDir = "screenshots\android"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "screenshots\android_backup_$timestamp"

Write-Host "=== StockFinderAI Screenshot Capture ===" -ForegroundColor Cyan
Write-Host ""

# Check if adb is available
try {
    $null = adb devices
} catch {
    Write-Host "ERROR: adb not found. Make sure Android SDK is installed and adb is in your PATH." -ForegroundColor Red
    exit 1
}

# Check if device is connected
$devices = adb devices | Select-String "device$"
if ($devices.Count -eq 0) {
    Write-Host "ERROR: No Android device or emulator detected." -ForegroundColor Red
    Write-Host "Please start your emulator first." -ForegroundColor Yellow
    exit 1
}

# Create backup of existing screenshots
if (Test-Path $screenshotDir) {
    Write-Host "Backing up existing screenshots to: $backupDir" -ForegroundColor Yellow
    Copy-Item -Path $screenshotDir -Destination $backupDir -Recurse
    Write-Host "Backup complete!" -ForegroundColor Green
    Write-Host ""
}

# Create screenshots directory if it doesn't exist
if (-not (Test-Path $screenshotDir)) {
    New-Item -ItemType Directory -Path $screenshotDir | Out-Null
}

Write-Host "Ready to capture screenshots!" -ForegroundColor Green
Write-Host ""
Write-Host "Instructions:" -ForegroundColor Cyan
Write-Host "1. Make sure your app is running on the emulator/device"
Write-Host "2. Navigate to each screen as prompted"
Write-Host "3. Press ENTER when ready to capture each screenshot"
Write-Host ""

# Function to capture screenshot
function Capture-Screenshot {
    param (
        [string]$screenName,
        [string]$fileName
    )
    
    Write-Host "[$screenName]" -ForegroundColor Yellow -NoNewline
    Write-Host " Navigate to this screen and press ENTER to capture..." -NoNewline
    Read-Host
    
    # Capture screenshot on device
    $devicePath = "/sdcard/screenshot.png"
    adb shell screencap -p $devicePath
    
    # Pull screenshot to local directory
    $localPath = "$screenshotDir\$fileName"
    adb pull $devicePath $localPath | Out-Null
    
    # Delete from device
    adb shell rm $devicePath
    
    if (Test-Path $localPath) {
        Write-Host "  Captured: $fileName" -ForegroundColor Green
    } else {
        Write-Host "  Failed to capture: $fileName" -ForegroundColor Red
    }
    Write-Host ""
}

# Capture each screen
Write-Host "Starting screenshot capture..." -ForegroundColor Cyan
Write-Host ""

Capture-Screenshot "Home Screen" "01-home-screen.png"
Capture-Screenshot "Watch List" "02-watch-list.png"
Capture-Screenshot "Blue Chip Dips" "03-blue-chip-dips.png"
Capture-Screenshot "Congress Trades" "04-congress-trades.png"
Capture-Screenshot "AI Picks" "05-ai-picks.png"
Capture-Screenshot "Stock Search" "06-stock-search.png"
Capture-Screenshot "Insider Trades" "07-insider-trades.png"

Write-Host "=== Capture Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Screenshots saved to: $screenshotDir" -ForegroundColor Cyan
Write-Host "Old screenshots backed up to: $backupDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now edit these screenshots in your photo editor to add titles." -ForegroundColor Yellow
