// mediaController.js - Full-stack Media Center controller for Amrit Store
// Supports HimalayanHost filesystem storage (public/uploads/media/) and PostgreSQL metadata

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import multer from 'multer';
let mediaPool = null;
async function dbQuery(sql, params = []) {
  if (!mediaPool) throw Error('Call initMediaSystem(pool) first.');
  return mediaPool.query(sql, params);
}

let ROOT_MEDIA_DIR = process.env.MEDIA_UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads', 'media');
let MEDIA_PUBLIC_URL_PREFIX = process.env.MEDIA_PUBLIC_URL_PREFIX || '/uploads/media';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

// Memory storage for Multer: image is kept in buffer so Sharp can convert it directly to WebP before writing to disk
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
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
});

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

// Initialize tables and filesystem folders
export async function initMediaSystem(pool, options = {}) {
  if (!pool || typeof pool.query !== 'function') throw Error('A PostgreSQL-compatible pool is required.');
  mediaPool = pool;
  ROOT_MEDIA_DIR = path.resolve(options.uploadDir || process.env.MEDIA_UPLOAD_DIR || ROOT_MEDIA_DIR);
  MEDIA_PUBLIC_URL_PREFIX = (options.publicUrlPrefix || process.env.MEDIA_PUBLIC_URL_PREFIX || MEDIA_PUBLIC_URL_PREFIX).replace(/\/$/, '');
  try {
    ensureDirectory(ROOT_MEDIA_DIR);
    const standardFolders = ['products', 'banners', 'categories', 'brands', 'services', 'general'];
    for (const folder of standardFolders) {
      ensureDirectory(path.join(ROOT_MEDIA_DIR, folder));
    }

    // Ensure database tables exist
    const createTablesSql = `
      CREATE TABLE IF NOT EXISTS media_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        parent_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS media_files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        url TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        width INT,
        height INT,
        folder_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_media_files_folder ON media_files(folder_id);
      CREATE INDEX IF NOT EXISTS idx_media_files_created ON media_files(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_media_folders_slug ON media_folders(slug);
    `;

    await pool.query(createTablesSql);
    await pool.query(`
      INSERT INTO media_folders (id, name, slug)
      VALUES
        ('folder-products', 'Products', 'products'),
        ('folder-banners', 'Banners', 'banners'),
        ('folder-categories', 'Categories', 'categories'),
        ('folder-brands', 'Brands', 'brands'),
        ('folder-services', 'Services', 'services'),
        ('folder-general', 'General', 'general')
      ON CONFLICT (slug) DO NOTHING;
    `);

    console.log('[MEDIA] Media Center system initialized on HimalayanHost filesystem.');
  } catch (err) {
    console.error('[MEDIA] initMediaSystem failed:', err);
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
    const files = req.files || (req.file ? [req.file] : []);
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
 * DELETE /api/admin/media/:id
 * Delete media file from HimalayanHost filesystem and PostgreSQL metadata
 */
export async function deleteMedia(req, res) {
  // SAFETY LOCK: media references are not centrally tracked yet.
  // Browser-local logo assignments and other frontend references cannot
  // be verified reliably by this backend. Refuse permanent deletion.
  return res.status(409).json({
    status: 'protected',
    code: 'MEDIA_DELETION_DISABLED',
    message: 'Permanent media deletion is temporarily disabled to protect images that may still be in use. No file or database record was changed.'
  });
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
