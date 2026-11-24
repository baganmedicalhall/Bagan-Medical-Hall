import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const uploadDir = path.join(__dirname, 'website_images');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

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

// 1. Health / Status
app.get(['/api/status', '/api/health'], (req, res) => {
  res.json({ status: 'ok', success: true, server: 'Bagan Medical Hall Server', port: PORT, folder: 'website_images' });
});

// 2. Folders
app.get(['/api/admin/media/folders', '/api/media/folders'], (req, res) => {
  res.json({
    status: 'ok',
    success: true,
    folders: [
      { id: 'folder-products', name: 'Products', slug: 'products' },
      { id: 'folder-banners', name: 'Banners', slug: 'banners' },
      { id: 'folder-categories', name: 'Categories', slug: 'categories' },
      { id: 'folder-brands', name: 'Brands', slug: 'brands' },
      { id: 'folder-services', name: 'Services', slug: 'services' },
      { id: 'folder-general', name: 'General', slug: 'general' }
    ]
  });
});

// 3. Media Listing
app.get(['/api/admin/media', '/api/media', '/upload.php'], (req, res) => {
  if (req.query.action === 'delete') {
    return handleDelete(req, res);
  }
  const data = updateImageManifest();
  res.json(data);
});

// 4. Media Upload (Base64 WebP)
app.post(['/api/admin/media/upload', '/api/media/upload', '/api/upload', '/upload.php'], (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!data) return res.status(400).json({ status: 'error', message: 'No image data provided' });

    let rawBase = path.parse(filename || `image_${Date.now()}`).name;
    let cleanBase = rawBase.replace(/[^a-zA-Z0-9_\.-]/g, '_');
    if (!cleanBase) cleanBase = `image_${Date.now()}`;
    const finalName = `${cleanBase}.webp`;
    const finalPath = path.join(uploadDir, finalName);

    let base64Content = data;
    if (base64Content.includes(',')) {
      base64Content = base64Content.split(',')[1];
    }
    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(finalPath, buffer);
    updateImageManifest();

    res.json({
      status: 'ok',
      success: true,
      message: 'Media uploaded and saved to website_images/ in real time',
      filename: finalName,
      path: `website_images/${finalName}`,
      media: [{
        id: `media-${Date.now()}`,
        filename: finalName,
        originalFilename: filename || finalName,
        filePath: `website_images/${finalName}`,
        url: `website_images/${finalName}`,
        mimeType: 'image/webp',
        fileSize: buffer.length,
        folderId: 'folder-general'
      }]
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 5. Media Delete
function handleDelete(req, res) {
  const fn = req.query.filename || req.params.id || req.body?.filename;
  if (!fn) return res.status(400).json({ status: 'error', message: 'Filename required' });

  const safeName = path.basename(fn);
  const target = path.join(uploadDir, safeName);
  if (fs.existsSync(target)) {
    try {
      fs.unlinkSync(target);
      updateImageManifest();
      return res.json({ status: 'ok', success: true, message: `File ${safeName} deleted permanently from website_images/` });
    } catch (e) {
      return res.status(500).json({ status: 'error', message: e.message });
    }
  }
  return res.json({ status: 'ok', success: true, message: 'File already deleted' });
}

app.delete(['/api/admin/media/:id', '/api/media/:id', '/api/admin/media', '/api/media', '/upload.php'], handleDelete);

// 6. Settings Save
app.post(['/api/settings', '/upload.php'], (req, res) => {
  try {
    const settingsPath = path.join(uploadDir, 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(req.body, null, 2));
    res.json({ status: 'ok', success: true, message: 'Settings saved to website_images/settings.json' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Static assets
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Bagan Medical Hall Server running on http://localhost:${PORT}`);
});
