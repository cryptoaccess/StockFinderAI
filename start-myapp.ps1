# start-myapp.ps1 - improved
$ProjectPath = "C:\Users\malac\Documents\MyReactNativeApp"
$AvdName = "Medium_Phone_API_36.1"

Write-Host "Switching to project folder..." -ForegroundColor Cyan
Set-Location $ProjectPath

# Start backend server in a new PowerShell window
Write-Host "Starting backend server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command cd '$ProjectPath\backend'; node server.js"

# Give backend a moment to start
Start-Sleep -Seconds 2

# Start Metro in a new PowerShell window
Write-Host "Starting Metro bundler (reset cache)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command cd '$ProjectPath'; npx.cmd react-native start --reset-cache"

# Give Metro a moment to start
Start-Sleep -Seconds 4

# Launch emulator if available
$Avds = & emulator -list-avds 2>$null
if ($Avds -and ($Avds -contains $AvdName)) {
    Write-Host "Launching Android emulator '$AvdName'..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command emulator -avd $AvdName"
} else {
    Write-Host "ERROR: AVD '$AvdName' not found. Please create it in Android Studio." -ForegroundColor Red
    Exit 1
}

# Wait for emulator to appear in adb devices
Write-Host "Waiting for emulator to appear via adb..." -ForegroundColor Cyan
$maxWait = 300    # seconds
$elapsed = 0
while ($true) {
    Start-Sleep -Seconds 2
    $devices = (& adb devices) -split "`n" | Where-Object { $_ -match '\tdevice$' }
    if ($devices.Count -gt 0) { break }
    $elapsed += 2
    if ($elapsed -gt $maxWait) { Write-Host "Timeout waiting for emulator (adb)." -ForegroundColor Yellow; break }
}
Write-Host "Device detected. Waiting for emulator boot completion..." -ForegroundColor Cyan

# Wait until the emulator reports boot complete
$elapsed = 0
while ($true) {
    Start-Sleep -Seconds 2
    $boot = (& adb shell getprop sys.boot_completed 2>$null)
    if ($boot) { $boot = $boot.Trim() }
    if ($boot -eq '1') { break }
    $elapsed += 2
    if ($elapsed -gt $maxWait) { Write-Host "Timeout waiting for emulator boot. Continuing anyway..." -ForegroundColor Yellow; break }
}

Write-Host "Emulator should be ready. Installing and launching the app..." -ForegroundColor Cyan
npx.cmd react-native run-android

Write-Host "Script finished. Metro is running and app install attempted." -ForegroundColor Green