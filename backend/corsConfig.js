/**
 * backend/corsConfig.js - Production CORS Security Policy Configuration
 * Bagan Medical Hall Pharmacy POS & Accounting
 */

/**
 * Validates whether an origin string is a well-formed HTTP/HTTPS origin.
 * Must include scheme (http/https), host, optional port, and no path/query/fragment.
 * @param {string} originStr
 * @returns {boolean}
 */
export function isValidOrigin(originStr) {
  if (!originStr || typeof originStr !== 'string') return false;
  if (originStr.includes('*')) return false;
  try {
    const u = new URL(originStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if ((u.pathname && u.pathname !== '/') || u.search || u.hash) return false;
    return originStr.replace(/\/$/, '') === u.origin;
  } catch (_) {
    return false;
  }
}

/**
 * Validates CORS configuration against security policies.
 * In production mode:
 * - Requires a non-empty CORS_ORIGIN whitelist. Missing or empty whitelist halts startup.
 * - Prohibits wildcard '*' origins when credentials/cookies are enabled.
 * - Rejects malformed origin entries.
 * - Returns normalized exact origins list.
 * 
 * @param {object} [env] Environment variables map (defaults to process.env)
 * @returns {{ isProduction: boolean, allowedOrigins: string[] }}
 */
export function validateCorsConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const rawOrigins = env.CORS_ORIGIN || env.ALLOWED_ORIGINS || '';
  const origins = rawOrigins
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (isProd) {
    if (origins.length === 0) {
      throw new Error("[SECURITY CONFIG ERROR] In production, CORS_ORIGIN is mandatory and must contain at least one trusted origin. Server startup halted.");
    }
    if (origins.some(o => o.includes('*'))) {
      throw new Error("[SECURITY CONFIG ERROR] Wildcard CORS ('*') is strictly prohibited in production when credentials/cookies are enabled.");
    }
    for (const o of origins) {
      if (!isValidOrigin(o)) {
        throw new Error(`[SECURITY CONFIG ERROR] Malformed CORS origin '${o}' in production configuration. Origins must be valid http(s) URLs with scheme and host only (e.g. https://bagan.medical.cpanel.site).`);
      }
    }
  }

  const normalizedOrigins = origins.map(o => o.replace(/\/$/, ''));

  return { isProduction: isProd, allowedOrigins: normalizedOrigins };
}

export default { isValidOrigin, validateCorsConfig };
