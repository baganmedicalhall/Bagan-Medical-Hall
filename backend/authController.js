/**
 * backend/authController.js - Centralized Authentication Controller
 * Bagan Medical Hall Pharmacy POS & Accounting
 */

import { query, getClient } from './db.js';
import {
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
  sanitizeUsername,
  getRateLimitKey,
} from './authUtils.js';

const isProduction = process.env.NODE_ENV === 'production';
const SESSION_DURATION_HOURS = 8;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Compute the effective permissions map for a given user.
 * Combines role-level permissions with user-specific overrides.
 * Super Admins automatically receive all permissions.
 *
 * @param {string} userId
 * @param {string} roleId
 * @param {boolean} isSuperAdmin
 * @returns {Promise<Record<string, boolean>>}
 */
export async function getEffectivePermissions(userId, roleId, isSuperAdmin = false) {
  // 1. Fetch master permission catalogue
  const allPermsRes = await query('SELECT code FROM app_permissions');
  const allCodes = allPermsRes.rows.map(r => r.code);

  const effective = {};
  allCodes.forEach(code => { effective[code] = false; });

  // Super Admin receives all permissions unconditionally
  if (isSuperAdmin) {
    allCodes.forEach(code => { effective[code] = true; });
    return effective;
  }

  // 2. Load role-level permissions
  const rolePermsRes = await query(
    'SELECT permission_code FROM role_permissions WHERE role_id = $1',
    [roleId]
  );
  rolePermsRes.rows.forEach(r => {
    if (effective[r.permission_code] !== undefined) {
      effective[r.permission_code] = true;
    }
  });

  // 3. Apply individual user overrides (override takes precedence over role)
  const overridesRes = await query(
    'SELECT permission_code, is_granted FROM user_permission_overrides WHERE user_id = $1',
    [userId]
  );
  overridesRes.rows.forEach(r => {
    effective[r.permission_code] = r.is_granted;
  });

  return effective;
}

/**
 * POST /api/auth/login
 * Unified authentication for Staff and Developer users.
 */
