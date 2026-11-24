<?php
/**
 * Bagan Medical Hall - Image Upload & Media Center Handler for cPanel / Apache / LiteSpeed Web Servers
 * Stores and manages all uploaded images strictly in the website_images/ directory.
 * Automatically converts all uploaded images to high-fidelity WebP format without losing quality
 * and regenerates static website_images/images.json and website_images/settings.json.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$uploadDir = __DIR__ . '/website_images/';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}

function updateImageManifest($dir) {
    if (!is_dir($dir)) return [];
    $files = [];
    $items = scandir($dir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..' || $item === 'images.json' || $item === 'manifest.json' || $item === 'settings.json') continue;
        $full = $dir . $item;
        if (is_file($full)) {
            $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
            if (in_array($ext, ['webp', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'ico'])) {
                $files[] = [
                    'filename' => $item,
                    'path' => 'website_images/' . $item,
                    'size' => filesize($full),
                    'format' => $ext,
                    'title' => (strpos($item, 'bagan') !== false) ? 'Bagan Medical Hall Official Logo' : 'Asset (' . $item . ')',
                    'lastModified' => date('Y-m-d H:i:s', filemtime($full))
                ];
            }
        }
    }
    $catalog = ['success' => true, 'folder' => 'website_images', 'files' => $files];
    $json = json_encode($catalog, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    @file_put_contents($dir . 'images.json', $json);
    @file_put_contents($dir . 'manifest.json', $json);
    return $files;
}

// 1. Save Settings (Active Logo Configuration in website_images/settings.json)
if (isset($_REQUEST['action']) && $_REQUEST['action'] === 'save_settings' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        file_put_contents($uploadDir . 'settings.json', $rawInput);
        echo json_encode(['success' => true, 'message' => 'Settings saved to website_images/settings.json']);
        exit;
    }
}

// 2. DELETE Request or GET/POST with action=delete: Remove image from website_images/
$isDelete = ($_SERVER['REQUEST_METHOD'] === 'DELETE' || (isset($_REQUEST['action']) && $_REQUEST['action'] === 'delete'));
if ($isDelete) {
    $fn = isset($_REQUEST['filename']) ? basename($_REQUEST['filename']) : '';
    if (!empty($fn)) {
        $target = $uploadDir . $fn;
        if (file_exists($target)) {
            @unlink($target);
            updateImageManifest($uploadDir);
            echo json_encode(['success' => true, 'message' => "File {$fn} deleted from website_images/"]);
            exit;
        } else {
            echo json_encode(['success' => true, 'message' => "File {$fn} not found or already deleted"]);
            exit;
        }
    }
    echo json_encode(['success' => false, 'message' => 'Missing filename parameter']);
    exit;
}

// 3. GET Request: List all images in Media Center
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $files = updateImageManifest($uploadDir);
    echo json_encode(['success' => true, 'files' => $files]);
    exit;
}

// 4. POST Request: Upload new image (Enforce WebP conversion & storage in website_images/)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 4a. Multipart file upload
    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $origName = basename($_FILES['file']['name']);
        $rawBase = pathinfo($origName, PATHINFO_FILENAME);
        $cleanBase = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $rawBase);
        if (empty($cleanBase)) {
            $cleanBase = 'image_' . time();
        }
        $targetFilename = $cleanBase . '.webp';
        $targetFile = $uploadDir . $targetFilename;
        $tmpPath = $_FILES['file']['tmp_name'];
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

        $converted = false;
        if (function_exists('imagewebp') && in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'bmp'])) {
            $srcImg = null;
            if ($ext === 'jpg' || $ext === 'jpeg') {
                $srcImg = @imagecreatefromjpeg($tmpPath);
            } elseif ($ext === 'png') {
                $srcImg = @imagecreatefrompng($tmpPath);
                if ($srcImg) {
                    imagepalettetotruecolor($srcImg);
                    imagealphablending($srcImg, true);
                    imagesavealpha($srcImg, true);
                }
            } elseif ($ext === 'gif') {
                $srcImg = @imagecreatefromgif($tmpPath);
            } elseif ($ext === 'bmp' && function_exists('imagecreatefrombmp')) {
                $srcImg = @imagecreatefrombmp($tmpPath);
            }

            if ($srcImg) {
                $converted = @imagewebp($srcImg, $targetFile, 96);
                imagedestroy($srcImg);
            }
        }

        if (!$converted) {
            move_uploaded_file($tmpPath, $targetFile);
        }

        updateImageManifest($uploadDir);

        echo json_encode([
            'success' => true,
            'path' => 'website_images/' . $targetFilename,
            'filename' => $targetFilename,
            'size' => file_exists($targetFile) ? filesize($targetFile) : 0,
            'format' => 'webp'
        ]);
        exit;
    }

    // 4b. JSON payload { filename, data: "data:image/webp;base64,..." }
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if ($payload && !empty($payload['filename']) && !empty($payload['data'])) {
        $rawFilename = basename($payload['filename']);
        $rawBase = pathinfo($rawFilename, PATHINFO_FILENAME);
        $cleanBase = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $rawBase);
        if (empty($cleanBase)) {
            $cleanBase = 'image_' . time();
        }
        $targetFilename = $cleanBase . '.webp';
        $targetFile = $uploadDir . $targetFilename;

        $base64 = $payload['data'];
        if (strpos($base64, ',') !== false) {
            $parts = explode(',', $base64);
            $base64 = $parts[1];
        }

        $binary = base64_decode($base64);
        if ($binary !== false) {
            file_put_contents($targetFile, $binary);
            updateImageManifest($uploadDir);
            echo json_encode([
                'success' => true,
                'path' => 'website_images/' . $targetFilename,
                'filename' => $targetFilename,
                'size' => strlen($binary),
                'format' => 'webp'
            ]);
            exit;
        } else {
            echo json_encode(['success' => false, 'message' => 'Base64 decoding failed']);
            exit;
        }
    }

    echo json_encode(['success' => false, 'message' => 'No image file or data was provided']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Method not supported']);
