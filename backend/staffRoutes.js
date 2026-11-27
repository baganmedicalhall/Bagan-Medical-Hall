/**
 * backend/staffRoutes.js - Express Router for Staff Management & Dynamic RBAC
 * Bagan Medical Hall Pharmacy POS & Accounting
 */

import { Router } from 'express';
import {
  getStaffList,
  provisionStaff,
  updateStaff,
  getStaffEffectivePermissions,
  setStaffOverrides,
  getAuditLogs,
} from './staffController.js';
import {
  requireAuth,
  requirePermission,
  validateCsrf,
  protectSuperAdmin,
} from './authMiddleware.js';

const router = Router();

// 1. Staff Account Management Endpoints
// Mount paths support both direct router mounting and prefixed /api/admin mounting
router.get(['/staff', '/api/admin/staff'], requireAuth, requirePermission('staffManage'), getStaffList);
router.post(['/staff/provision', '/api/admin/staff/provision'], requireAuth, validateCsrf, requirePermission('staffManage'), provisionStaff);
router.put(['/staff/:id', '/api/admin/staff/:id'], requireAuth, validateCsrf, requirePermission('staffManage'), protectSuperAdmin('id'), updateStaff);

// 2. Granular Dynamic Permission & Overrides Endpoints
router.get(['/staff/:id/effective-permissions', '/api/admin/staff/:id/effective-permissions'], requireAuth, requirePermission('staffManage'), getStaffEffectivePermissions);
router.post(['/staff/:id/overrides', '/api/admin/staff/:id/overrides'], requireAuth, validateCsrf, requirePermission('staffManage'), protectSuperAdmin('id'), setStaffOverrides);

// 3. Administrative Audit Logs Endpoint
router.get(['/audit-logs', '/api/admin/audit-logs'], requireAuth, requirePermission('staffManage'), getAuditLogs);

export default router;
export { router as staffRouter };
