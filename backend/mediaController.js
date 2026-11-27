// mediaController.js - Full-stack Media Center controller for Amrit Store
// Supports HimalayanHost filesystem storage (public/uploads/media/) and PostgreSQL metadata

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
let sharp = null;
try {
  const sharpModule = await import('sharp');
  sharp = sharpModule.default || sharpModule;
} catch (_) {}

let multer = null;
try {
  const multerModule = await import('multer');
  multer = multerModule.default || multerModule;
} catch (_) {}
import { query as defaultDbQuery, verifyMediaSchemaReadiness } from './db.js';
export { verifyMediaSchemaReadiness };

let mediaPool = null;
async function dbQuery(sql, params = []) {
  if (mediaPool && typeof mediaPool.query === 'function') {
    return mediaPool.query(sql, params);
  }
  return defaultDbQuery(sql, params);
}

// Permanent system branding and configuration assets that must never be deleted
export const PROTECTED_SYSTEM_FILES = new Set([
  'bagan-medical-hall-logo.png',
  'default-logo.svg',
  'default-logo-colored.svg',
  'default-logo-white.svg',
  'default-logo-fallback.svg',
  'favicon.ico',
  'images.json',
  'manifest.json',
  'settings.json',
]);

let ROOT_MEDIA_DIR = process.env.MEDIA_UPLOAD_DIR || path.join(process.cwd(), 'website_images');
let MEDIA_PUBLIC_URL_PREFIX = process.env.MEDIA_PUBLIC_URL_PREFIX || '/website_images';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/**
 * Validates media storage configuration against production security requirements.
 * In production:
 * - MEDIA_UPLOAD_DIR must be explicitly defined (silent fallback prohibited).
 * - MEDIA_UPLOAD_DIR must be an absolute path matching the public document root.
 * - MEDIA_UPLOAD_DIR must be writable.
 *
 * @param {object} [env] Environment map (defaults to process.env)
 * @returns {{ isProduction: boolean, uploadDir: string }}
 */
export function validateMediaStorageConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const rawDir = env.MEDIA_UPLOAD_DIR;

  if (isProd) {
    if (!rawDir || !rawDir.trim()) {
      throw new Error("[SECURITY CONFIG ERROR] In production, MEDIA_UPLOAD_DIR must be explicitly configured as an absolute path matching the public media document root. Silent fallback to backend local directory is prohibited.");
    }
    if (!path.isAbsolute(rawDir.trim())) {
      throw new Error(`[SECURITY CONFIG ERROR] In production, MEDIA_UPLOAD_DIR must be an absolute path. Received relative path: '${rawDir}'. Server startup halted.`);
    }
  }

  const resolvedDir = rawDir && rawDir.trim()
    ? path.resolve(rawDir.trim())
    : path.join(process.cwd(), 'website_images');

  try {
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    }
    const probeFile = path.join(resolvedDir, `.probe_write_${Date.now()}`);
    fs.writeFileSync(probeFile, 'probe');
    fs.unlinkSync(probeFile);
  } catch (fsErr) {
    if (isProd) {
      throw new Error(`[SECURITY CONFIG ERROR] Configured MEDIA_UPLOAD_DIR '${resolvedDir}' is not writable: ${fsErr.message}. Server startup halted.`);
    }
  }

  return { isProduction: isProd, uploadDir: resolvedDir };
}

// Memory storage for Multer: image is kept in buffer so Sharp can convert it directly to WebP before writing to disk
export const uploadMiddleware = (multer && typeof multer === 'function')
  ? multer({
      storage: (multer.memoryStorage && typeof multer.memoryStorage === 'function') ? multer.memoryStorage() : undefined,
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: 10,
      },
      fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
          return cb(new Error('Only JPEG, PNG, and WEBP image formats are supported.'), false);
        }
        cb(null, true);
      },
    })
  : {
      array: () => (req, res, next) => next(),
      single: () => (req, res, next) => next(),
    };

