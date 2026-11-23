/**
 * Pharmacy Double-Entry Accounting & Financial Reporting Module
 * Covers Daily Records & Drawer Chaining, Operating Expenses, General Journal,
 * Chart of Accounts, General Ledger, Trial Balance, P&L, Balance Sheet, and Tax.
 */

const Accounting = {
  activeTab: 'daily-records', // 'daily-records', 'expenses', 'journal', 'coa', 'ledger', 'trial', 'pnl', 'balance-sheet', 'tax'
  selectedLedgerAccountId: '1010',
  journalFilterType: 'ALL',
  journalSearchQuery: '',
  selectedDailyDate: new Date().toISOString().split('T')[0],
  dailyTransactionFilter: 'ALL',
  expenseCategoryFilter: 'ALL',
  expenseSearchQuery: '',

  render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Accounting Top Navigation Bar -->
        <div class="app-card" style="padding: 0.75rem 1.25rem; margin-bottom: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="acc-tabs-group">
              <button class="btn ${this.activeTab === 'daily-records' ? 'btn-primary' : 'btn-outline'} acc-tab-btn" data-tab="daily-records" style="font-weight: 700;">
                📅 Daily Records & Drawer
              </button>
              <button class="btn ${this.activeTab === 'expenses' ? 'btn-primary' : 'btn-outline'} acc-tab-btn" data-tab="expenses" style="font-weight: 700;">
                💸 Operating Expenses
              </button>
              <button class="btn ${this.activeTab === 'journal' ? 'btn-primary' : 'btn-outline'} acc-tab-btn" data-tab="journal">
                ${getIcon('journal')} General Journal
              </button>
              <button class="btn ${this.activeTab === 'coa' ? 'btn-primary' : 'btn-outline'} acc-tab-btn" data-tab="coa">
                ${getIcon('accounting')} Chart of Accounts
              </button>
              <button class="btn ${this.activeTab === 'ledger' ? 'btn-primary' : 'btn-outline'} acc-tab-btn" data-tab="ledger">
                ${getIcon('ledger')} General Ledger
              </button>
              <button class="btn ${this.activeTab === 'trial' ? 'btn-primary' : 'btn-outline'} acc-tab-btn" data-tab="trial">
                Trial Balance
              </button>
              <button class="btn ${this.activeTab === 'pnl' ? 'btn-primary' : 'btn-outline'} acc-tab-btn" data-tab="pnl">
                ${getIcon('reports')} Profit & Loss
              </button>
              <button class="btn ${this.activeTab === 'balance-sheet' ? 'btn-primary' : 'btn-outline'} acc-tab-btn" data-tab="balance-sheet">
                Balance Sheet
              </button>
              <button class="btn ${this.activeTab === 'tax' ? 'btn-primary' : 'btn-outline'} acc-tab-btn" data-tab="tax">
                Tax / GST
              </button>
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center;">
              ${(typeof Auth === 'undefined' || Auth.hasPermission('journalEntries')) ? `
                <button class="btn btn-success" id="btn-new-journal-entry">
                  ${getIcon('plus')} New Journal Voucher
                </button>
              ` : ''}
              <button class="btn btn-outline" onclick="window.print()">
                ${getIcon('printer')} Print Report
              </button>
            </div>
          </div>
        </div>

        <!-- Tab Body Container -->
        <div id="acc-tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  renderTabContent() {
    switch (this.activeTab) {
      case 'daily-records': return this.renderDailyRecordsTab();
      case 'expenses': return this.renderExpensesTab();
      case 'journal': return this.renderJournalTab();
      case 'coa': return this.renderCOATab();
      case 'ledger': return this.renderLedgerTab();
      case 'trial': return this.renderTrialBalanceTab();
      case 'pnl': return this.renderProfitAndLossTab();
      case 'balance-sheet': return this.renderBalanceSheetTab();
      case 'tax': return this.renderTaxTab();
      default: return this.renderDailyRecordsTab();
    }
  },

  /* -------------------------------------------------------------
   * 1. DAILY RECORDS & DRAWER RECONCILIATION TAB
   * Chained opening/closing collection:
   * Final closing balance of day N becomes opening balance of day N+1
   * ------------------------------------------------------------- */
  renderDailyRecordsTab() {
    const targetDate = this.selectedDailyDate || new Date().toISOString().split('T')[0];
    const rec = pharmacyDB.getDailyDrawerRecord(targetDate) || {};

    const fmt = (v) => (parseFloat(v) || 0).toFixed(2);

    // Compute previous and next date strings
    const curr = new Date(targetDate + 'T00:00:00');
    const prev = new Date(curr);
    prev.setDate(prev.getDate() - 1);
    const prevDateStr = prev.toISOString().split('T')[0];

    const next = new Date(curr);
    next.setDate(next.getDate() + 1);
    const nextDateStr = next.toISOString().split('T')[0];
    const isToday = targetDate === new Date().toISOString().split('T')[0];

    // Filter transactions
    let transactions = Array.isArray(rec.transactions) ? [...rec.transactions] : [];
    if (this.dailyTransactionFilter !== 'ALL') {
      transactions = transactions.filter(t => t.type === this.dailyTransactionFilter);
    }

    const openingBal = parseFloat(rec.openingBalance) || 0;
    const closingBal = parseFloat(rec.closingDrawerBalance !== undefined ? rec.closingDrawerBalance : rec.finalClosingBalance) || 0;
    const netCash = parseFloat(rec.netDrawerCash !== undefined ? rec.netDrawerCash : rec.netCashCollection) || 0;
    const cashSales = parseFloat(rec.cashSales) || 0;
    const onlineQrSales = parseFloat(rec.onlineQrSales !== undefined ? rec.onlineQrSales : rec.totalDigitalCollection) || 0;
    const grossSales = parseFloat(rec.grossSales !== undefined ? rec.grossSales : rec.totalDaySales) || 0;
    const cashExp = parseFloat(rec.cashExpenses) || 0;

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Date Selector & Shift Status Header -->
        <div class="app-card" style="margin-bottom: 0; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">Select Audit Date:</span>
              <button class="btn btn-outline btn-sm" id="btn-daily-prev-date" title="Previous Day">◀ ${prevDateStr}</button>
              <input type="date" id="input-daily-records-date" class="form-control" style="width: 170px; font-weight: 700; font-size: 0.9rem;" value="${targetDate}">
              <button class="btn btn-outline btn-sm" id="btn-daily-next-date" title="Next Day">${nextDateStr} ▶</button>
              <button class="btn btn-sm ${isToday ? 'btn-secondary' : 'btn-outline'}" id="btn-daily-today">Today</button>
            </div>

            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <button class="btn btn-outline btn-sm" id="btn-override-opening" title="Adjust or Override Opening Balance">
                ⚙️ Adjust Opening Balance
              </button>
              ${rec.isClosed ? `
                <div style="display: inline-flex; align-items: center; gap: 6px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 0.4rem 0.85rem; border-radius: 20px; font-weight: 700; font-size: 0.82rem;">
                  🔒 Register Shift Closed (${rec.closingRecord?.closedAt || ''})
                </div>
              ` : `
                <button class="btn btn-primary" id="btn-open-close-shift" style="font-weight: 700;">
                  🌙 Lock & Close Register Shift
                </button>
              `}
            </div>
          </div>

          <!-- Shift Notice Banner -->
          <div style="margin-top: 0.85rem; padding: 0.65rem 1rem; border-radius: 8px; font-size: 0.82rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; ${rec.isClosed ? 'background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;' : 'background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af;'}">
            <div>
              <strong>Shift Policy:</strong> 
              ${rec.isClosed 
                ? `Shift for ${targetDate} is locked. The final collection of $${fmt(closingBal)} is chained as the opening balance of ${nextDateStr}.`
                : `Active register shift for ${targetDate}. Opening balance of $${fmt(openingBal)} was chained from ${rec.openingPrevDate || prevDateStr}. Once locked, closing balance becomes tomorrow's opening balance.`
              }
            </div>
            <span style="font-size: 0.75rem; color: #64748b;">Source: ${rec.openingSource || 'chained_from_previous_day'}</span>
          </div>
        </div>

        <!-- 5 Primary KPI Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem;">
          <!-- 1. Opening Balance Card -->
          <div class="stat-card" style="border-left: 4px solid #3b82f6;">
            <div class="stat-icon" style="background: #eff6ff; color: #2563eb;">🌅</div>
            <div style="flex: 1;">
              <div class="stat-label">Opening Drawer Balance</div>
              <div class="stat-value" style="color: #0f172a;">$${fmt(openingBal)}</div>
              <div style="font-size: 0.72rem; color: #64748b;">
                Chained from ${rec.openingPrevDate || prevDateStr} closing
              </div>
            </div>
          </div>

          <!-- 2. Daily Drawer Cash Collection -->
          <div class="stat-card" style="border-left: 4px solid #10b981;">
            <div class="stat-icon" style="background: #ecfdf5; color: #059669;">💵</div>
            <div style="flex: 1;">
              <div class="stat-label">Daily Cash in Drawer</div>
              <div class="stat-value" style="color: #059669;">$${fmt(netCash)}</div>
              <div style="font-size: 0.72rem; color: #64748b;">
                Sales: $${fmt(cashSales)} | Credit: +$${fmt(rec.creditCash || 0)} | Exp: -$${fmt(cashExp)}
              </div>
            </div>
          </div>

          <!-- 3. Patient Credit Collections (A/c Received) -->
          <div class="stat-card" style="border-left: 4px solid #059669; background: #f0fdf4;">
            <div class="stat-icon" style="background: #dcfce7; color: #15803d;">💳</div>
            <div style="flex: 1;">
              <div class="stat-label">Credit Collected (A/c Received)</div>
              <div class="stat-value" style="color: #166534;">$${fmt(rec.totalCreditCollected || 0)}</div>
              <div style="font-size: 0.72rem; color: #15803d; font-weight: 600;">
                Cash in Drawer: +$${fmt(rec.creditCash || 0)} | Digital: +$${fmt(rec.creditDigital || 0)}
              </div>
            </div>
          </div>

          <!-- 4. Online / QR / Card Collection -->
          <div class="stat-card" style="border-left: 4px solid #8b5cf6;">
            <div class="stat-icon" style="background: #f5f3ff; color: #7c3aed;">📱</div>
            <div style="flex: 1;">
              <div class="stat-label">Online / QR / Card Collection</div>
              <div class="stat-value" style="color: #7c3aed;">$${fmt(onlineQrSales)}</div>
              <div style="font-size: 0.72rem; color: #64748b;">
                Digital UPI, QR & POS card terminals
              </div>
            </div>
          </div>

          <!-- 5. Final Collection / Closing Drawer Balance -->
          <div class="stat-card" style="border-left: 4px solid #f59e0b; background: #fffdf5;">
            <div class="stat-icon" style="background: #fef3c7; color: #d97706;">🌙</div>
            <div style="flex: 1;">
              <div class="stat-label">Final Collection / Closing Balance</div>
              <div class="stat-value" style="color: #b45309; font-size: 1.6rem;">$${fmt(closingBal)}</div>
              <div style="font-size: 0.72rem; font-weight: 600; color: #b45309;">
                Opening ($${fmt(openingBal)}) + Net Cash ($${fmt(netCash)})
              </div>
            </div>
          </div>
        </div>

        <!-- Financial Transactions Table for Date -->
        <div class="app-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">Financial Transactions for ${targetDate}</h2>
              <p style="font-size: 0.8rem; color: #64748b;">Chronological record of dispensary cash flow, sales invoices, operating expenses, and fees.</p>
            </div>

            <!-- Transaction Type Filter -->
            <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 0.8rem; font-weight: 600; color: #475569;">Show:</span>
              <button class="btn btn-sm ${this.dailyTransactionFilter === 'ALL' ? 'btn-primary' : 'btn-outline'} daily-tx-filter-btn" data-type="ALL">All (${transactions.length})</button>
              <button class="btn btn-sm ${this.dailyTransactionFilter === 'POS Sale' ? 'btn-primary' : 'btn-outline'} daily-tx-filter-btn" data-type="POS Sale">Sales</button>
              <button class="btn btn-sm ${this.dailyTransactionFilter === 'Credit Collection' ? 'btn-primary' : 'btn-outline'} daily-tx-filter-btn" data-type="Credit Collection">Credit Collections</button>
              <button class="btn btn-sm ${this.dailyTransactionFilter === 'Expense' ? 'btn-primary' : 'btn-outline'} daily-tx-filter-btn" data-type="Expense">Expenses</button>
              <button class="btn btn-sm ${this.dailyTransactionFilter === 'Clinical Treatment' ? 'btn-primary' : 'btn-outline'} daily-tx-filter-btn" data-type="Clinical Treatment">Treatments</button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Time / Ref #</th>
                  <th>Transaction Type</th>
                  <th>Particulars / Narration</th>
                  <th>Payment Method</th>
                  <th class="text-right">Transaction Amount ($)</th>
                  <th class="text-right">Cash Drawer Impact ($)</th>
                  <th class="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                ${transactions.length === 0 ? `
                  <tr>
                    <td colspan="7" class="text-center" style="padding: 2.5rem; color: #94a3b8;">
                      No financial transactions recorded on ${targetDate}.
                    </td>
                  </tr>
                ` : transactions.map(t => {
                  const typeColors = {
                    'POS Sale': { bg: '#e0f2fe', text: '#0369a1' },
                    'Credit Collection': { bg: '#dcfce7', text: '#15803d' },
                    'Expense': { bg: '#fee2e2', text: '#b91c1c' },
                    'Clinical Treatment': { bg: '#fef3c7', text: '#b45309' },
                    'Journal Entry': { bg: '#ede9fe', text: '#6d28d9' }
                  }[t.type] || { bg: '#f1f5f9', text: '#475569' };

                  const isExp = t.type === 'Expense';
                  const tAmt = parseFloat(t.amount !== undefined ? t.amount : (t.inflow || t.outflow)) || 0;
                  const isCash = !!t.isCashDrawer;

                  return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="font-size: 0.82rem; white-space: nowrap;">
                        <span style="font-weight: 700; color: #0284c7;">${t.ref || t.id || 'TX'}</span>
                        <div style="font-size: 0.72rem; color: #64748b;">${t.time || ''}</div>
                      </td>
                      <td>
                        <span style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; background: ${typeColors.bg}; color: ${typeColors.text};">
                          ${t.type}
                        </span>
                      </td>
                      <td style="font-size: 0.84rem; color: #334155;">
                        <div style="font-weight: 600;">${t.description || t.notes || 'Transaction'}</div>
                      </td>
                      <td style="font-size: 0.8rem; white-space: nowrap;">
                        <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: ${isCash ? '#059669' : '#7c3aed'};">
                          ${isCash ? '💵 ' : '📱 '}${t.paymentMethod || 'Cash'}
                        </span>
                      </td>
                      <td class="text-right" style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">
                        ${isExp ? '-' : ''}$${fmt(Math.abs(tAmt))}
                      </td>
                      <td class="text-right" style="font-weight: 700; font-size: 0.88rem; color: ${isCash ? (isExp ? '#dc2626' : '#059669') : '#94a3b8'};">
                        ${isCash ? (isExp ? '-' : '+') + '$' + fmt(Math.abs(tAmt)) : 'No Cash Flow'}
                      </td>
                      <td class="text-center" style="font-size: 0.75rem;">
                        <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 600; color: #475569;">
                          ${t.status || 'Verified'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a;">
                  <td colspan="4" style="text-transform: uppercase;">Total Turnover for ${targetDate}:</td>
                  <td class="text-right" style="color: #0f172a; font-size: 0.95rem;">
                    Gross Sales: $${fmt(grossSales)}
                  </td>
                  <td class="text-right" style="color: #059669; font-size: 0.95rem;">
                    Net Drawer: $${fmt(netCash)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * 2. EXPENSE MANAGEMENT TAB (Add, Edit, Delete Form & Table)
   * Double-entry postings: Debit 5090 / Credit 1010 or 1020
   * ------------------------------------------------------------- */
  renderExpensesTab() {
    const allExpenses = pharmacyDB.data.expenses || [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Compute stats
    const todayExpenses = allExpenses.filter(e => e.date === todayStr);
    const todaySum = todayExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalSum = allExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const cashExpensesSum = allExpenses.filter(e => e.isCashFromDrawer).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const onlineExpensesSum = allExpenses.filter(e => !e.isCashFromDrawer).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Filter
    let filtered = [...allExpenses].reverse();
    if (this.expenseCategoryFilter !== 'ALL') {
      filtered = filtered.filter(e => e.category === this.expenseCategoryFilter);
    }
    if (this.expenseSearchQuery.trim()) {
      const q = this.expenseSearchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.payee && e.payee.toLowerCase().includes(q)) ||
        (e.voucherNo && e.voucherNo.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q))
      );
    }

    const liveExpCats = (pharmacyDB.getExpenseCategories ? pharmacyDB.getExpenseCategories() : []).map(c => typeof c === 'string' ? c : c.name);
    const categories = ['ALL', ...(liveExpCats.length ? liveExpCats : ['Utilities', 'Dispensary Supplies', 'Rent & Premises', 'Staff Welfare', 'Maintenance', 'Marketing', 'License & Regulatory', 'Logistics & Courier', 'Other Expenses'])];

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Top Stats Row -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem;">
          <div class="stat-card" style="border-left: 4px solid #ef4444;">
            <div class="stat-icon" style="background: #fee2e2; color: #dc2626;">💸</div>
            <div>
              <div class="stat-label">Total Recorded Expenses</div>
              <div class="stat-value" style="color: #dc2626;">$${totalSum.toFixed(2)}</div>
              <div style="font-size: 0.72rem; color: #64748b;">${allExpenses.length} total expense entries</div>
            </div>
          </div>

          <div class="stat-card" style="border-left: 4px solid #f59e0b;">
            <div class="stat-icon" style="background: #fef3c7; color: #d97706;">📅</div>
            <div>
              <div class="stat-label">Today's Expenses</div>
              <div class="stat-value">$${todaySum.toFixed(2)}</div>
              <div style="font-size: 0.72rem; color: #64748b;">${todayExpenses.length} expenses logged today</div>
            </div>
          </div>

          <div class="stat-card" style="border-left: 4px solid #10b981;">
            <div class="stat-icon" style="background: #ecfdf5; color: #059669;">💵</div>
            <div>
              <div class="stat-label">Paid from Cash Drawer</div>
              <div class="stat-value" style="color: #059669;">$${cashExpensesSum.toFixed(2)}</div>
              <div style="font-size: 0.72rem; color: #64748b;">Subtracted from daily drawer balance</div>
            </div>
          </div>

          <div class="stat-card" style="border-left: 4px solid #8b5cf6;">
            <div class="stat-icon" style="background: #ede9fe; color: #7c3aed;">🏦</div>
            <div>
              <div class="stat-label">Paid Online / Bank Transfer</div>
              <div class="stat-value" style="color: #7c3aed;">$${onlineExpensesSum.toFixed(2)}</div>
              <div style="font-size: 0.72rem; color: #64748b;">Disbursed from pharmacy bank account</div>
            </div>
          </div>
        </div>

        <!-- Expenses List Card -->
        <div class="app-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <h2 style="font-size: 1.2rem; font-weight: 700; color: #0f172a;">Dispensary Operating Expenses</h2>
              <p style="font-size: 0.8rem; color: #64748b;">Record, edit, and audit day-to-day store expenditures with automated double-entry ledger integration.</p>
            </div>

            <button class="btn btn-primary" id="btn-add-expense">
              <span>➕</span> Add New Operating Expense
            </button>
          </div>

          <!-- Filter Toolbar -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <label style="font-size: 0.82rem; font-weight: 600; color: #475569;">Category:</label>
              <select id="expense-category-filter" class="form-control" style="width: 200px; font-size: 0.82rem;">
                ${categories.map(c => `<option value="${c}" ${this.expenseCategoryFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="text" id="expense-search-input" placeholder="Search payee, voucher #, notes..." class="form-control" style="width: 260px; font-size: 0.82rem;" value="${this.expenseSearchQuery}">
            </div>
          </div>

          <!-- Expenses Table -->
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date & Voucher</th>
                  <th>Category</th>
                  <th>Description / Particulars</th>
                  <th>Payee / Vendor</th>
                  <th>Payment Method</th>
                  <th class="text-right">Amount ($)</th>
                  <th>Logged By</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="8" class="text-center" style="padding: 2.5rem; color: #94a3b8;">
                      No operating expense records found matching criteria.
                    </td>
                  </tr>
                ` : filtered.map(e => `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="white-space: nowrap; font-size: 0.82rem;">
                      <div style="font-weight: 700; color: #0f172a;">${e.date}</div>
                      <span style="font-size: 0.74rem; color: #0284c7; font-weight: 600;">${e.voucherNo}</span>
                    </td>
                    <td>
                      <span style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 9999px; background: #fee2e2; color: #b91c1c;">
                        ${e.category}
                      </span>
                    </td>
                    <td style="font-size: 0.84rem; color: #334155;">
                      <div style="font-weight: 600;">${e.description}</div>
                      ${e.notes ? `<div style="font-size: 0.72rem; color: #64748b; font-style: italic;">${e.notes}</div>` : ''}
                    </td>
                    <td style="font-size: 0.82rem; color: #0f172a; font-weight: 600;">
                      ${e.payee || 'Direct Vendor'}
                    </td>
                    <td style="font-size: 0.8rem; white-space: nowrap;">
                      <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: ${e.isCashFromDrawer ? '#059669' : '#7c3aed'};">
                        ${e.isCashFromDrawer ? '💵 Cash Drawer' : '🏦 Online / Bank'}
                      </span>
                    </td>
                    <td class="text-right" style="font-weight: 700; font-size: 0.95rem; color: #dc2626;">
                      $${parseFloat(e.amount || 0).toFixed(2)}
                    </td>
                    <td style="font-size: 0.76rem; color: #64748b;">
                      ${e.recordedBy || 'Staff'}
                    </td>
                    <td class="text-center" style="white-space: nowrap;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-sm btn-outline btn-edit-expense" data-expense-id="${e.id}" title="Edit Expense" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                          ✏️ Edit
                        </button>
                        <button class="btn btn-sm btn-outline btn-delete-expense" data-expense-id="${e.id}" title="Delete Expense" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: #ef4444;">
                          🗑️
                        </button>
                      </div>
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
   * 3. GENERAL JOURNAL TAB (Existing Verified Implementation)
   * ------------------------------------------------------------- */
  renderJournalTab() {
    let entries = [...pharmacyDB.data.journalEntries].reverse();
    if (this.journalFilterType !== 'ALL') {
      entries = entries.filter(j => j.voucherType === this.journalFilterType);
    }
    if (this.journalSearchQuery.trim()) {
      const q = this.journalSearchQuery.toLowerCase();
      entries = entries.filter(j => 
        j.reference.toLowerCase().includes(q) || 
        j.narration.toLowerCase().includes(q) ||
        j.voucherType.toLowerCase().includes(q)
      );
    }

    const types = ['ALL', 'POS Sales Voucher', 'Purchase Voucher', 'Payment Voucher', 'Receipt Voucher', 'Journal Voucher', 'Opening Balance'];

    return `
      <div class="app-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">General Journal Transactions</h2>
            <p style="font-size: 0.8rem; color: #64748b;">Complete chronological double-entry ledger with automated voucher verification.</p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <select id="journal-filter-type" class="form-control" style="width: 180px; font-size: 0.82rem;">
              ${types.map(t => `<option value="${t}" ${this.journalFilterType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <input type="text" id="journal-search-input" placeholder="Search reference, narration..." class="form-control" style="width: 200px; font-size: 0.82rem;" value="${this.journalSearchQuery}">
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date / Ref</th>
                <th>Voucher Type</th>
                <th>Narration</th>
                <th>Account & Particulars</th>
                <th class="text-right">Debit ($)</th>
                <th class="text-right">Credit ($)</th>
              </tr>
            </thead>
            <tbody>
              ${entries.length === 0 ? `
                <tr><td colspan="6" class="text-center" style="padding: 2.5rem; color: #94a3b8;">No journal entries found</td></tr>
              ` : entries.map(j => `
                <tr style="background: #fafbfc; border-top: 2px solid #e2e8f0;">
                  <td style="font-weight: 700;">
                    <div>${j.date}</div>
                    <span style="font-size: 0.75rem; color: #0284c7;">${j.reference}</span>
                  </td>
                  <td>
                    <span style="font-size: 0.76rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 4px; background: #e0f2fe; color: #0369a1;">
                      ${j.voucherType}
                    </span>
                  </td>
                  <td colspan="4" style="font-style: italic; color: #475569; font-size: 0.82rem;">
                    ${j.narration}
                  </td>
                </tr>
                ${j.entries.map(line => `
                  <tr>
                    <td colspan="3" style="border-top: none;"></td>
                    <td style="padding-left: ${line.credit > 0 ? '2rem' : '1rem'}; font-size: 0.84rem;">
                      ${line.credit > 0 ? 'To ' : ''}<strong>${line.accountName}</strong>
                      <span style="font-size: 0.72rem; color: #94a3b8; margin-left: 6px;">[#${line.accountId}]</span>
                    </td>
                    <td class="text-right" style="font-weight: 600; color: #0f172a; font-size: 0.84rem;">
                      ${line.debit > 0 ? '$' + line.debit.toFixed(2) : '-'}
                    </td>
                    <td class="text-right" style="font-weight: 600; color: #0f172a; font-size: 0.84rem;">
                      ${line.credit > 0 ? '$' + line.credit.toFixed(2) : '-'}
                    </td>
                  </tr>
                `).join('')}
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * 4. CHART OF ACCOUNTS (COA)
   * ------------------------------------------------------------- */
  renderCOATab() {
    pharmacyDB.recalculateAllAccountBalances();

    return `
      <div class="app-card">
        <div style="margin-bottom: 1.25rem;">
          <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">Chart of Accounts (COA)</h2>
          <p style="font-size: 0.8rem; color: #64748b;">Unified accounting structure for medical pharmacy operations and regulatory compliance.</p>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Title</th>
                <th>Account Type</th>
                <th>Sub-Type</th>
                <th>Normal Side</th>
                <th class="text-right">Current Balance ($)</th>
                <th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              ${pharmacyDB.data.accounts.map(acc => {
                const badgeColor = {
                  'Asset': '#10b981',
                  'Liability': '#f59e0b',
                  'Equity': '#6366f1',
                  'Revenue': '#0284c7',
                  'Expense': '#ec4899'
                }[acc.type] || '#64748b';

                return `
                  <tr>
                    <td style="font-weight: 700; color: #0f172a;">#${acc.code}</td>
                    <td style="font-weight: 600;">${acc.name}</td>
                    <td>
                      <span style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 9999px; background: ${badgeColor}20; color: ${badgeColor};">
                        ${acc.type}
                      </span>
                    </td>
                    <td style="font-size: 0.8rem; color: #64748b;">${acc.subType}</td>
                    <td style="font-size: 0.8rem;">${acc.normal}</td>
                    <td class="text-right" style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">
                      $${acc.balance.toFixed(2)}
                    </td>
                    <td class="text-center">
                      <button class="btn btn-outline btn-sm view-ledger-btn" data-acc-id="${acc.id}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                        View Ledger
                      </button>
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
   * 5. GENERAL LEDGER
   * ------------------------------------------------------------- */
  renderLedgerTab() {
    const ledgerData = pharmacyDB.getGeneralLedgerForAccount(this.selectedLedgerAccountId);
    const acc = ledgerData ? ledgerData.account : pharmacyDB.data.accounts[0];

    return `
      <div class="app-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">General Ledger Statement</h2>
            <p style="font-size: 0.8rem; color: #64748b;">Individual account audit trail with running balances.</p>
          </div>

          <!-- Account Selector -->
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="font-size: 0.82rem; font-weight: 600;">Select Account:</label>
            <select id="ledger-account-select" class="form-control" style="width: 280px; font-size: 0.84rem;">
              ${pharmacyDB.data.accounts.map(a => `
                <option value="${a.id}" ${this.selectedLedgerAccountId === a.id ? 'selected' : ''}>
                  #${a.code} - ${a.name}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Account Info Header Card -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem;">
          <div>
            <div style="font-size: 0.74rem; color: #64748b; text-transform: uppercase;">Account Code & Name</div>
            <div style="font-weight: 700; color: #0f172a;">#${acc.code} - ${acc.name}</div>
          </div>
          <div>
            <div style="font-size: 0.74rem; color: #64748b; text-transform: uppercase;">Classification</div>
            <div style="font-weight: 600; color: #334155;">${acc.type} (${acc.subType})</div>
          </div>
          <div>
            <div style="font-size: 0.74rem; color: #64748b; text-transform: uppercase;">Normal Balance Side</div>
            <div style="font-weight: 600; color: #334155;">${acc.normal}</div>
          </div>
          <div>
            <div style="font-size: 0.74rem; color: #64748b; text-transform: uppercase;">Current Net Balance</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #0284c7;">$${ledgerData ? ledgerData.finalBalance.toFixed(2) : '0.00'}</div>
          </div>
        </div>

        <!-- Ledger Table -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher #</th>
                <th>Type</th>
                <th>Particulars / Narration</th>
                <th class="text-right">Debit ($)</th>
                <th class="text-right">Credit ($)</th>
                <th class="text-right">Running Balance ($)</th>
              </tr>
            </thead>
            <tbody>
              ${!ledgerData || ledgerData.transactions.length === 0 ? `
                <tr><td colspan="7" class="text-center" style="padding: 2.5rem; color: #94a3b8;">No transactions for this account</td></tr>
              ` : ledgerData.transactions.map(tx => `
                <tr>
                  <td>${tx.date}</td>
                  <td style="font-weight: 600; color: #0284c7;">${tx.reference}</td>
                  <td><span style="font-size: 0.75rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${tx.voucherType}</span></td>
                  <td style="font-size: 0.82rem; color: #475569;">${tx.narration}</td>
                  <td class="text-right" style="font-weight: 600;">${tx.debit > 0 ? '$' + tx.debit.toFixed(2) : '-'}</td>
                  <td class="text-right" style="font-weight: 600;">${tx.credit > 0 ? '$' + tx.credit.toFixed(2) : '-'}</td>
                  <td class="text-right" style="font-weight: 700; color: #0f172a;">$${tx.runningBalance.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * 6. TRIAL BALANCE
   * ------------------------------------------------------------- */
  renderTrialBalanceTab() {
    const tb = pharmacyDB.getTrialBalance();

    return `
      <div class="app-card" id="printable-statement-area">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: #0f172a;">Trial Balance</h2>
            <p style="font-size: 0.8rem; color: #64748b;">Verification of accounting integrity. As of ${new Date().toLocaleDateString()}.</p>
          </div>
          <div>
            ${tb.isBalanced ? `
              <span style="display: inline-flex; align-items: center; gap: 6px; background: #ecfdf5; color: #059669; padding: 0.4rem 0.85rem; border-radius: 20px; font-size: 0.82rem; font-weight: 700; border: 1px solid #a7f3d0;">
                ${getIcon('check')} BOOKS ARE BALANCED
              </span>
            ` : `
              <span style="display: inline-flex; align-items: center; gap: 6px; background: #fef2f2; color: #dc2626; padding: 0.4rem 0.85rem; border-radius: 20px; font-size: 0.82rem; font-weight: 700; border: 1px solid #fecaca;">
                ${getIcon('alert')} UNBALANCED (Diff: $${Math.abs(tb.totalDebit - tb.totalCredit).toFixed(2)})
              </span>
            `}
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Title</th>
                <th>Category</th>
                <th class="text-right">Debit ($)</th>
                <th class="text-right">Credit ($)</th>
              </tr>
            </thead>
            <tbody>
              ${tb.rows.map(row => `
                <tr>
                  <td style="font-weight: 600;">#${row.code}</td>
                  <td style="font-weight: 600;">${row.name}</td>
                  <td><span style="font-size: 0.75rem; color: #64748b;">${row.type}</span></td>
                  <td class="text-right" style="font-weight: 600;">${row.debit > 0 ? '$' + row.debit.toFixed(2) : '-'}</td>
                  <td class="text-right" style="font-weight: 600;">${row.credit > 0 ? '$' + row.credit.toFixed(2) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-size: 0.95rem; border-top: 2px solid #0f172a; border-bottom: 3px double #0f172a;">
                <td colspan="3" style="font-weight: 800; text-transform: uppercase;">Total Trial Balance</td>
                <td class="text-right" style="font-weight: 800; color: #0f172a;">$${tb.totalDebit.toFixed(2)}</td>
                <td class="text-right" style="font-weight: 800; color: #0f172a;">$${tb.totalCredit.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * 7. PROFIT & LOSS STATEMENT
   * ------------------------------------------------------------- */
  renderProfitAndLossTab() {
    const pnl = pharmacyDB.getProfitAndLoss();

    return `
      <div class="app-card" id="printable-statement-area">
        <div style="margin-bottom: 1.5rem; text-align: center;">
          <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a;">Profit & Loss Statement (Income Statement)</h2>
          <p style="font-size: 0.82rem; color: #64748b;">Trading and Operating Performance for Current Accounting Period</p>
        </div>

        <div style="max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem;">
          <!-- 1. Operating Revenue Section -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
            <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem; margin-bottom: 0.5rem; text-transform: uppercase;">Operating Revenue</div>
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-bottom: 0.35rem;">
              <span>Medicine Sales (Rx & OTC)</span>
              <span>$${pnl.salesRev.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-bottom: 0.35rem;">
              <span>Prescription Dispensing & Advisory Fees</span>
              <span>$${pnl.serviceRev.toFixed(2)}</span>
            </div>
            ${pnl.discounts > 0 ? `
              <div style="display: flex; justify-content: space-between; font-size: 0.88rem; color: #dc2626; margin-bottom: 0.35rem;">
                <span>Less: Sales Discounts Allowed</span>
                <span>-$${pnl.discounts.toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.95rem; border-top: 1px solid #cbd5e1; padding-top: 0.5rem; margin-top: 0.5rem;">
              <span>Net Revenue</span>
              <span style="color: #0284c7;">$${pnl.netRevenue.toFixed(2)}</span>
            </div>
          </div>

          <!-- 2. Cost of Goods Sold & Gross Profit -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
            <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem; margin-bottom: 0.5rem; text-transform: uppercase;">Cost of Goods Sold (COGS)</div>
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
              <span>Pharmacy Cost of Goods Sold</span>
              <span>$${pnl.cogs.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.05rem; border-top: 1px solid #cbd5e1; padding-top: 0.5rem; margin-top: 0.5rem; color: #0f172a;">
              <span>GROSS PROFIT (Margin: ${pnl.grossMarginPct.toFixed(1)}%)</span>
              <span style="color: #059669;">$${pnl.grossProfit.toFixed(2)}</span>
            </div>
          </div>

          <!-- 3. Operating Expenses -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
            <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem; margin-bottom: 0.5rem; text-transform: uppercase;">Operating & Clinical Expenses</div>
            ${pnl.expenses.map(e => `
              <div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-bottom: 0.35rem;">
                <span>${e.name}</span>
                <span>$${e.amount.toFixed(2)}</span>
              </div>
            `).join('')}
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.95rem; border-top: 1px solid #cbd5e1; padding-top: 0.5rem; margin-top: 0.5rem;">
              <span>Total Operating Expenses</span>
              <span style="color: #dc2626;">$${pnl.totalOperatingExpenses.toFixed(2)}</span>
            </div>
          </div>

          <!-- 4. Net Profit / (Loss) Bottom Line -->
          <div style="background: #0f172a; color: #ffffff; border-radius: 10px; padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 1.2rem; font-weight: 800; letter-spacing: -0.01em;">
                ${pnl.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}
              </div>
              <div style="font-size: 0.78rem; color: #94a3b8;">Net Profit Margin: ${pnl.netMarginPct.toFixed(1)}%</div>
            </div>
            <div style="font-size: 1.85rem; font-weight: 900; color: ${pnl.netProfit >= 0 ? '#34d399' : '#f87171'};">
              $${pnl.netProfit.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * 8. BALANCE SHEET STATEMENT
   * ------------------------------------------------------------- */
  renderBalanceSheetTab() {
    const bs = pharmacyDB.getBalanceSheet();

    return `
      <div class="app-card" id="printable-statement-area">
        <div style="margin-bottom: 1.5rem; text-align: center;">
          <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a;">Balance Sheet Statement</h2>
          <p style="font-size: 0.82rem; color: #64748b;">Financial Position as of ${new Date().toLocaleDateString()}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <!-- Left Column: Assets -->
          <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; background: #ffffff;">
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 0.5rem; margin-bottom: 1rem;">
              ASSETS
            </div>

            <div style="font-weight: 700; font-size: 0.88rem; color: #475569; margin-bottom: 0.5rem; text-transform: uppercase;">Current Assets</div>
            ${bs.currentAssets.map(a => `
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
                <span>${a.name}</span>
                <span style="font-weight: 600;">$${a.amount.toFixed(2)}</span>
              </div>
            `).join('')}
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.88rem; border-top: 1px dashed #cbd5e1; padding-top: 0.4rem; margin-top: 0.4rem; margin-bottom: 1rem;">
              <span>Total Current Assets:</span>
              <span>$${bs.totalCurrentAssets.toFixed(2)}</span>
            </div>

            <div style="font-weight: 700; font-size: 0.88rem; color: #475569; margin-bottom: 0.5rem; text-transform: uppercase;">Fixed & Capital Assets</div>
            ${bs.fixedAssets.map(a => `
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
                <span>${a.name}</span>
                <span style="font-weight: 600;">$${a.amount.toFixed(2)}</span>
              </div>
            `).join('')}
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.88rem; border-top: 1px dashed #cbd5e1; padding-top: 0.4rem; margin-top: 0.4rem; margin-bottom: 1.5rem;">
              <span>Total Fixed Assets:</span>
              <span>$${bs.totalFixedAssets.toFixed(2)}</span>
            </div>

            <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 1.15rem; border-top: 2px solid #0f172a; border-bottom: 3px double #0f172a; padding: 0.6rem 0; color: #0284c7;">
              <span>TOTAL ASSETS:</span>
              <span>$${bs.totalAssets.toFixed(2)}</span>
            </div>
          </div>

          <!-- Right Column: Liabilities & Equity -->
          <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; background: #ffffff;">
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 0.5rem; margin-bottom: 1rem;">
              LIABILITIES & EQUITY
            </div>

            <div style="font-weight: 700; font-size: 0.88rem; color: #475569; margin-bottom: 0.5rem; text-transform: uppercase;">Current Liabilities</div>
            ${bs.currentLiabilities.map(l => `
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
                <span>${l.name}</span>
                <span style="font-weight: 600;">$${l.amount.toFixed(2)}</span>
              </div>
            `).join('')}
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.88rem; border-top: 1px dashed #cbd5e1; padding-top: 0.4rem; margin-top: 0.4rem; margin-bottom: 1rem;">
              <span>Total Liabilities:</span>
              <span>$${bs.totalLiabilities.toFixed(2)}</span>
            </div>

            <div style="font-weight: 700; font-size: 0.88rem; color: #475569; margin-bottom: 0.5rem; text-transform: uppercase;">Owner's Equity</div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
              <span>Owner's Capital</span>
              <span style="font-weight: 600;">$${bs.equity.baseEquity.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
              <span>Retained Earnings</span>
              <span style="font-weight: 600;">$${bs.equity.retainedEarnings.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
              <span>Current Period Net Income</span>
              <span style="font-weight: 600; color: #059669;">$${bs.equity.currentPeriodNetIncome.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.88rem; border-top: 1px dashed #cbd5e1; padding-top: 0.4rem; margin-top: 0.4rem; margin-bottom: 1.5rem;">
              <span>Total Equity:</span>
              <span>$${bs.equity.totalEquity.toFixed(2)}</span>
            </div>

            <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 1.15rem; border-top: 2px solid #0f172a; border-bottom: 3px double #0f172a; padding: 0.6rem 0; color: #0f172a;">
              <span>TOTAL LIAB. & EQUITY:</span>
              <span>$${bs.totalLiabilitiesAndEquity.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * 9. TAX & GST RETURN
   * ------------------------------------------------------------- */
  renderTaxTab() {
    let totalTaxCollected = 0;
    pharmacyDB.data.sales.forEach(s => totalTaxCollected += s.taxAmount);
    let netTaxPayable = pharmacyDB.getAccountBalance('2020');

    return `
      <div class="app-card">
        <div style="margin-bottom: 1.25rem;">
          <h2 style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">Sales Tax & GST Return Summary</h2>
          <p style="font-size: 0.8rem; color: #64748b;">Tax collected on pharmaceutical dispensing and input tax offset.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 1.25rem;">
            <div style="font-size: 0.78rem; color: #166534; font-weight: 600; text-transform: uppercase;">Tax Collected on Sales</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #15803d; margin-top: 4px;">$${totalTaxCollected.toFixed(2)}</div>
            <div style="font-size: 0.72rem; color: #166534;">From ${pharmacyDB.data.sales.length} customer invoices</div>
          </div>

          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 1.25rem;">
            <div style="font-size: 0.78rem; color: #1e40af; font-weight: 600; text-transform: uppercase;">GSTIN / Tax ID Registered</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #1e3a8a; margin-top: 6px;">${pharmacyDB.data.settings.gstNumber}</div>
            <div style="font-size: 0.72rem; color: #1e40af;">Pharmacy Drug License: ${pharmacyDB.data.settings.licenseNo}</div>
          </div>

          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 1.25rem;">
            <div style="font-size: 0.78rem; color: #92400e; font-weight: 600; text-transform: uppercase;">Net Tax Payable to Govt</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #b45309; margin-top: 4px;">$${netTaxPayable.toFixed(2)}</div>
            <div style="font-size: 0.72rem; color: #92400e;">Account #2020 (Current Liability)</div>
          </div>
        </div>

        <h3 style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 0.75rem;">Recent Taxable POS Invoices</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Patient</th>
                <th class="text-right">Subtotal ($)</th>
                <th class="text-right">Tax Charged ($)</th>
                <th class="text-right">Total ($)</th>
              </tr>
            </thead>
            <tbody>
              ${pharmacyDB.data.sales.map(s => `
                <tr>
                  <td style="font-weight: 700; color: #0284c7;">${s.invoiceNo}</td>
                  <td>${s.date}</td>
                  <td>${s.customerName}</td>
                  <td class="text-right">$${s.subtotal.toFixed(2)}</td>
                  <td class="text-right" style="font-weight: 600; color: #059669;">$${s.taxAmount.toFixed(2)}</td>
                  <td class="text-right" style="font-weight: 700;">$${s.grandTotal.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /* -------------------------------------------------------------
   * EVENT BINDINGS FOR ALL ACCOUNTING TABS
   * ------------------------------------------------------------- */
  bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.acc-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        if (this.activeTab === 'daily-records') {
          App.currentView = 'daily-records';
        } else if (this.activeTab === 'expenses') {
          App.currentView = 'expenses';
        } else {
          App.currentView = 'accounting';
        }
        document.querySelectorAll('.nav-item').forEach(item => {
          if (item.getAttribute('data-view') === App.currentView) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
        const titleMap = {
          'daily-records': 'Daily Records & Register Drawer Reconciliation',
          'expenses': 'Operating Expense Management & Audit',
          'accounting': 'Double-Entry Accounting & Financial Statements'
        };
        const titleEl = document.getElementById('page-title-text');
        if (titleEl && titleMap[App.currentView]) titleEl.textContent = titleMap[App.currentView];

        this.render();
      });
    });

    // 1. Daily Records Events
    const dailyDateInput = document.getElementById('input-daily-records-date');
    if (dailyDateInput) {
      dailyDateInput.addEventListener('change', (e) => {
        this.selectedDailyDate = e.target.value;
        this.render();
      });
    }

    const prevDateBtn = document.getElementById('btn-daily-prev-date');
    if (prevDateBtn) {
      prevDateBtn.addEventListener('click', () => {
        const curr = new Date(this.selectedDailyDate + 'T00:00:00');
        curr.setDate(curr.getDate() - 1);
        this.selectedDailyDate = curr.toISOString().split('T')[0];
        this.render();
      });
    }

    const nextDateBtn = document.getElementById('btn-daily-next-date');
    if (nextDateBtn) {
      nextDateBtn.addEventListener('click', () => {
        const curr = new Date(this.selectedDailyDate + 'T00:00:00');
        curr.setDate(curr.getDate() + 1);
        this.selectedDailyDate = curr.toISOString().split('T')[0];
        this.render();
      });
    }

    const todayDateBtn = document.getElementById('btn-daily-today');
    if (todayDateBtn) {
      todayDateBtn.addEventListener('click', () => {
        this.selectedDailyDate = new Date().toISOString().split('T')[0];
        this.render();
      });
    }

    // Daily Transaction Filter
    document.querySelectorAll('.daily-tx-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.dailyTransactionFilter = btn.getAttribute('data-type');
        this.render();
      });
    });

    // Adjust / Override Opening Balance
    const overrideBtn = document.getElementById('btn-override-opening');
    if (overrideBtn) {
      overrideBtn.addEventListener('click', () => {
        const targetDate = this.selectedDailyDate || new Date().toISOString().split('T')[0];
        const rec = pharmacyDB.getDailyDrawerRecord(targetDate);
        this.showOverrideOpeningModal(targetDate, rec.openingBalance);
      });
    }

    // Close Register Shift
    const closeShiftBtn = document.getElementById('btn-open-close-shift');
    if (closeShiftBtn) {
      closeShiftBtn.addEventListener('click', () => {
        const targetDate = this.selectedDailyDate || new Date().toISOString().split('T')[0];
        const rec = pharmacyDB.getDailyDrawerRecord(targetDate);
        this.showCloseShiftModal(rec, targetDate);
      });
    }

    // 2. Expenses Events
    const addExpenseBtn = document.getElementById('btn-add-expense');
    if (addExpenseBtn) {
      addExpenseBtn.addEventListener('click', () => this.showExpenseModal(null));
    }

    const expenseCatSelect = document.getElementById('expense-category-filter');
    if (expenseCatSelect) {
      expenseCatSelect.addEventListener('change', (e) => {
        this.expenseCategoryFilter = e.target.value;
        this.render();
      });
    }

    const expenseSearchInput = document.getElementById('expense-search-input');
    if (expenseSearchInput) {
      expenseSearchInput.addEventListener('input', (e) => {
        this.expenseSearchQuery = e.target.value;
        this.render();
      });
    }

    document.querySelectorAll('.btn-edit-expense').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-expense-id');
        const exp = (pharmacyDB.data.expenses || []).find(e => e.id === id);
        if (exp) this.showExpenseModal(exp);
      });
    });

    document.querySelectorAll('.btn-delete-expense').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-expense-id');
        if (confirm('Are you sure you want to delete this operating expense? Its journal entry will also be removed.')) {
          pharmacyDB.deleteExpense(id);
          App.showToast('Operating expense deleted', 'info');
          this.render();
        }
      });
    });

    // 3. Journal Filters
    const typeSelect = document.getElementById('journal-filter-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.journalFilterType = e.target.value;
        this.render();
      });
    }

    const searchInput = document.getElementById('journal-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.journalSearchQuery = e.target.value;
        this.render();
      });
    }

    // 4. Ledger Account Selector
    const ledgerSelect = document.getElementById('ledger-account-select');
    if (ledgerSelect) {
      ledgerSelect.addEventListener('change', (e) => {
        this.selectedLedgerAccountId = e.target.value;
        this.render();
      });
    }

    // View Ledger from COA
    document.querySelectorAll('.view-ledger-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedLedgerAccountId = btn.getAttribute('data-acc-id');
        this.activeTab = 'ledger';
        this.render();
      });
    });

    // New Journal Entry Trigger
    const newEntryBtn = document.getElementById('btn-new-journal-entry');
    if (newEntryBtn) {
      newEntryBtn.addEventListener('click', () => {
        this.showNewJournalEntryModal();
      });
    }
  },

  /* -------------------------------------------------------------
   * MODAL: Lock & Finalize Shift Closing
   * ------------------------------------------------------------- */
  showCloseShiftModal(rec, targetDate) {
    const activeUser = Auth && Auth.currentUser ? Auth.currentUser.name : 'Dispensary Staff';
    const fmt = (v) => (parseFloat(v) || 0).toFixed(2);
    const expectedCash = parseFloat(rec.closingDrawerBalance !== undefined ? rec.closingDrawerBalance : rec.finalClosingBalance) || 0;
    const openingBal = parseFloat(rec.openingBalance) || 0;
    const netCash = parseFloat(rec.netDrawerCash !== undefined ? rec.netDrawerCash : rec.netCashCollection) || 0;

    const modalHtml = `
      <div class="modal-overlay" id="close-shift-modal" style="z-index: 10006;">
        <div class="modal-card" style="max-width: 540px;">
          <div class="modal-header">
            <h3>🔒 Lock & Close Daily Register Shift</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('close-shift-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" style="padding: 1.25rem;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem; font-size: 0.88rem;">
                <span>Shift Date:</span>
                <strong>${targetDate}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem; font-size: 0.88rem;">
                <span>Opening Balance:</span>
                <span>$${fmt(openingBal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem; font-size: 0.88rem;">
                <span>Daily Drawer Net Cash:</span>
                <span style="color: #059669;">+$${fmt(netCash)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 0.5rem; margin-top: 0.5rem; font-weight: 800; font-size: 1.05rem;">
                <span>Calculated System Closing Balance:</span>
                <span style="color: #0284c7;">$${fmt(expectedCash)}</span>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-weight: 700;">Physical Cash Count in Drawer ($) *</label>
              <input type="number" step="0.01" id="shift-physical-count" class="form-control" style="font-size: 1.2rem; font-weight: 800; color: #0f172a;" value="${fmt(expectedCash)}" required>
              <div id="shift-discrepancy-label" style="font-size: 0.8rem; margin-top: 4px; font-weight: 600; color: #059669;">
                ✓ Perfect Match with System Count
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label">Shift Closing Notes / Handover Remarks</label>
              <textarea id="shift-closing-notes" class="form-control" rows="2" placeholder="e.g. Verified by night pharmacist. All change denominations replenished."></textarea>
            </div>

            <div style="font-size: 0.78rem; color: #64748b; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.6rem;">
              ⚠️ <strong>Rule:</strong> Locking this shift sets the final drawer collection ($<span id="shift-closing-preview">${fmt(expectedCash)}</span>) as the permanent Opening Balance of the next day (${(() => {
                const n = new Date(targetDate + 'T00:00:00');
                n.setDate(n.getDate() + 1);
                return n.toISOString().split('T')[0];
              })()}).
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('close-shift-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-confirm-shift-close">
              🔒 Confirm & Lock Register Shift
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const countInput = document.getElementById('shift-physical-count');
    const discLabel = document.getElementById('shift-discrepancy-label');
    const previewSpan = document.getElementById('shift-closing-preview');

    countInput.addEventListener('input', () => {
      const physical = parseFloat(countInput.value) || 0;
      previewSpan.textContent = physical.toFixed(2);
      const diff = physical - expectedCash;
      if (Math.abs(diff) < 0.01) {
        discLabel.innerHTML = `<span style="color: #059669;">✓ Perfect Match with System Count</span>`;
      } else if (diff > 0) {
        discLabel.innerHTML = `<span style="color: #3b82f6;">⚠️ Cash Over: +$${diff.toFixed(2)}</span>`;
      } else {
        discLabel.innerHTML = `<span style="color: #dc2626;">⚠️ Cash Shortage: -$${Math.abs(diff).toFixed(2)}</span>`;
      }
    });

    document.getElementById('btn-confirm-shift-close').addEventListener('click', () => {
      const physicalCount = parseFloat(countInput.value) || 0;
      const notes = document.getElementById('shift-closing-notes').value.trim();

      pharmacyDB.closeDailyDrawerShift(targetDate, physicalCount, notes, activeUser);
      document.getElementById('close-shift-modal').remove();
      App.showToast(`Register shift for ${targetDate} closed successfully! Next day opening balance set.`, 'success');
      this.render();
    });
  },

  /* -------------------------------------------------------------
   * MODAL: Override Daily Opening Balance
   * ------------------------------------------------------------- */
  showOverrideOpeningModal(targetDate, currentBal) {
    const modalHtml = `
      <div class="modal-overlay" id="override-opening-modal" style="z-index: 10006;">
        <div class="modal-card" style="max-width: 460px;">
          <div class="modal-header">
            <h3>⚙️ Adjust Opening Drawer Balance</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('override-opening-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" style="padding: 1.25rem;">
            <p style="font-size: 0.84rem; color: #475569; margin-bottom: 1rem;">
              Set a manual opening balance for <strong>${targetDate}</strong> (e.g., if extra float was injected or prior period audit adjusted).
            </p>
            <div class="form-group">
              <label class="form-label">New Opening Balance Amount ($) *</label>
              <input type="number" step="0.01" id="override-opening-amt" class="form-control" style="font-size: 1.2rem; font-weight: 800;" value="${(parseFloat(currentBal) || 0).toFixed(2)}" required>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('override-opening-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-override-opening">Save Opening Balance</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-save-override-opening').addEventListener('click', () => {
      const amt = parseFloat(document.getElementById('override-opening-amt').value) || 0;
      pharmacyDB.overrideDailyOpeningBalance(targetDate, amt);
      document.getElementById('override-opening-modal').remove();
      App.showToast(`Opening balance for ${targetDate} updated to $${amt.toFixed(2)}`, 'success');
      this.render();
    });
  },

  /* -------------------------------------------------------------
   * MODAL: Add / Edit Operating Expense Form
   * ------------------------------------------------------------- */
  showExpenseModal(existing = null) {
    const isEdit = !!existing;
    const now = new Date();
    const defaultDate = now.toISOString().split('T')[0];
    const defaultVoucher = 'EXP-' + Date.now().toString().slice(-5);

    const liveExpCats = (pharmacyDB.getExpenseCategories ? pharmacyDB.getExpenseCategories() : []).map(c => typeof c === 'string' ? c : c.name);
    const categories = liveExpCats.length ? liveExpCats : ['Utilities', 'Dispensary Supplies', 'Rent & Premises', 'Staff Welfare', 'Maintenance', 'Marketing', 'License & Regulatory', 'Logistics & Courier', 'Other Expenses'];

    const modalHtml = `
      <div class="modal-overlay" id="expense-form-modal" style="z-index: 10006;">
        <div class="modal-card" style="max-width: 600px;">
          <div class="modal-header">
            <h3>${isEdit ? '✏️ Edit Operating Expense' : '💸 Record New Dispensary Expense'}</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('expense-form-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" style="padding: 1.25rem;">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Expense Date *</label>
                <input type="date" id="exp-form-date" class="form-control" value="${isEdit ? existing.date : defaultDate}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Voucher / Bill # *</label>
                <input type="text" id="exp-form-voucher" class="form-control" value="${isEdit ? existing.voucherNo : defaultVoucher}" required>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Expense Category *</label>
                <select id="exp-form-category" class="form-control">
                  ${categories.map(c => `
                    <option value="${c}" ${isEdit && existing.category === c ? 'selected' : ''}>${c}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Payee / Vendor Name *</label>
                <input type="text" id="exp-form-payee" class="form-control" value="${isEdit ? existing.payee : ''}" placeholder="e.g. City Power Corp or Packaging Co." required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Description / Particulars *</label>
              <input type="text" id="exp-form-desc" class="form-control" value="${isEdit ? existing.description : ''}" placeholder="e.g. Electricity bill for pharmacy cold-chain refrigerator" required>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Amount ($) *</label>
                <input type="number" step="0.01" id="exp-form-amount" class="form-control" style="font-size: 1.15rem; font-weight: 800; color: #dc2626;" value="${isEdit ? existing.amount : ''}" placeholder="0.00" required>
              </div>
              <div class="form-group">
                <label class="form-label">Payment Method *</label>
                <select id="exp-form-payment-mode" class="form-control">
                  <option value="Cash" ${!isEdit || existing.isCashFromDrawer ? 'selected' : ''}>Cash in Hand (Paid from Register Drawer)</option>
                  <option value="Bank" ${isEdit && !existing.isCashFromDrawer ? 'selected' : ''}>Online Transfer / Bank Wire / QR</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Internal Audit Notes</label>
              <input type="text" id="exp-form-notes" class="form-control" value="${isEdit ? (existing.notes || '') : ''}" placeholder="Receipt attached, authorized by manager, etc.">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('expense-form-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-expense-submit">
              ${isEdit ? 'Save Changes' : 'Record Expense'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-save-expense-submit').addEventListener('click', () => {
      const date = document.getElementById('exp-form-date').value || defaultDate;
      const voucherNo = document.getElementById('exp-form-voucher').value.trim() || defaultVoucher;
      const category = document.getElementById('exp-form-category').value;
      const payee = document.getElementById('exp-form-payee').value.trim();
      const description = document.getElementById('exp-form-desc').value.trim();
      const amount = parseFloat(document.getElementById('exp-form-amount').value) || 0;
      const paymentMode = document.getElementById('exp-form-payment-mode').value;
      const isCashFromDrawer = paymentMode === 'Cash';
      const notes = document.getElementById('exp-form-notes').value.trim();

      if (!description || !payee || amount <= 0) {
        alert('Please enter a valid description, payee, and amount greater than 0.');
        return;
      }

      const activeUser = Auth && Auth.currentUser ? Auth.currentUser.name : 'Dispensary Staff';

      const expData = {
        id: isEdit ? existing.id : ('exp_' + Date.now().toString().slice(-6)),
        date,
        voucherNo,
        category,
        description,
        payee,
        amount,
        paymentMethod: isCashFromDrawer ? 'Cash in Hand (Drawer)' : 'Online / Bank Transfer',
        isCashFromDrawer,
        recordedBy: isEdit ? existing.recordedBy : activeUser,
        notes
      };

      if (isEdit) {
        pharmacyDB.updateExpense(expData);
        App.showToast(`Expense ${voucherNo} updated!`, 'success');
      } else {
        pharmacyDB.addExpense(expData);
        App.showToast(`Operating expense ${voucherNo} recorded!`, 'success');
      }

      document.getElementById('expense-form-modal').remove();
      this.render();
    });
  },

  /* -------------------------------------------------------------
   * MODAL: Create Manual Journal Voucher
   * ------------------------------------------------------------- */
  showNewJournalEntryModal() {
    const modalHtml = `
      <div class="modal-overlay" id="new-journal-modal">
        <div class="modal-card" style="max-width: 720px;">
          <div class="modal-header">
            <h3>Create Manual Journal Voucher</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('new-journal-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body">
            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label">Voucher Date:</label>
                <input type="date" id="jv-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group">
                <label class="form-label">Voucher Type:</label>
                <select id="jv-type" class="form-control">
                  <option value="Journal Voucher">Journal Voucher</option>
                  <option value="Payment Voucher">Payment Voucher</option>
                  <option value="Receipt Voucher">Receipt Voucher</option>
                  <option value="Contra Voucher">Contra Voucher (Bank/Cash)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Reference #:</label>
                <input type="text" id="jv-ref" class="form-control" value="JV-${Date.now().toString().slice(-5)}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Narration / Clinical Reason:</label>
              <input type="text" id="jv-narration" class="form-control" placeholder="E.g., Monthly electricity bill payment or Bank cash withdrawal">
            </div>

            <!-- Dynamic Debit / Credit Lines -->
            <label class="form-label">Double-Entry Particulars (Debits & Credits must balance):</label>
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 0.75rem;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;" id="jv-lines-table">
                <thead style="background: #f1f5f9;">
                  <tr>
                    <th style="padding: 0.5rem; text-align: left;">Account</th>
                    <th style="padding: 0.5rem; text-align: right; width: 130px;">Debit ($)</th>
                    <th style="padding: 0.5rem; text-align: right; width: 130px;">Credit ($)</th>
                    <th style="padding: 0.5rem; text-align: center; width: 40px;"></th>
                  </tr>
                </thead>
                <tbody id="jv-lines-body">
                  <tr class="jv-row">
                    <td style="padding: 0.4rem;">
                      <select class="form-control jv-acc-select" style="font-size: 0.82rem;">
                        ${pharmacyDB.data.accounts.map(a => `<option value="${a.id}">#${a.code} - ${a.name}</option>`).join('')}
                      </select>
                    </td>
                    <td style="padding: 0.4rem;">
                      <input type="number" step="0.01" class="form-control jv-debit-input" style="text-align: right;" value="0.00">
                    </td>
                    <td style="padding: 0.4rem;">
                      <input type="number" step="0.01" class="form-control jv-credit-input" style="text-align: right;" value="0.00">
                    </td>
                    <td style="padding: 0.4rem; text-align: center;">
                      <button type="button" class="btn-remove-jv-row" style="background:none; border:none; color:#ef4444; cursor:pointer;">${getIcon('close')}</button>
                    </td>
                  </tr>
                  <tr class="jv-row">
                    <td style="padding: 0.4rem;">
                      <select class="form-control jv-acc-select" style="font-size: 0.82rem;">
                        ${pharmacyDB.data.accounts.map(a => `<option value="${a.id}" ${a.id==='1010'?'selected':''}>#${a.code} - ${a.name}</option>`).join('')}
                      </select>
                    </td>
                    <td style="padding: 0.4rem;">
                      <input type="number" step="0.01" class="form-control jv-debit-input" style="text-align: right;" value="0.00">
                    </td>
                    <td style="padding: 0.4rem;">
                      <input type="number" step="0.01" class="form-control jv-credit-input" style="text-align: right;" value="0.00">
                    </td>
                    <td style="padding: 0.4rem; text-align: center;">
                      <button type="button" class="btn-remove-jv-row" style="background:none; border:none; color:#ef4444; cursor:pointer;">${getIcon('close')}</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <button type="button" class="btn btn-outline btn-sm" id="btn-add-jv-line">
                ${getIcon('plus')} Add Line
              </button>
              <div style="display: flex; gap: 1rem; align-items: center;">
                <span id="jv-balance-status" style="font-weight: 700; font-size: 0.85rem; color: #dc2626;">
                  ⚠️ Enter amounts to balance
                </span>
              </div>
              <div style="display: flex; gap: 1.5rem; font-weight: 700; font-size: 0.95rem;">
                <span>Total Dr: <span id="jv-sum-debit" style="color: #0284c7;">$0.00</span></span>
                <span>Total Cr: <span id="jv-sum-credit" style="color: #0284c7;">$0.00</span></span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('new-journal-modal').remove()">Cancel</button>
            <button class="btn btn-success" id="btn-save-journal-entry" disabled>
              ${getIcon('check')} Post Voucher
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const tbody = document.getElementById('jv-lines-body');
    const saveBtn = document.getElementById('btn-save-journal-entry');
    const sumDebitEl = document.getElementById('jv-sum-debit');
    const sumCreditEl = document.getElementById('jv-sum-credit');
    const statusEl = document.getElementById('jv-balance-status');

    const updateTotals = () => {
      let totDr = 0;
      let totCr = 0;
      tbody.querySelectorAll('.jv-row').forEach(row => {
        const dr = parseFloat(row.querySelector('.jv-debit-input').value) || 0;
        const cr = parseFloat(row.querySelector('.jv-credit-input').value) || 0;
        totDr += dr;
        totCr += cr;
      });

      totDr = Math.round(totDr * 100) / 100;
      totCr = Math.round(totCr * 100) / 100;

      sumDebitEl.textContent = '$' + totDr.toFixed(2);
      sumCreditEl.textContent = '$' + totCr.toFixed(2);

      const diff = Math.abs(totDr - totCr);
      if (totDr > 0 && diff < 0.01) {
        statusEl.innerHTML = `<span style="color: #059669;">✓ Perfectly Balanced ($${totDr.toFixed(2)})</span>`;
        saveBtn.disabled = false;
      } else {
        statusEl.innerHTML = `<span style="color: #dc2626;">⚠️ Unbalanced (Diff: $${diff.toFixed(2)})</span>`;
        saveBtn.disabled = true;
      }
    };

    const attachRowEvents = (row) => {
      row.querySelectorAll('.jv-debit-input, .jv-credit-input').forEach(input => {
        input.addEventListener('input', updateTotals);
      });
      const delBtn = row.querySelector('.btn-remove-jv-row');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          if (tbody.querySelectorAll('.jv-row').length > 2) {
            row.remove();
            updateTotals();
          } else {
            App.showToast('A double-entry voucher requires at least two lines', 'warning');
          }
        });
      }
    };

    tbody.querySelectorAll('.jv-row').forEach(attachRowEvents);

    // Add row button
    document.getElementById('btn-add-jv-line').addEventListener('click', () => {
      const newRowHtml = `
        <tr class="jv-row">
          <td style="padding: 0.4rem;">
            <select class="form-control jv-acc-select" style="font-size: 0.82rem;">
              ${pharmacyDB.data.accounts.map(a => `<option value="${a.id}">#${a.code} - ${a.name}</option>`).join('')}
            </select>
          </td>
          <td style="padding: 0.4rem;">
            <input type="number" step="0.01" class="form-control jv-debit-input" style="text-align: right;" value="0.00">
          </td>
          <td style="padding: 0.4rem;">
            <input type="number" step="0.01" class="form-control jv-credit-input" style="text-align: right;" value="0.00">
          </td>
          <td style="padding: 0.4rem; text-align: center;">
            <button type="button" class="btn-remove-jv-row" style="background:none; border:none; color:#ef4444; cursor:pointer;">${getIcon('close')}</button>
          </td>
        </tr>
      `;
      tbody.insertAdjacentHTML('beforeend', newRowHtml);
      attachRowEvents(tbody.lastElementChild);
    });

    // Save button
    saveBtn.addEventListener('click', () => {
      const date = document.getElementById('jv-date').value;
      const voucherType = document.getElementById('jv-type').value;
      const reference = document.getElementById('jv-ref').value;
      const narration = document.getElementById('jv-narration').value;

      const entries = [];
      tbody.querySelectorAll('.jv-row').forEach(row => {
        const accountId = row.querySelector('.jv-acc-select').value;
        const debit = parseFloat(row.querySelector('.jv-debit-input').value) || 0;
        const credit = parseFloat(row.querySelector('.jv-credit-input').value) || 0;
        if (debit > 0 || credit > 0) {
          entries.push({ accountId, debit, credit });
        }
      });

      try {
        pharmacyDB.addJournalEntry({
          date,
          voucherType,
          reference,
          narration,
          entries
        });

        document.getElementById('new-journal-modal').remove();
        App.showToast(`Journal Voucher ${reference} posted successfully!`, 'success');
        this.render();
      } catch (err) {
        alert('Error posting voucher: ' + err.message);
      }
    });
  }
};
