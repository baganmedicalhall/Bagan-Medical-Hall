/**
 * Master Application Coordinator & Navigation Router
 */

const App = {
  currentView: 'pos', // default to POS counter for fast access

  init() {
    // Apply dynamic theme colors from settings
    const global = pharmacyDB.data.globalSettings || {};
    this.applyThemeColors(global.primaryColor || '#0284c7', global.secondaryColor || '#0f766e');

    // Hydrate media assets from IndexedDB BaganMediaStore & server
    if (typeof pharmacyDB !== 'undefined' && pharmacyDB.hydrateMediaLibrary) {
      pharmacyDB.hydrateMediaLibrary().then(() => {
        const brandLogo = document.querySelector('.brand-icon');
        if (brandLogo) brandLogo.innerHTML = this.renderLogoHtml('dark');
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
   * Supports local PowerShell server (/api/upload), cPanel PHP (upload.php),
   * and resilient IndexedDB & Base64 persistence.
   * ------------------------------------------------------------- */
  async uploadImageFile(file, customFilename = null) {
    if (!file) throw new Error('No file provided for upload.');

    // Validate image format
    const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp', 'image/x-icon'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|svg|gif|webp|ico)$/i)) {
      throw new Error('Invalid file type. Please upload an image file (PNG, JPG, SVG, WEBP, GIF, ICO).');
    }

    // Clean filename
    let filename = (customFilename || file.name || 'image_' + Date.now()).replace(/[^a-zA-Z0-9_\.-]/g, '_');
    if (!filename.includes('.')) {
      const ext = file.type.split('/')[1] || 'png';
      filename += '.' + (ext === 'svg+xml' ? 'svg' : ext);
    }

    // Read initial Base64 Data URL
    let base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    // Optimize/Compress raster images (max 1200x1200px) to ensure instantaneous loading and zero storage bloat
    if (file.type !== 'image/svg+xml') {
      try {
        base64Data = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const maxDim = 1200;
            let width = img.width;
            let height = img.height;
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
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const isJpeg = (file.type === 'image/jpeg' || file.name.match(/\.jpe?g$/i));
            const outFormat = isJpeg ? 'image/jpeg' : 'image/png';
            const quality = isJpeg ? 0.88 : 0.92;
            resolve(canvas.toDataURL(outFormat, quality));
          };
          img.onerror = () => resolve(base64Data);
          img.src = base64Data;
        });
      } catch (_) {}
    }

    const targetPath = 'website_images/' + filename;
    let savedOnServer = false;

    // 1. Try PowerShell local server endpoint (/api/upload)
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, data: base64Data })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) savedOnServer = true;
      }
    } catch (e) {
      // Endpoint not available or running file://
    }

    // 2. If not saved, try cPanel upload.php
    if (!savedOnServer) {
      try {
        const res = await fetch('upload.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, data: base64Data })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) savedOnServer = true;
        }
      } catch (e) {
        // Not on PHP host
      }
    }

    const resultItem = {
      id: 'med_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      success: true,
      path: targetPath,
      dataUrl: base64Data,
      filename,
      size: file.size || Math.round(base64Data.length * 0.75),
      uploadedAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      title: filename,
      savedOnServer
    };

    // Register into Media Center & persist in IndexedDB
    pharmacyDB.addMediaItem(resultItem);
    if (typeof BaganMediaStore !== 'undefined' && BaganMediaStore.saveMedia) {
      await BaganMediaStore.saveMedia(resultItem);
    }

    return resultItem;
  },

  /* -------------------------------------------------------------
   * SYNC MEDIA LIBRARY FROM SERVER (website_images/)
   * ------------------------------------------------------------- */
  async syncMediaLibraryFromServer() {
    try {
      const endpoints = ['upload.php', '/api/media'];
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { method: 'GET' });
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && Array.isArray(data.files)) {
              data.files.forEach(f => {
                pharmacyDB.addMediaItem({
                  id: 'med_' + f.filename.replace(/[^a-zA-Z0-9]/g, '_'),
                  filename: f.filename,
                  path: f.path || ('website_images/' + f.filename),
                  size: f.size || 0,
                  uploadedAt: f.lastModified || new Date().toISOString()
                });
              });
              break;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  },

  /* -------------------------------------------------------------
   * CONTEXT-AWARE LOGO RESOLVER (White vs Coloured Logo & Fallback)
   * ------------------------------------------------------------- */
  getLogoForBackground(bgType = 'dark') {
    const g = pharmacyDB.data.globalSettings || {};
    if (g.logoType === 'text') {
      return { type: 'text', content: g.logo || 'Rx', fallbackText: g.logo || 'Rx' };
    }

    const fallbackImg = g.fallbackLogoData || g.fallbackLogoImage || 'website_images/default-logo-fallback.svg';
    const fallbackText = g.logo || 'Rx';
    const fallbackType = g.fallbackType || 'image';

    if (bgType === 'dark') {
      // Dark Background (e.g. #0f172a sidebar) -> prefers White Logo
      const src = g.logoWhiteData || g.logoWhite || 'website_images/default-logo-white.svg';
      return {
        type: 'image',
        src: src,
        fallbackSrc: fallbackImg,
        fallbackText: fallbackText,
        fallbackType: fallbackType
      };
    } else {
      // Light Background (e.g. login card, white receipt) -> prefers Coloured Logo
      const src = g.logoColoredData || g.logoColored || g.logoImage || 'website_images/default-logo-colored.svg';
      return {
        type: 'image',
        src: src,
        fallbackSrc: fallbackImg,
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

    // For image logos, provide resilient fallback:
    if (logo.fallbackType === 'image' && logo.fallbackSrc) {
      return `<img src="${logo.src}" alt="Logo" style="${imgStyle}" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='${logo.fallbackSrc}';}else{this.style.display='none';this.parentElement.insertAdjacentHTML('beforeend','<span style=\\'font-weight:800; font-size:1.5rem;\\'>${logo.fallbackText}</span>');}">`;
    } else {
      return `<img src="${logo.src}" alt="Logo" style="${imgStyle}" onerror="this.style.display='none';this.parentElement.insertAdjacentHTML('beforeend','<span style=\\'font-weight:800; font-size:1.5rem;\\'>${logo.fallbackText}</span>');">`;
    }
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
              <span style="font-size: 1.3rem;">📁</span>
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
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🖼️</div>
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
                      Select ✓
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