// Helper: Ensure directory exists synchronously
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Helper: Sanitize folder slug (strictly alphanumeric, dashes, underscores)
export function sanitizeSlug(slug) {
  if (!slug || typeof slug !== 'string') return 'general';
  const clean = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean || 'general';
}

// Helper: Sanitize base filename
export function sanitizeBaseFilename(originalName) {
  const parsed = path.parse(originalName || 'image');
  const safeName = parsed.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return safeName || 'media';
}

// verifyMediaSchemaReadiness is imported from ./db.js (the authoritative single source of truth) and re-exported.

/**
 * Verifies that all authoritative database migrations (001, 002, 003)
 * have been executed in sequence against the database.
 * 
 * @param {object} pool PostgreSQL connection pool
 * @returns {Promise<{ success: boolean, applied: string[] }>}
 */
export async function verifyAllMigrations(pool) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('A PostgreSQL-compatible pool is required to verify database migrations.');
  }

  let res;
  try {
    res = await pool.query('SELECT version FROM schema_migrations ORDER BY applied_at ASC');
  } catch (err) {
    throw new Error(`[SCHEMA ERROR] Unable to query schema_migrations: ${err.message}. Ensure base migrations have been applied (database/001_auth_system.sql).`);
  }

  const applied = (res.rows || []).map(r => r.version);
  const required = ['001_auth_system', '002_password_reset_isolation', '003_media_center'];
  const missing = required.filter(v => !applied.includes(v));

  if (missing.length > 0) {
    throw new Error(
      `[SCHEMA ERROR] Mandatory database migration(s) missing: ${missing.join(', ')}. Please execute migrations in sequence (001_auth_system.sql, 002_password_reset_isolation.sql, 003_media_center.sql).`
    );
  }

  return { success: true, applied };
}

// Initialize filesystem folders and verify database schema readiness
export async function initMediaSystem(pool, options = {}) {
  if (!pool || typeof pool.query !== 'function') throw Error('A PostgreSQL-compatible pool is required.');
  mediaPool = pool;

  const isProd = process.env.NODE_ENV === 'production';
  const rawDir = options.uploadDir || process.env.MEDIA_UPLOAD_DIR;
  if (isProd) {
    if (!rawDir || !rawDir.trim()) {
      throw new Error("[SECURITY CONFIG ERROR] In production, MEDIA_UPLOAD_DIR must be explicitly defined as an absolute path. Silent fallback is prohibited.");
    }
    if (!path.isAbsolute(rawDir.trim())) {
      throw new Error(`[SECURITY CONFIG ERROR] In production, MEDIA_UPLOAD_DIR must be an absolute path. Received relative path: '${rawDir}'.`);
    }
  }

  ROOT_MEDIA_DIR = path.resolve(rawDir || ROOT_MEDIA_DIR);
  MEDIA_PUBLIC_URL_PREFIX = (options.publicUrlPrefix || process.env.MEDIA_PUBLIC_URL_PREFIX || MEDIA_PUBLIC_URL_PREFIX).replace(/\/$/, '');
  try {
    ensureDirectory(ROOT_MEDIA_DIR);
    // Verify directory writability
    const probe = path.join(ROOT_MEDIA_DIR, `.probe_init_${Date.now()}`);
    fs.writeFileSync(probe, 'w');
    fs.unlinkSync(probe);

    const standardFolders = ['products', 'banners', 'categories', 'brands', 'services', 'general'];
    for (const folder of standardFolders) {
      ensureDirectory(path.join(ROOT_MEDIA_DIR, folder));
    }

    // Verify database schema readiness (Migrations are sole authority; NO runtime DDL)
    await verifyMediaSchemaReadiness(pool);

    console.log('[MEDIA] Media Center system verified and initialized on HimalayanHost filesystem.');
  } catch (err) {
    console.error('[MEDIA] initMediaSystem failed:', err.message);
    throw err;
  }
}

// Controller Methods

/**
 * GET /api/admin/media
 * Fetch all media files with optional folder filtering, searching, and sorting
 */
