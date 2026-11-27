-- =====================================================================
-- Bagan Medical Hall — Forward Migration: Password Reset Isolation & Audit Log Preservation
-- File: database/002_password_reset_isolation.sql
-- Compatible with PostgreSQL 12+
-- =====================================================================

BEGIN;

-- 1. Add is_password_reset flag to user_sessions to isolate temporary reset tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_sessions' AND column_name = 'is_password_reset'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN is_password_reset BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_pwd_reset ON user_sessions(session_hash, is_password_reset) WHERE revoked_at IS NULL;

-- 2. Preserve Audit Logs: Add admin_username and relax foreign key to ON DELETE SET NULL
DO $$
BEGIN
  -- Add admin_username column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permission_audit_logs' AND column_name = 'admin_username'
  ) THEN
    ALTER TABLE permission_audit_logs ADD COLUMN admin_username VARCHAR(64);
  END IF;

  -- Backfill admin_username from app_users for existing records before constraint changes
  UPDATE permission_audit_logs l 
  SET admin_username = u.username 
  FROM app_users u 
  WHERE l.admin_user_id = u.id AND l.admin_username IS NULL;

  -- Allow admin_user_id to be NULL so historical logs survive user deletion
  ALTER TABLE permission_audit_logs ALTER COLUMN admin_user_id DROP NOT NULL;
END $$;

-- Update foreign key constraint on admin_user_id to ON DELETE SET NULL
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'permission_audit_logs'
    AND kcu.column_name = 'admin_user_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE permission_audit_logs DROP CONSTRAINT ' || quote_ident(fk_name);
  END IF;

  ALTER TABLE permission_audit_logs
    ADD CONSTRAINT permission_audit_logs_admin_user_id_fkey
    FOREIGN KEY (admin_user_id) REFERENCES app_users(id) ON DELETE SET NULL;
END $$;

-- 3. Record migration in schema_migrations
INSERT INTO schema_migrations (version) VALUES ('002_password_reset_isolation')
ON CONFLICT (version) DO NOTHING;

COMMIT;
