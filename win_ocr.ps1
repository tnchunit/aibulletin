param (
    [Parameter(Mandatory=$true)]
    [string]$ImagePath
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    Add-Type -AssemblyName System.Drawing

    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    }

    function Await($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        $netTask.Result
    }

    [Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime] | Out-Null
    [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
    [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
    [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null

    $absPath = (Resolve-Path $ImagePath).Path
    $fileOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($absPath)
    $file = Await $fileOp ([Windows.Storage.StorageFile])

    $streamOp = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    $stream = Await $streamOp ([Windows.Storage.Streams.IRandomAccessStream])

    $decoderOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    $decoder = Await $decoderOp ([Windows.Graphics.Imaging.BitmapDecoder])

    $bitmapOp = $decoder.GetSoftwareBitmapAsync()
    $bitmap = Await $bitmapOp ([Windows.Graphics.Imaging.SoftwareBitmap])

    $lang = New-Object Windows.Globalization.Language("zh-Hant-TW")
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    if (-not $engine) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    }

    $ocrResultOp = $engine.RecognizeAsync($bitmap)
    $ocrResult = Await $ocrResultOp ([Windows.Media.Ocr.OcrResult])

    $lines = @()
    foreach ($line in $ocrResult.Lines) {
        $lines += $line.Text
    }
    $fullText = $ocrResult.Text

    # Clean text for easier regex
    # Replace spaces between Chinese characters or general spacing
    $cleanText = $fullText -replace '\s+', ' '

    $bid = ""
    # Try multiple regex patterns for announcement ID
    if ($cleanText -match '公告編號[：:\s]*([0-9]{5,7})') {
        $bid = $matches[1]
    } elseif ($cleanText -match '([0-9]{6})') {
        $bid = $matches[1]
    }

    # Extract Title
    $title = ""
    if ($cleanText -match '公告標題[：:\s]*([^。]+。|.+?(?=公告編號|公文文號|簽收|$))') {
        $title = $matches[1].Trim()
    }

    # Extract Office
    $office = ""
    if ($cleanText -match '公[佈布]單位[：:\s]*([^\s]+(?:\s+[^\s]+)?)') {
        $office = $matches[1].Trim()
    }

    # Extract Email
    $email = ""
    if ($cleanText -match '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})') {
        $email = $matches[1]
    }

    # Extract Date
    $date = ""
    if ($cleanText -match '(\d{4}\s*/\s*\d{1,2}\s*/\s*\d{1,2}(?:\s*(?:上午|下午))?\s*\d{1,2}\s*[:•]\s*\d{1,2}(?:\s*[:•]\s*\d{1,2})?)') {
        $date = $matches[1] -replace '\s+', '' -replace '•', ':'
    }

    # Extract Sign status
    $sign = ""
    if ($cleanText -match '簽收[：:\s]*([^\s]+)') {
        $sign = $matches[1].Trim()
    }

    # Extract Doc No
    $docNo = ""
    if ($cleanText -match '公文文號[：:\s]*([^\s]+)') {
        $docNo = $matches[1].Trim()
    }

    $outObj = @{
        success = $true
        full_text = $fullText
        lines = $lines
        bulletin_id = $bid
        title = $title
        office = $office
        contact = $email
        date = $date
        sign_status = $sign
        doc_no = $docNo
    }

    $json = $outObj | ConvertTo-Json -Depth 3
    Write-Output $json
} catch {
    $errObj = @{
        success = $false
        error = $_.Exception.Message
    }
    Write-Output ($errObj | ConvertTo-Json)
}
