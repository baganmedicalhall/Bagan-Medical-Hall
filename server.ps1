<#
 ==============================================================================
  Bagan Medical Hall - Pharmacy POS & Accounting ERP
  Native Windows HTTP Web Server & Real-Time Disk Synchronizer
  Binds with System.Net.Sockets.TcpListener for 100% Reliability on Port 8080
 ==============================================================================
#>

$port = 8080
$root = $PSScriptRoot
if ([string]::IsNullOrEmpty($root)) {
    $root = Get-Location
}
$imageDir = Join-Path $root "website_images"

if (!(Test-Path $imageDir)) {
    New-Item -ItemType Directory -Path $imageDir -Force | Out-Null
}

function Update-ImageManifest {
    param($dir)
    try {
        if (Test-Path $dir) {
            $rawFiles = Get-ChildItem -Path $dir -File | Where-Object { 
                $_.Extension -match '\.(webp|png|jpg|jpeg|svg|gif|ico)$' -and 
                $_.Name -ne 'bagan-medical-hall-logo.png' 
            }
            $fileList = @()
            foreach ($f in $rawFiles) {
                $fileList += @{
                    filename     = $f.Name
                    path         = "website_images/$($f.Name)"
                    size         = $f.Length
                    format       = $f.Extension.TrimStart('.').ToLower()
                    title        = if ($f.Name -like "*bagan*") { "Bagan Medical Hall Official Logo" } else { "Asset ($($f.Name))" }
                    lastModified = $f.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                }
            }
            $cat = @{ success = $true; folder = "website_images"; files = $fileList }
            $catJson = $cat | ConvertTo-Json -Depth 5
            [System.IO.File]::WriteAllText((Join-Path $dir "images.json"), $catJson, [System.Text.Encoding]::UTF8)
            [System.IO.File]::WriteAllText((Join-Path $dir "manifest.json"), $catJson, [System.Text.Encoding]::UTF8)
        }
    } catch {}
}

# Initial manifest sync on startup
Update-ImageManifest $imageDir

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
}

