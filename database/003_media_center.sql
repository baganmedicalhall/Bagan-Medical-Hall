-- =====================================================================
-- Bagan Medical Hall — Forward Migration: Media Center Relational Tables
-- File: database/003_media_center.sql
-- Compatible with PostgreSQL 12+
-- =====================================================================

BEGIN;

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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_media_files_folder ON media_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_media_files_created ON media_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_folders_slug ON media_folders(slug);

-- 3. Seed Default Media Folders (Idempotent)
INSERT INTO media_folders (id, name, slug)
VALUES 
  ('folder-products', 'Products', 'products'),
  ('folder-banners', 'Banners', 'banners'),
  ('folder-categories', 'Categories', 'categories'),
  ('folder-brands', 'Brands', 'brands'),
  ('folder-services', 'Services', 'services'),
  ('folder-general', 'General', 'general')
ON CONFLICT (slug) DO NOTHING;

-- 4. Record Migration in Schema Tracking
INSERT INTO schema_migrations (version) VALUES ('003_media_center')
ON CONFLICT (version) DO NOTHING;

COMMIT;
