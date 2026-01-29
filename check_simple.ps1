Add-Type -AssemblyName System.Drawing
$iconPath = "c:\Users\himan\OneDrive\Desktop\DeshtopApp\ChatGptBulkChatDelets\icons"
$files = @("icon16.png", "icon32.png", "icon48.png", "icon128.png")
foreach ($name in $files) {
    $path = Join-Path $iconPath $name
    if (Test-Path $path) {
        $img = [System.Drawing.Image]::FromFile($path)
        Write-Output "$name $ ($img.Width) $ ($img.Height)"
        $img.Dispose()
    } else {
        Write-Output "$name MISSING"
    }
}