export async function login(req, res) {
  try {
    const { username, password, requestedMode } = req.body || {};
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    if (!username || !password) {
      return res.status(400).json({ status: 'error', message: 'Username and password are required.' });
    }

    const cleanUser = sanitizeUsername(username);
    const rateLimitKey = getRateLimitKey(ip, cleanUser);

    // 1. Check rate limits (Multi-process distributed guard via database)
    const rateRes = await query(
      'SELECT failed_attempts, locked_until FROM login_rate_limits WHERE key = $1',
      [rateLimitKey]
    );
    if (rateRes.rows.length > 0) {
      const { failed_attempts, locked_until } = rateRes.rows[0];
      if (locked_until && new Date(locked_until) > new Date()) {
        const remainingMinutes = Math.ceil((new Date(locked_until).getTime() - Date.now()) / 60000);
        return res.status(429).json({
          status: 'error',
          code: 'RATE_LIMIT_LOCKED',
          message: `Too many failed attempts. Account login locked for ${remainingMinutes} minute(s).`,
        });
      }
    }

    // 2. Query user case-insensitively
    const userRes = await query(
      `SELECT u.*, r.slug AS role_slug, r.name AS role_name 
       FROM app_users u 
       JOIN app_roles r ON u.role_id = r.id 
       WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1) 
       LIMIT 1`,
      [cleanUser]
    );

    const user = userRes.rows[0];

    // Helper: Record failed attempt
    const recordFailedAttempt = async () => {
      await query(
        `INSERT INTO login_rate_limits (key, failed_attempts, first_failed_at, locked_until)
         VALUES ($1, 1, NOW(), NULL)
         ON CONFLICT (key) DO UPDATE SET 
           failed_attempts = login_rate_limits.failed_attempts + 1,
           locked_until = CASE 
             WHEN login_rate_limits.failed_attempts + 1 >= $2 THEN NOW() + INTERVAL '${LOCKOUT_MINUTES} minutes'
             ELSE NULL 
           END`,
        [rateLimitKey, MAX_FAILED_ATTEMPTS]
      );
    };

    if (!user) {
      await recordFailedAttempt();
      return res.status(401).json({ status: 'error', message: 'Invalid credentials. Please verify username and password.' });
    }

    // 3. Verify password hash
    const passCheck = await verifyPasswordWithStatus(password, user.password_hash);
    if (!passCheck.valid) {
      await recordFailedAttempt();
      return res.status(401).json({ status: 'error', message: 'Invalid credentials. Please verify username and password.' });
    }

    // Transparently rehash to OWASP-compliant 220,000 PBKDF2 iterations if stored hash is legacy
    if (passCheck.needsRehash) {
      try {
        const upgradedHash = await hashPassword(password);
        // Optimistic concurrency condition: update only if password_hash has not changed concurrently
        const updateRes = await query(
          'UPDATE app_users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND password_hash = $3',
          [upgradedHash, user.id, user.password_hash]
        );
        if (updateRes && updateRes.rowCount === 0) {
          console.log(`[AUTH_REHASH_CONCURRENCY] Concurrent password update detected for user ${user.id}. Rehash skipped safely.`);
        }
      } catch (rehashErr) {
        console.warn('[AUTH_REHASH_WARN] Failed to transparently upgrade password hash:', rehashErr.message);
      }
    }

    // 4. Verify account status
    if (user.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        code: 'ACCOUNT_DEACTIVATED',
        message: 'This staff account has been deactivated. Please contact the administrator.',
      });
    }

    // 5. Enforce requested login mode
    const isDevRole = user.role_slug === 'developer' || user.is_super_admin;
    if (requestedMode === 'developer' && !isDevRole) {
      return res.status(403).json({
        status: 'error',
        code: 'DEVELOPER_PORTAL_DENIED',
        message: 'Access denied: This account is not authorized for Developer Portal login.',
      });
    }

    // Clear rate limits on successful authentication
    await query('DELETE FROM login_rate_limits WHERE key = $1', [rateLimitKey]);

    // 6. Mandatory Password Reset for newly provisioned accounts
    if (user.must_reset_password) {
      const resetToken = generateResetToken();
      // Store temporary session with short 15-minute expiry and explicit is_password_reset flag
      const tokenHash = hashToken(resetToken);
      const csrfToken = generateCsrfToken();
      const csrfHash = hashToken(csrfToken);

      await query(
        `INSERT INTO user_sessions (id, user_id, session_hash, csrf_hash, user_agent, ip_address, expires_at, is_password_reset)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '15 minutes', TRUE)`,
        [`sess_rst_${Date.now()}`, user.id, tokenHash, csrfHash, req.headers['user-agent'] || '', ip]
      );

      return res.json({
        status: 'must_reset_password',
        message: 'First-time login: Password reset required before entering the application.',
        resetToken,
        csrfToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role_slug,
          mustResetPassword: true,
        },
      });
    }

    // 7. Generate Full Session and CSRF Tokens
    const sessionToken = generateSessionToken();
    const sessionHash = hashToken(sessionToken);
    const csrfToken = generateCsrfToken();
    const csrfHash = hashToken(csrfToken);

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await query(
      `INSERT INTO user_sessions (id, user_id, session_hash, csrf_hash, user_agent, ip_address, expires_at, is_password_reset)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '${SESSION_DURATION_HOURS} hours', FALSE)`,
      [sessionId, user.id, sessionHash, csrfHash, req.headers['user-agent'] || '', ip]
    );

    // 8. Load effective permissions
    const permissions = await getEffectivePermissions(user.id, user.role_id, user.is_super_admin);

    // 9. Configure Cookies
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_DURATION_HOURS * 3600 * 1000,
    };

    // bmh_session: Signed HttpOnly session cookie (tamper-proof via HMAC-SHA256 signature)
    const signedSessionToken = signSessionToken(sessionToken);
    res.cookie('bmh_session', signedSessionToken, cookieOptions);

    // bmh_csrf: Readable by client for header injection on mutating requests
    res.cookie('bmh_csrf', csrfToken, {
      ...cookieOptions,
      httpOnly: false,
    });

    return res.json({
      status: 'ok',
      csrfToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role_slug,
        roleTitle: user.role_title,
        avatar: user.avatar,
        isSuperAdmin: user.is_super_admin,
      },
      permissions,
    });
  } catch (err) {
    console.error('[AUTH_LOGIN_ERROR]', err);
    return res.status(500).json({ status: 'error', message: 'Internal authentication error. Please try again.' });
  }
}

/**
 * POST /api/auth/logout
 * Revoke the current session and clear authentication cookies.
 */
