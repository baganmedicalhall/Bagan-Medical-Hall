/**
 * backend/authMiddleware.js - Authentication & Dynamic RBAC Middleware
 * Bagan Medical Hall Pharmacy POS & Accounting
 */

import { query } from './db.js';
import { hashToken, verifyCsrfToken, unsignSessionToken } from './authUtils.js';
import { getEffectivePermissions } from './authController.js';

/**
 * Base Session Authentication Middleware:
 * Resolves session from cookie (`bmh_session`), Authorization Bearer header, or body `resetToken`.
 * Verifies cryptographic HMAC signature if signed cookie is presented.
 * Validates against database user_sessions, checking expiration, revocation, and active account status.
 * Attaches verified `req.session` and `req.user` context.
 * DOES NOT block reset-only sessions (allows both operational and reset-only sessions to proceed).
 */
export async function authenticateSession(req, res, next) {
  try {
    const rawInput = req.cookies?.bmh_session || 
      (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim() ||
      req.body?.resetToken;

    if (!rawInput) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHENTICATED',
        message: 'Authentication required. Please sign in to access this resource.',
      });
    }

    const rawToken = unsignSessionToken(rawInput);
    if (!rawToken) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_SESSION_SIGNATURE',
        message: 'Session signature verification failed. Please sign in again.',
      });
    }

    const tokenHash = hashToken(rawToken);

    // 1. Validate session record in database
    const sessionRes = await query(
      `SELECT s.id AS session_id, s.user_id, s.csrf_hash, s.expires_at, s.revoked_at, s.is_password_reset,
              u.id, u.username, u.email, u.name, u.role_id, u.status, u.is_super_admin, u.must_reset_password,
              u.password_hash,
              r.slug AS role_slug, r.name AS role_name
       FROM user_sessions s
       JOIN app_users u ON s.user_id = u.id
       JOIN app_roles r ON u.role_id = r.id
       WHERE s.session_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_SESSION',
        message: 'Invalid session identifier. Please sign in again.',
      });
    }

    const session = sessionRes.rows[0];

    // 2. Check revocation
    if (session.revoked_at) {
      return res.status(401).json({
        status: 'error',
        code: 'SESSION_REVOKED',
        message: 'Session has been revoked or terminated. Please sign in again.',
      });
    }

    // 3. Check expiration
    if (new Date(session.expires_at) <= new Date()) {
      return res.status(401).json({
        status: 'error',
        code: 'SESSION_EXPIRED',
        message: 'Session has expired. Please sign in again.',
      });
    }

    // 4. Verify account active status
    if (session.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Your account has been deactivated. Please contact the administrator.',
      });
    }

    // 5. Evaluate dynamic effective permissions
    let permissions = {};
    if (!session.is_password_reset) {
      permissions = await getEffectivePermissions(session.user_id, session.role_id, session.is_super_admin);
    }

    // Attach verified user and session to request
    req.user = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      name: session.name,
      role: session.role_slug,
      roleId: session.role_id,
      passwordHash: session.password_hash,
      isSuperAdmin: Boolean(session.is_super_admin),
      mustResetPassword: Boolean(session.must_reset_password),
      permissions,
    };

    req.session = {
      id: session.session_id,
      csrfHash: session.csrf_hash,
      expiresAt: session.expires_at,
      isPasswordReset: Boolean(session.is_password_reset),
      userId: session.user_id,
    };

    next();
  } catch (err) {
    console.error('[AUTHENTICATE_SESSION_ERROR]', err);
    return res.status(500).json({
      status: 'error',
      message: 'Internal authorization error while validating session.',
    });
  }
}

/**
 * Operational Authentication Middleware:
 * Validates session using authenticateSession, AND explicitly rejects reset-only sessions.
 * Used for all standard application APIs (POS, inventory, staff, media, settings).
 */
export async function requireAuth(req, res, next) {
  return authenticateSession(req, res, () => {
    if (req.session.isPasswordReset) {
      return res.status(403).json({
        status: 'error',
        code: 'PASSWORD_RESET_REQUIRED',
        message: 'Access denied: Password reset is mandatory before accessing application resources.',
      });
    }
    next();
  });
}

/**
 * Mandatory Password Reset Authentication Middleware:
 * Validates session using authenticateSession, AND explicitly requires a reset-only session.
 */
export async function requireResetAuth(req, res, next) {
  return authenticateSession(req, res, () => {
    if (!req.session.isPasswordReset) {
      return res.status(403).json({
        status: 'error',
        code: 'INVALID_RESET_SESSION',
        message: 'Access denied: Standard session token cannot be used for mandatory password reset.',
      });
    }
    if (!req.user.mustResetPassword) {
      return res.status(403).json({
        status: 'error',
        code: 'RESET_NOT_REQUIRED',
        message: 'Access denied: This user account does not require a password reset.',
      });
    }
    next();
  });
}

/**
 * Role-Based Access Control Middleware.
 * Rejects requests if user's role is not in allowedRoles.
 * Super Admins automatically bypass role restrictions.
 *
 * @param {string|string[]} allowedRoles
 * @returns {Function} Express middleware
 */
export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHENTICATED',
        message: 'Authentication required before role verification.',
      });
    }

    // Super Admin has unrestricted administrative authority
    if (req.user.isSuperAdmin) {
      return next();
    }

    if (roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN_ROLE',
      message: `Access denied: Role "${req.user.role}" is not authorized for this operation.`,
    });
  };
}

/**
 * Granular Dynamic Permission Middleware.
 * Enforces specific permission code (e.g. 'mediaDelete', 'staffManage', 'inventoryEdit').
 * Checks Super Admin, individual overrides, and role-mapped permissions.
 *
 * @param {string} permCode Master permission code from app_permissions
 * @returns {Function} Express middleware
 */
export function requirePermission(permCode) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHENTICATED',
        message: 'Authentication required before permission verification.',
      });
    }

    // Super Admin has all permissions unconditionally
    if (req.user.isSuperAdmin) {
      return next();
    }

    if (req.user.permissions && req.user.permissions[permCode] === true) {
      return next();
    }

    return res.status(403).json({
      status: 'error',
      code: 'PERMISSION_DENIED',
      message: `Access denied: Missing required permission "${permCode}".`,
    });
  };
}

/**
 * Anti-CSRF Middleware: Validates X-CSRF-Token on state-changing requests.
 * Applicable to POST, PUT, DELETE, PATCH requests authenticated via session cookies.
 */
export function validateCsrf(req, res, next) {
  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!mutatingMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // If request is authenticated via cookie OR is a password-reset session
  const isCookieAuth = Boolean(req.cookies?.bmh_session);
  const isResetSession = Boolean(req.session?.isPasswordReset || req.body?.resetToken);

  if (!isCookieAuth && !isResetSession) {
    // Pure Bearer token API requests without cookies are inherently immune to browser CSRF
    return next();
  }

  const submittedCsrf = req.headers['x-csrf-token'] || req.body?._csrf;
  const expectedHash = req.session?.csrfHash;

  if (!submittedCsrf || !expectedHash) {
    return res.status(403).json({
      status: 'error',
      code: 'CSRF_MISSING',
      message: 'Cross-Site Request Forgery (CSRF) validation failed: Missing CSRF token header.',
    });
  }

  const isValid = verifyCsrfToken(submittedCsrf, expectedHash);
  if (!isValid) {
    return res.status(403).json({
      status: 'error',
      code: 'CSRF_INVALID',
      message: 'Cross-Site Request Forgery (CSRF) validation failed: Invalid or mismatched CSRF token.',
    });
  }

  next();
}

/**
 * Anti-Tampering & Last-Super-Admin Protection Middleware.
 * Ensures:
 * 1. A normal Developer cannot modify, deassign, or delete a Super Admin.
 * 2. A normal Developer cannot grant themselves `is_super_admin = true`.
 * 3. The last active Super Admin cannot be deactivated, demoted, or deleted.
 *
 * @param {string} targetUserIdParam Parameter name containing target user ID (e.g. 'id')
 */
export function protectSuperAdmin(targetUserIdParam = 'id') {
  return async (req, res, next) => {
    try {
      const targetUserId = req.params[targetUserIdParam] || req.body?.id;
      const { isSuperAdmin: requestedSuperAdmin, status: requestedStatus, roleId: requestedRoleId } = req.body || {};

      // Rule 1: A non-super-admin cannot grant Super Admin privileges
      if (requestedSuperAdmin === true && !req.user.isSuperAdmin) {
        return res.status(403).json({
          status: 'error',
          code: 'PRIVILEGE_ESCALATION_BLOCKED',
          message: 'Access denied: Only existing Super Admins can promote an account to Super Admin.',
        });
      }

      if (!targetUserId) {
        return next();
      }

      // Query target user profile
      const targetRes = await query(
        'SELECT id, username, is_super_admin, status FROM app_users WHERE id = $1 LIMIT 1',
        [targetUserId]
      );

      if (targetRes.rows.length === 0) {
        return next();
      }

      const target = targetRes.rows[0];

      // Rule 2: A non-super-admin cannot edit or delete an existing Super Admin
      if (target.is_super_admin && !req.user.isSuperAdmin) {
        return res.status(403).json({
          status: 'error',
          code: 'SUPER_ADMIN_PROTECTED',
          message: 'Access denied: Protected Super Admin accounts can only be managed by Super Admins.',
        });
      }

      // Rule 3: Check if this operation affects the last active Super Admin
      if (target.is_super_admin) {
        const isDeactivation = requestedStatus && requestedStatus !== 'active';
        const isDemotion = requestedSuperAdmin === false;
        const isDeletion = req.method.toUpperCase() === 'DELETE';

        if (isDeactivation || isDemotion || isDeletion) {
          const countRes = await query(
            "SELECT COUNT(*)::int AS count FROM app_users WHERE is_super_admin = TRUE AND status = 'active'"
          );
          const activeSuperAdminCount = countRes.rows[0]?.count || 0;

          if (activeSuperAdminCount <= 1) {
            return res.status(403).json({
              status: 'error',
              code: 'LAST_SUPER_ADMIN_LOCKED',
              message: 'Action blocked: Cannot deactivate, demote, or delete the last active Super Admin account.',
            });
          }
        }
      }

      next();
    } catch (err) {
      console.error('[PROTECT_SUPER_ADMIN_ERROR]', err);
      return res.status(500).json({
        status: 'error',
        message: 'Internal authorization error while checking Super Admin protection.',
      });
    }
  };
}

export default {
  authenticateSession,
  requireAuth,
  requireResetAuth,
  requireRole,
  requirePermission,
  validateCsrf,
  protectSuperAdmin,
};
