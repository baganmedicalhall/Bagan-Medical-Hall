<?php
/**
 * Bagan Medical Hall - Upload Compatibility Placeholder
 * 
 * Direct execution of this PHP script is strictly forbidden for security reasons.
 * All media upload, deletion, listing, and asset management operations are handled
 * by the Node.js/Express backend (/upload.php, /api/media, /api/admin/media)
 * with centralized session authentication, dynamic RBAC, and CSRF protection.
 * 
 * For Apache / LiteSpeed server configurations, ensure direct execution is blocked in .htaccess:
 * <Files "upload.php">
 *     Order Allow,Deny
 *     Deny from all
 * </Files>
 */
header('Content-Type: application/json');
http_response_code(403);
echo json_encode([
    'success' => false,
    'error' => 'DIRECT_PHP_EXECUTION_FORBIDDEN',
    'message' => 'Direct PHP execution is disabled. Media operations must be routed through the Node.js backend with centralized authentication and CSRF protection.'
]);
exit;