export async function logout(req, res) {
  try {
    const rawInput = req.cookies?.bmh_session || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    const rawToken = unsignSessionToken(rawInput);
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await query(
        'UPDATE user_sessions SET revoked_at = NOW() WHERE session_hash = $1',
        [tokenHash]
      );
    }

    res.clearCookie('bmh_session', { path: '/' });
    res.clearCookie('bmh_csrf', { path: '/' });

    return res.json({ status: 'ok', message: 'Session successfully revoked and logged out.' });
  } catch (err) {
    console.error('[AUTH_LOGOUT_ERROR]', err);
    return res.status(500).json({ status: 'error', message: 'Error during logout.' });
  }
}

/**
 * GET /api/auth/me
 * Validate session from cookie and restore user profile + permissions.
 */
export async function getMe(req, res) {
  try {
    const rawInput = req.cookies?.bmh_session || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (!rawInput) {
      return res.status(401).json({ status: 'error', code: 'UNAUTHENTICATED', message: 'No active session.' });
    }

    const rawToken = unsignSessionToken(rawInput);
    if (!rawToken) {
      res.clearCookie('bmh_session', { path: '/' });
      res.clearCookie('bmh_csrf', { path: '/' });
      return res.status(401).json({ status: 'error', code: 'INVALID_SESSION_SIGNATURE', message: 'Session signature invalid.' });
    }

    const tokenHash = hashToken(rawToken);
    const sessionRes = await query(
      `SELECT s.*, u.*, r.slug AS role_slug, r.name AS role_name 
       FROM user_sessions s
       JOIN app_users u ON s.user_id = u.id
       JOIN app_roles r ON u.role_id = r.id
       WHERE s.session_hash = $1 AND s.expires_at > NOW() AND s.revoked_at IS NULL
       LIMIT 1`,
      [tokenHash]
    );

    if (sessionRes.rows.length === 0) {
      res.clearCookie('bmh_session', { path: '/' });
      res.clearCookie('bmh_csrf', { path: '/' });
      return res.status(401).json({ status: 'error', code: 'SESSION_EXPIRED', message: 'Session expired or revoked.' });
    }

    const row = sessionRes.rows[0];
    if (row.status !== 'active') {
      return res.status(403).json({ status: 'error', code: 'ACCOUNT_DEACTIVATED', message: 'Account is deactivated.' });
    }

    const permissions = await getEffectivePermissions(row.user_id, row.role_id, row.is_super_admin);
    const csrfToken = req.cookies?.bmh_csrf || '';

    return res.json({
      status: 'ok',
      csrfToken,
      user: {
        id: row.user_id,
        username: row.username,
        email: row.email,
        name: row.name,
        role: row.role_slug,
        roleTitle: row.role_title,
        avatar: row.avatar,
        isSuperAdmin: row.is_super_admin,
        mustResetPassword: row.must_reset_password,
      },
      permissions,
    });
  } catch (err) {
    console.error('[AUTH_ME_ERROR]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to verify session.' });
  }
}

/**
 * POST /api/auth/change-password
 * Mandatory first-time password reset or voluntary password update.
 */
