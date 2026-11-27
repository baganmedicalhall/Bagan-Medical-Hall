/**
 * backend/scripts/bootstrapSuperAdmin.js - Server-Side Super Admin Bootstrap
 * Bagan Medical Hall Pharmacy POS & Accounting
 *
 * Usage from server terminal / SSH only:
 *   node backend/scripts/bootstrapSuperAdmin.js
 * Or with environment variables:
 *   BOOTSTRAP_ADMIN_USER="admin" BOOTSTRAP_ADMIN_PASS="SecretPass123!" node backend/scripts/bootstrapSuperAdmin.js
 */

import readline from 'readline';
import { query, pool, getClient } from '../db.js';
import { hashPassword, sanitizeUsername } from '../authUtils.js';

function askQuestion(queryText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(queryText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHiddenQuestion(queryText) {
  return new Promise((resolve) => {
    process.stdout.write(queryText);
    const stdin = process.stdin;
    if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
      const wasRaw = stdin.isRaw;
      stdin.setRawMode(true);
      stdin.resume();
      let input = '';
      const onData = (char) => {
        const s = char.toString('utf8');
        if (s === '\n' || s === '\r' || s === '\u0004') {
          stdin.setRawMode(wasRaw || false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(input.trim());
        } else if (s === '\u0003') { // Ctrl+C
          stdin.setRawMode(wasRaw || false);
          stdin.pause();
          process.stdout.write('\n');
          process.exit(1);
        } else if (s === '\b' || s === '\x7f') { // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += s;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
    } else {
      // Non-interactive fallback (e.g. piped input)
      askQuestion('').then(resolve);
    }
  });
}

/**
 * Execute Super Admin bootstrap logic transactionally.
 * @param {object} options
 * @param {string} options.username
 * @param {string} [options.email]
 * @param {string} options.password
 * @param {string} [options.name]
 * @param {string} [options.targetDbConfirmation] Explicit database name confirmation
 * @returns {Promise<{ ok: boolean, userId: string, username: string }>}
 */
export async function bootstrapSuperAdmin({
  username,
  email,
  password,
  name = 'Lead Developer & Super Admin',
  targetDbConfirmation,
} = {}) {
  const cleanUser = sanitizeUsername(username);
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanUser || cleanUser.length < 3) {
    throw new Error('Username must be at least 3 characters long.');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  // 1. Strict Database Identity Confirmation
  const dbInfo = await query('SELECT current_database() AS db');
  const actualDb = dbInfo.rows[0]?.db;
  if (!actualDb) {
    throw new Error('Unable to query PostgreSQL database identity.');
  }
  if (targetDbConfirmation !== undefined) {
    if (!targetDbConfirmation || targetDbConfirmation.trim() !== actualDb) {
      throw new Error(`[SECURITY] Database identity confirmation mismatch. Expected exact database name "${actualDb}", received "${targetDbConfirmation}". Bootstrap halted.`);
    }
  }

  // 2. Verify schema readiness
  const tableCheck = await query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'app_users'
  `);

  if (tableCheck.rows.length === 0) {
    throw new Error('Database table "app_users" does not exist. Please run migration first.');
  }

  // 3. Check if a Super Admin already exists
  const existingCheck = await query(`
    SELECT id, username, email, created_at 
    FROM app_users 
    WHERE is_super_admin = TRUE 
    LIMIT 1
  `);

  if (existingCheck.rows.length > 0) {
    const sa = existingCheck.rows[0];
    return {
      ok: false,
      alreadyExists: true,
      message: `A Super Admin already exists: ${sa.username} (${sa.id})`,
      user: sa,
    };
  }

  // 4. Verify role 'role_dev' exists
  const roleCheck = await query(`SELECT id FROM app_roles WHERE slug = 'developer' OR id = 'role_dev' LIMIT 1`);
  let roleId = 'role_dev';
  if (roleCheck.rows.length > 0) {
    roleId = roleCheck.rows[0].id;
  } else {
    throw new Error('The default role "developer" (role_dev) was not found in app_roles.');
  }

  // 4. Hash password securely using native cryptographic PBKDF2/scrypt
  const hashed = await hashPassword(password);
  const userId = `usr_superadmin_${Date.now()}`;
  const auditId = `audit_${Date.now()}`;

  // 5. Execute creation atomically in a PostgreSQL transaction with concurrency lock
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Concurrency Protection: Acquire advisory transaction lock to eliminate TOCTOU race conditions
    await client.query('SELECT pg_advisory_xact_lock(74291)');

    // Re-verify inside the exclusive advisory lock
    const existingInTx = await client.query(`
      SELECT id, username, email, created_at 
      FROM app_users 
      WHERE is_super_admin = TRUE 
      LIMIT 1
    `);

    if (existingInTx.rows.length > 0) {
      await client.query('ROLLBACK');
      const sa = existingInTx.rows[0];
      return {
        ok: false,
        alreadyExists: true,
        message: `A Super Admin already exists: ${sa.username} (${sa.id})`,
        user: sa,
      };
    }

    await client.query(`
      INSERT INTO app_users (
        id, username, email, password_hash, name, role_id, role_title, 
        is_super_admin, must_reset_password, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 
        TRUE, FALSE, 'active'
      )
    `, [userId, cleanUser, cleanEmail || null, hashed, name, roleId, 'Lead Developer & Super Admin']);

    await client.query(`
      INSERT INTO permission_audit_logs (id, admin_user_id, admin_username, target_user_id, action, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      auditId,
      userId,
      cleanUser,
      userId,
      'SUPER_ADMIN_BOOTSTRAP',
      JSON.stringify({ message: 'Initial Super Admin provisioned via transactional console bootstrap with advisory lock.' })
    ]);

    await client.query('COMMIT');

    return {
      ok: true,
      userId,
      username: cleanUser,
      role: 'developer',
      status: 'active',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function runBootstrap() {
  console.log('=====================================================');
  console.log(' Bagan Medical Hall — Super Admin Console Bootstrap ');
  console.log('=====================================================');

  try {
    const dbInfo = await pool.query('SELECT current_database() AS db');
    const targetDb = dbInfo.rows[0]?.db;
    if (!targetDb) {
      throw new Error('Unable to determine PostgreSQL database identity.');
    }
    console.log(`[DATABASE] Target PostgreSQL database: "${targetDb}"`);

    // Strict identity confirmation: requires exact database name (both interactive and non-interactive)
    let confirmation = process.env.BOOTSTRAP_CONFIRM_DB;
    if (!confirmation) {
      confirmation = await askQuestion(`To confirm bootstrap, enter the EXACT database name ("${targetDb}"): `);
    }

    if (!confirmation || confirmation.trim() !== targetDb) {
      console.error(`[ABORTED] Database identity confirmation failed. Expected exact database name "${targetDb}", received "${confirmation}". Bootstrap aborted.`);
      await pool.end();
      process.exit(1);
    }

    let username = process.env.BOOTSTRAP_ADMIN_USER;
    let email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    let password = process.env.BOOTSTRAP_ADMIN_PASS;
    let name = process.env.BOOTSTRAP_ADMIN_NAME || 'Lead Developer & Super Admin';

    if (!username) {
      username = await askQuestion('Enter initial Super Admin Username (e.g. developer): ');
    }
    if (!email) {
      email = await askQuestion('Enter initial Super Admin Email (e.g. dev@baganmedicalhall.com): ');
    }
    if (!password) {
      password = await askHiddenQuestion('Enter initial Super Admin Password (min 8 chars): ');
    }

    const result = await bootstrapSuperAdmin({
      username,
      email,
      password,
      name,
      targetDbConfirmation: confirmation.trim(),
    });
    if (!result.ok && result.alreadyExists) {
      console.log(`[INFO] ${result.message}`);
      console.log('Bootstrap aborted safely to prevent duplicate initialization.');
      await pool.end();
      process.exit(0);
    }

    console.log('-----------------------------------------------------');
    console.log(`[SUCCESS] Super Admin account created successfully!`);
    console.log(` - ID: ${result.userId}`);
    console.log(` - Username: ${result.username}`);
    console.log(` - Role: Developer (Super Admin)`);
    console.log(` - Status: Active`);
    console.log('-----------------------------------------------------');
    console.log('You may now log in to the application as Developer.');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('[FATAL_ERROR] Bootstrap failed:', err.message || err);
    await pool.end();
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('bootstrapSuperAdmin.js')) {
  runBootstrap();
}
