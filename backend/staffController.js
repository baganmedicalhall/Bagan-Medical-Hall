/**
 * backend/staffController.js - Developer Hub Staff & Permissions Controller
 * Bagan Medical Hall Pharmacy POS & Accounting
 */

import { query } from './db.js';
import {
  hashPassword,
  generateTemporaryPassword,
  sanitizeUsername,
} from './authUtils.js';
import { getEffectivePermissions } from './authController.js';

/**
 * GET /api/admin/staff
 * List all server-authoritative staff accounts.
 */
export async function getStaffList(req, res) {
  try {
    const result = await query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.name,
        u.role_id,
        COALESCE(r.slug, 'custom') AS role_slug,
        COALESCE(r.name, u.role_title, 'Staff') AS role_name,
        u.role_title,
        u.phone,
        u.status,
        u.avatar,
        u.is_super_admin,
        u.must_reset_password,
        u.created_at,
        u.updated_at
      FROM app_users u
      LEFT JOIN app_roles r ON u.role_id = r.id
      ORDER BY 
        CASE WHEN u.is_super_admin THEN 0 ELSE 1 END,
        u.created_at ASC
    `);

    return res.json({
      status: 'ok',
      staff: result.rows || [],
    });
  } catch (err) {
    console.error('[GET_STAFF_LIST_ERROR]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve staff accounts.' });
  }
}

/**
 * POST /api/admin/staff/provision
 * Provision a candidate staff account with a single-use temporary password.
 */
export async function provisionStaff(req, res) {
  try {
    const { username, name, email, phone, roleId, roleTitle, avatar } = req.body || {};

    if (!username || !name || !roleId) {
      return res.status(400).json({
        status: 'error',
        message: 'Username, Full Name, and Role Category are required to provision an account.',
      });
    }

    const cleanUser = sanitizeUsername(username);
    const cleanEmail = email ? email.trim().toLowerCase() : null;

    if (cleanUser.length < 3) {
      return res.status(400).json({ status: 'error', message: 'Username must be at least 3 characters long.' });
    }

    // 1. Verify role exists
    const roleCheck = await query('SELECT id, slug, name FROM app_roles WHERE id = $1 OR slug = $1 LIMIT 1', [roleId]);
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: `Selected role "${roleId}" does not exist.` });
    }
    const resolvedRole = roleCheck.rows[0];

    // Anti-escalation check: Ordinary Developer cannot provision an account into developer role
    if (resolvedRole.slug === 'developer' && !req.user.isSuperAdmin) {
      return res.status(403).json({
        status: 'error',
        code: 'PRIVILEGE_ESCALATION_BLOCKED',
        message: 'Access denied: Only Super Admins can provision developer accounts.',
      });
    }

    // 2. Check for duplicate username or email case-insensitively
    const duplicateCheck = await query(`
      SELECT id, username, email FROM app_users 
      WHERE LOWER(username) = LOWER($1) 
         OR (email IS NOT NULL AND $2 IS NOT NULL AND LOWER(email) = LOWER($2))
      LIMIT 1
    `, [cleanUser, cleanEmail]);

    if (duplicateCheck.rows.length > 0) {
      const match = duplicateCheck.rows[0];
      const isUserMatch = match.username.toLowerCase() === cleanUser;
      return res.status(409).json({
        status: 'error',
        code: 'DUPLICATE_ACCOUNT',
        message: isUserMatch 
          ? `An account with username "${cleanUser}" already exists.` 
          : `An account with email "${cleanEmail}" already exists.`,
      });
    }

    // 3. Generate high-entropy single-use temporary password
    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);
    const newStaffId = `usr_staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 4. Insert staff account with must_reset_password = TRUE
    await query(`
      INSERT INTO app_users (
        id, username, email, password_hash, name, role_id, role_title,
        phone, avatar, status, is_super_admin, must_reset_password
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, 'active', FALSE, TRUE
      )
    `, [
      newStaffId,
      cleanUser,
      cleanEmail,
      passwordHash,
      name.trim(),
      resolvedRole.id,
      roleTitle ? roleTitle.trim() : resolvedRole.name,
      phone ? phone.trim() : null,
      avatar || '🧑‍⚕️',
    ]);

    // 5. Audit Log (Preserves historical username even if admin account is later modified or removed)
    await query(`
      INSERT INTO permission_audit_logs (id, admin_user_id, admin_username, target_user_id, action, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `audit_${Date.now()}`,
      req.user.id,
      req.user.username,
      newStaffId,
      'STAFF_PROVISIONED',
      JSON.stringify({
        username: cleanUser,
        name: name.trim(),
        role: resolvedRole.slug,
        provisionedBy: req.user.username,
        mustResetPassword: true,
      }),
    ]);

    return res.status(201).json({
      status: 'ok',
      message: `Staff account "${cleanUser}" successfully provisioned with mandatory password reset.`,
      staff: {
        id: newStaffId,
        username: cleanUser,
        name: name.trim(),
        email: cleanEmail,
        role: resolvedRole.slug,
        roleName: resolvedRole.name,
        roleTitle: roleTitle ? roleTitle.trim() : resolvedRole.name,
        status: 'active',
        mustResetPassword: true,
      },
      temporaryPassword: tempPassword, // Transmitted ONCE to the provisioning developer
    });
  } catch (err) {
    console.error('[PROVISION_STAFF_ERROR]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to provision staff account.' });
  }
}

/**
 * PUT /api/admin/staff/:id
 * Update staff details, assigned role, or active status.
 */
export async function updateStaff(req, res) {
  try {
    const { id } = req.params;
    const { name, email, phone, roleId, roleTitle, status, avatar } = req.body || {};

    const existingRes = await query('SELECT * FROM app_users WHERE id = $1 LIMIT 1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Staff member not found.' });
    }

    const currentStaff = existingRes.rows[0];

    // Anti-tampering: Ordinary Developer cannot modify a Super Admin account
    if (currentStaff.is_super_admin && !req.user.isSuperAdmin) {
      return res.status(403).json({
        status: 'error',
        code: 'SUPER_ADMIN_PROTECTED',
        message: 'Access denied: Protected Super Admin accounts can only be managed by Super Admins.',
      });
    }

    // Last Super Admin Protection: Cannot deactivate the last active Super Admin
    if (currentStaff.is_super_admin && status !== undefined && status !== 'active') {
      const countRes = await query("SELECT COUNT(*)::int AS count FROM app_users WHERE is_super_admin = TRUE AND status = 'active'");
      const activeCount = parseInt(countRes.rows[0]?.count || '0', 10);
      if (activeCount <= 1) {
        return res.status(403).json({
          status: 'error',
          code: 'LAST_SUPER_ADMIN_LOCKED',
          message: 'Action blocked: Cannot deactivate the last active Super Admin account.',
        });
      }
    }

    // Role resolution
    let targetRoleId = currentStaff.role_id;
    if (roleId && roleId !== currentStaff.role_id) {
      const roleCheck = await query('SELECT id, slug FROM app_roles WHERE id = $1 OR slug = $1 LIMIT 1', [roleId]);
      if (roleCheck.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: `Target role "${roleId}" not found.` });
      }
      const newRole = roleCheck.rows[0];

      // Anti-escalation: Non-super-admin cannot change anyone's role to developer
      if (newRole.slug === 'developer' && !req.user.isSuperAdmin) {
        return res.status(403).json({
          status: 'error',
          code: 'PRIVILEGE_ESCALATION_BLOCKED',
          message: 'Access denied: Only Super Admins can assign the Developer role.',
        });
      }
      targetRoleId = newRole.id;
    }

    const newName = name !== undefined ? name.trim() : currentStaff.name;
    const newEmail = email !== undefined ? (email ? email.trim().toLowerCase() : null) : currentStaff.email;
    const newPhone = phone !== undefined ? phone.trim() : currentStaff.phone;
    const newTitle = roleTitle !== undefined ? roleTitle.trim() : currentStaff.role_title;
    const newStatus = status !== undefined ? status : currentStaff.status;
    const newAvatar = avatar !== undefined ? avatar : currentStaff.avatar;

    // Check duplicate email if changed
    if (newEmail && newEmail !== currentStaff.email) {
      const emailDup = await query('SELECT id FROM app_users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1', [newEmail, id]);
      if (emailDup.rows.length > 0) {
        return res.status(409).json({ status: 'error', message: `Email "${newEmail}" is already in use by another account.` });
      }
    }

    await query(`
      UPDATE app_users
      SET name = $1, email = $2, phone = $3, role_id = $4, role_title = $5,
          status = $6, avatar = $7, updated_at = NOW()
      WHERE id = $8
    `, [newName, newEmail, newPhone, targetRoleId, newTitle, newStatus, newAvatar, id]);

    // If account was deactivated, revoke all active sessions immediately
    if (newStatus === 'inactive' && currentStaff.status === 'active') {
      await query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
    }

    // Audit Log (Preserves historical username even if admin account is later modified or removed)
    await query(`
      INSERT INTO permission_audit_logs (id, admin_user_id, admin_username, target_user_id, action, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `audit_${Date.now()}`,
      req.user.id,
      req.user.username,
      id,
      'STAFF_UPDATED',
      JSON.stringify({
        updatedBy: req.user.username,
        changes: {
          name: newName !== currentStaff.name ? newName : undefined,
          roleId: targetRoleId !== currentStaff.role_id ? targetRoleId : undefined,
          status: newStatus !== currentStaff.status ? newStatus : undefined,
        },
      }),
    ]);

    return res.json({
      status: 'ok',
      message: 'Staff member updated successfully.',
      staff: {
        id,
        name: newName,
        email: newEmail,
        roleId: targetRoleId,
        status: newStatus,
      },
    });
  } catch (err) {
    console.error('[UPDATE_STAFF_ERROR]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to update staff member.' });
  }
}