export async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword, resetToken } = req.body || {};

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ status: 'error', message: 'New password must be at least 8 characters long.' });
    }

    let userId = null;
    const isResetSession = req.session?.isPasswordReset;
    const isExplicitResetToken = Boolean(resetToken);

    // 1. Mandatory password reset flow (via reset session or resetToken)
    if (isResetSession || isExplicitResetToken) {
      if (resetToken && (typeof resetToken !== 'string' || !resetToken.startsWith('bmh_rst_'))) {
        return res.status(401).json({
          status: 'error',
          code: 'INVALID_RESET_TOKEN_FORMAT',
          message: 'Invalid reset token format. Expected temporary password reset token.',
        });
      }

      if (req.session && req.user) {
        if (!req.session.isPasswordReset) {
          return res.status(403).json({
            status: 'error',
            code: 'INVALID_RESET_SESSION',
            message: 'Access denied: Standard session token cannot be used as a password reset token.',
          });
        }
        if (!req.user.mustResetPassword) {
          return res.status(403).json({
            status: 'error',
            code: 'RESET_NOT_REQUIRED',
            message: 'Access denied: This user account does not require a password reset.',
          });
        }
        userId = req.user.id;
      } else {
        // Fallback for direct controller invocation
        const tokenHash = hashToken(resetToken);
        const sessRes = await query(
          `SELECT s.id AS session_id, s.user_id, s.is_password_reset, u.must_reset_password 
           FROM user_sessions s
           JOIN app_users u ON s.user_id = u.id
           WHERE s.session_hash = $1 AND s.expires_at > NOW() AND s.revoked_at IS NULL 
           LIMIT 1`,
          [tokenHash]
        );

        if (sessRes.rows.length === 0) {
          return res.status(401).json({
            status: 'error',
            code: 'RESET_TOKEN_EXPIRED',
            message: 'Reset token invalid, expired, or already revoked. Please log in again.',
          });
        }

        const resetSession = sessRes.rows[0];
        if (!resetSession.is_password_reset) {
          return res.status(403).json({
            status: 'error',
            code: 'INVALID_RESET_SESSION',
            message: 'Access denied: Standard session token cannot be used as a password reset token.',
          });
        }
        if (!resetSession.must_reset_password) {
          return res.status(403).json({
            status: 'error',
            code: 'RESET_NOT_REQUIRED',
            message: 'Access denied: This user account does not require a password reset.',
          });
        }
        userId = resetSession.user_id;
      }
    } else {
      // 2. Logged-in user voluntary password change
      if (req.session && req.user) {
        if (req.session.isPasswordReset) {
          return res.status(403).json({
            status: 'error',
            code: 'RESET_SESSION_DENIED',
            message: 'Password reset session cannot execute standard password update.',
          });
        }
        const isOldValid = await verifyPassword(oldPassword || '', req.user.passwordHash || '');
        if (!isOldValid) {
          return res.status(400).json({ status: 'error', code: 'INVALID_OLD_PASSWORD', message: 'Current password is incorrect.' });
        }
        userId = req.user.id;
      } else {
        const rawInput = req.cookies?.bmh_session || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
        if (!rawInput) {
          return res.status(401).json({ status: 'error', code: 'UNAUTHENTICATED', message: 'Authentication required.' });
        }
        const rawToken = unsignSessionToken(rawInput);
        if (!rawToken) {
          return res.status(401).json({ status: 'error', code: 'INVALID_SESSION_SIGNATURE', message: 'Session signature invalid.' });
        }
        if (rawToken.startsWith('bmh_rst_')) {
          return res.status(403).json({
            status: 'error',
            code: 'RESET_TOKEN_MISUSE',
            message: 'Temporary reset token cannot be used for voluntary password change.',
          });
        }

        const tokenHash = hashToken(rawToken);
        const sessRes = await query(
          `SELECT s.user_id, s.is_password_reset, u.password_hash 
           FROM user_sessions s
           JOIN app_users u ON s.user_id = u.id
           WHERE s.session_hash = $1 AND s.expires_at > NOW() AND s.revoked_at IS NULL 
           LIMIT 1`,
          [tokenHash]
        );

        if (sessRes.rows.length === 0) {
          return res.status(401).json({ status: 'error', code: 'SESSION_EXPIRED', message: 'Session expired or invalid.' });
        }

        const session = sessRes.rows[0];
        if (session.is_password_reset) {
          return res.status(403).json({
            status: 'error',
            code: 'RESET_SESSION_DENIED',
            message: 'Password reset session cannot execute standard password update.',
          });
        }

        const isOldValid = await verifyPassword(oldPassword || '', session.password_hash);
        if (!isOldValid) {
          return res.status(400).json({ status: 'error', code: 'INVALID_OLD_PASSWORD', message: 'Current password is incorrect.' });
        }
        userId = session.user_id;
      }
    }

    // Atomically hash new password and update user
    const newHash = await hashPassword(newPassword);
    await query(
      `UPDATE app_users 
       SET password_hash = $1, must_reset_password = FALSE, updated_at = NOW() 
       WHERE id = $2`,
      [newHash, userId]
    );

    // Invalidate all prior sessions for this user for security (single-use revocation)
    await query(
      'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );

    res.clearCookie('bmh_session', { path: '/' });
    res.clearCookie('bmh_csrf', { path: '/' });

    return res.json({
      status: 'ok',
      message: 'Password successfully updated. Please log in with your new password.',
    });
  } catch (err) {
    console.error('[AUTH_CHANGE_PASSWORD_ERROR]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to update password.' });
  }
}

export default {
  getEffectivePermissions,
  login,
  logout,
  getMe,
  changePassword,
};
