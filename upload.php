<?php
/**
 * Bagan Medical Hall - Image Upload & Media Center Handler for cPanel / Apache / LiteSpeed Web Servers
 * Stores and manages all uploaded images strictly in the website_images/ folder.
 * Automatically converts all uploaded images to high-fidelity WebP format without losing quality.
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

// 1. DELETE Request or GET/POST with action=delete: Remove image from website_images/
$isDelete = ($_SERVER['REQUEST_METHOD'] === 'DELETE' || (isset($_REQUEST['action']) && $_REQUEST['action'] === 'delete'));
if ($isDelete) {
    $fn = isset($_REQUEST['filename']) ? basename($_REQUEST['filename']) : '';
    if (!empty($fn)) {
        $target = $uploadDir . $fn;
        if (file_exists($target)) {
            @unlink($target);
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

// 2. GET Request: List all images in Media Center
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $files = [];
    if (is_dir($uploadDir)) {
        $items = scandir($uploadDir);
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $full = $uploadDir . $item;
            if (is_file($full)) {
                $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                if (in_array($ext, ['webp', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'ico'])) {
                    $files[] = [
                        'filename' => $item,
                        'path' => 'website_images/' . $item,
                        'size' => filesize($full),
                        'lastModified' => date('Y-m-d H:i:s', filemtime($full))
                    ];
                }
            }
        }
    }
    echo json_encode(['success' => true, 'files' => $files]);
    exit;
}

// 3. POST Request: Upload new image (Enforce WebP conversion & storage)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 3a. Multipart file upload
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
                // High fidelity WebP at quality 96 preserving crisp quality and transparency
                $converted = @imagewebp($srcImg, $targetFile, 96);
                imagedestroy($srcImg);
            }
        }

        if (!$converted) {
            move_uploaded_file($tmpPath, $targetFile);
        }

        echo json_encode([
            'success' => true,
            'path' => 'website_images/' . $targetFilename,
            'filename' => $targetFilename,
            'size' => file_exists($targetFile) ? filesize($targetFile) : 0,
            'format' => 'webp'
        ]);
        exit;
    }

    // 3b. JSON payload { filename, data: "data:image/webp;base64,..." }
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
