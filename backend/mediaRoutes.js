/**
 * backend/mediaRoutes.js - Express Router for Unified Media Center
 * Bagan Medical Hall Pharmacy POS & Accounting
 */

import { Router } from 'express';
import {
  initMediaSystem,
  uploadMiddleware,
  getMediaFiles,
  uploadMedia,
  updateMedia,
  deleteMedia,
  getMediaFolders,
  createMediaFolder,
  updateMediaFolder,
  deleteMediaFolder,
} from './mediaController.js';
import {
  requireAuth,
  requirePermission,
  validateCsrf,
} from './authMiddleware.js';

/**
 * Creates a configured Media Center router with centralized RBAC.
 *
 * @param {object} [options]
 * @param {object} [options.pool] PostgreSQL connection pool
 * @param {Function} [options.authMiddleware] Authentication middleware (defaults to requireAuth)
 * @param {string} [options.uploadDir] Absolute directory for uploaded images
 * @param {string} [options.publicUrlPrefix] Public URL prefix for uploaded images
 */
export function createMediaRouter({
  pool,
  authMiddleware = requireAuth,
  uploadDir,
  publicUrlPrefix,
} = {}) {
  let mediaInitPromise = null;
  if (pool) {
    mediaInitPromise = initMediaSystem(pool, { uploadDir, publicUrlPrefix }).catch(err => {
      console.error('[MEDIA_INIT_ERROR] Media system initialization failed:', err.message);
      throw err;
    });
  }

  const router = Router();

  // Initialization Synchronization Gate (fail-closed if media tables/folders cannot be initialized)
  router.use(async (req, res, next) => {
    if (mediaInitPromise) {
      try {
        await mediaInitPromise;
      } catch (err) {
        return res.status(503).json({
          status: 'error',
          code: 'MEDIA_SYSTEM_UNAVAILABLE',
          message: 'Media Center system initialization failed. Please contact administrator.',
        });
      }
    }
    next();
  });

  // Unified Centralized Session Validation
  router.use(authMiddleware);

  // 1. Media Assets Endpoints
  router.get(['/', '/api/admin/media', '/api/media'], (req, res, next) => {
    if (req.query?.action === 'delete') {
      return requirePermission('mediaDelete')(req, res, () => validateCsrf(req, res, () => deleteMedia(req, res)));
    }
    return requirePermission('mediaView')(req, res, () => getMediaFiles(req, res, next));
  });
  router.post(
    ['/', '/upload', '/api/admin/media/upload', '/api/media/upload'],
    validateCsrf,
    (req, res, next) => {
      if (req.query?.action === 'delete') {
        return requirePermission('mediaDelete')(req, res, () => deleteMedia(req, res));
      }
      return requirePermission('mediaUpload')(req, res, () => uploadMiddleware.array('images', 10)(req, res, () => uploadMedia(req, res)));
    }
  );
  router.put(['/:id', '/api/admin/media/:id', '/api/media/:id'], validateCsrf, requirePermission('mediaManage'), updateMedia);
  router.delete(
    ['/:id', '/api/admin/media/:id', '/api/media/:id', '/', '/api/admin/media', '/api/media'],
    validateCsrf,
    requirePermission('mediaDelete'),
    deleteMedia
  );

  // 2. Media Folders Endpoints
  router.get(['/folders', '/api/admin/media/folders', '/api/media/folders'], requirePermission('mediaView'), getMediaFolders);
  router.post(['/folders', '/api/admin/media/folders', '/api/media/folders'], validateCsrf, requirePermission('mediaManage'), createMediaFolder);
  router.put(['/folders/:id', '/api/admin/media/folders/:id', '/api/media/folders/:id'], validateCsrf, requirePermission('mediaManage'), updateMediaFolder);
  router.delete(['/folders/:id', '/api/admin/media/folders/:id', '/api/media/folders/:id'], validateCsrf, requirePermission('mediaManage'), deleteMediaFolder);

  return router;
}

export const mediaRouter = createMediaRouter();
export default mediaRouter;
