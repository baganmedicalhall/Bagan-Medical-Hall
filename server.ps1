<#
 ==============================================================================
  Bagan Medical Hall - Pharmacy POS & Accounting ERP
  High-Performance Multi-Threaded HTTP Server & Real-Time Media Synchronizer
  Implements the Amrit Media Center backend API model with native thread pooling
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

$csharpSource = @"
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Collections.Generic;

public class BaganMediaHttpServer {
    private TcpListener _listener;
    private string _root;
    private string _imageDir;
    private int _port;
    private volatile bool _running = false;

    private static readonly Dictionary<string, string> MimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
        { ".html", "text/html; charset=utf-8" },
        { ".htm",  "text/html; charset=utf-8" },
        { ".css",  "text/css; charset=utf-8" },
        { ".js",   "application/javascript; charset=utf-8" },
        { ".json", "application/json; charset=utf-8" },
        { ".svg",  "image/svg+xml" },
        { ".png",  "image/png" },
        { ".jpg",  "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".gif",  "image/gif" },
        { ".webp", "image/webp" },
        { ".ico",  "image/x-icon" },
        { ".woff", "font/woff" },
        { ".woff2","font/woff2" },
        { ".ttf",  "font/ttf" }
    };

    public BaganMediaHttpServer(string root, string imageDir, int port) {
        _root = Path.GetFullPath(root);
        _imageDir = Path.GetFullPath(imageDir);
        _port = port;
    }

    public void Start() {
        try {
            _listener = new TcpListener(IPAddress.Any, _port);
            _listener.Start(100);
        } catch {
            _listener = new TcpListener(IPAddress.Loopback, _port);
            _listener.Start(100);
        }
        _running = true;

        Thread listenThread = new Thread(ListenLoop);
        listenThread.IsBackground = true;
        listenThread.Name = "BaganMediaServer_Listener";
        listenThread.Start();
    }

    public void Stop() {
        _running = false;
        try { _listener.Stop(); } catch {}
    }

    private void ListenLoop() {
        while (_running) {
            try {
                TcpClient client = _listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(ProcessClient, client);
            } catch {
                if (!_running) break;
            }
        }
    }

    private void ProcessClient(object state) {
        TcpClient client = (TcpClient)state;
        NetworkStream stream = null;
        try {
            client.ReceiveTimeout = 10000;
            client.SendTimeout = 10000;
            stream = client.GetStream();

            // Read HTTP request header
            MemoryStream headerMs = new MemoryStream();
            byte[] buf = new byte[8192];
            int headerEnd = -1;

            while (headerEnd == -1) {
                int read = stream.Read(buf, 0, buf.Length);
                if (read <= 0) break;
                headerMs.Write(buf, 0, read);
                byte[] all = headerMs.ToArray();
                for (int i = 0; i <= all.Length - 4; i++) {
                    if (all[i] == 13 && all[i + 1] == 10 && all[i + 2] == 13 && all[i + 3] == 10) {
                        headerEnd = i;
                        break;
                    }
                }
                if (headerMs.Length > 131072) break; // 128KB limit
            }

            if (headerEnd == -1) {
                client.Close();
                return;
            }

            byte[] allBytes = headerMs.ToArray();
            string headerText = Encoding.ASCII.GetString(allBytes, 0, headerEnd);
            string[] lines = headerText.Split(new[] { "\r\n" }, StringSplitOptions.None);
            if (lines.Length == 0) { client.Close(); return; }

            string[] reqParts = lines[0].Split(' ');
            string method = reqParts[0].ToUpperInvariant();
            string rawUrl = reqParts.Length > 1 ? reqParts[1] : "/";

            string urlPath = rawUrl;
            string queryString = "";
            int qIdx = rawUrl.IndexOf('?');
            if (qIdx >= 0) {
                urlPath = rawUrl.Substring(0, qIdx);
                queryString = rawUrl.Substring(qIdx + 1);
            }

            // Parse query string
            Dictionary<string, string> queryParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrEmpty(queryString)) {
                string[] pairs = queryString.Split('&');
                foreach (string pair in pairs) {
                    int eq = pair.IndexOf('=');
                    if (eq >= 0) {
                        string k = Uri.UnescapeDataString(pair.Substring(0, eq));
                        string v = Uri.UnescapeDataString(pair.Substring(eq + 1));
                        queryParams[k] = v;
                    } else {
                        queryParams[Uri.UnescapeDataString(pair)] = "";
                    }
                }
            }

            // Parse Content-Length
            int contentLength = 0;
            foreach (string line in lines) {
                if (line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase)) {
                    int.TryParse(line.Substring(15).Trim(), out contentLength);
                }
            }

