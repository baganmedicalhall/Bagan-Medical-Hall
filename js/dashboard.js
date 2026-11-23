/**
 * Pharmacy Executive Dashboard & Analytics
 * Live financial metrics, shift drawer balances, quick actions, and revenue breakdown.
 */

const Dashboard = {
  render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    pharmacyDB.recalculateAllAccountBalances();
    const pnl = pharmacyDB.getProfitAndLoss();

    // Sales calculation
    let totalSalesVal = 0;
    pharmacyDB.data.sales.forEach(s => totalSalesVal += s.grandTotal);

    const cashInDrawer = pharmacyDB.getAccountBalance('1010');
    const bankBalance = pharmacyDB.getAccountBalance('1020');
    const receivables = pharmacyDB.getAccountBalance('1030');
    const payables = pharmacyDB.getAccountBalance('2010');
    const inventoryVal = pharmacyDB.getAccountBalance('1040');

    // Medicine counts
    const today = new Date();
    const nearExpiryCount = pharmacyDB.data.medicines.filter(m => {
      const diff = Math.ceil((new Date(m.expiryDate) - today) / (1000 * 60 * 60 * 24));
      return diff <= 90;
    }).length;
    const lowStockCount = pharmacyDB.data.medicines.filter(m => m.stock <= m.reorderLevel).length;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Top Executive Welcome & Quick Actions -->
        <div class="app-card" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span style="font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.08em; color: #38bdf8; font-weight: 700;">Pharmacy Management & Accounting ERP</span>
              <h1 style="font-size: 1.45rem; font-weight: 800; margin-top: 2px;">${pharmacyDB.data.settings.pharmacyName}</h1>
              <p style="font-size: 0.82rem; color: #94a3b8;">License: ${pharmacyDB.data.settings.licenseNo} | Tax ID: ${pharmacyDB.data.settings.gstNumber}</p>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-primary btn-lg" onclick="App.navigate('pos')">
                ${getIcon('pos')} Open POS Counter [F2]
              </button>
              <button class="btn btn-secondary" onclick="App.navigate('accounting')">
                ${getIcon('journal')} General Ledger
              </button>
              <button class="btn btn-secondary" onclick="App.navigate('accounts')">
                ${getIcon('customers')} Patient Ledgers
              </button>
            </div>
          </div>
        </div>

        <!-- 6 Key KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <!-- Cash Drawer -->
          <div class="app-card" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #64748b;">Cash in Drawer (POS)</span>
              <span style="color: #10b981;">${getIcon('ledger')}</span>
            </div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #0f172a; margin-top: 0.4rem;">
              $${cashInDrawer.toFixed(2)}
            </div>
            <div style="font-size: 0.72rem; color: #10b981; margin-top: 4px; font-weight: 600;">Account #1010</div>
          </div>

          <!-- Bank Account -->
          <div class="app-card" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #64748b;">Bank Account (Operating)</span>
              <span style="color: #0284c7;">${getIcon('accounting')}</span>
            </div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #0f172a; margin-top: 0.4rem;">
              $${bankBalance.toFixed(2)}
            </div>
            <div style="font-size: 0.72rem; color: #0284c7; margin-top: 4px; font-weight: 600;">Account #1020</div>
          </div>

          <!-- Patient Receivables -->
          <div class="app-card" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #64748b;">Patient Receivables</span>
              <span style="color: #dc2626;">${getIcon('customers')}</span>
            </div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #dc2626; margin-top: 0.4rem;">
              $${receivables.toFixed(2)}
            </div>
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">Credit Sales Uncollected</div>
          </div>

          <!-- Supplier Payables -->
          <div class="app-card" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #64748b;">Supplier Payables</span>
              <span style="color: #d97706;">${getIcon('suppliers')}</span>
            </div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #d97706; margin-top: 0.4rem;">
              $${payables.toFixed(2)}
            </div>
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">Wholesaler Bills Due</div>
          </div>

          <!-- Inventory Asset Valuation -->
          <div class="app-card" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #64748b;">Inventory Stock Value</span>
              <span style="color: #0284c7;">${getIcon('inventory')}</span>
            </div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #0f172a; margin-top: 0.4rem;">
              $${inventoryVal.toFixed(2)}
            </div>
            <div style="font-size: 0.72rem; color: #0284c7; margin-top: 4px;">${pharmacyDB.data.medicines.length} Stocked Drugs</div>
          </div>

          <!-- Net Profit -->
          <div class="app-card" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #64748b;">Net Operating Profit</span>
              <span style="color: #10b981;">${getIcon('reports')}</span>
            </div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #059669; margin-top: 0.4rem;">
              $${pnl.netProfit.toFixed(2)}
            </div>
            <div style="font-size: 0.72rem; color: #059669; margin-top: 4px; font-weight: 600;">Margin: ${pnl.netMarginPct.toFixed(1)}%</div>
          </div>
        </div>

        <!-- 2 Column Section: Activity & Clinical Alerts -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem;">
          <!-- Recent POS Dispensing Invoices -->
          <div class="app-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h2 style="font-size: 1.05rem; font-weight: 700; color: #0f172a;">Recent Dispensing Invoices</h2>
              <button class="btn btn-outline btn-sm" onclick="App.navigate('pos')">New Sale</button>
            </div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Time</th>
                    <th>Patient Name</th>
                    <th>Tender</th>
                    <th class="text-right">Total ($)</th>
                  </tr>
                </thead>
                <tbody>
                  ${pharmacyDB.data.sales.slice(-5).reverse().map(s => `
                    <tr>
                      <td style="font-weight: 700; color: #0284c7;">${s.invoiceNo}</td>
                      <td style="font-size: 0.8rem; color: #64748b;">${s.date}</td>
                      <td>${s.customerName}</td>
                      <td>
                        <span style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: #f1f5f9; font-weight: 500;">
                          ${s.paymentMethod}
                        </span>
                      </td>
                      <td class="text-right" style="font-weight: 700;">$${s.grandTotal.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Clinical & Inventory Health Card -->
          <div class="app-card">
            <h2 style="font-size: 1.05rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem;">Dispensary Alerts</h2>
            
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <!-- Expiry Alert -->
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 0.65rem;">
                  <span style="color: #d97706;">${getIcon('expiry')}</span>
                  <div>
                    <div style="font-weight: 700; font-size: 0.88rem; color: #92400e;">Near Expiry Medicines</div>
                    <div style="font-size: 0.75rem; color: #b45309;">${nearExpiryCount} items expiring within 90 days</div>
                  </div>
                </div>
                <button class="btn btn-outline btn-sm" onclick="App.navigate('inventory'); Inventory.activeTab='near-expiry'; Inventory.render();">
                  View
                </button>
              </div>

              <!-- Low Stock Alert -->
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 0.65rem;">
                  <span style="color: #dc2626;">${getIcon('alert')}</span>
                  <div>
                    <div style="font-weight: 700; font-size: 0.88rem; color: #991b1b;">Reorder Level Alerts</div>
                    <div style="font-size: 0.75rem; color: #b91c1c;">${lowStockCount} items at or below safety stock</div>
                  </div>
                </div>
                <button class="btn btn-outline btn-sm" onclick="App.navigate('inventory'); Inventory.activeTab='low-stock'; Inventory.render();">
                  Reorder
                </button>
              </div>

              <!-- Active Shift Box -->
              <div style="padding: 0.85rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <span style="font-size: 0.78rem; font-weight: 600; color: #475569;">Cashier Shift:</span>
                  <span style="font-size: 0.75rem; color: #10b981; font-weight: 700;">● Active</span>
                </div>
                <div style="font-weight: 700; font-size: 0.88rem; color: #0f172a;">${pharmacyDB.data.settings.activeShift.cashier}</div>
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
                  Drawer Opening Float: $${pharmacyDB.data.settings.activeShift.openingFloat.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};
