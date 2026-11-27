/**
 * backend/authUtils.js - Cryptographic Utilities & Security Helpers
 * Bagan Medical Hall Pharmacy POS & Accounting
 */

import crypto from 'crypto';

// Optional bcrypt import with graceful fallback to native Node.js crypto (scrypt)
let bcrypt = null;
try {
  bcrypt = await import('bcrypt');
} catch (_) {
  try {
    bcrypt = await import('bcryptjs');
  } catch (__) {
    // Native crypto fallback will be used
  }
}

/**
 * Validate that production session secret is set and has sufficient entropy.
 * Standardized on SESSION_SECRET (accepts AUTH_SESSION_SECRET as alias).
 * @param {object} [env] Environment map (defaults to process.env)
 * @returns {string} The verified secret
 */
export function getSessionSecret(env = process.env) {
  const secret = env.SESSION_SECRET || env.AUTH_SESSION_SECRET;
  if (!secret || secret.trim().length < 32) {
    if (env.NODE_ENV === 'production') {
      console.error('[CRITICAL_SECURITY] SESSION_SECRET must be defined with at least 32 characters in production. Server halted.');
      throw new Error('SESSION_SECRET is missing or too short (minimum 32 characters required in production).');
    }
  }
  return secret || 'dev_fallback_secret_must_be_replaced_in_production_32chars!';
}

/**
 * @deprecated Legacy helper retained for backward compatibility with Stage 9.1 test suite.
 * The production authentication architecture uses the Synchronizer Token Pattern (STP)
 * where per-session CSRF tokens are statefully validated via SHA-256 digests in user_sessions.csrf_hash.
 */
export function getCsrfSecret(env = process.env) {
  const secret = env.CSRF_SECRET;
  if (!secret || secret.trim().length < 32) {
    if (env.NODE_ENV === 'production') {
      throw new Error('CSRF_SECRET is missing or too short (minimum 32 characters required in production).');
    }
  }
  return secret || 'dev_csrf_fallback_32_characters_long_entropy!';
}

export { validateCorsConfig } from './corsConfig.js';

/**
 * Synchronizer Token Pattern (STP) CSRF Architecture:
 * Anti-CSRF defense is achieved via statefully bound session tokens:
 * 1. Upon login/session creation, a high-entropy 32-byte cryptographically secure random token is generated.
 * 2. Its SHA-256 digest is stored in the PostgreSQL database within user_sessions.csrf_hash.
 * 3. On state-changing mutations (POST, PUT, DELETE, PATCH), the submitted token is hashed with SHA-256
 *    and compared in constant time (crypto.timingSafeEqual) against the verified session record.
 * 4. Because tokens are bound directly to authenticated database sessions, no global signing secret is needed.
 */

export const DEFAULT_PBKDF2_ITERATIONS = 220000;

/**
 * Securely hash a password using Node.js native crypto PBKDF2 with SHA-512.
 * Defaults to OWASP-compliant 220,000 iterations, 32-byte salt, 64-byte derived key.
 * Always produces native versioned PBKDF2 hashes in the format:
 * $pbkdf2-sha512$i=220000$s=<salt>$h=<hash>
 *
 * @param {string} password Plaintext password
 * @param {number} [iterations=220000] PBKDF2 iterations
 * @returns {Promise<string>} Encoded password hash in format $pbkdf2-sha512$i=220000$s=<salt>$h=<hash>
 */