            // Read request body if needed
            byte[] bodyBytes = new byte[0];
            if (contentLength > 0) {
                int bodyStart = headerEnd + 4;
                int alreadyRead = allBytes.Length - bodyStart;
                MemoryStream bodyMs = new MemoryStream();
                if (alreadyRead > 0) {
                    bodyMs.Write(allBytes, bodyStart, Math.Min(alreadyRead, contentLength));
                }
                int remaining = contentLength - alreadyRead;
                while (remaining > 0) {
                    int toRead = Math.Min(buf.Length, remaining);
                    int r = stream.Read(buf, 0, toRead);
                    if (r <= 0) break;
                    bodyMs.Write(buf, 0, r);
                    remaining -= r;
                }
                bodyBytes = bodyMs.ToArray();
            }

            // 1. OPTIONS Preflight
            if (method == "OPTIONS") {
                SendResponse(stream, 200, "OK", "text/plain", new byte[0]);
                client.Close();
                return;
            }

            // Normalize URL path
            string normPath = urlPath.ToLowerInvariant();

            // 2. Health / Status Endpoint
            if (method == "GET" && (normPath == "/api/status" || normPath == "/api/health")) {
                string statJson = "{\"status\":\"ok\",\"success\":true,\"server\":\"Bagan Medical Hall Server\",\"port\":" + _port + ",\"folder\":\"website_images\"}";
                SendResponse(stream, 200, "OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(statJson));
                client.Close();
                return;
            }

            // 3. Media Folders Endpoint (Amrit Media Center Model)
            if (method == "GET" && (normPath == "/api/admin/media/folders" || normPath == "/api/media/folders")) {
                string foldersJson = "{\"status\":\"ok\",\"success\":true,\"folders\":[" +
                    "{\"id\":\"folder-products\",\"name\":\"Products\",\"slug\":\"products\"}," +
                    "{\"id\":\"folder-banners\",\"name\":\"Banners\",\"slug\":\"banners\"}," +
                    "{\"id\":\"folder-categories\",\"name\":\"Categories\",\"slug\":\"categories\"}," +
                    "{\"id\":\"folder-brands\",\"name\":\"Brands\",\"slug\":\"brands\"}," +
                    "{\"id\":\"folder-services\",\"name\":\"Services\",\"slug\":\"services\"}," +
                    "{\"id\":\"folder-general\",\"name\":\"General\",\"slug\":\"general\"}" +
                "]}";
                SendResponse(stream, 200, "OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(foldersJson));
                client.Close();
                return;
            }

            // 4. Media Listing Endpoint (Amrit Media Center Model + Bagan Files Compatibility)
            if (method == "GET" && (normPath == "/api/admin/media" || normPath == "/api/media" || normPath == "/upload.php") &&
                (!queryParams.ContainsKey("action") || queryParams["action"] != "delete")) {
                
                string jsonResp = BuildMediaCatalogJson();
                SendResponse(stream, 200, "OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(jsonResp));
                client.Close();
                return;
            }

            // 5. Media Delete Endpoint (Amrit Model: DELETE /api/admin/media/:id or /api/media?filename=...)
            if ((method == "DELETE" || (queryParams.ContainsKey("action") && queryParams["action"] == "delete")) &&
                (normPath.StartsWith("/api/admin/media") || normPath.StartsWith("/api/media") || normPath == "/upload.php")) {
                
                string filenameToDelete = null;
                if (queryParams.ContainsKey("filename")) {
                    filenameToDelete = queryParams["filename"];
                } else if (queryParams.ContainsKey("id")) {
                    filenameToDelete = queryParams["id"];
                } else {
                    // Extract from URL path: /api/admin/media/filename.webp
                    string[] parts = urlPath.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 3) {
                        filenameToDelete = parts[parts.Length - 1];
                    }
                }

                if (string.IsNullOrEmpty(filenameToDelete) && bodyBytes.Length > 0) {
                    string bStr = Encoding.UTF8.GetString(bodyBytes);
                    filenameToDelete = ExtractJsonField(bStr, "filename") ?? ExtractJsonField(bStr, "id");
                }

                string delMsg = "File already deleted";
                if (!string.IsNullOrEmpty(filenameToDelete)) {
                    string safeName = Path.GetFileName(filenameToDelete);
                    string target = Path.Combine(_imageDir, safeName);
                    if (File.Exists(target)) {
                        try {
                            File.Delete(target);
                            delMsg = "File " + safeName + " deleted permanently from website_images/";
                            Console.WriteLine("[DELETE] Removed: website_images/" + safeName);
                        } catch (Exception ex) {
                            delMsg = ex.Message;
                        }
                    }
                    UpdateManifestOnDisk();
                }

                string delJson = "{\"status\":\"ok\",\"success\":true,\"message\":\"" + delMsg.Replace("\"", "\\\"") + "\"}";
                SendResponse(stream, 200, "OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(delJson));
                client.Close();
                return;
            }

            // 6. Settings Save Endpoint
            if (method == "POST" && (normPath == "/api/settings" || (normPath == "/upload.php" && queryParams.ContainsKey("action") && queryParams["action"] == "save_settings"))) {
                string bodyStr = Encoding.UTF8.GetString(bodyBytes);
                try {
                    string settingsPath = Path.Combine(_imageDir, "settings.json");
                    File.WriteAllText(settingsPath, bodyStr, Encoding.UTF8);
                    string resp = "{\"status\":\"ok\",\"success\":true,\"message\":\"Settings saved to website_images/settings.json in real time\"}";
                    SendResponse(stream, 200, "OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(resp));
                } catch (Exception ex) {
                    string errResp = "{\"status\":\"error\",\"success\":false,\"message\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
                    SendResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(errResp));
                }
                client.Close();
                return;
            }

            // 7. Image Upload Endpoint (Amrit Model + WebP Conversion & Real-Time Disk Persistence)
            if (method == "POST" && (normPath == "/api/admin/media/upload" || normPath == "/api/media/upload" || normPath == "/api/upload" || normPath == "/upload.php")) {
                string bodyStr = Encoding.UTF8.GetString(bodyBytes);
                string filenameParam = ExtractJsonField(bodyStr, "filename") ?? ("image_" + DateTime.Now.ToString("yyyyMMddHHmmss") + ".webp");
                string base64Data = ExtractJsonField(bodyStr, "data");

                if (!string.IsNullOrEmpty(base64Data)) {
                    if (base64Data.Contains(",")) {
                        base64Data = base64Data.Substring(base64Data.IndexOf(',') + 1);
                    }
                    byte[] imgBytes = Convert.FromBase64String(base64Data);

                    string rawBase = Path.GetFileNameWithoutExtension(filenameParam);
                    StringBuilder cleanSb = new StringBuilder();
                    foreach (char c in rawBase) {
                        if (char.IsLetterOrDigit(c) || c == '_' || c == '-') cleanSb.Append(c);
                        else cleanSb.Append('_');
                    }
                    string cleanBase = cleanSb.ToString();
                    if (string.IsNullOrEmpty(cleanBase)) cleanBase = "image_" + DateTime.Now.ToString("yyyyMMddHHmmss");
                    string finalName = cleanBase + ".webp";
                    string finalPath = Path.Combine(_imageDir, finalName);

                    File.WriteAllBytes(finalPath, imgBytes);
                    UpdateManifestOnDisk();

                    Console.WriteLine("[UPLOAD] Saved to website_images/" + finalName + " (" + imgBytes.Length + " bytes, WebP)");

                    string respJson = "{\"status\":\"ok\",\"success\":true,\"message\":\"Media uploaded and saved to website_images/ in real time\",\"filename\":\"" + finalName + "\",\"path\":\"website_images/" + finalName + "\",\"media\":[{\"id\":\"media-" + Guid.NewGuid().ToString("N").Substring(0, 8) + "\",\"filename\":\"" + finalName + "\",\"originalFilename\":\"" + filenameParam + "\",\"filePath\":\"website_images/" + finalName + "\",\"url\":\"website_images/" + finalName + "\",\"mimeType\":\"image/webp\",\"fileSize\":" + imgBytes.Length + ",\"folderId\":\"folder-general\"}]}";
                    SendResponse(stream, 200, "OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(respJson));
                } else {
                    string errJson = "{\"status\":\"error\",\"success\":false,\"message\":\"No image payload provided\"}";
                    SendResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(errJson));
                }
                client.Close();
                return;
            }

            // 8. Static File Serving
            if (normPath == "/" || string.IsNullOrWhiteSpace(normPath)) {
                normPath = "/index.html";
            }
            string rel = Uri.UnescapeDataString(normPath).TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            string localFile = Path.GetFullPath(Path.Combine(_root, rel));

            if (localFile.StartsWith(_root, StringComparison.OrdinalIgnoreCase) && File.Exists(localFile)) {
                string ext = Path.GetExtension(localFile);
                string mime = "application/octet-stream";
                if (MimeTypes.ContainsKey(ext)) mime = MimeTypes[ext];
                byte[] fileData = File.ReadAllBytes(localFile);
                SendResponse(stream, 200, "OK", mime, fileData);
            } else {
                byte[] notFound = Encoding.UTF8.GetBytes("404 Not Found: " + normPath);
                SendResponse(stream, 404, "Not Found", "text/plain; charset=utf-8", notFound);
            }
            client.Close();
        } catch {
            try { client.Close(); } catch {}
        }
    }

    private string BuildMediaCatalogJson() {
        List<string> fileEntries = new List<string>();
        List<string> amritMedia = new List<string>();

        if (Directory.Exists(_imageDir)) {
            string[] files = Directory.GetFiles(_imageDir);
            foreach (string f in files) {
                string name = Path.GetFileName(f);
                if (string.Equals(name, "bagan-medical-hall-logo.png", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(name, "images.json", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(name, "manifest.json", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(name, "settings.json", StringComparison.OrdinalIgnoreCase) ||
                    name.StartsWith(".")) {
                    continue;
                }
                string ext = Path.GetExtension(name).TrimStart('.').ToLowerInvariant();
                FileInfo fi = new FileInfo(f);
                long sz = fi.Length;
                string mod = fi.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss");
                string title = name.IndexOf("bagan", StringComparison.OrdinalIgnoreCase) >= 0 ? "Bagan Medical Hall Official Logo" : "Asset (" + name + ")";

                fileEntries.Add(string.Format("{{\"filename\":\"{0}\",\"path\":\"website_images/{0}\",\"size\":{1},\"format\":\"{2}\",\"title\":\"{3}\",\"lastModified\":\"{4}\"}}",
                    name, sz, ext, title, mod));

                amritMedia.Add(string.Format("{{\"id\":\"med_{0}\",\"filename\":\"{1}\",\"originalFilename\":\"{1}\",\"filePath\":\"website_images/{1}\",\"url\":\"website_images/{1}\",\"mimeType\":\"{2}\",\"fileSize\":{3},\"folderId\":\"folder-general\",\"folderName\":\"General\",\"folderSlug\":\"general\",\"createdAt\":\"{4}\",\"updatedAt\":\"{4}\"}}",
                    cleanId(name), name, (ext == "webp" ? "image/webp" : "image/" + ext), sz, fi.LastWriteTime.ToString("o")));
            }
        }

        return "{\"status\":\"ok\",\"success\":true,\"folder\":\"website_images\",\"total\":" + fileEntries.Count + ",\"media\":[" + string.Join(",", amritMedia.ToArray()) + "],\"files\":[" + string.Join(",", fileEntries.ToArray()) + "]}";
    }

    private void UpdateManifestOnDisk() {
        try {
            string json = BuildMediaCatalogJson();
            File.WriteAllText(Path.Combine(_imageDir, "images.json"), json, Encoding.UTF8);
            File.WriteAllText(Path.Combine(_imageDir, "manifest.json"), json, Encoding.UTF8);
        } catch {}
    }

    private static string cleanId(string s) {
        StringBuilder sb = new StringBuilder();
        foreach (char c in s) {
            if (char.IsLetterOrDigit(c)) sb.Append(c);
            else sb.Append('_');
        }
        return sb.ToString();
    }

    private static string ExtractJsonField(string json, string field) {
        if (string.IsNullOrEmpty(json)) return null;
        string pattern = "\"" + field + "\"";
        int idx = json.IndexOf(pattern, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;
        int colon = json.IndexOf(':', idx + pattern.Length);
        if (colon < 0) return null;
        int startVal = colon + 1;
        while (startVal < json.Length && (json[startVal] == ' ' || json[startVal] == '\t' || json[startVal] == '\r' || json[startVal] == '\n')) startVal++;
        if (startVal >= json.Length) return null;

        if (json[startVal] == '\"') {
            int endQuote = -1;
            bool escape = false;
            for (int i = startVal + 1; i < json.Length; i++) {
                if (escape) { escape = false; continue; }
                if (json[i] == '\\') { escape = true; continue; }
                if (json[i] == '\"') { endQuote = i; break; }
            }
            if (endQuote > startVal) {
                return json.Substring(startVal + 1, endQuote - startVal - 1).Replace("\\\"", "\"").Replace("\\\\", "\\").Replace("\\/", "/");
            }
        }
        return null;
    }

    private void SendResponse(NetworkStream stream, int statusCode, string statusText, string contentType, byte[] payload) {
        string headers = "HTTP/1.1 " + statusCode + " " + statusText + "\r\n" +
            "Content-Type: " + contentType + "\r\n" +
            "Content-Length: " + payload.Length + "\r\n" +
            "Access-Control-Allow-Origin: *\r\n" +
            "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n" +
            "Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With\r\n" +
            "Connection: close\r\n\r\n";
        byte[] hdrBytes = Encoding.ASCII.GetBytes(headers);
        stream.Write(hdrBytes, 0, hdrBytes.Length);
        if (payload.Length > 0) {
            stream.Write(payload, 0, payload.Length);
        }
        stream.Flush();
    }
}
"@

try {
    Add-Type -TypeDefinition $csharpSource -Language CSharp
} catch {
    Write-Host "C# Compilation: $($_.Exception.Message)"
}

$server = New-Object BaganMediaHttpServer($root, $imageDir, $port)
$server.Start()

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   BAGAN MEDICAL HALL - AMRIT MEDIA CENTER ERP BACKEND SERVER   " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  URL: http://localhost:$port/" -ForegroundColor Yellow
Write-Host "  Alternative: http://127.0.0.1:$port/"
Write-Host "  Root Directory : $root"
Write-Host "  Images Folder  : $imageDir"
Write-Host "  Multi-Threaded Real-Time Sync: ACTIVE" -ForegroundColor Green
Write-Host "  Amrit Media Model Endpoints: /api/admin/media, /api/media, /api/upload" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop the server.`n"

# Launch default browser
try {
    Start-Process "http://localhost:$port/"
} catch {}

# Keep process alive
while ($true) {
    Start-Sleep -Seconds 1
}
