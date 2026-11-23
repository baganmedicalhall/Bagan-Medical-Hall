/**
 * Medication & Clinical Treatment Operations Module
 * Manages in-clinic medication administration, nursing procedures, clinical vitals, and fees.
 */

const Treatment = {
  activeStatusFilter: 'ALL',
  searchQuery: '',

  render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    const allTreatments = pharmacyDB.data.treatments || [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Compute stats
    const todayTreatments = allTreatments.filter(t => t.date === todayStr);
    const inProgressCount = allTreatments.filter(t => t.status === 'In-Progress').length;
    const completedCount = allTreatments.filter(t => t.status === 'Administered').length;
    const totalRevenue = allTreatments
      .filter(t => t.status === 'Administered' || t.status === 'In-Progress')
      .reduce((sum, t) => sum + (parseFloat(t.chargeAmount) || 0), 0);

    // Filter treatments
    let filtered = [...allTreatments].reverse();
    if (this.activeStatusFilter !== 'ALL') {
      filtered = filtered.filter(t => t.status === this.activeStatusFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        (t.patientName && t.patientName.toLowerCase().includes(q)) ||
        (t.patientPhone && t.patientPhone.toLowerCase().includes(q)) ||
        (t.treatmentType && t.treatmentType.toLowerCase().includes(q)) ||
        (t.doctorName && t.doctorName.toLowerCase().includes(q)) ||
        (t.medicationUsed && t.medicationUsed.toLowerCase().includes(q))
      );
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Top Stats Row -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem;">
          <div class="stat-card" style="border-left: 4px solid var(--primary);">
            <div class="stat-icon" style="background: var(--primary-light); color: var(--primary);">💊</div>
            <div>
              <div class="stat-label">Today's Procedures</div>
              <div class="stat-value">${todayTreatments.length}</div>
              <div style="font-size: 0.72rem; color: #64748b;">Scheduled & administered today</div>
            </div>
          </div>

          <div class="stat-card" style="border-left: 4px solid #f59e0b;">
            <div class="stat-icon" style="background: #fef3c7; color: #d97706;">⏳</div>
            <div>
              <div class="stat-label">In-Progress</div>
              <div class="stat-value">${inProgressCount}</div>
              <div style="font-size: 0.72rem; color: #64748b;">Currently being monitored</div>
            </div>
          </div>

          <div class="stat-card" style="border-left: 4px solid #10b981;">
            <div class="stat-icon" style="background: #d1fae5; color: #059669;">✓</div>
            <div>
              <div class="stat-label">Completed / Administered</div>
              <div class="stat-value">${completedCount}</div>
              <div style="font-size: 0.72rem; color: #64748b;">Total successful procedures</div>
            </div>
          </div>

          <div class="stat-card" style="border-left: 4px solid #8b5cf6;">
            <div class="stat-icon" style="background: #ede9fe; color: #7c3aed;">💵</div>
            <div>
              <div class="stat-label">Clinical Procedures Revenue</div>
              <div class="stat-value" style="color: #059669;">$${totalRevenue.toFixed(2)}</div>
              <div style="font-size: 0.72rem; color: #64748b;">Total treatment charges</div>
            </div>
          </div>
        </div>

        <!-- Management Card -->
        <div class="app-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <h2 style="font-size: 1.2rem; font-weight: 700; color: #0f172a;">Medication Dispensing & Clinical Treatments</h2>
              <p style="font-size: 0.8rem; color: #64748b;">Track outpatient clinical nursing, injection administration, nebulization therapy, dressings, and fee billing.</p>
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <button class="btn btn-primary" id="btn-add-treatment">
                <span>➕</span> Log New Treatment / Medication
              </button>
            </div>
          </div>

          <!-- Filter Toolbar -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 0.82rem; font-weight: 600; color: #475569;">Filter Status:</span>
              <button class="btn btn-sm ${this.activeStatusFilter === 'ALL' ? 'btn-primary' : 'btn-outline'} t-filter-btn" data-status="ALL">All (${allTreatments.length})</button>
              ${(pharmacyDB.getStatuses ? pharmacyDB.getStatuses('treatment') : [
                { name: 'Administered' }, { name: 'In-Progress' }, { name: 'Scheduled' }
              ]).map(st => `
                <button class="btn btn-sm ${this.activeStatusFilter === st.name ? 'btn-primary' : 'btn-outline'} t-filter-btn" data-status="${st.name}">
                  ${st.name} (${allTreatments.filter(t => t.status === st.name).length})
                </button>
              `).join('')}
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="text" id="treatment-search-input" placeholder="Search patient, doctor, procedure..." class="form-control" style="width: 260px; font-size: 0.82rem;" value="${this.searchQuery}">
            </div>
          </div>

          <!-- Treatments Table -->
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Patient Details</th>
                  <th>Doctor / Prescriber</th>
                  <th>Procedure / Treatment</th>
                  <th>Medication & Dosage / Route</th>
                  <th>Vitals Recorded</th>
                  <th class="text-right">Charge ($)</th>
                  <th class="text-center">Status</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="9" class="text-center" style="padding: 2.5rem; color: #94a3b8;">
                      No clinical medication or treatment records found matching criteria.
                    </td>
                  </tr>
                ` : filtered.map(t => {
                  const statusColors = {
                    'Administered': { bg: '#d1fae5', text: '#059669', border: '#10b981' },
                    'In-Progress': { bg: '#fef3c7', text: '#b45309', border: '#f59e0b' },
                    'Scheduled': { bg: '#e0f2fe', text: '#0369a1', border: '#0284c7' }
                  }[t.status] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };

                  return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="white-space: nowrap; font-size: 0.8rem;">
                        <div style="font-weight: 700; color: #0f172a;">${t.date}</div>
                        <div style="color: #64748b; font-size: 0.74rem;">${t.time || ''}</div>
                      </td>
                      <td>
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.88rem;">${t.patientName}</div>
                        <div style="font-size: 0.74rem; color: #64748b;">
                          ${t.patientAgeGender ? t.patientAgeGender + ' • ' : ''}${t.patientPhone || 'No phone'}
                        </div>
                      </td>
                      <td style="font-size: 0.82rem;">
                        <div style="font-weight: 600; color: #334155;">${t.doctorName || 'Attending Staff'}</div>
                        <div style="font-size: 0.72rem; color: #94a3b8;">Staff: ${t.administeredBy || 'Dispensary Staff'}</div>
                      </td>
                      <td style="font-size: 0.84rem;">
                        <div style="font-weight: 700; color: #0284c7;">${t.treatmentType}</div>
                        ${t.notes ? `<div style="font-size: 0.74rem; color: #475569; max-width: 200px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${t.notes}">${t.notes}</div>` : ''}
                      </td>
                      <td style="font-size: 0.82rem;">
                        <div style="font-weight: 600; color: #0f172a;">${t.medicationUsed || 'N/A'}</div>
                        <div style="font-size: 0.74rem; color: #64748b;">
                          ${t.dosage ? `Dose: ${t.dosage}` : ''} ${t.route ? `(${t.route})` : ''}
                        </div>
                      </td>
                      <td style="font-size: 0.76rem; color: #334155; line-height: 1.4;">
                        ${t.vitals ? `
                          <div><strong>BP:</strong> ${t.vitals.bp || '-'}</div>
                          <div><strong>Pulse:</strong> ${t.vitals.pulse || '-'} | <strong>SpO2:</strong> ${t.vitals.spo2 || '-'}</div>
                        ` : '<span style="color:#94a3b8;">None</span>'}
                      </td>
                      <td class="text-right" style="font-weight: 700; font-size: 0.92rem; color: #0f172a;">
                        $${parseFloat(t.chargeAmount || 0).toFixed(2)}
                        <div style="font-size: 0.7rem; color: #10b981; font-weight: 600;">${t.paymentMethod || 'Cash'}</div>
                      </td>
                      <td class="text-center">
                        <span style="font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 9999px; background: ${statusColors.bg}; color: ${statusColors.text}; border: 1px solid ${statusColors.border};">
                          ${t.status}
                        </span>
                      </td>
                      <td class="text-center" style="white-space: nowrap;">
                        <div style="display: inline-flex; gap: 4px;">
                          ${t.status !== 'Administered' ? `
                            <button class="btn btn-sm btn-success btn-mark-administered" data-t-id="${t.id}" title="Mark Administered" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                              ✓ Administer
                            </button>
                          ` : ''}
                          <button class="btn btn-sm btn-outline btn-print-t-slip" data-t-id="${t.id}" title="Print Clinical Treatment Slip" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                            🖨️
                          </button>
                          <button class="btn btn-sm btn-outline btn-edit-treatment" data-t-id="${t.id}" title="Edit Treatment" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                            ✏️
                          </button>
                          <button class="btn btn-sm btn-outline btn-delete-treatment" data-t-id="${t.id}" title="Delete Record" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: #ef4444;">
                            🗑️
                          </button>
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
    // Add Treatment
    const addBtn = document.getElementById('btn-add-treatment');
    if (addBtn) addBtn.addEventListener('click', () => this.showTreatmentModal(null));

    // Filter Buttons
    document.querySelectorAll('.t-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeStatusFilter = btn.getAttribute('data-status');
        this.render();
      });
    });

    // Search Input
    const searchInput = document.getElementById('treatment-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
      });
    }

    // Mark Administered
    document.querySelectorAll('.btn-mark-administered').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-t-id');
        const t = (pharmacyDB.data.treatments || []).find(item => item.id === id);
        if (t) {
          pharmacyDB.updateTreatment({ ...t, status: 'Administered' });
          App.showToast(`Treatment for ${t.patientName} marked as Administered!`, 'success');
          this.render();
        }
      });
    });

    // Edit Treatment
    document.querySelectorAll('.btn-edit-treatment').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-t-id');
        const t = (pharmacyDB.data.treatments || []).find(item => item.id === id);
        if (t) this.showTreatmentModal(t);
      });
    });

    // Delete Treatment
    document.querySelectorAll('.btn-delete-treatment').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-t-id');
        if (confirm('Are you sure you want to delete this medication/treatment record?')) {
          pharmacyDB.deleteTreatment(id);
          App.showToast('Treatment record deleted', 'info');
          this.render();
        }
      });
    });

    // Print Treatment Slip
    document.querySelectorAll('.btn-print-t-slip').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-t-id');
        this.printTreatmentSlip(id);
      });
    });
  },

  showTreatmentModal(existing = null) {
    const isEdit = !!existing;
    const now = new Date();
    const defaultDate = now.toISOString().split('T')[0];
    const defaultTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const vitals = existing?.vitals || { bp: '', pulse: '', temp: '', spo2: '' };

    // Dynamic catalogs from pharmacy database
    const treatmentTypes = pharmacyDB.getTreatmentTypes ? pharmacyDB.getTreatmentTypes() : [];
    const adminRoutes = pharmacyDB.getAdministrationRoutes ? pharmacyDB.getAdministrationRoutes() : [];
    const statusOptions = pharmacyDB.getStatuses ? pharmacyDB.getStatuses('treatment') : [];

    const modalHtml = `
      <div class="modal-overlay" id="treatment-modal" style="z-index: 10005;">
        <div class="modal-card" style="max-width: 650px;">
          <div class="modal-header">
            <h3>${isEdit ? '✏️ Edit Clinical Treatment / Medication' : '💊 Log New Medication & Treatment'}</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('treatment-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" style="padding: 1.25rem;">
            <!-- Patient Info -->
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Patient Full Name *</label>
                <input type="text" id="tm-patient-name" class="form-control" value="${isEdit ? existing.patientName : ''}" placeholder="e.g. John Doe" required>
              </div>
              <div class="form-group">
                <label class="form-label">Age / Gender</label>
                <input type="text" id="tm-patient-age" class="form-control" value="${isEdit ? (existing.patientAgeGender || '') : ''}" placeholder="e.g. 45Y / Male">
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Patient Phone / MRN</label>
                <input type="text" id="tm-patient-phone" class="form-control" value="${isEdit ? (existing.patientPhone || '') : ''}" placeholder="e.g. 555-0182">
              </div>
              <div class="form-group">
                <label class="form-label">Attending Doctor / Prescriber</label>
                <input type="text" id="tm-doctor-name" class="form-control" value="${isEdit ? (existing.doctorName || '') : 'Dr. E. Harrison'}" placeholder="e.g. Dr. Jane Smith">
              </div>
            </div>

            <!-- Clinical Procedure & Medication -->
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Procedure / Treatment Type *</label>
                <select id="tm-treatment-type" class="form-control">
                  ${treatmentTypes.map(tt => `
                    <option value="${tt.name}" data-charge="${tt.defaultCharge || 0}" ${isEdit && existing.treatmentType === tt.name ? 'selected' : (!isEdit && tt.isDefault ? 'selected' : '')}>
                      ${tt.name} ($${(parseFloat(tt.defaultCharge) || 0).toFixed(2)})
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Administration Route</label>
                <select id="tm-route" class="form-control">
                  ${adminRoutes.map(ar => `
                    <option value="${ar.name}" ${isEdit && existing.route === ar.name ? 'selected' : (!isEdit && ar.isDefault ? 'selected' : '')}>
                      ${ar.name} ${ar.code ? `(${ar.code})` : ''}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Medication Used & Strength</label>
                <input type="text" id="tm-medication" class="form-control" value="${isEdit ? (existing.medicationUsed || '') : ''}" placeholder="e.g. Salbutamol 2.5mg Respules">
              </div>
              <div class="form-group">
                <label class="form-label">Dosage Administered</label>
                <input type="text" id="tm-dosage" class="form-control" value="${isEdit ? (existing.dosage || '') : ''}" placeholder="e.g. 1 Respule stat / 14 IU">
              </div>
            </div>

            <!-- Vitals Sub-Card -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem; margin-bottom: 0.75rem;">
              <div style="font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 0.5rem;">🩺 Patient Vitals Recorded:</div>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
                <div>
                  <label class="form-label" style="font-size: 0.72rem;">Blood Pressure</label>
                  <input type="text" id="tm-vital-bp" class="form-control" style="font-size: 0.8rem;" value="${vitals.bp || ''}" placeholder="120/80">
                </div>
                <div>
                  <label class="form-label" style="font-size: 0.72rem;">Pulse (bpm)</label>
                  <input type="text" id="tm-vital-pulse" class="form-control" style="font-size: 0.8rem;" value="${vitals.pulse || ''}" placeholder="78">
                </div>
                <div>
                  <label class="form-label" style="font-size: 0.72rem;">SpO2 (%)</label>
                  <input type="text" id="tm-vital-spo2" class="form-control" style="font-size: 0.8rem;" value="${vitals.spo2 || ''}" placeholder="98%">
                </div>
                <div>
                  <label class="form-label" style="font-size: 0.72rem;">Temp (°F)</label>
                  <input type="text" id="tm-vital-temp" class="form-control" style="font-size: 0.8rem;" value="${vitals.temp || ''}" placeholder="98.6">
                </div>
              </div>
            </div>

            <!-- Date, Status & Charges -->
            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label">Date *</label>
                <input type="date" id="tm-date" class="form-control" value="${isEdit ? existing.date : defaultDate}">
              </div>
              <div class="form-group">
                <label class="form-label">Status *</label>
                <select id="tm-status" class="form-control">
                  ${statusOptions.map(st => `
                    <option value="${st.name}" ${isEdit && existing.status === st.name ? 'selected' : (!isEdit && st.isDefault ? 'selected' : '')}>
                      ${st.label || st.name}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Charge Amount ($) *</label>
                <input type="number" step="0.01" id="tm-charge" class="form-control" style="font-weight: 700; color: #0f172a;" value="${isEdit ? existing.chargeAmount : '15.00'}" required>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Payment Mode</label>
                <select id="tm-payment-mode" class="form-control">
                  <option value="Cash" ${!isEdit || existing.paymentMethod === 'Cash' ? 'selected' : ''}>Cash (Dispensary Drawer)</option>
                  <option value="Online / QR" ${isEdit && existing.paymentMethod === 'Online / QR' ? 'selected' : ''}>Online / QR / Digital</option>
                  <option value="Card" ${isEdit && existing.paymentMethod === 'Card' ? 'selected' : ''}>POS Card Terminal</option>
                  <option value="Due / Credit" ${isEdit && existing.paymentMethod === 'Due / Credit' ? 'selected' : ''}>Patient Credit (Due)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Clinical Observations / Notes</label>
                <input type="text" id="tm-notes" class="form-control" value="${isEdit ? (existing.notes || '') : ''}" placeholder="e.g. Patient tolerated nebulization well, wheeze reduced.">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('treatment-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-treatment-submit">
              ${isEdit ? 'Save Changes' : 'Record Treatment'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Auto-update default charge when procedure type changes
    const typeSelect = document.getElementById('tm-treatment-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        const opt = typeSelect.options[typeSelect.selectedIndex];
        const chg = opt ? opt.getAttribute('data-charge') : null;
        if (chg !== null && chg !== undefined && chg !== '') {
          document.getElementById('tm-charge').value = parseFloat(chg).toFixed(2);
        }
      });
    }

    document.getElementById('btn-save-treatment-submit').addEventListener('click', () => {
      const patientName = document.getElementById('tm-patient-name').value.trim();
      const treatmentType = document.getElementById('tm-treatment-type').value;
      const chargeAmount = parseFloat(document.getElementById('tm-charge').value) || 0;
      const date = document.getElementById('tm-date').value || defaultDate;

      if (!patientName) {
        alert('Please enter patient full name');
        return;
      }

      const activeUser = Auth && Auth.currentUser ? Auth.currentUser.name : 'Dispensary Staff';

      const treatmentData = {
        id: isEdit ? existing.id : ('t_' + Date.now().toString().slice(-6)),
        date,
        time: isEdit ? existing.time : defaultTime,
        patientName,
        patientAgeGender: document.getElementById('tm-patient-age').value.trim(),
        patientPhone: document.getElementById('tm-patient-phone').value.trim(),
        doctorName: document.getElementById('tm-doctor-name').value.trim(),
        treatmentType,
        medicationUsed: document.getElementById('tm-medication').value.trim(),
        dosage: document.getElementById('tm-dosage').value.trim(),
        route: document.getElementById('tm-route').value,
        vitals: {
          bp: document.getElementById('tm-vital-bp').value.trim(),
          pulse: document.getElementById('tm-vital-pulse').value.trim(),
          spo2: document.getElementById('tm-vital-spo2').value.trim(),
          temp: document.getElementById('tm-vital-temp').value.trim()
        },
        chargeAmount,
        paymentMethod: document.getElementById('tm-payment-mode').value,
        status: document.getElementById('tm-status').value,
        administeredBy: isEdit ? existing.administeredBy : activeUser,
        notes: document.getElementById('tm-notes').value.trim()
      };

      if (isEdit) {
        pharmacyDB.updateTreatment(treatmentData);
        App.showToast(`Treatment record for ${patientName} updated!`, 'success');
      } else {
        pharmacyDB.addTreatment(treatmentData);
        App.showToast(`New treatment logged for ${patientName}!`, 'success');
      }

      document.getElementById('treatment-modal').remove();
      this.render();
    });
  },

  printTreatmentSlip(treatmentId) {
    const t = (pharmacyDB.data.treatments || []).find(item => item.id === treatmentId);
    if (!t) return;

    const global = pharmacyDB.data.globalSettings || {};
    const slipHtml = `
      <div class="modal-overlay" id="t-slip-modal" style="z-index: 10006;">
        <div class="modal-card" style="max-width: 480px; background: #fff;">
          <div class="modal-header no-print">
            <h3>Clinical Treatment Voucher / Slip</h3>
            <button class="btn-outline" style="border:none; padding:4px;" onclick="document.getElementById('t-slip-modal').remove()">${getIcon('close')}</button>
          </div>
          <div class="modal-body" id="printable-t-slip" style="padding: 1.5rem; font-family: monospace; font-size: 0.85rem; color: #000;">
            <div style="text-align: center; border-bottom: 1px dashed #666; padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
              <h2 style="font-size: 1.1rem; margin: 0; font-weight: bold;">${global.name || 'Apex Health & Care Pharmacy'}</h2>
              <div style="font-size: 0.75rem;">${global.address || 'Dispensary & Clinical Care'}</div>
              <div style="font-size: 0.75rem;">Tel: ${global.contactPhone || '555-0199'}</div>
              <div style="margin-top: 4px; font-weight: bold; font-size: 0.85rem;">CLINICAL PROCEDURE RECEIPT</div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>Slip #: ${t.id}</span>
              <span>Date: ${t.date} ${t.time || ''}</span>
            </div>
            <div style="margin-bottom: 4px;"><strong>Patient:</strong> ${t.patientName} (${t.patientAgeGender || 'Adult'})</div>
            <div style="margin-bottom: 4px;"><strong>Phone:</strong> ${t.patientPhone || 'N/A'}</div>
            <div style="margin-bottom: 4px;"><strong>Doctor:</strong> ${t.doctorName || 'Attending Staff'}</div>
            <div style="margin-bottom: 4px;"><strong>Administered By:</strong> ${t.administeredBy || 'Staff'}</div>
            
            <div style="border-top: 1px dashed #666; border-bottom: 1px dashed #666; padding: 8px 0; margin: 8px 0;">
              <div><strong>Procedure:</strong> ${t.treatmentType}</div>
              <div><strong>Medication:</strong> ${t.medicationUsed || 'N/A'} (${t.dosage || ''})</div>
              <div><strong>Route:</strong> ${t.route || 'Clinical'}</div>
              ${t.vitals && (t.vitals.bp || t.vitals.pulse) ? `
                <div style="margin-top: 4px; font-size: 0.78rem;">
                  <strong>Vitals:</strong> BP: ${t.vitals.bp || '-'} | Pulse: ${t.vitals.pulse || '-'} bpm | SpO2: ${t.vitals.spo2 || '-'} | Temp: ${t.vitals.temp || '-'}°F
                </div>
              ` : ''}
              ${t.notes ? `<div style="font-size: 0.78rem; font-style: italic; margin-top: 4px;">Note: ${t.notes}</div>` : ''}
            </div>

            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1rem; margin-top: 6px;">
              <span>Total Procedure Charge:</span>
              <span>$${parseFloat(t.chargeAmount || 0).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 2px;">
              <span>Payment Mode:</span>
              <span>${t.paymentMethod || 'Cash'} (PAID)</span>
            </div>

            <div style="text-align: center; margin-top: 1.5rem; font-size: 0.75rem; border-top: 1px dashed #666; padding-top: 8px;">
              Thank you for trusting Apex Rx Dispensary.<br>Please keep this receipt for medical record.
            </div>
          </div>
          <div class="modal-footer no-print">
            <button class="btn btn-secondary" onclick="document.getElementById('t-slip-modal').remove()">Close</button>
            <button class="btn btn-primary" onclick="window.print()">🖨️ Print Slip</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', slipHtml);
  }
};
