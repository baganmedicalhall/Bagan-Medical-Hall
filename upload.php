<?php
/**
 * Bagan Medical Hall - Image Upload & Media Center Handler for cPanel / Apache / LiteSpeed Web Servers
 * Stores and manages all uploaded images strictly in the /website_images folder.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$uploadDir = __DIR__ . '/website_images/';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}

// 1. GET Request: List all images in Media Center
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $files = [];
    if (is_dir($uploadDir)) {
        $items = scandir($uploadDir);
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $full = $uploadDir . $item;
            if (is_file($full)) {
                $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'])) {
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

// 2. POST Request: Upload new image
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 2a. Check for standard multipart file upload
    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $origName = basename($_FILES['file']['name']);
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'];
        
        if (!in_array($ext, $allowed)) {
            echo json_encode(['success' => false, 'message' => 'Invalid file extension. Only image formats allowed.']);
            exit;
        }

        $cleanName = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $origName);
        $targetFile = $uploadDir . $cleanName;

        if (move_uploaded_file($_FILES['file']['tmp_name'], $targetFile)) {
            echo json_encode([
                'success' => true,
                'path' => 'website_images/' . $cleanName,
                'filename' => $cleanName,
                'size' => filesize($targetFile)
            ]);
            exit;
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to save file to website_images/']);
            exit;
        }
    }

    // 2b. Check for JSON payload { filename, data }
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if ($payload && !empty($payload['filename']) && !empty($payload['data'])) {
        $rawFilename = basename($payload['filename']);
        $ext = strtolower(pathinfo($rawFilename, PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'];

        if (!in_array($ext, $allowed)) {
            $ext = 'png';
            $rawFilename .= '.png';
        }

        $cleanName = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $rawFilename);
        $targetFile = $uploadDir . $cleanName;

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
                'path' => 'website_images/' . $cleanName,
                'filename' => $cleanName,
                'size' => strlen($binary)
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
