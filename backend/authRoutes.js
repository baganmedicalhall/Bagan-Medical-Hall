/**
 * backend/authRoutes.js - Express Router for Authentication
 * Bagan Medical Hall Pharmacy POS & Accounting
 */

import { Router } from 'express';
import {
  login,
  logout,
  getMe,
  changePassword,
} from './authController.js';
import {
  authenticateSession,
  requireAuth,
  validateCsrf,
} from './authMiddleware.js';

const router = Router();

// 1. Public authentication endpoint
router.post('/login', login);

// 2. Session revocation endpoint (Authenticates session context first, validates CSRF, then revokes)
router.post('/logout', authenticateSession, validateCsrf, logout);

// 3. Session restoration and current profile endpoint (Operational sessions only)
router.get('/me', requireAuth, getMe);

// 4. Password change endpoint (Supports both mandatory reset and voluntary password update)
router.post('/change-password', authenticateSession, validateCsrf, changePassword);

export default router;
export { router as authRouter };