export async function getMediaFiles(req, res) {
  try {
    const { folderId, search, sort = 'newest', limit = 200, offset = 0 } = req.query;

    let sql = `
      SELECT 
        m.id,
        m.filename,
        m.original_filename AS "originalFilename",
        m.file_path AS "filePath",
        m.url,
        m.mime_type AS "mimeType",
        m.file_size AS "fileSize",
        m.width,
        m.height,
        m.folder_id AS "folderId",
        f.name AS "folderName",
        f.slug AS "folderSlug",
        m.created_at AS "createdAt",
        m.updated_at AS "updatedAt"
      FROM media_files m
      LEFT JOIN media_folders f ON m.folder_id = f.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (folderId && folderId !== 'all') {
      if (folderId === 'uncategorized') {
        sql += ` AND m.folder_id IS NULL`;
      } else {
        sql += ` AND m.folder_id = $${paramIndex}`;
        params.push(folderId);
        paramIndex++;
      }
    }

    if (search && search.trim()) {
      sql += ` AND (m.original_filename ILIKE $${paramIndex} OR m.filename ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Sort order
    if (sort === 'oldest') {
      sql += ` ORDER BY m.created_at ASC`;
    } else if (sort === 'name-asc') {
      sql += ` ORDER BY m.original_filename ASC`;
    } else if (sort === 'name-desc') {
      sql += ` ORDER BY m.original_filename DESC`;
    } else if (sort === 'size-desc') {
      sql += ` ORDER BY m.file_size DESC`;
    } else if (sort === 'size-asc') {
      sql += ` ORDER BY m.file_size ASC`;
    } else {
      sql += ` ORDER BY m.created_at DESC`;
    }

    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit) || 200, Number(offset) || 0);

    const result = await dbQuery(sql, params);

    // Get total count
    let countSql = `SELECT COUNT(*)::int AS total FROM media_files m WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;
    if (folderId && folderId !== 'all') {
      if (folderId === 'uncategorized') {
        countSql += ` AND m.folder_id IS NULL`;
      } else {
        countSql += ` AND m.folder_id = $${countParamIndex}`;
        countParams.push(folderId);
        countParamIndex++;
      }
    }
    if (search && search.trim()) {
      countSql += ` AND (m.original_filename ILIKE $${countParamIndex} OR m.filename ILIKE $${countParamIndex})`;
      countParams.push(`%${search.trim()}%`);
    }
    const countResult = await dbQuery(countSql, countParams);
    const total = countResult.rows[0]?.total || 0;

    return res.json({
      status: 'ok',
      media: result.rows || [],
      total,
    });
  } catch (err) {
    console.error('[MEDIA] getMediaFiles error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch media files' });
  }
}

/**
 * POST /api/admin/media/upload
 * Process uploaded files: validate -> convert to WebP via Sharp -> save to HimalayanHost filesystem -> save to PostgreSQL
 */
export async function uploadMedia(req, res) {
  try {
    let files = req.files || (req.file ? [req.file] : []);
    if ((!files || files.length === 0) && req.body?.data) {
      let base64Content = req.body.data;
      if (base64Content.includes(',')) {
        base64Content = base64Content.split(',')[1];
      }
      const buffer = Buffer.from(base64Content, 'base64');
      files = [{
        originalname: req.body.filename || `image_${Date.now()}.png`,
        buffer,
        size: buffer.length,
        mimetype: 'image/png',
      }];
    }
    if (!files || files.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No image files provided for upload.' });
    }

    // Determine target folder
    let targetFolderId = req.body.folderId;
    let folderSlug = 'products';

    if (targetFolderId) {
      const folderRes = await dbQuery('SELECT id, slug, name FROM media_folders WHERE id = $1 OR slug = $1 LIMIT 1', [targetFolderId]);
      if (!folderRes.rows || folderRes.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: `Target media folder "${targetFolderId}" not found.`,
        });
      }
      targetFolderId = folderRes.rows[0].id;
      folderSlug = folderRes.rows[0].slug;
    } else {
      // Default to Products folder if no folder was specified
      const defaultFolderRes = await dbQuery("SELECT id, slug FROM media_folders WHERE slug = 'products' LIMIT 1");
      if (defaultFolderRes.rows && defaultFolderRes.rows.length > 0) {
        targetFolderId = defaultFolderRes.rows[0].id;
        folderSlug = defaultFolderRes.rows[0].slug;
      } else {
        targetFolderId = 'folder-products';
        folderSlug = 'products';
      }
    }

    const cleanFolderSlug = sanitizeSlug(folderSlug);
    const targetDir = path.join(ROOT_MEDIA_DIR, cleanFolderSlug);
    ensureDirectory(targetDir);

    const uploadedMediaList = [];

    for (const file of files) {
      // Validate original file size <= 5MB
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File "${file.originalname}" exceeds the 5 MB maximum size limit.`);
      }

      // Convert image to WebP using Sharp
      const sharpInstance = sharp(file.buffer);
      const metadata = await sharpInstance.metadata();

      const decodedFormat = (metadata.format || '').toLowerCase();
      const allowedDecodedFormats = ['jpeg', 'png', 'webp'];
      if (!allowedDecodedFormats.includes(decodedFormat)) {
        throw new Error(`File "${file.originalname}" has unsupported decoded format "${decodedFormat || 'unknown'}". Only JPEG, PNG, and WEBP image formats are supported.`);
      }

      // Convert to WEBP with high quality (85) and optimal compression effort
      const webpBuffer = await sharpInstance
        .webp({ quality: 85, effort: 4 })
        .toBuffer();

      const webpMetadata = await sharp(webpBuffer).metadata();

      // Generate clean, collision-free filename
      const safeBase = sanitizeBaseFilename(file.originalname);
      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const finalFilename = `${safeBase}-${uniqueSuffix}.webp`;
      const finalFilePath = path.join(targetDir, finalFilename);

      // Save file to HimalayanHost filesystem
      await fs.promises.writeFile(finalFilePath, webpBuffer);

      // Public URL path (served by Express static /uploads and Vite dev)
      const publicUrl = `${MEDIA_PUBLIC_URL_PREFIX}/${cleanFolderSlug}/${finalFilename}`;
      const mediaId = `media-${crypto.randomUUID()}`;

      try {
        // Insert record into PostgreSQL
        await dbQuery(
          `INSERT INTO media_files 
            (id, filename, original_filename, file_path, url, mime_type, file_size, width, height, folder_id, created_at, updated_at)
           VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            mediaId,
            finalFilename,
            file.originalname,
            finalFilePath,
            publicUrl,
            'image/webp',
            webpBuffer.length,
            webpMetadata.width || metadata.width || null,
            webpMetadata.height || metadata.height || null,
            targetFolderId,
          ]
        );
      } catch (insertErr) {
        // Clean up newly created WEBP file if database insert fails so orphan files are not left behind
        try {
          await fs.promises.unlink(finalFilePath);
        } catch (cleanupErr) {
          console.warn('[MEDIA] Failed to clean up orphan file after insert failure:', cleanupErr.message);
        }
        throw insertErr;
      }

      uploadedMediaList.push({
        id: mediaId,
        filename: finalFilename,
        originalFilename: file.originalname,
        filePath: finalFilePath,
        url: publicUrl,
        mimeType: 'image/webp',
        fileSize: webpBuffer.length,
        width: webpMetadata.width || metadata.width,
        height: webpMetadata.height || metadata.height,
        folderId: targetFolderId,
        folderSlug: cleanFolderSlug,
        createdAt: new Date().toISOString(),
      });
    }

    return res.status(201).json({
      status: 'ok',
      message: `${uploadedMediaList.length} image(s) converted to WebP and saved successfully.`,
      media: uploadedMediaList.length === 1 ? uploadedMediaList[0] : uploadedMediaList,
      all: uploadedMediaList,
    });
  } catch (err) {
    console.error('[MEDIA] uploadMedia error:', err);
    return res.status(400).json({ status: 'error', message: err.message || 'Image upload failed.' });
  }
}

/**
 * PUT /api/admin/media/:id
 * Update media metadata (e.g. move to another folder or change label)
 */
export async function updateMedia(req, res) {
  try {
    const { id } = req.params;
    const { folderId, originalFilename } = req.body;

    const existingRes = await dbQuery('SELECT * FROM media_files WHERE id = $1 LIMIT 1', [id]);
    if (!existingRes.rows || existingRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Media record not found.' });
    }

    const currentMedia = existingRes.rows[0];
    let newFilePath = currentMedia.file_path;
    let newUrl = currentMedia.url;
    let targetFolderId = currentMedia.folder_id;
    let newFolderSlug = null;

    // Handle folder move
    if (folderId !== undefined && folderId !== currentMedia.folder_id) {
      const folderRes = await dbQuery('SELECT id, slug FROM media_folders WHERE id = $1 OR slug = $1 LIMIT 1', [folderId]);
      if (!folderRes.rows || folderRes.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: `Target folder "${folderId}" not found.` });
      }

      const targetFolder = folderRes.rows[0];
      newFolderSlug = sanitizeSlug(targetFolder.slug);
      const newDir = path.join(ROOT_MEDIA_DIR, newFolderSlug);
      ensureDirectory(newDir);

      const destPath = path.join(newDir, currentMedia.filename);

      // Verify source file exists before moving
      try {
        await fs.promises.access(currentMedia.file_path, fs.constants.F_OK);
      } catch (accessErr) {
        if (accessErr.code === 'ENOENT') {
          return res.status(404).json({
            status: 'error',
            message: `Source media file not found on filesystem (${currentMedia.filename}). Cannot move file.`,
          });
        }
        console.error('[MEDIA] Error accessing source file:', accessErr);
        return res.status(500).json({
          status: 'error',
          message: 'Error accessing source media file on filesystem.',
        });
      }

      // Move physical file to destination directory
      try {
        await fs.promises.rename(currentMedia.file_path, destPath);
      } catch (renameErr) {
        console.error('[MEDIA] Error moving file on filesystem:', renameErr);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to move media file on filesystem.',
        });
      }

      newFilePath = destPath;
      newUrl = `${MEDIA_PUBLIC_URL_PREFIX}/${newFolderSlug}/${currentMedia.filename}`;
      targetFolderId = targetFolder.id;
    }

    const newOriginalName = (originalFilename && typeof originalFilename === 'string')
      ? originalFilename.trim()
      : currentMedia.original_filename;

    await dbQuery(
      `UPDATE media_files 
       SET original_filename = $1, file_path = $2, url = $3, folder_id = $4, updated_at = NOW() 
       WHERE id = $5`,
      [newOriginalName, newFilePath, newUrl, targetFolderId, id]
    );

    return res.json({
      status: 'ok',
      message: 'Media updated successfully.',
      media: {
        id,
        filename: currentMedia.filename,
        originalFilename: newOriginalName,
        filePath: newFilePath,
        url: newUrl,
        folderId: targetFolderId,
        folderSlug: newFolderSlug,
      },
    });
  } catch (err) {
    console.error('[MEDIA] updateMedia error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to update media.' });
  }
}

/**
 * Multi-Tier Reference Check: Scans database and filesystem references.
 *
 * @param {string} filename Base filename (e.g. 'logo-main.webp')
 * @returns {Promise<{ isReferenced: boolean, reason?: string, source?: string }>}
 */
export async function checkMediaReferences(filename) {
  if (!filename || typeof filename !== 'string') {
    return { isReferenced: false };
  }

  const cleanName = path.basename(filename).toLowerCase();

  // Tier 0: Critical Protected System Assets
  if (PROTECTED_SYSTEM_FILES.has(cleanName)) {
    return {
      isReferenced: true,
      reason: `"${cleanName}" is a permanently protected system branding/configuration asset.`,
      source: 'system:core',
    };
  }

  // Tier 1: Check Database System Settings (system_settings table)
  try {
    const settingsRes = await dbQuery(
      `SELECT key, value FROM system_settings 
       WHERE key IN ('logoColored', 'logoWhite', 'fallbackLogoImage', 'logoImage', 'favicon')
          OR value ILIKE $1 
       LIMIT 1`,
      [`%${cleanName}%`]
    );
    if (settingsRes.rows && settingsRes.rows.length > 0) {
      const match = settingsRes.rows[0];
      return {
        isReferenced: true,
        reason: `Referenced as active branding setting "${match.key}" in system_settings database table.`,
        source: 'database:system_settings',
      };
    }
  } catch (err) {
    // If system_settings table does not exist or db error, log and proceed to filesystem checks
    console.warn('[MEDIA] checkMediaReferences DB system_settings check skipped:', err.message);
  }

  // Tier 2: Check Filesystem Settings (settings.json in ROOT_MEDIA_DIR or website_images)
  const candidateSettingsPaths = [
    path.join(ROOT_MEDIA_DIR, 'settings.json'),
    path.join(process.cwd(), 'website_images', 'settings.json'),
  ];

  for (const settingsPath of candidateSettingsPaths) {
    if (fs.existsSync(settingsPath)) {
      try {
        const raw = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(raw);
        for (const [key, val] of Object.entries(settings)) {
          if (typeof val === 'string' && val.toLowerCase().includes(cleanName)) {
            return {
              isReferenced: true,
              reason: `Referenced as "${key}" in settings.json (${val}).`,
              source: 'filesystem:settings.json',
            };
          }
        }
      } catch (err) {
        console.warn('[MEDIA] Failed to parse settings.json:', err.message);
      }
    }
  }

  // Tier 3: Check Medicine Catalogue in Database (medicines table image column)
  try {
    const medRes = await dbQuery(
      `SELECT id, name FROM medicines 
       WHERE image ILIKE $1 
       LIMIT 1`,
      [`%${cleanName}%`]
    );
    if (medRes.rows && medRes.rows.length > 0) {
      const med = medRes.rows[0];
      return {
        isReferenced: true,
        reason: `Referenced by medicine "${med.name}" (ID: ${med.id}) in pharmaceutical catalogue.`,
        source: 'database:medicines',
      };
    }
  } catch (err) {
    // medicines table may not have image column or table may not exist in test env
  }

  return { isReferenced: false };
}

/**
 * DELETE /api/admin/media/:id
 * Delete media file after validating permissions, protected system files, and multi-tier reference checks.
 */
export async function deleteMedia(req, res) {
  try {
    const targetIdentifier = req.params?.id || req.query?.filename || req.body?.filename;
    if (!targetIdentifier) {
      return res.status(400).json({ status: 'error', message: 'Target media ID or filename is required.' });
    }

    // 1. Identify media record in DB (if stored) or find on disk
    let fileRecord = null;
    try {
      const fileRes = await dbQuery(
        'SELECT * FROM media_files WHERE id = $1 OR filename = $1 LIMIT 1',
        [targetIdentifier]
      );
      if (fileRes.rows && fileRes.rows.length > 0) {
        fileRecord = fileRes.rows[0];
      }
    } catch (_) {}

    const filename = fileRecord ? fileRecord.filename : path.basename(targetIdentifier);
    const safeName = path.basename(filename);

    // 2. Perform Multi-Tier Reference Check
    const refCheck = await checkMediaReferences(safeName);
    if (refCheck.isReferenced) {
      if (refCheck.source === 'system:core') {
        return res.status(403).json({
          status: 'protected',
          code: 'SYSTEM_ASSET_PROTECTED',
          message: `"${safeName}" is a permanently protected system branding asset and cannot be deleted.`,
          reference: refCheck,
        });
      }
      return res.status(409).json({
        status: 'protected',
        code: 'MEDIA_REFERENCED',
        message: `Deletion blocked: Media asset "${safeName}" is protected because it is in active use. ${refCheck.reason}`,
        reference: refCheck,
      });
    }

    // 3. Locate file on filesystem across possible media directories
    const searchDirs = [
      ROOT_MEDIA_DIR,
      path.join(process.cwd(), 'website_images'),
      path.join(process.cwd(), 'public', 'uploads', 'media'),
    ];

    let deletedFromDisk = false;
    for (const baseDir of searchDirs) {
      // Check root of media dir and standard subfolders
      const candidates = [
        path.join(baseDir, safeName),
        path.join(baseDir, 'products', safeName),
        path.join(baseDir, 'banners', safeName),
        path.join(baseDir, 'categories', safeName),
        path.join(baseDir, 'brands', safeName),
        path.join(baseDir, 'services', safeName),
        path.join(baseDir, 'general', safeName),
      ];

      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedFromDisk = true;
        }
      }
    }

    // 4. Remove database record if media_files table exists
    if (fileRecord) {
      try {
        await dbQuery('DELETE FROM media_files WHERE id = $1', [fileRecord.id]);
      } catch (_) {}
    }

    // 5. Update images.json and manifest.json if website_images exists
    try {
      const uploadDir = path.join(process.cwd(), 'website_images');
      if (fs.existsSync(uploadDir)) {
        const rawFiles = fs.readdirSync(uploadDir).filter(f => 
          /\.(webp|png|jpg|jpeg|svg|gif|ico)$/i.test(f) && 
          f.toLowerCase() !== 'bagan-medical-hall-logo.png' &&
          !f.startsWith('.')
        );
        const fileList = rawFiles.map(f => {
          const full = path.join(uploadDir, f);
          const stat = fs.statSync(full);
          const ext = path.extname(f).replace('.', '').toLowerCase();
          return {
            filename: f,
            path: `website_images/${f}`,
            size: stat.size,
            format: ext,
            title: f.toLowerCase().includes('bagan') ? 'Bagan Medical Hall Official Logo' : `Asset (${f})`,
            lastModified: stat.mtime.toISOString().replace('T', ' ').substring(0, 19),
          };
        });
        const cat = {
          status: 'ok',
          success: true,
          folder: 'website_images',
          total: fileList.length,
          files: fileList,
        };
        fs.writeFileSync(path.join(uploadDir, 'images.json'), JSON.stringify(cat, null, 2));
        fs.writeFileSync(path.join(uploadDir, 'manifest.json'), JSON.stringify(cat, null, 2));
      }
    } catch (_) {}

    // 6. Record Audit Log if actor is authenticated
    if (req.user && req.user.id) {
      try {
        await dbQuery(`
          INSERT INTO permission_audit_logs (id, admin_user_id, target_user_id, action, details)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          req.user.id,
          null,
          'MEDIA_DELETED',
          JSON.stringify({
            filename: safeName,
            deletedBy: req.user.username,
            timestamp: new Date().toISOString(),
          }),
        ]);
      } catch (_) {}
    }

    return res.json({
      status: 'ok',
      success: true,
      message: `Media asset "${safeName}" permanently deleted.`,
      filename: safeName,
    });
  } catch (err) {
    console.error('[MEDIA] deleteMedia error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to delete media asset.' });
  }
}

