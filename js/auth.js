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

  init() {
    // Purge any stale legacy session keys from previous sessions
    try {
      localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      sessionStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      localStorage.removeItem('apex_rx_active_session_v1');
    } catch (_) {}

    // Check current active session only
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
    return this.currentUser && (this.currentUser.role === 'developer' || this.currentUser.permissions?.devTools);
  },

  hasPermission(permKey) {
    if (!this.currentUser) return false;
    if (this.isDeveloper()) return true; // Developers have all permissions
    const liveUser = (pharmacyDB.data.staffMembers || []).find(s => s.id === this.currentUser.id || s.username.toLowerCase() === this.currentUser.username.toLowerCase());
    const perms = liveUser ? liveUser.permissions : this.currentUser.permissions;
    return !!(perms && perms[permKey]);
  },

  login(usernameOrEmail, password, remember = true) {
    const cleanUser = (usernameOrEmail || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

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

    this.currentUser = user;
    const sessionData = JSON.stringify({ id: user.id, username: user.username, loginTime: new Date().toISOString() });
    if (remember) {
      localStorage.setItem(AUTH_STORAGE_KEY, sessionData);
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, sessionData);
    }

    this.applyUserSession();
    return { success: true, user };
  },

  logout() {
    this.currentUser = null;
    this.clearStoredSession();
    this.loginMode = 'staff';
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

        <!-- Test Credentials Box (Only 2 Roles: Staff & Developer) -->
        ${pageSettings.showTestCredentials ? `
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
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('login-remember').checked;

        const res = this.login(username, password, remember);
        if (res.success) {
          App.showToast(`Welcome back, ${res.user.name}!`, 'success');
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
            <div style="font-size: 0.73rem; color: #64748b; margin-top: 2px;">Browse & manage uploaded assets in <code>website_images/</code></div>
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
    const staffList = pharmacyDB.data.staffMembers || [];

    return `
      <div class="app-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0;">Dispensary Staff Accounts & Governance</h2>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0;">Manage staff credentials and enforce individual module access controls.</p>
          </div>
          <button class="btn btn-success" id="btn-create-staff-hub" style="font-size: 0.85rem;">
            ${getIcon('plus')} Create New Staff Member
          </button>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Role Category</th>
                <th>Login Username</th>
                <th>Account Status</th>
                <th>Granular Permissions</th>
                <th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              ${staffList.map(s => {
                const perms = s.permissions || {};
                const activeCount = Object.values(perms).filter(Boolean).length;
                const isSuper = s.role === 'developer';

                return `
                  <tr>
                    <td>
                      <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                        <span>${s.avatar || '🧑‍⚕️'}</span>
                        <span>${s.name}</span>
                      </div>
                      <div style="font-size: 0.74rem; color: #64748b;">${s.email || 'No email registered'} | ${s.phone || 'No phone'}</div>
                    </td>
                    <td>
                      <span style="font-size: 0.74rem; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: ${isSuper ? '#f5f3ff' : '#ecfdf5'}; color: ${isSuper ? '#7c3aed' : '#059669'};">
                        ${s.roleTitle || s.role}
                      </span>
                    </td>
                    <td style="font-family: monospace; font-size: 0.84rem; font-weight: 600;">
                      ${s.username}
                    </td>
                    <td>
                      <span style="font-size: 0.74rem; font-weight: 700; color: ${s.status === 'active' ? '#10b981' : '#dc2626'};">
                        ● ${s.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style="font-size: 0.78rem; font-weight: 600; color: #334155;">
                        ${isSuper ? '<strong style="color: #7c3aed;">Full Unrestricted Super Admin</strong>' : `${activeCount} / 10 Permissions Enabled`}
                      </div>
                      <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; font-size: 0.68rem;">
                        ${perms.pos ? '<span class="quick-stats-chip" style="padding: 1px 5px;">POS</span>' : ''}
                        ${perms.inventory ? '<span class="quick-stats-chip" style="padding: 1px 5px;">Inventory</span>' : ''}
                        ${perms.patientLedger ? '<span class="quick-stats-chip" style="padding: 1px 5px;">Patients</span>' : ''}
                        ${perms.supplierLedger ? '<span class="quick-stats-chip" style="padding: 1px 5px;">Suppliers</span>' : ''}
                        ${perms.journalEntries ? '<span class="quick-stats-chip" style="padding: 1px 5px;">Journal</span>' : ''}
                        ${perms.financialReports ? '<span class="quick-stats-chip" style="padding: 1px 5px;">Statements</span>' : ''}
                      </div>
                    </td>
                    <td class="text-center">
                      <div style="display: inline-flex; gap: 0.35rem;">
                        <button class="btn btn-outline btn-sm btn-edit-staff-hub" data-staff-id="${s.id}">
                          Edit
                        </button>
                        ${s.id !== 'staff_dev' ? `
                          <button class="btn btn-danger btn-sm btn-delete-staff-hub" data-staff-id="${s.id}">
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
                <span class="logo-folder-badge" title="All uploaded assets are stored strictly in website_images/">
                  📁 website_images/
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

                <input type="file" id="glob-colored-file" accept="image/*" style="display: none;">
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

                <input type="file" id="glob-white-file" accept="image/*" style="display: none;">
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
                <input type="file" id="glob-fallback-file" accept="image/*" style="display: none;">
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
              All images are securely stored in the <code>website_images/</code> folder and browser storage. Easily browse, upload, preview, and set any image as Coloured Logo, White Logo, or Fallback Logo.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="file" id="media-center-file-input" accept="image/*" multiple style="display: none;">
            <button class="btn btn-primary" id="btn-media-center-upload" style="font-size: 0.85rem;">
              ${getIcon('upload')} Upload New to website_images/
            </button>
          </div>
        </div>

        <!-- Drag & Drop Upload Zone -->
        <div id="media-center-dropzone" style="border: 2px dashed #94a3b8; border-radius: 10px; padding: 1.25rem; text-align: center; background: #f8fafc; margin-bottom: 1.25rem; cursor: pointer; transition: all 0.2s ease;">
          <div style="font-size: 1.8rem; margin-bottom: 0.25rem;">🖼️</div>
          <div style="font-weight: 700; font-size: 0.92rem; color: #1e293b;">Click to Browse or Drag & Drop Images Here</div>
          <div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">PNG, JPG, SVG, WEBP & GIF. Auto-optimized, permanently persisted in IndexedDB and website_images/</div>
        </div>

        <!-- Toolbar: Search & Count Filter -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; gap: 1rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #334155;">Library Assets:</span>
            <span class="nav-badge" style="background: #e2e8f0; color: #1e293b; font-weight: 700;">${mediaItems.length} Files</span>
            <span class="logo-folder-badge">📁 website_images/</span>
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
              <div style="font-size: 0.8rem; margin-top: 4px;">Click the upload button above to add assets to <code>website_images/</code>.</div>
            </div>
          ` : mediaItems.map(item => {
            const isColLogo = (g.logoColored === item.path || (item.dataUrl && g.logoColoredData === item.dataUrl));
            const isWhiteLogo = (g.logoWhite === item.path || (item.dataUrl && g.logoWhiteData === item.dataUrl));
            const isFallback = (g.fallbackLogoImage === item.path || (item.dataUrl && g.fallbackLogoData === item.dataUrl));

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
                  <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px; display: flex; justify-content: space-between;">
                    <span>${item.size ? (item.size > 1024 ? (item.size/1024).toFixed(1) + ' KB' : item.size + ' B') : 'Vector'}</span>
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
                  ${(!item.id || !item.id.startsWith('med_default')) ? `
                    <button type="button" class="btn btn-outline btn-sm btn-delete-media" data-id="${item.id}" data-filename="${item.filename}" style="font-size: 0.68rem; padding: 3px 4px; color: #e11d48; border-color: #fecdd3; justify-content: center; margin-top: 2px;">
                      🗑️ Delete
                    </button>
                  ` : ''}
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
      tile.addEventListener('click', () => {
        const section = tile.getAttribute('data-hub-section');
        this.renderDeveloperHub(section);
      });
    });

    // SECTION 1: Staff Events
    const createStaffBtn = document.getElementById('btn-create-staff-hub');
    if (createStaffBtn) {
      createStaffBtn.addEventListener('click', () => this.showAddEditStaffModal(null));
    }

    document.querySelectorAll('.btn-edit-staff-hub').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-staff-id');
        const staff = (pharmacyDB.data.staffMembers || []).find(s => s.id === id);
        this.showAddEditStaffModal(staff);
      });
    });

    document.querySelectorAll('.btn-delete-staff-hub').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-staff-id');
        if (confirm('Are you sure you want to delete this staff member?')) {
          try {
            pharmacyDB.deleteStaffMember(id);
            App.showToast('Staff member deleted', 'info');
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
            App.showToast('Uploading Coloured Logo to website_images/...', 'info');
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
            App.showToast('Uploading White Logo to website_images/...', 'info');
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
            App.showToast('Uploading Fallback Logo to website_images/...', 'info');
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
        App.showToast(`Uploading ${filesList.length} asset(s) to website_images/...`, 'info');
        for (let i = 0; i < filesList.length; i++) {
          await App.uploadImageFile(filesList[i]);
        }
        App.showToast(`Successfully uploaded and persisted ${filesList.length} image(s)!`, 'success');
        this.renderDeveloperHub('media');
      } catch (err) {
        alert(err.message);
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

    // Delete Media item
    document.querySelectorAll('.btn-delete-media').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const fn = btn.getAttribute('data-filename');
        if (confirm(`Are you sure you want to remove "${fn}" from the Media Center?`)) {
          pharmacyDB.deleteMediaItem(id || fn);
          App.showToast(`Removed "${fn}" from Media Center`, 'info');
          this.renderDeveloperHub('media');
        }
      });
    });

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
    document.getElementById('btn-save-staff-hub-member').addEventListener('click', () => {
      const name = document.getElementById('hub-staff-name').value.trim();
      const username = document.getElementById('hub-staff-username').value.trim().toLowerCase();
      const password = document.getElementById('hub-staff-password').value.trim();

      if (!name || !username || !password) {
        alert('Name, Username, and Password are required.');
        return;
      }

      const role = document.getElementById('hub-staff-role').value;
      const roleTitle = document.getElementById('hub-staff-title').value.trim() || role;
      const email = document.getElementById('hub-staff-email').value.trim();
      const phone = document.getElementById('hub-staff-phone').value.trim();
      const status = document.getElementById('hub-staff-status').value;

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
        password,
        role,
        roleTitle,
        email,
        phone,
        status,
        avatar: role === 'developer' ? '💻' : (role === 'pharmacist' ? '🧑‍⚕️' : '👤'),
        permissions: newPerms
      };

      pharmacyDB.saveStaffMember(staffData);
      if (this.currentUser && (this.currentUser.id === staffData.id || this.currentUser.username.toLowerCase() === staffData.username.toLowerCase())) {
        this.currentUser = { ...this.currentUser, ...staffData };
        this.enforceSidebarPermissions();
      }
      document.getElementById('staff-modal-hub').remove();
      App.showToast(`Staff member ${name} saved!`, 'success');
      this.renderDeveloperHub('staff');
    });
  }
};
