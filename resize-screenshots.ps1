# Resize Android screenshots to iOS sizes
Add-Type -AssemblyName System.Drawing

$androidPath = "C:\Users\malac\Documents\MyReactNativeApp\screenshots\android"
$ios67Path = "C:\Users\malac\Documents\MyReactNativeApp\screenshots\ios-6.7"
$ios65Path = "C:\Users\malac\Documents\MyReactNativeApp\screenshots\ios-6.5"

# Get all PNG files except feature-graphic
$screenshots = Get-ChildItem "$androidPath\*.png" | Where-Object { $_.Name -ne "feature-graphic.png" }

foreach ($file in $screenshots) {
    Write-Host "Processing $($file.Name)..."
    
    # Load image
    $image = [System.Drawing.Image]::FromFile($file.FullName)
    
    # Resize to 6.7" (1290 x 2796)
    $bitmap67 = New-Object System.Drawing.Bitmap(1290, 2796)
    $graphics67 = [System.Drawing.Graphics]::FromImage($bitmap67)
    $graphics67.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics67.DrawImage($image, 0, 0, 1290, 2796)
    $bitmap67.Save("$ios67Path\$($file.Name)", [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics67.Dispose()
    $bitmap67.Dispose()
    
    # Resize to 6.5" (1242 x 2688)
    $bitmap65 = New-Object System.Drawing.Bitmap(1242, 2688)
    $graphics65 = [System.Drawing.Graphics]::FromImage($bitmap65)
    $graphics65.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics65.DrawImage($image, 0, 0, 1242, 2688)
    $bitmap65.Save("$ios65Path\$($file.Name)", [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics65.Dispose()
    $bitmap65.Dispose()
    
    $image.Dispose()
    
    Write-Host "  Created 6.7 and 6.5 inch versions"
}

Write-Host "`nDone! Created:"
$count = ($screenshots | Measure-Object).Count
Write-Host "  - $count screenshots at 1290x2796 in ios-6.7"
Write-Host "  - $count screenshots at 1242x2688 in ios-6.5"