/**
 * GET /api/admin/staff/:id/effective-permissions
 * View full permission breakdown (role defaults + individual overrides).
 */
export async function getStaffEffectivePermissions(req, res) {
  try {
    const { id } = req.params;

    const userRes = await query(`
      SELECT u.id, u.username, u.name, u.role_id, u.is_super_admin, 
             COALESCE(r.slug, 'custom') AS role_slug, 
             COALESCE(r.name, 'Custom Role') AS role_name
      FROM app_users u
      LEFT JOIN app_roles r ON u.role_id = r.id
      WHERE u.id = $1
      LIMIT 1
    `, [id]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Staff member not found.' });
    }

    const targetUser = userRes.rows[0];

    // Master permission catalog
    const allPermsRes = await query('SELECT code, category, name, description FROM app_permissions ORDER BY category, code');
    const masterPerms = allPermsRes.rows;

    // Role permissions
    const rolePermsRes = await query('SELECT permission_code FROM role_permissions WHERE role_id = $1', [targetUser.role_id]);
    const roleGrantedCodes = new Set(rolePermsRes.rows.map(r => r.permission_code));

    // Overrides
    const overridesRes = await query('SELECT permission_code, is_granted FROM user_permission_overrides WHERE user_id = $1', [id]);
    const overrideMap = {};
    overridesRes.rows.forEach(r => {
      overrideMap[r.permission_code] = r.is_granted;
    });

    // Construct breakdown
    const breakdown = masterPerms.map(p => {
      const isRoleGranted = roleGrantedCodes.has(p.code);
      const hasOverride = overrideMap[p.code] !== undefined;
      const overrideVal = overrideMap[p.code];

      let effective = false;
      if (targetUser.is_super_admin) {
        effective = true;
      } else if (hasOverride) {
        effective = overrideVal;
      } else {
        effective = isRoleGranted;
      }

      return {
        code: p.code,
        category: p.category,
        name: p.name,
        description: p.description,
        isRoleGranted,
        hasOverride,
        overrideVal: hasOverride ? overrideVal : null,
        effective,
      };
    });

    return res.json({
      status: 'ok',
      user: {
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        role: targetUser.role_slug,
        isSuperAdmin: targetUser.is_super_admin,
      },
      permissions: breakdown,
    });
  } catch (err) {
    console.error('[GET_EFFECTIVE_PERMS_ERROR]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to evaluate effective permissions.' });
  }
}

