import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { validateMediaStorageConfig } from './backend/mediaController.js';
import { validateCorsConfig } from './backend/corsConfig.js';
export { validateMediaStorageConfig, validateCorsConfig };

const app = express();
const PORT = process.env.PORT || 8080;

let mediaStorageConfig;
try {
  mediaStorageConfig = validateMediaStorageConfig(process.env);
} catch (mediaErr) {
  console.error('[FATAL_SECURITY_CONFIG]', mediaErr.message);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
  mediaStorageConfig = { isProduction: false, uploadDir: path.join(__dirname, 'website_images') };
}
const uploadDir = mediaStorageConfig.uploadDir;
const publicUrlPrefix = (process.env.MEDIA_PUBLIC_URL_PREFIX || '/website_images').replace(/\/$/, '');

// Express Reverse Proxy Trust Configuration (SEC-02)
// In production behind cPanel Passenger / LiteSpeed reverse proxy, trust local loopback proxies.
// Configurable via TRUST_PROXY (accepts boolean, integer hop count, or subnet string).
// Defaults to 'loopback' in production (127.0.0.1 / ::1), avoiding broad trust-all security flaws.
const rawTrustProxy = process.env.TRUST_PROXY;
if (rawTrustProxy !== undefined) {
  if (rawTrustProxy === 'true' || rawTrustProxy === '1') {
    app.set('trust proxy', 1);
  } else if (rawTrustProxy === 'false' || rawTrustProxy === '0') {
    app.set('trust proxy', false);
  } else {
    app.set('trust proxy', rawTrustProxy);
  }
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 'loopback');
} else {
  app.set('trust proxy', false);
}

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie Parsing Middleware
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(c => {
      const idx = c.indexOf('=');
      if (idx > -1) {
        const k = c.substring(0, idx).trim();
        const v = c.substring(idx + 1).trim();
        if (k) {
          try {
            req.cookies[k] = decodeURIComponent(v);
          } catch (_) {
            req.cookies[k] = v;
          }
        }
      }
    });
  }
  next();
});

let corsConfig;
try {
  corsConfig = validateCorsConfig(process.env);
} catch (corsErr) {
  console.error('[FATAL_SECURITY_CONFIG]', corsErr.message);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
  corsConfig = { isProduction: false, allowedOrigins: [] };
}
const isProduction = corsConfig.isProduction;
const allowedOrigins = corsConfig.allowedOrigins;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (!isProduction && allowedOrigins.length === 0) {
      // Local development fallback: reflect local origin with credentials
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Mandatory Startup Security Validations (Fail-closed in production)
try {
  const { validateDatabaseConfig } = await import('./backend/db.js');
  validateDatabaseConfig(process.env);
  const { getSessionSecret } = await import('./backend/authUtils.js');
  getSessionSecret(process.env);
  validateCorsConfig(process.env);
  validateMediaStorageConfig(process.env);
} catch (startupErr) {
  console.error('[FATAL_SECURITY_CONFIG] Server failed startup validation:', startupErr.message);
  if (isProduction) {
    process.exit(1);
  }
}

// Mount Centralized Authentication, Dynamic RBAC, Staff & Media Routers
try {
  const { authRouter } = await import('./backend/authRoutes.js');
  const { staffRouter } = await import('./backend/staffRoutes.js');
  const { createMediaRouter } = await import('./backend/mediaRoutes.js');
  const { pool } = await import('./backend/db.js');
  const { verifyMediaSchemaReadiness } = await import('./backend/mediaController.js');

  if (isProduction && pool) {
    await verifyMediaSchemaReadiness(pool);
  }

  const mediaRouter = createMediaRouter({ pool, uploadDir, publicUrlPrefix });

  app.use('/api/auth', authRouter);
  app.use('/api/admin/media', mediaRouter);
  app.use('/api/media', mediaRouter);
  app.use('/upload.php', mediaRouter);
  app.use('/api/admin', staffRouter);
} catch (e) {
  if (isProduction) {
    console.error('[CRITICAL_STARTUP_ERROR] Failed to load core backend routers in production:', e.message);
    process.exit(1);
  }
  console.warn('[SERVER] Notice: Backend PostgreSQL routers deferred in current environment:', e.message);
}

// Helper: Manifest updater
function updateImageManifest() {
  try {
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
        lastModified: stat.mtime.toISOString().replace('T', ' ').substring(0, 19)
      };
    });
    const amritMedia = fileList.map(f => ({
      id: `med_${f.filename.replace(/[^a-zA-Z0-9]/g, '_')}`,
      filename: f.filename,
      originalFilename: f.filename,
      filePath: f.path,
      url: f.path,
      mimeType: f.format === 'webp' ? 'image/webp' : `image/${f.format}`,
      fileSize: f.size,
      folderId: 'folder-general',
      folderName: 'General',
      folderSlug: 'general',
      createdAt: f.lastModified,
      updatedAt: f.lastModified
    }));

    const cat = {
      status: 'ok',
      success: true,
      folder: 'website_images',
      total: fileList.length,
      media: amritMedia,
      files: fileList
    };
    fs.writeFileSync(path.join(uploadDir, 'images.json'), JSON.stringify(cat, null, 2));
    fs.writeFileSync(path.join(uploadDir, 'manifest.json'), JSON.stringify(cat, null, 2));
    return cat;
  } catch (e) {
    return { status: 'error', files: [], media: [] };
  }
}

