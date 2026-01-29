Add-Type -AssemblyName System.Drawing
$iconPath = "c:\Users\himan\OneDrive\Desktop\DeshtopApp\ChatGptBulkChatDelets\icons"
$files = Get-ChildItem "$iconPath\*.png"
$output = @()
foreach ($file in $files) {
    try {
        $img = [System.Drawing.Image]::FromFile($file.FullName)
        $output += "$($file.Name) : Width=$($img.Width) px, Height=$($img.Height) px"
        $img.Dispose()
    } catch {
        $output += "Could not read $($file.Name)"
    }
}
$output | Out-File "c:\Users\himan\OneDrive\Desktop\DeshtopApp\ChatGptBulkChatDelets\dimensions.txt"
