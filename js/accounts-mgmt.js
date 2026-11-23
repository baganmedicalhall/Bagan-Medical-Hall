/**
 * Pharmacy Counterparty Accounts Management
 * Manages Customer/Patient Credit Ledgers and Supplier/Wholesaler Payables & Inward Stock Bills.
 */

const AccountsMgmt = {
  activeView: 'customers', // 'customers' or 'suppliers'
  selectedCustomer: null,
  selectedSupplier: null,
  searchQuery: '',

  render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Top Switcher -->
        <div class="app-card" style="padding: 0.75rem 1.25rem; margin-bottom: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn ${this.activeView === 'customers' ? 'btn-primary' : 'btn-outline'} acc-mgmt-tab-btn" data-view="customers">
                ${getIcon('customers')} Patient / Customer Accounts
              </button>
              <button class="btn ${this.activeView === 'suppliers' ? 'btn-primary' : 'btn-outline'} acc-mgmt-tab-btn" data-view="suppliers">
                ${getIcon('suppliers')} Supplier / Wholesaler Accounts
              </button>
            </div>

            <div style="display: flex; gap: 0.5rem;">
              ${this.activeView === 'customers' ? `
                ${(typeof Auth === 'undefined' || Auth.hasPermission('patientLedger')) ? `
                  <button class="btn btn-success" id="btn-add-customer">
                    ${getIcon('plus')} Register New Patient
                  </button>
                ` : ''}
              ` : `
                ${(typeof Auth === 'undefined' || Auth.hasPermission('supplierLedger')) ? `
                  <button class="btn btn-success" id="btn-add-supplier">
                    ${getIcon('plus')} Register New Supplier
                  </button>
                  <button class="btn btn-primary" id="btn-inward-purchase">
                    ${getIcon('inventory')} New Purchase Bill (GRN)
                  </button>
                ` : ''}
              `}
            </div>
          </div>
        </div>

        <!-- Main View Content -->
        <div>
          ${this.activeView === 'customers' ? this.renderCustomersView() : this.renderSuppliersView()}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  renderCustomersView() {
    let list = pharmacyDB.data.customers.filter(c => c.id !== 'CUST-000');
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.phone.includes(q) || 
        c.chronicConditions.toLowerCase().includes(q)
      );
    }

    const totalReceivables = list.reduce((sum, c) => sum + (c.balance || 0), 0);

    return `
      <div class="app-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">Patient Accounts & Receivables</h2>
            <p style="font-size: 0.8rem; color: #64748b;">Manage chronic prescription accounts, credit limits, and collections.</p>
          </div>
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <div class="quick-stats-chip">
              Total Patient Receivables: <strong>$${totalReceivables.toFixed(2)}</strong>
            </div>
            <input type="text" id="cust-search-input" placeholder="Search patient name, phone..." class="form-control" style="width: 220px; font-size: 0.82rem;" value="${this.searchQuery}">
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Phone / Contact</th>
                <th>Chronic Condition & Allergies</th>
                <th class="text-right">Credit Limit ($)</th>
                <th class="text-right">Balance Due ($)</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${list.length === 0 ? `
                <tr><td colspan="6" class="text-center" style="padding: 2.5rem; color: #94a3b8;">No registered patients found</td></tr>
              ` : list.map(c => `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #0f172a;">${c.name}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">ID: ${c.id}</div>
                  </td>
                  <td>
                    <div>${c.phone}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8;">${c.email || ''}</div>
                  </td>
                  <td>
                    <div style="font-size: 0.82rem; font-weight: 500;">${c.chronicConditions || 'General'}</div>
                    ${c.allergies ? `<span style="font-size: 0.72rem; color: #dc2626; background: #fee2e2; padding: 1px 4px; border-radius: 3px;">⚠️ ${c.allergies}</span>` : ''}
                  </td>
                  <td class="text-right" style="font-weight: 600;">$${c.creditLimit.toFixed(2)}</td>
                  <td class="text-right">
                    <span style="font-weight: 800; font-size: 0.95rem; color: ${c.balance > 0 ? '#dc2626' : '#059669'};">
                      $${c.balance.toFixed(2)}
                    </span>
                  </td>
                  <td class="text-center">
                    <div style="display: inline-flex; gap: 0.35rem;">
                      <button class="btn btn-outline btn-sm btn-cust-statement" data-id="${c.id}" title="View Patient Statement">
                        Statement
                      </button>
                      <button class="btn btn-success btn-sm btn-cust-pay" data-id="${c.id}" ${c.balance <= 0 ? 'disabled' : ''} title="Collect Payment">
                        Collect
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderSuppliersView() {
    let list = pharmacyDB.data.suppliers;
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.drugLicenseNo.toLowerCase().includes(q) || 
        s.contactPerson.toLowerCase().includes(q)
      );
    }

    const totalPayables = list.reduce((sum, s) => sum + (s.balancePayable || 0), 0);

    return `
      <div class="app-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">Supplier / Wholesaler Accounts</h2>
            <p style="font-size: 0.8rem; color: #64748b;">Manage drug distributor balances, trade terms, and settlements.</p>
          </div>
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <div class="quick-stats-chip">
              Total Accounts Payable: <strong>$${totalPayables.toFixed(2)}</strong>
            </div>
            <input type="text" id="supp-search-input" placeholder="Search supplier, license..." class="form-control" style="width: 220px; font-size: 0.82rem;" value="${this.searchQuery}">
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Distributor Name</th>
                <th>Drug License & Tax ID</th>
                <th>Contact & Terms</th>
                <th class="text-right">Balance Payable ($)</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${list.length === 0 ? `
                <tr><td colspan="5" class="text-center" style="padding: 2.5rem; color: #94a3b8;">No suppliers found</td></tr>
              ` : list.map(s => `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #0f172a;">${s.name}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">ID: ${s.id}</div>
                  </td>
                  <td>
                    <div style="font-size: 0.82rem;"><strong>DL:</strong> ${s.drugLicenseNo}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">Tax ID: ${s.taxId}</div>
                  </td>
                  <td>
                    <div style="font-weight: 500;">${s.contactPerson} (${s.phone})</div>
                    <div style="font-size: 0.75rem; color: #0284c7;">Terms: ${s.paymentTerms}</div>
                  </td>
                  <td class="text-right">
                    <span style="font-weight: 800; font-size: 0.95rem; color: ${s.balancePayable > 0 ? '#d97706' : '#059669'};">
                      $${s.balancePayable.toFixed(2)}
                    </span>
                  </td>
                  <td class="text-center">
                    <div style="display: inline-flex; gap: 0.35rem;">
                      <button class="btn btn-outline btn-sm btn-supp-statement" data-id="${s.id}" title="View Supplier Ledger">
                        Ledger
                      </button>
                      <button class="btn btn-primary btn-sm btn-supp-pay" data-id="${s.id}" ${s.balancePayable <= 0 ? 'disabled' : ''} title="Make Settlement Payment">
                        Pay Supplier
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  bindEvents() {
    // Switch between Customers and Suppliers
    document.querySelectorAll('.acc-mgmt-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeView = btn.getAttribute('data-view');
        this.searchQuery = '';
        this.render();
      });
    });

    // Customer search
    const custSearch = document.getElementById('cust-search-input');
    if (custSearch) {
      custSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
      });
    }

    // Supplier search
    const suppSearch = document.getElementById('supp-search-input');
    if (suppSearch) {
      suppSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
      });
    }

    // Register Customer modal
    const addCustBtn = document.getElementById('btn-add-customer');
    if (addCustBtn) {
      addCustBtn.addEventListener('click', () => {
        this.showAddCustomerModal();
      });
    }

    // Register Supplier modal
    const addSuppBtn = document.getElementById('btn-add-supplier');
    if (addSuppBtn) {
      addSuppBtn.addEventListener('click', () => {
        this.showAddSupplierModal();
      });
    }

    // Inward Purchase Bill (GRN) modal
    const inwardBtn = document.getElementById('btn-inward-purchase');
    if (inwardBtn) {
      inwardBtn.addEventListener('click', () => {
        this.showInwardPurchaseModal();
      });
    }

    // Customer Statement
    document.querySelectorAll('.btn-cust-statement').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.showCustomerStatementModal(id);
      });
    });

    // Customer Pay / Collect
    document.querySelectorAll('.btn-cust-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.showCustomerPaymentModal(id);
      });
    });

    // Supplier Statement
    document.querySelectorAll('.btn-supp-statement').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.showSupplierStatementModal(id);
      });
    });

    // Supplier Pay
    document.querySelectorAll('.btn-supp-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.showSupplierPaymentModal(id);
      });
    });
  },

  showAddCustomerModal(callback) {
    const modalHtml = `
      <div class="modal-overlay" id="add-cust-modal">
        <div class="modal-card" style="max-width: 550px;">
          <div class="modal-header">
            <h3>Register Patient / Customer Account</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('add-cust-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Full Name *:</label>
                <input type="text" id="new-cust-name" class="form-control" placeholder="e.g. Eleanor Vance" required>
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number *:</label>
                <input type="text" id="new-cust-phone" class="form-control" placeholder="555-1234" required>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Email Address:</label>
                <input type="email" id="new-cust-email" class="form-control" placeholder="patient@example.com">
              </div>
              <div class="form-group">
                <label class="form-label">Credit Limit ($):</label>
                <input type="number" id="new-cust-limit" class="form-control" value="300.00" min="0">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Chronic Conditions / Prescriptions:</label>
              <input type="text" id="new-cust-chronic" class="form-control" placeholder="e.g. Hypertension, Diabetes Type 2">
            </div>

            <div class="form-group">
              <label class="form-label">Known Allergies (Clinical Warning):</label>
              <input type="text" id="new-cust-allergies" class="form-control" placeholder="e.g. Penicillin, Sulfa, Aspirin">
            </div>

            <div class="form-group">
              <label class="form-label">Address:</label>
              <input type="text" id="new-cust-address" class="form-control" placeholder="Street, Apt, City">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('add-cust-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-new-cust">Save Patient</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-save-new-cust').addEventListener('click', () => {
      const name = document.getElementById('new-cust-name').value.trim();
      const phone = document.getElementById('new-cust-phone').value.trim();
      if (!name || !phone) {
        alert('Patient name and phone number are required');
        return;
      }

      const newCust = {
        id: 'CUST-' + (pharmacyDB.data.customers.length + 101),
        name,
        phone,
        email: document.getElementById('new-cust-email').value.trim(),
        address: document.getElementById('new-cust-address').value.trim(),
        allergies: document.getElementById('new-cust-allergies').value.trim(),
        chronicConditions: document.getElementById('new-cust-chronic').value.trim(),
        creditLimit: parseFloat(document.getElementById('new-cust-limit').value) || 300,
        balance: 0.00,
        notes: ''
      };

      pharmacyDB.data.customers.push(newCust);
      pharmacyDB.save();
      document.getElementById('add-cust-modal').remove();
      App.showToast(`Patient ${newCust.name} registered!`, 'success');

      if (callback) callback(newCust);
      else this.render();
    });
  },

  showAddSupplierModal() {
    const modalHtml = `
      <div class="modal-overlay" id="add-supp-modal">
        <div class="modal-card" style="max-width: 550px;">
          <div class="modal-header">
            <h3>Register Pharmaceutical Supplier</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('add-supp-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Distributor / Company Name *:</label>
                <input type="text" id="new-supp-name" class="form-control" placeholder="e.g. Zenith Pharma Logistics" required>
              </div>
              <div class="form-group">
                <label class="form-label">Contact Person:</label>
                <input type="text" id="new-supp-person" class="form-control" placeholder="e.g. David King">
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Drug License # *:</label>
                <input type="text" id="new-supp-dl" class="form-control" placeholder="DL-PH-2026-..." required>
              </div>
              <div class="form-group">
                <label class="form-label">Tax ID / GSTIN:</label>
                <input type="text" id="new-supp-tax" class="form-control" placeholder="TAX-...">
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Phone:</label>
                <input type="text" id="new-supp-phone" class="form-control" placeholder="555-0909">
              </div>
              <div class="form-group">
                <label class="form-label">Payment Terms:</label>
                <select id="new-supp-terms" class="form-control">
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30" selected>Net 30 Days</option>
                  <option value="Net 45">Net 45 Days</option>
                  <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('add-supp-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-new-supp">Save Supplier</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-save-new-supp').addEventListener('click', () => {
      const name = document.getElementById('new-supp-name').value.trim();
      const dl = document.getElementById('new-supp-dl').value.trim();
      if (!name || !dl) {
        alert('Company name and Drug License number are mandatory');
        return;
      }

      const newSupp = {
        id: 'SUP-' + (pharmacyDB.data.suppliers.length + 1),
        name,
        contactPerson: document.getElementById('new-supp-person').value.trim(),
        drugLicenseNo: dl,
        taxId: document.getElementById('new-supp-tax').value.trim(),
        phone: document.getElementById('new-supp-phone').value.trim(),
        paymentTerms: document.getElementById('new-supp-terms').value,
        balancePayable: 0.00,
        notes: ''
      };

      pharmacyDB.data.suppliers.push(newSupp);
      pharmacyDB.save();
      document.getElementById('add-supp-modal').remove();
      App.showToast(`Supplier ${newSupp.name} registered!`, 'success');
      this.render();
    });
  },

  showCustomerPaymentModal(customerId) {
    const cust = pharmacyDB.data.customers.find(c => c.id === customerId);
    if (!cust) return;

    const modalHtml = `
      <div class="modal-overlay" id="cust-pay-modal">
        <div class="modal-card" style="max-width: 460px;">
          <div class="modal-header">
            <h3>Collect Patient Credit Settlement</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('cust-pay-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
              <div style="font-weight: 700; color: #0f172a;">${cust.name}</div>
              <div style="font-size: 0.8rem; color: #64748b;">Phone: ${cust.phone}</div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #dc2626; margin-top: 4px;">
                Outstanding Debt: $${cust.balance.toFixed(2)}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Payment Amount ($) *:</label>
              <input type="number" step="0.01" id="cust-pay-amount" class="form-control" value="${cust.balance.toFixed(2)}" max="${cust.balance.toFixed(2)}" style="font-size: 1.25rem; font-weight: bold;">
            </div>

            <div class="form-group">
              <label class="form-label">Payment Mode *:</label>
              <select id="cust-pay-mode" class="form-control">
                <option value="Cash">Cash in Drawer (Acct #1010)</option>
                <option value="Bank">Bank Transfer / Card (Acct #1020)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Reference / Receipt #:</label>
              <input type="text" id="cust-pay-ref" class="form-control" value="CR-REC-${Date.now().toString().slice(-5)}">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('cust-pay-modal').remove()">Cancel</button>
            <button class="btn btn-success" id="btn-confirm-cust-pay">
              ${getIcon('check')} Record Receipt Voucher
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-confirm-cust-pay').addEventListener('click', () => {
      const amount = parseFloat(document.getElementById('cust-pay-amount').value) || 0;
      const mode = document.getElementById('cust-pay-mode').value;
      const ref = document.getElementById('cust-pay-ref').value;

      if (amount <= 0) {
        alert('Payment amount must be greater than zero');
        return;
      }

      try {
        pharmacyDB.processCustomerPayment(cust.id, amount, mode, ref, `Payment collected for credit clearance`);
        document.getElementById('cust-pay-modal').remove();
        App.showToast(`Receipt voucher recorded. Patient balance updated!`, 'success');
        this.render();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  },

  showSupplierPaymentModal(supplierId) {
    const supp = pharmacyDB.data.suppliers.find(s => s.id === supplierId);
    if (!supp) return;

    const modalHtml = `
      <div class="modal-overlay" id="supp-pay-modal">
        <div class="modal-card" style="max-width: 460px;">
          <div class="modal-header">
            <h3>Disburse Supplier Payment</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('supp-pay-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
              <div style="font-weight: 700; color: #0f172a;">${supp.name}</div>
              <div style="font-size: 0.8rem; color: #64748b;">Terms: ${supp.paymentTerms}</div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #d97706; margin-top: 4px;">
                Payable Balance: $${supp.balancePayable.toFixed(2)}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Payment Amount ($) *:</label>
              <input type="number" step="0.01" id="supp-pay-amount" class="form-control" value="${supp.balancePayable.toFixed(2)}" style="font-size: 1.25rem; font-weight: bold;">
            </div>

            <div class="form-group">
              <label class="form-label">Disburse From Account *:</label>
              <select id="supp-pay-source" class="form-control">
                <option value="Bank">Main Bank Account #1020 (Cheque / Wire)</option>
                <option value="Cash">Cash in Hand #1010</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Cheque / Wire Reference #:</label>
              <input type="text" id="supp-pay-ref" class="form-control" value="CHQ-${Date.now().toString().slice(-5)}">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('supp-pay-modal').remove()">Cancel</button>
            <button class="btn btn-success" id="btn-confirm-supp-pay">
              ${getIcon('check')} Post Payment Voucher
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-confirm-supp-pay').addEventListener('click', () => {
      const amount = parseFloat(document.getElementById('supp-pay-amount').value) || 0;
      const source = document.getElementById('supp-pay-source').value;
      const ref = document.getElementById('supp-pay-ref').value;

      if (amount <= 0) {
        alert('Amount must be positive');
        return;
      }

      try {
        pharmacyDB.processSupplierPayment(supp.id, amount, source, ref, `Settlement voucher for distributor`);
        document.getElementById('supp-pay-modal').remove();
        App.showToast(`Supplier payment posted and ledger updated!`, 'success');
        this.render();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  },

  showCustomerStatementModal(customerId) {
    const cust = pharmacyDB.data.customers.find(c => c.id === customerId);
    if (!cust) return;

    // Filter journals for this customer
    const journals = pharmacyDB.data.journalEntries.filter(j => j.customerId === cust.id);

    const modalHtml = `
      <div class="modal-overlay" id="cust-stmt-modal">
        <div class="modal-card" style="max-width: 650px;">
          <div class="modal-header">
            <h3>Patient Statement of Account: ${cust.name}</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('cust-stmt-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem;">
              <div>
                <div><strong>Phone:</strong> ${cust.phone}</div>
                <div><strong>Conditions:</strong> ${cust.chronicConditions || 'None'}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.8rem; color: #64748b;">Outstanding Balance:</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: #dc2626;">$${cust.balance.toFixed(2)}</div>
              </div>
            </div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Voucher / Invoice</th>
                    <th>Particulars</th>
                    <th class="text-right">Debit ($)</th>
                    <th class="text-right">Credit ($)</th>
                  </tr>
                </thead>
                <tbody>
                  ${journals.length === 0 ? `
                    <tr><td colspan="5" class="text-center" style="padding: 2rem; color: #94a3b8;">No account transactions on record</td></tr>
                  ` : journals.map(j => {
                    const arLine = j.entries.find(e => e.accountId === '1030');
                    return `
                      <tr>
                        <td>${j.date}</td>
                        <td style="font-weight: 600; color: #0284c7;">${j.reference}</td>
                        <td style="font-size: 0.8rem;">${j.narration}</td>
                        <td class="text-right">${arLine && arLine.debit > 0 ? '$' + arLine.debit.toFixed(2) : '-'}</td>
                        <td class="text-right">${arLine && arLine.credit > 0 ? '$' + arLine.credit.toFixed(2) : '-'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('cust-stmt-modal').remove()">Close</button>
            <button class="btn btn-primary" onclick="window.print()">
              ${getIcon('printer')} Print Statement
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  showSupplierStatementModal(supplierId) {
    const supp = pharmacyDB.data.suppliers.find(s => s.id === supplierId);
    if (!supp) return;

    const journals = pharmacyDB.data.journalEntries.filter(j => j.supplierId === supp.id);

    const modalHtml = `
      <div class="modal-overlay" id="supp-stmt-modal">
        <div class="modal-card" style="max-width: 650px;">
          <div class="modal-header">
            <h3>Supplier Ledger: ${supp.name}</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('supp-stmt-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem;">
              <div>
                <div><strong>Drug Lic:</strong> ${supp.drugLicenseNo}</div>
                <div><strong>Terms:</strong> ${supp.paymentTerms}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.8rem; color: #64748b;">Payable Balance:</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: #d97706;">$${supp.balancePayable.toFixed(2)}</div>
              </div>
            </div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ref / Bill #</th>
                    <th>Type</th>
                    <th>Narration</th>
                    <th class="text-right">Debit ($)</th>
                    <th class="text-right">Credit ($)</th>
                  </tr>
                </thead>
                <tbody>
                  ${journals.length === 0 ? `
                    <tr><td colspan="6" class="text-center" style="padding: 2rem; color: #94a3b8;">No transactions for this supplier</td></tr>
                  ` : journals.map(j => {
                    const apLine = j.entries.find(e => e.accountId === '2010');
                    return `
                      <tr>
                        <td>${j.date}</td>
                        <td style="font-weight: 600; color: #0284c7;">${j.reference}</td>
                        <td><span style="font-size: 0.75rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${j.voucherType}</span></td>
                        <td style="font-size: 0.8rem;">${j.narration}</td>
                        <td class="text-right">${apLine && apLine.debit > 0 ? '$' + apLine.debit.toFixed(2) : '-'}</td>
                        <td class="text-right">${apLine && apLine.credit > 0 ? '$' + apLine.credit.toFixed(2) : '-'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('supp-stmt-modal').remove()">Close</button>
            <button class="btn btn-primary" onclick="window.print()">
              ${getIcon('printer')} Print Ledger
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  showInwardPurchaseModal() {
    const modalHtml = `
      <div class="modal-overlay" id="inward-modal">
        <div class="modal-card" style="max-width: 780px;">
          <div class="modal-header">
            <h3>New Inward Purchase Bill / Goods Receipt Note (GRN)</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('inward-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label">Select Wholesaler / Supplier *:</label>
                <select id="grn-supplier" class="form-control">
                  ${pharmacyDB.data.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Supplier Bill / Invoice # *:</label>
                <input type="text" id="grn-invoice-no" class="form-control" value="BILL-${Date.now().toString().slice(-5)}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Payment Terms *:</label>
                <select id="grn-payment-mode" class="form-control">
                  <option value="Credit">On Credit (Accounts Payable)</option>
                  <option value="Bank">Paid from Bank Account</option>
                  <option value="Cash">Paid from Cash Drawer</option>
                </select>
              </div>
            </div>

            <!-- Inward Medicine Line Items -->
            <label class="form-label">Inward Medicines & Batches:</label>
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 0.75rem;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;" id="grn-table">
                <thead style="background: #f1f5f9;">
                  <tr>
                    <th style="padding: 0.5rem; text-align: left;">Medicine Name</th>
                    <th style="padding: 0.5rem; text-align: left; width: 100px;">Batch #</th>
                    <th style="padding: 0.5rem; text-align: left; width: 110px;">Expiry</th>
                    <th style="padding: 0.5rem; text-align: right; width: 70px;">Qty</th>
                    <th style="padding: 0.5rem; text-align: right; width: 85px;">Buy Rate</th>
                    <th style="padding: 0.5rem; text-align: right; width: 85px;">Sell Rate</th>
                    <th style="padding: 0.5rem; text-align: center; width: 35px;"></th>
                  </tr>
                </thead>
                <tbody id="grn-tbody">
                  <tr class="grn-row">
                    <td style="padding: 0.4rem;">
                      <select class="form-control grn-med-select" style="font-size: 0.8rem;">
                        ${pharmacyDB.data.medicines.map(m => `<option value="${m.id}">${m.brandName}</option>`).join('')}
                      </select>
                    </td>
                    <td style="padding: 0.4rem;"><input type="text" class="form-control grn-batch" value="BAT-${Math.floor(1000+Math.random()*9000)}"></td>
                    <td style="padding: 0.4rem;"><input type="date" class="form-control grn-exp" value="2027-12-31"></td>
                    <td style="padding: 0.4rem;"><input type="number" class="form-control grn-qty" value="50" min="1" style="text-align: right;"></td>
                    <td style="padding: 0.4rem;"><input type="number" step="0.01" class="form-control grn-cost" value="5.00" style="text-align: right;"></td>
                    <td style="padding: 0.4rem;"><input type="number" step="0.01" class="form-control grn-sell" value="8.00" style="text-align: right;"></td>
                    <td style="padding: 0.4rem; text-align: center;">
                      <button type="button" class="btn-remove-grn-row" style="background:none; border:none; color:#ef4444; cursor:pointer;">${getIcon('close')}</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style="padding: 0.5rem; background: #fafbfc; border-top: 1px solid #e2e8f0;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-add-grn-row" style="font-size: 0.78rem;">
                  ${getIcon('plus')} Add Another Medicine
                </button>
              </div>
            </div>

            <!-- Notes -->
            <div class="form-group">
              <label class="form-label">Delivery Note / Transport Reference:</label>
              <input type="text" id="grn-notes" class="form-control" placeholder="E.g., Courier challan #4489, Temperature log checked (2-8°C)">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('inward-modal').remove()">Cancel</button>
            <button class="btn btn-success" id="btn-save-grn">
              ${getIcon('check')} Receive Stock & Post Inward Bill
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const tbody = document.getElementById('grn-tbody');

    const attachRowEvents = (row) => {
      row.querySelector('.grn-med-select').addEventListener('change', (e) => {
        const med = pharmacyDB.data.medicines.find(m => m.id === e.target.value);
        if (med) {
          row.querySelector('.grn-cost').value = med.costPrice.toFixed(2);
          row.querySelector('.grn-sell').value = med.sellingPrice.toFixed(2);
        }
      });

      row.querySelector('.btn-remove-grn-row').addEventListener('click', () => {
        if (tbody.querySelectorAll('.grn-row').length > 1) {
          row.remove();
        } else {
          App.showToast('At least one item is required in the purchase bill', 'warning');
        }
      });
    };

    tbody.querySelectorAll('.grn-row').forEach(attachRowEvents);

    document.getElementById('btn-add-grn-row').addEventListener('click', () => {
      const rowHtml = `
        <tr class="grn-row">
          <td style="padding: 0.4rem;">
            <select class="form-control grn-med-select" style="font-size: 0.8rem;">
              ${pharmacyDB.data.medicines.map(m => `<option value="${m.id}">${m.brandName}</option>`).join('')}
            </select>
          </td>
          <td style="padding: 0.4rem;"><input type="text" class="form-control grn-batch" value="BAT-${Math.floor(1000+Math.random()*9000)}"></td>
          <td style="padding: 0.4rem;"><input type="date" class="form-control grn-exp" value="2027-12-31"></td>
          <td style="padding: 0.4rem;"><input type="number" class="form-control grn-qty" value="50" min="1" style="text-align: right;"></td>
          <td style="padding: 0.4rem;"><input type="number" step="0.01" class="form-control grn-cost" value="5.00" style="text-align: right;"></td>
          <td style="padding: 0.4rem;"><input type="number" step="0.01" class="form-control grn-sell" value="8.00" style="text-align: right;"></td>
          <td style="padding: 0.4rem; text-align: center;">
            <button type="button" class="btn-remove-grn-row" style="background:none; border:none; color:#ef4444; cursor:pointer;">${getIcon('close')}</button>
          </td>
        </tr>
      `;
      tbody.insertAdjacentHTML('beforeend', rowHtml);
      attachRowEvents(tbody.lastElementChild);
    });

    // Save GRN
    document.getElementById('btn-save-grn').addEventListener('click', () => {
      const supplierId = document.getElementById('grn-supplier').value;
      const invoiceNumber = document.getElementById('grn-invoice-no').value.trim();
      const paymentMethod = document.getElementById('grn-payment-mode').value;
      const notes = document.getElementById('grn-notes').value.trim();

      const items = [];
      tbody.querySelectorAll('.grn-row').forEach(row => {
        const medicineId = row.querySelector('.grn-med-select').value;
        const med = pharmacyDB.data.medicines.find(m => m.id === medicineId);
        items.push({
          medicineId,
          brandName: med ? med.brandName : '',
          batchNo: row.querySelector('.grn-batch').value.trim(),
          expiryDate: row.querySelector('.grn-exp').value,
          quantity: parseInt(row.querySelector('.grn-qty').value, 10) || 1,
          costPrice: parseFloat(row.querySelector('.grn-cost').value) || 0,
          sellingPrice: parseFloat(row.querySelector('.grn-sell').value) || 0,
          taxRate: med ? med.taxRate : 5
        });
      });

      try {
        const res = pharmacyDB.processSupplierPurchase({
          supplierId,
          invoiceNumber,
          paymentMethod,
          items,
          notes
        });

        document.getElementById('inward-modal').remove();
        App.showToast(`Purchase bill recorded ($${res.grandTotal.toFixed(2)}). Stock updated and ledger posted!`, 'success');
        this.render();
      } catch (err) {
        alert('Failed to process purchase: ' + err.message);
      }
    });
  }
};