/**
 * GET /api/admin/media/folders
 * Fetch all media folders with their item counts
 */
export async function getMediaFolders(req, res) {
  try {
    const sql = `
      SELECT 
        f.id,
        f.name,
        f.slug,
        f.parent_id AS "parentId",
        f.created_at AS "createdAt",
        f.updated_at AS "updatedAt",
        COUNT(m.id)::int AS "fileCount"
      FROM media_folders f
      LEFT JOIN media_files m ON m.folder_id = f.id
      GROUP BY f.id, f.name, f.slug, f.parent_id, f.created_at, f.updated_at
      ORDER BY 
        CASE 
          WHEN f.slug = 'products' THEN 1
          WHEN f.slug = 'banners' THEN 2
          WHEN f.slug = 'categories' THEN 3
          WHEN f.slug = 'brands' THEN 4
          WHEN f.slug = 'services' THEN 5
          WHEN f.slug = 'general' THEN 6
          ELSE 7
        END,
        f.name ASC
    `;

    const result = await dbQuery(sql);

    return res.json({
      status: 'ok',
      folders: result.rows || [],
    });
  } catch (err) {
    console.error('[MEDIA] getMediaFolders error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch media folders.' });
  }
}

/**
 * POST /api/admin/media/folders
 * Create a new media folder
 */