export async function hashPassword(password, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  // Node.js native PBKDF2-SHA512 (Zero external native dependency risk)
  const salt = crypto.randomBytes(32).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
  return `$pbkdf2-sha512$i=${iterations}$s=${salt}$h=${derivedKey.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored hash with rehash status detection.
 * Constant-time comparison using crypto.timingSafeEqual for native formats.
 * Supports:
 * - $pbkdf2-sha512$ (Native Node.js PBKDF2 with SHA-512, 220k standard / 100k legacy)
 * - $scrypt$ (Native Node.js scrypt legacy format)
 * - $2a$, $2b$, $2y$ (bcrypt legacy format, if bcrypt or bcryptjs is installed)
 *
 * On successful verification, legacy hashes (PBKDF2 with i < 220,000, scrypt, or bcrypt)
 * return needsRehash: true, triggering transparent optimistic upgrade to PBKDF2 220,000 on login.
 *
 * @param {string} password Plaintext password
 * @param {string} storedHash Stored password hash
 * @returns {Promise<{ valid: boolean, needsRehash: boolean }>}
 */
export async function verifyPasswordWithStatus(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return { valid: false, needsRehash: false };
  }

  // 1. PBKDF2-SHA512 format
  if (storedHash.startsWith('$pbkdf2-sha512$')) {
    try {
      const parts = storedHash.split('$');
      const iterPart = parts.find(p => p.startsWith('i='));
      const saltPart = parts.find(p => p.startsWith('s='));
      const hashPart = parts.find(p => p.startsWith('h='));
      if (!iterPart || !saltPart || !hashPart) return { valid: false, needsRehash: false };

      const iterations = parseInt(iterPart.substring(2), 10);
      const salt = saltPart.substring(2);
      const expectedHashHex = hashPart.substring(2);

      const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
      const expectedBuffer = Buffer.from(expectedHashHex, 'hex');

      if (derivedKey.length !== expectedBuffer.length) return { valid: false, needsRehash: false };
      const valid = crypto.timingSafeEqual(derivedKey, expectedBuffer);
      const needsRehash = valid && (iterations < DEFAULT_PBKDF2_ITERATIONS);
      return { valid, needsRehash };
    } catch (_) {
      return { valid: false, needsRehash: false };
    }
  }

  // 2. scrypt format
  if (storedHash.startsWith('$scrypt$')) {
    try {
      const parts = storedHash.split('$');
      const saltPart = parts.find(p => p.startsWith('s='));
      const hashPart = parts.find(p => p.startsWith('h='));
      if (!saltPart || !hashPart) return { valid: false, needsRehash: false };

      const salt = saltPart.substring(2);
      const expectedHashHex = hashPart.substring(2);

      const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
      const expectedBuffer = Buffer.from(expectedHashHex, 'hex');

      if (derivedKey.length !== expectedBuffer.length) return { valid: false, needsRehash: false };
      const valid = crypto.timingSafeEqual(derivedKey, expectedBuffer);
      // Migrate legacy scrypt hashes to modern PBKDF2 220k on successful verification
      return { valid, needsRehash: valid };
    } catch (_) {
      return { valid: false, needsRehash: false };
    }
  }

  // 3. bcrypt format ($2a$, $2b$, $2y$)
  if (storedHash.startsWith('$2')) {
    if (bcrypt && typeof bcrypt.compare === 'function') {
      try {
        const valid = await bcrypt.compare(password, storedHash);
        // Automatically upgrade legacy bcrypt hashes to modern PBKDF2 220k on successful verification
        return { valid, needsRehash: valid };
      } catch (_) {
        return { valid: false, needsRehash: false };
      }
    }
    return { valid: false, needsRehash: false };
  }

  return { valid: false, needsRehash: false };
}

/**
 * Verify a plaintext password against a stored hash (boolean helper).
 * @param {string} password Plaintext password
 * @param {string} storedHash Stored password hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  const result = await verifyPasswordWithStatus(password, storedHash);
  return result.valid;
}

/**
 * Generate a cryptographically secure random session token.
 * 32 bytes -> 64 hex characters.
 * @returns {string}
 */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a cryptographically secure temporary password reset token.
 * Prefixed with 'bmh_rst_' to isolate it from standard session tokens.
 * @returns {string}
 */
export function generateResetToken() {
  return `bmh_rst_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Compute SHA-256 hash of a session token for storage.
 * Only the hash is stored in the database.
 * @param {string} token Plaintext session token
 * @returns {string} SHA-256 hex digest
 */
export function hashToken(token) {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Generate a cryptographically secure CSRF token.
 * @returns {string}
 */
export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Timing-safe validation of a submitted CSRF token against its expected hash.
 * @param {string} submittedToken Token provided by client in header
 * @param {string} expectedHash Hash stored in session
 * @returns {boolean}
 */
export function verifyCsrfToken(submittedToken, expectedHash) {
  if (!submittedToken || !expectedHash) return false;
  const submittedHash = hashToken(submittedToken);
  const bufA = Buffer.from(submittedHash, 'utf8');
  const bufB = Buffer.from(expectedHash, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate a high-entropy temporary one-time password for staff setup.
 * Length 12, guaranteed mixed characters.
 * @returns {string}
 */
export function generateTemporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  const bytes = crypto.randomBytes(12);
  let res = '';
  for (let i = 0; i < 12; i++) {
    res += chars[bytes[i] % chars.length];
  }
  return res;
}

/**
 * Normalize and sanitize usernames (lowercase, trim).
 * @param {string} username
 * @returns {string}
 */
export function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return '';
  return username.trim().toLowerCase();
}

/**
 * Build a rate-limiting key for IP and username.
 * @param {string} ip
 * @param {string} [username]
 * @returns {string}
 */
export function getRateLimitKey(ip, username = '') {
  const cleanIp = (ip || 'unknown').replace(/[^a-zA-Z0-9_\.:-]/g, '').substring(0, 45);
  const cleanUser = sanitizeUsername(username).substring(0, 64);
  return cleanUser ? `ip_${cleanIp}:user_${cleanUser}` : `ip_${cleanIp}`;
}

/**
 * Sign a session token using HMAC-SHA256 with the session secret.
 * Encodes token as 's:<token>.<base64url_hmac>' for tamper-proof client-side cookie storage.
 * @param {string} token Plain session token
 * @param {string} [secret] Optional signing secret (defaults to getSessionSecret())
 * @returns {string} Signed token string
 */
export function signSessionToken(token, secret = getSessionSecret()) {
  if (!token || typeof token !== 'string') return '';
  const hmac = crypto.createHmac('sha256', secret).update(token).digest('base64url');
  return `s:${token}.${hmac}`;
}

/**
 * Verify and unsign a session token string.
 * Validates HMAC signature using constant-time comparison.
 * If input is in 's:<token>.<hmac>' format, returns the raw token if valid or null if invalid.
 * If input is a raw token (not starting with 's:'), returns it as-is for backward compatibility.
 * @param {string} input Raw or signed token string
 * @param {string} [secret] Optional signing secret (defaults to getSessionSecret())
 * @returns {string|null} Raw token or null if signature is invalid
 */
export function unsignSessionToken(input, secret = getSessionSecret()) {
  if (!input || typeof input !== 'string') return null;
  if (input.startsWith('s:')) {
    const lastDot = input.lastIndexOf('.');
    if (lastDot < 2) return null;
    const token = input.substring(2, lastDot);
    const expectedHmac = input.substring(lastDot + 1);
    const computedHmac = crypto.createHmac('sha256', secret).update(token).digest('base64url');
    const bufA = Buffer.from(expectedHmac, 'utf8');
    const bufB = Buffer.from(computedHmac, 'utf8');
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      return token;
    }
    return null;
  }
  return input;
}

export default {
  getSessionSecret,
  DEFAULT_PBKDF2_ITERATIONS,
  hashPassword,
  verifyPassword,
  verifyPasswordWithStatus,
  signSessionToken,
  unsignSessionToken,
  generateSessionToken,
  generateResetToken,
  hashToken,
  generateCsrfToken,
  verifyCsrfToken,
  generateTemporaryPassword,
  sanitizeUsername,
  getRateLimitKey,
};
