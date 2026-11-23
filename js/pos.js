/**
 * Pharmacy POS (Point of Sale) & Cashiering Module
 * Supports Barcode scanning, FEFO batching, Rx controls, multi-tender payments, and thermal receipts.
 */

const POS = {
  cart: [],
  selectedCustomer: null,
  selectedCategory: 'ALL',
  searchQuery: '',
  doctorName: '',
  rxNumber: '',
  discountPercent: 0,
  heldSales: [],

  init() {
    this.selectedCustomer = pharmacyDB.data.customers.find(c => c.id === 'CUST-000') || pharmacyDB.data.customers[0];
  },

  render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    // Filter medicines
    let meds = pharmacyDB.data.medicines;
    if (this.selectedCategory !== 'ALL') {
      meds = meds.filter(m => m.category.toLowerCase().includes(this.selectedCategory.toLowerCase()));
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      meds = meds.filter(m => 
        m.brandName.toLowerCase().includes(q) || 
        m.genericName.toLowerCase().includes(q) || 
        m.barcode.toLowerCase().includes(q) ||
        m.batchNo.toLowerCase().includes(q) ||
        m.rack.toLowerCase().includes(q)
      );
    }

    // Categories list
    const categories = ['ALL', 'Antibiotics', 'Analgesics', 'Antidiabetic', 'Cardiovascular', 'Gastrointestinal', 'Respiratory', 'Supplements'];

    container.innerHTML = `
      <div class="pos-grid">
        <!-- Left Catalog Panel -->
        <div class="pos-catalog-panel">
          <div class="pos-search-bar">
            <div class="search-input-wrap">
              <span class="search-icon-left">${getIcon('search')}</span>
              <input type="text" id="pos-search-input" placeholder="Search medicines by Brand, Generic, Barcode (Enter), Rack... [Alt+S]" value="${this.searchQuery}" autofocus>
            </div>
            <button class="btn btn-outline" id="pos-clear-search-btn" title="Clear Search">Clear</button>
            <button class="btn btn-secondary" id="pos-hold-toggle-btn" title="Recall Parked Tickets">
              ${getIcon('database')} Parked (${this.heldSales.length})
            </button>
          </div>

          <!-- Category Filter Bar -->
          <div class="category-filter-chips">
            ${categories.map(cat => `
              <button class="chip-btn ${this.selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">
                ${cat}
              </button>
            `).join('')}
          </div>

          <!-- Medicine Cards Grid -->
          <div class="pos-items-grid" id="pos-items-grid">
            ${meds.length === 0 ? `
              <div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 3rem 1rem;">
                ${getIcon('pill')}
                <p style="margin-top: 0.5rem; font-weight: 500;">No medicines found matching your search</p>
              </div>
            ` : meds.map(med => {
              const isLow = med.stock <= med.reorderLevel && med.stock > 0;
              const isOut = med.stock <= 0;
              const stockClass = isOut ? 'stock-out' : (isLow ? 'stock-low' : 'stock-in');
              const stockLabel = isOut ? 'Out of Stock' : `${med.stock} ${med.unit.split(' ')[0]}`;

              // Expiry alert
              const expDate = new Date(med.expiryDate);
              const today = new Date();
              const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
              const isNearExp = diffDays <= 60 && diffDays > 0;

              return `
                <div class="medicine-card" data-med-id="${med.id}" title="Click to add to cart">
                  <div class="med-header">
                    <span class="med-brand-name">${med.brandName}</span>
                    ${med.isRxRequired ? '<span class="rx-badge" title="Prescription Required (Schedule H)">Rx</span>' : ''}
                  </div>
                  <div class="med-generic" title="${med.genericName}">${med.genericName}</div>
                  <div class="med-meta-row">
                    <span>Batch: <strong>${med.batchNo}</strong></span>
                    <span style="${isNearExp ? 'color:#ef4444; font-weight:bold;' : ''}">Exp: ${med.expiryDate}</span>
                  </div>
                  <div class="med-meta-row" style="margin-top: 0.2rem; border-top: none;">
                    <span>Rack: <strong>${med.rack}</strong></span>
                    <span>${med.strength || ''}</span>
                  </div>
                  <div class="med-price-stock">
                    <span class="med-price">$${med.sellingPrice.toFixed(2)}</span>
                    <span class="med-stock-pill ${stockClass}">${stockLabel}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Right Cart Panel -->
        <div class="pos-cart-panel">
          <!-- Cart Header -->
          <div class="cart-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              ${getIcon('pos')}
              <strong style="color: #0f172a; font-size: 0.95rem;">Active Dispensing Bill</strong>
            </div>
            <button class="btn btn-outline" id="pos-clear-cart-btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" ${this.cart.length === 0 ? 'disabled' : ''}>
              ${getIcon('trash')} Clear
            </button>
          </div>

          <!-- Customer Selection Bar -->
          <div class="cart-customer-bar">
            <span style="color: #64748b; font-size: 0.8rem;">Patient:</span>
            <select id="pos-customer-select" class="form-control" style="font-size: 0.82rem; padding: 0.35rem 0.5rem;">
              ${pharmacyDB.data.customers.map(c => `
                <option value="${c.id}" ${this.selectedCustomer && this.selectedCustomer.id === c.id ? 'selected' : ''}>
                  ${c.name} ${c.balance > 0 ? `(Owes: $${c.balance.toFixed(2)})` : ''}
                </option>
              `).join('')}
            </select>
            <button class="btn btn-outline" id="pos-new-cust-quick-btn" title="Register New Patient" style="padding: 0.35rem 0.55rem; font-size: 0.8rem;">
              ${getIcon('plus')}
            </button>
          </div>

          <!-- Prescription Details Accordion (Doctor & Rx) -->
          <div style="padding: 0.5rem 1rem; background: #fdfdfe; border-bottom: 1px solid var(--border-color); font-size: 0.78rem;">
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" id="pos-doc-name" placeholder="Dr. Name (Optional / Rx)" class="form-control" style="font-size: 0.78rem; padding: 0.3rem 0.5rem;" value="${this.doctorName}">
              <input type="text" id="pos-rx-no" placeholder="Prescription #" class="form-control" style="font-size: 0.78rem; padding: 0.3rem 0.5rem;" value="${this.rxNumber}">
            </div>
          </div>

          <!-- Cart Items List -->
          <div class="cart-items-list" id="pos-cart-items">
            ${this.cart.length === 0 ? `
              <div class="cart-empty-state">
                <div style="width: 48px; height: 48px; margin: 0 auto 0.75rem auto; color: #cbd5e1;">${getIcon('pill')}</div>
                <div style="font-weight: 600; color: #64748b; font-size: 0.95rem;">Cart is empty</div>
                <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 0.25rem;">Click any medicine or scan barcode with [Enter]</div>
              </div>
            ` : this.cart.map((item, index) => {
              const lineTotal = item.unitPrice * item.quantity;
              return `
                <div class="cart-item-row" data-cart-index="${index}">
                  <div class="cart-item-top">
                    <div>
                      <div class="cart-item-title">${item.brandName} ${item.isRxRequired ? '<span class="rx-badge">Rx</span>' : ''}</div>
                      <div class="cart-item-batch">Batch: ${item.batchNo} | Exp: ${item.expiryDate}</div>
                    </div>
                    <button class="btn-remove-item" data-index="${index}" style="background:none; border:none; color:#ef4444; cursor:pointer; padding: 2px;" title="Remove Item">
                      ${getIcon('trash')}
                    </button>
                  </div>
                  <div class="cart-item-bottom">
                    <div class="qty-control">
                      <button class="qty-btn btn-qty-dec" data-index="${index}">-</button>
                      <input type="number" class="qty-input" data-index="${index}" value="${item.quantity}" min="1" max="${item.availableStock}">
                      <button class="qty-btn btn-qty-inc" data-index="${index}">+</button>
                    </div>
                    <div class="cart-item-price-calc">
                      <div class="cart-item-total">$${lineTotal.toFixed(2)}</div>
                      <div class="cart-item-unit-rate">$${item.unitPrice.toFixed(2)} / unit (${item.taxRate}% tax)</div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Cart Calculation Summary -->
          <div class="cart-summary">
            ${(() => {
              const calc = this.calculateTotals();
              const canDiscount = typeof Auth !== 'undefined' ? Auth.hasPermission('applyDiscounts') : true;
              const maxDisc = pharmacyDB.data.staffUiSettings?.maxDiscountPercent || 15;

              return `
                <div class="summary-row">
                  <span>Items Subtotal:</span>
                  <span>$${calc.subtotal.toFixed(2)}</span>
                </div>
                <div class="summary-row" style="align-items: center;">
                  <span>Bill Discount:</span>
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <input type="number" id="pos-discount-input" min="0" max="${Auth.isDeveloper() ? 100 : maxDisc}" value="${this.discountPercent}" ${!canDiscount ? 'disabled title="Permission to apply discount required"' : ''} style="width: 48px; text-align: right; padding: 2px 4px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem; ${!canDiscount ? 'background: #f1f5f9; cursor: not-allowed;' : ''}">
                    <span>% (-$${calc.discountAmount.toFixed(2)}) ${!canDiscount ? '<span style="font-size:0.68rem; color:#dc2626;">(Locked)</span>' : ''}</span>
                  </div>
                </div>
                <div class="summary-row">
                  <span>Est. ${calc.taxName || 'Tax'}:</span>
                  <span>+$${calc.taxAmount.toFixed(2)}</span>
                </div>
                <div class="summary-row total-row">
                  <span>Net Payable:</span>
                  <span style="color: #0284c7;">$${calc.grandTotal.toFixed(2)}</span>
                </div>
              `;
            })()}
          </div>

          <!-- Checkout Actions -->
          <div class="cart-actions">
            ${(pharmacyDB.data.staffUiSettings?.enableHoldTickets !== false) ? `
              <button class="btn btn-secondary" id="pos-park-sale-btn" ${this.cart.length === 0 ? 'disabled' : ''} title="Hold Sale [F8]">
                Hold [F8]
              </button>
            ` : '<div></div>'}
            <button class="btn btn-primary btn-lg" id="pos-pay-btn" ${this.cart.length === 0 ? 'disabled' : ''} style="font-size: 1.05rem;">
              ${getIcon('pos')} Checkout [F4]
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  calculateTotals() {
    const taxSettings = pharmacyDB.getTaxSettings ? pharmacyDB.getTaxSettings() : { enabled: true, defaultRate: 13, taxName: 'VAT' };
    const isTaxEnabled = taxSettings.enabled !== false;
    let subtotal = 0;
    let taxableAmount = 0;
    let taxAmount = 0;

    this.cart.forEach(item => {
      const lineCost = item.unitPrice * item.quantity;
      subtotal += lineCost;
      if (isTaxEnabled) {
        const rate = item.taxRate !== undefined ? item.taxRate : (taxSettings.defaultRate || 0);
        const lineTax = (lineCost * rate) / 100;
        taxAmount += lineTax;
      }
    });

    const discountAmount = (subtotal * this.discountPercent) / 100;
    const netSubtotal = subtotal - discountAmount;
    // Recalculate tax on discounted base
    const effectiveTax = isTaxEnabled && subtotal > 0 ? (taxAmount * (netSubtotal / subtotal)) : 0;
    const grandTotal = netSubtotal + effectiveTax;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxAmount: Math.round(effectiveTax * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      taxName: taxSettings.taxName || 'VAT / Tax'
    };
  },

  addToCart(medicineId) {
    const med = pharmacyDB.data.medicines.find(m => m.id === medicineId);
    if (!med) return;

    if (med.stock <= 0) {
      App.showToast(`Cannot add ${med.brandName}: Out of stock!`, 'error');
      return;
    }

    const existingIndex = this.cart.findIndex(i => i.medicineId === medicineId);
    if (existingIndex > -1) {
      if (this.cart[existingIndex].quantity < med.stock) {
        this.cart[existingIndex].quantity += 1;
        App.showToast(`Increased quantity of ${med.brandName}`, 'info');
      } else {
        App.showToast(`Maximum stock limit reached for ${med.brandName} (${med.stock} units)`, 'warning');
      }
    } else {
      this.cart.push({
        medicineId: med.id,
        brandName: med.brandName,
        genericName: med.genericName,
        batchNo: med.batchNo,
        expiryDate: med.expiryDate,
        unitPrice: med.sellingPrice,
        taxRate: med.taxRate,
        isRxRequired: med.isRxRequired,
        quantity: 1,
        availableStock: med.stock
      });
      App.showToast(`Added ${med.brandName} to cart`, 'success');
    }

    this.render();
  },

  bindEvents() {
    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderItemsOnly();
      });

      // Barcode Enter key scanner trigger
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = searchInput.value.trim();
          if (!query) return;

          // Check exact barcode or exact brand match
          const exactMed = pharmacyDB.data.medicines.find(m => 
            m.barcode === query || m.brandName.toLowerCase() === query.toLowerCase()
          );

          if (exactMed) {
            this.addToCart(exactMed.id);
            this.searchQuery = '';
            searchInput.value = '';
          } else {
            // Pick first matching item if any
            const firstMatch = pharmacyDB.data.medicines.find(m => 
              m.brandName.toLowerCase().includes(query.toLowerCase()) || 
              m.genericName.toLowerCase().includes(query.toLowerCase())
            );
            if (firstMatch) {
              this.addToCart(firstMatch.id);
              this.searchQuery = '';
              searchInput.value = '';
            } else {
              App.showToast('No medicine matched barcode/query: ' + query, 'warning');
            }
          }
        }
      });
    }

    // Clear search
    const clearSearchBtn = document.getElementById('pos-clear-search-btn');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        this.searchQuery = '';
        this.render();
      });
    }

    // Category chips
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.getAttribute('data-cat');
        this.render();
      });
    });

    // Medicine cards click
    document.querySelectorAll('.medicine-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-med-id');
        this.addToCart(id);
      });
    });

    // Customer selection
    const custSelect = document.getElementById('pos-customer-select');
    if (custSelect) {
      custSelect.addEventListener('change', (e) => {
        this.selectedCustomer = pharmacyDB.data.customers.find(c => c.id === e.target.value);
        if (this.selectedCustomer && this.selectedCustomer.balance > 0) {
          App.showToast(`Patient has an outstanding credit balance of $${this.selectedCustomer.balance.toFixed(2)}`, 'warning');
        }
      });
    }

    // Quick New Patient button
    const newCustBtn = document.getElementById('pos-new-cust-quick-btn');
    if (newCustBtn) {
      newCustBtn.addEventListener('click', () => {
        AccountsMgmt.showAddCustomerModal((newCustomer) => {
          this.selectedCustomer = newCustomer;
          this.render();
        });
      });
    }

    // Doctor & Rx input changes
    const docInput = document.getElementById('pos-doc-name');
    if (docInput) {
      docInput.addEventListener('input', (e) => { this.doctorName = e.target.value; });
    }
    const rxInput = document.getElementById('pos-rx-no');
    if (rxInput) {
      rxInput.addEventListener('input', (e) => { this.rxNumber = e.target.value; });
    }

    // Cart Qty + / - / input
    document.querySelectorAll('.btn-qty-inc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (this.cart[idx].quantity < this.cart[idx].availableStock) {
          this.cart[idx].quantity++;
          this.render();
        } else {
          App.showToast('Available stock limit reached', 'warning');
        }
      });
    });

    document.querySelectorAll('.btn-qty-dec').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (this.cart[idx].quantity > 1) {
          this.cart[idx].quantity--;
        } else {
          this.cart.splice(idx, 1);
        }
        this.render();
      });
    });

    document.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(input.getAttribute('data-index'), 10);
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val <= 0) val = 1;
        if (val > this.cart[idx].availableStock) {
          val = this.cart[idx].availableStock;
          App.showToast('Exceeded available stock, set to ' + val, 'warning');
        }
        this.cart[idx].quantity = val;
        this.render();
      });
    });

    // Remove item
    document.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        this.cart.splice(idx, 1);
        this.render();
      });
    });

    // Discount input
    const discountInput = document.getElementById('pos-discount-input');
    if (discountInput) {
      discountInput.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value) || 0;
        const maxDisc = pharmacyDB.data.staffUiSettings?.maxDiscountPercent || 15;
        if (val < 0) val = 0;
        if (!Auth.isDeveloper() && val > maxDisc) {
          val = maxDisc;
          App.showToast(`Staff discount capped at max ${maxDisc}%`, 'warning');
        } else if (val > 100) {
          val = 100;
        }
        this.discountPercent = val;
        this.render();
      });
    }

    // Clear cart
    const clearCartBtn = document.getElementById('pos-clear-cart-btn');
    if (clearCartBtn) {
      clearCartBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the active cart?')) {
          this.cart = [];
          this.doctorName = '';
          this.rxNumber = '';
          this.discountPercent = 0;
          this.render();
        }
      });
    }

    // Park Sale
    const parkBtn = document.getElementById('pos-park-sale-btn');
    if (parkBtn) {
      parkBtn.addEventListener('click', () => {
        if (this.cart.length === 0) return;
        this.heldSales.push({
          id: 'HOLD-' + (this.heldSales.length + 1),
          timestamp: new Date().toLocaleTimeString(),
          cart: [...this.cart],
          customer: this.selectedCustomer,
          doctorName: this.doctorName,
          rxNumber: this.rxNumber,
          discountPercent: this.discountPercent
        });
        this.cart = [];
        this.doctorName = '';
        this.rxNumber = '';
        this.discountPercent = 0;
        App.showToast('Bill parked/held successfully!', 'info');
        this.render();
      });
    }

    // Recall Parked Bills
    const holdToggleBtn = document.getElementById('pos-hold-toggle-btn');
    if (holdToggleBtn) {
      holdToggleBtn.addEventListener('click', () => {
        this.showParkedTicketsModal();
      });
    }

    // Pay / Checkout Modal Trigger
    const payBtn = document.getElementById('pos-pay-btn');
    if (payBtn) {
      payBtn.addEventListener('click', () => {
        this.showPaymentModal();
      });
    }
  },

  renderItemsOnly() {
    const grid = document.getElementById('pos-items-grid');
    if (!grid) return;

    let meds = pharmacyDB.data.medicines;
    if (this.selectedCategory !== 'ALL') {
      meds = meds.filter(m => m.category.toLowerCase().includes(this.selectedCategory.toLowerCase()));
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      meds = meds.filter(m => 
        m.brandName.toLowerCase().includes(q) || 
        m.genericName.toLowerCase().includes(q) || 
        m.barcode.toLowerCase().includes(q) ||
        m.batchNo.toLowerCase().includes(q) ||
        m.rack.toLowerCase().includes(q)
      );
    }

    grid.innerHTML = meds.length === 0 ? `
      <div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 3rem 1rem;">
        ${getIcon('pill')}
        <p style="margin-top: 0.5rem; font-weight: 500;">No medicines found</p>
      </div>
    ` : meds.map(med => {
      const isLow = med.stock <= med.reorderLevel && med.stock > 0;
      const isOut = med.stock <= 0;
      const stockClass = isOut ? 'stock-out' : (isLow ? 'stock-low' : 'stock-in');
      const stockLabel = isOut ? 'Out of Stock' : `${med.stock} ${med.unit.split(' ')[0]}`;

      const expDate = new Date(med.expiryDate);
      const today = new Date();
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const isNearExp = diffDays <= 60 && diffDays > 0;

      return `
        <div class="medicine-card" data-med-id="${med.id}">
          <div class="med-header">
            <span class="med-brand-name">${med.brandName}</span>
            ${med.isRxRequired ? '<span class="rx-badge">Rx</span>' : ''}
          </div>
          <div class="med-generic">${med.genericName}</div>
          <div class="med-meta-row">
            <span>Batch: <strong>${med.batchNo}</strong></span>
            <span style="${isNearExp ? 'color:#ef4444; font-weight:bold;' : ''}">Exp: ${med.expiryDate}</span>
          </div>
          <div class="med-meta-row" style="margin-top: 0.2rem; border-top: none;">
            <span>Rack: <strong>${med.rack}</strong></span>
            <span>${med.strength || ''}</span>
          </div>
          <div class="med-price-stock">
            <span class="med-price">$${med.sellingPrice.toFixed(2)}</span>
            <span class="med-stock-pill ${stockClass}">${stockLabel}</span>
          </div>
        </div>
      `;
    }).join('');

    // Rebind medicine card clicks
    grid.querySelectorAll('.medicine-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-med-id');
        this.addToCart(id);
      });
    });
  },

  showPaymentModal() {
    if (this.cart.length === 0) return;

    // Check if Rx items are in cart without doctor details
    const hasRx = this.cart.some(i => i.isRxRequired);
    if (hasRx && !this.doctorName) {
      const proceed = confirm('Caution: Cart contains Schedule H / Prescription-only medicine(s) with no Prescribing Doctor specified. Proceed anyway?');
      if (!proceed) return;
    }

    const calc = this.calculateTotals();
    const grandTotal = calc.grandTotal;

    const modalHtml = `
      <div class="modal-overlay" id="payment-modal">
        <div class="modal-card" style="max-width: 540px;">
          <div class="modal-header">
            <h3>Complete Checkout & Dispense</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('payment-modal').remove()">
              ${getIcon('close')}
            </button>
          </div>
          <div class="modal-body">
            <!-- Amount Header -->
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 1rem; text-align: center; margin-bottom: 1.25rem;">
              <div style="font-size: 0.82rem; color: #166534; font-weight: 600; text-transform: uppercase;">Total Amount Payable</div>
              <div style="font-size: 2.2rem; font-weight: 800; color: #15803d; line-height: 1.2;">$${grandTotal.toFixed(2)}</div>
              <div style="font-size: 0.76rem; color: #166534; margin-top: 4px;">Items: ${this.cart.length} | Tax included</div>
            </div>

            <!-- Payment Method Tabs -->
            <div class="form-group">
              <label class="form-label">Select Tender / Payment Method:</label>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;" id="tender-buttons-group">
                <button type="button" class="btn btn-primary tender-method-btn active" data-method="Cash">Cash</button>
                <button type="button" class="btn btn-outline tender-method-btn" data-method="Card">Card</button>
                <button type="button" class="btn btn-outline tender-method-btn" data-method="UPI / Digital QR">UPI / QR</button>
                <button type="button" class="btn btn-outline tender-method-btn" data-method="Credit / Ledger">Credit A/c</button>
              </div>
            </div>

            <!-- Cash Tender Specific Panel -->
            <div id="cash-tender-panel">
              <div class="form-group">
                <label class="form-label">Cash Tendered by Customer ($):</label>
                <input type="number" step="0.01" id="cash-tendered-input" class="form-control" style="font-size: 1.25rem; font-weight: bold; text-align: right;" value="${grandTotal.toFixed(2)}">
              </div>

              <!-- Quick cash denomination buttons -->
              <div style="display: flex; gap: 0.4rem; margin-bottom: 1rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline quick-cash-btn" data-val="${grandTotal.toFixed(2)}">Exact ($${grandTotal.toFixed(2)})</button>
                <button type="button" class="btn btn-outline quick-cash-btn" data-val="10">$10</button>
                <button type="button" class="btn btn-outline quick-cash-btn" data-val="20">$20</button>
                <button type="button" class="btn btn-outline quick-cash-btn" data-val="50">$50</button>
                <button type="button" class="btn btn-outline quick-cash-btn" data-val="100">$100</button>
              </div>

              <!-- Change return readout -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
                <span style="font-weight: 600; font-size: 0.9rem;">Change to Return:</span>
                <span id="cash-change-display" style="font-size: 1.35rem; font-weight: 800; color: #0284c7;">$0.00</span>
              </div>
            </div>

            <!-- Patient Credit Account Panel (Conditional) -->
            <div id="credit-tender-panel" style="display: none; padding: 0.85rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
              <div style="font-weight: 600; color: #92400e; font-size: 0.88rem; margin-bottom: 0.25rem;">Patient Account Ledger:</div>
              <div style="font-size: 0.82rem; color: #78350f;">
                Selected: <strong>${this.selectedCustomer ? this.selectedCustomer.name : 'None'}</strong><br>
                Existing Balance: $${this.selectedCustomer ? this.selectedCustomer.balance.toFixed(2) : '0.00'}<br>
                Credit Limit: $${this.selectedCustomer ? this.selectedCustomer.creditLimit.toFixed(2) : '0.00'}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('payment-modal').remove()">Cancel</button>
            <button class="btn btn-success btn-lg" id="btn-confirm-pos-sale">
              ${getIcon('check')} Dispense & Print Receipt
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    let activeMethod = 'Cash';
    const cashPanel = document.getElementById('cash-tender-panel');
    const creditPanel = document.getElementById('credit-tender-panel');
    const tenderedInput = document.getElementById('cash-tendered-input');
    const changeDisplay = document.getElementById('cash-change-display');

    const updateChange = () => {
      const tendered = parseFloat(tenderedInput.value) || 0;
      const change = Math.max(0, tendered - grandTotal);
      changeDisplay.textContent = '$' + change.toFixed(2);
    };

    tenderedInput.addEventListener('input', updateChange);

    document.querySelectorAll('.quick-cash-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tenderedInput.value = parseFloat(btn.getAttribute('data-val')).toFixed(2);
        updateChange();
      });
    });

    document.querySelectorAll('.tender-method-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tender-method-btn').forEach(b => {
          b.classList.remove('active', 'btn-primary');
          b.classList.add('btn-outline');
        });
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-outline');
        activeMethod = btn.getAttribute('data-method');

        if (activeMethod === 'Cash') {
          cashPanel.style.display = 'block';
          creditPanel.style.display = 'none';
        } else if (activeMethod === 'Credit / Ledger') {
          cashPanel.style.display = 'none';
          creditPanel.style.display = 'block';
          if (!this.selectedCustomer || this.selectedCustomer.id === 'CUST-000') {
            App.showToast('Please select a registered patient for Credit Account sales!', 'warning');
          }
        } else {
          cashPanel.style.display = 'none';
          creditPanel.style.display = 'none';
        }
      });
    });

    // Confirm Sale
    document.getElementById('btn-confirm-pos-sale').addEventListener('click', () => {
      if (activeMethod === 'Credit / Ledger' && (!this.selectedCustomer || this.selectedCustomer.id === 'CUST-000')) {
        alert('You must assign this sale to a registered patient to post to Accounts Receivable.');
        return;
      }

      const tendered = parseFloat(tenderedInput.value) || grandTotal;
      if (activeMethod === 'Cash' && tendered < grandTotal) {
        alert(`Tendered amount ($${tendered.toFixed(2)}) is less than total payable ($${grandTotal.toFixed(2)})`);
        return;
      }

      const change = activeMethod === 'Cash' ? Math.max(0, tendered - grandTotal) : 0;

      try {
        const saleRecord = pharmacyDB.processPOSSale({
          customerId: this.selectedCustomer ? this.selectedCustomer.id : 'CUST-000',
          customerName: this.selectedCustomer ? this.selectedCustomer.name : 'Walk-In Customer',
          doctorName: this.doctorName,
          rxNumber: this.rxNumber,
          items: this.cart,
          subtotal: calc.subtotal,
          discountAmount: calc.discountAmount,
          taxAmount: calc.taxAmount,
          grandTotal: calc.grandTotal,
          paymentMethod: activeMethod,
          amountPaid: tendered,
          changeGiven: change,
          notes: `Dispensed at POS counter`
        });

        document.getElementById('payment-modal').remove();
        App.showToast(`Invoice ${saleRecord.invoiceNo} completed successfully!`, 'success');

        // Reset Cart
        this.cart = [];
        this.doctorName = '';
        this.rxNumber = '';
        this.discountPercent = 0;
        this.render();

        // Show Thermal Receipt Preview & Print
        this.showReceiptModal(saleRecord);
      } catch (err) {
        alert('Failed to process sale: ' + err.message);
      }
    });
  },

  showParkedTicketsModal() {
    if (this.heldSales.length === 0) {
      App.showToast('No parked tickets at the moment', 'info');
      return;
    }

    const modalHtml = `
      <div class="modal-overlay" id="parked-modal">
        <div class="modal-card" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Recall Parked Dispensing Bills</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('parked-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${this.heldSales.map((ticket, idx) => `
                <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 700; color: #0f172a;">${ticket.id} (${ticket.timestamp})</div>
                    <div style="font-size: 0.78rem; color: #64748b;">Patient: ${ticket.customer ? ticket.customer.name : 'Walk-In'} | ${ticket.cart.length} items</div>
                  </div>
                  <div style="display: flex; gap: 0.35rem;">
                    <button class="btn btn-primary btn-sm resume-ticket-btn" data-idx="${idx}">Resume</button>
                    <button class="btn btn-danger btn-sm discard-ticket-btn" data-idx="${idx}">Discard</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.querySelectorAll('.resume-ticket-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const ticket = this.heldSales.splice(idx, 1)[0];
        this.cart = ticket.cart;
        this.selectedCustomer = ticket.customer;
        this.doctorName = ticket.doctorName;
        this.rxNumber = ticket.rxNumber;
        this.discountPercent = ticket.discountPercent;
        document.getElementById('parked-modal').remove();
        App.showToast(`Restored ticket ${ticket.id}`, 'success');
        this.render();
      });
    });

    document.querySelectorAll('.discard-ticket-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        this.heldSales.splice(idx, 1);
        document.getElementById('parked-modal').remove();
        App.showToast('Discarded parked ticket', 'info');
        this.render();
      });
    });
  },

  showReceiptModal(saleRecord) {
    const s = pharmacyDB.data.settings;

    const receiptHtml = `
      <div class="modal-overlay" id="receipt-modal">
        <div class="modal-card" style="max-width: 440px;">
          <div class="modal-header">
            <h3>Thermal POS Receipt</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('receipt-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" style="background: #f1f5f9; padding: 1rem; overflow-y: auto;">
            <!-- Printable 80mm container -->
            <div id="printable-receipt-area" class="thermal-receipt">
              <div class="receipt-header">
                <div style="text-align: center; margin-bottom: 6px;">
                  ${App.renderLogoHtml('light', 'max-height: 48px; max-width: 140px; object-fit: contain;')}
                </div>
                <div class="receipt-title">${s.pharmacyName}</div>
                <div class="receipt-sub">${s.tagline}</div>
                <div class="receipt-sub">${s.address}</div>
                <div class="receipt-sub">Ph: ${s.phone} | Lic: ${s.licenseNo}</div>
                <div class="receipt-sub">GSTIN / Tax ID: ${s.gstNumber}</div>
              </div>

              <div class="receipt-divider"></div>

              <div class="receipt-row">
                <span>Inv: <span class="receipt-bold">${saleRecord.invoiceNo}</span></span>
                <span>Date: ${saleRecord.date}</span>
              </div>
              <div class="receipt-row">
                <span>Patient: ${saleRecord.customerName}</span>
              </div>
              ${saleRecord.doctorName ? `
                <div class="receipt-row">
                  <span>Prescriber: ${saleRecord.doctorName}</span>
                </div>
              ` : ''}
              ${saleRecord.rxNumber ? `
                <div class="receipt-row">
                  <span>Rx Ref #: ${saleRecord.rxNumber}</span>
                </div>
              ` : ''}

              <div class="receipt-divider"></div>

              <table class="receipt-table">
                <thead>
                  <tr>
                    <th>Item / Batch</th>
                    <th style="text-align:center;">Qty</th>
                    <th style="text-align:right;">Rate</th>
                    <th style="text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${saleRecord.items.map(item => `
                    <tr>
                      <td colspan="4" style="font-weight:bold; padding-top:4px;">${item.brandName} ${item.isRxRequired ? '(Rx)' : ''}</td>
                    </tr>
                    <tr>
                      <td style="font-size:10px; color:#333; padding-bottom:4px;">B: ${item.batchNo} | Exp: ${item.expiryDate}</td>
                      <td style="text-align:center;">${item.quantity}</td>
                      <td style="text-align:right;">$${item.unitPrice.toFixed(2)}</td>
                      <td style="text-align:right;">$${(item.unitPrice * item.quantity).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="receipt-divider"></div>

              <div class="receipt-row">
                <span>Subtotal:</span>
                <span>$${saleRecord.subtotal.toFixed(2)}</span>
              </div>
              ${saleRecord.discountAmount > 0 ? `
                <div class="receipt-row">
                  <span>Discount:</span>
                  <span>-$${saleRecord.discountAmount.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="receipt-row">
                <span>GST / Tax:</span>
                <span>+$${saleRecord.taxAmount.toFixed(2)}</span>
              </div>
              
              <div class="receipt-double-divider"></div>

              <div class="receipt-row receipt-bold" style="font-size:14px;">
                <span>NET TOTAL:</span>
                <span>$${saleRecord.grandTotal.toFixed(2)}</span>
              </div>

              <div class="receipt-double-divider"></div>

              <div class="receipt-row">
                <span>Tender: ${saleRecord.paymentMethod}</span>
                <span>Paid: $${saleRecord.amountPaid.toFixed(2)}</span>
              </div>
              ${saleRecord.changeGiven > 0 ? `
                <div class="receipt-row">
                  <span>Change Due:</span>
                  <span>$${saleRecord.changeGiven.toFixed(2)}</span>
                </div>
              ` : ''}

              <div class="receipt-divider"></div>

              <div style="text-align:center; font-size:10px; margin-top:8px;">
                ** SCHEDULE H PRESCRIPTION DRUG NOTICE **<br>
                Take medicines strictly as prescribed by Registered Medical Practitioner.<br>
                Keep in cool & dry place. Keep out of reach of children.
              </div>

              <div class="barcode-box">
                *${saleRecord.invoiceNo}*
              </div>

              <div style="text-align:center; font-size:10px; margin-top:8px;">
                ${pharmacyDB.data.staffUiSettings?.thermalReceiptFooter || `Thank you for choosing ${s.pharmacyName}!`}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('receipt-modal').remove()">Close</button>
            <button class="btn btn-primary" onclick="window.print()">
              ${getIcon('printer')} Print Receipt
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', receiptHtml);
  }
};