export async function createMediaFolder(req, res) {
  try {
    const { name, slug } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'Folder name is required.' });
    }

    const folderName = name.trim();
    const rawSlug = slug ? slug.trim() : folderName;
    const cleanSlug = sanitizeSlug(rawSlug);

    // Check if slug already exists
    const existing = await dbQuery('SELECT id FROM media_folders WHERE slug = $1 LIMIT 1', [cleanSlug]);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(409).json({ status: 'error', message: `Folder with slug "${cleanSlug}" already exists.` });
    }

    const folderId = `folder-${cleanSlug}-${Date.now().toString().slice(-4)}`;
    const physicalDir = path.join(ROOT_MEDIA_DIR, cleanSlug);
    ensureDirectory(physicalDir);

    await dbQuery(
      `INSERT INTO media_folders (id, name, slug, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [folderId, folderName, cleanSlug]
    );

    return res.status(201).json({
      status: 'ok',
      message: 'Folder created successfully.',
      folder: {
        id: folderId,
        name: folderName,
        slug: cleanSlug,
        fileCount: 0,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[MEDIA] createMediaFolder error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to create media folder.' });
  }
}

/**
 * PUT /api/admin/media/folders/:id
 * Rename a media folder
 */
export async function updateMediaFolder(req, res) {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'Folder name is required.' });
    }

    const existing = await dbQuery('SELECT id, slug FROM media_folders WHERE id = $1 LIMIT 1', [id]);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Folder not found.' });
    }

    await dbQuery(
      'UPDATE media_folders SET name = $1, updated_at = NOW() WHERE id = $2',
      [name.trim(), id]
    );

    return res.json({
      status: 'ok',
      message: 'Folder renamed successfully.',
      folder: {
        id,
        name: name.trim(),
        slug: existing.rows[0].slug,
      },
    });
  } catch (err) {
    console.error('[MEDIA] updateMediaFolder error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to update folder.' });
  }
}

/**
 * DELETE /api/admin/media/folders/:id
 * Safely delete folder (checks if folder has images)
 */
export async function deleteMediaFolder(req, res) {
  try {
    const { id } = req.params;

    const folderRes = await dbQuery('SELECT id, name, slug FROM media_folders WHERE id = $1 LIMIT 1', [id]);
    if (!folderRes.rows || folderRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Folder not found.' });
    }

    const folder = folderRes.rows[0];

    // Prevent deleting core system folders
    const protectedSlugs = ['products', 'banners', 'categories', 'brands', 'services', 'general'];
    if (protectedSlugs.includes(folder.slug)) {
      return res.status(400).json({
        status: 'error',
        message: `The standard folder "${folder.name}" cannot be deleted as it is a default store directory.`,
      });
    }

    // Check if folder contains images
    const countRes = await dbQuery('SELECT COUNT(*)::int AS count FROM media_files WHERE folder_id = $1', [id]);
    const fileCount = countRes.rows[0]?.count || 0;

    if (fileCount > 0) {
      return res.status(409).json({
        status: 'conflict',
        hasFiles: true,
        fileCount,
        message: `Folder "${folder.name}" contains ${fileCount} media file(s). Please move or delete the files first.`,
      });
    }

    await dbQuery('DELETE FROM media_folders WHERE id = $1', [id]);

    return res.json({
      status: 'ok',
      message: `Folder "${folder.name}" deleted successfully.`,
    });
  } catch (err) {
    console.error('[MEDIA] deleteMediaFolder error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to delete folder.' });
  }
}
