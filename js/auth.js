/**
 * Authentication, Staff Permissions & Multi-Tier UI Architecture
 * Architecture:
 *   Domain (Site)
 *     ├── Staff (Default Login -> Dispensary Operations)
 *     └── Developer (Accessed by clicking Logo)
 *           └── Developer Hub (Full Page)
 *                 ├── Staff Accounts and Permission
 *                 ├── Global UI Editing (Universal: Name, Contacts, Address, Tagline, Logo, Greeting)
 *                 ├── Page UI Editing (Login UI, POS Workflow, Thermal Receipts)
 *                 └── Database Management (Audit, Backup/Restore, Factory Reset)
 */

const AUTH_STORAGE_KEY = 'bagan_active_session_v1';
const LEGACY_AUTH_STORAGE_KEY = 'apex_rx_active_session_v1';

const Auth = {
  currentUser: null,
  activeHubSection: 'staff', // 'staff', 'global', 'page', 'database'
  loginMode: 'staff', // 'staff' or 'developer'
  serverStaffList: [],
  serverStaffLoaded: false,
  staffSubView: 'accounts', // 'accounts' or 'audit'
  auditLogsList: [],
  csrfToken: '',
  authToken: '',
  resetToken: '',

  async apiRequest(url, options = {}) {
    const opts = {
      credentials: 'same-origin',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.csrfToken ? { 'X-CSRF-Token': this.csrfToken } : {}),
        ...(this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {}),
        ...(options.headers || {}),
      },
    };
    try {
      const response = await fetch(url, opts);
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      console.warn('[AUTH_API_REQUEST_ERROR]', url, err);
      return { ok: false, status: 0, data: { message: err.message || 'Network connection failed.' } };
    }
  },

  isMockAllowed() {
    // Production strictly enforces fail-closed server-authoritative authentication.
    // Browser-local mock operations are permitted ONLY when explicitly enabled
    // on a local development origin (localhost/127.0.0.1) via window.BMH_ENABLE_LOCAL_MOCK === true
    // or localStorage flag 'bmh_enable_local_mock' === 'true'.
    if (typeof window === 'undefined') return false;
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let isExplicitlyEnabled = false;
    try {
      isExplicitlyEnabled = window.BMH_ENABLE_LOCAL_MOCK === true || 
        localStorage.getItem('bmh_enable_local_mock') === 'true';
    } catch (_) {}
    return Boolean(isLocalHost && isExplicitlyEnabled);
  },

  async loadServerStaff() {
    this.serverStaffLoading = true;
    try {
      const res = await this.apiRequest('/api/admin/staff');
      if (res.ok && res.data && Array.isArray(res.data.staff)) {
        this.serverStaffList = res.data.staff;
        this.serverStaffLoaded = true;
        this.serverStaffError = null;
      } else {
        this.serverStaffLoaded = false;
        this.serverStaffError = res.data?.message || 'Database connection error: Could not verify staff records.';
        if (!this.isMockAllowed()) {
          this.serverStaffList = [];
        }
      }
    } catch (e) {
      this.serverStaffLoaded = false;
      this.serverStaffError = e.message || 'Network connection failed.';
      if (!this.isMockAllowed()) {
        this.serverStaffList = [];
      }
    } finally {
      this.serverStaffLoading = false;
    }
  },

  async loadAuditLogs() {
    try {
      const res = await this.apiRequest('/api/admin/audit-logs');
      if (res.ok && res.data && Array.isArray(res.data.logs)) {
        this.auditLogsList = res.data.logs;
      } else {
        if (!this.isMockAllowed()) {
          this.auditLogsList = [];
        }
      }
    } catch (e) {
      console.warn('[LOAD_AUDIT_LOGS_FAILED]', e);
      if (!this.isMockAllowed()) {
        this.auditLogsList = [];
      }
    }
  },

  async init() {
    // Purge any stale legacy session keys from previous sessions
    try {
      localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      sessionStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      localStorage.removeItem('apex_rx_active_session_v1');
    } catch (_) {}

    // Verify session authoritatively with backend /api/auth/me
    let verifiedSession = false;
    try {
      const meRes = await this.apiRequest('/api/auth/me');
      if (meRes.ok && meRes.data && meRes.data.user) {
        this.currentUser = {
          ...meRes.data.user,
          permissions: meRes.data.permissions || meRes.data.user.permissions || {},
        };
        this.csrfToken = meRes.data.csrfToken || '';
        verifiedSession = true;
      } else if (meRes.status === 401 || meRes.status === 403) {
        // Session expired, revoked or account deactivated
        this.clearStoredSession();
        this.currentUser = null;
        this.showLogin();
        if (meRes.data?.message && !this.isMockAllowed()) {
          const alertEl = document.getElementById('login-error-alert');
          if (alertEl) {
            alertEl.textContent = meRes.data.message;
            alertEl.style.display = 'block';
          }
        }
        return;
      }
    } catch (e) {
      console.warn('[AUTH_ME_UNAVAILABLE]', e);
    }

    if (verifiedSession) {
      if (this.currentUser?.mustResetPassword) {
        this.showMustResetPasswordModal();
      } else {
        this.applyUserSession();
      }
      return;
    }

    // Fail-Closed: In production, unverified or failed connections reject authentication
    if (!this.isMockAllowed()) {
      this.currentUser = null;
      this.clearStoredSession();
      this.showLogin();
      return;
    }

    // Mock session fallback ONLY in explicitly enabled local development
    const saved = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const matched = (pharmacyDB.data.staffMembers || []).find(s => s.id === parsed.id && s.status === 'active');
        if (matched) {
          this.currentUser = matched;
        } else {
          this.currentUser = null;
          this.clearStoredSession();
        }
      } catch (e) {
        this.currentUser = null;
        this.clearStoredSession();
      }
    } else {
      this.currentUser = null;
    }

    if (!this.currentUser) {
      this.showLogin();
    } else {
      this.applyUserSession();
    }
  },

  clearStoredSession() {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      sessionStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      localStorage.removeItem('apex_rx_active_session_v1');
      localStorage.removeItem('bagan_active_session_v1');
      sessionStorage.clear();
    } catch (_) {}
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  isDeveloper() {
    return this.currentUser && (this.currentUser.role === 'developer' || this.currentUser.permissions?.devTools || this.currentUser.is_super_admin);
  },

  hasPermission(permKey) {
    if (!this.currentUser) return false;
    if (this.isDeveloper()) return true; // Developers and Super Admins have all permissions
    // In server-authoritative mode, check this.currentUser.permissions object
    if (this.currentUser.permissions && this.currentUser.permissions[permKey] !== undefined) {
      return Boolean(this.currentUser.permissions[permKey]);
    }
    // Fallback ONLY in explicitly enabled local development mode
    if (this.isMockAllowed()) {
      const liveUser = (pharmacyDB.data.staffMembers || []).find(s => s.id === this.currentUser.id || s.username.toLowerCase() === this.currentUser.username.toLowerCase());
      const perms = liveUser ? liveUser.permissions : this.currentUser.permissions;
      return !!(perms && perms[permKey]);
    }
    return false;
  },

  async login(usernameOrEmail, password, remember = true) {
    const cleanUser = (usernameOrEmail || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // 1. Authoritative Backend Authentication
    try {
      const res = await this.apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass,
          remember: Boolean(remember),
          requestedMode: this.loginMode,
        }),
      });

      if (res.ok && res.data) {
        // Mandatory First-Time Password Reset flow
        if (res.data.status === 'must_reset_password' || res.data.user?.mustResetPassword) {
          this.currentUser = {
            ...res.data.user,
            permissions: res.data.permissions || res.data.user?.permissions || {},
          };
          this.csrfToken = res.data.csrfToken || '';
          this.resetToken = res.data.resetToken || '';
          this.showMustResetPasswordModal();
          return { success: true, mustResetPassword: true, user: this.currentUser };
        }

        if (res.data.status === 'ok') {
          this.currentUser = {
            ...res.data.user,
            permissions: res.data.permissions || res.data.user?.permissions || {},
          };
          this.csrfToken = res.data.csrfToken || '';
          if (this.currentUser.mustResetPassword) {
            this.showMustResetPasswordModal();
            return { success: true, mustResetPassword: true, user: this.currentUser };
          }
          const sessionData = JSON.stringify({
            id: this.currentUser.id,
            username: this.currentUser.username,
            loginTime: new Date().toISOString(),
          });
          if (remember) {
            localStorage.setItem(AUTH_STORAGE_KEY, sessionData);
          } else {
            sessionStorage.setItem(AUTH_STORAGE_KEY, sessionData);
          }
          this.applyUserSession();
          return { success: true, user: this.currentUser };
        }
      }

      if (res.status > 0) {
        return { success: false, message: res.data?.message || 'Invalid credentials. Please verify username and password.' };
      }
    } catch (e) {
      console.warn('[LOGIN_BACKEND_UNAVAILABLE]', e);
    }

    // 2. Fail-Closed in Production
    if (!this.isMockAllowed()) {
      return {
        success: false,
        message: 'Authentication service unavailable. Production security requires a verified server connection. Please try again or contact your administrator.',
      };
    }

    // 3. Fallback ONLY in explicitly enabled local development environment
    const staffList = pharmacyDB.data.staffMembers || [];
    const user = staffList.find(s => {
      const matchUsername = s.username.toLowerCase() === cleanUser;
      const matchAlias = s.aliases && s.aliases.some(a => a.toLowerCase() === cleanUser);
      const matchEmail = s.email && s.email.toLowerCase() === cleanUser;
      return (matchUsername || matchAlias || matchEmail) && s.password === cleanPass;
    });

    if (!user) {
      return { success: false, message: 'Invalid credentials. Please verify username and password.' };
    }

    if (user.status !== 'active') {
      return { success: false, message: 'This staff account has been deactivated. Please contact the administrator.' };
    }

    // Mode check for mock developer login
    if (this.loginMode === 'developer' && user.role !== 'developer' && !user.permissions?.devTools) {
      return { success: false, message: 'Access denied: This account is not authorized for Developer Portal login.' };
    }

    this.currentUser = user;
    if (user.mustResetPassword) {
      this.showMustResetPasswordModal();
      return { success: true, mustResetPassword: true, user };
    }

    const sessionData = JSON.stringify({ id: user.id, username: user.username, loginTime: new Date().toISOString() });
    if (remember) {
      localStorage.setItem(AUTH_STORAGE_KEY, sessionData);
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, sessionData);
    }

    this.applyUserSession();
    return { success: true, user };
  },

  async logout() {
    try {
      await this.apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    this.currentUser = null;
    this.csrfToken = '';
    this.authToken = '';
    this.resetToken = '';
    this.clearStoredSession();
    this.loginMode = 'staff';

    const resetModal = document.getElementById('must-reset-password-modal');
    if (resetModal) resetModal.remove();

    if (typeof App !== 'undefined') {
      App.currentView = 'pos';
    }

    const appEl = document.getElementById('app-container');
    if (appEl) appEl.style.display = 'none';

    this.showLogin();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Logged out successfully. Access has been reset.', 'info');
    }
  },

  showLogin() {
    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('app-container');
    if (loginEl) loginEl.style.display = 'flex';
    if (appEl) appEl.style.display = 'none';

    this.renderLoginForm(this.loginMode);
    if (typeof App !== 'undefined' && App.refreshBrandLogos) {
      App.refreshBrandLogos();
    }
  },

  applyUserSession() {
    if (this.currentUser?.mustResetPassword) {
      this.showMustResetPasswordModal();
      return;
    }

    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('app-container');
    if (loginEl) loginEl.style.display = 'none';
    if (appEl) appEl.style.display = 'flex';

    const global = pharmacyDB.data.globalSettings || {};

    // Apply universal brand name & logo
    const brandTitle = document.querySelector('.brand-text h1');
    if (brandTitle && global.name) {
      brandTitle.textContent = global.name;
    }
    const brandLogo = document.getElementById('sidebar-brand-icon') || document.querySelector('.brand-header .brand-icon');
    if (brandLogo) {
      brandLogo.style.background = 'transparent';
      brandLogo.style.boxShadow = 'none';
      brandLogo.style.border = 'none';
      brandLogo.innerHTML = App.renderLogoHtml('dark', 'width: 100%; height: 100%; object-fit: contain; border: none; box-shadow: none;');
    }
    const brandTagline = document.querySelector('.brand-text p');
    if (brandTagline && global.tagline) {
      brandTagline.textContent = global.tagline;
    }

    // Apply primary & secondary colors dynamically
    App.applyThemeColors(global.primaryColor || '#0284c7', global.secondaryColor || '#0f766e');

    // Update Header with User Profile Badge
    const userBadgeEl = document.getElementById('topbar-user-profile');
    if (userBadgeEl && this.currentUser) {
      const isDev = this.isDeveloper();
      const roleBadgeBg = isDev ? '#8b5cf6' : '#059669';

      userBadgeEl.innerHTML = `
        <div class="user-profile-badge">
          <span class="user-avatar">${this.currentUser.avatar || (isDev ? '💻' : '🧑‍⚕️')}</span>
          <div class="user-info-text">
            <div class="user-name">${this.currentUser.name}</div>
            <div class="user-role-pill" style="background: ${roleBadgeBg}20; color: ${roleBadgeBg};">
              ${isDev ? 'DEVELOPER / ADMIN' : (this.currentUser.roleTitle || this.currentUser.role).toUpperCase()}
            </div>
          </div>
          ${isDev ? `
            <button class="btn btn-primary btn-sm" id="btn-open-dev-hub" title="Open Full-Page Developer Hub" style="padding: 0.35rem 0.75rem; font-size: 0.76rem; background: #7c3aed; border-color: #6d28d9;">
              ⚙️ Developer Hub
            </button>
          ` : ''}
          <button class="btn btn-outline btn-sm btn-logout" id="btn-topbar-logout" title="Sign Out">
            ${getIcon('close')} Logout
          </button>
        </div>
      `;

      const logoutBtn = document.getElementById('btn-topbar-logout');
      if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

      const devHubBtn = document.getElementById('btn-open-dev-hub');
      if (devHubBtn) devHubBtn.addEventListener('click', () => App.navigate('dev-hub'));
    }

    // Show/hide Developer Hub sidebar item
    const devSidebarItem = document.getElementById('nav-item-dev-hub');
    if (devSidebarItem) {
      devSidebarItem.style.display = this.isDeveloper() ? 'block' : 'none';
    }

    // Role-based visibility for sidebar navigation items based on permissions
    this.enforceSidebarPermissions();

    // Default landing view
    const initialView = App.currentView && App.currentView !== 'dev-hub' ? App.currentView : (pharmacyDB.data.staffUiSettings?.defaultView || 'pos');
    App.navigate(initialView);
  },

  enforceSidebarPermissions() {
    const isDev = this.isDeveloper();

    // Remove Settings & Backup access for Staff Login
    const topSettingsBtn = document.getElementById('btn-top-settings');
    if (topSettingsBtn) {
      topSettingsBtn.style.display = isDev ? 'inline-flex' : 'none';
    }
    const topBackupBtn = document.getElementById('btn-top-backup');
    if (topBackupBtn) {
      topBackupBtn.style.display = isDev ? 'inline-flex' : 'none';
    }

    const medNav = document.querySelector('.nav-item[data-view="medication-treatment"]');
    if (medNav) {
      medNav.parentElement.style.display = (isDev || this.hasPermission('medicationTreatment')) ? 'block' : 'none';
    }

    const dailyNav = document.querySelector('.nav-item[data-view="daily-records"]');
    if (dailyNav) {
      dailyNav.parentElement.style.display = (isDev || this.hasPermission('dailyRecords')) ? 'block' : 'none';
    }

    const expNav = document.querySelector('.nav-item[data-view="expenses"]');
    if (expNav) {
      expNav.parentElement.style.display = (isDev || this.hasPermission('expenses')) ? 'block' : 'none';
    }

    const accNav = document.querySelector('.nav-item[data-view="accounting"]');
    if (accNav) {
      accNav.parentElement.style.display = (isDev || this.hasPermission('financialReports') || this.hasPermission('journalEntries')) ? 'block' : 'none';
    }

    const custSuppNav = document.querySelector('.nav-item[data-view="accounts"]');
    if (custSuppNav) {
      custSuppNav.parentElement.style.display = (isDev || this.hasPermission('patientLedger') || this.hasPermission('supplierLedger')) ? 'block' : 'none';
    }

    const invNav = document.querySelector('.nav-item[data-view="inventory"]');
    if (invNav) {
      invNav.parentElement.style.display = (isDev || this.hasPermission('inventory')) ? 'block' : 'none';
    }

    const posNav = document.querySelector('.nav-item[data-view="pos"]');
    if (posNav) {
      posNav.parentElement.style.display = (isDev || this.hasPermission('pos')) ? 'block' : 'none';
    }
  },

  /* -------------------------------------------------------------
   * MANDATORY FIRST-TIME PASSWORD RESET MODAL
   * Required when user.must_reset_password = TRUE
   * Inescapable: blocks dispensary access until updated.
   * ------------------------------------------------------------- */
  showMustResetPasswordModal() {
    // Remove any existing reset modal to prevent duplicates
    const existing = document.getElementById('must-reset-password-modal');
    if (existing) existing.remove();

    const isDev = this.isDeveloper();
    const accentColor = isDev ? '#7c3aed' : '#0284c7';
    const userRoleText = isDev ? 'Developer / Super Admin' : (this.currentUser?.roleTitle || this.currentUser?.role || 'Staff Member');
    const userNameText = this.currentUser?.name || this.currentUser?.username || 'User';

    const modalHtml = `
      <div class="modal-overlay unescapable-modal" id="must-reset-password-modal" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px);">
        <div class="modal-card" style="background: white; border-radius: 12px; max-width: 460px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); overflow: hidden; border-top: 5px solid ${accentColor}; animation: modalFadeIn 0.2s ease-out;">
          
          <!-- Header -->
          <div style="padding: 1.5rem 1.5rem 1rem 1.5rem; text-align: center;">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: ${isDev ? '#f5f3ff' : '#eff6ff'}; display: inline-flex; align-items: center; justify-content: center; font-size: 1.75rem; margin-bottom: 0.75rem; border: 2px solid ${isDev ? '#ddd6fe' : '#bfdbfe'};">
              🔒
            </div>
            <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 0.35rem 0;">
              Password Reset Required
            </h2>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.4;">
              Welcome, <strong>${userNameText}</strong> (${userRoleText}).<br>
              A private password must be configured before accessing dispensary operations.
            </p>
          </div>

          <!-- Alert box -->
          <div id="reset-password-alert" style="display: none; margin: 0 1.5rem 1rem 1.5rem; padding: 0.65rem 0.85rem; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 8px; color: #dc2626; font-size: 0.82rem;"></div>

          <!-- Form -->
          <form id="form-must-reset-password" autocomplete="off" style="padding: 0 1.5rem 1.5rem 1.5rem;">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="display: block; font-size: 0.82rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem;">
                Current / Temporary Password
              </label>
              <div class="login-input-wrap" style="position: relative;">
                <span class="login-input-icon" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 0.9rem;">🔑</span>
                <input type="password" id="reset-current-password" class="form-control" placeholder="Enter current/temporary password" required style="padding-left: 2.5rem; width: 100%; height: 42px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem;">
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="display: block; font-size: 0.82rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem;">
                New Password <span style="font-weight: 400; color: #64748b;">(at least 8 characters)</span>
              </label>
              <div class="login-input-wrap" style="position: relative;">
                <span class="login-input-icon" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 0.9rem;">🔒</span>
                <input type="password" id="reset-new-password" class="form-control" placeholder="Enter new password (min. 8 characters)" minlength="8" required style="padding-left: 2.5rem; width: 100%; height: 42px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem;">
                <button type="button" id="btn-toggle-reset-new" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 0.85rem;">👁️</button>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="display: block; font-size: 0.82rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem;">
                Confirm New Password
              </label>
              <div class="login-input-wrap" style="position: relative;">
                <span class="login-input-icon" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 0.9rem;">✓</span>
                <input type="password" id="reset-confirm-password" class="form-control" placeholder="Confirm new password" minlength="8" required style="padding-left: 2.5rem; width: 100%; height: 42px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem;">
              </div>
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <button type="button" id="btn-cancel-reset-password" class="btn btn-outline" style="flex: 1; height: 42px; font-size: 0.88rem; justify-content: center;">
                Cancel & Sign Out
              </button>
              <button type="submit" id="btn-submit-reset-password" class="btn btn-primary" style="flex: 1.5; height: 42px; font-size: 0.88rem; justify-content: center; background: ${accentColor}; border-color: ${accentColor};">
                Update & Proceed →
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Toggle password view
    const toggleBtn = document.getElementById('btn-toggle-reset-new');
    const newPassInput = document.getElementById('reset-new-password');
    if (toggleBtn && newPassInput) {
      toggleBtn.addEventListener('click', () => {
        if (newPassInput.type === 'password') {
          newPassInput.type = 'text';
          toggleBtn.textContent = '🔒';
        } else {
          newPassInput.type = 'password';
          toggleBtn.textContent = '👁️';
        }
      });
    }

    // Cancel -> Logout
    const cancelBtn = document.getElementById('btn-cancel-reset-password');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.logout());
    }

    // Form submit
    const form = document.getElementById('form-must-reset-password');
    const alertEl = document.getElementById('reset-password-alert');
    const submitBtn = document.getElementById('btn-submit-reset-password');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('reset-current-password').value.trim();
        const newPass = document.getElementById('reset-new-password').value.trim();
        const confirmPass = document.getElementById('reset-confirm-password').value.trim();

        if (newPass.length < 8) {
          alertEl.textContent = 'New password must be at least 8 characters long.';
          alertEl.style.display = 'block';
          return;
        }

        if (newPass !== confirmPass) {
          alertEl.textContent = 'New password and confirmation do not match.';
          alertEl.style.display = 'block';
          return;
        }

        if (newPass === currentPass) {
          alertEl.textContent = 'New password must be different from current password.';
          alertEl.style.display = 'block';
          return;
        }

        alertEl.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        try {
          const bodyPayload = {
            oldPassword: currentPass,
            newPassword: newPass,
          };
          if (this.resetToken) {
            bodyPayload.resetToken = this.resetToken;
          }

          const res = await this.apiRequest('/api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify(bodyPayload),
          });

          if (res.ok && res.data && res.data.status === 'ok') {
            const usernameToLogin = this.currentUser?.username;
            const modal = document.getElementById('must-reset-password-modal');
            if (modal) modal.remove();
            this.resetToken = '';

            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('Password updated successfully! Logging you in...', 'success');
            }

            // Auto-login with new password to obtain full active session
            if (usernameToLogin) {
              const loginRes = await this.login(usernameToLogin, newPass, true);
              if (loginRes.success && !loginRes.mustResetPassword) {
                return;
              }
            }

            // Fallback: Prompt login
            this.showLogin();
            return;
          }

          if (res.status > 0) {
            alertEl.textContent = res.data?.message || 'Failed to update password. Please check your current password.';
            alertEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update & Proceed →';
            return;
          }
        } catch (err) {
          console.warn('[CHANGE_PASSWORD_ERROR]', err);
        }

        // Mock fallback if explicitly allowed in local environment
        if (this.isMockAllowed()) {
          const staffList = pharmacyDB.data.staffMembers || [];
          const user = staffList.find(s => s.id === this.currentUser?.id || s.username === this.currentUser?.username);
          if (user) {
            user.password = newPass;
            user.mustResetPassword = false;
            if (pharmacyDB.save) pharmacyDB.save();
          }
          if (this.currentUser) {
            this.currentUser.mustResetPassword = false;
          }
          const modal = document.getElementById('must-reset-password-modal');
          if (modal) modal.remove();
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('Password updated successfully! (Development Mode)', 'success');
          }
          this.applyUserSession();
          return;
        }

        // Production fail-closed
        alertEl.textContent = 'Authentication service is unavailable. Please try again or contact your administrator.';
        alertEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update & Proceed →';
      });
    }
  },

  /* -------------------------------------------------------------
   * LOGIN SCREEN (Clicking Logo Opens Developer Login)
   * Only 2 options: Staff (Default) & Developer (Via Logo click)
   * ------------------------------------------------------------- */
  renderLoginForm(mode = 'staff') {
    this.loginMode = mode;
    const container = document.getElementById('login-screen');
    if (!container) return;

    const global = pharmacyDB.data.globalSettings || {
      name: 'Bagan Medical Hall',
      tagline: 'Your Trusted Pharmacy & Clinical Dispensary',
      logo: 'BMH',
      greetingMessage: 'Welcome to Bagan Medical Hall. Please verify temperature logs and prescriptions carefully.'
    };
    const pageSettings = pharmacyDB.data.loginPageSettings || {
      accentColor: '#0284c7',
      showTestCredentials: true
    };

    const staffList = pharmacyDB.data.staffMembers || [];
    const devAcc = staffList.find(s => s.role === 'developer') || { username: 'developer', password: 'dev123' };
    const staffAcc = staffList.find(s => s.role === 'pharmacist') || { username: 'pharmacist', password: 'user123' };

    const isDevLogin = mode === 'developer';
    const primaryCol = global.primaryColor || pageSettings.primaryColor || '#0284c7';
    const secondaryCol = global.secondaryColor || pageSettings.secondaryColor || '#0f766e';
    const accentColor = isDevLogin ? '#7c3aed' : primaryCol;
    const accentGrad = isDevLogin ? 'linear-gradient(135deg, #7c3aed, #4c1d95)' : `linear-gradient(135deg, ${primaryCol}, ${secondaryCol})`;

    const logoContent = App.renderLogoHtml('light', 'width: 100%; height: 100%; object-fit: contain; border: none; box-shadow: none;');

    container.innerHTML = `
      <div class="login-box" style="border-top: 5px solid ${accentColor};">
        <!-- Interactive Clickable Logo Header -->
        <div class="login-brand-header">
          <div class="brand-icon clickable-logo ${isDevLogin ? 'dev-logo-active' : ''}" id="login-clickable-logo" title="🔒 Click Logo to open Developer Login" style="background: transparent; width: 72px; height: 72px; margin: 0 auto 0.75rem auto; cursor: pointer; padding: 0; box-shadow: none; border: none; display: flex; align-items: center; justify-content: center;">
            ${logoContent}
          </div>
          <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 2px;">
            ${isDevLogin ? '🛠️ DEVELOPER AUTHENTICATION' : '⚡ Tip: Click logo above for Developer Portal'}
          </div>
          <h1 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">
            ${global.name || 'Bagan Medical Hall'}
          </h1>
          <p style="font-size: 0.85rem; color: #64748b;">
            ${global.tagline || 'Clinical POS, Inventory & Full Accounting ERP'}
          </p>
          ${global.greetingMessage ? `
            <div style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 0.78rem; color: #1d4ed8; text-align: center;">
              📢 ${global.greetingMessage}
            </div>
          ` : ''}
        </div>

        <!-- Mode Indicator Badge -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0.4rem 0.75rem; background: ${isDevLogin ? '#f5f3ff' : '#f0fdf4'}; border: 1px solid ${isDevLogin ? '#ddd6fe' : '#bbf7d0'}; border-radius: 8px;">
          <span style="font-size: 0.8rem; font-weight: 700; color: ${isDevLogin ? '#7c3aed' : '#15803d'};">
            ${isDevLogin ? '💻 Developer / Super Admin Login' : '🧑‍⚕️ Dispensary Staff Login'}
          </span>
          ${isDevLogin ? `
            <button type="button" class="btn btn-outline btn-sm" id="btn-back-to-staff" style="font-size: 0.72rem; padding: 2px 8px;">
              ← Back to Staff
            </button>
          ` : `
            <button type="button" class="btn btn-outline btn-sm" id="btn-switch-to-dev" style="font-size: 0.72rem; padding: 2px 8px; color: #7c3aed; border-color: #c4b5fd;">
              Dev Login
            </button>
          `}
        </div>

        <!-- Error Alert -->
        <div id="login-error-alert" style="display: none; padding: 0.65rem 0.85rem; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 8px; color: #dc2626; font-size: 0.82rem; margin-bottom: 1rem;"></div>

        <!-- Form -->
        <form id="pharmacy-login-form" autocomplete="off">
          <div class="form-group">
            <label class="form-label">${isDevLogin ? 'Developer Username or Email' : 'Staff Username or Email'}</label>
            <div class="login-input-wrap">
              <span class="login-input-icon">${getIcon('customers')}</span>
              <input type="text" id="login-username" class="form-control login-input" placeholder="Enter username or email..." value="" autocomplete="off" required autofocus>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Password</label>
            <div class="login-input-wrap">
              <span class="login-input-icon">🔒</span>
              <input type="password" id="login-password" class="form-control login-input" placeholder="Enter password..." value="" autocomplete="new-password" required>
              <button type="button" id="btn-toggle-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 0.85rem;">👁️</button>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #475569; cursor: pointer;">
              <input type="checkbox" id="login-remember"> Keep me signed in on this device
            </label>
            <span style="font-size: 0.74rem; color: ${accentColor}; font-weight: 600;">Secure Portal</span>
          </div>

          <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; font-size: 1rem; padding: 0.85rem; justify-content: center; background: ${accentColor}; border-color: ${accentColor}; box-shadow: 0 4px 14px ${isDevLogin ? 'rgba(124, 58, 237, 0.4)' : 'rgba(2, 132, 199, 0.35)'};">
            ${isDevLogin ? 'Sign In as Developer →' : 'Sign In as Staff →'}
          </button>
        </form>

        <!-- Test Credentials Box (Allowed ONLY in explicitly enabled local development environment) -->
        ${(pageSettings.showTestCredentials && this.isMockAllowed()) ? `
          <div class="test-creds-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #64748b;">
                ⚡ Test Accounts (1-Click Fill)
              </span>
              <span style="font-size: 0.68rem; color: #94a3b8;">Editable in Dev Hub</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem;">
              <!-- Staff Card -->
              <div class="test-cred-card ${!isDevLogin ? 'active-cred' : ''}" id="quick-fill-staff-card">
                <div style="font-weight: 700; color: #059669; font-size: 0.8rem;">🧑‍⚕️ Staff</div>
                <div style="font-size: 0.72rem; color: #475569; margin-top: 2px;">user: <code>pharmacist</code></div>
                <div style="font-size: 0.72rem; color: #475569;">pass: <code>user123</code></div>
                <button type="button" class="btn btn-sm btn-outline quick-login-btn" data-role="staff" style="width: 100%; margin-top: 4px; padding: 2px 4px; font-size: 0.7rem; color: #059669; border-color: #10b981;">
                  ⚡ Quick Fill
                </button>
              </div>

              <!-- Developer Card -->
              <div class="test-cred-card ${isDevLogin ? 'active-cred' : ''}" id="quick-fill-dev-card">
                <div style="font-weight: 700; color: #7c3aed; font-size: 0.8rem;">💻 Developer</div>
                <div style="font-size: 0.72rem; color: #475569; margin-top: 2px;">user: <code>developer</code></div>
                <div style="font-size: 0.72rem; color: #475569;">pass: <code>dev123</code></div>
                <button type="button" class="btn btn-sm btn-outline quick-login-btn" data-role="developer" style="width: 100%; margin-top: 4px; padding: 2px 4px; font-size: 0.7rem; color: #7c3aed; border-color: #8b5cf6;">
                  ⚡ Quick Fill
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Click Logo to Open Developer Login!
    const logoEl = document.getElementById('login-clickable-logo');
    if (logoEl) {
      logoEl.addEventListener('click', () => {
        const nextMode = this.loginMode === 'developer' ? 'staff' : 'developer';
        App.showToast(nextMode === 'developer' ? 'Developer Portal Activated!' : 'Switched to Staff Portal', 'info');
        this.renderLoginForm(nextMode);
      });
    }

    // Switch buttons
    const switchDevBtn = document.getElementById('btn-switch-to-dev');
    if (switchDevBtn) {
      switchDevBtn.addEventListener('click', () => this.renderLoginForm('developer'));
    }
    const backStaffBtn = document.getElementById('btn-back-to-staff');
    if (backStaffBtn) {
      backStaffBtn.addEventListener('click', () => this.renderLoginForm('staff'));
    }

    // Quick fill buttons (only fills upon explicit click)
    container.querySelectorAll('.quick-login-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const role = btn.getAttribute('data-role');
        const uInput = document.getElementById('login-username');
        const pInput = document.getElementById('login-password');
        if (role === 'developer') {
          if (this.loginMode !== 'developer') {
            this.renderLoginForm('developer');
          }
          const u = document.getElementById('login-username');
          const p = document.getElementById('login-password');
          if (u && p) {
            u.value = devAcc.username;
            p.value = devAcc.password;
          }
        } else {
          if (this.loginMode !== 'staff') {
            this.renderLoginForm('staff');
          }
          const u = document.getElementById('login-username');
          const p = document.getElementById('login-password');
          if (u && p) {
            u.value = staffAcc.username;
            p.value = staffAcc.password;
          }
        }
      });
    });

    // Password visibility toggle
    const togglePassBtn = document.getElementById('btn-toggle-password');
    const passInput = document.getElementById('login-password');
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener('click', () => {
        if (passInput.type === 'password') {
          passInput.type = 'text';
          togglePassBtn.textContent = '🔒';
        } else {
          passInput.type = 'password';
          togglePassBtn.textContent = '👁️';
        }
      });
    }

    // Submit
    const form = document.getElementById('pharmacy-login-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('login-remember').checked;

        const res = await this.login(username, password, remember);
        if (res.success) {
          if (res.mustResetPassword) {
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('First-time login: Password reset is required.', 'info');
            }
          } else {
            App.showToast(`Welcome back, ${res.user.name}!`, 'success');
          }
        } else {
          const alertEl = document.getElementById('login-error-alert');
          alertEl.textContent = res.message;
          alertEl.style.display = 'block';
        }
      });
    }
  },

  /* -------------------------------------------------------------
   * DEVELOPER HUB (Full Page View matching Architecture Diagram)
   * Domain > Developer > Developer Hub
   *   ├── Staff Accounts and Permission
   *   ├── Global UI Editing (Universal: Name, Contacts, Address, Tagline, Logo, Greeting)
   *   ├── Page UI Editing (Login UI, POS workflow, Receipt footer)
   *   └── Database Management (Inspection, Audit, Backup/Restore, Factory Reset)
   * ------------------------------------------------------------- */
  renderDeveloperHub(activeSection = 'staff') {
    this.activeHubSection = activeSection;
    if (!this.serverStaffLoaded) {
      this.loadServerStaff().then(() => {
        if (this.activeHubSection === 'staff') {
          const bodyEl = document.getElementById('dev-hub-section-body');
          if (bodyEl) {
            bodyEl.innerHTML = this.renderSectionContent('staff');
            this.bindHubSectionEvents();
          }
        }
      });
    }
    const container = document.getElementById('view-container');
    if (!container) return;

    const global = pharmacyDB.data.globalSettings || {};

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Full Page Header with Architecture Breadcrumbs -->
        <div class="app-card" style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 1.5rem; margin-bottom: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #a5b4fc; font-weight: 700; margin-bottom: 4px;">
                Domain &gt; Developer &gt; <span style="color: #38bdf8;">Developer Hub</span>
              </div>
              <h1 style="font-size: 1.45rem; font-weight: 800; margin: 0; color: white;">
                Developer Control Hub
              </h1>
              <p style="font-size: 0.82rem; color: #c7d2fe; margin-top: 2px;">
                Universal pharmacy governance, staff permissions, and UI architecture control.
              </p>
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 0.74rem; background: #4c1d95; color: #e9d5ff; padding: 0.35rem 0.75rem; border-radius: 20px; font-weight: 600; border: 1px solid #6d28d9;">
                ● Super Admin Session Active
              </span>
              <button class="btn btn-outline" style="border-color: #6366f1; color: white;" onclick="App.navigate('pos')">
                ← Return to Dispensary POS
              </button>
            </div>
          </div>
        </div>

        <!-- 7-Card Architecture Navigation Bar -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem;">
          <!-- Card 1: Staff Accounts & Permission -->
          <div class="dev-hub-tile ${activeSection === 'staff' ? 'active-tile' : ''}" data-hub-section="staff">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 1.4rem;">👥</span>
              <span style="font-size: 0.7rem; font-weight: 700; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px;">ACCESS</span>
            </div>
            <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; margin-top: 0.5rem;">Staff & Permissions</div>
            <div style="font-size: 0.73rem; color: #64748b; margin-top: 2px;">Create staff, assign roles & granular checkboxes</div>
          </div>

          <!-- Card 2: Global UI Editing (Universal) -->
          <div class="dev-hub-tile ${activeSection === 'global' ? 'active-tile' : ''}" data-hub-section="global">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 1.4rem;">🌐</span>
              <span style="font-size: 0.7rem; font-weight: 700; background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px;">UNIVERSAL</span>
            </div>
            <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; margin-top: 0.5rem;">Global UI Editing</div>
            <div style="font-size: 0.73rem; color: #64748b; margin-top: 2px;">Coloured & White logos, hex colors, universal brand</div>
          </div>

          <!-- Card 3: Page UI Editing (Separate) -->
          <div class="dev-hub-tile ${activeSection === 'page' ? 'active-tile' : ''}" data-hub-section="page">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 1.4rem;">🎨</span>
              <span style="font-size: 0.7rem; font-weight: 700; background: #fce7f3; color: #be185d; padding: 2px 6px; border-radius: 4px;">VIEWS</span>
            </div>
            <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; margin-top: 0.5rem;">Page UI Editing</div>
            <div style="font-size: 0.73rem; color: #64748b; margin-top: 2px;">Login page, POS counter rules, receipt footer & styling</div>
          </div>

          <!-- Card 4: Master Catalogs & Parameters (NEW) -->
          <div class="dev-hub-tile ${activeSection === 'catalog' ? 'active-tile' : ''}" data-hub-section="catalog">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 1.4rem;">🏷️</span>
              <span style="font-size: 0.7rem; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">CATALOG</span>
            </div>
            <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; margin-top: 0.5rem;">Master Catalogs</div>
            <div style="font-size: 0.73rem; color: #64748b; margin-top: 2px;">Categories, dosages, procedures, routes & statuses</div>
          </div>

          <!-- Card 5: Tax System Setup (NEW) -->
          <div class="dev-hub-tile ${activeSection === 'tax' ? 'active-tile' : ''}" data-hub-section="tax">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 1.4rem;">⚖️</span>
              <span style="font-size: 0.7rem; font-weight: 700; background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px;">TAXATION</span>
            </div>
            <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; margin-top: 0.5rem;">Tax System Setup</div>
            <div style="font-size: 0.73rem; color: #64748b; margin-top: 2px;">Universal VAT/GST rates, engine rules & tax slabs</div>
          </div>

          <!-- Card 6: Media Center -->
          <div class="dev-hub-tile ${activeSection === 'media' ? 'active-tile' : ''}" data-hub-section="media">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 1.4rem;">📸</span>
              <span style="font-size: 0.7rem; font-weight: 700; background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px;">GALLERY</span>
            </div>
            <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; margin-top: 0.5rem;">Media Center</div>
            <div style="font-size: 0.73rem; color: #64748b; margin-top: 2px;">Browse and manage images in the server media library</div>
          </div>

          <!-- Card 7: Database Management -->
          <div class="dev-hub-tile ${activeSection === 'database' ? 'active-tile' : ''}" data-hub-section="database">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 1.4rem;">🗄️</span>
              <span style="font-size: 0.7rem; font-weight: 700; background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 4px;">STORAGE</span>
            </div>
            <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; margin-top: 0.5rem;">Database Management</div>
            <div style="font-size: 0.73rem; color: #64748b; margin-top: 2px;">Live raw JSON, audit checks, backup & factory reset</div>
          </div>
        </div>

        <!-- Section Content Container -->
        <div id="dev-hub-section-body">
          ${this.renderSectionContent(activeSection)}
        </div>
      </div>
    `;

    this.bindHubSectionEvents();
  },

  renderSectionContent(section) {
    switch (section) {
      case 'staff': return this.renderStaffSection();
      case 'global': return this.renderGlobalUiSection();
      case 'page': return this.renderPageUiSection();
      case 'catalog': return this.renderMasterCatalogsSection();
      case 'tax': return this.renderTaxSystemSection();
      case 'media': return this.renderMediaCenterSection();
      case 'database': return this.renderDatabaseSection();
      default: return this.renderStaffSection();
    }
  },

  /* -------------------------------------------------------------
   * SECTION 1: Staff Accounts and Permission
   * ------------------------------------------------------------- */
  renderStaffSection() {
    if (this.staffSubView === 'audit') {
      return this.renderAuditLogsSection();
    }

    // Fail-Closed in production if authoritative server staff has not loaded
    if (!this.serverStaffLoaded && !this.isMockAllowed()) {
      return `
        <div class="app-card" style="border-left: 4px solid #ef4444; background: #fffaf0;">
          <div style="display: flex; align-items: flex-start; gap: 1rem;">
            <span style="font-size: 2.2rem;">🔒</span>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 style="margin: 0; color: #991b1b; font-size: 1.15rem; font-weight: 700;">Authoritative Database Connection Required</h3>
                <span style="font-size: 0.7rem; font-weight: 800; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 9999px;">
                  FAIL-CLOSED SECURITY ACTIVE
                </span>
              </div>
              <p style="margin: 6px 0 0.75rem 0; color: #7f1d1d; font-size: 0.85rem; line-height: 1.4;">
                ${this.serverStaffError || 'The Developer Hub cannot establish a verified connection to the PostgreSQL database.'}
              </p>
              <p style="margin: 0 0 1rem 0; color: #4b5563; font-size: 0.8rem;">
                Production security strictly prohibits falling back to unverified browser storage for staff accounts, role assignments, or dynamic permission overrides.
              </p>
              <button class="btn btn-primary" id="btn-refresh-server-staff" style="font-size: 0.85rem;">
                🔄 Retry Database Connection
              </button>
            </div>
          </div>
        </div>
      `;
    }

    const serverStaff = this.serverStaffList || [];
    const localStaff = pharmacyDB.data.staffMembers || [];

    // In production, display list is strictly server-authoritative
    const displayList = this.serverStaffLoaded ? serverStaff : (this.isMockAllowed() ? localStaff : []);
    const serverUsernames = new Set(serverStaff.map(s => (s.username || '').toLowerCase()));
    const migrationCandidates = this.serverStaffLoaded ? localStaff.filter(s => !serverUsernames.has((s.username || '').toLowerCase())) : [];

    return `
      <div class="app-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0;">Dispensary Staff Accounts & Dynamic Governance</h2>
              <span style="font-size: 0.7rem; font-weight: 700; background: #ecfdf5; color: #059669; padding: 2px 8px; border-radius: 9999px;">
                ● PostgreSQL RBAC
              </span>
            </div>
            <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Server-authoritative credentials, role definitions, and dynamic permission overrides.</p>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-outline" id="btn-toggle-audit-view" style="font-size: 0.85rem; border-color: #cbd5e1;">
              📋 View Audit Logs
            </button>
            <button class="btn btn-outline" id="btn-refresh-server-staff" style="font-size: 0.85rem; border-color: #cbd5e1;" title="Refresh Accounts from Database">
              🔄 Sync Accounts
            </button>
            <button class="btn btn-success" id="btn-create-staff-hub" style="font-size: 0.85rem;">
              ${getIcon('plus')} Create New Staff Member
            </button>
          </div>
        </div>

        <!-- Authoritative Staff Table -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Role Category</th>
                <th>Login Username</th>
                <th>Account Status</th>
                <th>Dynamic Permissions</th>
                <th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              ${displayList.map(s => {
                const isSuper = Boolean(s.is_super_admin || s.role === 'developer');
                const roleSlug = s.role_slug || s.role || 'staff';
                const roleName = s.role_name || s.roleTitle || roleSlug;
                const status = (s.status || 'active').toLowerCase();
                const mustReset = Boolean(s.must_reset_password);

                return `
                  <tr>
                    <td>
                      <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                        <span>${s.avatar || '🧑‍⚕️'}</span>
                        <span>${s.name}</span>
                        ${isSuper ? '<span style="font-size: 0.65rem; background: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8; padding: 1px 6px; border-radius: 9999px; font-weight: 800;">SUPER ADMIN</span>' : ''}
                      </div>
                      <div style="font-size: 0.74rem; color: #64748b;">${s.email || 'No email registered'} | ${s.phone || 'No phone'}</div>
                    </td>
                    <td>
                      <span style="font-size: 0.74rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: ${isSuper ? '#f5f3ff' : '#ecfdf5'}; color: ${isSuper ? '#7c3aed' : '#059669'};">
                        ${roleName}
                      </span>
                    </td>
                    <td style="font-family: monospace; font-size: 0.84rem; font-weight: 600;">
                      ${s.username}
                    </td>
                    <td>
                      <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 0.74rem; font-weight: 700; color: ${status === 'active' ? '#10b981' : '#dc2626'};">
                          ● ${status.toUpperCase()}
                        </span>
                        ${mustReset ? '<span style="font-size: 0.68rem; color: #d97706; font-weight: 600;">⚠️ Password Reset Pending</span>' : ''}
                      </div>
                    </td>
                    <td>
                      <div style="font-size: 0.78rem; font-weight: 600; color: #334155;">
                        ${isSuper ? '<strong style="color: #7c3aed;">Full Unrestricted Authority</strong>' : 'Dynamic Role & Overrides'}
                      </div>
                      <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">
                        ${isSuper ? 'All 16 operational modules enabled' : 'Click "Overrides" to inspect/modify'}
                      </div>
                    </td>
                    <td class="text-center">
                      <div style="display: inline-flex; gap: 0.35rem;">
                        <button class="btn btn-outline btn-sm btn-edit-staff-hub" data-staff-id="${s.id}">
                          Edit
                        </button>
                        <button class="btn btn-outline btn-sm btn-manage-overrides-hub" data-staff-id="${s.id}" style="color: #4338ca; border-color: #c7d2fe;">
                          Overrides
                        </button>
                        ${!isSuper ? `
                          <button class="btn btn-danger btn-sm btn-delete-staff-hub" data-staff-id="${s.id}" title="Deactivate Account">
                            ${getIcon('trash')}
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        ${migrationCandidates.length > 0 ? `
          <!-- Migration Candidates Section -->
          <div style="margin-top: 2rem; border-top: 2px dashed #e2e8f0; padding-top: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h3 style="font-size: 1.05rem; font-weight: 700; color: #92400e; margin: 0;">📋 Migration Candidates (Local Profiles)</h3>
                  <span style="font-size: 0.7rem; font-weight: 700; background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 9999px;">
                    ${migrationCandidates.length} Pending Provisioning
                  </span>
                </div>
                <p style="font-size: 0.78rem; color: #78350f; margin: 2px 0 0 0;">
                  These staff accounts exist in browser storage. Click "Provision Server Account" to assign a secure, expiring 12-character single-use password and record them in PostgreSQL.
                </p>
              </div>
            </div>

            <div class="table-responsive">
              <table class="data-table" style="background: #fffbeb;">
                <thead>
                  <tr>
                    <th>Candidate Profile</th>
                    <th>Target Role</th>
                    <th>Proposed Username</th>
                    <th>Migration Status</th>
                    <th class="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${migrationCandidates.map(c => `
                    <tr>
                      <td>
                        <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                          <span>${c.avatar || '🧑‍⚕️'}</span>
                          <span>${c.name}</span>
                        </div>
                        <div style="font-size: 0.74rem; color: #64748b;">${c.email || 'No email registered'} | ${c.phone || 'No phone'}</div>
                      </td>
                      <td>
                        <span style="font-size: 0.74rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: #e0e7ff; color: #4338ca;">
                          ${c.roleTitle || c.role}
                        </span>
                      </td>
                      <td style="font-family: monospace; font-size: 0.84rem; font-weight: 600;">
                        ${c.username}
                      </td>
                      <td>
                        <span style="font-size: 0.72rem; font-weight: 700; background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 9999px;">
                          Ready to Provision
                        </span>
                      </td>
                      <td class="text-center">
                        <button class="btn btn-success btn-sm btn-provision-candidate" data-candidate-id="${c.id}" style="font-size: 0.78rem;">
                          ${getIcon('plus')} Provision Account
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * SECTION 1B: Administrative Security Audit Trail
   * ------------------------------------------------------------- */
  renderAuditLogsSection() {
    const logs = this.auditLogsList || [];

    return `
      <div class="app-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0;">Administrative Security Audit Trail</h2>
              <span style="font-size: 0.7rem; font-weight: 700; background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 9999px;">
                Immutable Audit Log
              </span>
            </div>
            <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Real-time chronological log of staff provisioning, role updates, and dynamic permission overrides.</p>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-outline" id="btn-back-to-staff" style="font-size: 0.85rem; border-color: #cbd5e1;">
              ← Back to Staff Accounts
            </button>
            <button class="btn btn-outline" id="btn-refresh-audit-logs" style="font-size: 0.85rem; border-color: #cbd5e1;">
              🔄 Refresh Logs
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Acting Administrator</th>
                <th>Action</th>
                <th>Target User</th>
                <th>Audit Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `
                <tr>
                  <td colspan="5" class="text-center" style="padding: 2rem; color: #64748b;">
                    No administrative audit logs recorded yet. All role updates, staff provisioning, and overrides will appear here.
                  </td>
                </tr>
              ` : logs.map(l => {
                let detailsText = '';
                try {
                  const d = typeof l.details === 'string' ? JSON.parse(l.details) : l.details;
                  detailsText = JSON.stringify(d, null, 1).replace(/[{}"]/g, '');
                } catch (_) {
                  detailsText = String(l.details || '');
                }

                const actionColor = l.action === 'STAFF_PROVISIONED' ? '#059669' :
                  (l.action === 'OVERRIDES_MODIFIED' ? '#7c3aed' :
                  (l.action === 'STAFF_UPDATED' ? '#0284c7' : '#475569'));

                return `
                  <tr>
                    <td style="font-size: 0.78rem; font-family: monospace; white-space: nowrap;">
                      ${new Date(l.created_at).toLocaleString()}
                    </td>
                    <td>
                      <div style="font-weight: 700; color: #0f172a; font-size: 0.82rem;">${l.admin_name || l.admin_username || 'System / Console'}</div>
                      <div style="font-size: 0.72rem; color: #64748b;">@${l.admin_username || 'console'}</div>
                    </td>
                    <td>
                      <span style="font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: ${actionColor}15; color: ${actionColor}; border: 1px solid ${actionColor}30;">
                        ${l.action}
                      </span>
                    </td>
                    <td>
                      <div style="font-weight: 600; color: #0f172a; font-size: 0.82rem;">${l.target_name || l.target_username || '-'}</div>
                      <div style="font-size: 0.72rem; color: #64748b;">@${l.target_username || '-'}</div>
                    </td>
                    <td style="font-size: 0.75rem; font-family: monospace; color: #334155; max-width: 300px; word-break: break-all;">
                      ${detailsText}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * SECTION 2: Universal (Global) UI & Store Settings
   * Name, Contacts, Address, Tagline, Greeting Message
   * Dual Logos (Coloured & White), Fallback Logo, Hex Palettes
   * ------------------------------------------------------------- */
  renderGlobalUiSection() {
    const g = pharmacyDB.data.globalSettings || {};
    const primaryCol = g.primaryColor || '#0284c7';
    const secondaryCol = g.secondaryColor || '#0f766e';
    const logoColoredPath = g.logoColored || 'website_images/default-logo-colored.svg';
    const logoColoredData = g.logoColoredData || '';
    const logoWhitePath = g.logoWhite || 'website_images/default-logo-white.svg';
    const logoWhiteData = g.logoWhiteData || '';
    const fallbackLogoPath = g.fallbackLogoImage || 'website_images/default-logo-fallback.svg';
    const fallbackLogoData = g.fallbackLogoData || '';
    const fallbackType = g.fallbackType || 'image';
    const logoText = g.logo || 'Rx';

    const priSwatches = ['#0284c7', '#2563eb', '#059669', '#7c3aed', '#0f172a', '#e11d48', '#d97706'];
    const secSwatches = ['#0f766e', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#64748b', '#475569'];

    return `
      <div class="app-card">
        <div style="margin-bottom: 1.25rem;">
          <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>🌐</span> Universal (Global) UI, Dual Logos & Store Settings
          </h2>
          <p style="font-size: 0.8rem; color: #64748b; margin: 0;">
            Universal store branding, dual logos (White & Coloured) for contextual background fitting, image/text fallback emblems, and hex color palettes.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: 1.25fr 1fr; gap: 1.5rem;">
          <!-- Left Column: Form Controls -->
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1.25rem;">

            <!-- SUB-CARD 1: DUAL LOGOS (COLOURED & WHITE) -->
            <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; background: #fafafa;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                  <span>🖼️</span> Dual Logo System (Contextual Background Fit)
                </div>
                <span class="logo-folder-badge" title="Uploaded assets are stored in the server media library">
                  📁 Server Media
                </span>
              </div>

              <!-- 1A: COLOURED LOGO (FOR LIGHT BACKGROUNDS) -->
              <div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem; margin-bottom: 0.85rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <div>
                    <span style="font-size: 0.82rem; font-weight: 700; color: #0f172a;">🎨 Coloured Logo</span>
                    <span style="font-size: 0.72rem; color: #64748b; margin-left: 6px;">(For Light Backgrounds: Thermal Receipts & Login)</span>
                  </div>
                  <span style="font-size: 0.68rem; background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Light Context</span>
                </div>

                <input type="file" id="glob-colored-file" accept="image/jpeg,image/png,image/webp" style="display: none;">
                <input type="hidden" id="glob-colored-path" value="${logoColoredPath}">
                <input type="hidden" id="glob-colored-data" value="${logoColoredData}">

                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                  <!-- Preview Box with clean white background -->
                  <div style="width: 100px; height: 60px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; padding: 4px;">
                    <img id="preview-colored-img" src="${logoColoredData || logoColoredPath}" alt="Coloured Logo" style="max-height: 52px; max-width: 90px; object-fit: contain;">
                  </div>
                  <div style="flex: 1; min-width: 180px;">
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                      <button type="button" class="btn btn-primary btn-sm" id="btn-upload-colored" style="font-size: 0.73rem; padding: 4px 8px;">
                        ${getIcon('upload')} Upload Coloured
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" id="btn-media-colored" style="font-size: 0.73rem; padding: 4px 8px;">
                        📁 Media Center
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" id="btn-reset-colored" style="font-size: 0.7rem; padding: 4px 8px;">
                        Default SVG
                      </button>
                    </div>
                    <div style="font-size: 0.68rem; color: #059669; font-weight: 600; margin-top: 4px;">
                      Path: <code id="text-colored-path">${logoColoredPath}</code>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 1B: WHITE LOGO (FOR DARK BACKGROUNDS) -->
              <div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <div>
                    <span style="font-size: 0.82rem; font-weight: 700; color: #0f172a;">⚪ White Logo</span>
                    <span style="font-size: 0.72rem; color: #64748b; margin-left: 6px;">(For Dark Backgrounds: App Sidebar #0f172a)</span>
                  </div>
                  <span style="font-size: 0.68rem; background: #0f172a; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Dark Context</span>
                </div>

                <input type="file" id="glob-white-file" accept="image/jpeg,image/png,image/webp" style="display: none;">
                <input type="hidden" id="glob-white-path" value="${logoWhitePath}">
                <input type="hidden" id="glob-white-data" value="${logoWhiteData}">

                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                  <!-- Preview Box with dark background matching sidebar -->
                  <div style="width: 100px; height: 60px; background: #0f172a; border: 1px dashed #475569; border-radius: 6px; display: flex; align-items: center; justify-content: center; padding: 4px;">
                    <img id="preview-white-img" src="${logoWhiteData || logoWhitePath}" alt="White Logo" style="max-height: 52px; max-width: 90px; object-fit: contain;">
                  </div>
                  <div style="flex: 1; min-width: 180px;">
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                      <button type="button" class="btn btn-primary btn-sm" id="btn-upload-white" style="font-size: 0.73rem; padding: 4px 8px;">
                        ${getIcon('upload')} Upload White
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" id="btn-media-white" style="font-size: 0.73rem; padding: 4px 8px;">
                        📁 Media Center
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" id="btn-reset-white" style="font-size: 0.7rem; padding: 4px 8px;">
                        Default SVG
                      </button>
                    </div>
                    <div style="font-size: 0.68rem; color: #059669; font-weight: 600; margin-top: 4px;">
                      Path: <code id="text-white-path">${logoWhitePath}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- SUB-CARD 2: FALLBACK LOGO (IMAGE OR TEXT EMBLEM) -->
            <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; background: #fafafa;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                  <span>🛡️</span> Fallback Logo (Used as Fallback Only)
                </div>
                <span style="font-size: 0.7rem; color: #64748b;">Triggers if primary image fails</span>
              </div>

              <!-- Fallback Choice Radios -->
              <div style="display: flex; gap: 1.25rem; align-items: center; margin-bottom: 0.75rem; font-size: 0.8rem;">
                <label style="cursor: pointer; display: flex; align-items: center; gap: 5px; font-weight: 600;">
                  <input type="radio" name="fallback-type-choice" value="image" ${fallbackType === 'image' ? 'checked' : ''} id="choice-fallback-image">
                  Use Fallback Image (Upload/Media Center)
                </label>
                <label style="cursor: pointer; display: flex; align-items: center; gap: 5px; font-weight: 600;">
                  <input type="radio" name="fallback-type-choice" value="text" ${fallbackType === 'text' ? 'checked' : ''} id="choice-fallback-text">
                  Use Text Emblem
                </label>
              </div>

              <!-- Option A: Fallback Image -->
              <div id="wrap-fallback-image" style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem; display: ${fallbackType === 'image' ? 'block' : 'none'};">
                <input type="file" id="glob-fallback-file" accept="image/jpeg,image/png,image/webp" style="display: none;">
                <input type="hidden" id="glob-fallback-path" value="${fallbackLogoPath}">
                <input type="hidden" id="glob-fallback-data" value="${fallbackLogoData}">

                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                  <div style="width: 80px; height: 50px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; padding: 4px;">
                    <img id="preview-fallback-img" src="${fallbackLogoData || fallbackLogoPath}" alt="Fallback Logo" style="max-height: 42px; max-width: 72px; object-fit: contain;">
                  </div>
                  <div style="flex: 1; min-width: 180px;">
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                      <button type="button" class="btn btn-primary btn-sm" id="btn-upload-fallback" style="font-size: 0.73rem; padding: 4px 8px;">
                        ${getIcon('upload')} Upload Fallback Image
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" id="btn-media-fallback" style="font-size: 0.73rem; padding: 4px 8px;">
                        📁 Media Center
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" id="btn-reset-fallback" style="font-size: 0.7rem; padding: 4px 8px;">
                        Default SVG
                      </button>
                    </div>
                    <div style="font-size: 0.68rem; color: #059669; font-weight: 600; margin-top: 4px;">
                      Fallback Path: <code id="text-fallback-path">${fallbackLogoPath}</code>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Option B: Text Emblem -->
              <div id="wrap-fallback-text" style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem; display: ${fallbackType === 'text' ? 'block' : 'none'};">
                <label class="form-label" style="margin-bottom: 4px;">Text Emblem Characters (Max 4)</label>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <input type="text" id="glob-logo" class="form-control" value="${logoText}" maxlength="4" style="font-weight: 800; font-size: 1.15rem; text-align: center; width: 100px;">
                  <span style="font-size: 0.75rem; color: #64748b;">e.g. BMH, Rx, +, RX+</span>
                </div>
              </div>
            </div>

            <!-- SUB-CARD 3: BRAND COLOR PALETTE -->
            <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; background: #fafafa;">
              <div style="font-weight: 700; font-size: 0.92rem; color: #0f172a; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 6px;">
                <span>🎨</span> Brand Color Palette (Hex Codes & Pickers)
              </div>

              <div class="form-row-2">
                <!-- Primary Color Group -->
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label">Primary Color (Hex Code) *</label>
                  <div class="color-field-wrap">
                    <input type="color" id="glob-primary-picker" class="color-picker-input" value="${primaryCol}">
                    <input type="text" id="glob-primary-hex" class="form-control color-hex-input" value="${primaryCol}" maxlength="7" placeholder="#0284C7">
                  </div>
                  <div class="color-swatch-list">
                    ${priSwatches.map(hex => `
                      <button type="button" class="color-swatch-btn btn-pri-swatch" data-hex="${hex}" style="background: ${hex};" title="Set Primary ${hex}"></button>
                    `).join('')}
                  </div>
                  <div style="font-size: 0.7rem; color: #64748b; margin-top: 4px;">Buttons, active tabs, header borders</div>
                </div>

                <!-- Secondary Color Group -->
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label">Secondary Color (Hex Code) *</label>
                  <div class="color-field-wrap">
                    <input type="color" id="glob-secondary-picker" class="color-picker-input" value="${secondaryCol}">
                    <input type="text" id="glob-secondary-hex" class="form-control color-hex-input" value="${secondaryCol}" maxlength="7" placeholder="#0F766E">
                  </div>
                  <div class="color-swatch-list">
                    ${secSwatches.map(hex => `
                      <button type="button" class="color-swatch-btn btn-sec-swatch" data-hex="${hex}" style="background: ${hex};" title="Set Secondary ${hex}"></button>
                    `).join('')}
                  </div>
                  <div style="font-size: 0.7rem; color: #64748b; margin-top: 4px;">Brand gradient, accents, status pills</div>
                </div>
              </div>

              <!-- Dynamic Palette Bar -->
              <div class="color-palette-preview" id="glob-palette-bar" style="background: linear-gradient(135deg, ${primaryCol} 0%, ${secondaryCol} 100%); margin-top: 0.85rem;">
                <div class="palette-pri">PRIMARY: <span id="label-pri-hex">${primaryCol}</span></div>
                <div class="palette-sec">SECONDARY: <span id="label-sec-hex">${secondaryCol}</span></div>
              </div>
            </div>

            <!-- SUB-CARD 4: UNIVERSAL STORE DETAILS -->
            <div class="form-group">
              <label class="form-label">Universal Pharmacy Name *</label>
              <input type="text" id="glob-name" class="form-control" value="${g.name || 'Bagan Medical Hall'}" placeholder="e.g. Bagan Medical Hall" required>
            </div>

            <div class="form-group">
              <label class="form-label">Universal Tagline *</label>
              <input type="text" id="glob-tagline" class="form-control" value="${g.tagline || ''}" placeholder="e.g. Your Trusted Pharmacy & Clinical Dispensary">
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Primary Contact Numbers *</label>
                <input type="text" id="glob-phone" class="form-control" value="${g.phone || '+1 (555) 342-8800'}" placeholder="+1 (555) 342-8800">
              </div>
              <div class="form-group">
                <label class="form-label">Official Email Address</label>
                <input type="email" id="glob-email" class="form-control" value="${g.email || 'admin.baganmedicalhall@gmail.com'}" placeholder="admin.baganmedicalhall@gmail.com">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Combined Contact Text (For Invoices & Receipts)</label>
              <input type="text" id="glob-contacts" class="form-control" value="${g.contacts || ''}" placeholder="Ph: 555-342-8800 | admin.baganmedicalhall@gmail.com">
            </div>

            <div class="form-group">
              <label class="form-label">Universal Physical Store Address</label>
              <input type="text" id="glob-address" class="form-control" value="${g.address || '104 Healthcare Avenue, Medical District, Suite 101'}" placeholder="Street, Suite, City, Country">
            </div>

            <div class="form-group">
              <label class="form-label">Universal Greeting & Announcement Message</label>
              <textarea id="glob-greeting" class="form-control" rows="2" placeholder="Welcome broadcast message displayed across login screen and notifications...">${g.greetingMessage || ''}</textarea>
            </div>

            <button class="btn btn-primary btn-lg" id="btn-save-global-settings" style="width: 100%; margin-top: 0.25rem; justify-content: center; background: ${primaryCol}; border-color: ${primaryCol};">
              💾 Save Universal (Global) Settings
            </button>
          </div>

          <!-- Right Column: Contextual Live Impact Previews -->
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
            <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b;">
              Contextual Background Fit (Live Previews):
            </div>

            <!-- Preview 1: Dark Background (Sidebar #0f172a) -> WHITE LOGO -->
            <div style="border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
              <div style="background: #1e293b; color: #94a3b8; font-size: 0.68rem; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.04em;">
                🌓 Dark Background (Sidebar Navigation) &rarr; White Logo
              </div>
              <div style="background: #0f172a; color: white; padding: 0.85rem; display: flex; align-items: center; gap: 0.75rem;">
                <div class="brand-icon" style="background: transparent; border: none; box-shadow: none; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 0;" id="prev-sidebar-logo">
                  <img src="${logoWhiteData || logoWhitePath}" alt="White Logo" style="width: 100%; height: 100%; object-fit: contain; border: none; box-shadow: none;">
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: white;" id="prev-glob-name">${g.name || 'Bagan Medical Hall'}</div>
                  <div style="font-size: 0.72rem; color: #94a3b8;" id="prev-glob-tagline">${g.tagline || ''}</div>
                </div>
              </div>
            </div>

            <!-- Preview 2: Light Background (Thermal POS Receipt) -> COLOURED LOGO -->
            <div style="border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1;">
              <div style="background: #e2e8f0; color: #334155; font-size: 0.68rem; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.04em;">
                ☀️ Light Background (Thermal POS Receipt) &rarr; Coloured Logo
              </div>
              <div style="background: white; padding: 0.85rem; font-family: monospace; font-size: 0.75rem; color: black; line-height: 1.35;">
                <div id="prev-receipt-logo-wrap" style="text-align: center; margin-bottom: 4px;">
                  <img id="prev-receipt-logo" src="${logoColoredData || logoColoredPath}" alt="Coloured Logo" style="max-height: 38px; max-width: 120px; object-fit: contain;">
                </div>
                <div style="text-align: center; font-weight: bold; font-size: 0.85rem;" id="prev-receipt-name">${g.name || 'Bagan Medical Hall'}</div>
                <div style="text-align: center; font-size: 0.68rem; color: #475569;" id="prev-receipt-tagline">${g.tagline || ''}</div>
                <div style="text-align: center; font-size: 0.68rem; color: #475569;" id="prev-receipt-address">${g.address || ''}</div>
                <div style="border-top: 1px dashed #cbd5e1; margin: 4px 0;"></div>
                <div style="display: flex; justify-content: space-between;"><span>AMOXICILLIN 500MG x2</span><span style="font-weight:bold;">$28.00</span></div>
                <div style="display: flex; justify-content: space-between;"><span>PARACETAMOL 650MG x1</span><span style="font-weight:bold;">$4.50</span></div>
                <div style="border-top: 1px dashed #cbd5e1; margin: 4px 0;"></div>
                <div style="display: flex; justify-content: space-between;"><span>TOTAL:</span><span style="font-weight:bold;">$32.50</span></div>
              </div>
            </div>

            <!-- Preview 3: Light Background (Login Card) -> COLOURED LOGO -->
            <div style="border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1;">
              <div style="background: #e2e8f0; color: #334155; font-size: 0.68rem; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.04em;">
                ☀️ Light Background (Staff & Dev Login) &rarr; Coloured Logo
              </div>
              <div style="background: white; padding: 0.85rem; text-align: center;">
                <div style="width: 52px; height: 52px; margin: 0 auto 4px auto; display: flex; align-items: center; justify-content: center;">
                  <img id="prev-login-logo" src="${logoColoredData || logoColoredPath}" alt="Coloured Logo" style="max-height: 48px; max-width: 48px; object-fit: contain;">
                </div>
                <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;" id="prev-login-name">${g.name || 'Bagan Medical Hall'}</div>
                <div style="font-size: 0.72rem; color: #64748b;" id="prev-login-tagline">${g.tagline || ''}</div>
              </div>
            </div>

            <!-- Preview 4: Fallback Preview -->
            <div style="border-radius: 8px; overflow: hidden; border: 1px dashed #cbd5e1; background: white; padding: 0.75rem;">
              <div style="font-size: 0.68rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">
                🛡️ Active Fallback Appearance:
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div id="prev-fallback-display" style="width: 44px; height: 44px; background: #f1f5f9; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem; color: ${primaryCol}; overflow: hidden;">
                  ${fallbackType === 'image' 
                    ? `<img src="${fallbackLogoData || fallbackLogoPath}" alt="Fallback" style="width:100%; height:100%; object-fit:contain;">`
                    : logoText}
                </div>
                <div style="font-size: 0.72rem; color: #64748b;">
                  Shown when primary images fail or are missing.
                </div>
              </div>
            </div>

            <!-- Preview 5: UI Element Appearance -->
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem;">
              <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; margin-bottom: 0.5rem; text-transform: uppercase;">UI Component Appearance:</div>
              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary btn-sm" id="prev-sample-btn" style="background: ${primaryCol}; border-color: ${primaryCol};">
                  Primary Button
                </button>
                <span class="nav-badge" id="prev-sample-badge" style="background: ${secondaryCol}20; color: ${secondaryCol}; font-weight: 700;">
                  Secondary Accent
                </span>
                <span class="logo-folder-badge">
                  📁 website_images/
                </span>
              </div>
            </div>

            <!-- Preview 6: Greeting Broadcast Banner -->
            <div style="padding: 0.65rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 0.78rem; color: #1e40af;" id="prev-glob-greeting-wrap">
              📢 <strong>Universal Greeting Broadcast:</strong>
              <div style="margin-top: 2px;" id="prev-glob-greeting">${g.greetingMessage || 'None currently active.'}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * SECTION 3: Page UI Editing (Separate Dedicated Page)
   * Login Page, POS Dispensing Rules, Thermal Receipt Layout
   * ------------------------------------------------------------- */
  renderPageUiSection() {
    const p = pharmacyDB.data.loginPageSettings || {};
    const u = pharmacyDB.data.staffUiSettings || {};
    const g = pharmacyDB.data.globalSettings || {};

    const priColor = p.primaryColor || g.primaryColor || p.accentColor || '#0284c7';
    const secColor = p.secondaryColor || g.secondaryColor || '#0f766e';

    const colorPresets = [
      { name: 'Medical Blue', pri: '#0284c7', sec: '#0f766e' },
      { name: 'Emerald Green', pri: '#059669', sec: '#0d9488' },
      { name: 'Clinical Indigo', pri: '#4f46e5', sec: '#7c3aed' },
      { name: 'Modern Violet', pri: '#7c3aed', sec: '#db2777' },
      { name: 'Dark Slate', pri: '#0f172a', sec: '#334155' },
      { name: 'Crimson Rose', pri: '#e11d48', sec: '#f43f5e' }
    ];

    return `
      <div class="app-card">
        <div style="margin-bottom: 1.25rem;">
          <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0;">Dedicated Page UI & Workflow Customizer</h2>
          <p style="font-size: 0.8rem; color: #64748b; margin: 0;">Configure individual page layouts, login gateway visuals with hex codes, and cashier terminal restrictions.</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <!-- Column 1: Login Page Visuals -->
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; display: flex; align-items: center; gap: 6px;">
              <span>🔑</span> Login Page Visual & Color Configuration
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Primary Color (Hex Code) *</label>
                <div class="color-field-wrap">
                  <input type="color" id="page-primary-picker" class="color-picker-input" value="${priColor}">
                  <input type="text" id="page-primary-hex" class="form-control color-hex-input" value="${priColor}" maxlength="7">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Secondary Color (Hex Code) *</label>
                <div class="color-field-wrap">
                  <input type="color" id="page-secondary-picker" class="color-picker-input" value="${secColor}">
                  <input type="text" id="page-secondary-hex" class="form-control color-hex-input" value="${secColor}" maxlength="7">
                </div>
              </div>
            </div>

            <!-- Preset Palettes -->
            <div style="margin-bottom: 1rem;">
              <label class="form-label">1-Click Medical Color Themes</label>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                ${colorPresets.map(c => `
                  <button type="button" class="btn btn-outline btn-sm btn-page-theme-chip" data-pri="${c.pri}" data-sec="${c.sec}" style="padding: 3px 8px; font-size: 0.72rem; display: flex; align-items: center; gap: 5px;">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${c.pri};"></span>
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${c.sec};"></span>
                    ${c.name}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="form-group" style="padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.84rem; font-weight: 600; cursor: pointer;">
                <input type="checkbox" id="page-login-show-creds" ${p.showTestCredentials ? 'checked' : ''} style="width: 18px; height: 18px;">
                Show 1-Click Test Credentials Box on Login Page
              </label>
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px; margin-left: 26px;">
                Disable this in live deployment for a clean, secure staff sign-in interface.
              </div>
            </div>
          </div>

          <!-- Column 2: POS Dispensing & Thermal Receipts -->
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; display: flex; align-items: center; gap: 6px;">
              <span>💳</span> POS Dispensing & Receipt Settings
            </div>

            <div class="form-group">
              <label class="form-label">Staff Default Landing View</label>
              <select id="page-ui-default-view" class="form-control">
                <option value="pos" ${u.defaultView === 'pos' ? 'selected' : ''}>POS Dispensing Counter (Fast Cashiering)</option>
                <option value="dashboard" ${u.defaultView === 'dashboard' ? 'selected' : ''}>Executive Analytics Dashboard</option>
                <option value="inventory" ${u.defaultView === 'inventory' ? 'selected' : ''}>Drug Master & Expiry Inventory</option>
                <option value="accounts" ${u.defaultView === 'accounts' ? 'selected' : ''}>Patient Credit Accounts</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Staff Max Allowed Bill Discount (%)</label>
              <input type="number" id="page-ui-max-discount" class="form-control" value="${u.maxDiscountPercent || 15}" min="0" max="100">
              <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">Limits cashiers from discounting beyond this percentage without developer approval.</div>
            </div>

            <div class="form-group">
              <label class="form-label">Thermal Receipt Footer Closing Note</label>
              <input type="text" id="page-ui-receipt-footer" class="form-control" value="${u.thermalReceiptFooter || 'Thank you for choosing Bagan Medical Hall!'}">
            </div>

            <div class="form-group" style="padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.84rem; font-weight: 600; cursor: pointer;">
                <input type="checkbox" id="page-ui-rx-doctor" ${u.requireDoctorForRx ? 'checked' : ''} style="width: 18px; height: 18px;">
                Enforce Prescribing Doctor Name for Prescription Drugs (Schedule H)
              </label>
            </div>

            <div class="form-group" style="padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.84rem; font-weight: 600; cursor: pointer;">
                <input type="checkbox" id="page-ui-enable-hold" ${u.enableHoldTickets ? 'checked' : ''} style="width: 18px; height: 18px;">
                Enable Bill Parking / Hold Tickets [F8] for Staff
              </label>
            </div>
          </div>
        </div>

        <div style="margin-top: 1.25rem;">
          <button class="btn btn-primary btn-lg" id="btn-save-page-ui-settings" style="width: 100%; justify-content: center; background: ${priColor}; border-color: ${priColor};">
            💾 Save Page UI & POS Workflow Configuration
          </button>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * SECTION 4: Media Center & website_images Asset Manager
   * ------------------------------------------------------------- */
  renderMediaCenterSection() {
    const mediaItems = pharmacyDB.data.mediaLibrary || [];
    const g = pharmacyDB.data.globalSettings || {};

    return `
      <div class="app-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>📸</span> Media Center & Asset Management
            </h2>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0;">
              Media files are stored on the server through the authenticated Media API. Uploaded images are converted to WebP where supported; logo settings continue to use the existing website settings.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline" id="btn-sync-media-folder" style="font-size: 0.82rem;" title="Refresh the authenticated server media library">
              🔄 Refresh Server Media
            </button>
            <input type="file" id="media-center-file-input" accept="image/jpeg,image/png,image/webp" multiple style="display: none;">
            <button class="btn btn-primary" id="btn-media-center-upload" style="font-size: 0.85rem;">
              ${getIcon('upload')} Upload New (Auto-Convert to WebP)
            </button>
          </div>
        </div>

        <!-- Real-Time Sync & Server Status Banner -->
        <div id="media-server-status-bar" style="margin-bottom: 1.25rem; padding: 0.75rem 1rem; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem;">
            <span id="media-status-dot" style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.2);"></span>
            <span id="media-status-text" style="color: #166534; font-weight: 600;">
              Authenticated server media API is used for uploads, listing and deletions
            </span>
          </div>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <button type="button" class="btn btn-outline btn-sm" id="btn-check-server-status" style="font-size: 0.73rem; padding: 4px 10px; background: white;" title="Check API and database connectivity">
              ⚡ Test Server
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-pick-media-folder" style="font-size: 0.73rem; padding: 4px 10px; background: white;" title="Optional local browser folder permission; this does not upload files to the server">
              📁 Local Folder Access
            </button>
          </div>
        </div>

        <!-- Drag & Drop Upload Zone -->
        <div id="media-center-dropzone" style="border: 2px dashed #94a3b8; border-radius: 10px; padding: 1.25rem; text-align: center; background: #f8fafc; margin-bottom: 1.25rem; cursor: pointer; transition: all 0.2s ease;">
          <div style="font-size: 1.8rem; margin-bottom: 0.25rem;">🖼️</div>
          <div style="font-weight: 700; font-size: 0.92rem; color: #1e293b;">Click to Browse or Drag & Drop Images Here</div>
          <div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">Accepted formats: JPEG, PNG and WebP. Maximum 5 MB per image. The server stores uploaded media as WebP.</div>
        </div>

        <!-- Toolbar: Search & Count Filter -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; gap: 1rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #334155;">Library Assets:</span>
            <span class="nav-badge" style="background: #e2e8f0; color: #1e293b; font-weight: 700;">${mediaItems.length} Files</span>
            <span class="logo-folder-badge">📁 Server Media</span>
          </div>
          <div style="max-width: 280px; width: 100%;">
            <input type="text" id="media-center-search" class="form-control" placeholder="Search images by name..." style="padding: 0.35rem 0.65rem; font-size: 0.8rem;">
          </div>
        </div>

        <!-- Media Grid -->
        <div id="media-center-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem;">
          ${mediaItems.length === 0 ? `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: #64748b; background: white; border: 1px dashed #cbd5e1; border-radius: 10px;">
              <div style="font-size: 3rem; margin-bottom: 0.5rem;">🖼️</div>
              <div style="font-weight: 600; font-size: 1rem;">No Media Uploaded Yet</div>
              <div style="font-size: 0.8rem; margin-top: 4px;">Use the upload button above to add images to the server media library.</div>
            </div>
          ` : mediaItems.map(item => {
            const isColLogo = (g.logoColored === item.path || (item.dataUrl && g.logoColoredData === item.dataUrl));
            const isWhiteLogo = (g.logoWhite === item.path || (item.dataUrl && g.logoWhiteData === item.dataUrl));
            const isFallback = (g.fallbackLogoImage === item.path || (item.dataUrl && g.fallbackLogoData === item.dataUrl));
            const isWebp = item.filename && (item.filename.toLowerCase().endsWith('.webp') || item.format === 'webp');

            const medicines = pharmacyDB.data.medicines || [];
            const isCatalogRef = medicines.some(m => m.image && (m.image === item.path || m.image === item.filename));
            const isProtectedSysFile = (item.filename || '').toLowerCase() === 'bagan-medical-hall-logo.png' || (item.filename || '').toLowerCase().startsWith('default-logo');
            const isReferenced = Boolean(isColLogo || isWhiteLogo || isFallback || isCatalogRef || isProtectedSysFile);
            const canDelete = Boolean(this.isDeveloper() || this.hasPermission('mediaDelete'));

            return `
              <div class="media-card" data-filename="${item.filename.toLowerCase()}" style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem; display: flex; flex-direction: column; transition: transform 0.15s ease, box-shadow 0.15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <!-- Preview Thumbnail with Checkerboard/Neutral BG -->
                <div style="width: 100%; height: 130px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px; overflow: hidden; position: relative; margin-bottom: 0.75rem;">
                  <img src="${item.dataUrl || item.path}" alt="${item.filename}" style="max-width: 90%; max-height: 90%; object-fit: contain;">
                  ${isColLogo ? `<span style="position: absolute; top: 6px; left: 6px; background: #0284c7; color: white; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">🎨 Coloured</span>` : ''}
                  ${isWhiteLogo ? `<span style="position: absolute; top: 6px; right: 6px; background: #0f172a; color: white; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">⚪ White</span>` : ''}
                  ${isFallback ? `<span style="position: absolute; bottom: 6px; left: 6px; background: #059669; color: white; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">🛡️ Fallback</span>` : ''}
                </div>

                <!-- Info -->
                <div style="flex: 1; margin-bottom: 0.75rem;">
                  <div style="font-weight: 700; font-size: 0.82rem; color: #0f172a; word-break: break-all; line-height: 1.3;" title="${item.filename}">
                    ${item.filename}
                  </div>
                  <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="display: flex; gap: 4px; align-items: center;">
                      ${isWebp ? `<span style="background: #e0f2fe; color: #0284c7; font-size: 0.65rem; font-weight: 700; padding: 1px 5px; border-radius: 4px;">WEBP</span>` : ''}
                      <span>${item.size ? (item.size > 1024 ? (item.size/1024).toFixed(1) + ' KB' : item.size + ' B') : 'WebP'}</span>
                    </span>
                    <span>${item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : 'System Asset'}</span>
                  </div>
                  <div style="font-size: 0.68rem; color: #059669; font-weight: 600; margin-top: 3px; word-break: break-all;">
                    <code>${item.path}</code>
                  </div>
                </div>

                <!-- Quick Action Buttons -->
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <button type="button" class="btn btn-outline btn-sm btn-assign-colored" data-path="${item.path}" data-dataurl="${item.dataUrl || ''}" data-filename="${item.filename}" style="font-size: 0.68rem; padding: 3px 4px; justify-content: center;" title="Assign as Coloured Logo for light backgrounds">
                      🎨 Coloured
                    </button>
                    <button type="button" class="btn btn-outline btn-sm btn-assign-white" data-path="${item.path}" data-dataurl="${item.dataUrl || ''}" data-filename="${item.filename}" style="font-size: 0.68rem; padding: 3px 4px; justify-content: center;" title="Assign as White Logo for dark backgrounds">
                      ⚪ White
                    </button>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <button type="button" class="btn btn-outline btn-sm btn-assign-fallback" data-path="${item.path}" data-dataurl="${item.dataUrl || ''}" data-filename="${item.filename}" style="font-size: 0.68rem; padding: 3px 4px; justify-content: center;" title="Assign as Fallback Logo">
                      🛡️ Fallback
                    </button>
                    <button type="button" class="btn btn-outline btn-sm btn-copy-media-path" data-path="${item.path}" style="font-size: 0.68rem; padding: 3px 4px; justify-content: center;" title="Copy file path">
                      📋 Copy Path
                    </button>
                  </div>
                  ${isReferenced ? `
                    <div style="font-size: 0.68rem; padding: 4px 6px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 5px; text-align: center; font-weight: 600;" title="Asset is in active use">
                      🔒 In Active Use (Protected)
                    </div>
                  ` : (canDelete ? `
                    <button type="button" class="btn btn-danger btn-sm btn-delete-media-hub" data-filename="${item.filename}" data-id="${item.id || ''}" style="font-size: 0.68rem; padding: 4px 6px; justify-content: center; width: 100%;" title="Permanently delete unreferenced media">
                      ${getIcon('trash')} Delete Asset
                    </button>
                  ` : `
                    <div style="font-size: 0.65rem; padding: 4px; color: #64748b; background: #f1f5f9; border-radius: 4px; text-align: center;">
                      Delete Restricted (Admin Only)
                    </div>
                  `)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * SECTION 5: Database Management
   * Inspection, Audit, Backup/Restore, Factory Reset
   * ------------------------------------------------------------- */
  renderDatabaseSection() {
    const data = pharmacyDB.data;
    const dbSize = new Blob([JSON.stringify(data)]).size;
    const tb = pharmacyDB.getTrialBalance();

    return `
      <div class="app-card">
        <div style="margin-bottom: 1.25rem;">
          <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0;">Database & Audit Management</h2>
          <p style="font-size: 0.8rem; color: #64748b; margin: 0;">Inspect raw schema, verify double-entry equality, export backups, and execute clean resets.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.25rem;">
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem;">
            <div style="font-size: 0.72rem; color: #64748b; text-transform: uppercase;">Storage Footprint</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #7c3aed; margin-top: 2px;">${(dbSize / 1024).toFixed(1)} KB</div>
            <div style="font-size: 0.7rem; color: #10b981; margin-top: 2px;">Persistent in LocalStorage</div>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem;">
            <div style="font-size: 0.72rem; color: #64748b; text-transform: uppercase;">Journal Vouchers Recorded</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #0f172a; margin-top: 2px;">${data.journalEntries.length} Vouchers</div>
            <div style="font-size: 0.7rem; color: #0284c7; margin-top: 2px;">${data.sales.length} Invoices generated</div>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem;">
            <div style="font-size: 0.72rem; color: #64748b; text-transform: uppercase;">Accounting Balance Integrity</div>
            <div style="font-size: 1.2rem; font-weight: 800; color: ${tb.isBalanced ? '#10b981' : '#dc2626'}; margin-top: 4px;">
              ${tb.isBalanced ? '✓ PERFECTLY BALANCED' : '⚠️ IMBALANCED'}
            </div>
            <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">Dr: $${tb.totalDebit.toFixed(2)} | Cr: $${tb.totalCredit.toFixed(2)}</div>
          </div>
        </div>

        <!-- Action Bar -->
        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap;">
          <button class="btn btn-outline" id="db-recalc-btn">
            🔄 Recalculate All Ledger Balances
          </button>
          <button class="btn btn-primary" id="db-export-json-btn">
            ${getIcon('download')} Export Full Raw JSON Backup
          </button>
          <button class="btn btn-danger" id="db-factory-reset-btn">
            ⚠️ Factory Reset to Clean Demo State
          </button>
        </div>

        <!-- Raw JSON Inspector -->
        <div style="background: #0f172a; color: #38bdf8; border-radius: 10px; padding: 1rem; overflow-x: auto; max-height: 280px; font-family: monospace; font-size: 0.76rem;">
          <div style="display: flex; justify-content: space-between; color: #94a3b8; font-size: 0.72rem; margin-bottom: 0.5rem; border-bottom: 1px solid #1e293b; padding-bottom: 4px;">
            <span>RAW DATABASE SCHEMA INSPECTOR (Bagan Medical Hall Database):</span>
            <span>Version: 2.1.0</span>
          </div>
          <pre style="margin: 0; color: #f1f5f9; line-height: 1.45;">${JSON.stringify({
            globalSettings: data.globalSettings,
            staffAccountsCount: data.staffMembers.length,
            accountsCount: data.accounts.length,
            medicinesCount: data.medicines.length,
            customersCount: data.customers.length,
            suppliersCount: data.suppliers.length,
            trialBalanceStatus: { isBalanced: tb.isBalanced, totalDebit: tb.totalDebit, totalCredit: tb.totalCredit }
          }, null, 2)}</pre>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * SECTION 4: Master Catalogs & Parameters (Add, Edit, Delete)
   * ------------------------------------------------------------- */
  renderMasterCatalogsSection() {
    this.activeCatalogSubTab = this.activeCatalogSubTab || 'product-cat';

    return `
      <div class="app-card">
        <!-- Sub-tab Pills Navigation -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.25rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.85rem;">
          <button class="btn btn-sm ${this.activeCatalogSubTab === 'product-cat' ? 'btn-primary' : 'btn-outline'} catalog-subtab-btn" data-subtab="product-cat">
            📦 Product Category
          </button>
          <button class="btn btn-sm ${this.activeCatalogSubTab === 'expense-cat' ? 'btn-primary' : 'btn-outline'} catalog-subtab-btn" data-subtab="expense-cat">
            💸 Product Expense Category
          </button>
          <button class="btn btn-sm ${this.activeCatalogSubTab === 'dosage-form' ? 'btn-primary' : 'btn-outline'} catalog-subtab-btn" data-subtab="dosage-form">
            💊 Dosages Form
          </button>
          <button class="btn btn-sm ${this.activeCatalogSubTab === 'procedure-type' ? 'btn-primary' : 'btn-outline'} catalog-subtab-btn" data-subtab="procedure-type">
            🩺 Procedure / Treatment Type *
          </button>
          <button class="btn btn-sm ${this.activeCatalogSubTab === 'admin-route' ? 'btn-primary' : 'btn-outline'} catalog-subtab-btn" data-subtab="admin-route">
            💉 Administration Route
          </button>
          <button class="btn btn-sm ${this.activeCatalogSubTab === 'status-opt' ? 'btn-primary' : 'btn-outline'} catalog-subtab-btn" data-subtab="status-opt">
            🚦 Status *
          </button>
        </div>

        <div id="catalog-subtab-content">
          ${this.renderCatalogSubTabContent(this.activeCatalogSubTab)}
        </div>
      </div>
    `;
  },

  renderCatalogSubTabContent(subTab) {
    switch (subTab) {
      case 'product-cat': {
        const list = pharmacyDB.getProductCategories ? pharmacyDB.getProductCategories() : [];
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0;">Product Categories (${list.length})</h3>
              <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Categorize medicines and products across POS, inventory, and analytics.</p>
            </div>
            <button class="btn btn-success btn-sm btn-add-catalog-item" data-type="product-cat">
              ${getIcon('plus')} Add Product Category
            </button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category Name</th>
                  <th>Tag Color</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(c => `
                  <tr>
                    <td style="font-weight: 700; color: #0284c7; font-size: 0.82rem;">${c.id}</td>
                    <td style="font-weight: 700; color: #0f172a;">${c.name}</td>
                    <td>
                      <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; background: ${c.color || '#0284c7'}20; color: ${c.color || '#0284c7'}; padding: 3px 8px; border-radius: 12px; font-weight: 700;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${c.color || '#0284c7'};"></span>
                        ${c.color || '#0284c7'}
                      </span>
                    </td>
                    <td style="font-size: 0.82rem; color: #475569;">${c.description || '-'}</td>
                    <td><span style="font-size: 0.72rem; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Active</span></td>
                    <td class="text-center" style="white-space: nowrap;">
                      <button class="btn btn-outline btn-sm btn-edit-catalog-item" data-type="product-cat" data-id="${c.id}" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 4px;">
                        ✏️ Edit
                      </button>
                      <button class="btn btn-danger btn-sm btn-delete-catalog-item" data-type="product-cat" data-id="${c.id}" style="padding: 3px 8px; font-size: 0.75rem;">
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      case 'expense-cat': {
        const list = pharmacyDB.getExpenseCategories ? pharmacyDB.getExpenseCategories() : [];
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0;">Product Expense Categories (${list.length})</h3>
              <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Manage operating expense categories for vouchers, drawer expense deductions, and ledgers.</p>
            </div>
            <button class="btn btn-success btn-sm btn-add-catalog-item" data-type="expense-cat">
              ${getIcon('plus')} Add Expense Category
            </button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Expense Category Name</th>
                  <th>Default Ledger Account</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(e => `
                  <tr>
                    <td style="font-weight: 700; color: #b45309; font-size: 0.82rem;">${e.id}</td>
                    <td style="font-weight: 700; color: #0f172a;">${e.name}</td>
                    <td style="font-size: 0.8rem; color: #0369a1; font-weight: 600;">Acct #${e.defaultAccount || '5090'}</td>
                    <td style="font-size: 0.82rem; color: #475569;">${e.description || '-'}</td>
                    <td><span style="font-size: 0.72rem; background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Operating</span></td>
                    <td class="text-center" style="white-space: nowrap;">
                      <button class="btn btn-outline btn-sm btn-edit-catalog-item" data-type="expense-cat" data-id="${e.id}" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 4px;">
                        ✏️ Edit
                      </button>
                      <button class="btn btn-danger btn-sm btn-delete-catalog-item" data-type="expense-cat" data-id="${e.id}" style="padding: 3px 8px; font-size: 0.75rem;">
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      case 'dosage-form': {
        const list = pharmacyDB.getDosageForms ? pharmacyDB.getDosageForms() : [];
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0;">Dosages Form (${list.length})</h3>
              <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Solid, liquid, semi-solid, and parenteral pharmaceutical formulation types.</p>
            </div>
            <button class="btn btn-success btn-sm btn-add-catalog-item" data-type="dosage-form">
              ${getIcon('plus')} Add Dosage Form
            </button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Dosage Form</th>
                  <th>Clinical Code</th>
                  <th>Description</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(d => `
                  <tr>
                    <td style="font-weight: 700; color: #7c3aed; font-size: 0.82rem;">${d.id}</td>
                    <td style="font-weight: 700; color: #0f172a;">${d.name}</td>
                    <td><span style="font-size: 0.75rem; font-weight: 700; background: #ede9fe; color: #6d28d9; padding: 2px 8px; border-radius: 4px;">${d.code || 'FORM'}</span></td>
                    <td style="font-size: 0.82rem; color: #475569;">${d.description || '-'}</td>
                    <td class="text-center" style="white-space: nowrap;">
                      <button class="btn btn-outline btn-sm btn-edit-catalog-item" data-type="dosage-form" data-id="${d.id}" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 4px;">
                        ✏️ Edit
                      </button>
                      <button class="btn btn-danger btn-sm btn-delete-catalog-item" data-type="dosage-form" data-id="${d.id}" style="padding: 3px 8px; font-size: 0.75rem;">
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      case 'procedure-type': {
        const list = pharmacyDB.getTreatmentTypes ? pharmacyDB.getTreatmentTypes() : [];
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0;">Procedure / Treatment Type * (${list.length})</h3>
              <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Clinical nursing interventions, nebulization, injections, and default service fee catalog.</p>
            </div>
            <button class="btn btn-success btn-sm btn-add-catalog-item" data-type="procedure-type">
              ${getIcon('plus')} Add Procedure / Treatment Type
            </button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Procedure / Treatment Type</th>
                  <th class="text-right">Default Fee ($)</th>
                  <th>Clinical Particulars / Description</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(t => `
                  <tr>
                    <td style="font-weight: 700; color: #059669; font-size: 0.82rem;">${t.id}</td>
                    <td style="font-weight: 700; color: #0f172a;">${t.name}</td>
                    <td class="text-right" style="font-weight: 800; color: #059669; font-size: 0.95rem;">
                      $${(parseFloat(t.defaultCharge) || 0).toFixed(2)}
                    </td>
                    <td style="font-size: 0.82rem; color: #475569;">${t.description || '-'}</td>
                    <td class="text-center" style="white-space: nowrap;">
                      <button class="btn btn-outline btn-sm btn-edit-catalog-item" data-type="procedure-type" data-id="${t.id}" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 4px;">
                        ✏️ Edit
                      </button>
                      <button class="btn btn-danger btn-sm btn-delete-catalog-item" data-type="procedure-type" data-id="${t.id}" style="padding: 3px 8px; font-size: 0.75rem;">
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      case 'admin-route': {
        const list = pharmacyDB.getAdministrationRoutes ? pharmacyDB.getAdministrationRoutes() : [];
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0;">Administration Route (${list.length})</h3>
              <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Anatomical drug delivery pathways (Oral, Intramuscular, IV, Topical, Inhalation).</p>
            </div>
            <button class="btn btn-success btn-sm btn-add-catalog-item" data-type="admin-route">
              ${getIcon('plus')} Add Administration Route
            </button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Route Name</th>
                  <th>Abbreviation</th>
                  <th>Description</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(r => `
                  <tr>
                    <td style="font-weight: 700; color: #ea580c; font-size: 0.82rem;">${r.id}</td>
                    <td style="font-weight: 700; color: #0f172a;">${r.name}</td>
                    <td><span style="font-size: 0.75rem; font-weight: 700; background: #ffedd5; color: #c2410c; padding: 2px 8px; border-radius: 4px;">${r.code || 'ROUTE'}</span></td>
                    <td style="font-size: 0.82rem; color: #475569;">${r.description || '-'}</td>
                    <td class="text-center" style="white-space: nowrap;">
                      <button class="btn btn-outline btn-sm btn-edit-catalog-item" data-type="admin-route" data-id="${r.id}" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 4px;">
                        ✏️ Edit
                      </button>
                      <button class="btn btn-danger btn-sm btn-delete-catalog-item" data-type="admin-route" data-id="${r.id}" style="padding: 3px 8px; font-size: 0.75rem;">
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      case 'status-opt': {
        const list = pharmacyDB.getStatuses ? pharmacyDB.getStatuses() : [];
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0;">Status Options * (${list.length})</h3>
              <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">State workflows and badge colors for Clinical Treatments, Inventory, and Orders.</p>
            </div>
            <button class="btn btn-success btn-sm btn-add-catalog-item" data-type="status-opt">
              ${getIcon('plus')} Add Status Option
            </button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status Name</th>
                  <th>Scope / Module</th>
                  <th>Badge Preview</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(s => `
                  <tr>
                    <td style="font-weight: 700; color: #0284c7; font-size: 0.82rem;">${s.id}</td>
                    <td style="font-weight: 700; color: #0f172a;">${s.label || s.name}</td>
                    <td>
                      <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px;">
                        ${s.scope || 'general'}
                      </span>
                    </td>
                    <td>
                      <span style="font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 12px; background: ${s.badgeColor || '#6366f1'}; color: ${s.textColor || '#ffffff'};">
                        ● ${s.name}
                      </span>
                    </td>
                    <td class="text-center" style="white-space: nowrap;">
                      <button class="btn btn-outline btn-sm btn-edit-catalog-item" data-type="status-opt" data-id="${s.id}" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 4px;">
                        ✏️ Edit
                      </button>
                      <button class="btn btn-danger btn-sm btn-delete-catalog-item" data-type="status-opt" data-id="${s.id}" style="padding: 3px 8px; font-size: 0.75rem;">
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
      default: return '';
    }
  },

  /* -------------------------------------------------------------
   * SECTION 5: Tax System Value Setup (Developer Login)
   * ------------------------------------------------------------- */
  renderTaxSystemSection() {
    const tax = pharmacyDB.getTaxSettings ? pharmacyDB.getTaxSettings() : { enabled: true, taxName: 'VAT', defaultRate: 13, slabs: [] };
    const slabs = tax.slabs || [];

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Card 1: Universal Tax Engine Values -->
        <div class="app-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0;">Universal Tax System & Value Setup</h2>
              <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Configure statutory sales tax, VAT, GST calculation mode, and global defaults.</p>
            </div>
            <button class="btn btn-primary" id="btn-save-tax-settings">
              💾 Save Tax System Configuration
            </button>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Tax System Status:</label>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                <input type="checkbox" id="tax-sys-enabled" ${tax.enabled ? 'checked' : ''} style="width: 20px; height: 20px;">
                <label for="tax-sys-enabled" style="font-weight: 700; font-size: 0.85rem; color: #0f172a; cursor: pointer;">
                  Enable Automatic Tax Calculation
                </label>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Tax Nomenclature / Name *:</label>
              <input type="text" id="tax-sys-name" class="form-control" value="${tax.taxName || 'VAT'}" placeholder="e.g. VAT, GST, Sales Tax" required>
            </div>

            <div class="form-group">
              <label class="form-label">Default Statutory Rate (%) *:</label>
              <input type="number" step="0.01" min="0" max="100" id="tax-sys-rate" class="form-control" value="${tax.defaultRate !== undefined ? tax.defaultRate : 13}" required>
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Default Calculation Method:</label>
              <select id="tax-sys-method" class="form-control">
                <option value="exclusive" ${(tax.calculationMethod || 'exclusive') === 'exclusive' ? 'selected' : ''}>Tax Exclusive (Add Tax on Subtotal)</option>
                <option value="inclusive" ${(tax.calculationMethod || 'exclusive') === 'inclusive' ? 'selected' : ''}>Tax Inclusive (Prices include Tax)</option>
                <option value="exempt" ${(tax.calculationMethod || 'exclusive') === 'exempt' ? 'selected' : ''}>Tax Exempt System-wide</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Tax / VAT Registration #:</label>
              <input type="text" id="tax-sys-reg" class="form-control" value="${tax.regNumber || ''}" placeholder="e.g. VAT-9021-RX or GSTIN">
            </div>

            <div class="form-group">
              <label class="form-label">Receipt Tax Disclosure Note:</label>
              <input type="text" id="tax-sys-note" class="form-control" value="${tax.taxDisclosure || 'All prices subject to statutory VAT regulations.'}" placeholder="Receipt footer tax notice">
            </div>
          </div>
        </div>

        <!-- Card 2: Tax Slabs & Preset Brackets Master (Add / Edit / Delete) -->
        <div class="app-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0;">Tax Slabs & Preset Brackets (${slabs.length})</h3>
              <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Pre-configured tax percentages selectable when adding or editing products in inventory.</p>
            </div>
            <button class="btn btn-success btn-sm" id="btn-add-tax-slab">
              ${getIcon('plus')} Add New Tax Slab
            </button>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Slab ID</th>
                  <th>Slab Name / Description</th>
                  <th class="text-right">Tax Rate (%)</th>
                  <th>Applicable Scope</th>
                  <th>Default</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${slabs.map(s => `
                  <tr>
                    <td style="font-weight: 700; color: #0284c7; font-size: 0.82rem;">${s.id}</td>
                    <td style="font-weight: 700; color: #0f172a;">${s.name}</td>
                    <td class="text-right" style="font-weight: 800; font-size: 0.95rem; color: #0284c7;">
                      ${s.rate}%
                    </td>
                    <td style="font-size: 0.82rem; color: #475569;">${s.description || '-'}</td>
                    <td>
                      ${s.isDefault ? '<span style="font-size: 0.72rem; background: #ecfdf5; color: #047857; padding: 2px 8px; border-radius: 12px; font-weight: 700;">★ Default</span>' : '<span style="color: #94a3b8; font-size: 0.72rem;">Optional</span>'}
                    </td>
                    <td class="text-center" style="white-space: nowrap;">
                      <button class="btn btn-outline btn-sm btn-edit-tax-slab" data-id="${s.id}" style="padding: 3px 8px; font-size: 0.75rem; margin-right: 4px;">
                        ✏️ Edit
                      </button>
                      <button class="btn btn-danger btn-sm btn-delete-tax-slab" data-id="${s.id}" style="padding: 3px 8px; font-size: 0.75rem;">
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * EVENT BINDINGS FOR DEVELOPER HUB
   * ------------------------------------------------------------- */
  bindHubSectionEvents() {
    // 4 Architecture Tile Switching
    document.querySelectorAll('.dev-hub-tile').forEach(tile => {
      tile.addEventListener('click', async () => {
        const section = tile.getAttribute('data-hub-section');

        if (section === 'media') {
          const result = await App.syncMediaLibraryFromServer();
          if (!result.success) {
            App.showToast('Could not refresh server media. Check the connection and try again.', 'warning');
          }
        }

        this.renderDeveloperHub(section);
      });
    });

    // SECTION 1: Staff & Dynamic Governance Events
    const createStaffBtn = document.getElementById('btn-create-staff-hub');
    if (createStaffBtn) {
      createStaffBtn.addEventListener('click', () => this.showAddEditStaffModal(null));
    }

    const toggleAuditBtn = document.getElementById('btn-toggle-audit-view');
    if (toggleAuditBtn) {
      toggleAuditBtn.addEventListener('click', async () => {
        this.staffSubView = 'audit';
        await this.loadAuditLogs();
        this.renderDeveloperHub('staff');
      });
    }

    const backToStaffBtn = document.getElementById('btn-back-to-staff');
    if (backToStaffBtn) {
      backToStaffBtn.addEventListener('click', () => {
        this.staffSubView = 'accounts';
        this.renderDeveloperHub('staff');
      });
    }

    const refreshAuditBtn = document.getElementById('btn-refresh-audit-logs');
    if (refreshAuditBtn) {
      refreshAuditBtn.addEventListener('click', async () => {
        await this.loadAuditLogs();
        this.renderDeveloperHub('staff');
      });
    }

    const refreshStaffBtn = document.getElementById('btn-refresh-server-staff');
    if (refreshStaffBtn) {
      refreshStaffBtn.addEventListener('click', async () => {
        await this.loadServerStaff();
        this.renderDeveloperHub('staff');
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Staff accounts synchronized with database.', 'info');
        }
      });
    }

    document.querySelectorAll('.btn-edit-staff-hub').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-staff-id');
        const staff = (this.serverStaffList || []).find(s => s.id === id) ||
          (pharmacyDB.data.staffMembers || []).find(s => s.id === id);
        this.showAddEditStaffModal(staff);
      });
    });

    document.querySelectorAll('.btn-manage-overrides-hub').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-staff-id');
        const staff = (this.serverStaffList || []).find(s => s.id === id) ||
          (pharmacyDB.data.staffMembers || []).find(s => s.id === id);
        this.showPermissionsOverrideModal(staff);
      });
    });

    document.querySelectorAll('.btn-provision-candidate').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-candidate-id');
        const candidate = (pharmacyDB.data.staffMembers || []).find(s => s.id === id);
        if (!candidate) return;

        if (!confirm(`Provision server-authoritative account for "${candidate.name}" (@${candidate.username})?\n\nA single-use 12-character temporary password will be generated, and mandatory password reset will be required upon initial login.`)) {
          return;
        }

        const roleIdMap = {
          pharmacist: 'role_pharmacist',
          accountant: 'role_accountant',
          developer: 'role_dev',
          cashier: 'role_cashier',
        };

        btn.disabled = true;
        btn.textContent = 'Provisioning...';

        const res = await this.apiRequest('/api/admin/staff/provision', {
          method: 'POST',
          body: JSON.stringify({
            username: candidate.username,
            name: candidate.name,
            roleId: roleIdMap[candidate.role] || 'role_pharmacist',
            roleTitle: candidate.roleTitle,
            email: candidate.email,
            phone: candidate.phone,
            avatar: candidate.avatar,
          }),
        });

        if (res.ok && res.data && res.data.temporaryPassword) {
          this.showTemporaryPasswordModal(candidate.username, res.data.temporaryPassword);
        } else {
          alert(res.data?.message || 'Failed to provision staff account.');
        }

        await this.loadServerStaff();
        this.renderDeveloperHub('staff');
      });
    });

    document.querySelectorAll('.btn-delete-staff-hub').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-staff-id');
        const staff = (this.serverStaffList || []).find(s => s.id === id) ||
          (pharmacyDB.data.staffMembers || []).find(s => s.id === id);
        const name = staff ? staff.name : 'this staff member';

        if (confirm(`Are you sure you want to deactivate account for ${name}? Active sessions will be terminated.`)) {
          try {
            const res = await this.apiRequest(`/api/admin/staff/${id}`, {
              method: 'PUT',
              body: JSON.stringify({ status: 'inactive' }),
            });

            pharmacyDB.deleteStaffMember(id);
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast(`Staff account ${name} deactivated.`, 'info');
            }
            await this.loadServerStaff();
            this.renderDeveloperHub('staff');
          } catch (e) {
            alert(e.message);
          }
        }
      });
    });

    // SECTION 2: Global UI Events
    // -------------------------------------------------------------
    // Helper to update live color elements
    const updateGlobalThemePreview = (pri, sec) => {
      if (!pri.startsWith('#')) pri = '#' + pri;
      if (!sec.startsWith('#')) sec = '#' + sec;

      const paletteBar = document.getElementById('glob-palette-bar');
      if (paletteBar) paletteBar.style.background = `linear-gradient(135deg, ${pri} 0%, ${sec} 100%)`;

      const priLabel = document.getElementById('label-pri-hex');
      if (priLabel) priLabel.textContent = pri;
      const secLabel = document.getElementById('label-sec-hex');
      if (secLabel) secLabel.textContent = sec;

      const logoBox = document.getElementById('glob-logo-box-preview');
      if (logoBox) {
        logoBox.style.background = 'transparent';
        logoBox.style.boxShadow = 'none';
        logoBox.style.border = 'none';
      }

      const prevLogo = document.getElementById('prev-glob-logo');
      if (prevLogo) {
        prevLogo.style.background = 'transparent';
        prevLogo.style.boxShadow = 'none';
        prevLogo.style.border = 'none';
        prevLogo.style.color = pri;
      }

      const prevText = document.getElementById('glob-logo-preview-text');
      if (prevText) prevText.style.color = pri;

      const sampleBtn = document.getElementById('prev-sample-btn');
      if (sampleBtn) {
        sampleBtn.style.background = pri;
        sampleBtn.style.borderColor = pri;
      }

      const sampleBadge = document.getElementById('prev-sample-badge');
      if (sampleBadge) {
        sampleBadge.style.background = `${sec}20`;
        sampleBadge.style.color = sec;
      }

      const saveBtn = document.getElementById('btn-save-global-settings');
      if (saveBtn) {
        saveBtn.style.background = pri;
        saveBtn.style.borderColor = pri;
      }

      const uploadTriggerBtn = document.getElementById('btn-trigger-logo-upload');
      if (uploadTriggerBtn) {
        uploadTriggerBtn.style.background = pri;
        uploadTriggerBtn.style.borderColor = pri;
      }
    };

    // Primary Color Hex & Picker Two-Way Sync
    const priPicker = document.getElementById('glob-primary-picker');
    const priHex = document.getElementById('glob-primary-hex');
    const secPicker = document.getElementById('glob-secondary-picker');
    const secHex = document.getElementById('glob-secondary-hex');

    if (priPicker && priHex) {
      priPicker.addEventListener('input', (e) => {
        priHex.value = e.target.value.toUpperCase();
        updateGlobalThemePreview(priHex.value, secHex ? secHex.value : '#0f766e');
      });
      priHex.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#') && val.length > 0) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          priPicker.value = val;
          updateGlobalThemePreview(val, secHex ? secHex.value : '#0f766e');
        }
      });
    }

    // Secondary Color Hex & Picker Two-Way Sync
    if (secPicker && secHex) {
      secPicker.addEventListener('input', (e) => {
        secHex.value = e.target.value.toUpperCase();
        updateGlobalThemePreview(priHex ? priHex.value : '#0284c7', secHex.value);
      });
      secHex.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#') && val.length > 0) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          secPicker.value = val;
          updateGlobalThemePreview(priHex ? priHex.value : '#0284c7', val);
        }
      });
    }

    // Primary Swatches
    document.querySelectorAll('.btn-pri-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.getAttribute('data-hex');
        if (priPicker) priPicker.value = hex;
        if (priHex) priHex.value = hex.toUpperCase();
        updateGlobalThemePreview(hex, secHex ? secHex.value : '#0f766e');
      });
    });

    // Secondary Swatches
    document.querySelectorAll('.btn-sec-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.getAttribute('data-hex');
        if (secPicker) secPicker.value = hex;
        if (secHex) secHex.value = hex.toUpperCase();
        updateGlobalThemePreview(priHex ? priHex.value : '#0284c7', hex);
      });
    });

    // =============================================================
    // DUAL LOGOS & FALLBACK LOGO HANDLERS (Section 2)
    // =============================================================

    // 1. COLOURED LOGO (Light Backgrounds: Receipts & Login)
    const coloredFile = document.getElementById('glob-colored-file');
    const btnUploadColored = document.getElementById('btn-upload-colored');
    const btnMediaColored = document.getElementById('btn-media-colored');
    const btnResetColored = document.getElementById('btn-reset-colored');

    const updateColoredLogoDisplay = (path, dataUrl) => {
      document.getElementById('glob-colored-path').value = path;
      document.getElementById('glob-colored-data').value = dataUrl || '';
      const textPath = document.getElementById('text-colored-path');
      if (textPath) textPath.textContent = path;

      const prev = document.getElementById('preview-colored-img');
      if (prev) prev.src = dataUrl || path;

      // Update Live Previews for Light Backgrounds
      const prevReceipt = document.getElementById('prev-receipt-logo');
      if (prevReceipt) prevReceipt.src = dataUrl || path;

      const prevLogin = document.getElementById('prev-login-logo');
      if (prevLogin) prevLogin.src = dataUrl || path;
    };

    if (btnUploadColored && coloredFile) {
      btnUploadColored.addEventListener('click', (e) => {
        e.stopPropagation();
        coloredFile.click();
      });
      coloredFile.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          try {
            App.showToast('Uploading coloured logo to server...', 'info');
            const res = await App.uploadImageFile(e.target.files[0]);
            updateColoredLogoDisplay(res.path, res.dataUrl);
            App.showToast(`Coloured Logo saved to ${res.path}!`, 'success');
          } catch (err) {
            alert(err.message);
          } finally {
            coloredFile.value = '';
          }
        }
      });
    }

    if (btnMediaColored) {
      btnMediaColored.addEventListener('click', () => {
        App.openMediaPickerModal({
          title: 'Select Coloured Logo (Light Backgrounds)',
          onSelect: (item) => {
            updateColoredLogoDisplay(item.path, item.dataUrl);
            App.showToast(`Selected ${item.filename} as Coloured Logo!`, 'success');
          }
        });
      });
    }

    if (btnResetColored) {
      btnResetColored.addEventListener('click', () => {
        const def = 'website_images/default-logo-colored.svg';
        updateColoredLogoDisplay(def, '');
        App.showToast('Reset to default Coloured SVG logo', 'info');
      });
    }

    // 2. WHITE LOGO (Dark Backgrounds: Sidebar #0f172a)
    const whiteFile = document.getElementById('glob-white-file');
    const btnUploadWhite = document.getElementById('btn-upload-white');
    const btnMediaWhite = document.getElementById('btn-media-white');
    const btnResetWhite = document.getElementById('btn-reset-white');

    const updateWhiteLogoDisplay = (path, dataUrl) => {
      document.getElementById('glob-white-path').value = path;
      document.getElementById('glob-white-data').value = dataUrl || '';
      const textPath = document.getElementById('text-white-path');
      if (textPath) textPath.textContent = path;

      const prev = document.getElementById('preview-white-img');
      if (prev) prev.src = dataUrl || path;

      // Update Live Preview for Sidebar (Dark Background)
      const prevSidebar = document.getElementById('prev-sidebar-logo');
      if (prevSidebar) {
        prevSidebar.innerHTML = `<img src="${dataUrl || path}" alt="White Logo" style="width: 100%; height: 100%; object-fit: contain; border: none; box-shadow: none;">`;
      }
    };

    if (btnUploadWhite && whiteFile) {
      btnUploadWhite.addEventListener('click', (e) => {
        e.stopPropagation();
        whiteFile.click();
      });
      whiteFile.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          try {
            App.showToast('Uploading white logo to server...', 'info');
            const res = await App.uploadImageFile(e.target.files[0]);
            updateWhiteLogoDisplay(res.path, res.dataUrl);
            App.showToast(`White Logo saved to ${res.path}!`, 'success');
          } catch (err) {
            alert(err.message);
          } finally {
            whiteFile.value = '';
          }
        }
      });
    }

    if (btnMediaWhite) {
      btnMediaWhite.addEventListener('click', () => {
        App.openMediaPickerModal({
          title: 'Select White Logo (Dark Backgrounds)',
          onSelect: (item) => {
            updateWhiteLogoDisplay(item.path, item.dataUrl);
            App.showToast(`Selected ${item.filename} as White Logo!`, 'success');
          }
        });
      });
    }

    if (btnResetWhite) {
      btnResetWhite.addEventListener('click', () => {
        const def = 'website_images/default-logo-white.svg';
        updateWhiteLogoDisplay(def, '');
        App.showToast('Reset to default White SVG logo', 'info');
      });
    }

    // 3. FALLBACK LOGO (Image or Text Emblem)
    const choiceFbImage = document.getElementById('choice-fallback-image');
    const choiceFbText = document.getElementById('choice-fallback-text');
    const wrapFbImage = document.getElementById('wrap-fallback-image');
    const wrapFbText = document.getElementById('wrap-fallback-text');
    const prevFbDisplay = document.getElementById('prev-fallback-display');

    const updateFallbackDisplay = () => {
      const isImg = choiceFbImage ? choiceFbImage.checked : true;
      if (wrapFbImage) wrapFbImage.style.display = isImg ? 'block' : 'none';
      if (wrapFbText) wrapFbText.style.display = isImg ? 'none' : 'block';

      if (prevFbDisplay) {
        if (isImg) {
          const path = document.getElementById('glob-fallback-data')?.value || document.getElementById('glob-fallback-path')?.value || 'website_images/default-logo-fallback.svg';
          prevFbDisplay.innerHTML = `<img src="${path}" alt="Fallback" style="width: 100%; height: 100%; object-fit: contain;">`;
        } else {
          const txt = document.getElementById('glob-logo')?.value || 'Rx';
          prevFbDisplay.textContent = txt;
        }
      }
    };

    if (choiceFbImage) choiceFbImage.addEventListener('change', updateFallbackDisplay);
    if (choiceFbText) choiceFbText.addEventListener('change', updateFallbackDisplay);

    const fallbackFile = document.getElementById('glob-fallback-file');
    const btnUploadFallback = document.getElementById('btn-upload-fallback');
    const btnMediaFallback = document.getElementById('btn-media-fallback');
    const btnResetFallback = document.getElementById('btn-reset-fallback');

    const updateFallbackImage = (path, dataUrl) => {
      document.getElementById('glob-fallback-path').value = path;
      document.getElementById('glob-fallback-data').value = dataUrl || '';
      const textPath = document.getElementById('text-fallback-path');
      if (textPath) textPath.textContent = path;

      const prev = document.getElementById('preview-fallback-img');
      if (prev) prev.src = dataUrl || path;

      updateFallbackDisplay();
    };

    if (btnUploadFallback && fallbackFile) {
      btnUploadFallback.addEventListener('click', (e) => {
        e.stopPropagation();
        fallbackFile.click();
      });
      fallbackFile.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          try {
            App.showToast('Uploading fallback logo to server...', 'info');
            const res = await App.uploadImageFile(e.target.files[0]);
            updateFallbackImage(res.path, res.dataUrl);
            App.showToast(`Fallback Logo stored in ${res.path}!`, 'success');
          } catch (err) {
            alert(err.message);
          } finally {
            fallbackFile.value = '';
          }
        }
      });
    }

    if (btnMediaFallback) {
      btnMediaFallback.addEventListener('click', () => {
        App.openMediaPickerModal({
          title: 'Select Fallback Logo Image',
          onSelect: (item) => {
            updateFallbackImage(item.path, item.dataUrl);
            App.showToast(`Selected ${item.filename} as Fallback Logo!`, 'success');
          }
        });
      });
    }

    if (btnResetFallback) {
      btnResetFallback.addEventListener('click', () => {
        const def = 'website_images/default-logo-fallback.svg';
        updateFallbackImage(def, '');
        App.showToast('Reset to default Fallback SVG logo', 'info');
      });
    }

    const textLogoInput = document.getElementById('glob-logo');
    if (textLogoInput) {
      textLogoInput.addEventListener('input', () => {
        if (choiceFbText && choiceFbText.checked) {
          updateFallbackDisplay();
        }
      });
    }

    // Save Global Settings
    const saveGlobalBtn = document.getElementById('btn-save-global-settings');
    if (saveGlobalBtn) {
      saveGlobalBtn.addEventListener('click', () => {
        const name = document.getElementById('glob-name').value.trim();
        const tagline = document.getElementById('glob-tagline').value.trim();
        const logo = document.getElementById('glob-logo').value.trim() || 'Rx';
        const phone = document.getElementById('glob-phone').value.trim();
        const email = document.getElementById('glob-email').value.trim();
        const contacts = document.getElementById('glob-contacts').value.trim() || `${phone} | ${email}`;
        const address = document.getElementById('glob-address').value.trim();
        const greetingMessage = document.getElementById('glob-greeting').value.trim();

        let primaryColor = document.getElementById('glob-primary-hex').value.trim() || '#0284c7';
        if (!primaryColor.startsWith('#')) primaryColor = '#' + primaryColor;

        let secondaryColor = document.getElementById('glob-secondary-hex').value.trim() || '#0f766e';
        if (!secondaryColor.startsWith('#')) secondaryColor = '#' + secondaryColor;

        const logoColored = document.getElementById('glob-colored-path').value.trim();
        const logoColoredData = document.getElementById('glob-colored-data').value.trim();
        const logoWhite = document.getElementById('glob-white-path').value.trim();
        const logoWhiteData = document.getElementById('glob-white-data').value.trim();
        const fallbackLogoImage = document.getElementById('glob-fallback-path').value.trim();
        const fallbackLogoData = document.getElementById('glob-fallback-data').value.trim();
        const fallbackType = document.getElementById('choice-fallback-image')?.checked ? 'image' : 'text';

        if (!name) {
          alert('Pharmacy Name is required.');
          return;
        }

        pharmacyDB.updateGlobalSettings({
          name,
          tagline,
          logo,
          phone,
          email,
          contacts,
          address,
          greetingMessage,
          primaryColor,
          secondaryColor,
          logoColored,
          logoColoredData,
          logoWhite,
          logoWhiteData,
          fallbackLogoImage,
          fallbackLogoData,
          fallbackType,
          logoImage: logoColored,
          logoData: logoColoredData,
          logoType: 'image'
        });

        // Apply theme colors globally
        App.applyThemeColors(primaryColor, secondaryColor);

        // Update active sidebar and login DOM elements immediately
        const brandTitle = document.querySelector('.brand-text h1');
        if (brandTitle) brandTitle.textContent = name;
        if (typeof App !== 'undefined' && App.refreshBrandLogos) {
          App.refreshBrandLogos();
        }
        if (typeof App !== 'undefined' && App.saveLogoSettingsToServer) {
          App.saveLogoSettingsToServer({
            pharmacyName: name,
            logoColored,
            logoWhite,
            fallbackLogoImage,
            logoType: 'image'
          });
        }
        const brandTagline = document.querySelector('.brand-text p');
        if (brandTagline) brandTagline.textContent = tagline;

        App.showToast('Universal (Global) settings, dual logos, and hex colors saved successfully!', 'success');
        this.renderDeveloperHub('global');
      });
    }

    // SECTION 3: Page UI Events
    // -------------------------------------------------------------
    const pagePriPicker = document.getElementById('page-primary-picker');
    const pagePriHex = document.getElementById('page-primary-hex');
    const pageSecPicker = document.getElementById('page-secondary-picker');
    const pageSecHex = document.getElementById('page-secondary-hex');

    if (pagePriPicker && pagePriHex) {
      pagePriPicker.addEventListener('input', (e) => pagePriHex.value = e.target.value.toUpperCase());
      pagePriHex.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#') && val.length > 0) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) pagePriPicker.value = val;
      });
    }

    if (pageSecPicker && pageSecHex) {
      pageSecPicker.addEventListener('input', (e) => pageSecHex.value = e.target.value.toUpperCase());
      pageSecHex.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#') && val.length > 0) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) pageSecPicker.value = val;
      });
    }

    document.querySelectorAll('.btn-page-theme-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const pri = chip.getAttribute('data-pri');
        const sec = chip.getAttribute('data-sec');
        if (pagePriPicker) pagePriPicker.value = pri;
        if (pagePriHex) pagePriHex.value = pri.toUpperCase();
        if (pageSecPicker) pageSecPicker.value = sec;
        if (pageSecHex) pageSecHex.value = sec.toUpperCase();
      });
    });

    const savePageUiBtn = document.getElementById('btn-save-page-ui-settings');
    if (savePageUiBtn) {
      savePageUiBtn.addEventListener('click', () => {
        let primaryColor = (document.getElementById('page-primary-hex')?.value || '#0284c7').trim();
        if (!primaryColor.startsWith('#')) primaryColor = '#' + primaryColor;

        let secondaryColor = (document.getElementById('page-secondary-hex')?.value || '#0f766e').trim();
        if (!secondaryColor.startsWith('#')) secondaryColor = '#' + secondaryColor;

        const showTestCredentials = document.getElementById('page-login-show-creds').checked;
        const defaultView = document.getElementById('page-ui-default-view').value;
        const maxDiscountPercent = parseFloat(document.getElementById('page-ui-max-discount').value) || 15;
        const thermalReceiptFooter = document.getElementById('page-ui-receipt-footer').value.trim();
        const requireDoctorForRx = document.getElementById('page-ui-rx-doctor').checked;
        const enableHoldTickets = document.getElementById('page-ui-enable-hold').checked;

        pharmacyDB.updateLoginPageSettings({
          primaryColor,
          secondaryColor,
          accentColor: primaryColor,
          showTestCredentials
        });

        // Also update globalSettings colors so it reflects everywhere
        pharmacyDB.updateGlobalSettings({
          primaryColor,
          secondaryColor
        });

        pharmacyDB.updateStaffUiSettings({
          defaultView,
          maxDiscountPercent,
          thermalReceiptFooter,
          requireDoctorForRx,
          enableHoldTickets
        });

        App.applyThemeColors(primaryColor, secondaryColor);
        App.showToast('Page UI & POS Workflow settings saved!', 'success');
        this.renderDeveloperHub('page');
      });
    }

    // SECTION 4: Database Events
    const recalcBtn = document.getElementById('db-recalc-btn');
    if (recalcBtn) {
      recalcBtn.addEventListener('click', () => {
        pharmacyDB.recalculateAllAccountBalances();
        App.showToast('All ledger balances recalculated from general journal!', 'success');
        this.renderDeveloperHub('database');
      });
    }

    const exportRawBtn = document.getElementById('db-export-json-btn');
    if (exportRawBtn) {
      exportRawBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(pharmacyDB.exportDataJson());
        const a = document.createElement('a');
        a.setAttribute("href", dataStr);
        a.setAttribute("download", `bagan-medical-hall-backup-${Date.now()}.json`);
        a.click();
        a.remove();
        App.showToast('Database JSON backup downloaded!', 'success');
      });
    }

    const factoryResetBtn = document.getElementById('db-factory-reset-btn');
    if (factoryResetBtn) {
      factoryResetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to factory reset all data to default demo state? Any custom additions will be reverted.')) {
          pharmacyDB.resetToDemo();
          App.showToast('Database reset to clean factory demo state', 'info');
          this.renderDeveloperHub('database');
        }
      });
    }

    // =============================================================
    // SECTION 4: Media Center Event Handlers
    // =============================================================
    const mcUploadBtn = document.getElementById('btn-media-center-upload');
    const mcFileInput = document.getElementById('media-center-file-input');
    const mcDropzone = document.getElementById('media-center-dropzone');
    const mcSearchInput = document.getElementById('media-center-search');

    const handleUploadFiles = async (filesList) => {
      if (!filesList || filesList.length === 0) return;
      try {
        App.showToast(`Uploading ${filesList.length} image(s) to the server...`, 'info');
        for (let i = 0; i < filesList.length; i++) {
          await App.uploadImageFile(filesList[i]);
        }
        App.showToast(`Successfully uploaded ${filesList.length} image(s) to the server!`, 'success');
        this.renderDeveloperHub('media');
      } catch (err) {
        App.showToast(err.message || 'Image upload failed.', 'error');
      } finally {
        if (mcFileInput) mcFileInput.value = '';
      }
    };

    if (mcUploadBtn && mcFileInput) {
      mcUploadBtn.addEventListener('click', () => mcFileInput.click());
      mcFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleUploadFiles(Array.from(e.target.files));
        }
      });
    }

    if (mcDropzone && mcFileInput) {
      mcDropzone.addEventListener('click', () => mcFileInput.click());
      mcDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        mcDropzone.style.borderColor = '#0284c7';
        mcDropzone.style.background = '#f0f9ff';
      });
      mcDropzone.addEventListener('dragleave', () => {
        mcDropzone.style.borderColor = '#94a3b8';
        mcDropzone.style.background = '#f8fafc';
      });
      mcDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        mcDropzone.style.borderColor = '#94a3b8';
        mcDropzone.style.background = '#f8fafc';
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleUploadFiles(Array.from(e.dataTransfer.files));
        }
      });
    }

    if (mcSearchInput) {
      mcSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('#media-center-grid .media-card').forEach(card => {
          const fn = card.getAttribute('data-filename') || '';
          card.style.display = fn.includes(query) ? 'flex' : 'none';
        });
      });
    }

    // Assign as Coloured Logo from Media Center
    document.querySelectorAll('.btn-assign-colored').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-path');
        const dataUrl = btn.getAttribute('data-dataurl') || '';
        pharmacyDB.updateGlobalSettings({
          logoColored: path,
          logoColoredData: dataUrl,
          logoImage: path,
          logoData: dataUrl,
          logoType: 'image'
        });
        if (typeof App !== 'undefined' && App.refreshBrandLogos) App.refreshBrandLogos();
        if (typeof App !== 'undefined' && App.saveLogoSettingsToServer) {
          App.saveLogoSettingsToServer({
            logoColored: path,
            logoWhite: pharmacyDB.data.globalSettings.logoWhite,
            fallbackLogoImage: pharmacyDB.data.globalSettings.fallbackLogoImage,
            logoType: 'image'
          });
        }
        App.showToast(`Set ${path} as Coloured Logo!`, 'success');
        this.renderDeveloperHub('media');
      });
    });

    // Assign as White Logo from Media Center
    document.querySelectorAll('.btn-assign-white').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-path');
        const dataUrl = btn.getAttribute('data-dataurl') || '';
        pharmacyDB.updateGlobalSettings({
          logoWhite: path,
          logoWhiteData: dataUrl,
          logoType: 'image'
        });
        // Update logos immediately
        if (typeof App !== 'undefined' && App.refreshBrandLogos) App.refreshBrandLogos();
        if (typeof App !== 'undefined' && App.saveLogoSettingsToServer) {
          App.saveLogoSettingsToServer({
            logoWhite: path,
            logoColored: pharmacyDB.data.globalSettings.logoColored,
            fallbackLogoImage: pharmacyDB.data.globalSettings.fallbackLogoImage,
            logoType: 'image'
          });
        }
        App.showToast(`Set ${path} as White Logo!`, 'success');
        this.renderDeveloperHub('media');
      });
    });

    // Assign as Fallback Logo from Media Center
    document.querySelectorAll('.btn-assign-fallback').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-path');
        const dataUrl = btn.getAttribute('data-dataurl') || '';
        pharmacyDB.updateGlobalSettings({
          fallbackLogoImage: path,
          fallbackLogoData: dataUrl,
          fallbackType: 'image'
        });
        if (typeof App !== 'undefined' && App.refreshBrandLogos) App.refreshBrandLogos();
        if (typeof App !== 'undefined' && App.saveLogoSettingsToServer) {
          App.saveLogoSettingsToServer({
            fallbackLogoImage: path,
            logoColored: pharmacyDB.data.globalSettings.logoColored,
            logoWhite: pharmacyDB.data.globalSettings.logoWhite,
            logoType: 'image'
          });
        }
        App.showToast(`Set ${path} as Fallback Logo Image!`, 'success');
        this.renderDeveloperHub('media');
      });
    });

    // Copy Media Path to clipboard
    document.querySelectorAll('.btn-copy-media-path').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-path');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(path).then(() => {
            App.showToast(`Copied path: ${path}`, 'success');
          });
        } else {
          prompt('Copy image path:', path);
        }
      });
    });

    // Delete Media Asset (Developer & Super Admin with mediaDelete permission)
    document.querySelectorAll('.btn-delete-media-hub').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filename = btn.getAttribute('data-filename');
        const id = btn.getAttribute('data-id');
        if (!filename) return;

        if (!confirm(`Are you sure you want to permanently delete "${filename}"?\n\nThis will remove the file from server storage. Any referenced logos or catalog images will be protected.`)) {
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Deleting...';

        try {
          const res = await App.deleteMediaFile(filename, id);
          if (res && res.success) {
            App.showToast(`Media "${filename}" deleted permanently.`, 'success');
            await App.syncMediaLibraryFromServer();
            this.renderDeveloperHub('media');
          }
        } catch (err) {
          alert(`Deletion Failed:\n${err.message}`);
          btn.disabled = false;
          btn.textContent = '🗑️ Delete Asset';
        }
      });
    });

    // Refresh authenticated server media library
    const mcSyncBtn = document.getElementById('btn-sync-media-folder');
    if (mcSyncBtn) {
      mcSyncBtn.addEventListener('click', async () => {
        App.showToast('Refreshing server media library...', 'info');
        const res = await App.syncMediaLibraryFromServer();
        if (res && res.success) {
          App.showToast(`Refreshed ${res.count} server media file(s).`, 'success');
        } else {
          App.showToast(res && res.authRequired ? 'Administrator login is required to view server media.' : 'Could not refresh server media. Check the API connection.', 'warning');
        }
        this.renderDeveloperHub('media');
      });
    }

    // Server Connectivity Check
    const mcCheckServerBtn = document.getElementById('btn-check-server-status');
    if (mcCheckServerBtn) {
      mcCheckServerBtn.addEventListener('click', async () => {
        App.showToast('Checking API and database status...', 'info');
        const stat = await App.checkServerStatus();
        const dot = document.getElementById('media-status-dot');
        const text = document.getElementById('media-status-text');
        if (stat && stat.online) {
          if (dot) dot.style.background = '#16a34a';
          if (text) text.textContent = 'Connected to the Bagan Medical Hall API. Database: ' + stat.database + '.';
          App.showToast('API is online and database is connected.', 'success');
        } else {
          if (dot) dot.style.background = '#f59e0b';
          if (text) text.textContent = 'API is unavailable. Check the cPanel Node.js application and database connection.';
          App.showToast('API is unavailable. Check the server application.', 'warning');
        }
      });
    }

    // Direct Folder Connection via File System Access API
    const mcPickFolderBtn = document.getElementById('btn-pick-media-folder');
    if (mcPickFolderBtn) {
      mcPickFolderBtn.addEventListener('click', async () => {
        const res = await App.connectLocalImageDirectory();
        if (res && res.success) {
          const text = document.getElementById('media-status-text');
          if (text) text.textContent = `Local browser folder permission granted for ${res.name}. Server uploads still use the Media API.`;
          App.showToast(`Local folder access granted for "${res.name}". This does not change server uploads.`, 'info');
        }
      });
    }

    // SECTION 4: Master Catalogs Events
    document.querySelectorAll('.catalog-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeCatalogSubTab = btn.getAttribute('data-subtab');
        this.renderDeveloperHub('catalog');
      });
    });

    document.querySelectorAll('.btn-add-catalog-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        this.showAddEditCatalogModal(type, null);
      });
    });

    document.querySelectorAll('.btn-edit-catalog-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const id = btn.getAttribute('data-id');
        let item = null;
        if (type === 'product-cat') item = (pharmacyDB.getProductCategories() || []).find(c => c.id === id);
        else if (type === 'expense-cat') item = (pharmacyDB.getExpenseCategories() || []).find(e => e.id === id);
        else if (type === 'dosage-form') item = (pharmacyDB.getDosageForms() || []).find(d => d.id === id);
        else if (type === 'procedure-type') item = (pharmacyDB.getTreatmentTypes() || []).find(t => t.id === id);
        else if (type === 'admin-route') item = (pharmacyDB.getAdministrationRoutes() || []).find(r => r.id === id);
        else if (type === 'status-opt') item = (pharmacyDB.getStatuses() || []).find(s => s.id === id);
        if (item) this.showAddEditCatalogModal(type, item);
      });
    });

    document.querySelectorAll('.btn-delete-catalog-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this master catalog item?')) {
          if (type === 'product-cat') pharmacyDB.deleteProductCategory(id);
          else if (type === 'expense-cat') pharmacyDB.deleteExpenseCategory(id);
          else if (type === 'dosage-form') pharmacyDB.deleteDosageForm(id);
          else if (type === 'procedure-type') pharmacyDB.deleteTreatmentType(id);
          else if (type === 'admin-route') pharmacyDB.deleteAdministrationRoute(id);
          else if (type === 'status-opt') pharmacyDB.deleteStatus(id);
          App.showToast('Item deleted successfully', 'info');
          this.renderDeveloperHub('catalog');
        }
      });
    });

    // SECTION 5: Tax System Events
    const saveTaxBtn = document.getElementById('btn-save-tax-settings');
    if (saveTaxBtn) {
      saveTaxBtn.addEventListener('click', () => {
        const enabled = document.getElementById('tax-sys-enabled').checked;
        const taxName = document.getElementById('tax-sys-name').value.trim() || 'VAT';
        const defaultRate = parseFloat(document.getElementById('tax-sys-rate').value) || 0;
        const calculationMethod = document.getElementById('tax-sys-method').value || 'exclusive';
        const regNumber = document.getElementById('tax-sys-reg').value.trim();
        const taxDisclosure = document.getElementById('tax-sys-note').value.trim();

        pharmacyDB.updateTaxSettings({
          enabled,
          taxName,
          defaultRate,
          calculationMethod,
          regNumber,
          taxDisclosure
        });
        App.showToast('Universal Tax System configuration saved!', 'success');
        this.renderDeveloperHub('tax');
      });
    }

    const addTaxSlabBtn = document.getElementById('btn-add-tax-slab');
    if (addTaxSlabBtn) {
      addTaxSlabBtn.addEventListener('click', () => this.showAddEditTaxSlabModal(null));
    }

    document.querySelectorAll('.btn-edit-tax-slab').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const slabs = (pharmacyDB.getTaxSettings().slabs || []);
        const slab = slabs.find(s => s.id === id);
        if (slab) this.showAddEditTaxSlabModal(slab);
      });
    });

    document.querySelectorAll('.btn-delete-tax-slab').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this tax slab?')) {
          pharmacyDB.deleteTaxSlab(id);
          App.showToast('Tax slab deleted', 'info');
          this.renderDeveloperHub('tax');
        }
      });
    });
  },

  /* -------------------------------------------------------------
   * MODAL: Add / Edit Master Catalog Items (6 Entity Types)
   * ------------------------------------------------------------- */
  showAddEditCatalogModal(entityType, existingItem = null) {
    const isEdit = !!existingItem;
    const typeTitles = {
      'product-cat': 'Product Category',
      'expense-cat': 'Product Expense Category',
      'dosage-form': 'Dosage Form',
      'procedure-type': 'Procedure / Treatment Type *',
      'admin-route': 'Administration Route',
      'status-opt': 'Status Option *'
    };
    const title = (isEdit ? '✏️ Edit ' : '➕ Add New ') + (typeTitles[entityType] || 'Catalog Item');

    let formFieldsHtml = '';

    if (entityType === 'product-cat') {
      formFieldsHtml = `
        <div class="form-group">
          <label class="form-label">Category Name *:</label>
          <input type="text" id="cat-m-name" class="form-control" value="${isEdit ? existingItem.name : ''}" placeholder="e.g. Antibiotics, Antidiabetic" required>
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Category Badge Color:</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="color" id="cat-m-color" value="${isEdit ? (existingItem.color || '#0284c7') : '#0284c7'}" style="width: 48px; height: 38px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">
              <input type="text" id="cat-m-hex" class="form-control" value="${isEdit ? (existingItem.color || '#0284c7') : '#0284c7'}" placeholder="#0284c7" style="font-family: monospace;">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Preview:</label>
            <div id="cat-m-preview" style="padding: 8px 12px; border-radius: 6px; font-weight: 700; font-size: 0.85rem; text-align: center; margin-top: 2px;">
              ${isEdit ? existingItem.name : 'Category Tag'}
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description / Scope:</label>
          <textarea id="cat-m-desc" class="form-control" rows="2" placeholder="Clinical therapeutic indications or group particulars">${isEdit ? (existingItem.description || '') : ''}</textarea>
        </div>
      `;
    } else if (entityType === 'expense-cat') {
      formFieldsHtml = `
        <div class="form-group">
          <label class="form-label">Expense Category Name *:</label>
          <input type="text" id="expcat-m-name" class="form-control" value="${isEdit ? existingItem.name : ''}" placeholder="e.g. Cold Chain Power, Store Lease" required>
        </div>
        <div class="form-group">
          <label class="form-label">Default Operating Ledger Account:</label>
          <select id="expcat-m-acct" class="form-control">
            <option value="5040" ${isEdit && existingItem.defaultAccount === '5040' ? 'selected' : ''}>5040 - Electricity, Cold Chain & Utilities</option>
            <option value="5020" ${isEdit && existingItem.defaultAccount === '5020' ? 'selected' : ''}>5020 - Store Rent & Premises Expense</option>
            <option value="5030" ${isEdit && existingItem.defaultAccount === '5030' ? 'selected' : ''}>5030 - Salaries, Overtime & Staff Welfare</option>
            <option value="5060" ${isEdit && existingItem.defaultAccount === '5060' ? 'selected' : ''}>5060 - Pharmacy Licensing & Regulatory Fees</option>
            <option value="5070" ${isEdit && existingItem.defaultAccount === '5070' ? 'selected' : ''}>5070 - Packaging, Prescription Bags & Labels</option>
            <option value="5080" ${isEdit && existingItem.defaultAccount === '5080' ? 'selected' : ''}>5080 - Bank Charges & POS Terminal Processing</option>
            <option value="5090" ${!isEdit || existingItem.defaultAccount === '5090' ? 'selected' : ''}>5090 - General Dispensary Operating Expenses</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description:</label>
          <textarea id="expcat-m-desc" class="form-control" rows="2" placeholder="Particulars regarding these expenses">${isEdit ? (existingItem.description || '') : ''}</textarea>
        </div>
      `;
    } else if (entityType === 'dosage-form') {
      formFieldsHtml = `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Dosage Form Name *:</label>
            <input type="text" id="df-m-name" class="form-control" value="${isEdit ? existingItem.name : ''}" placeholder="e.g. Tablet, Syrup, Injectable Pen" required>
          </div>
          <div class="form-group">
            <label class="form-label">Form Code / Abbreviation *:</label>
            <input type="text" id="df-m-code" class="form-control" value="${isEdit ? (existingItem.code || '') : ''}" placeholder="e.g. TAB, SYR, INJ" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Clinical Formulation Description:</label>
          <textarea id="df-m-desc" class="form-control" rows="2" placeholder="Pharmaceutical properties or packaging nature">${isEdit ? (existingItem.description || '') : ''}</textarea>
        </div>
      `;
    } else if (entityType === 'procedure-type') {
      formFieldsHtml = `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Procedure / Treatment Type *:</label>
            <input type="text" id="tt-m-name" class="form-control" value="${isEdit ? existingItem.name : ''}" placeholder="e.g. Nebulization Therapy, Sterile Dressing" required>
          </div>
          <div class="form-group">
            <label class="form-label">Default Fee Amount ($) *:</label>
            <input type="number" step="0.01" min="0" id="tt-m-charge" class="form-control" value="${isEdit ? (existingItem.defaultCharge !== undefined ? existingItem.defaultCharge : 15) : 15}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Procedure Clinical Description:</label>
          <textarea id="tt-m-desc" class="form-control" rows="2" placeholder="Clinical equipment used, observation protocols, or duration">${isEdit ? (existingItem.description || '') : ''}</textarea>
        </div>
      `;
    } else if (entityType === 'admin-route') {
      formFieldsHtml = `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Administration Route *:</label>
            <input type="text" id="ar-m-name" class="form-control" value="${isEdit ? existingItem.name : ''}" placeholder="e.g. Oral, Intravenous (IV), Inhalation" required>
          </div>
          <div class="form-group">
            <label class="form-label">Clinical Code *:</label>
            <input type="text" id="ar-m-code" class="form-control" value="${isEdit ? (existingItem.code || '') : ''}" placeholder="e.g. PO, IV, IM, SC, INH" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Anatomical Pathway / Description:</label>
          <textarea id="ar-m-desc" class="form-control" rows="2" placeholder="Method of drug absorption or site of administration">${isEdit ? (existingItem.description || '') : ''}</textarea>
        </div>
      `;
    } else if (entityType === 'status-opt') {
      formFieldsHtml = `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Status Value Name *:</label>
            <input type="text" id="st-m-name" class="form-control" value="${isEdit ? existingItem.name : ''}" placeholder="e.g. Administered, In-Progress, Scheduled" required>
          </div>
          <div class="form-group">
            <label class="form-label">Display Label:</label>
            <input type="text" id="st-m-label" class="form-control" value="${isEdit ? (existingItem.label || existingItem.name) : ''}" placeholder="e.g. Administered (Completed)">
          </div>
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Scope / Module:</label>
            <select id="st-m-scope" class="form-control">
              <option value="treatment" ${!isEdit || existingItem.scope === 'treatment' ? 'selected' : ''}>Clinical Treatment Procedures</option>
              <option value="inventory" ${isEdit && existingItem.scope === 'inventory' ? 'selected' : ''}>Inventory & Stock Status</option>
              <option value="all" ${isEdit && existingItem.scope === 'all' ? 'selected' : ''}>Universal Workflow</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Badge Color:</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="color" id="st-m-badge" value="${isEdit ? (existingItem.badgeColor || '#10b981') : '#10b981'}" style="width: 48px; height: 38px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">
              <input type="text" id="st-m-badge-hex" class="form-control" value="${isEdit ? (existingItem.badgeColor || '#10b981') : '#10b981'}" style="font-family: monospace;">
            </div>
          </div>
        </div>
      `;
    }

    const modalHtml = `
      <div class="modal-overlay" id="catalog-item-modal" style="z-index: 10006;">
        <div class="modal-card" style="max-width: 540px;">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('catalog-item-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" style="padding: 1.25rem;">
            ${formFieldsHtml}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('catalog-item-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-catalog-modal">Save</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Live color sync for product-cat
    if (entityType === 'product-cat') {
      const colorInput = document.getElementById('cat-m-color');
      const hexInput = document.getElementById('cat-m-hex');
      const preview = document.getElementById('cat-m-preview');
      const nameInput = document.getElementById('cat-m-name');
      const updateCatPreview = () => {
        const hex = hexInput.value || colorInput.value;
        if (preview) {
          preview.style.background = hex + '20';
          preview.style.color = hex;
          preview.textContent = nameInput.value.trim() || 'Category Tag';
        }
      };
      if (colorInput && hexInput) {
        colorInput.addEventListener('input', () => { hexInput.value = colorInput.value; updateCatPreview(); });
        hexInput.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hexInput.value)) colorInput.value = hexInput.value; updateCatPreview(); });
        nameInput.addEventListener('input', updateCatPreview);
        updateCatPreview();
      }
    }

    // Live color sync for status-opt
    if (entityType === 'status-opt') {
      const badgeInput = document.getElementById('st-m-badge');
      const hexInput = document.getElementById('st-m-badge-hex');
      if (badgeInput && hexInput) {
        badgeInput.addEventListener('input', () => { hexInput.value = badgeInput.value; });
        hexInput.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hexInput.value)) badgeInput.value = hexInput.value; });
      }
    }

    // Save action
    document.getElementById('btn-save-catalog-modal').addEventListener('click', () => {
      try {
        if (entityType === 'product-cat') {
          const name = document.getElementById('cat-m-name').value.trim();
          if (!name) return alert('Category name is required');
          const color = document.getElementById('cat-m-hex').value.trim() || '#0284c7';
          const description = document.getElementById('cat-m-desc').value.trim();
          if (isEdit) pharmacyDB.updateProductCategory({ id: existingItem.id, name, color, description });
          else pharmacyDB.addProductCategory({ name, color, description });
        } else if (entityType === 'expense-cat') {
          const name = document.getElementById('expcat-m-name').value.trim();
          if (!name) return alert('Expense category name is required');
          const defaultAccount = document.getElementById('expcat-m-acct').value;
          const description = document.getElementById('expcat-m-desc').value.trim();
          if (isEdit) pharmacyDB.updateExpenseCategory({ id: existingItem.id, name, defaultAccount, description });
          else pharmacyDB.addExpenseCategory({ name, defaultAccount, description });
        } else if (entityType === 'dosage-form') {
          const name = document.getElementById('df-m-name').value.trim();
          const code = document.getElementById('df-m-code').value.trim();
          if (!name || !code) return alert('Dosage form name and abbreviation code are required');
          const description = document.getElementById('df-m-desc').value.trim();
          if (isEdit) pharmacyDB.updateDosageForm({ id: existingItem.id, name, code, description });
          else pharmacyDB.addDosageForm({ name, code, description });
        } else if (entityType === 'procedure-type') {
          const name = document.getElementById('tt-m-name').value.trim();
          const defaultCharge = parseFloat(document.getElementById('tt-m-charge').value) || 0;
          if (!name) return alert('Procedure type name is required');
          const description = document.getElementById('tt-m-desc').value.trim();
          if (isEdit) pharmacyDB.updateTreatmentType({ id: existingItem.id, name, defaultCharge, description });
          else pharmacyDB.addTreatmentType({ name, defaultCharge, description });
        } else if (entityType === 'admin-route') {
          const name = document.getElementById('ar-m-name').value.trim();
          const code = document.getElementById('ar-m-code').value.trim();
          if (!name) return alert('Route name is required');
          const description = document.getElementById('ar-m-desc').value.trim();
          if (isEdit) pharmacyDB.updateAdministrationRoute({ id: existingItem.id, name, code, description });
          else pharmacyDB.addAdministrationRoute({ name, code, description });
        } else if (entityType === 'status-opt') {
          const name = document.getElementById('st-m-name').value.trim();
          if (!name) return alert('Status name is required');
          const label = document.getElementById('st-m-label').value.trim() || name;
          const scope = document.getElementById('st-m-scope').value;
          const badgeColor = document.getElementById('st-m-badge-hex').value.trim() || '#10b981';
          if (isEdit) pharmacyDB.updateStatus({ id: existingItem.id, name, label, scope, badgeColor });
          else pharmacyDB.addStatus({ name, label, scope, badgeColor });
        }

        document.getElementById('catalog-item-modal').remove();
        App.showToast(`Saved successfully!`, 'success');
        this.renderDeveloperHub('catalog');
      } catch (err) {
        alert('Error saving catalog item: ' + err.message);
      }
    });
  },

  /* -------------------------------------------------------------
   * MODAL: Add / Edit Tax Slab
   * ------------------------------------------------------------- */
  showAddEditTaxSlabModal(existingSlab = null) {
    const isEdit = !!existingSlab;
    const title = isEdit ? '✏️ Edit Tax Slab' : '➕ Add New Tax Slab';

    const modalHtml = `
      <div class="modal-overlay" id="tax-slab-modal" style="z-index: 10006;">
        <div class="modal-card" style="max-width: 480px;">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('tax-slab-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" style="padding: 1.25rem;">
            <div class="form-group">
              <label class="form-label">Tax Slab Name *:</label>
              <input type="text" id="tax-slab-m-name" class="form-control" value="${isEdit ? existingSlab.name : ''}" placeholder="e.g. Standard VAT (13%)" required>
            </div>
            <div class="form-group">
              <label class="form-label">Tax Percentage Rate (%) *:</label>
              <input type="number" step="0.01" min="0" max="100" id="tax-slab-m-rate" class="form-control" value="${isEdit ? existingSlab.rate : '13'}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Description / Applicable Products:</label>
              <input type="text" id="tax-slab-m-desc" class="form-control" value="${isEdit ? (existingSlab.description || '') : ''}" placeholder="e.g. Standard formulations, devices, etc.">
            </div>
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: #0f172a;">
                <input type="checkbox" id="tax-slab-m-default" ${isEdit && existingSlab.isDefault ? 'checked' : ''} style="width: 18px; height: 18px;">
                Set as Default Tax Slab for New Inventory
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('tax-slab-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-tax-slab-modal">Save Tax Slab</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-save-tax-slab-modal').addEventListener('click', () => {
      const name = document.getElementById('tax-slab-m-name').value.trim();
      const rate = parseFloat(document.getElementById('tax-slab-m-rate').value);
      if (!name || isNaN(rate)) {
        alert('Please enter a valid slab name and tax rate percentage');
        return;
      }
      const description = document.getElementById('tax-slab-m-desc').value.trim();
      const isDefault = document.getElementById('tax-slab-m-default').checked;

      if (isEdit) {
        pharmacyDB.updateTaxSlab({ id: existingSlab.id, name, rate, description, isDefault });
      } else {
        pharmacyDB.addTaxSlab({ name, rate, description, isDefault });
      }

      document.getElementById('tax-slab-modal').remove();
      App.showToast(`Tax slab saved!`, 'success');
      this.renderDeveloperHub('tax');
    });
  },

  /* -------------------------------------------------------------
   * MODAL: Create / Edit Staff Member with Checkbox Permissions
   * ------------------------------------------------------------- */
  showAddEditStaffModal(existingStaff = null) {
    const isEdit = !!existingStaff;
    const perms = isEdit ? (existingStaff.permissions || {}) : {
      pos: true,
      applyDiscounts: false,
      inventory: true,
      expiryWriteOff: false,
      patientLedger: true,
      supplierLedger: false,
      journalEntries: false,
      financialReports: false,
      medicationTreatment: true,
      dailyRecords: true,
      expenses: true,
      backup: false,
      settings: false,
      devTools: false
    };

    const modalHtml = `
      <div class="modal-overlay" id="staff-modal-hub" style="z-index: 10001;">
        <div class="modal-card" style="max-width: 680px;">
          <div class="modal-header">
            <h3>${isEdit ? 'Edit Staff Member & Permissions' : 'Create New Dispensary Staff Account'}</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('staff-modal-hub').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" style="padding: 1.25rem;">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <input type="text" id="hub-staff-name" class="form-control" value="${isEdit ? existingStaff.name : ''}" placeholder="e.g. Rachel Adams, RPh" required>
              </div>
              <div class="form-group">
                <label class="form-label">Role Category *</label>
                <select id="hub-staff-role" class="form-control">
                  <option value="pharmacist" ${isEdit && existingStaff.role === 'pharmacist' ? 'selected' : ''}>Staff Pharmacist</option>
                  <option value="accountant" ${isEdit && existingStaff.role === 'accountant' ? 'selected' : ''}>Accountant / Auditor</option>
                  <option value="developer" ${isEdit && existingStaff.role === 'developer' ? 'selected' : ''}>Developer / Super Admin</option>
                  <option value="custom" ${isEdit && existingStaff.role === 'custom' ? 'selected' : ''}>Custom Role</option>
                </select>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Username (For Login) *</label>
                <input type="text" id="hub-staff-username" class="form-control" value="${isEdit ? existingStaff.username : ''}" placeholder="e.g. rachel.adams" required>
              </div>
              <div class="form-group">
                <label class="form-label">Password *</label>
                <input type="text" id="hub-staff-password" class="form-control" value="${isEdit ? existingStaff.password : 'staff123'}" required>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <input type="email" id="hub-staff-email" class="form-control" value="${isEdit ? (existingStaff.email || '') : ''}" placeholder="staff@baganmedicalhall.com">
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="text" id="hub-staff-phone" class="form-control" value="${isEdit ? (existingStaff.phone || '') : ''}" placeholder="555-0199">
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Custom Role Title</label>
                <input type="text" id="hub-staff-title" class="form-control" value="${isEdit ? (existingStaff.roleTitle || '') : 'Dispensary Staff'}" placeholder="e.g. Senior Pharmacist">
              </div>
              <div class="form-group">
                <label class="form-label">Account Status</label>
                <select id="hub-staff-status" class="form-control">
                  <option value="active" ${!isEdit || existingStaff.status === 'active' ? 'selected' : ''}>Active (Can Log In)</option>
                  <option value="inactive" ${isEdit && existingStaff.status === 'inactive' ? 'selected' : ''}>Inactive (Suspended)</option>
                </select>
              </div>
            </div>

            <!-- Granular Permissions Matrix -->
            <div style="margin-top: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label class="form-label" style="font-weight: 700; margin: 0;">Dispensary & Accounting Permissions:</label>
                <button type="button" class="btn btn-outline btn-sm" id="btn-apply-role-preset" style="padding: 2px 6px; font-size: 0.72rem;">Apply Role Preset</button>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                  <input type="checkbox" id="hp-pos" ${perms.pos ? 'checked' : ''}> POS Dispensing & Billing
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                  <input type="checkbox" id="hp-discounts" ${perms.applyDiscounts ? 'checked' : ''}> Apply Bill Discounts
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer; color: #0284c7; font-weight: 600;">
                  <input type="checkbox" id="hp-treatment" ${perms.medicationTreatment ? 'checked' : ''}> Medication & Treatments
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                  <input type="checkbox" id="hp-inventory" ${perms.inventory ? 'checked' : ''}> View & Manage Drug Inventory
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                  <input type="checkbox" id="hp-expiry" ${perms.expiryWriteOff ? 'checked' : ''}> Stock Expiry Quarantine / Loss
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer; color: #059669; font-weight: 600;">
                  <input type="checkbox" id="hp-daily-records" ${perms.dailyRecords ? 'checked' : ''}> Daily Records & Drawer Balancing
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer; color: #dc2626; font-weight: 600;">
                  <input type="checkbox" id="hp-expenses" ${perms.expenses ? 'checked' : ''}> Operating Expense Management
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                  <input type="checkbox" id="hp-patient" ${perms.patientLedger ? 'checked' : ''}> Patient Credit & Collections
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                  <input type="checkbox" id="hp-supplier" ${perms.supplierLedger ? 'checked' : ''}> Supplier Accounts & Inward GRN
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                  <input type="checkbox" id="hp-journal" ${perms.journalEntries ? 'checked' : ''}> Manual Journal Vouchers
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                  <input type="checkbox" id="hp-reports" ${perms.financialReports ? 'checked' : ''}> Financial Statements (P&L, BS)
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
                  <input type="checkbox" id="hp-backup" ${perms.backup ? 'checked' : ''}> Database Backup & JSON Export
                </label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('staff-modal-hub').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-staff-hub-member">
              ${isEdit ? 'Save Changes' : 'Create Staff Member'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Preset helper
    const roleSelect = document.getElementById('hub-staff-role');
    const applyPreset = () => {
      const selected = roleSelect.value;
      const setPerms = (pos, disc, med, inv, exp, dly, exps, pat, sup, jrn, rep, bak) => {
        document.getElementById('hp-pos').checked = pos;
        document.getElementById('hp-discounts').checked = disc;
        document.getElementById('hp-treatment').checked = med;
        document.getElementById('hp-inventory').checked = inv;
        document.getElementById('hp-expiry').checked = exp;
        document.getElementById('hp-daily-records').checked = dly;
        document.getElementById('hp-expenses').checked = exps;
        document.getElementById('hp-patient').checked = pat;
        document.getElementById('hp-supplier').checked = sup;
        document.getElementById('hp-journal').checked = jrn;
        document.getElementById('hp-reports').checked = rep;
        document.getElementById('hp-backup').checked = bak;
      };

      if (selected === 'pharmacist') {
        setPerms(true, true, true, true, true, true, true, true, true, false, false, false);
        document.getElementById('hub-staff-title').value = 'Staff Pharmacist';
      } else if (selected === 'accountant') {
        setPerms(false, false, false, true, false, true, true, true, true, true, true, true);
        document.getElementById('hub-staff-title').value = 'Senior Accountant';
      } else if (selected === 'developer') {
        setPerms(true, true, true, true, true, true, true, true, true, true, true, true);
        document.getElementById('hub-staff-title').value = 'Lead Developer & Admin';
      }
    };

    roleSelect.addEventListener('change', applyPreset);
    document.getElementById('btn-apply-role-preset').addEventListener('click', applyPreset);

    // Save Staff Member
    document.getElementById('btn-save-staff-hub-member').addEventListener('click', async () => {
      const name = document.getElementById('hub-staff-name').value.trim();
      const username = document.getElementById('hub-staff-username').value.trim().toLowerCase();
      const password = document.getElementById('hub-staff-password').value.trim();

      if (!name || !username) {
        alert('Name and Username are required.');
        return;
      }

      const role = document.getElementById('hub-staff-role').value;
      const roleTitle = document.getElementById('hub-staff-title').value.trim() || role;
      const email = document.getElementById('hub-staff-email').value.trim();
      const phone = document.getElementById('hub-staff-phone').value.trim();
      const status = document.getElementById('hub-staff-status').value;

      const roleIdMap = {
        pharmacist: 'role_pharmacist',
        accountant: 'role_accountant',
        developer: 'role_dev',
        custom: 'role_pharmacist',
      };

      const newPerms = {
        pos: document.getElementById('hp-pos').checked,
        applyDiscounts: document.getElementById('hp-discounts').checked,
        medicationTreatment: document.getElementById('hp-treatment').checked,
        inventory: document.getElementById('hp-inventory').checked,
        expiryWriteOff: document.getElementById('hp-expiry').checked,
        dailyRecords: document.getElementById('hp-daily-records').checked,
        expenses: document.getElementById('hp-expenses').checked,
        patientLedger: document.getElementById('hp-patient').checked,
        supplierLedger: document.getElementById('hp-supplier').checked,
        journalEntries: document.getElementById('hp-journal').checked,
        financialReports: document.getElementById('hp-reports').checked,
        backup: document.getElementById('hp-backup').checked,
        settings: role === 'developer',
        devTools: role === 'developer'
      };

      const staffData = {
        id: isEdit ? existingStaff.id : ('staff_' + Date.now().toString().slice(-6)),
        name,
        username,
        password: password || 'staff123',
        role,
        roleTitle,
        email,
        phone,
        status,
        avatar: role === 'developer' ? '💻' : (role === 'pharmacist' ? '🧑‍⚕️' : '👤'),
        permissions: newPerms
      };

      const saveBtn = document.getElementById('btn-save-staff-hub-member');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      if (!isEdit) {
        // Controlled Staff Provisioning via POST /api/admin/staff/provision
        const payload = {
          username,
          name,
          roleId: roleIdMap[role] || role,
          roleTitle,
          email: email || null,
          phone: phone || null,
          avatar: staffData.avatar,
        };

        const res = await this.apiRequest('/api/admin/staff/provision', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        document.getElementById('staff-modal-hub').remove();

        if (res.ok && res.data && res.data.temporaryPassword) {
          staffData.id = res.data.staff?.id || staffData.id;
          pharmacyDB.saveStaffMember(staffData);
          this.showTemporaryPasswordModal(username, res.data.temporaryPassword);
        } else {
          if (!this.isMockAllowed()) {
            alert(`Provisioning Failed: ${res.data?.message || 'Server rejected staff account creation. Production fails closed to prevent unverified accounts.'}`);
            return;
          }
          pharmacyDB.saveStaffMember(staffData);
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(`Staff member ${name} created locally (Dev Mock)!`, 'warning');
          }
        }
      } else {
        // Staff Profile Update via PUT /api/admin/staff/:id
        const payload = {
          name,
          roleId: roleIdMap[role] || role,
          roleTitle,
          email: email || null,
          phone: phone || null,
          status,
          avatar: staffData.avatar,
        };

        const res = await this.apiRequest(`/api/admin/staff/${existingStaff.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        document.getElementById('staff-modal-hub').remove();

        if (res.ok) {
          pharmacyDB.saveStaffMember(staffData);
          if (this.currentUser && (this.currentUser.id === staffData.id || this.currentUser.username.toLowerCase() === staffData.username.toLowerCase())) {
            this.currentUser = { ...this.currentUser, ...staffData };
            this.enforceSidebarPermissions();
          }
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(`Staff member ${name} updated successfully!`, 'success');
          }
        } else {
          if (!this.isMockAllowed()) {
            alert(`Update Failed: ${res.data?.message || 'Server rejected staff update. Production fails closed.'}`);
            return;
          }
          pharmacyDB.saveStaffMember(staffData);
          alert(res.data?.message || 'Updated in local storage.');
        }
      }

      await this.loadServerStaff();
      this.renderDeveloperHub('staff');
    });
  },

  /* -------------------------------------------------------------
   * MODAL: Dynamic Permissions & Granular Overrides
   * ------------------------------------------------------------- */
  async showPermissionsOverrideModal(staff) {
    if (!staff) return;

    let permissionsData = null;
    try {
      const res = await this.apiRequest(`/api/admin/staff/${staff.id}/effective-permissions`);
      if (res.ok && res.data && Array.isArray(res.data.permissions)) {
        permissionsData = res.data.permissions;
      } else {
        if (!this.isMockAllowed()) {
          alert(`Permissions Load Error: ${res.data?.message || 'Could not retrieve authoritative permissions from server. Production fails closed.'}`);
          return;
        }
      }
    } catch (e) {
      console.warn('[LOAD_PERMISSIONS_FAILED]', e);
      if (!this.isMockAllowed()) {
        alert('Network Connection Error: Could not connect to authoritative server.');
        return;
      }
    }

    if (!permissionsData) {
      permissionsData = [
        { code: 'pos', name: 'POS Dispensing & Billing', description: 'Create dispensing transactions and bills', isRoleGranted: true, hasOverride: false, effective: true },
        { code: 'applyDiscounts', name: 'Apply Bill Discounts', description: 'Apply manual line-item or invoice discounts', isRoleGranted: false, hasOverride: false, effective: false },
        { code: 'medicationTreatment', name: 'Medications & Treatments', description: 'Manage treatments and clinical regimen plans', isRoleGranted: true, hasOverride: false, effective: true },
        { code: 'dailyRecords', name: 'Daily Drawer Balancing', description: 'Shift opening counts, drawer logs, daily closing', isRoleGranted: true, hasOverride: false, effective: true },
        { code: 'inventory', name: 'View Drug Inventory', description: 'Browse stock balances, batch numbers, rack locations', isRoleGranted: true, hasOverride: false, effective: true },
        { code: 'inventoryEdit', name: 'Modify Inventory Items', description: 'Create and update medicines and prices', isRoleGranted: false, hasOverride: false, effective: false },
        { code: 'expiryWriteOff', name: 'Stock Expiry Quarantine', description: 'Quarantine expired drugs and perform write-offs', isRoleGranted: false, hasOverride: false, effective: false },
        { code: 'patientLedger', name: 'Patient Credit & Ledgers', description: 'View receivables, patient statements and receipts', isRoleGranted: true, hasOverride: false, effective: true },
        { code: 'supplierLedger', name: 'Supplier Accounts & GRN', description: 'Manage payables, inward stock purchases', isRoleGranted: false, hasOverride: false, effective: false },
        { code: 'expenses', name: 'Operational Expenses', description: 'Record dispensary operating and petty cash expenses', isRoleGranted: true, hasOverride: false, effective: true },
        { code: 'journalEntries', name: 'Manual Journal Vouchers', description: 'Create double-entry debit/credit adjustment entries', isRoleGranted: false, hasOverride: false, effective: false },
        { code: 'financialReports', name: 'Financial Statements (P&L, BS)', description: 'Access balance sheets, trial balances, and audits', isRoleGranted: false, hasOverride: false, effective: false },
        { code: 'mediaView', name: 'Browse Media Assets', description: 'Browse dispensary logos, product pictures and media', isRoleGranted: true, hasOverride: false, effective: true },
        { code: 'mediaUpload', name: 'Upload Media Assets', description: 'Upload dispensary imagery with WebP conversion', isRoleGranted: false, hasOverride: false, effective: false },
        { code: 'mediaDelete', name: 'Delete Media Assets', description: 'Permanently remove unreferenced media files', isRoleGranted: false, hasOverride: false, effective: false },
        { code: 'staffManage', name: 'Manage Staff Accounts', description: 'Provision staff, configure roles, and set overrides', isRoleGranted: false, hasOverride: false, effective: false },
        { code: 'backup', name: 'Database Backup & Export', description: 'Export PostgreSQL database dumps and audit archives', isRoleGranted: false, hasOverride: false, effective: false },
      ];
    }

    const isSuper = Boolean(staff.is_super_admin || staff.role === 'developer');

    const modalHtml = `
      <div class="modal-overlay" id="staff-overrides-modal" style="z-index: 10002;">
        <div class="modal-card" style="max-width: 740px; max-height: 90vh; display: flex; flex-direction: column;">
          <div class="modal-header">
            <div>
              <h3 style="margin: 0; font-size: 1.15rem;">Dynamic Permissions & Overrides</h3>
              <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b;">
                Configuring granular permissions for <strong>${staff.name}</strong> (@${staff.username})
              </p>
            </div>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('staff-overrides-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" style="padding: 1.25rem; overflow-y: auto; flex: 1;">
            ${isSuper ? `
              <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 1rem; color: #6b21a8; font-size: 0.85rem;">
                <strong>👑 Super Admin Account:</strong> This user holds unrestricted master authority. Super Admins possess all permissions unconditionally; individual overrides are not applicable.
              </div>
            ` : `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; font-size: 0.8rem; color: #475569; margin-bottom: 1rem;">
                <strong>How Overrides Work:</strong> Role permissions apply by default. Set an override to <strong>Force Grant (Allow)</strong> to grant access beyond role defaults, or <strong>Force Revoke (Deny)</strong> to block a module even if the role grants it.
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                ${permissionsData.map(p => {
                  const roleDefaultText = p.isRoleGranted ? 'Granted by Role' : 'Denied by Role';
                  const roleDefaultColor = p.isRoleGranted ? '#059669' : '#dc2626';
                  let currentVal = 'default';
                  if (p.hasOverride) {
                    currentVal = p.overrideVal ? 'grant' : 'revoke';
                  }

                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.65rem 0.85rem; gap: 1rem;">
                      <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 0.85rem; color: #0f172a;">${p.name || p.code}</div>
                        <div style="font-size: 0.72rem; color: #64748b;">${p.description || p.code}</div>
                        <div style="font-size: 0.7rem; color: ${roleDefaultColor}; font-weight: 600; margin-top: 2px;">
                          Default: ${roleDefaultText}
                        </div>
                      </div>
                      <div style="min-width: 175px;">
                        <select class="form-control override-select" data-perm-code="${p.code}" style="font-size: 0.78rem; padding: 0.35rem 0.6rem;">
                          <option value="default" ${currentVal === 'default' ? 'selected' : ''}>Inherit Role Default</option>
                          <option value="grant" ${currentVal === 'grant' ? 'selected' : ''} style="color: #059669; font-weight: 700;">Force Grant (Allow)</option>
                          <option value="revoke" ${currentVal === 'revoke' ? 'selected' : ''} style="color: #dc2626; font-weight: 700;">Force Revoke (Deny)</option>
                        </select>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
          <div class="modal-footer" style="padding: 0.85rem 1.25rem;">
            <button class="btn btn-secondary" onclick="document.getElementById('staff-overrides-modal').remove()">Cancel</button>
            ${!isSuper ? `
              <button class="btn btn-primary" id="btn-save-permission-overrides" data-staff-id="${staff.id}">
                Save Overrides
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const saveBtn = document.getElementById('btn-save-permission-overrides');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const selects = document.querySelectorAll('.override-select');
        const overrides = [];

        selects.forEach(sel => {
          const code = sel.getAttribute('data-perm-code');
          const val = sel.value;
          if (val === 'default') {
            overrides.push({ code, isGranted: null });
          } else if (val === 'grant') {
            overrides.push({ code, isGranted: true });
          } else if (val === 'revoke') {
            overrides.push({ code, isGranted: false });
          }
        });

        const res = await this.apiRequest(`/api/admin/staff/${staff.id}/overrides`, {
          method: 'POST',
          body: JSON.stringify({ overrides }),
        });

        document.getElementById('staff-overrides-modal').remove();

        if (res.ok) {
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(`Permission overrides updated for ${staff.name}`, 'success');
          }
        } else {
          alert(res.data?.message || 'Failed to update permission overrides.');
        }

        await this.loadServerStaff();
        this.renderDeveloperHub('staff');
      });
    }
  },

  /* -------------------------------------------------------------
   * MODAL: Single-Use Temporary Password Display
   * ------------------------------------------------------------- */
  showTemporaryPasswordModal(username, tempPass) {
    const modalHtml = `
      <div class="modal-overlay" id="temp-pass-modal" style="z-index: 10005;">
        <div class="modal-card" style="max-width: 500px; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔐</div>
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; color: #0f172a;">Single-Use Temporary Password</h3>
          <p style="font-size: 0.85rem; color: #475569; margin: 0 0 1rem 0;">
            Staff account for <strong>${username}</strong> was successfully provisioned with mandatory first-login password reset.
          </p>

          <div style="background: #f1f5f9; border: 2px dashed #94a3b8; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700; margin-bottom: 4px;">Temporary Password (Copy Now)</div>
            <div id="temp-pass-display" style="font-family: monospace; font-size: 1.4rem; font-weight: 800; color: #0f172a; letter-spacing: 0.1em; user-select: all;">
              ${tempPass}
            </div>
          </div>

          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 0.65rem; font-size: 0.78rem; color: #92400e; margin-bottom: 1.25rem;">
            ⚠️ <strong>Security Notice:</strong> This password is single-use and will not be displayed again. Please copy and provide it securely to the staff member.
          </div>

          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button class="btn btn-primary" id="btn-copy-temp-pass">
              📋 Copy Password
            </button>
            <button class="btn btn-secondary" onclick="document.getElementById('temp-pass-modal').remove()">
              Done
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const copyBtn = document.getElementById('btn-copy-temp-pass');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(tempPass).then(() => {
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => { copyBtn.textContent = '📋 Copy Password'; }, 2000);
        }).catch(() => {
          alert(`Password: ${tempPass}`);
        });
      });
    }
  }
};
