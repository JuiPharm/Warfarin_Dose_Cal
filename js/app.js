/**
 * Warfarin Clinic Pro - Application & UI Controller
 * Enhanced with Full 7-Column Medication Calendar & Split-Packet Engine
 */

const appState = {
  indication: 'af',
  targetRange: { min: 2.0, max: 3.0 },
  currentINR: null,
  currentWeeklyDose: null,
  targetWeeklyDose: null,
  availableStrengths: [2, 3, 5],
  allowHalfTabs: true,
  startDayIdx: 0,
  startDate: new Date().toISOString().split('T')[0],
  followUpDate: '',
  daysSupply: 28,
  dispenseMode: 'bulk',
  
  // View State
  scheduleView: 'calendar', // 'calendar' | 'split' | 'weekly'
  
  // Results
  recommendation: null,
  regimenCandidates: [],
  selectedCandidateIdx: 0,
  dispensePlan: null,
  fullSchedule: [],

  // TTR Log
  inrRecords: [
    { date: '2026-01-01', inr: 1.8 },
    { date: '2026-01-29', inr: 2.4 },
    { date: '2026-02-26', inr: 2.8 },
    { date: '2026-03-26', inr: 3.2 },
    { date: '2026-04-23', inr: 2.3 }
  ]
};

const UI = {
  init() {
    this.bindEvents();
    this.syncDates();
    this.renderTTRTable();
  },

  syncDates() {
    const today = new Date();
    document.getElementById('startDate').value = today.toISOString().split('T')[0];
    appState.startDate = today.toISOString().split('T')[0];
    
    const nextMonth = new Date(today.getTime() + (28 * 86400000));
    document.getElementById('followUpDate').value = nextMonth.toISOString().split('T')[0];
    appState.followUpDate = nextMonth.toISOString().split('T')[0];
  },

  syncDaysFromDates() {
    const sStr = document.getElementById('startDate').value;
    const fStr = document.getElementById('followUpDate').value;
    if (sStr && fStr) {
      const sDate = new Date(sStr + 'T00:00:00');
      const fDate = new Date(fStr + 'T00:00:00');
      const diff = Math.ceil((fDate.getTime() - sDate.getTime()) / 86400000);
      if (diff > 0 && diff <= 180) {
        document.getElementById('daysSupply').value = diff;
        appState.daysSupply = diff;
      }
    }
  },

  bindEvents() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // Schedule View Switcher
    document.querySelectorAll('.cal-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cal-switch-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.scheduleView = btn.dataset.view;
        UI.renderScheduleViews();
      });
    });

    // Indication change
    document.getElementById('indicationSelect').addEventListener('change', (e) => {
      const val = e.target.value;
      appState.indication = val;
      const customRow = document.getElementById('customTargetRow');
      if (val === 'custom') {
        customRow.style.display = 'grid';
      } else {
        customRow.style.display = 'none';
        appState.targetRange = { min: INDICATIONS[val].min, max: INDICATIONS[val].max };
        document.getElementById('targetRangeDisplay').textContent = 
          `ช่วงเป้าหมาย: ${appState.targetRange.min.toFixed(1)} - ${appState.targetRange.max.toFixed(1)}`;
      }
      UI.processCalculation();
    });

    // Date inputs listener for days supply sync
    document.getElementById('startDate').addEventListener('change', () => {
      appState.startDate = document.getElementById('startDate').value;
      UI.syncDaysFromDates();
      if (appState.regimenCandidates.length) UI.renderScheduleViews();
    });
    document.getElementById('followUpDate').addEventListener('change', () => {
      appState.followUpDate = document.getElementById('followUpDate').value;
      UI.syncDaysFromDates();
      if (appState.regimenCandidates.length) UI.renderScheduleViews();
    });

    // Current Weekly Dose input listener
    document.getElementById('currentWeeklyDose').addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (val > 0) {
        document.getElementById('dailyAvgDisplay').textContent = `เฉลี่ยวันละ: ${(val / 7).toFixed(2)} mg`;
      }
    });

    // Quick adjust buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const current = Number(document.getElementById('currentWeeklyDose').value);
        if (!current) {
          alert('กรุณาระบุขนาดยาเดิม (mg/สัปดาห์) ก่อน');
          return;
        }
        const pct = Number(btn.dataset.pct);
        const target = Math.round(current * (1 + pct / 100) * 2) / 2;
        document.getElementById('targetWeeklyDose').value = target;
        UI.processCalculation();
      });
    });

    // Calculate button
    document.getElementById('calculateBtn').addEventListener('click', () => {
      UI.processCalculation();
    });

    // Print header button with patient calendar metadata sync
    document.getElementById('printHeaderBtn').addEventListener('click', () => {
      // 1. Ensure regimen is calculated
      if (!appState.regimenCandidates.length) {
        UI.processCalculation();
      }

      // 2. Set view to calendar
      appState.scheduleView = 'calendar';
      document.querySelectorAll('.cal-switch-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.view === 'calendar');
      });
      UI.renderScheduleViews();

      // 3. Make sure Tab 1 is active for print
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-tab="tab-calculator"]').classList.add('active');
      document.getElementById('tab-calculator').classList.add('active');

      // 4. Populate Print Patient Header
      const printDateGen = document.getElementById('printDateGenerated');
      if (printDateGen) {
        printDateGen.textContent = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      const printInd = document.getElementById('printIndicationText');
      if (printInd) {
        printInd.textContent = INDICATIONS[appState.indication] ? INDICATIONS[appState.indication].label : 'ทั่วไป';
      }
      const printTarg = document.getElementById('printTargetINRText');
      if (printTarg) {
        printTarg.textContent = `${appState.targetRange.min.toFixed(1)} – ${appState.targetRange.max.toFixed(1)}`;
      }
      const printCurr = document.getElementById('printCurrentINRText');
      if (printCurr) {
        printCurr.textContent = document.getElementById('currentINR').value || '-';
      }
      const printNext = document.getElementById('printNextApptText');
      if (printNext) {
        const nextVal = document.getElementById('followUpDate').value;
        if (nextVal) {
          const dObj = new Date(nextVal + 'T00:00:00');
          printNext.textContent = dObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
        } else {
          printNext.textContent = 'ตามแพทย์นัด';
        }
      }

      // 5. Trigger browser print
      setTimeout(() => {
        window.print();
      }, 150);
    });

    // Reset header button
    document.getElementById('resetHeaderBtn').addEventListener('click', () => {
      if (confirm('ต้องการล้างค่าทั้งหมดใช่หรือไม่?')) {
        location.reload();
      }
    });

    // Copy EMR note button
    document.getElementById('copyEMRBtn').addEventListener('click', () => {
      const txt = document.getElementById('emrTextarea').value;
      if (!txt) return;
      navigator.clipboard.writeText(txt).then(() => {
        alert('คัดลอกข้อความสำหรับ EMR/HOSxP เรียบร้อยแล้ว');
      });
    });

    // TTR Buttons
    document.getElementById('addINRRowBtn').addEventListener('click', () => {
      appState.inrRecords.push({ date: new Date().toISOString().split('T')[0], inr: 2.5 });
      UI.renderTTRTable();
    });

    document.getElementById('calculateTTRBtn').addEventListener('click', () => {
      UI.calculateAndRenderTTR();
    });

    document.getElementById('loadSampleTTRBtn').addEventListener('click', () => {
      appState.inrRecords = [
        { date: '2026-01-01', inr: 1.8 },
        { date: '2026-01-29', inr: 2.4 },
        { date: '2026-02-26', inr: 2.8 },
        { date: '2026-03-26', inr: 3.2 },
        { date: '2026-04-23', inr: 2.3 }
      ];
      UI.renderTTRTable();
      UI.calculateAndRenderTTR();
    });
  },

  processCalculation() {
    const inr = Number(document.getElementById('currentINR').value);
    const currentTWD = Number(document.getElementById('currentWeeklyDose').value);
    let targetTWD = Number(document.getElementById('targetWeeklyDose').value);

    if (!inr || !currentTWD) {
      alert('กรุณากรอกค่า INR และขนาดยาเดิม (mg/สัปดาห์)');
      return;
    }

    const modifiers = {
      bleedingStatus: document.getElementById('bleedingStatus').value,
      highBleedingRisk: document.getElementById('highBleedingRisk') ? (document.getElementById('highBleedingRisk').value === 'true') : false,
      missedDoses: Number(document.getElementById('missedDoses').value),
      drugInteraction: document.getElementById('drugInteraction').value,
      dietChange: document.getElementById('dietChange').value
    };

    let targetMin = appState.targetRange.min;
    let targetMax = appState.targetRange.max;
    if (appState.indication === 'custom') {
      targetMin = Number(document.getElementById('customMinINR').value) || 2.0;
      targetMax = Number(document.getElementById('customMaxINR').value) || 3.0;
    }

    const rec = evaluateClinicalGuideline(inr, currentTWD, targetMin, targetMax, modifiers, appState.indication);
    appState.recommendation = rec;

    if (!targetTWD || isNaN(targetTWD)) {
      targetTWD = rec.suggestedTWD;
      document.getElementById('targetWeeklyDose').value = targetTWD;
    }
    appState.targetWeeklyDose = targetTWD;

    const chks = document.querySelectorAll('.strength-chk:checked');
    const strengths = Array.from(chks).map(c => Number(c.value));
    if (!strengths.length) {
      alert('กรุณาเลือกอย่างน้อย 1 ความแรงของเม็ดยา');
      return;
    }
    appState.availableStrengths = strengths;
    appState.allowHalfTabs = document.getElementById('allowHalfTabs').value === 'true';
    appState.startDayIdx = Number(document.getElementById('startDay').value);
    appState.daysSupply = Number(document.getElementById('daysSupply').value) || 28;
    appState.startDate = document.getElementById('startDate').value;
    appState.followUpDate = document.getElementById('followUpDate').value;

    if (rec.canAutoGenerate) {
      appState.regimenCandidates = generateRegimens(targetTWD, strengths, appState.allowHalfTabs, appState.startDayIdx);
    } else {
      appState.regimenCandidates = [];
    }

    appState.selectedCandidateIdx = 0;

    this.renderMetrics(currentTWD, targetTWD, rec);
    this.renderClinicalAlert(rec);
    this.renderAcuteTransition(rec, currentTWD);
    this.renderRegimenCandidates();
    this.renderScheduleViews();
    this.renderDispense();
    this.generateEMRNote();
  },

  renderMetrics(current, target, rec) {
    document.getElementById('dispCurrentTWD').textContent = `${current.toFixed(1)} mg`;
    document.getElementById('dispTargetTWD').textContent = `${target.toFixed(1)} mg`;
    
    const pct = Math.round(((target - current) / current) * 1000) / 10;
    const pctElem = document.getElementById('dispPctChange');
    pctElem.textContent = `${pct > 0 ? '+' : ''}${pct}%`;
    pctElem.className = `metric-value ${pct > 0 ? 'inc' : pct < 0 ? 'dec' : ''}`;

    const acuteElem = document.getElementById('dispAcuteAction');
    if (rec.acuteHoldDays > 0) {
      acuteElem.textContent = `Hold ${rec.acuteHoldDays} วัน`;
      acuteElem.className = 'metric-value hold';
    } else if (rec.boosterMg > 0) {
      acuteElem.textContent = `Booster +${rec.boosterMg} mg`;
      acuteElem.className = 'metric-value inc';
    } else {
      acuteElem.textContent = 'ไม่มี (เริ่มทันที)';
      acuteElem.className = 'metric-value';
    }
  },

  renderClinicalAlert(rec) {
    const container = document.getElementById('clinicalAlertBanner');
    let icon = 'ℹ️';
    if (rec.urgency === 'danger') icon = '🚨';
    else if (rec.urgency === 'warning') icon = '⚠️';
    else if (rec.urgency === 'success') icon = '✅';

    let protocolBox = '';
    if (rec.vitaminK || rec.bloodProduct || rec.monitoring) {
      protocolBox = `
        <div class="protocol-recommendation-box">
          <div class="protocol-rec-header">
            <span>💉 ข้อกำหนดการบริหารยาและสารทดแทนทางคลินิก (Clinical Protocol Orders)</span>
            <button type="button" class="btn-link-tab" onclick="document.querySelector('[data-tab=\'tab-protocols\']').click()">
              📖 ดูตารางเปรียบเทียบฉบับเต็ม ➜
            </button>
          </div>
          <div class="protocol-rec-grid">
            ${rec.vitaminK ? `
              <div class="protocol-rec-item ${rec.vitaminK.needed ? 'action-required' : ''}">
                <div class="protocol-rec-title">
                  <span class="route-badge ${rec.vitaminK.route.toLowerCase().includes('iv') ? 'iv' : 'oral'}">
                    ${rec.vitaminK.route}
                  </span>
                  <strong>Vitamin K1 (Phytonadione)</strong>
                </div>
                <div class="protocol-rec-val">ขนาด: <strong>${rec.vitaminK.dose}</strong> ${rec.vitaminK.duration ? `(${rec.vitaminK.duration})` : ''}</div>
                <div class="protocol-rec-desc">${rec.vitaminK.rationale}</div>
                ${rec.vitaminK.warning ? `<div class="protocol-rec-warn">${rec.vitaminK.warning}</div>` : ''}
              </div>
            ` : ''}
            
            ${rec.bloodProduct ? `
              <div class="protocol-rec-item ${rec.bloodProduct.needed ? 'action-required' : ''}">
                <div class="protocol-rec-title">
                  <span class="product-badge ${rec.bloodProduct.needed ? 'pcc' : ''}">
                    ${rec.bloodProduct.needed ? '🩸 Blood Product' : 'ไม่ต้องให้'}
                  </span>
                  <strong>สารทดแทน Clotting Factors</strong>
                </div>
                <div class="protocol-rec-val">${rec.bloodProduct.primary}</div>
                ${rec.bloodProduct.alternative && rec.bloodProduct.alternative !== '-' ? `<div class="protocol-rec-alt">ทางเลือกสำรอง: ${rec.bloodProduct.alternative}</div>` : ''}
                <div class="protocol-rec-desc">${rec.bloodProduct.details}</div>
              </div>
            ` : ''}

            ${rec.monitoring ? `
              <div class="protocol-rec-item">
                <div class="protocol-rec-title">
                  <span class="route-badge monitoring">⏱️ Monitoring</span>
                  <strong>การตรวจติดตามซ้ำ</strong>
                </div>
                <div class="protocol-rec-val">ตรวจ INR ซ้ำ: <strong>${rec.monitoring.recheckTimeline}</strong></div>
                <div class="protocol-rec-desc">${rec.monitoring.actionOnRecheck}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="clinical-alert ${rec.urgency}">
        <div class="alert-icon">${icon}</div>
        <div class="alert-content">
          <h4>${rec.actionTitle}</h4>
          <p>${rec.actionDescription}</p>
          ${rec.messages.length ? `<ul>${rec.messages.map(m => `<li>${m}</li>`).join('')}</ul>` : ''}
          ${protocolBox}
        </div>
      </div>
    `;
  },

  renderAcuteTransition(rec, currentTWD) {
    const card = document.getElementById('acuteTransitionCard');
    const body = document.getElementById('acuteTransitionBody');
    if (rec.acuteHoldDays > 0) {
      card.style.display = 'block';
      body.innerHTML = `
        <p style="font-size: 0.85rem; color: #92400e; line-height: 1.6;">
          🛑 <strong>คำชี้แจงสำหรับเภสัชกรและผู้ป่วย (สัปดาห์ที่ 1):</strong><br>
          - <strong>วันที่ 1 ${rec.acuteHoldDays === 2 ? 'และ วันที่ 2' : ''}:</strong> <span class="pill-badge pill-hold">หยุดรับประทานยา (Hold 0 mg)</span> เพื่อให้ระดับยาในเลือดลดลงสู่ช่วงปลอดภัย<br>
          - <strong>ตั้งแต่วันที่ ${rec.acuteHoldDays + 1} เป็นต้นไป:</strong> เริ่มรับประทานตามตารางยา Maintenance ปกติด้านล่าง (คำนวณจาก TWD ใหม่ ${appState.targetWeeklyDose} mg/สัปดาห์)<br>
          - <em>หมายเหตุ: การหยุดยา 1-2 วันนี้จะไม่ถูกนำไปหักออกจากสูตรยาต่อเนื่องของผู้ป่วยในสัปดาห์ต่อๆ ไป</em>
        </p>
      `;
    } else {
      card.style.display = 'none';
    }
  },

  renderRegimenCandidates() {
    const grid = document.getElementById('candidatesGrid');
    if (!appState.regimenCandidates.length) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 1rem;">
          ⚠️ ไม่สามารถสร้างตารางยาอัตโนมัติได้ เนื่องจากอยู่ในภาวะวิกฤต หรือขนาดยาไม่สอดคล้องกับขนาดเม็ดยาที่มี
        </div>
      `;
      return;
    }

    grid.innerHTML = appState.regimenCandidates.map((c, idx) => `
      <div class="candidate-card ${idx === appState.selectedCandidateIdx ? 'selected' : ''}" data-idx="${idx}">
        <span class="badge-rank">${c.tag}</span>
        <div class="candidate-weekly">${c.twd} mg/สัปดาห์</div>
        <div class="candidate-meta">
          ใช้ยา ${c.usedStrengths} ขนาด | หักครึ่งเม็ด ${c.halfDays} วัน/สัปดาห์
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.candidate-card').forEach(card => {
      card.addEventListener('click', () => {
        appState.selectedCandidateIdx = Number(card.dataset.idx);
        UI.renderRegimenCandidates();
        UI.renderScheduleViews();
        UI.renderDispense();
        UI.generateEMRNote();
      });
    });
  },

  renderScheduleViews() {
    const detailsContainer = document.getElementById('selectedRegimenDetails');
    const selected = appState.regimenCandidates[appState.selectedCandidateIdx];
    if (!selected) {
      detailsContainer.style.display = 'none';
      return;
    }
    detailsContainer.style.display = 'block';

    const acuteHoldDays = (appState.recommendation && appState.recommendation.acuteHoldDays) ? appState.recommendation.acuteHoldDays : 0;
    appState.fullSchedule = buildFullMedicationSchedule(selected.dailyDetails, appState.daysSupply, appState.startDate, acuteHoldDays);

    // Toggle container views
    const calView = document.getElementById('medicationCalendarContainer');
    const splitView = document.getElementById('splitScheduleContainer');
    const weeklyView = document.getElementById('weeklyScheduleContainer');

    if (appState.scheduleView === 'calendar') {
      calView.style.display = 'block';
      splitView.style.display = 'none';
      weeklyView.style.display = 'none';
      UI.renderMedicationCalendar();
    } else if (appState.scheduleView === 'split') {
      calView.style.display = 'none';
      splitView.style.display = 'block';
      weeklyView.style.display = 'none';
      UI.renderSplitSchedule();
    } else {
      calView.style.display = 'none';
      splitView.style.display = 'none';
      weeklyView.style.display = 'block';
      UI.renderWeeklyTable(selected);
    }
  },

    renderMedicationCalendar() {
    const container = document.getElementById('medicationCalendarContainer');
    if (!container) return;

    const selected = appState.regimenCandidates[appState.selectedCandidateIdx];
    if (!selected) return;

    const acuteHoldDays = (appState.recommendation && appState.recommendation.acuteHoldDays) ? appState.recommendation.acuteHoldDays : 0;
    const monthlySets = generateMonthlyCalendars(appState.startDate, appState.daysSupply, selected.dailyDetails, acuteHoldDays);

    let html = `
      <!-- Pill Graphic Legend -->
      <div class="pill-legend-bar">
        <span style="color:#0f172a; font-weight:700;">สัญลักษณ์เม็ดยา:</span>
        <div class="pill-legend-item">
          <svg class="pill-svg full" viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;">
            <circle cx="12" cy="12" r="9.5" fill="#ef8d2f" stroke="#ef8d2f" stroke-width="1.5"/>
            <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.75"/>
          </svg>
          <span>Warfarin 2 mg (สีส้ม/ม่วง)</span>
        </div>
        <div class="pill-legend-item">
          <svg class="pill-svg full" viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;">
            <circle cx="12" cy="12" r="9.5" fill="#175da8" stroke="#175da8" stroke-width="1.5"/>
            <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.75"/>
          </svg>
          <span>Warfarin 3 mg (สีฟ้า)</span>
        </div>
        <div class="pill-legend-item">
          <svg class="pill-svg full" viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;">
            <circle cx="12" cy="12" r="9.5" fill="#e24a93" stroke="#e24a93" stroke-width="1.5"/>
            <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.75"/>
          </svg>
          <span>Warfarin 5 mg (สีชมพู)</span>
        </div>
        <div class="pill-legend-item">
          <svg class="pill-svg half" viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;">
            <circle cx="12" cy="12" r="9.5" fill="#ffffff" stroke="#175da8" stroke-width="2"/>
            <path d="M 12,2.5 A 9.5,9.5 0 0,0 12,21.5 Z" fill="#175da8"/>
            <line x1="12" y1="2.5" x2="12" y2="21.5" stroke="#1e293b" stroke-width="1.5"/>
            <text x="16.5" y="15" font-size="7.5" font-weight="900" fill="#175da8" text-anchor="middle" font-family="system-ui, sans-serif">½</text>
          </svg>
          <span style="font-weight:700; color:#1e40af;">ครึ่งเม็ด (½ เม็ด)</span>
        </div>
        <div class="pill-legend-item">
          <svg class="pill-svg hold" viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;">
            <circle cx="12" cy="12" r="9.5" fill="#fee2e2" stroke="#dc2626" stroke-width="2" stroke-dasharray="3,2"/>
            <line x1="7" y1="7" x2="17" y2="17" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="17" y1="7" x2="7" y2="17" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <span style="color:var(--danger); font-weight:700;">หยุดรับประทานยา (HOLD 0 mg)</span>
        </div>
      </div>
    `;

    monthlySets.forEach((mSet, idx) => {
      html += `
        <div class="month-calendar-block">
          <div class="month-header">
            <h4>📅 ชุดที่ ${idx + 1}: ${mSet.title}</h4>
            <span class="month-badge">รับประทาน ${mSet.activeDaysCount} วันในเดือนนี้</span>
          </div>
          
          <div class="calendar-weekday-bar">
            <div class="weekday-col">จันทร์ (Mon)</div>
            <div class="weekday-col">อังคาร (Tue)</div>
            <div class="weekday-col">พุธ (Wed)</div>
            <div class="weekday-col">พฤหัสบดี (Thu)</div>
            <div class="weekday-col">ศุกร์ (Fri)</div>
            <div class="weekday-col sat">เสาร์ (Sat)</div>
            <div class="weekday-col sun">อาทิตย์ (Sun)</div>
          </div>

          <div class="calendar-grid">
      `;

      mSet.cells.forEach(cell => {
        if (cell.type === 'empty') {
          html += `<div class="calendar-cell empty-cell"></div>`;
        } else if (cell.type === 'inactive') {
          const satClass = cell.weekdayIdx === 5 ? 'sat-cell' : '';
          const sunClass = cell.weekdayIdx === 6 ? 'sun-cell' : '';
          html += `
            <div class="calendar-cell inactive-cell ${satClass} ${sunClass}">
              <div class="cal-cell-top">
                <span class="cal-date-num">${cell.day}</span>
              </div>
            </div>
          `;
        } else {
          // Active treatment cell
          const satClass = cell.weekdayIdx === 5 ? 'sat-cell' : '';
          const sunClass = cell.weekdayIdx === 6 ? 'sun-cell' : '';
          const holdClass = cell.isHold ? 'hold-day' : '';

          html += `
            <div class="calendar-cell active-treatment ${satClass} ${sunClass} ${holdClass}">
              <div class="cal-cell-top">
                <span class="cal-date-num">${cell.day}</span>
                ${cell.isHold ? '<span class="badge-rank" style="background:#dc2626; color:#fff; font-size:0.65rem;">HOLD</span>' : ''}
              </div>
              <div class="cal-dose-badge">
                ${cell.isHold ? 'หยุดยา' : `${cell.dose} mg`}
              </div>
              <div>
                ${cell.isHold ? '<div class="pill-group-cell">' + (typeof renderHoldPillVisual === 'function' ? renderHoldPillVisual() : '<span class="pill-icon hold"></span>') + '</div>' : renderPillVisual(cell.tablets)}
              </div>
              <div class="cal-tab-caption">
                ${cell.note}
              </div>
            </div>
          `;
        }
      });

      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },


  renderSplitSchedule() {
    const tbody = document.getElementById('splitScheduleTbody');
    if (!tbody) return;

    tbody.innerHTML = appState.fullSchedule.map(row => {
      const rowClass = row.isHold ? 'hold-row' : '';
      const pillVisual = row.isHold
        ? '<div class="pill-group-cell"><span class="pill-icon hold"></span></div>'
        : renderPillVisual(row.tablets);
      const pillBadges = row.isHold
        ? '<span class="pill-badge pill-hold">🛑 HOLD</span>'
        : (row.tablets || []).map(t => `<span class="pill-badge pill-${t.strength}">${t.tablets === 0.5 ? '½' : t.tablets} × ${t.strength}mg</span>`).join(' ');

      return `
        <tr class="${rowClass}">
          <td><strong>#${row.dayIndex}</strong></td>
          <td>${row.dateLabel}</td>
          <td>${row.weekdayName}</td>
          <td><strong>${row.isHold ? '0 mg' : `${row.dose} mg`}</strong></td>
          <td>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              ${pillVisual}
              <div style="display:flex; gap:2px; flex-wrap:wrap; justify-content:center;">${pillBadges}</div>
            </div>
          </td>
          <td style="text-align: left;">${row.note}</td>
        </tr>
      `;
    }).join('');
  },

  renderWeeklyTable(selected) {
    const tbody = document.getElementById('weeklyScheduleTbody');
    if (!tbody) return;
    const startDay = appState.startDayIdx;

    tbody.innerHTML = selected.dailyDetails.map((item, idx) => {
      const dayNameIdx = (startDay + idx) % 7;
      const dayName = DAY_NAMES_TH[dayNameIdx];
      
      const pillText = item.tablets.map(t => {
        const countStr = (t.tablets === 0.5) ? 'ครึ่งเม็ด (½)' : `${t.tablets} เม็ด`;
        return `Warfarin ${t.strength} mg: ${countStr}`;
      }).join(', ') || 'หยุดยา (0 mg)';

      const pillVisual = renderPillVisual(item.tablets);
      const pillIcons = item.tablets.map(t => {
        return `<span class="pill-badge pill-${t.strength}">${t.tablets === 0.5 ? '½' : t.tablets} × ${t.strength}mg</span>`;
      }).join('') || '<span class="pill-badge pill-hold">Hold (0 mg)</span>';

      return `
        <tr>
          <td class="day-name">วัน${dayName}</td>
          <td style="font-weight: 700;">${item.dose} mg</td>
          <td style="text-align: left;">${pillText}</td>
          <td>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              ${pillVisual}
              <div style="display:flex; gap:2px; flex-wrap:wrap; justify-content:center;">${pillIcons}</div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderDispense() {
    const card = document.getElementById('dispenseCard');
    const content = document.getElementById('dispenseSummaryContent');
    const selected = appState.regimenCandidates[appState.selectedCandidateIdx];
    if (!selected) {
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';

    const plan = calculateHospitalDispense(selected.dailyDetails, appState.daysSupply);
    appState.dispensePlan = plan;

    let html = `
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
        สำหรับระยะเวลาการรักษา <strong>${appState.daysSupply} วัน</strong> (คำนวณปัดเศษขึ้นเป็นเม็ดเต็มสำหรับห้องจ่ายยาโรงพยาบาล):
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem;">
    `;

    plan.rows.forEach(r => {
      html += `
        <div style="border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; background: #fafafa;">
          <div style="font-size: 0.8rem; font-weight: 700; color: #334155;">Warfarin ขนาด ${r.strength} mg</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--primary); margin: 0.2rem 0;">
            ${r.dispenseTablets} <span style="font-size: 0.85rem; font-weight: 600;">เม็ด</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">
            (ใช้จริง ${r.exactUnits} เม็ด ${r.spareHalves > 0 ? `| สำรอง ${r.spareHalves} ครึ่งเม็ด` : ''})
          </div>
        </div>
      `;
    });

    html += `</div>`;
    content.innerHTML = html;
  },

  generateEMRNote() {
    const selected = appState.regimenCandidates[appState.selectedCandidateIdx];
    const rec = appState.recommendation;
    const currentTWD = Number(document.getElementById('currentWeeklyDose').value) || 0;
    const inr = Number(document.getElementById('currentINR').value) || 0;

    let note = `=== WARFARIN CLINIC PROGRESS NOTE (SOAP) ===\n`;
    note += `วันที่: ${new Date().toLocaleDateString('th-TH')}\n`;
    note += `ข้อบ่งใช้: ${INDICATIONS[appState.indication].label} (Target INR ${appState.targetRange.min.toFixed(1)} - ${appState.targetRange.max.toFixed(1)})\n\n`;
    note += `[S & O]:\n`;
    note += `- INR ครั้งนี้: ${inr.toFixed(2)} | ขนาดยาเดิม: ${currentTWD.toFixed(1)} mg/สัปดาห์\n`;
    note += `- ภาวะเลือดออก: ${document.getElementById('bleedingStatus').options[document.getElementById('bleedingStatus').selectedIndex].text}\n`;
    note += `- ประวัติลืมทานยา: ${document.getElementById('missedDoses').options[document.getElementById('missedDoses').selectedIndex].text}\n`;
    note += `- ปฏิกิริยาระหว่างยา: ${document.getElementById('drugInteraction').options[document.getElementById('drugInteraction').selectedIndex].text}\n`;
    note += `- อาหาร/แอลกอฮอล์: ${document.getElementById('dietChange').options[document.getElementById('dietChange').selectedIndex].text}\n\n`;
    
    note += `[A - Assessment]:\n`;
    if (rec) {
      note += `- ${rec.actionTitle}\n`;
      rec.messages.forEach(m => note += `  * ${m}\n`);
    }
    
    note += `\n[P - Plan & Maintenance Regimen]:\n`;
    if (rec && rec.acuteHoldDays > 0) {
      note += `* สัปดาห์แรก: Hold Warfarin ${rec.acuteHoldDays} วันแรก จากนั้นทานตามตารางใหม่\n`;
    }
    if (selected) {
      note += `* ขนาดยาเป้าหมายใหม่ (TWD): ${selected.twd} mg/สัปดาห์\n`;
      note += `* ตารางรับประทานยาประจำสัปดาห์:\n`;
      selected.dailyDetails.forEach((item, idx) => {
        const dayName = DAY_NAMES_TH[(appState.startDayIdx + idx) % 7];
        const pText = item.tablets.map(t => `${t.strength}mg (${t.tablets}เม็ด)`).join('+') || 'Hold (0mg)';
        note += `  - วัน${dayName}: ${item.dose} mg [${pText}]\n`;
      });

      if (appState.dispensePlan) {
        note += `* สั่งจ่ายยาสำหรับ ${appState.daysSupply} วัน:\n`;
        appState.dispensePlan.rows.forEach(r => {
          note += `  - Warfarin ${r.strength} mg: จ่าย ${r.dispenseTablets} เม็ด (ใช้จริง ${r.exactUnits} เม็ด)\n`;
        });
      }
    }
    note += `* วันนัดตรวจครั้งถัดไป: ${document.getElementById('followUpDate').value || 'ตามแพทย์นัด'}\n`;
    note += `=================================================`;

    document.getElementById('emrTextarea').value = note;
  },

  renderTTRTable() {
    const tbody = document.getElementById('inrHistoryTbody');
    tbody.innerHTML = appState.inrRecords.map((r, i) => {
      const inTarget = (r.inr >= appState.targetRange.min && r.inr <= appState.targetRange.max);
      return `
        <tr>
          <td>${i + 1}</td>
          <td><input type="date" class="form-control form-control-sm inr-date-input" value="${r.date}" data-idx="${i}"></td>
          <td><input type="number" step="0.01" class="form-control form-control-sm inr-val-input" value="${r.inr}" data-idx="${i}" style="width: 80px; margin: 0 auto;"></td>
          <td>${appState.targetRange.min.toFixed(1)} - ${appState.targetRange.max.toFixed(1)}</td>
          <td><span class="pill-badge ${inTarget ? 'pill-3' : 'pill-hold'}">${inTarget ? 'In Target' : 'Out'}</span></td>
          <td><button type="button" class="btn btn-secondary btn-sm" onclick="UI.removeINRRow(${i})">❌</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.inr-date-input').forEach(input => {
      input.addEventListener('change', (e) => {
        appState.inrRecords[e.target.dataset.idx].date = e.target.value;
      });
    });
    tbody.querySelectorAll('.inr-val-input').forEach(input => {
      input.addEventListener('input', (e) => {
        appState.inrRecords[e.target.dataset.idx].inr = Number(e.target.value);
      });
    });
  },

  removeINRRow(idx) {
    appState.inrRecords.splice(idx, 1);
    this.renderTTRTable();
  },

  calculateAndRenderTTR() {
    const res = calculateTTRRosendaal(appState.inrRecords, appState.targetRange.min, appState.targetRange.max);
    
    const scoreElem = document.getElementById('ttrScoreDisplay');
    const badgeElem = document.getElementById('ttrStatusBadge');
    const adviceElem = document.getElementById('ttrClinicalAdvice');

    scoreElem.textContent = `${res.ttrPct}%`;
    document.getElementById('ttrTotalDays').textContent = `${res.totalDays} วัน`;
    document.getElementById('ttrInTargetDays').textContent = `${res.inRangeDays} วัน`;
    document.getElementById('ttrDirectVisitPct').textContent = `${res.directVisitPct}%`;

    if (res.ttrPct >= 70) {
      scoreElem.style.color = 'var(--success)';
      badgeElem.style.background = 'var(--success-bg)';
      badgeElem.style.color = 'var(--success)';
      badgeElem.textContent = '🌟 คุณภาพการควบคุมดีเยี่ยม (Excellent Control)';
      adviceElem.innerHTML = `
        <div class="clinical-alert success">
          <div class="alert-icon">✅</div>
          <div class="alert-content">
            <h4>TTR อยู่ในเกณฑ์มาตรฐานสากล (&ge; 70%)</h4>
            <p>ระดับการต้านการแข็งตัวของเลือดคงที่อย่างมีประสิทธิภาพ แนะนำให้นัดตรวจติดตามระยะห่างได้ 8 - 12 สัปดาห์</p>
          </div>
        </div>
      `;
    } else if (res.ttrPct >= 65) {
      scoreElem.style.color = 'var(--primary)';
      badgeElem.style.background = 'var(--primary-light)';
      badgeElem.style.color = 'var(--primary-dark)';
      badgeElem.textContent = '👍 คุณภาพการควบคุมยอมรับได้ (Good Control)';
      adviceElem.innerHTML = `
        <div class="clinical-alert info">
          <div class="alert-icon">ℹ️</div>
          <div class="alert-content">
            <h4>TTR อยู่ในเกณฑ์ยอมรับได้ (65% - 69%)</h4>
            <p>ควรเสริมสร้างความเข้าใจเรื่องอาหารและยาตีกันเพื่อขยับค่า TTR ให้มากกว่า 70%</p>
          </div>
        </div>
      `;
    } else {
      scoreElem.style.color = 'var(--danger)';
      badgeElem.style.background = 'var(--danger-bg)';
      badgeElem.style.color = 'var(--danger)';
      badgeElem.textContent = '⚠️ คุณภาพการควบคุมต่ำกว่าเกณฑ์ (Suboptimal Control)';
      adviceElem.innerHTML = `
        <div class="clinical-alert danger">
          <div class="alert-icon">⚠️</div>
          <div class="alert-content">
            <h4>TTR ต่ำกว่าเกณฑ์มาตรฐาน (< 65%) - เสี่ยงต่อ Thromboembolism หรือ Bleeding</h4>
            <p><strong>แนวทางปฏิบัติของเภสัชกรคลินิก:</strong></p>
            <ul>
              <li>ประเมินความร่วมมือในการรับประทานยา (Medication Adherence) อย่างละเอียด</li>
              <li>ตรวจสอบยาสมุนไพร อาหารเสริม และอาหารที่มีวิตามินเค</li>
              <li>คำนวณ SAMe-TT2R2 Score หากเป็น Non-valvular AF และคะแนน &gt; 2 ควรปรึกษาแพทย์เพื่อพิจารณาเปลี่ยนเป็นยากลุ่ม DOACs (Direct Oral Anticoagulants)</li>
            </ul>
          </div>
        </div>
      `;
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  UI.init();
});