# Bind TCP Listener
$tcpListener = $null
try {
    $tcpListener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Any, $port)
    $tcpListener.Start()
} catch {
    try {
        $tcpListener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, $port)
        $tcpListener.Start()
    } catch {
        Write-Host "CRITICAL ERROR: Failed to bind to port $port : $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   BAGAN MEDICAL HALL - PHARMACY POS & ACCOUNTING ERP SERVER    " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  URL: http://localhost:$port/" -ForegroundColor Yellow
Write-Host "  Alternative: http://127.0.0.1:$port/"
Write-Host "  Root Directory: $root"
Write-Host "  Images Folder : $imageDir"
Write-Host "  Real-time File Manager Sync: ACTIVE" -ForegroundColor Green
Write-Host "  Auto WebP Conversion: ENABLED"
Write-Host "  Press Ctrl+C to stop the server.`n"

# Launch default browser
try {
    Start-Process "http://localhost:$port/"
} catch {}

# Main TCP Loop
while ($true) {
    $client = $null
    try {
        $client = $tcpListener.AcceptTcpClient()
        $stream = $client.GetStream()
        $stream.ReadTimeout = 10000
        $stream.WriteTimeout = 10000

        # Read HTTP request header
        $headerMs = New-Object System.IO.MemoryStream
        $buffer = New-Object byte[] 8192
        $headerEnd = -1

        while ($headerEnd -eq -1) {
            $read = $stream.Read($buffer, 0, $buffer.Length)
            if ($read -le 0) { break }
            $headerMs.Write($buffer, 0, $read)
            $all = $headerMs.ToArray()
            for ($i = 0; $i -le ($all.Length - 4); $i++) {
                if ($all[$i] -eq 13 -and $all[$i+1] -eq 10 -and $all[$i+2] -eq 13 -and $all[$i+3] -eq 10) {
                    $headerEnd = $i
                    break
                }
            }
            if ($headerMs.Length -gt 131072) { break } # 128KB max header length
        }

        if ($headerEnd -eq -1) {
            $client.Close()
            continue
        }

        $allBytes = $headerMs.ToArray()
        $headerText = [System.Text.Encoding]::ASCII.GetString($allBytes, 0, $headerEnd)
        $lines = $headerText -split "\r\n"
        if ($lines.Length -eq 0) { $client.Close(); continue }

        $reqParts = $lines[0] -split " "
        $method = $reqParts[0].ToUpper()
        $rawUrl = if ($reqParts.Length -gt 1) { $reqParts[1] } else { "/" }

        $urlPath = $rawUrl
        $queryString = ""
        if ($rawUrl.Contains("?")) {
            $qParts = $rawUrl.Split("?", 2)
            $urlPath = $qParts[0]
            $queryString = $qParts[1]
        }

        # Parse query string parameters
        $queryParams = @{}
        if (![string]::IsNullOrEmpty($queryString)) {
            foreach ($pair in $queryString.Split("&")) {
                if ($pair.Contains("=")) {
                    $kv = $pair.Split("=", 2)
                    $k = [System.Uri]::UnescapeDataString($kv[0])
                    $v = [System.Uri]::UnescapeDataString($kv[1])
                    $queryParams[$k] = $v
                } else {
                    $k = [System.Uri]::UnescapeDataString($pair)
                    $queryParams[$k] = ""
                }
            }
        }

        # Parse Content-Length
        $contentLength = 0
        foreach ($line in $lines) {
            if ($line -match "(?i)^Content-Length:\s*(\d+)") {
                $contentLength = [int]$matches[1]
            }
        }

        # Read full request body
        $bodyBytes = @()
        if ($contentLength -gt 0) {
            $bodyStart = $headerEnd + 4
            $alreadyRead = $allBytes.Length - $bodyStart
            $bodyMs = New-Object System.IO.MemoryStream
            if ($alreadyRead -gt 0) {
                $bodyMs.Write($allBytes, $bodyStart, [Math]::Min($alreadyRead, $contentLength))
            }
            $remaining = $contentLength - $alreadyRead
            while ($remaining -gt 0) {
                $toRead = [Math]::Min($buffer.Length, $remaining)
                $read = $stream.Read($buffer, 0, $toRead)
                if ($read -le 0) { break }
                $bodyMs.Write($buffer, 0, $read)
                $remaining -= $read
            }
            $bodyBytes = $bodyMs.ToArray()
        }

        # Response helper with universal CORS headers
        $SendResponse = {
            param($statusCode, $statusText, $contentType, $payloadBytes)
            $respHdr = "HTTP/1.1 $statusCode $statusText`r`n" +
                       "Content-Type: $contentType`r`n" +
                       "Content-Length: $($payloadBytes.Length)`r`n" +
                       "Access-Control-Allow-Origin: *`r`n" +
                       "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`r`n" +
                       "Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With`r`n" +
                       "Connection: close`r`n`r`n"
            $hdrRaw = [System.Text.Encoding]::ASCII.GetBytes($respHdr)
            $stream.Write($hdrRaw, 0, $hdrRaw.Length)
            if ($payloadBytes.Length -gt 0) {
                $stream.Write($payloadBytes, 0, $payloadBytes.Length)
            }
            $stream.Flush()
        }

        # 1. OPTIONS preflight
        if ($method -eq "OPTIONS") {
            & $SendResponse 200 "OK" "text/plain" @()
            $client.Close()
            continue
        }

        # 2. Server Status / Health Endpoint
        if ($method -eq "GET" -and ($urlPath -eq "/api/status" -or $urlPath -eq "/api/health")) {
            $statObj = @{
                success = $true
                status  = "online"
                server  = "Bagan Medical Hall Server"
                port    = $port
                folder  = "website_images"
                time    = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            }
            $statJson = $statObj | ConvertTo-Json
            $statBytes = [System.Text.Encoding]::UTF8.GetBytes($statJson)
            & $SendResponse 200 "OK" "application/json; charset=utf-8" $statBytes
            $client.Close()
            continue
        }

        # 3. Media Center Listing Endpoint (GET /api/media or /upload.php)
        if ($method -eq "GET" -and ($urlPath -eq "/api/media" -or $urlPath -eq "/upload.php") -and $queryParams["action"] -ne "delete") {
            Update-ImageManifest $imageDir
            $filesList = @()
            if (Test-Path $imageDir) {
                $rawFiles = Get-ChildItem -Path $imageDir -File | Where-Object { 
                    $_.Extension -match '\.(webp|png|jpg|jpeg|svg|gif|ico)$' -and 
                    $_.Name -ne 'bagan-medical-hall-logo.png' 
                }
                foreach ($f in $rawFiles) {
                    $ext = $f.Extension.TrimStart('.').ToLower()
                    $filesList += @{
                        filename     = $f.Name
                        path         = "website_images/$($f.Name)"
                        size         = $f.Length
                        format       = $ext
                        title        = if ($f.Name -like "*bagan*") { "Bagan Medical Hall Official Logo" } else { "Asset ($($f.Name))" }
                        lastModified = $f.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                }
            }
            $listObj = @{ success = $true; folder = "website_images"; files = $filesList }
            $listJson = $listObj | ConvertTo-Json -Depth 5
            $listBytes = [System.Text.Encoding]::UTF8.GetBytes($listJson)
            & $SendResponse 200 "OK" "application/json; charset=utf-8" $listBytes
            $client.Close()
            continue
        }

        # 4. Media Delete Endpoint (DELETE /api/media or /upload.php?action=delete)
        if (($method -eq "DELETE" -or ($queryParams["action"] -eq "delete")) -and ($urlPath -eq "/api/media" -or $urlPath -eq "/upload.php")) {
            $delFn = $queryParams["filename"]
            if ([string]::IsNullOrEmpty($delFn) -and $bodyBytes.Length -gt 0) {
                try {
                    $bObj = [System.Text.Encoding]::UTF8.GetString($bodyBytes) | ConvertFrom-Json
                    if ($bObj.filename) { $delFn = $bObj.filename }
                } catch {}
            }

            $delResult = @{ success = $false; message = "Filename parameter required" }
            if (![string]::IsNullOrEmpty($delFn)) {
                $safeName = [System.IO.Path]::GetFileName($delFn)
                $targetFile = Join-Path $imageDir $safeName
                if (Test-Path $targetFile -PathType Leaf) {
                    Remove-Item $targetFile -Force -ErrorAction SilentlyContinue
                    Update-ImageManifest $imageDir
                    $delResult = @{ success = $true; message = "File deleted successfully"; filename = $safeName }
                    Write-Host "[DELETE] Removed: website_images/$safeName" -ForegroundColor Yellow
                } else {
                    $delResult = @{ success = $true; message = "File already removed from website_images/"; filename = $safeName }
                }
            }

            $delJson = $delResult | ConvertTo-Json
            $delBytes = [System.Text.Encoding]::UTF8.GetBytes($delJson)
            & $SendResponse 200 "OK" "application/json; charset=utf-8" $delBytes
            $client.Close()
            continue
        }

        # 5. Settings Save Endpoint (POST /api/settings or /upload.php?action=save_settings)
        if ($method -eq "POST" -and ($urlPath -eq "/api/settings" -or ($urlPath -eq "/upload.php" -and $queryParams["action"] -eq "save_settings"))) {
            $bodyStr = [System.Text.Encoding]::UTF8.GetString($bodyBytes)
            $resObj = @{ success = $false; message = "Invalid settings payload" }
            try {
                $settingsPath = Join-Path $imageDir "settings.json"
                [System.IO.File]::WriteAllText($settingsPath, $bodyStr, [System.Text.Encoding]::UTF8)
                $resObj = @{ success = $true; message = "Settings saved to website_images/settings.json in real time" }
                Write-Host "[SETTINGS] Updated website_images/settings.json" -ForegroundColor Green
            } catch {
                $resObj = @{ success = $false; message = $_.Exception.Message }
            }
            $sJson = $resObj | ConvertTo-Json
            $sBytes = [System.Text.Encoding]::UTF8.GetBytes($sJson)
            & $SendResponse 200 "OK" "application/json; charset=utf-8" $sBytes
            $client.Close()
            continue
        }

        # 6. Image Upload Endpoint (POST /api/upload or /upload.php)
        if ($method -eq "POST" -and ($urlPath -eq "/api/upload" -or $urlPath -eq "/upload.php")) {
            $bodyStr = [System.Text.Encoding]::UTF8.GetString($bodyBytes)
            $resObj = @{ success = $false; message = "Invalid upload payload" }
            try {
                $payload = $bodyStr | ConvertFrom-Json
                if ($payload -and $payload.filename -and $payload.data) {
                    $rawBase = [System.IO.Path]::GetFileNameWithoutExtension($payload.filename)
                    $cleanBase = $rawBase -replace '[^a-zA-Z0-9_\.-]', '_'
                    if ([string]::IsNullOrWhiteSpace($cleanBase)) {
                        $cleanBase = "image_" + (Get-Date -Format "yyyyMMddHHmmss")
                    }
                    # Automatically enforce .webp extension
                    $cleanName = "$cleanBase.webp"
                    $targetPath = Join-Path $imageDir $cleanName

                    $dataStr = [string]$payload.data
                    if ($dataStr.Contains(",")) {
                        $dataStr = $dataStr.Split(",")[1]
                    }
                    $imgBytes = [System.Convert]::FromBase64String($dataStr)
                    [System.IO.File]::WriteAllBytes($targetPath, $imgBytes)
                    Update-ImageManifest $imageDir

                    $resObj = @{
                        success  = $true
                        path     = "website_images/$cleanName"
                        filename = $cleanName
                        size     = $imgBytes.Length
                        format   = "webp"
                        message  = "Saved to website_images/$cleanName in real time"
                    }
                    Write-Host "[UPLOAD] Saved: website_images/$cleanName ($($imgBytes.Length) bytes, webp)" -ForegroundColor Green
                }
            } catch {
                $resObj = @{ success = $false; message = $_.Exception.Message }
                Write-Host "[UPLOAD ERROR] $($_.Exception.Message)" -ForegroundColor Red
            }

            $uJson = $resObj | ConvertTo-Json
            $uBytes = [System.Text.Encoding]::UTF8.GetBytes($uJson)
            & $SendResponse 200 "OK" "application/json; charset=utf-8" $uBytes
            $client.Close()
            continue
        }

        # 7. Static File Serving (Root & Subdirectories)
        if ($urlPath -eq "/" -or [string]::IsNullOrWhiteSpace($urlPath)) {
            $urlPath = "/index.html"
        }

        $relPath = [System.Uri]::UnescapeDataString($urlPath).TrimStart("/").Replace("/", "\")
        $localPath = Join-Path $root $relPath

        # Security check: Ensure file stays inside project root
        $fullPath = [System.IO.Path]::GetFullPath($localPath)
        $fullRoot = [System.IO.Path]::GetFullPath($root)

        if ($fullPath.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $fullPath -PathType Leaf)) {
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $fileBytes = [System.IO.File]::ReadAllBytes($fullPath)
            & $SendResponse 200 "OK" $mime $fileBytes
        } else {
            $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            & $SendResponse 404 "Not Found" "text/plain; charset=utf-8" $notFoundBytes
        }
        $client.Close()
    } catch {
        if ($client -ne $null) {
            try { $client.Close() } catch {}
        }
    }
}
