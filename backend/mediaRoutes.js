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

/**
 * Creates a standalone Media Center router.
 *
 * @param {object} options
 * @param {object} options.pool PostgreSQL pool
 * @param {Function} options.authMiddleware Host application's authentication middleware
 * @param {string} [options.uploadDir] Absolute directory for uploaded images
 * @param {string} [options.publicUrlPrefix] Public URL prefix for uploaded images
 */
export async function createMediaRouter({
  pool,
  authMiddleware,
  uploadDir,
  publicUrlPrefix,
} = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('A PostgreSQL-compatible pool is required.');
  }

  if (typeof authMiddleware !== 'function') {
    throw new Error('Provide your application authentication middleware.');
  }

  await initMediaSystem(pool, { uploadDir, publicUrlPrefix });

  const router = Router();

  router.use(authMiddleware);

  router.get('/', getMediaFiles);
  router.post('/upload', uploadMiddleware.array('images', 10), uploadMedia);
  router.put('/:id', updateMedia);
  router.delete('/:id', deleteMedia);

  router.get('/folders', getMediaFolders);
  router.post('/folders', createMediaFolder);
  router.put('/folders/:id', updateMediaFolder);
  router.delete('/folders/:id', deleteMediaFolder);

  return router;
}
