-- =====================================================================
-- Bagan Medical Hall — Authoritative Authentication & Dynamic RBAC Schema
-- File: database/001_auth_system.sql
-- Compatible with PostgreSQL 12+
-- =====================================================================

BEGIN;

-- 1. Schema Migration Tracking Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Master Permission Catalog Table
CREATE TABLE IF NOT EXISTS app_permissions (
  code VARCHAR(64) PRIMARY KEY,
  category VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_permissions_cat ON app_permissions(category);

-- 3. Application Roles Table (Supports Custom and System Roles)
CREATE TABLE IF NOT EXISTS app_roles (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_roles_slug ON app_roles(slug);

-- 4. Role to Permission Mapping Table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(64) NOT NULL REFERENCES app_roles(id) ON DELETE CASCADE,
  permission_code VARCHAR(64) NOT NULL REFERENCES app_permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

-- 5. Application Users Table
CREATE TABLE IF NOT EXISTS app_users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(128) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(128) NOT NULL,
  role_id VARCHAR(64) NOT NULL REFERENCES app_roles(id),
  role_title VARCHAR(128),
  phone VARCHAR(32),
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  avatar VARCHAR(32) DEFAULT '🧑‍⚕️',
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce strict case-insensitive uniqueness for usernames
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_username_lower ON app_users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role_id);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON app_users(status);

-- 6. User-Specific Permission Overrides (Individual Grant or Revocation)
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id VARCHAR(64) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  permission_code VARCHAR(64) NOT NULL REFERENCES app_permissions(code) ON DELETE CASCADE,
  is_granted BOOLEAN NOT NULL,
  granted_by VARCHAR(64) REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_user_overrides_user ON user_permission_overrides(user_id);

-- 7. Multi-Worker Server Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  session_hash VARCHAR(64) NOT NULL UNIQUE,
  csrf_hash VARCHAR(64) NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(45),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup ON user_sessions(session_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- 8. Multi-Worker Distributed Rate Limiting Table
CREATE TABLE IF NOT EXISTS login_rate_limits (
  key VARCHAR(128) PRIMARY KEY,
  failed_attempts INT NOT NULL DEFAULT 1,
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_login_rate_limits_locked ON login_rate_limits(locked_until) WHERE locked_until IS NOT NULL;

-- 9. Administrative Permission Audit Logs Table
CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  admin_user_id VARCHAR(64) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  target_user_id VARCHAR(64) REFERENCES app_users(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perm_audit_admin ON permission_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_perm_audit_target ON permission_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_perm_audit_created ON permission_audit_logs(created_at DESC);

-- 10. Centralized System Settings & Branding Table
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by VARCHAR(64) REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- SEED DATA (Idempotent: ON CONFLICT DO NOTHING)
-- =====================================================================

-- 11. Seed Permissions Catalog (20 Granular Application Permissions)
INSERT INTO app_permissions (code, category, name, description) VALUES
  -- Dispensary POS
  ('pos', 'dispensary', 'POS Billing & Sales', 'Process prescription dispensing, customer checkout, and invoice generation'),
  ('applyDiscounts', 'dispensary', 'Apply Bill Discounts', 'Authorize and apply discounts on dispensary sales bills'),
  ('medicationTreatment', 'dispensary', 'Medications & Treatments', 'View patient treatment plans and medication regimens'),
  ('dailyRecords', 'dispensary', 'Daily Cash Drawer Balancing', 'Perform shift opening balances, drawer verifications, and daily closings'),
  
  -- Inventory
  ('inventory', 'inventory', 'View Inventory & Stocks', 'Browse medicine catalogue, batch numbers, rack locations, and stock levels'),
  ('inventoryEdit', 'inventory', 'Modify Drug Inventory', 'Create medicines, adjust stock quantities, and modify cost/selling prices'),
  ('expiryWriteOff', 'inventory', 'Stock Expiry Quarantine', 'Quarantine expired medicines and execute write-off transactions'),
  
  -- Accounting
  ('patientLedger', 'accounting', 'Patient Credit Ledger', 'Manage patient credit balances, statements, and payment collections'),
  ('supplierLedger', 'accounting', 'Supplier Credit Ledger', 'Manage supplier invoices, purchase orders, and payment vouchers'),
  ('expenses', 'accounting', 'Operating Expenses', 'Log clinic operational expenses, rent, utilities, and pharmacy supplies'),
  ('journalEntries', 'accounting', 'Manual Journal Vouchers', 'Create double-entry debit/credit adjustment vouchers'),
  ('financialReports', 'accounting', 'Financial Reports & Statements', 'Access trial balance, balance sheet, profit and loss, and audit trail'),
  
  -- Media Center
  ('mediaView', 'media', 'Browse Media Center', 'Browse uploaded media assets, categories, and folders'),
  ('mediaUpload', 'media', 'Upload Media Assets', 'Upload images with automatic WebP conversion and optimization'),
  ('mediaManage', 'media', 'Organize Media Folders', 'Create folders, move assets, and update image metadata'),
  ('mediaDelete', 'media', 'Delete Media Assets', 'Permanently delete unreferenced media assets (Developer/Admin only)'),
  
  -- System Administration
  ('staffManage', 'admin', 'Manage Staff Accounts', 'Provision staff accounts, configure roles, and set permission overrides'),
  ('branding', 'admin', 'Global Branding & Layout', 'Configure dispensary logos, clinic identity, contact details, and themes'),
  ('backup', 'admin', 'Backup & Database Export', 'Export PostgreSQL database dumps, journal logs, and audit archives'),
  ('factoryReset', 'admin', 'System Factory Reset', 'Execute destructive database resets (Super Admin only)')
ON CONFLICT (code) DO NOTHING;

-- 12. Seed Core System Roles
INSERT INTO app_roles (id, slug, name, description, is_system_role) VALUES
  ('role_dev', 'developer', 'Developer / Super Admin', 'Unrestricted administrative access to the entire platform and system internals', TRUE),
  ('role_pharmacist', 'pharmacist', 'Staff Pharmacist', 'Prescription dispensing, clinical treatments, inventory viewing, and daily records', TRUE),
  ('role_accountant', 'accountant', 'Accountant & Auditor', 'Comprehensive financial reporting, supplier/patient ledgers, and journal vouchers', TRUE),
  ('role_cashier', 'cashier', 'Dispensary Assistant / Cashier', 'Fast POS counter sales, customer billing, and shift drawer balancing', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 13. Map Default System Role Permissions
-- Staff Pharmacist Permissions
INSERT INTO role_permissions (role_id, permission_code)
SELECT 'role_pharmacist', code FROM app_permissions 
WHERE code IN (
  'pos', 'applyDiscounts', 'medicationTreatment', 'dailyRecords', 
  'inventory', 'expiryWriteOff', 'patientLedger', 'supplierLedger', 
  'expenses', 'mediaView', 'mediaUpload'
)
ON CONFLICT DO NOTHING;

-- Accountant Permissions
INSERT INTO role_permissions (role_id, permission_code)
SELECT 'role_accountant', code FROM app_permissions 
WHERE code IN (
  'patientLedger', 'supplierLedger', 'expenses', 'journalEntries', 
  'financialReports', 'dailyRecords', 'mediaView'
)
ON CONFLICT DO NOTHING;

-- Cashier / Assistant Permissions
INSERT INTO role_permissions (role_id, permission_code)
SELECT 'role_cashier', code FROM app_permissions 
WHERE code IN (
  'pos', 'dailyRecords', 'mediaView'
)
ON CONFLICT DO NOTHING;

-- Record Migration in Schema Tracking
INSERT INTO schema_migrations (version) VALUES ('001_auth_system') 
ON CONFLICT (version) DO NOTHING;

COMMIT;