// 1. Health / Status (Dynamic Database Connectivity Check)
app.get(['/api/status', '/api/health'], async (req, res) => {
  let dbStatus = { ok: false, error: 'Database check not initialized' };
  try {
    const { checkConnection } = await import('./backend/db.js');
    dbStatus = await checkConnection();
  } catch (e) {
    dbStatus = { ok: false, error: e.message };
  }

  const isHealthy = Boolean(dbStatus.ok);
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'error',
    success: isHealthy,
    server: 'Bagan Medical Hall Server',
    database: isHealthy ? 'connected' : 'disconnected',
    port: PORT,
    folder: path.basename(uploadDir),
    ...(isHealthy ? {} : { error: isProduction ? 'Database service unavailable' : dbStatus.error }),
  });
});

// 2. Settings Save (Authenticated & CSRF Protected)
try {
  const { requireAuth, requirePermission, validateCsrf } = await import('./backend/authMiddleware.js');
  app.post('/api/settings', requireAuth, requirePermission('branding'), validateCsrf, (req, res) => {
    try {
      const settingsPath = path.join(uploadDir, 'settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify(req.body, null, 2));
      res.json({ status: 'ok', success: true, message: `Settings saved to ${path.basename(uploadDir)}/settings.json` });
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message });
    }
  });
} catch (e) {
  if (isProduction) {
    console.error('[CRITICAL_STARTUP_ERROR] Settings middleware initialization failed in production:', e.message);
    process.exit(1);
  }
  console.warn('[SERVER] Notice: Settings middleware deferred:', e.message);
}

// Security Guard: Deny direct HTTP access to internal backend source, database, and config files (SEC-03)
app.use((req, res, next) => {
  let normPath;
  try {
    normPath = decodeURIComponent(req.path).replace(/\\/g, '/').toLowerCase();
  } catch (_) {
    return res.status(400).json({
      status: 'error',
      code: 'MALFORMED_URI',
      message: 'Invalid URI encoding in request path.',
    });
  }

  if (normPath.includes('\0') || normPath.includes('..')) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_PATH',
      message: 'Invalid path sequence detected.',
    });
  }

  const isInternalPath = 
    normPath.startsWith('/backend/') ||
    normPath.startsWith('/database/') ||
    normPath.startsWith('/backups/') ||
    normPath.startsWith('/.git') ||
    normPath.endsWith('.sql') ||
    normPath.endsWith('.env') ||
    normPath.includes('.env.') ||
    normPath === '/package.json' ||
    normPath === '/package-lock.json' ||
    normPath === '/server.js' ||
    normPath === '/server.ps1' ||
    normPath.endsWith('.bat') ||
    normPath.endsWith('.zip');

  if (isInternalPath) {
    return res.status(404).json({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    });
  }
  next();
});

// Scoped Static Media Serving
app.use(publicUrlPrefix, express.static(uploadDir));
if (publicUrlPrefix !== '/website_images') {
  app.use('/website_images', express.static(uploadDir));
}

// Split Architecture: In production (bagan-api), do NOT serve frontend SPA routes or catch-all HTML
if (!isProduction) {
  // Local development only: serve frontend static directories and SPA fallback
  app.use('/css', express.static(path.join(__dirname, 'css')));
  app.use('/js', express.static(path.join(__dirname, 'js')));

  // Serve index.html explicitly at root
  app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  // Development SPA Fallback: Route unknown non-API GET requests to index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path === '/upload.php') {
      return res.status(404).json({
        status: 'error',
        code: 'API_ENDPOINT_NOT_FOUND',
        message: `API endpoint ${req.method} ${req.path} not found.`,
      });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
  });
} else {
  // Production API Server: Strict fail-closed 404 handler for all unmatched endpoints
  app.use((req, res) => {
    res.status(404).json({
      status: 'error',
      code: 'API_ENDPOINT_NOT_FOUND',
      message: `API endpoint ${req.method} ${req.path} not found on backend API service.`,
    });
  });
}

app.listen(PORT, () => {
  console.log(`Bagan Medical Hall Server running on http://localhost:${PORT}`);
});
