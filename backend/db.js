/**
 * backend/db.js - Authoritative PostgreSQL Connection Pool
 * Bagan Medical Hall Pharmacy POS & Accounting
 *
 * Configured specifically for cPanel Node.js passenger environment:
 * Prioritizes discrete environment variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD).
 * Supports DATABASE_URL as a secondary fallback.
 */

let Pool = null;
try {
  const pgModule = await import('pg');
  Pool = pgModule.default?.Pool || pgModule.Pool;
} catch (_) {
  // Stub Pool when pg driver is not installed in local environment
  Pool = class MockPool {
    constructor(config) {
      this.config = config;
    }
    on() {}
    async query() {
      throw new Error('[DB_NO_DRIVER] PostgreSQL driver (pg) is not installed in the current environment.');
    }
    async connect() {
      throw new Error('[DB_NO_DRIVER] PostgreSQL driver (pg) is not installed in the current environment.');
    }
    async end() {}
  };
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Validate that mandatory database credentials are provided in production.
 * @param {object} [env] Environment map (defaults to process.env)
 */
export function validateDatabaseConfig(env = process.env) {
  if (env.NODE_ENV === 'production') {
    const missing = [];
    if (!env.DB_HOST && !env.DATABASE_URL) missing.push('DB_HOST');
    if (!env.DB_NAME && !env.DATABASE_URL) missing.push('DB_NAME');
    if (!env.DB_USER && !env.DATABASE_URL) missing.push('DB_USER');
    if (!env.DB_PASSWORD && !env.DATABASE_URL) missing.push('DB_PASSWORD');

    if (missing.length > 0) {
      const errorMsg = `[CRITICAL_DB_CONFIG] In production, explicit PostgreSQL credentials are required. Missing: ${missing.join(', ')}. Server startup halted.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }
}

// Enforce configuration in production
validateDatabaseConfig();

// Support discrete cPanel variables with fallback in non-production environments
const poolConfig = {
  host: process.env.DB_HOST || (isProduction ? undefined : '127.0.0.1'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || (isProduction ? undefined : 'baganmed_pharmacy'),
  user: process.env.DB_USER || (isProduction ? undefined : 'baganmed_dbuser'),
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (isProduction ? undefined : ''),
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// If DATABASE_URL is explicitly set and no discrete host is given, use connectionString
if (process.env.DATABASE_URL && !process.env.DB_HOST) {
  poolConfig.connectionString = process.env.DATABASE_URL;
}

// Enable SSL rejectUnauthorized: false only if explicitly configured
if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(poolConfig);

// Catch errors on idle clients to prevent process termination
pool.on('error', (err) => {
  console.error('[DB_POOL_ERROR] Unexpected error on idle PostgreSQL client:', err.message || err);
});

/**
 * Execute a parameterized query with error handling.
 * @param {string} text SQL query
 * @param {Array} [params] Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (!isProduction && process.env.DEBUG_SQL === 'true') {
      const duration = Date.now() - start;
      console.log('[DB_QUERY]', { text: text.trim().substring(0, 100), duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('[DB_QUERY_ERROR]', { text: text.trim().substring(0, 100), error: err.message });
    throw err;
  }
}

/**
 * Acquire a dedicated client for multi-statement transactions.
 * Always call client.release() in a finally block!
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  return await pool.connect();
}

/**
 * Diagnostic helper: verify database connectivity.
 * @returns {Promise<boolean>}
 */
export async function checkConnection() {
  try {
    const res = await pool.query('SELECT NOW() AS now, current_database() AS db');
    return { ok: true, now: res.rows[0].now, database: res.rows[0].db };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Verifies that the authoritative Media Center database migration (003_media_center)
 * has been executed and that required schema objects strictly adhere to database/003_media_center.sql.
 *
 * Enforces architectural rule: SQL migrations are the sole authority for database schema.
 * Zero DDL (CREATE/ALTER/INDEX) is executed at application runtime.
 *
 * @param {object} [targetPool] PostgreSQL connection pool (defaults to authoritative pool)
 * @returns {Promise<boolean>}
 */
export async function verifyMediaSchemaReadiness(targetPool = pool) {
  if (!targetPool || typeof targetPool.query !== 'function') {
    throw new Error('A PostgreSQL-compatible pool is required to verify media schema readiness.');
  }

  // 1. Verify schema_migrations table exists and records 003_media_center
  let migRes;
  try {
    migRes = await targetPool.query(
      "SELECT version FROM schema_migrations WHERE version IN ('001_auth_system', '002_password_reset_isolation', '003_media_center')"
    );
  } catch (err) {
    throw new Error(
      `[SCHEMA ERROR] Unable to query schema_migrations: ${err.message}. Ensure base migrations (database/001_auth_system.sql) have been executed.`
    );
  }

  const appliedVersions = (migRes.rows || []).map(r => r.version);
  if (!appliedVersions.includes('003_media_center')) {
    throw new Error(
      "[SCHEMA ERROR] Media Center database migration (003_media_center) has not been applied. Please execute 'database/003_media_center.sql' against your database before starting the application."
    );
  }

  // 2. Verify required schema tables exist in public schema
  let tablesRes;
  try {
    tablesRes = await targetPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('media_folders', 'media_files')
    `);
  } catch (tableErr) {
    throw new Error(`[SCHEMA ERROR] Failed to query information_schema for media tables: ${tableErr.message}`);
  }

  const foundTables = (tablesRes.rows || []).map(r => r.table_name);
  const requiredTables = ['media_folders', 'media_files'];
  const missingTables = requiredTables.filter(t => !foundTables.includes(t));

  if (missingTables.length > 0) {
    throw new Error(
      `[SCHEMA ERROR] Required media schema table(s) missing from database: ${missingTables.join(', ')}. Please run 'database/003_media_center.sql'.`
    );
  }

  // 3. Verify columns, data types, nullability, and default values
  let colsRes;
  try {
    colsRes = await targetPool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('media_folders', 'media_files')
    `);
  } catch (err) {
    throw new Error(`[SCHEMA ERROR] Failed to query information_schema.columns: ${err.message}`);
  }

  const colsByTable = { media_folders: {}, media_files: {} };
  for (const row of (colsRes.rows || [])) {
    if (colsByTable[row.table_name]) {
      colsByTable[row.table_name][row.column_name] = {
        dataType: (row.data_type || '').toLowerCase(),
        isNullable: (row.is_nullable || '').toUpperCase(),
        columnDefault: row.column_default !== undefined ? row.column_default : null,
      };
    }
  }

  // 3.1 Verify required column existence
  const requiredColumns = {
    media_folders: ['id', 'name', 'slug', 'parent_id', 'created_at', 'updated_at'],
    media_files: ['id', 'filename', 'original_filename', 'file_path', 'url', 'mime_type', 'file_size', 'width', 'height', 'folder_id', 'created_at', 'updated_at'],
  };

  for (const [table, reqCols] of Object.entries(requiredColumns)) {
    const tableCols = colsByTable[table] || {};
    const missingCols = reqCols.filter(c => !(c in tableCols));
    if (missingCols.length > 0) {
      throw new Error(`[SCHEMA ERROR] Required column(s) missing in table '${table}': ${missingCols.join(', ')}. Please verify 'database/003_media_center.sql'.`);
    }
  }

  // 3.2 Verify expected data types
  const expectedDataTypes = [
    { table: 'media_folders', column: 'id', expected: ['text'] },
    { table: 'media_folders', column: 'name', expected: ['text'] },
    { table: 'media_folders', column: 'slug', expected: ['text'] },
    { table: 'media_folders', column: 'parent_id', expected: ['text'] },
    { table: 'media_folders', column: 'created_at', expected: ['timestamp with time zone', 'timestamptz'] },
    { table: 'media_folders', column: 'updated_at', expected: ['timestamp with time zone', 'timestamptz'] },
    { table: 'media_files', column: 'id', expected: ['text'] },
    { table: 'media_files', column: 'filename', expected: ['text'] },
    { table: 'media_files', column: 'original_filename', expected: ['text'] },
    { table: 'media_files', column: 'file_path', expected: ['text'] },
    { table: 'media_files', column: 'url', expected: ['text'] },
    { table: 'media_files', column: 'mime_type', expected: ['text'] },
    { table: 'media_files', column: 'file_size', expected: ['bigint', 'int8'] },
    { table: 'media_files', column: 'width', expected: ['integer', 'int4', 'int'] },
    { table: 'media_files', column: 'height', expected: ['integer', 'int4', 'int'] },
    { table: 'media_files', column: 'folder_id', expected: ['text'] },
    { table: 'media_files', column: 'created_at', expected: ['timestamp with time zone', 'timestamptz'] },
    { table: 'media_files', column: 'updated_at', expected: ['timestamp with time zone', 'timestamptz'] },
  ];

  for (const { table, column, expected } of expectedDataTypes) {
    const colInfo = colsByTable[table][column];
    if (colInfo && !expected.some(exp => colInfo.dataType.includes(exp))) {
      throw new Error(`[SCHEMA ERROR] Column '${table}.${column}' has incompatible data type '${colInfo.dataType}': expected ${expected.join(' or ')}.`);
    }
  }

  // 3.3 Verify NOT NULL constraints on mandatory columns
  const mandatoryNotNull = [
    { table: 'media_folders', column: 'id' },
    { table: 'media_folders', column: 'name' },
    { table: 'media_folders', column: 'slug' },
    { table: 'media_files', column: 'id' },
    { table: 'media_files', column: 'filename' },
    { table: 'media_files', column: 'original_filename' },
    { table: 'media_files', column: 'file_path' },
    { table: 'media_files', column: 'url' },
    { table: 'media_files', column: 'mime_type' },
    { table: 'media_files', column: 'file_size' },
  ];

  for (const { table, column } of mandatoryNotNull) {
    const colInfo = colsByTable[table][column];
    if (colInfo && colInfo.isNullable === 'YES') {
      throw new Error(`[SCHEMA ERROR] Column '${table}.${column}' has incompatible nullability: expected NOT NULL. Migration requires mandatory value.`);
    }
  }

  // 3.4 Verify Nullable constraints on optional columns (e.g. parent_id, folder_id, width, height)
  const mandatoryNullable = [
    { table: 'media_folders', column: 'parent_id' },
    { table: 'media_files', column: 'folder_id' },
    { table: 'media_files', column: 'width' },
    { table: 'media_files', column: 'height' },
  ];

  for (const { table, column } of mandatoryNullable) {
    const colInfo = colsByTable[table][column];
    if (colInfo && colInfo.isNullable === 'NO') {
      throw new Error(`[SCHEMA ERROR] Column '${table}.${column}' has incompatible nullability: expected NULLABLE (is_nullable=YES) to support optional values and ON DELETE SET NULL.`);
    }
  }

  // 3.5 Verify Default Values (created_at, updated_at must independently have DEFAULT NOW())
  const mandatoryDefaults = [
    { table: 'media_folders', column: 'created_at' },
    { table: 'media_folders', column: 'updated_at' },
    { table: 'media_files', column: 'created_at' },
    { table: 'media_files', column: 'updated_at' },
  ];

  for (const { table, column } of mandatoryDefaults) {
    const colInfo = colsByTable[table]?.[column];
    if (!colInfo) {
      throw new Error(`[SCHEMA ERROR] Column '${table}.${column}' is missing in schema.`);
    }
    const rawDefault = colInfo.columnDefault;
    if (rawDefault === null || rawDefault === undefined || typeof rawDefault !== 'string' || !rawDefault.trim()) {
      throw new Error(`[SCHEMA ERROR] Column '${table}.${column}' is missing required default value: expected default equivalent to PostgreSQL NOW().`);
    }
    const defLower = rawDefault.trim().toLowerCase();
    const isNowEquivalent = defLower.includes('now()') || 
                            defLower.includes('current_timestamp') || 
                            defLower.includes('transaction_timestamp()');
    if (!isNowEquivalent) {
      throw new Error(`[SCHEMA ERROR] Column '${table}.${column}' has invalid default value '${rawDefault}': expected default equivalent to PostgreSQL NOW().`);
    }
  }

  // 4. Verify Primary Keys and Unique Constraints
  let constraintsRes;
  try {
    constraintsRes = await targetPool.query(`
      SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name IN ('media_folders', 'media_files')
    `);
  } catch (err) {
    throw new Error(`[SCHEMA ERROR] Failed to query information_schema.table_constraints: ${err.message}`);
  }

  const constraints = (constraintsRes.rows || []);
  const hasFoldersPK = constraints.some(c => c.table_name === 'media_folders' && c.constraint_type === 'PRIMARY KEY' && c.column_name === 'id');
  const hasFilesPK = constraints.some(c => c.table_name === 'media_files' && c.constraint_type === 'PRIMARY KEY' && c.column_name === 'id');

  if (!hasFoldersPK) {
    throw new Error("[SCHEMA ERROR] Required primary key missing on table 'media_folders(id)'.");
  }
  if (!hasFilesPK) {
    throw new Error("[SCHEMA ERROR] Required primary key missing on table 'media_files(id)'.");
  }

  const hasSlugUnique = constraints.some(c => c.table_name === 'media_folders' && (c.constraint_type === 'UNIQUE' || c.constraint_type === 'PRIMARY KEY') && c.column_name === 'slug');
  if (!hasSlugUnique) {
    throw new Error("[SCHEMA ERROR] Required unique constraint missing on 'media_folders(slug)'.");
  }

  // 5. Verify Foreign Keys and Deletion Behavior (ON DELETE SET NULL)
  let fkRes;
  try {
    fkRes = await targetPool.query(`
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      LEFT JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name IN ('media_folders', 'media_files')
    `);
  } catch (err) {
    throw new Error(`[SCHEMA ERROR] Failed to query foreign keys: ${err.message}`);
  }

  const fks = (fkRes.rows || []);

  const requiredFks = [
    {
      sourceTable: 'media_folders',
      sourceColumn: 'parent_id',
      targetTable: 'media_folders',
      targetColumn: 'id',
      missingError: "[SCHEMA ERROR] Required self-referential foreign key missing on 'media_folders.parent_id' referencing 'media_folders(id)'.",
    },
    {
      sourceTable: 'media_files',
      sourceColumn: 'folder_id',
      targetTable: 'media_folders',
      targetColumn: 'id',
      missingError: "[SCHEMA ERROR] Required foreign key missing on 'media_files.folder_id' referencing 'media_folders(id)'.",
    },
  ];

  for (const reqFk of requiredFks) {
    const fkMatch = fks.find(f => 
      f.table_name === reqFk.sourceTable && 
      f.column_name === reqFk.sourceColumn
    );

    if (!fkMatch) {
      throw new Error(reqFk.missingError);
    }

    if (fkMatch.foreign_table_name !== reqFk.targetTable || fkMatch.foreign_column_name !== reqFk.targetColumn) {
      throw new Error(
        `[SCHEMA ERROR] Incompatible foreign key reference on '${reqFk.sourceTable}.${reqFk.sourceColumn}': expected reference to '${reqFk.targetTable}(${reqFk.targetColumn})', found '${fkMatch.foreign_table_name}(${fkMatch.foreign_column_name})'.`
      );
    }

    if (!fkMatch.delete_rule || typeof fkMatch.delete_rule !== 'string') {
      throw new Error(
        `[SCHEMA ERROR] Missing or null foreign-key deletion rule on '${reqFk.sourceTable}.${reqFk.sourceColumn}': expected exactly 'SET NULL'.`
      );
    }

    const normDeleteRule = fkMatch.delete_rule.trim().toUpperCase();
    if (normDeleteRule !== 'SET NULL') {
      throw new Error(
        `[SCHEMA ERROR] Incompatible foreign-key deletion behavior on '${reqFk.sourceTable}.${reqFk.sourceColumn}': expected 'SET NULL', found '${fkMatch.delete_rule}'.`
      );
    }
  }

  // 6. Verify Indexes
  let idxRes;
  try {
    idxRes = await targetPool.query(`
      SELECT tablename, indexname 
      FROM pg_catalog.pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename IN ('media_folders', 'media_files')
    `);
  } catch (err) {
    throw new Error(`[SCHEMA ERROR] Failed to query pg_catalog.pg_indexes: ${err.message}`);
  }

  const indexes = (idxRes.rows || []).map(i => i.indexname);
  const requiredIndexes = ['idx_media_files_folder', 'idx_media_files_created', 'idx_media_folders_slug'];
  const missingIndexes = requiredIndexes.filter(i => !indexes.includes(i));
  if (missingIndexes.length > 0) {
    throw new Error(`[SCHEMA ERROR] Required performance index(es) missing: ${missingIndexes.join(', ')}. Please execute 'database/003_media_center.sql'.`);
  }

  // 7. Verify Required Default Folder Seeds
  let seedRes;
  try {
    seedRes = await targetPool.query(`
      SELECT slug FROM media_folders 
      WHERE slug IN ('products', 'banners', 'categories', 'brands', 'services', 'general')
    `);
  } catch (err) {
    throw new Error(`[SCHEMA ERROR] Failed to query default seed folders in media_folders: ${err.message}`);
  }

  const foundSeeds = (seedRes.rows || []).map(s => s.slug);
  const requiredSeeds = ['products', 'banners', 'categories', 'brands', 'services', 'general'];
  const missingSeeds = requiredSeeds.filter(s => !foundSeeds.includes(s));
  if (missingSeeds.length > 0) {
    throw new Error(`[SCHEMA ERROR] Required default folder seed(s) missing from 'media_folders': ${missingSeeds.join(', ')}. Please run migration seed script.`);
  }

  return true;
}

export default {
  pool,
  query,
  getClient,
  checkConnection,
  verifyMediaSchemaReadiness,
};
