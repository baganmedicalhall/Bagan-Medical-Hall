-- =====================================================================
-- Media Center Database Migration
-- Target Database: Any PostgreSQL database
-- =====================================================================

-- 1. Create media_folders table
CREATE TABLE IF NOT EXISTS media_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id TEXT REFERENCES media_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create media_files table
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
  folder_id TEXT REFERENCES media_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_files_folder ON media_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_media_files_created ON media_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_folders_slug ON media_folders(slug);

-- 3. Seed Default Media Folders
INSERT INTO media_folders (id, name, slug)
VALUES 
  ('folder-products', 'Products', 'products'),
  ('folder-banners', 'Banners', 'banners'),
  ('folder-categories', 'Categories', 'categories'),
  ('folder-brands', 'Brands', 'brands'),
  ('folder-services', 'Services', 'services'),
  ('folder-general', 'General', 'general')
ON CONFLICT (slug) DO NOTHING;
