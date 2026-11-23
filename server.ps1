$port = 8080
$root = $PSScriptRoot
$imageDir = Join-Path $root "website_images"

if (!(Test-Path $imageDir)) {
    New-Item -ItemType Directory -Path $imageDir -Force | Out-Null
}

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
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    Write-Host "Failed to bind to port $port : $_"
    exit 1
}

Write-Host "=========================================================="
Write-Host "  Bagan Medical Hall - Pharmacy POS & Accounting Server Started!"
Write-Host "  URL: http://localhost:$port/"
Write-Host "  Serving from: $root"
Write-Host "  Image Uploads Folder: $imageDir"
Write-Host "  Press Ctrl+C to stop the server."
Write-Host "=========================================================="

Start-Process "http://localhost:$port/"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Add CORS headers
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $urlPath = $request.Url.LocalPath

        # Handle Media Center Listing API Endpoint
        if ($request.HttpMethod -eq "GET" -and ($urlPath -eq "/api/media" -or $urlPath -eq "/upload.php")) {
            $filesList = @()
            if (Test-Path $imageDir) {
                $rawFiles = Get-ChildItem -Path $imageDir -File
                foreach ($f in $rawFiles) {
                    $ext = $f.Extension.ToLower()
                    if ($mimeTypes.ContainsKey($ext)) {
                        $filesList += @{
                            filename     = $f.Name
                            path         = "website_images/$($f.Name)"
                            size         = $f.Length
                            lastModified = $f.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                        }
                    }
                }
            }

            $listJson = @{ success = $true; files = $filesList } | ConvertTo-Json
            $listBytes = [System.Text.Encoding]::UTF8.GetBytes($listJson)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $listBytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($listBytes, 0, $listBytes.Length)
            $response.Close()
            continue
        }

        # Handle Media Delete API Endpoint
        if (($request.HttpMethod -eq "DELETE" -or ($request.HttpMethod -eq "GET" -and $request.QueryString["action"] -eq "delete") -or ($request.HttpMethod -eq "POST" -and $request.QueryString["action"] -eq "delete")) -and ($urlPath -eq "/api/media" -or $urlPath -eq "/upload.php")) {
            $filenameParam = $request.QueryString["filename"]
            $resObj = @{ success = $false; message = "Filename parameter required" }
            if ($filenameParam) {
                $safeName = [System.IO.Path]::GetFileName($filenameParam)
                $targetFile = Join-Path $imageDir $safeName
                if (Test-Path $targetFile -PathType Leaf) {
                    Remove-Item $targetFile -Force -ErrorAction SilentlyContinue
                    $resObj = @{ success = $true; message = "File deleted successfully"; filename = $safeName }
                } else {
                    $resObj = @{ success = $true; message = "File not found or already deleted"; filename = $safeName }
                }
            }

            $delJson = $resObj | ConvertTo-Json
            $delBytes = [System.Text.Encoding]::UTF8.GetBytes($delJson)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $delBytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($delBytes, 0, $delBytes.Length)
            $response.Close()
            continue
        }

        # Handle Image Upload API Endpoint (Enforces .webp conversion & storage)
        if ($request.HttpMethod -eq "POST" -and ($urlPath -eq "/api/upload" -or $urlPath -eq "/upload.php")) {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $body = $reader.ReadToEnd()
            $reader.Close()

            $resObj = @{ success = $false; message = "Invalid upload payload" }

            try {
                $payload = $body | ConvertFrom-Json
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
                    if ($dataStr.Contains(',')) {
                        $dataStr = $dataStr.Split(',')[1]
                    }

                    $bytes = [System.Convert]::FromBase64String($dataStr)
                    [System.IO.File]::WriteAllBytes($targetPath, $bytes)

                    $resObj = @{
                        success  = $true
                        path     = "website_images/$cleanName"
                        filename = $cleanName
                        size     = $bytes.Length
                        format   = "webp"
                    }
                }
            } catch {
                $resObj = @{ success = $false; message = $_.Exception.Message }
            }

            $resJson = $resObj | ConvertTo-Json
            $resBytes = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $resBytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }

        # Static File Serving
        if ($urlPath -eq "/" -or [string]::IsNullOrWhiteSpace($urlPath)) {
            $urlPath = "/index.html"
        }

        $cleanRel = $urlPath.TrimStart("/").Replace("/", "\")
        $localPath = Join-Path $root $cleanRel

        if (Test-Path $localPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $mime = "application/octet-stream"
            if ($mimeTypes.ContainsKey($ext)) {
                $mime = $mimeTypes[$ext]
            }

            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    } catch {
        # ignore client disconnects
    }
}
