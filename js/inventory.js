/**
 * Pharmacy Stock, Expiry & Medicine Master Module
 * Tracks FEFO batches, near-expiry alerts, stock quarantine write-offs, and reorder levels.
 */

const Inventory = {
  activeTab: 'all', // 'all', 'near-expiry', 'low-stock'
  searchQuery: '',
  categoryFilter: 'ALL',

  render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    // Filter logic
    let list = pharmacyDB.data.medicines;
    const today = new Date();

    if (this.activeTab === 'near-expiry') {
      list = list.filter(m => {
        const exp = new Date(m.expiryDate);
        const days = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        return days <= 90;
      });
    } else if (this.activeTab === 'low-stock') {
      list = list.filter(m => m.stock <= m.reorderLevel);
    }

    if (this.categoryFilter !== 'ALL') {
      list = list.filter(m => m.category.toLowerCase().includes(this.categoryFilter.toLowerCase()));
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(m => 
        m.brandName.toLowerCase().includes(q) || 
        m.genericName.toLowerCase().includes(q) || 
        m.batchNo.toLowerCase().includes(q) ||
        m.rack.toLowerCase().includes(q)
      );
    }

    // Key KPIs
    const totalInventoryValue = pharmacyDB.data.medicines.reduce((sum, m) => sum + (m.stock * m.costPrice), 0);
    const lowStockCount = pharmacyDB.data.medicines.filter(m => m.stock <= m.reorderLevel).length;
    const nearExpiryCount = pharmacyDB.data.medicines.filter(m => {
      const diff = Math.ceil((new Date(m.expiryDate) - today) / (1000 * 60 * 60 * 24));
      return diff <= 90;
    }).length;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Top Action Bar & Tabs -->
        <div class="app-card" style="padding: 0.75rem 1.25rem; margin-bottom: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn ${this.activeTab === 'all' ? 'btn-primary' : 'btn-outline'} inv-tab-btn" data-tab="all">
                ${getIcon('inventory')} All Medicines (${pharmacyDB.data.medicines.length})
              </button>
              <button class="btn ${this.activeTab === 'near-expiry' ? 'btn-primary' : 'btn-outline'} inv-tab-btn" data-tab="near-expiry">
                ${getIcon('expiry')} Expiry Watch (${nearExpiryCount})
              </button>
              <button class="btn ${this.activeTab === 'low-stock' ? 'btn-primary' : 'btn-outline'} inv-tab-btn" data-tab="low-stock">
                ${getIcon('alert')} Low Stock Reorder (${lowStockCount})
              </button>
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <div class="quick-stats-chip">
                Valuation (Cost): <strong>$${totalInventoryValue.toFixed(2)}</strong>
              </div>
              ${(typeof Auth === 'undefined' || Auth.hasPermission('inventory')) ? `
                <button class="btn btn-success" id="btn-add-medicine">
                  ${getIcon('plus')} Add Medicine
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Inventory List Card -->
        <div class="app-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">
                ${this.activeTab === 'all' ? 'Pharmacy Drug Master & Stock' : (this.activeTab === 'near-expiry' ? 'Expiry Risk & Quarantine Control' : 'Reorder Alert Desk')}
              </h2>
              <p style="font-size: 0.8rem; color: #64748b;">Batch, rack location, and clinical schedule tracking.</p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" id="inv-search-input" placeholder="Search drug, generic, batch, rack..." class="form-control" style="width: 260px; font-size: 0.82rem;" value="${this.searchQuery}">
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Drug / Generic Molecule</th>
                  <th>Category</th>
                  <th>Batch / Expiry</th>
                  <th>Location (Rack)</th>
                  <th class="text-right">Stock</th>
                  <th class="text-right">Cost ($)</th>
                  <th class="text-right">Sell ($)</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.length === 0 ? `
                  <tr><td colspan="8" class="text-center" style="padding: 2.5rem; color: #94a3b8;">No medicines found in this view</td></tr>
                ` : list.map(med => {
                  const expDate = new Date(med.expiryDate);
                  const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
                  const isExpired = diffDays <= 0;
                  const isNearExp = diffDays <= 60 && !isExpired;
                  const isLow = med.stock <= med.reorderLevel;

                  return `
                    <tr>
                      <td>
                        <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                          ${med.brandName}
                          ${med.isRxRequired ? '<span class="rx-badge">Rx</span>' : ''}
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b;">${med.genericName} (${med.strength || ''})</div>
                      </td>
                      <td>
                        <span style="font-size: 0.75rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569;">
                          ${med.category}
                        </span>
                      </td>
                      <td>
                        <div style="font-weight: 600; font-size: 0.82rem;">${med.batchNo}</div>
                        <div style="font-size: 0.75rem; font-weight: ${isExpired || isNearExp ? '700' : 'normal'}; color: ${isExpired ? '#dc2626' : (isNearExp ? '#d97706' : '#64748b')};">
                          Exp: ${med.expiryDate} ${isExpired ? '(EXPIRED)' : (isNearExp ? `(${diffDays}d left)` : '')}
                        </div>
                      </td>
                      <td>
                        <span style="font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-size: 0.78rem;">
                          ${med.rack}
                        </span>
                      </td>
                      <td class="text-right">
                        <span style="font-weight: 800; font-size: 0.95rem; color: ${med.stock <= 0 ? '#dc2626' : (isLow ? '#d97706' : '#059669')};">
                          ${med.stock}
                        </span>
                        <div style="font-size: 0.7rem; color: #94a3b8;">${med.unit}</div>
                      </td>
                      <td class="text-right" style="font-size: 0.85rem;">$${med.costPrice.toFixed(2)}</td>
                      <td class="text-right" style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">$${med.sellingPrice.toFixed(2)}</td>
                      <td class="text-center">
                        <div style="display: inline-flex; gap: 0.35rem;">
                          ${(typeof Auth === 'undefined' || Auth.hasPermission('inventory')) ? `
                            <button class="btn btn-outline btn-sm btn-edit-med" data-id="${med.id}" title="Edit Medicine">
                              Edit
                            </button>
                          ` : '<span style="font-size:0.75rem; color:#94a3b8;">Read-Only</span>'}
                          ${((isExpired || isNearExp) && (typeof Auth === 'undefined' || Auth.hasPermission('expiryWriteOff'))) ? `
                            <button class="btn btn-danger btn-sm btn-write-off-stock" data-id="${med.id}" title="Quarantine / Write Off Expired Stock">
                              Dispose / Loss
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
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    // Tabs
    document.querySelectorAll('.inv-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        this.render();
      });
    });

    // Search
    const searchInput = document.getElementById('inv-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
      });
    }

    // Add Medicine
    const addMedBtn = document.getElementById('btn-add-medicine');
    if (addMedBtn) {
      addMedBtn.addEventListener('click', () => {
        this.showAddEditModal(null);
      });
    }

    // Edit Medicine
    document.querySelectorAll('.btn-edit-med').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const med = pharmacyDB.data.medicines.find(m => m.id === id);
        this.showAddEditModal(med);
      });
    });

    // Write-off expired medicine
    document.querySelectorAll('.btn-write-off-stock').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.showWriteOffModal(id);
      });
    });
  },

  showAddEditModal(existingMed) {
    const isEdit = !!existingMed;

    // Retrieve live catalogs from database
    const categoriesList = (pharmacyDB.getProductCategories ? pharmacyDB.getProductCategories() : []).map(c => typeof c === 'string' ? c : c.name);
    if (!categoriesList.length) {
      categoriesList.push('Antibiotics', 'Analgesics & Antipyretics', 'Antidiabetic', 'Cardiovascular', 'Gastrointestinal', 'Respiratory', 'Supplements & OTC', 'Dermatology');
    }

    const dosageList = (pharmacyDB.getDosageForms ? pharmacyDB.getDosageForms() : []).map(f => typeof f === 'string' ? f : f.name);
    if (!dosageList.length) {
      dosageList.push('Tablet', 'Capsule', 'Syrup / Liquid', 'Injection / Pen', 'Inhaler', 'Cream / Ointment', 'Eye / Ear Drops');
    }

    const taxSettings = pharmacyDB.getTaxSettings ? pharmacyDB.getTaxSettings() : { enabled: true, taxName: 'VAT', defaultRate: 13, slabs: [] };
    const currentTaxRate = isEdit ? (existingMed.taxRate !== undefined ? existingMed.taxRate : (taxSettings.defaultRate || 13)) : (taxSettings.defaultRate || 13);
    const currentTaxMethod = isEdit ? (existingMed.taxMethod || 'exclusive') : (taxSettings.calculationMethod || 'exclusive');

    const modalHtml = `
      <div class="modal-overlay" id="add-edit-med-modal" style="z-index: 10006;">
        <div class="modal-card" style="max-width: 680px;">
          <div class="modal-header">
            <h3>${isEdit ? '✏️ Edit Medicine Master' : '💊 Add New Pharmacy Medicine'}</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('add-edit-med-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" style="padding: 1.25rem;">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Brand Name *:</label>
                <input type="text" id="med-brand" class="form-control" value="${isEdit ? existingMed.brandName : ''}" placeholder="e.g. Augmentin 625" required>
              </div>
              <div class="form-group">
                <label class="form-label">Generic Chemical Molecule *:</label>
                <input type="text" id="med-generic" class="form-control" value="${isEdit ? existingMed.genericName : ''}" placeholder="e.g. Amoxicillin + Clavulanate" required>
              </div>
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label">Product Category:</label>
                <select id="med-cat" class="form-control">
                  ${categoriesList.map(cat => `
                    <option value="${cat}" ${isEdit && existingMed.category === cat ? 'selected' : ''}>${cat}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Dosage Form:</label>
                <select id="med-form" class="form-control">
                  ${dosageList.map(form => `
                    <option value="${form}" ${(isEdit ? existingMed.dosageForm : 'Tablet') === form ? 'selected' : ''}>${form}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Strength / Dose:</label>
                <input type="text" id="med-strength" class="form-control" value="${isEdit ? (existingMed.strength || '') : ''}" placeholder="e.g. 500mg">
              </div>
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label">Batch Number *:</label>
                <input type="text" id="med-batch" class="form-control" value="${isEdit ? existingMed.batchNo : ('BAT-' + Math.floor(1000 + Math.random() * 9000))}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Expiry Date *:</label>
                <input type="date" id="med-expiry" class="form-control" value="${isEdit ? existingMed.expiryDate : '2027-12-31'}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Rack / Shelf Location *:</label>
                <input type="text" id="med-rack" class="form-control" value="${isEdit ? existingMed.rack : 'A-01'}" placeholder="e.g. A-02 / Fridge">
              </div>
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label">Cost Price ($) *:</label>
                <input type="number" step="0.01" id="med-cost" class="form-control" value="${isEdit ? existingMed.costPrice : '2.50'}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Selling Price ($) *:</label>
                <input type="number" step="0.01" id="med-sell" class="form-control" value="${isEdit ? existingMed.sellingPrice : '4.50'}" required>
              </div>
              <div class="form-group">
                <label class="form-label">MRP ($):</label>
                <input type="number" step="0.01" id="med-mrp" class="form-control" value="${isEdit ? existingMed.mrp : '5.00'}">
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Current Stock Count:</label>
                <input type="number" id="med-stock" class="form-control" value="${isEdit ? existingMed.stock : '100'}" min="0">
              </div>
              <div class="form-group">
                <label class="form-label">Reorder Level Alert:</label>
                <input type="number" id="med-reorder" class="form-control" value="${isEdit ? existingMed.reorderLevel : '25'}">
              </div>
            </div>

            <!-- Custom Tax Input & Calculation Method Configuration -->
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 0.9rem; margin-top: 0.25rem; margin-bottom: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.4rem;">
                <label style="font-weight: 700; font-size: 0.85rem; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px;">
                  <span>⚖️</span> Custom Tax Configuration (${taxSettings.taxName || 'VAT / GST'})
                </label>
                <span id="tax-preview-badge" style="font-size: 0.75rem; font-weight: 700; color: #0369a1; background: #e0f2fe; padding: 2px 8px; border-radius: 4px;">
                  Active: ${currentTaxRate}% (${currentTaxMethod})
                </span>
              </div>

              <div class="form-row-3">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 0.75rem;">Tax Preset Slab:</label>
                  <select id="med-tax-preset" class="form-control" style="font-size: 0.82rem;">
                    ${(taxSettings.slabs || []).map(s => `
                      <option value="${s.rate}" ${Math.abs(parseFloat(s.rate) - parseFloat(currentTaxRate)) < 0.01 ? 'selected' : ''}>${s.name} (${s.rate}%)</option>
                    `).join('')}
                    <option value="custom" ${!(taxSettings.slabs || []).some(s => Math.abs(parseFloat(s.rate) - parseFloat(currentTaxRate)) < 0.01) ? 'selected' : ''}>✏️ Custom Rate (% Manual Input)</option>
                  </select>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 0.75rem;">Custom Tax Rate (%):</label>
                  <input type="number" step="0.01" min="0" max="100" id="med-tax-rate" class="form-control" value="${currentTaxRate}" style="font-weight: 700; color: #0f172a; font-size: 0.85rem;" placeholder="e.g. 13 or 7.5">
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 0.75rem;">Tax Method:</label>
                  <select id="med-tax-method" class="form-control" style="font-size: 0.82rem;">
                    <option value="exclusive" ${currentTaxMethod === 'exclusive' ? 'selected' : ''}>Exclusive (+Tax added to Sell Price)</option>
                    <option value="inclusive" ${currentTaxMethod === 'inclusive' ? 'selected' : ''}>Inclusive (Tax included in Sell Price)</option>
                    <option value="exempt" ${currentTaxMethod === 'exempt' ? 'selected' : ''}>Tax Exempt (0% Tax)</option>
                  </select>
                </div>
              </div>

              <div id="tax-calc-helper" style="font-size: 0.75rem; color: #475569; margin-top: 8px; font-weight: 600; background: #ffffff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                Calculated tax on selling price will display here.
              </div>
            </div>

            <div class="form-group" style="margin-top: 0.25rem;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 600; color: #dc2626;">
                <input type="checkbox" id="med-rx" ${isEdit && existingMed.isRxRequired ? 'checked' : ''} style="width: 18px; height: 18px;">
                Prescription Drug (Schedule H / Rx Required by Law)
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('add-edit-med-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-med">Save Medicine</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Dynamic tax calculation preview helper
    const updateTaxCalcPreview = () => {
      const sellPrice = parseFloat(document.getElementById('med-sell').value) || 0;
      const taxRate = parseFloat(document.getElementById('med-tax-rate').value) || 0;
      const method = document.getElementById('med-tax-method').value;
      const helper = document.getElementById('tax-calc-helper');
      const badge = document.getElementById('tax-preview-badge');
      if (!helper || !badge) return;

      badge.textContent = `Active: ${taxRate}% (${method})`;

      if (method === 'exempt' || taxRate === 0) {
        helper.innerHTML = `🛡️ <strong>Tax Exempt:</strong> No tax applied. Counter Price: <strong>$${sellPrice.toFixed(2)}</strong>.`;
      } else if (method === 'inclusive') {
        const base = sellPrice / (1 + (taxRate / 100));
        const taxVal = sellPrice - base;
        helper.innerHTML = `💡 <strong>Inclusive Tax:</strong> Selling Price $${sellPrice.toFixed(2)} contains $${base.toFixed(2)} Base + <strong>$${taxVal.toFixed(2)} Tax (${taxRate}%)</strong>.`;
      } else {
        const taxVal = (sellPrice * taxRate) / 100;
        const total = sellPrice + taxVal;
        helper.innerHTML = `➕ <strong>Exclusive Tax:</strong> Selling Price $${sellPrice.toFixed(2)} + <strong>$${taxVal.toFixed(2)} Tax (${taxRate}%)</strong> = Final Counter Price: <strong>$${total.toFixed(2)}</strong>.`;
      }
    };

    // Event listeners for custom tax and presets
    const taxPresetSelect = document.getElementById('med-tax-preset');
    const taxRateInput = document.getElementById('med-tax-rate');
    const taxMethodSelect = document.getElementById('med-tax-method');
    const sellPriceInput = document.getElementById('med-sell');

    if (taxPresetSelect) {
      taxPresetSelect.addEventListener('change', (e) => {
        if (e.target.value !== 'custom') {
          taxRateInput.value = e.target.value;
          if (parseFloat(e.target.value) === 0) {
            taxMethodSelect.value = 'exempt';
          } else if (taxMethodSelect.value === 'exempt') {
            taxMethodSelect.value = 'exclusive';
          }
        } else {
          taxRateInput.focus();
        }
        updateTaxCalcPreview();
      });
    }

    if (taxRateInput) {
      taxRateInput.addEventListener('input', () => {
        // If typed rate matches a preset, reflect in preset select, else set to custom
        const val = parseFloat(taxRateInput.value);
        let found = false;
        for (let opt of taxPresetSelect.options) {
          if (opt.value !== 'custom' && Math.abs(parseFloat(opt.value) - val) < 0.01) {
            taxPresetSelect.value = opt.value;
            found = true;
            break;
          }
        }
        if (!found) taxPresetSelect.value = 'custom';
        updateTaxCalcPreview();
      });
    }

    if (taxMethodSelect) {
      taxMethodSelect.addEventListener('change', (e) => {
        if (e.target.value === 'exempt') {
          taxRateInput.value = 0;
          taxPresetSelect.value = 0;
        }
        updateTaxCalcPreview();
      });
    }

    if (sellPriceInput) {
      sellPriceInput.addEventListener('input', updateTaxCalcPreview);
    }

    // Initial tax calculation preview
    updateTaxCalcPreview();

    document.getElementById('btn-save-med').addEventListener('click', () => {
      const brand = document.getElementById('med-brand').value.trim();
      const generic = document.getElementById('med-generic').value.trim();
      if (!brand || !generic) {
        alert('Brand name and generic formula are required');
        return;
      }

      const category = document.getElementById('med-cat').value;
      const dosageForm = document.getElementById('med-form').value;
      const strength = document.getElementById('med-strength').value.trim();
      const batchNo = document.getElementById('med-batch').value.trim();
      const expiryDate = document.getElementById('med-expiry').value;
      const rack = document.getElementById('med-rack').value.trim();
      const costPrice = parseFloat(document.getElementById('med-cost').value) || 0;
      const sellingPrice = parseFloat(document.getElementById('med-sell').value) || 0;
      const mrp = parseFloat(document.getElementById('med-mrp').value) || 0;
      const stock = parseInt(document.getElementById('med-stock').value, 10) || 0;
      const reorderLevel = parseInt(document.getElementById('med-reorder').value, 10) || 20;
      const taxRate = parseFloat(document.getElementById('med-tax-rate').value) || 0;
      const taxMethod = document.getElementById('med-tax-method').value || 'exclusive';
      const isRxRequired = document.getElementById('med-rx').checked;

      if (isEdit) {
        existingMed.brandName = brand;
        existingMed.genericName = generic;
        existingMed.category = category;
        existingMed.dosageForm = dosageForm;
        existingMed.strength = strength;
        existingMed.batchNo = batchNo;
        existingMed.expiryDate = expiryDate;
        existingMed.rack = rack;
        existingMed.costPrice = costPrice;
        existingMed.sellingPrice = sellingPrice;
        existingMed.mrp = mrp;
        existingMed.stock = stock;
        existingMed.reorderLevel = reorderLevel;
        existingMed.taxRate = taxRate;
        existingMed.taxMethod = taxMethod;
        existingMed.isRxRequired = isRxRequired;
      } else {
        const newMed = {
          id: 'MED-' + (pharmacyDB.data.medicines.length + 101),
          barcode: '8901' + Math.floor(10000 + Math.random() * 90000),
          brandName: brand,
          genericName: generic,
          category: category,
          dosageForm: dosageForm,
          strength: strength,
          batchNo: batchNo,
          expiryDate: expiryDate,
          rack: rack,
          stock: stock,
          unit: 'Strip of 10',
          costPrice: costPrice,
          sellingPrice: sellingPrice,
          mrp: mrp,
          taxRate: taxRate,
          taxMethod: taxMethod,
          isRxRequired: isRxRequired,
          reorderLevel: reorderLevel,
          supplierId: 'SUP-01'
        };
        pharmacyDB.data.medicines.push(newMed);
      }

      pharmacyDB.save();
      document.getElementById('add-edit-med-modal').remove();
      App.showToast(`Medicine ${brand} saved!`, 'success');
      this.render();
    });
  },

  showWriteOffModal(medicineId) {
    const med = pharmacyDB.data.medicines.find(m => m.id === medicineId);
    if (!med) return;

    const modalHtml = `
      <div class="modal-overlay" id="write-off-modal">
        <div class="modal-card" style="max-width: 480px;">
          <div class="modal-header">
            <h3>Quarantine & Write-Off Stock Loss</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('write-off-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
              <div style="font-weight: 700; color: #991b1b;">${med.brandName}</div>
              <div style="font-size: 0.8rem; color: #b91c1c;">Batch: ${med.batchNo} | Exp: ${med.expiryDate}</div>
              <div style="font-size: 0.82rem; color: #7f1d1d; margin-top: 4px;">Current Stock in Dispensary: <strong>${med.stock} units</strong></div>
            </div>

            <div class="form-group">
              <label class="form-label">Quantity to Quarantine / Destroy *:</label>
              <input type="number" id="wo-qty" class="form-control" value="${med.stock}" max="${med.stock}" min="1">
            </div>

            <div class="form-group">
              <label class="form-label">Reason for Quarantine / Write-Off:</label>
              <select id="wo-reason" class="form-control">
                <option value="Expired Product">Expired Product</option>
                <option value="Damaged / Broken Packaging">Damaged / Broken Packaging</option>
                <option value="Cold Chain Failure (>8°C)">Cold Chain Failure (>8°C)</option>
                <option value="Regulatory Recall">Regulatory Recall</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Disposal Method:</label>
              <select id="wo-method" class="form-control">
                <option value="Returned to Wholesaler (Debit Note Claim)">Returned to Wholesaler (Debit Note Claim)</option>
                <option value="Bio-Medical Waste Destruction">Bio-Medical Waste Destruction</option>
              </select>
            </div>

            <div style="font-size: 0.78rem; color: #64748b; background: #f8fafc; padding: 0.65rem; border-radius: 6px;">
              * Note: Automatically creates a General Journal entry debiting <strong>#5050 Medicine Expiry & Spoilage Loss</strong> and crediting <strong>#1040 Inventory Asset</strong>.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('write-off-modal').remove()">Cancel</button>
            <button class="btn btn-danger" id="btn-confirm-wo">
              ${getIcon('alert')} Confirm Loss & Post Journal
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-confirm-wo').addEventListener('click', () => {
      const qty = parseInt(document.getElementById('wo-qty').value, 10);
      const reason = document.getElementById('wo-reason').value;
      const method = document.getElementById('wo-method').value;

      try {
        const res = pharmacyDB.processStockWriteOff(med.id, qty, reason, method);
        document.getElementById('write-off-modal').remove();
        App.showToast(`Wrote off ${qty} units ($${res.lossAmount.toFixed(2)} loss recorded). Journal posted!`, 'success');
        this.render();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }
};