/**
 * POST /api/admin/staff/:id/overrides
 * Configure granular individual permission overrides.
 */
export async function setStaffOverrides(req, res) {
  try {
    const { id } = req.params;
    const { overrides } = req.body || {}; // Array of { code: string, isGranted: boolean | null }

    if (!Array.isArray(overrides)) {
      return res.status(400).json({ status: 'error', message: 'Expected "overrides" array of { code, isGranted }.' });
    }

    const userRes = await query(`
      SELECT u.id, u.username, u.is_super_admin, COALESCE(r.slug, '') AS role_slug
      FROM app_users u
      LEFT JOIN app_roles r ON u.role_id = r.id
      WHERE u.id = $1 LIMIT 1
    `, [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Staff member not found.' });
    }

    const targetUser = userRes.rows[0];

    // Super Admin accounts cannot have revocations applied
    if (targetUser.is_super_admin) {
      return res.status(403).json({
        status: 'error',
        code: 'SUPER_ADMIN_IMMUTABLE',
        message: 'Cannot apply overrides to a Super Admin account. Super Admins always possess all permissions.',
      });
    }

    // Ordinary Developer cannot configure overrides on Developer accounts
    if (targetUser.role_slug === 'developer' && !req.user.isSuperAdmin) {
      return res.status(403).json({
        status: 'error',
        code: 'DEVELOPER_PROTECTED',
        message: 'Access denied: Only Super Admins can modify permissions for Developer accounts.',
      });
    }

    for (const item of overrides) {
      const { code, isGranted } = item;
      if (!code) continue;

      if (isGranted === null || isGranted === undefined) {
        // Clear override (revert to role default)
        await query('DELETE FROM user_permission_overrides WHERE user_id = $1 AND permission_code = $2', [id, code]);
      } else {
        // Upsert override
        await query(`
          INSERT INTO user_permission_overrides (user_id, permission_code, is_granted, granted_by, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (user_id, permission_code) DO UPDATE SET
            is_granted = EXCLUDED.is_granted,
            granted_by = EXCLUDED.granted_by,
            updated_at = NOW()
        `, [id, code, Boolean(isGranted), req.user.id]);
      }
    }

    // Audit Log (Preserves historical username even if admin account is later modified or removed)
    await query(`
      INSERT INTO permission_audit_logs (id, admin_user_id, admin_username, target_user_id, action, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `audit_${Date.now()}`,
      req.user.id,
      req.user.username,
      id,
      'OVERRIDES_MODIFIED',
      JSON.stringify({
        targetUsername: targetUser.username,
        modifiedBy: req.user.username,
        overrides,
      }),
    ]);

    return res.json({
      status: 'ok',
      message: `Permission overrides updated successfully for ${targetUser.username}.`,
    });
  } catch (err) {
    console.error('[SET_OVERRIDES_ERROR]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to update permission overrides.' });
  }
}

/**
 * GET /api/admin/audit-logs
 * Retrieve administrative audit logs.
 */
export async function getAuditLogs(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 200);
    const result = await query(`
      SELECT 
        l.id,
        l.admin_user_id,
        COALESCE(u_admin.username, l.admin_username, 'system') AS admin_username,
        COALESCE(u_admin.name, l.admin_username, 'System') AS admin_name,
        l.target_user_id,
        u_target.username AS target_username,
        u_target.name AS target_name,
        l.action,
        l.details,
        l.created_at
      FROM permission_audit_logs l
      LEFT JOIN app_users u_admin ON l.admin_user_id = u_admin.id
      LEFT JOIN app_users u_target ON l.target_user_id = u_target.id
      ORDER BY l.created_at DESC
      LIMIT $1
    `, [limit]);

    return res.json({
      status: 'ok',
      logs: result.rows || [],
    });
  } catch (err) {
    console.error('[GET_AUDIT_LOGS_ERROR]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve audit logs.' });
  }
}

export default {
  getStaffList,
  provisionStaff,
  updateStaff,
  getStaffEffectivePermissions,
  setStaffOverrides,
  getAuditLogs,
};
