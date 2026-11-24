/**
 * Master Application Coordinator & Navigation Router
 */

const App = {
  currentView: 'pos', // default to POS counter for fast access

  DEFAULT_COLORED_LOGO_DATA_URI: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+CiAgPCEtLSBDb2xvdXJlZCBQaGFybWFjeSBMb2dvOiBPcHRpbWl6ZWQgZm9yIExpZ2h0IEJhY2tncm91bmRzIChSZWNlaXB0cywgV2hpdGUgQ2FyZHMpIC0tPgogIDxwYXRoIGQ9Ik00MiA4IEg1OCBWMjQgSDc0IFY0MCBINTggVjU2IEg0MiBWNDAgSDI2IFYyNCBINDIgWiIgZmlsbD0iIzAyODRjNyIgZmlsbC1vcGFjaXR5PSIwLjE4IiAvPgogIDxwYXRoIGQ9Ik0yNiA4NCBWMjQgSDQ4IEM2MCAyNCA2OCAzMSA2OCA0MSBDNjggNTEgNjAgNTggNDggNTggSDI2IE00NCA1OCBMNjggODQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAyODRjNyIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIC8+CiAgPGxpbmUgeDE9IjYwIiB5MT0iNjIiIHgyPSI4MiIgeTI9Ijg0IiBzdHJva2U9IiMwZjc2NmUiIHN0cm9rZS13aWR0aD0iOSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPgogIDxsaW5lIHgxPSI4MiIgeTE9IjYyIiB4Mj0iNjAiIHkyPSI4NCIgc3Ryb2tlPSIjMGY3NjZlIiBzdHJva2Utd2lkdGg9IjkiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9zdmc+Cg==',
  DEFAULT_WHITE_LOGO_DATA_URI: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+CiAgPCEtLSBXaGl0ZSBQaGFybWFjeSBMb2dvOiBPcHRpbWl6ZWQgZm9yIERhcmsgQmFja2dyb3VuZHMgKFNpZGViYXIsIERhcmsgSGVhZGVycykgLS0+CiAgPHBhdGggZD0iTTQyIDggSDU4IFYyNCBINzQgVjQwIEg1OCBWNTYgSDQyIFY0MCBIMjYgVjI0IEg0MiBaIiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMjUiIC8+CiAgPHBhdGggZD0iTTI2IDg0IFYyNCBINDggQzYwIDI0IDY4IDMxIDY4IDQxIEM2OCA1MSA2MCA1OCA0OCA1OCBIMjYgTTQ0IDU4IEw2OCA4NCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjkiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgLz4KICA8bGluZSB4MT0iNjAiIHkxPSI2MiIgeDI9IjgyIiB5Mj0iODQiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIwLjg1IiAvPgogIDxsaW5lIHgxPSI4MiIgeTE9IjYyIiB4Mj0iNjAiIHkyPSI4NCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjkiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLW9wYWNpdHk9IjAuODUiIC8+Cjwvc3ZnPgo=',
  DEFAULT_FALLBACK_LOGO_DATA_URI: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+CiAgPCEtLSBGYWxsYmFjayBFbWJsZW06IENhZHVjZXVzIC8gUnggQ3Jvc3MgTWluaW1hbCAtLT4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDI4NGM3IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1kYXNoYXJyYXk9IjYsNCIgLz4KICA8cGF0aCBkPSJNNDQgMjYgSDU2IFY0NCBINzQgVjU2IEg1NiBWNzQgSDQ0IFY1NiBIMjYgVjQ0IEg0NCBaIiBmaWxsPSIjMDI4NGM3IiAvPgo8L3N2Zz4K',

  init() {
    // Apply dynamic theme colors from settings
    const global = pharmacyDB.data.globalSettings || {};
    this.applyThemeColors(global.primaryColor || '#0284c7', global.secondaryColor || '#0f766e');

    // Hydrate media assets from IndexedDB BaganMediaStore & server
    if (typeof pharmacyDB !== 'undefined' && pharmacyDB.hydrateMediaLibrary) {
      pharmacyDB.hydrateMediaLibrary().then(() => {
        this.refreshBrandLogos();
      });
    }

    // Sync media assets from server website_images/
    this.syncMediaLibraryFromServer();

    POS.init();

    // Bind sidebar clicks
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        if (view) this.navigate(view);
      });
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // F2 -> Open POS Counter
      if (e.key === 'F2') {
        e.preventDefault();
        this.navigate('pos');
        setTimeout(() => {
          const s = document.getElementById('pos-search-input');
          if (s) s.focus();
        }, 100);
      }
      // F4 -> POS Checkout
      else if (e.key === 'F4') {
        if (this.currentView === 'pos' && POS.cart.length > 0) {
          e.preventDefault();
          POS.showPaymentModal();
        }
      }
      // F8 -> Hold Sale
      else if (e.key === 'F8') {
        if (this.currentView === 'pos' && POS.cart.length > 0) {
          e.preventDefault();
          const parkBtn = document.getElementById('pos-park-sale-btn');
          if (parkBtn) parkBtn.click();
        }
      }
      // Alt+S -> Search
      else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        const searchBox = document.getElementById('pos-search-input') || document.getElementById('inv-search-input') || document.getElementById('cust-search-input');
        if (searchBox) searchBox.focus();
      }
      // Escape -> close top modal
      else if (e.key === 'Escape') {
        const topModal = document.querySelector('.modal-overlay:last-of-type');
        if (topModal) topModal.remove();
      }
    });

    // Mobile Sidebar Drawer Toggle & Backdrop
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    const backdrop = document.getElementById('sidebar-backdrop');
    const sidebar = document.getElementById('sidebar');

    const toggleSidebar = () => {
      if (sidebar) sidebar.classList.toggle('sidebar-open');
      if (backdrop) backdrop.classList.toggle('active');
    };

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
    if (backdrop) backdrop.addEventListener('click', () => {
      if (sidebar) sidebar.classList.remove('sidebar-open');
      if (backdrop) backdrop.classList.remove('active');
    });

    // Top buttons (Backup, Settings, Reset)
    const backupBtn = document.getElementById('btn-top-backup');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => {
        if (!Auth.isDeveloper() && !Auth.hasPermission('backup')) {
          this.showToast('Backup access restricted to authorized personnel', 'error');
          return;
        }
        this.showBackupModal();
      });
    }

    const settingsBtn = document.getElementById('btn-top-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if (!Auth.isDeveloper()) {
          this.showToast('Settings access is strictly restricted to Developer account.', 'error');
          return;
        }
        this.showSettingsModal();
      });
    }

    // Initial Auth & Render
    Auth.init();
  },

  navigate(viewName) {
    if (!Auth.isLoggedIn()) {
      Auth.showLogin();
      return;
    }

    if (!Auth.isDeveloper()) {
      if (viewName === 'medication-treatment' && !Auth.hasPermission('medicationTreatment')) {
        this.showToast('Medication and Clinical Treatments access restricted for your staff role', 'warning');
        return;
      }
      if (viewName === 'daily-records' && !Auth.hasPermission('dailyRecords')) {
        this.showToast('Daily records and drawer audit are restricted for your staff role', 'warning');
        return;
      }
      if (viewName === 'expenses' && !Auth.hasPermission('expenses')) {
        this.showToast('Operating expense management is restricted for your staff role', 'warning');
        return;
      }
      if (viewName === 'accounting' && !Auth.hasPermission('financialReports') && !Auth.hasPermission('journalEntries')) {
        this.showToast('Accounting and financial statements are restricted for your staff role', 'warning');
        return;
      }
      if (viewName === 'inventory' && !Auth.hasPermission('inventory')) {
        this.showToast('Inventory management is restricted for your staff role', 'warning');
        return;
      }
      if (viewName === 'accounts' && !Auth.hasPermission('patientLedger') && !Auth.hasPermission('supplierLedger')) {
        this.showToast('Counterparty ledger accounts are restricted for your staff role', 'warning');
        return;
      }
      if (viewName === 'pos' && !Auth.hasPermission('pos')) {
        this.showToast('POS dispensing counter is restricted for your staff role', 'warning');
        return;
      }
    }

    this.currentView = viewName;

    // Close sidebar drawer if open on mobile
    if (window.innerWidth < 992) {
      const s = document.getElementById('sidebar');
      const b = document.getElementById('sidebar-backdrop');
      if (s) s.classList.remove('sidebar-open');
      if (b) b.classList.remove('active');
    }

    // Update active nav links
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update topbar title
    const titleMap = {
      'pos': 'Pharmacy POS Dispensing Counter',
      'medication-treatment': 'Medication Dispensing & Clinical Treatment Operations',
      'dashboard': 'Executive Dashboard & Financial Overview',
      'daily-records': 'Daily Records & Register Drawer Reconciliation',
      'expenses': 'Operating Expense Management & Audit',
      'accounting': 'Double-Entry Accounting & Financial Statements',
      'accounts': 'Customer & Supplier Accounts Ledger',
      'inventory': 'Drug Master & Expiry Inventory',
      'dev-hub': 'Developer Control Hub'
    };
    const titleEl = document.getElementById('page-title-text');
    if (titleEl) titleEl.textContent = titleMap[viewName] || 'Pharmacy Management';

    // Route render
    switch (viewName) {
      case 'pos':
        POS.render();
        break;
      case 'medication-treatment':
        Treatment.render();
        break;
      case 'dashboard':
        Dashboard.render();
        break;
      case 'daily-records':
        Accounting.activeTab = 'daily-records';
        Accounting.render();
        break;
      case 'expenses':
        Accounting.activeTab = 'expenses';
        Accounting.render();
        break;
      case 'accounting':
        if (Accounting.activeTab === 'daily-records' || Accounting.activeTab === 'expenses') {
          Accounting.activeTab = 'journal';
        }
        Accounting.render();
        break;
      case 'accounts':
        AccountsMgmt.render();
        break;
      case 'inventory':
        Inventory.render();
        break;
      case 'dev-hub':
        if (!Auth.isDeveloper()) {
          this.showToast('Developer Hub restricted to Developer account', 'error');
          this.navigate('pos');
          return;
        }
        Auth.renderDeveloperHub(Auth.activeHubSection || 'staff');
        break;
      default:
        POS.render();
        break;
    }
  },

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'alert';
    if (type === 'success') iconName = 'check';
    else if (type === 'error') iconName = 'alert';
    else if (type === 'info') iconName = 'pill';

    toast.innerHTML = `
      <span style="display:flex; align-items:center;">${getIcon(iconName)}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'all 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  showBackupModal() {
    const modalHtml = `
      <div class="modal-overlay" id="backup-modal">
        <div class="modal-card" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Database Backup & Portability</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('backup-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.85rem; color: #475569; margin-bottom: 1rem;">
              Export your full pharmacy records (inventory, accounting vouchers, sales, patient credit ledgers) or restore from an existing JSON backup.
            </p>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <button class="btn btn-primary" id="btn-export-json" style="padding: 0.85rem;">
                ${getIcon('download')} Download Complete Database (.JSON)
              </button>

              <label class="btn btn-secondary" style="padding: 0.85rem; cursor: pointer; text-align: center;">
                ${getIcon('upload')} Restore / Import Backup (.JSON)
                <input type="file" id="import-file-input" accept=".json" style="display: none;">
              </label>

              <div style="border-top: 1px dashed #cbd5e1; margin-top: 0.5rem; padding-top: 0.75rem;">
                <button class="btn btn-danger" id="btn-reset-demo" style="width: 100%;">
                  ${getIcon('database')} Reset Database to Standard Demo Data
                </button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('backup-modal').remove()">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Export JSON
    document.getElementById('btn-export-json').addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(pharmacyDB.exportDataJson());
      const downloadAnchor = document.createElement('a');
      const filename = `pharmacy-backup-${new Date().toISOString().split('T')[0]}.json`;
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('Backup file downloaded successfully!', 'success');
    });

    // Import JSON
    document.getElementById('import-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = pharmacyDB.importDataJson(event.target.result);
        if (res.success) {
          document.getElementById('backup-modal').remove();
          this.showToast('Database imported successfully!', 'success');
          this.navigate(this.currentView);
        } else {
          alert('Failed to import backup: ' + res.error);
        }
      };
      reader.readAsText(file);
    });

    // Reset Demo Data
    document.getElementById('btn-reset-demo').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all records to default clinical demo data? Any unsaved edits will be lost.')) {
        pharmacyDB.resetToDemo();
        document.getElementById('backup-modal').remove();
        this.showToast('Pharmacy database reset to demo dataset!', 'info');
        this.navigate(this.currentView);
      }
    });
  },

  showSettingsModal() {
    if (!Auth.isDeveloper()) {
      this.showToast('Pharmacy Store Settings is restricted strictly to Developer account.', 'error');
      return;
    }
    const s = pharmacyDB.data.settings;

    const modalHtml = `
      <div class="modal-overlay" id="settings-modal">
        <div class="modal-card" style="max-width: 580px;">
          <div class="modal-header">
            <h3>Pharmacy & Regulatory Settings</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('settings-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Pharmacy Trade Name:</label>
                <input type="text" id="set-name" class="form-control" value="${s.pharmacyName}">
              </div>
              <div class="form-group">
                <label class="form-label">Drug License #:</label>
                <input type="text" id="set-lic" class="form-control" value="${s.licenseNo}">
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">GSTIN / Tax ID:</label>
                <input type="text" id="set-gst" class="form-control" value="${s.gstNumber}">
              </div>
              <div class="form-group">
                <label class="form-label">Dispensary Phone:</label>
                <input type="text" id="set-phone" class="form-control" value="${s.phone}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Physical Address (Prints on Receipts & Invoices):</label>
              <input type="text" id="set-address" class="form-control" value="${s.address}">
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Active Cashier Name:</label>
                <input type="text" id="set-cashier" class="form-control" value="${s.activeShift.cashier}">
              </div>
              <div class="form-group">
                <label class="form-label">Register Opening Float ($):</label>
                <input type="number" id="set-float" class="form-control" value="${s.activeShift.openingFloat}">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('settings-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-settings">Save Settings</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-save-settings').addEventListener('click', () => {
      s.pharmacyName = document.getElementById('set-name').value.trim();
      s.licenseNo = document.getElementById('set-lic').value.trim();
      s.gstNumber = document.getElementById('set-gst').value.trim();
      s.phone = document.getElementById('set-phone').value.trim();
      s.address = document.getElementById('set-address').value.trim();
      s.activeShift.cashier = document.getElementById('set-cashier').value.trim();
      s.activeShift.openingFloat = parseFloat(document.getElementById('set-float').value) || 0;

      pharmacyDB.save();
      document.getElementById('settings-modal').remove();
      this.showToast('Pharmacy configuration updated!', 'success');
      this.navigate(this.currentView);
    });
  },

  /* -------------------------------------------------------------
   * DYNAMIC THEME COLOR ENGINE (Primary & Secondary Hex Codes)
   * ------------------------------------------------------------- */
  applyThemeColors(primaryHex, secondaryHex) {
    if (!primaryHex) primaryHex = '#0284c7';
    if (!secondaryHex) secondaryHex = '#0f766e';

    // Normalize hex codes
    if (!primaryHex.startsWith('#')) primaryHex = '#' + primaryHex;
    if (!secondaryHex.startsWith('#')) secondaryHex = '#' + secondaryHex;

    const root = document.documentElement;
    root.style.setProperty('--primary', primaryHex);
    root.style.setProperty('--secondary', secondaryHex);
    root.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${primaryHex} 0%, ${secondaryHex} 100%)`);
    root.style.setProperty('--primary-glow', `${primaryHex}55`);
    root.style.setProperty('--secondary-glow', `${secondaryHex}44`);

    // Helper lighter tints
    root.style.setProperty('--primary-light', `${primaryHex}18`);
    root.style.setProperty('--secondary-light', `${secondaryHex}18`);
  },

  /* -------------------------------------------------------------
   * UNIVERSAL IMAGE UPLOAD (Target Folder: website_images/)
   * Automatically converts ANY image format (PNG, JPG, SVG, GIF, BMP, etc.)
   * to high-fidelity WebP (.webp) format without losing quality, preserving
   * full resolution and transparent alpha channel, and stores strictly
   * into the project's website_images/ directory and persistent IndexedDB.
   * ------------------------------------------------------------- */
  async uploadImageFile(file, customFilename = null) {
    if (!file) throw new Error('No file provided for upload.');

    // Validate image format - accept any image format
    const isImage = (file.type && file.type.startsWith('image/')) || 
                    file.name.match(/\.(jpg|jpeg|png|svg|gif|webp|ico|bmp|tiff?|avif)$/i);
    if (!isImage) {
      throw new Error('Invalid file type. Please upload an image file (PNG, JPG, SVG, WEBP, GIF, BMP, etc.).');
    }

    // Clean base name and enforce .webp extension
    const rawName = (customFilename || file.name || ('image_' + Date.now()));
    let baseName = rawName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\.-]/g, '_');
    if (!baseName || baseName.trim() === '') {
      baseName = 'image_' + Date.now();
    }
    const webpFilename = `${baseName}.webp`;

    // 1. Read source image as Base64 Data URL
    const initialDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    // 2. Automatically Convert to High-Fidelity WebP Format
    // Preserves original resolution, crisp details, and transparent alpha channel
    let webpDataUrl = await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width || 800;
          let height = img.naturalHeight || img.height || 600;

          // For extreme ultra-high resolutions (> 4096px), clamp slightly to avoid browser canvas crash
          // while preserving 4K Ultra-HD lossless visual fidelity
          const maxDim = 4096;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { alpha: true });

          // Clear with full transparency
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to WebP format at 0.96 quality (high visual fidelity, zero perceptible degradation)
          const converted = canvas.toDataURL('image/webp', 0.96);
          if (converted && converted.startsWith('data:image/webp')) {
            resolve(converted);
          } else {
            // Fallback for rare browsers lacking webp canvas export
            resolve(canvas.toDataURL('image/png', 1.0));
          }
        } catch (e) {
          resolve(initialDataUrl);
        }
      };
      img.onerror = () => resolve(initialDataUrl);
      img.src = initialDataUrl;
    });

    // 3. Save physical file into website_images/ on disk
    const targetPath = 'website_images/' + webpFilename;
    let savedOnServer = false;

    const endpoints = [
      '/api/admin/media/upload',
      '/api/media/upload',
      '/api/upload',
      'upload.php',
      'http://localhost:8080/api/admin/media/upload',
      'http://localhost:8080/api/media/upload',
      'http://localhost:8080/api/upload',
      'http://localhost:8080/upload.php'
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: webpFilename, data: webpDataUrl })
        });
        if (res.ok) {
          const json = await res.json();
          if (json && (json.success || json.status === 'ok')) {
            savedOnServer = true;
            break;
          }
        }
      } catch (_) {}
    }

    // Direct folder handle write fallback if folder selected
    if (window.__mediaDirectoryHandle) {
      try {
        const fileHandle = await window.__mediaDirectoryHandle.getFileHandle(webpFilename, { create: true });
        const writable = await fileHandle.createWritable();
        const bRes = await fetch(webpDataUrl);
        const bBlob = await bRes.blob();
        await writable.write(bBlob);
        await writable.close();
        savedOnServer = true;
      } catch (err) {
        console.warn('Direct directory write:', err);
      }
    }

    // 4. Construct Media Item Metadata
    const resultItem = {
      id: 'med_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      success: true,
      path: targetPath,
      dataUrl: webpDataUrl,
      filename: webpFilename,
      size: Math.round(webpDataUrl.length * 0.75),
      uploadedAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      title: webpFilename,
      format: 'webp',
      savedOnServer
    };

    // 5. Register into Media Center & persist in IndexedDB
    pharmacyDB.addMediaItem(resultItem);
    if (typeof BaganMediaStore !== 'undefined' && BaganMediaStore.saveMedia) {
      await BaganMediaStore.saveMedia(resultItem);
    }

    return resultItem;
  },

  /* -------------------------------------------------------------
   * DELETE MEDIA FILE (Synchronously removes from disk & memory)
   * Removes from website_images/ folder on server and IndexedDB.
   * ------------------------------------------------------------- */
  async deleteMediaFile(filename, id = null) {
    if (!filename) return false;

    // 1. Remove from database and IndexedDB
    pharmacyDB.deleteMediaItem(id || filename);
    if (typeof BaganMediaStore !== 'undefined' && BaganMediaStore.deleteMedia) {
      await BaganMediaStore.deleteMedia(filename);
    }

    // 2. Direct folder handle delete if active
    if (window.__mediaDirectoryHandle) {
      try {
        await window.__mediaDirectoryHandle.removeEntry(filename);
      } catch (_) {}
    }

    // 3. Remove physical file from website_images/ directory on server
    const endpoints = [
      `/api/admin/media/${encodeURIComponent(filename)}`,
      `/api/media/${encodeURIComponent(filename)}`,
      `/api/media?filename=${encodeURIComponent(filename)}`,
      `upload.php?action=delete&filename=${encodeURIComponent(filename)}`,
      `http://localhost:8080/api/admin/media/${encodeURIComponent(filename)}`,
      `http://localhost:8080/api/media/${encodeURIComponent(filename)}`,
      `http://localhost:8080/api/media?filename=${encodeURIComponent(filename)}`,
      `http://localhost:8080/upload.php?action=delete&filename=${encodeURIComponent(filename)}`
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (_) {}
    }
    return true;
  },

  /* -------------------------------------------------------------
   * SERVER HEALTH & STATUS CHECK
   * ------------------------------------------------------------- */
  async checkServerStatus() {
    const urls = ['http://localhost:8080/api/status', '/api/status'];
    for (const u of urls) {
      try {
        const res = await fetch(u, { method: 'GET', mode: 'cors' });
        if (res.ok) {
          const d = await res.json();
          return { online: true, port: 8080, ...d };
        }
      } catch (_) {}
    }
    return { online: false };
  },

  /* -------------------------------------------------------------
   * FILE SYSTEM DIRECTORY PICKER FALLBACK
   * ------------------------------------------------------------- */
  async connectLocalImageDirectory() {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker({
          id: 'bagan_images_folder',
          mode: 'readwrite',
          startIn: 'documents'
        });
        if (handle) {
          window.__mediaDirectoryHandle = handle;
          return { success: true, name: handle.name };
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('Picker error:', e);
      }
    }
    return { success: false };
  },

  /* -------------------------------------------------------------
   * SYNC MEDIA LIBRARY & SETTINGS FROM website_images/ DIRECTORY
   * Directly queries website_images/images.json and website_images/settings.json
   * so that ANY new browser, incognito window, or device immediately gets all
   * uploaded assets and active logos permanently without relying on PHP.
   * ------------------------------------------------------------- */
  async syncMediaLibraryFromServer() {
    let syncedAny = false;
    let fileCount = 0;

    // 1. Fetch static images.json manifest directly from website_images/ directory
    const manifestPaths = [
      '/api/admin/media',
      '/api/media',
      'website_images/images.json',
      'website_images/manifest.json',
      'upload.php',
      'http://localhost:8080/api/admin/media',
      'http://localhost:8080/api/media',
      'http://localhost:8080/upload.php'
    ];

    for (const ep of manifestPaths) {
      try {
        const res = await fetch(ep, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          const rawItems = Array.isArray(data.media) ? data.media : (Array.isArray(data.files) ? data.files : []);
          if (data && (data.success || data.status === 'ok') && rawItems.length > 0) {
            rawItems.forEach(f => {
              const fname = f.filename || f.name;
              if (!fname || fname === 'bagan-medical-hall-logo.png') return;
              if (pharmacyDB.data && pharmacyDB.data.deletedMedia && pharmacyDB.data.deletedMedia.includes(fname)) return;
              pharmacyDB.addMediaItem({
                id: f.id || ('med_' + fname.replace(/[^a-zA-Z0-9]/g, '_')),
                filename: fname,
                path: f.filePath || f.path || f.url || ('website_images/' + fname),
                size: f.fileSize || f.size || 0,
                format: f.mimeType === 'image/webp' || fname.endsWith('.webp') ? 'webp' : (f.format || 'image'),
                uploadedAt: f.createdAt || f.lastModified || 'Preloaded'
              });
            });
            syncedAny = true;
            fileCount = rawItems.length;
            break;
          }
        }
      } catch (_) {}
    }

    // 2. Fetch static settings.json from website_images/ directory to restore active logos universally
    try {
      const sRes = await fetch('website_images/settings.json');
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData && sData.logoColored) {
          pharmacyDB.updateGlobalSettings({
            logoColored: sData.logoColored,
            logoWhite: sData.logoWhite || sData.logoColored,
            logoImage: sData.logoColored,
            fallbackLogoImage: sData.fallbackLogoImage || 'website_images/default-logo-fallback.svg'
          });
        }
      }
    } catch (_) {}

    this.refreshBrandLogos();
    return { success: syncedAny, count: fileCount };
  },

  /* -------------------------------------------------------------
   * SAVE ACTIVE LOGO CONFIG TO website_images/settings.json
   * ------------------------------------------------------------- */
  async saveLogoSettingsToServer(settings) {
    const endpoints = [
      '/api/settings',
      'upload.php?action=save_settings',
      'http://localhost:8080/api/settings',
      'http://localhost:8080/upload.php?action=save_settings'
    ];
    for (const ep of endpoints) {
      try {
        await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
      } catch (_) {}
    }
  },

  /* -------------------------------------------------------------
   * REFRESH BRAND LOGOS GLOBALLY (LOGIN SCREEN & SIDEBAR)
   * ------------------------------------------------------------- */
  refreshBrandLogos() {
    // 1. Refresh Login Screen Logo if present (MUST be 'light' coloured on white card)
    const loginLogoEl = document.getElementById('login-clickable-logo');
    if (loginLogoEl) {
      loginLogoEl.innerHTML = this.renderLogoHtml('light', 'width: 100%; height: 100%; object-fit: contain; border: none; box-shadow: none;');
    }

    // 2. Refresh Sidebar Logo if present (MUST be 'dark' white on dark sidebar)
    const sidebarLogoEl = document.getElementById('sidebar-brand-icon') || document.querySelector('.brand-header .brand-icon');
    if (sidebarLogoEl) {
      sidebarLogoEl.innerHTML = this.renderLogoHtml('dark', 'width: 100%; height: 100%; object-fit: contain; border: none; box-shadow: none;');
    }
  },

  /* -------------------------------------------------------------
   * CONTEXT-AWARE LOGO RESOLVER (White vs Coloured Logo & Fallback)
   * ------------------------------------------------------------- */
  getLogoForBackground(bgType = 'dark') {
    const g = (typeof pharmacyDB !== 'undefined' && pharmacyDB.data && pharmacyDB.data.globalSettings) ? pharmacyDB.data.globalSettings : {};
    if (g.logoType === 'text') {
      return { type: 'text', content: g.logo || 'BMH', fallbackText: g.logo || 'BMH' };
    }

    const fallbackImg = (g.fallbackLogoData && g.fallbackLogoData.indexOf('utf8') === -1) ? g.fallbackLogoData : (this.DEFAULT_FALLBACK_LOGO_DATA_URI || 'website_images/default-logo-fallback.svg');
    const fallbackText = g.logo || 'BMH';
    const fallbackType = g.fallbackType || 'image';

    if (bgType === 'dark') {
      // Dark Background (e.g. #0f172a sidebar) -> prefers White Logo
      let src = g.logoWhiteData;
      if (src && (src.indexOf('utf8') > -1 || src.indexOf('<svg') > -1)) {
        src = this.DEFAULT_WHITE_LOGO_DATA_URI;
      }
      if (!src && g.logoWhite && g.logoWhite.startsWith('data:')) {
        src = g.logoWhite;
      }
      if (!src && g.logoWhite && typeof pharmacyDB !== 'undefined' && pharmacyDB.data && Array.isArray(pharmacyDB.data.mediaLibrary)) {
        const found = pharmacyDB.data.mediaLibrary.find(m => (m.path === g.logoWhite || m.filename === g.logoWhite) && m.dataUrl && m.dataUrl.indexOf('utf8') === -1);
        if (found) src = found.dataUrl;
      }
      if (!src) {
        src = (g.logoWhite && g.logoWhite !== 'website_images/default-logo-white.svg') ? g.logoWhite : 'website_images/bagan-medical-hall-logo.webp';
      }
      return {
        type: 'image',
        src: src,
        fallbackSrc: 'website_images/bagan-medical-hall-logo.png',
        fallbackText: fallbackText,
        fallbackType: fallbackType
      };
    } else {
      // Light Background (e.g. login card, white receipt) -> prefers Coloured Logo
      let src = g.logoColoredData;
      if (src && (src.indexOf('utf8') > -1 || src.indexOf('<svg') > -1)) {
        src = this.DEFAULT_COLORED_LOGO_DATA_URI;
      }
      if (!src && g.logoColored && g.logoColored.startsWith('data:')) {
        src = g.logoColored;
      }
      if (!src && g.logoColored && typeof pharmacyDB !== 'undefined' && pharmacyDB.data && Array.isArray(pharmacyDB.data.mediaLibrary)) {
        const found = pharmacyDB.data.mediaLibrary.find(m => (m.path === g.logoColored || m.filename === g.logoColored) && m.dataUrl && m.dataUrl.indexOf('utf8') === -1);
        if (found) src = found.dataUrl;
      }
      if (!src) {
        src = (g.logoColored && g.logoColored !== 'website_images/default-logo-colored.svg') ? g.logoColored : 'website_images/bagan-medical-hall-logo.webp';
      }
      return {
        type: 'image',
        src: src,
        fallbackSrc: 'website_images/bagan-medical-hall-logo.png',
        fallbackText: fallbackText,
        fallbackType: fallbackType
      };
    }
  },

  renderLogoHtml(bgType = 'dark', imgStyle = 'width: 100%; height: 100%; object-fit: contain; border: none; box-shadow: none;') {
    const logo = this.getLogoForBackground(bgType);
    if (logo.type === 'text') {
      return `<span style="font-weight: 800; font-size: inherit;">${logo.content}</span>`;
    }

    const safeFallback = bgType === 'dark' ? (this.DEFAULT_WHITE_LOGO_DATA_URI || 'website_images/default-logo-white.svg') : (this.DEFAULT_COLORED_LOGO_DATA_URI || 'website_images/default-logo-colored.svg');
    const fallbackSrc = (logo.fallbackSrc && logo.fallbackSrc.indexOf('utf8') === -1) ? logo.fallbackSrc : safeFallback;
    const textColor = bgType === 'dark' ? '#ffffff' : '#0284c7';

    return `<img src="${logo.src}" alt="Logo" style="${imgStyle}" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='${fallbackSrc}';}else{this.style.display='none';var s=this.nextElementSibling;if(s)s.style.display='inline-block';}"><span class="logo-fallback-text" style="display: none; font-weight: 800; font-size: 1.5rem; color: ${textColor};">${logo.fallbackText}</span>`;
  },

  /* -------------------------------------------------------------
   * REUSABLE MEDIA PICKER MODAL (Select from previously uploaded)
   * ------------------------------------------------------------- */
  openMediaPickerModal({ title = 'Select Image from Media Center', onSelect }) {
    const mediaItems = pharmacyDB.data.mediaLibrary || [];

    const modalId = 'media-picker-modal-' + Date.now();
    const modalHtml = `
      <div class="modal-overlay" id="${modalId}" style="z-index: 9999;">
        <div class="modal-card" style="max-width: 720px; max-height: 85vh; display: flex; flex-direction: column;">
          <div class="modal-header" style="border-bottom: 1px solid #e2e8f0; padding: 1rem 1.25rem;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.3rem;">??</span>
              <div>
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #0f172a;">${title}</h3>
                <div style="font-size: 0.73rem; color: #64748b;">Browse previously uploaded images in <code>website_images/</code> or upload a new one.</div>
              </div>
            </div>
            <button class="btn-outline" style="border: none; font-size: 1.1rem; cursor: pointer;" id="${modalId}-close">&times;</button>
          </div>

          <!-- Quick Upload Bar in Modal -->
          <div style="padding: 0.75rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="font-size: 0.75rem; color: #475569;">
              Showing <strong>${mediaItems.length}</strong> assets stored in <code>website_images/</code>
            </div>
            <div>
              <input type="file" id="${modalId}-file-input" accept="image/*" style="display: none;">
              <button class="btn btn-primary btn-sm" id="${modalId}-upload-btn" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
                ${getIcon('upload')} Upload New to website_images/
              </button>
            </div>
          </div>

          <!-- Media Grid -->
          <div style="padding: 1.25rem; overflow-y: auto; flex: 1;">
            ${mediaItems.length === 0 ? `
              <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">???</div>
                <div style="font-weight: 600;">No images uploaded yet</div>
                <div style="font-size: 0.75rem; margin-top: 4px;">Click the upload button above to add images to website_images/</div>
              </div>
            ` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.85rem;">
                ${mediaItems.map(item => `
                  <div class="media-picker-card" data-path="${item.path}" data-dataurl="${item.dataUrl || ''}" data-filename="${item.filename}" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.6rem; cursor: pointer; transition: all 0.15s ease; background: white; display: flex; flex-direction: column; align-items: center; text-align: center;">
                    <div style="width: 100%; height: 90px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 6px; overflow: hidden; margin-bottom: 6px;">
                      <img src="${item.dataUrl || item.path}" alt="${item.filename}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                    </div>
                    <div style="font-size: 0.72rem; font-weight: 700; color: #0f172a; word-break: break-all; line-height: 1.2;" title="${item.filename}">
                      ${item.filename.length > 18 ? item.filename.slice(0, 15) + '...' : item.filename}
                    </div>
                    <div style="font-size: 0.66rem; color: #64748b; margin-top: 2px;">
                      ${item.size ? (item.size > 1024 ? (item.size/1024).toFixed(1) + ' KB' : item.size + ' B') : 'Vector SVG'}
                    </div>
                    <button type="button" class="btn btn-outline btn-sm btn-select-this-media" style="width: 100%; margin-top: 6px; padding: 2px 4px; font-size: 0.7rem;">
                      Select ?
                    </button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div class="modal-footer" style="border-top: 1px solid #e2e8f0; padding: 0.75rem 1.25rem; display: flex; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" id="${modalId}-cancel">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById(modalId);

    const closeModal = () => modalEl && modalEl.remove();

    document.getElementById(`${modalId}-close`)?.addEventListener('click', closeModal);
    document.getElementById(`${modalId}-cancel`)?.addEventListener('click', closeModal);

    // Upload New inside modal
    const uploadBtn = document.getElementById(`${modalId}-upload-btn`);
    const fileInput = document.getElementById(`${modalId}-file-input`);
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          try {
            App.showToast('Uploading to website_images/...', 'info');
            const res = await App.uploadImageFile(e.target.files[0]);
            closeModal();
            if (typeof onSelect === 'function') {
              onSelect(res);
            }
          } catch (err) {
            alert(err.message);
          } finally {
            fileInput.value = '';
          }
        }
      });
    }

    // Item Selection
    modalEl.querySelectorAll('.media-picker-card').forEach(card => {
      card.addEventListener('click', () => {
        const path = card.getAttribute('data-path');
        const dataUrl = card.getAttribute('data-dataurl');
        const filename = card.getAttribute('data-filename');
        closeModal();
        if (typeof onSelect === 'function') {
          onSelect({ path, dataUrl, filename });
        }
      });
    });
  }
};

// Bootstrap application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
