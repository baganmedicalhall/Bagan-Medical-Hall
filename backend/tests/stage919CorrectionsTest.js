/**
 * backend/tests/stage919CorrectionsTest.js - Stage 9.1.9.1 Schema Validation Regression Tests
 * Bagan Medical Hall Pharmacy POS, Accounting ERP & Unified Authentication
 * 
 * NOTE: All tests in this suite use mock PostgreSQL catalog pools simulating PostgreSQL
 * system catalogs (information_schema, pg_catalog, schema_migrations). No live PostgreSQL
 * database was connected or migrated in this local test environment.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyMediaSchemaReadiness as verifyFromDb } from '../db.js';
import { verifyMediaSchemaReadiness as verifyFromMedia } from '../mediaController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function createAuthoritativeCatalogMock() {
  const issuedQueries = [];
  return {
    issuedQueries,
    query: async (sql, params = []) => {
      issuedQueries.push({ sql, params });

      // 1. Migration record check
      if (sql.includes('schema_migrations')) {
        return {
          rows: [
            { version: '001_auth_system' },
            { version: '002_password_reset_isolation' },
            { version: '003_media_center' },
          ],
        };
      }

      // 2. Tables existence check
      if (sql.includes('information_schema.tables')) {
        return {
          rows: [
            { table_name: 'media_folders' },
            { table_name: 'media_files' },
          ],
        };
      }

      // 3. Columns, data types, nullability, and defaults
      if (sql.includes('information_schema.columns')) {
        return {
          rows: [
            // media_folders
            { table_name: 'media_folders', column_name: 'id', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'media_folders', column_name: 'name', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'media_folders', column_name: 'slug', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'media_folders', column_name: 'parent_id', data_type: 'text', is_nullable: 'YES', column_default: null },
            { table_name: 'media_folders', column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: 'now()' },
            { table_name: 'media_folders', column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: 'now()' },
            // media_files
            { table_name: 'media_files', column_name: 'id', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'media_files', column_name: 'filename', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'media_files', column_name: 'original_filename', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'media_files', column_name: 'file_path', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'media_files', column_name: 'url', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'media_files', column_name: 'mime_type', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'media_files', column_name: 'file_size', data_type: 'bigint', is_nullable: 'NO', column_default: null },
            { table_name: 'media_files', column_name: 'width', data_type: 'integer', is_nullable: 'YES', column_default: null },
            { table_name: 'media_files', column_name: 'height', data_type: 'integer', is_nullable: 'YES', column_default: null },
            { table_name: 'media_files', column_name: 'folder_id', data_type: 'text', is_nullable: 'YES', column_default: null },
            { table_name: 'media_files', column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: 'now()' },
            { table_name: 'media_files', column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: 'now()' },
          ],
        };
      }

      // 4. Constraints (Primary Key, Unique)
      if (sql.includes('information_schema.table_constraints') && !sql.includes('FOREIGN KEY')) {
        return {
          rows: [
            { table_name: 'media_folders', constraint_name: 'media_folders_pkey', constraint_type: 'PRIMARY KEY', column_name: 'id' },
            { table_name: 'media_files', constraint_name: 'media_files_pkey', constraint_type: 'PRIMARY KEY', column_name: 'id' },
            { table_name: 'media_folders', constraint_name: 'media_folders_slug_key', constraint_type: 'UNIQUE', column_name: 'slug' },
          ],
        };
      }

      // 5. Foreign Keys and Deletion Behavior
      if (sql.includes('information_schema.table_constraints') && sql.includes('FOREIGN KEY')) {
        return {
          rows: [
            { table_name: 'media_folders', column_name: 'parent_id', foreign_table_name: 'media_folders', foreign_column_name: 'id', delete_rule: 'SET NULL' },
            { table_name: 'media_files', column_name: 'folder_id', foreign_table_name: 'media_folders', foreign_column_name: 'id', delete_rule: 'SET NULL' },
          ],
        };
      }

      // 6. Indexes
      if (sql.includes('pg_catalog.pg_indexes')) {
        return {
          rows: [
            { tablename: 'media_files', indexname: 'idx_media_files_folder' },
            { tablename: 'media_files', indexname: 'idx_media_files_created' },
            { tablename: 'media_folders', indexname: 'idx_media_folders_slug' },
          ],
        };
      }

      // 7. Default Seeds
      if (sql.includes('SELECT slug FROM media_folders')) {
        return {
          rows: [
            { slug: 'products' },
            { slug: 'banners' },
            { slug: 'categories' },
            { slug: 'brands' },
            { slug: 'services' },
            { slug: 'general' },
          ],
        };
      }

      return { rows: [] };
    },
  };
}

async function runTests() {
  console.log('======================================================================');
  console.log(' STAGE 9.1.9.1 — SCHEMA VALIDATION CORRECTION REGRESSION TESTS        ');
  console.log(' (Executed using in-memory mock PostgreSQL catalog pools)             ');
  console.log('======================================================================\n');

  // ---------------------------------------------------------------------------
  // Test Group 1: Positive Validation & Single Source of Truth
  // ---------------------------------------------------------------------------
  console.log('--- [Test Group 1] Positive Validation & Single Source of Truth ---');

  assert(typeof verifyFromDb === 'function', 'verifyMediaSchemaReadiness exported from backend/db.js');
  assert(typeof verifyFromMedia === 'function', 'verifyMediaSchemaReadiness exported from backend/mediaController.js');
  assert(verifyFromDb === verifyFromMedia, 'verifyMediaSchemaReadiness is identical function in both modules (single authority)');

  const validMock = createAuthoritativeCatalogMock();
  const validRes = await verifyFromDb(validMock);
  assert(validRes === true, 'Authoritative valid schema passes verifyMediaSchemaReadiness with true');

  console.log('');

  // ---------------------------------------------------------------------------
  // Test Group 2: Independent Timestamp Default Negative Tests (Task 1)
  // ---------------------------------------------------------------------------
  console.log('--- [Test Group 2] Independent Timestamp Default Tests (Task 1) ---');

  const timestampCols = [
    { table: 'media_folders', column: 'created_at' },
    { table: 'media_folders', column: 'updated_at' },
    { table: 'media_files', column: 'created_at' },
    { table: 'media_files', column: 'updated_at' },
  ];

  // 2.1 Prove each of the four timestamp defaults fails independently when null / missing
  for (const { table, column } of timestampCols) {
    const missingDefMock = createAuthoritativeCatalogMock();
    missingDefMock.query = async (sql, params) => {
      if (sql.includes('information_schema.columns')) {
        const orig = await createAuthoritativeCatalogMock().query(sql, params);
        return {
          rows: orig.rows.map(r => {
            if (r.table_name === table && r.column_name === column) {
              return { ...r, column_default: null };
            }
            return r;
          }),
        };
      }
      return (await createAuthoritativeCatalogMock().query(sql, params));
    };

    let threw = false;
    try {
      await verifyFromDb(missingDefMock);
    } catch (err) {
      threw = true;
      assert(
        err.message.includes(`${table}.${column}`) && err.message.includes('missing required default value'),
        `Missing default on ${table}.${column} independently fails closed`
      );
    }
    assert(threw, `Missing default on ${table}.${column} rejected`);
  }

  // 2.2 Prove each of the four timestamp defaults fails when set to an invalid non-NOW default
  for (const { table, column } of timestampCols) {
    const invalidDefMock = createAuthoritativeCatalogMock();
    invalidDefMock.query = async (sql, params) => {
      if (sql.includes('information_schema.columns')) {
        const orig = await createAuthoritativeCatalogMock().query(sql, params);
        return {
          rows: orig.rows.map(r => {
            if (r.table_name === table && r.column_name === column) {
              return { ...r, column_default: "'1970-01-01 00:00:00'::timestamp" };
            }
            return r;
          }),
        };
      }
      return (await createAuthoritativeCatalogMock().query(sql, params));
    };

    let threw = false;
    try {
      await verifyFromDb(invalidDefMock);
    } catch (err) {
      threw = true;
      assert(
        err.message.includes(`${table}.${column}`) && err.message.includes('invalid default value'),
        `Invalid non-NOW default on ${table}.${column} independently fails closed`
      );
    }
    assert(threw, `Invalid default on ${table}.${column} rejected`);
  }

  // 2.3 Prove that valid equivalent defaults (CURRENT_TIMESTAMP) pass
  const currentTimestampMock = createAuthoritativeCatalogMock();
  currentTimestampMock.query = async (sql, params) => {
    if (sql.includes('information_schema.columns')) {
      const orig = await createAuthoritativeCatalogMock().query(sql, params);
      return {
        rows: orig.rows.map(r => {
          if (['created_at', 'updated_at'].includes(r.column_name)) {
            return { ...r, column_default: 'CURRENT_TIMESTAMP' };
          }
          return r;
        }),
      };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  const ctResult = await verifyFromDb(currentTimestampMock);
  assert(ctResult === true, 'CURRENT_TIMESTAMP default accepted as valid equivalent to NOW()');

  console.log('');

  // ---------------------------------------------------------------------------
  // Test Group 3: Foreign Key Deletion Rule Tests (Task 2)
  // ---------------------------------------------------------------------------
  console.log('--- [Test Group 3] Foreign Key Deletion Rule Tests (Task 2) ---');

  const fksToTest = [
    { table: 'media_folders', column: 'parent_id', name: 'media_folders.parent_id' },
    { table: 'media_files', column: 'folder_id', name: 'media_files.folder_id' },
  ];

  // 3.1 Prove each FK fails when delete_rule is null
  for (const { table, column, name } of fksToTest) {
    const nullRuleMock = createAuthoritativeCatalogMock();
    nullRuleMock.query = async (sql, params) => {
      if (sql.includes('information_schema.table_constraints') && sql.includes('FOREIGN KEY')) {
        const orig = await createAuthoritativeCatalogMock().query(sql, params);
        return {
          rows: orig.rows.map(r => {
            if (r.table_name === table && r.column_name === column) {
              return { ...r, delete_rule: null };
            }
            return r;
          }),
        };
      }
      return (await createAuthoritativeCatalogMock().query(sql, params));
    };

    let threw = false;
    try {
      await verifyFromDb(nullRuleMock);
    } catch (err) {
      threw = true;
      assert(
        err.message.includes(name) && err.message.includes('Missing or null foreign-key deletion rule'),
        `Null delete_rule on ${name} independently fails closed`
      );
    }
    assert(threw, `Null delete_rule on ${name} rejected`);
  }

  // 3.2 Prove each FK fails when delete_rule property is omitted / undefined
  for (const { table, column, name } of fksToTest) {
    const missingRuleMock = createAuthoritativeCatalogMock();
    missingRuleMock.query = async (sql, params) => {
      if (sql.includes('information_schema.table_constraints') && sql.includes('FOREIGN KEY')) {
        const orig = await createAuthoritativeCatalogMock().query(sql, params);
        return {
          rows: orig.rows.map(r => {
            if (r.table_name === table && r.column_name === column) {
              const { delete_rule, ...rest } = r;
              return rest;
            }
            return r;
          }),
        };
      }
      return (await createAuthoritativeCatalogMock().query(sql, params));
    };

    let threw = false;
    try {
      await verifyFromDb(missingRuleMock);
    } catch (err) {
      threw = true;
      assert(
        err.message.includes(name) && err.message.includes('Missing or null foreign-key deletion rule'),
        `Omitted delete_rule on ${name} independently fails closed`
      );
    }
    assert(threw, `Omitted delete_rule on ${name} rejected`);
  }

  // 3.3 Prove each FK fails when delete_rule is CASCADE
  for (const { table, column, name } of fksToTest) {
    const cascadeMock = createAuthoritativeCatalogMock();
    cascadeMock.query = async (sql, params) => {
      if (sql.includes('information_schema.table_constraints') && sql.includes('FOREIGN KEY')) {
        const orig = await createAuthoritativeCatalogMock().query(sql, params);
        return {
          rows: orig.rows.map(r => {
            if (r.table_name === table && r.column_name === column) {
              return { ...r, delete_rule: 'CASCADE' };
            }
            return r;
          }),
        };
      }
      return (await createAuthoritativeCatalogMock().query(sql, params));
    };

    let threw = false;
    try {
      await verifyFromDb(cascadeMock);
    } catch (err) {
      threw = true;
      assert(
        err.message.includes(name) && err.message.includes('CASCADE'),
        `CASCADE delete_rule on ${name} independently fails closed`
      );
    }
    assert(threw, `CASCADE delete_rule on ${name} rejected`);
  }

  // 3.4 Prove each FK fails when delete_rule is RESTRICT
  for (const { table, column, name } of fksToTest) {
    const restrictMock = createAuthoritativeCatalogMock();
    restrictMock.query = async (sql, params) => {
      if (sql.includes('information_schema.table_constraints') && sql.includes('FOREIGN KEY')) {
        const orig = await createAuthoritativeCatalogMock().query(sql, params);
        return {
          rows: orig.rows.map(r => {
            if (r.table_name === table && r.column_name === column) {
              return { ...r, delete_rule: 'RESTRICT' };
            }
            return r;
          }),
        };
      }
      return (await createAuthoritativeCatalogMock().query(sql, params));
    };

    let threw = false;
    try {
      await verifyFromDb(restrictMock);
    } catch (err) {
      threw = true;
      assert(
        err.message.includes(name) && err.message.includes('RESTRICT'),
        `RESTRICT delete_rule on ${name} independently fails closed`
      );
    }
    assert(threw, `RESTRICT delete_rule on ${name} rejected`);
  }

  // 3.5 Prove each FK fails when foreign referenced table or column is wrong
  const wrongRefTableMock = createAuthoritativeCatalogMock();
  wrongRefTableMock.query = async (sql, params) => {
    if (sql.includes('information_schema.table_constraints') && sql.includes('FOREIGN KEY')) {
      const orig = await createAuthoritativeCatalogMock().query(sql, params);
      return {
        rows: orig.rows.map(r => {
          if (r.table_name === 'media_folders' && r.column_name === 'parent_id') {
            return { ...r, foreign_table_name: 'wrong_table' };
          }
          return r;
        }),
      };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let refTableThrew = false;
  try {
    await verifyFromDb(wrongRefTableMock);
  } catch (err) {
    refTableThrew = true;
    assert(err.message.includes('Incompatible foreign key reference'), 'Wrong foreign referenced table rejected');
  }
  assert(refTableThrew, 'Wrong foreign referenced table fails closed');

  console.log('');

  // ---------------------------------------------------------------------------
  // Test Group 4: Structural Schema & Fail-Closed Invariants
  // ---------------------------------------------------------------------------
  console.log('--- [Test Group 4] Structural Schema & Fail-Closed Invariants ---');

  // 4.1 Missing migration record
  const badMigMock = createAuthoritativeCatalogMock();
  badMigMock.query = async (sql, params) => {
    if (sql.includes('schema_migrations')) {
      return { rows: [{ version: '001_auth_system' }, { version: '002_password_reset_isolation' }] };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let migThrew = false;
  try {
    await verifyFromDb(badMigMock);
  } catch (err) {
    migThrew = true;
    assert(err.message.includes('003_media_center'), 'Missing 003_media_center migration fails closed');
  }
  assert(migThrew, 'Missing migration rejected');

  // 4.2 Missing table
  const badTableMock = createAuthoritativeCatalogMock();
  badTableMock.query = async (sql, params) => {
    if (sql.includes('information_schema.tables')) {
      return { rows: [{ table_name: 'media_folders' }] };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let tableThrew = false;
  try {
    await verifyFromDb(badTableMock);
  } catch (err) {
    tableThrew = true;
    assert(err.message.includes('media_files'), 'Missing media_files table fails closed');
  }
  assert(tableThrew, 'Missing table rejected');

  // 4.3 Missing required column
  const missingColMock = createAuthoritativeCatalogMock();
  missingColMock.query = async (sql, params) => {
    if (sql.includes('information_schema.columns')) {
      const orig = await createAuthoritativeCatalogMock().query(sql, params);
      return { rows: orig.rows.filter(r => !(r.table_name === 'media_files' && r.column_name === 'file_path')) };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let colThrew = false;
  try {
    await verifyFromDb(missingColMock);
  } catch (err) {
    colThrew = true;
    assert(err.message.includes('file_path'), 'Missing file_path column fails closed');
  }
  assert(colThrew, 'Missing required column rejected');

  // 4.4 Incompatible data type (file_size as varchar instead of bigint)
  const badTypeMock = createAuthoritativeCatalogMock();
  badTypeMock.query = async (sql, params) => {
    if (sql.includes('information_schema.columns')) {
      const orig = await createAuthoritativeCatalogMock().query(sql, params);
      return {
        rows: orig.rows.map(r => {
          if (r.table_name === 'media_files' && r.column_name === 'file_size') {
            return { ...r, data_type: 'character varying' };
          }
          return r;
        }),
      };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let typeThrew = false;
  try {
    await verifyFromDb(badTypeMock);
  } catch (err) {
    typeThrew = true;
    assert(err.message.includes('file_size') && err.message.includes('incompatible data type'), 'Incompatible data type on file_size fails closed');
  }
  assert(typeThrew, 'Incompatible column data type rejected');

  // 4.5 Incompatible nullability on NOT NULL column
  const badNotNullMock = createAuthoritativeCatalogMock();
  badNotNullMock.query = async (sql, params) => {
    if (sql.includes('information_schema.columns')) {
      const orig = await createAuthoritativeCatalogMock().query(sql, params);
      return {
        rows: orig.rows.map(r => {
          if (r.table_name === 'media_files' && r.column_name === 'filename') {
            return { ...r, is_nullable: 'YES' };
          }
          return r;
        }),
      };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let notNullThrew = false;
  try {
    await verifyFromDb(badNotNullMock);
  } catch (err) {
    notNullThrew = true;
    assert(err.message.includes('filename') && err.message.includes('expected NOT NULL'), 'Nullable filename on mandatory column fails closed');
  }
  assert(notNullThrew, 'Incompatible nullability on NOT NULL column rejected');

  // 4.6 Incompatible nullability on nullable column
  const badNullableMock = createAuthoritativeCatalogMock();
  badNullableMock.query = async (sql, params) => {
    if (sql.includes('information_schema.columns')) {
      const orig = await createAuthoritativeCatalogMock().query(sql, params);
      return {
        rows: orig.rows.map(r => {
          if (r.table_name === 'media_folders' && r.column_name === 'parent_id') {
            return { ...r, is_nullable: 'NO' };
          }
          return r;
        }),
      };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let nullableThrew = false;
  try {
    await verifyFromDb(badNullableMock);
  } catch (err) {
    nullableThrew = true;
    assert(err.message.includes('parent_id') && err.message.includes('expected NULLABLE'), 'NOT NULL parent_id fails closed');
  }
  assert(nullableThrew, 'Incompatible nullability on nullable column rejected');

  // 4.7 Missing primary key
  const badPKMock = createAuthoritativeCatalogMock();
  badPKMock.query = async (sql, params) => {
    if (sql.includes('information_schema.table_constraints') && !sql.includes('FOREIGN KEY')) {
      return {
        rows: [
          { table_name: 'media_files', constraint_name: 'media_files_pkey', constraint_type: 'PRIMARY KEY', column_name: 'id' },
          { table_name: 'media_folders', constraint_name: 'media_folders_slug_key', constraint_type: 'UNIQUE', column_name: 'slug' },
        ],
      };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let pkThrew = false;
  try {
    await verifyFromDb(badPKMock);
  } catch (err) {
    pkThrew = true;
    assert(err.message.includes('media_folders(id)'), 'Missing media_folders primary key fails closed');
  }
  assert(pkThrew, 'Missing primary key rejected');

  // 4.8 Missing unique constraint
  const badUniqueMock = createAuthoritativeCatalogMock();
  badUniqueMock.query = async (sql, params) => {
    if (sql.includes('information_schema.table_constraints') && !sql.includes('FOREIGN KEY')) {
      return {
        rows: [
          { table_name: 'media_folders', constraint_name: 'media_folders_pkey', constraint_type: 'PRIMARY KEY', column_name: 'id' },
          { table_name: 'media_files', constraint_name: 'media_files_pkey', constraint_type: 'PRIMARY KEY', column_name: 'id' },
        ],
      };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let uniqThrew = false;
  try {
    await verifyFromDb(badUniqueMock);
  } catch (err) {
    uniqThrew = true;
    assert(err.message.includes('media_folders(slug)'), 'Missing slug unique constraint fails closed');
  }
  assert(uniqThrew, 'Missing unique constraint rejected');

  // 4.9 Missing foreign key
  const missingFKMock = createAuthoritativeCatalogMock();
  missingFKMock.query = async (sql, params) => {
    if (sql.includes('information_schema.table_constraints') && sql.includes('FOREIGN KEY')) {
      return {
        rows: [
          { table_name: 'media_folders', column_name: 'parent_id', foreign_table_name: 'media_folders', foreign_column_name: 'id', delete_rule: 'SET NULL' },
        ],
      };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let missingFKThrew = false;
  try {
    await verifyFromDb(missingFKMock);
  } catch (err) {
    missingFKThrew = true;
    assert(err.message.includes('media_files.folder_id'), 'Missing foreign key on folder_id fails closed');
  }
  assert(missingFKThrew, 'Missing foreign key rejected');

  // 4.10 Missing performance index
  const badIndexMock = createAuthoritativeCatalogMock();
  badIndexMock.query = async (sql, params) => {
    if (sql.includes('pg_catalog.pg_indexes')) {
      return {
        rows: [
          { tablename: 'media_files', indexname: 'idx_media_files_folder' },
          { tablename: 'media_folders', indexname: 'idx_media_folders_slug' },
        ],
      };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let indexThrew = false;
  try {
    await verifyFromDb(badIndexMock);
  } catch (err) {
    indexThrew = true;
    assert(err.message.includes('idx_media_files_created'), 'Missing index idx_media_files_created fails closed');
  }
  assert(indexThrew, 'Missing index rejected');

  // 4.11 Missing seed folder
  const badSeedMock = createAuthoritativeCatalogMock();
  badSeedMock.query = async (sql, params) => {
    if (sql.includes('SELECT slug FROM media_folders')) {
      return {
        rows: [
          { slug: 'products' },
          { slug: 'banners' },
          { slug: 'categories' },
          { slug: 'brands' },
          { slug: 'services' },
        ],
      };
    }
    return (await createAuthoritativeCatalogMock().query(sql, params));
  };
  let seedThrew = false;
  try {
    await verifyFromDb(badSeedMock);
  } catch (err) {
    seedThrew = true;
    assert(err.message.includes('general'), 'Missing default seed folder general fails closed');
  }
  assert(seedThrew, 'Missing default seed folder rejected');

  console.log('');

  // ---------------------------------------------------------------------------
  // Test Group 5: Zero Runtime Mutations & Safe Read-Only Queries
  // ---------------------------------------------------------------------------
  console.log('--- [Test Group 5] Zero Runtime Mutations & Safe Read-Only Queries ---');

  const zeroMutationMock = createAuthoritativeCatalogMock();
  await verifyFromDb(zeroMutationMock);
  const mutationRegex = /^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b/i;
  const mutationsIssued = zeroMutationMock.issuedQueries.filter(q => mutationRegex.test(q.sql));
  assert(mutationsIssued.length === 0, 'verifyMediaSchemaReadiness executed strictly read-only catalog queries (ZERO mutations)');

  console.log('');

  // ---------------------------------------------------------------------------
  // Test Group 6: Deployment Manifest Integrity Requirements
  // ---------------------------------------------------------------------------
  console.log('--- [Test Group 6] Deployment Manifest Integrity Requirements ---');

  const manifestPath = path.join(rootDir, 'DEPLOYMENT_MANIFEST.txt');
  if (fs.existsSync(manifestPath)) {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifestLines = manifestContent.split('\n');
    const selfEntries = manifestLines.filter(line => {
      const parts = line.trim().split(/\s+/);
      return parts.length >= 3 && parts[2] === 'DEPLOYMENT_MANIFEST.txt';
    });
    assert(selfEntries.length === 0, 'DEPLOYMENT_MANIFEST.txt contains NO circular self-checksum entry');
    assert(manifestContent.includes('external SHA-256') || manifestContent.includes('SHA256SUMS'), 'DEPLOYMENT_MANIFEST.txt documents external integrity verification');
  } else {
    console.log('  ℹ Notice: DEPLOYMENT_MANIFEST.txt pending generation in packaging task');
  }

  console.log('\n======================================================================');
  console.log(` RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
