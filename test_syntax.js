
    /* =========================================================================
       WARFARIN CLINIC PRO - CLINICAL & MATHEMATICAL COMPUTATION ENGINE
       Verified by Clinical Pharmacist & Senior Web App Developer
       ========================================================================= */

    // Indication Master Data & Target INR Ranges
    const INDICATIONS = {
      af: { label: 'Atrial Fibrillation / VTE Prophylaxis', min: 2.0, max: 3.0 },
      vte: { label: 'DVT / Pulmonary Embolism Treatment', min: 2.0, max: 3.0 },
      mech_avr: { label: 'Mechanical Aortic Valve Replacement (Low risk)', min: 2.0, max: 3.0 },
      mech_mvr: { label: 'Mechanical Mitral Valve / High Risk Valve', min: 2.5, max: 3.5 },
      aps: { label: 'Antiphospholipid Syndrome (APS)', min: 2.5, max: 3.5 },
      custom: { label: 'Custom Range', min: 2.0, max: 3.0 }
    };

    const DAY_NAMES_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
    const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // State Management
    const appState = {
      lang: 'th',
      indication: 'af',
      targetRange: { min: 2.0, max: 3.0 },
      currentINR: null,
      currentWeeklyDose: null,
      targetWeeklyDose: null,
      bleedingStatus: 'none',
      missedDoses: 0,
      drugInteraction: 'none',
      dietChange: 'none',
      availableStrengths: [2, 3, 5],
      allowHalfTabs: true,
      startDayIdx: 0, // 0 = Mon
      startDate: new Date().toISOString().split('T')[0],
      followUpDate: '',
      daysSupply: 28,
      dispenseMode: 'bulk',
      
      // Clinical Results
      recommendation: null,
      regimenCandidates: [],
      selectedCandidateIdx: 0,
      dispensePlan: null,

      // TTR History Log
      inrRecords: [
        { date: '2026-01-01', inr: 1.8 },
        { date: '2026-01-29', inr: 2.4 },
        { date: '2026-02-26', inr: 2.8 },
        { date: '2026-03-26', inr: 3.2 },
        { date: '2026-04-23', inr: 2.3 }
      ]
    };

    /* -------------------------------------------------------------------------
       1. CLINICAL RULE ENGINE (Standard Guideline Compliance)
       ------------------------------------------------------------------------- */
    function evaluateClinicalGuideline(inr, currentTWD, targetMin, targetMax, modifiers) {
      const res = {
        urgency: 'info', // 'danger', 'warning', 'success', 'info'
        percentAdjustment: 0,
        suggestedTWD: currentTWD,
        acuteHoldDays: 0,
        boosterMg: 0,
        actionTitle: 'คงขนาดยาเดิม (Maintain Current Dose)',
        actionDescription: 'ระดับ INR อยู่ในช่วงเป้าหมายที่ต้องการ',
        messages: [],
        canAutoGenerate: true
      };

      if (!inr || inr <= 0 || !currentTWD || currentTWD <= 0) {
        res.messages.push('กรุณาระบุค่า INR และขนาดยาเดิมเพื่อประเมิน');
        return res;
      }

      // 1. Critical Bleeding Guardrail
      if (modifiers.bleedingStatus === 'major') {
        res.urgency = 'danger';
        res.canAutoGenerate = false;
        res.acuteHoldDays = 2;
        res.actionTitle = '🚨 เลือดออกรุนแรง (Major Bleeding) - ฉุกเฉิน';
        res.actionDescription = 'หยุดยา Warfarin ทันที และส่งตัวพบแพทย์/ห้องฉุกเฉินด่วน เพื่อพิจารณาให้ IV Vitamin K1 ร่วมกับ 4F-PCC หรือ FFP';
        res.messages.push('มีภาวะเลือดออกรุนแรง: ต้องหยุดยาและได้รับการรักษาเร่งด่วนในโรงพยาบาล');
        return res;
      }

      // 2. Critical INR Thresholds (INR >= 10.0 or INR 4.5-9.9)
      if (inr >= 10.0) {
        res.urgency = 'danger';
        res.acuteHoldDays = 2;
        res.percentAdjustment = -20;
        res.suggestedTWD = Math.round(currentTWD * 0.80 * 2) / 2;
        res.actionTitle = '⚠️ INR วิกฤต (INR >= 10.0)';
        res.actionDescription = 'หยุดยา Warfarin อย่างน้อย 1-2 วัน และพบแพทย์ด่วนเพื่อพิจารณา Oral Vitamin K1 (2.5 - 5 mg) นัดตรวจติดตาม INR ภายใน 24-48 ชั่วโมง';
        res.messages.push('ค่า INR สูงมาก เสี่ยงต่อการมีเลือดออกรุนแรง ต้องหยุดยาและปรึกษาแพทย์ทันที');
        return res;
      }

      if (inr >= 4.5) {
        res.urgency = 'warning';
        res.acuteHoldDays = (inr >= 6.0) ? 2 : 1;
        res.percentAdjustment = -15; // ค่ากลาง 10-20%
        res.suggestedTWD = Math.round(currentTWD * 0.85 * 2) / 2;
        res.actionTitle = `หยุดยา ${res.acuteHoldDays} วัน แล้วปรับลดขนาดยารายสัปดาห์ลง 15%`;
        res.actionDescription = `หยุดยา Warfarin วันแรก ${res.acuteHoldDays} วัน จากนั้นเริ่มทานตาราง Maintenance ใหม่ และนัดตรวจ INR ซ้ำใน 3-7 วัน`;
        res.messages.push(`INR ${inr} สูงกว่าช่วงเป้าหมายชัดเจน ควรตรวจสอบอาการเลือดออกและปัจจัยรบกวน`);
        return res;
      }

      // 3. Modifiers: Missed Doses Logic
      if (modifiers.missedDoses >= 1 && inr < targetMin) {
        res.urgency = 'warning';
        res.percentAdjustment = 0; // ห้ามปรับเพิ่มโดส!
        res.suggestedTWD = currentTWD;
        res.actionTitle = 'คงขนาดยาเดิม (ห้ามเพิ่มยาเนื่องจากลืมทานยา)';
        res.actionDescription = `ผู้ป่วยลืมทานยา ${modifiers.missedDoses} วันในสัปดาห์ที่ผ่านมา INR ที่ต่ำเกิดจากการขาดยา ไม่ใช่ความดื้อยา`;
        res.messages.push('เน้นย้ำความสม่ำเสมอในการรับประทานยา และนัดตรวจติดตามซ้ำใน 1-2 สัปดาห์');
        return res;
      }

      // 4. Standard INR Bands (Target 2.0-3.0 or 2.5-3.5)
      if (inr < targetMin - 0.5) { // e.g. < 1.5
        res.percentAdjustment = 15; // 10-20%
        res.suggestedTWD = Math.round(currentTWD * 1.15 * 2) / 2;
        res.actionTitle = 'ปรับเพิ่มขนาดยารายสัปดาห์ขึ้น 10% – 20% (เฉลี่ย +15%)';
        res.actionDescription = 'INR ต่ำกว่าเป้าหมายชัดเจน ปรับเพิ่มขนาดยา และหาสาเหตุ (อาหาร, ยาตีกัน)';
        if (appState.indication === 'mech_mvr' || appState.indication === 'aps') {
          res.boosterMg = Math.round((currentTWD / 7) * 0.5 * 2) / 2;
          res.messages.push(`ผู้ป่วย High-risk Valve/APS อาจพิจารณาให้ Extra dose วันแรก ~${res.boosterMg} mg`);
        }
      } else if (inr < targetMin) { // e.g. 1.5 - 1.9
        res.percentAdjustment = 7.5; // 5-10%
        res.suggestedTWD = Math.round(currentTWD * 1.075 * 2) / 2;
        res.actionTitle = 'ปรับเพิ่มขนาดยารายสัปดาห์ขึ้น 5% – 10% (เฉลี่ย +7.5%)';
        res.actionDescription = 'INR ต่ำกว่าเป้าหมายเล็กน้อย ปรับเพิ่มยาเล็กน้อยหรือคงยาเดิมหากเดิมคงที่';
      } else if (inr <= targetMax) { // In range
        res.percentAdjustment = 0;
        res.suggestedTWD = currentTWD;
        res.urgency = 'success';
        res.actionTitle = 'คงขนาดยาเดิม (In Therapeutic Range)';
        res.actionDescription = 'ระดับ INR อยู่ในช่วงเป้าหมายดี รับประทานยาตามสูตรเดิม';
      } else if (inr <= targetMax + 0.5) { // e.g. 3.1 - 3.5
        res.percentAdjustment = -7.5; // -5% to -10%
        res.suggestedTWD = Math.round(currentTWD * 0.925 * 2) / 2;
        res.actionTitle = 'ปรับลดขนาดยารายสัปดาห์ลง 5% – 10% (เฉลี่ย -7.5%)';
        res.actionDescription = 'INR สูงกว่าเป้าหมายเล็กน้อย ไม่จำเป็นต้องหยุดยา ให้ลดขนาดยาลงเล็กน้อย';
      } else { // targetMax + 0.5 < inr < 4.5 (e.g. 3.6 - 4.4)
        res.percentAdjustment = -12.5; // -10% to -15%
        res.suggestedTWD = Math.round(currentTWD * 0.875 * 2) / 2;
        res.acuteHoldDays = 1;
        res.actionTitle = 'หยุดยา 1 วัน แล้วปรับลดขนาดยารายสัปดาห์ลง 10% – 15%';
        res.actionDescription = 'หยุดยา Warfarin วันแรก 1 วัน จากนั้นรับประทานตามสูตรใหม่';
      }

      // Clinical Modifiers Fine-tuning
      if (modifiers.drugInteraction === 'cyp_inhibitor') {
        res.messages.push('⚠️ เริ่มยาที่มีผลยับยั้ง CYP2C9 (เช่น Amiodarone, Bactrim, Fluconazole): ระดับยาจะสูงขึ้นอย่างมาก ควรพิจารณาลดโดสเชิงรุก 20-30%');
      } else if (modifiers.drugInteraction === 'cyp_inducer') {
        res.messages.push('⚠️ เริ่มยาที่กระตุ้นเอนไซม์ (Rifampicin, Phenytoin): ประสิทธิภาพยาจะลดลง อาจต้องปรับเพิ่มยาในสัปดาห์ถัดไป');
      }

      if (modifiers.dietChange === 'alcohol') {
        res.messages.push('⚠️ ดื่มสุราปริมาณมากแบบเฉียบพลัน ทำให้ระดับ Warfarin ในเลือดพุ่งสูงขึ้น เสี่ยงต่อเลือดออก');
      }

      return res;
    }

    /* -------------------------------------------------------------------------
       2. REGIMEN DECOMPOSITION & COMBINATORICS OPTIMIZER
       Verified: Strict Single/Dual Strength Preference, Minimal Half Tabs
       ------------------------------------------------------------------------- */
    function decomposeDoseToTablets(dailyDose, strengths, allowHalf) {
      if (dailyDose === 0) return [];
      const validStrengths = [...strengths].sort((a, b) => b - a);
      let bestCombination = null;
      let lowestScore = Infinity;

      // Piece definitions
      const pieces = [];
      validStrengths.forEach(s => {
        pieces.push({ value: s, strength: s, count: 1 });
        if (allowHalf) pieces.push({ value: s / 2, strength: s, count: 0.5 });
      });

      // Search combinations up to 4 units per day
      function search(idx, remaining, chosen) {
        if (Math.abs(remaining) < 0.001) {
          // Score combination: prioritize fewer tablets, fewer half tablets, single strength
          const tabletCount = chosen.reduce((acc, c) => acc + c.count, 0);
          const halfCount = chosen.filter(c => c.count === 0.5).length;
          const usedStrengths = new Set(chosen.map(c => c.strength)).size;
          
          const score = (tabletCount * 10) + (halfCount * 15) + (usedStrengths * 25);
          if (score < lowestScore) {
            lowestScore = score;
            bestCombination = [...chosen];
          }
          return;
        }
        if (idx >= pieces.length || remaining < -0.001 || chosen.length >= 4) return;

        // Try taking this piece
        const piece = pieces[idx];
        const maxTake = Math.min(3, Math.floor((remaining + 0.001) / piece.value));
        for (let t = maxTake; t >= 0; t--) {
          for (let i = 0; i < t; i++) chosen.push(piece);
          search(idx + 1, remaining - (t * piece.value), chosen);
          for (let i = 0; i < t; i++) chosen.pop();
        }
      }

      search(0, dailyDose, []);

      // Group by strength
      if (!bestCombination) return null;
      const grouped = {};
      bestCombination.forEach(p => {
        grouped[p.strength] = (grouped[p.strength] || 0) + p.count;
      });

      return Object.keys(grouped).map(s => ({
        strength: Number(s),
        tablets: grouped[s]
      })).sort((a, b) => a.strength - b.strength);
    }

    function generateRegimens(targetTWD, strengths, allowHalf, startDayIdx) {
      const candidates = [];
      const targetDailyAvg = targetTWD / 7;

      // Candidate Strategy 1: Equal Daily Dose (Gold Standard)
      // Check if targetDailyAvg is decomposable
      const roundedDaily = Math.round(targetDailyAvg * 2) / 2; // nearest 0.5 mg
      if (Math.abs(roundedDaily * 7 - targetTWD) <= 1.0) {
        const decomp = decomposeDoseToTablets(roundedDaily, strengths, allowHalf);
        if (decomp) {
          const daily = Array(7).fill(roundedDaily);
          candidates.push({
            name: 'สูตรที่ 1: รับประทานเท่ากันทุกวัน (Equal Daily Dose)',
            tag: 'แนะนำอันดับ 1 - เข้าใจง่ายที่สุด',
            twd: roundedDaily * 7,
            diff: Math.abs(roundedDaily * 7 - targetTWD),
            dailyDoses: daily,
            dailyDetails: daily.map(d => ({ dose: d, tablets: decomp })),
            usedStrengths: new Set(decomp.map(x => x.strength)).size,
            halfDays: decomp.some(x => x.tablets % 1 !== 0) ? 7 : 0
          });
        }
      }

      // Candidate Strategy 2: 2 Alternating Daily Doses (e.g. 3 days higher, 4 days lower)
      // Solve: 3 * d1 + 4 * d2 = targetTWD OR 4 * d1 + 3 * d2 = targetTWD
      const possibleDailyDoses = [];
      strengths.forEach(s => {
        possibleDailyDoses.push(s);
        if (allowHalf) possibleDailyDoses.push(s / 2);
      });
      // add combinations of single strengths
      strengths.forEach(s1 => {
        strengths.forEach(s2 => {
          if (s1 === s2) {
            possibleDailyDoses.push(s1 + s2);
            if (allowHalf) possibleDailyDoses.push(s1 + s2 / 2);
          }
        });
      });
      const uniqueDoses = [...new Set(possibleDailyDoses)].sort((a, b) => a - b);

      for (let i = 0; i < uniqueDoses.length; i++) {
        for (let j = i; j < uniqueDoses.length; j++) {
          const d1 = uniqueDoses[i];
          const d2 = uniqueDoses[j];
          if (Math.abs(d2 - d1) > 2.5) continue; // avoid large jump > 2.5 mg

          // Test (4 days d1, 3 days d2)
          [ [4, 3], [3, 4], [5, 2], [2, 5] ].forEach(([count1, count2]) => {
            const sumTWD = (count1 * d1) + (count2 * d2);
            if (Math.abs(sumTWD - targetTWD) <= 0.5) {
              const decomp1 = decomposeDoseToTablets(d1, strengths, allowHalf);
              const decomp2 = decomposeDoseToTablets(d2, strengths, allowHalf);
              if (decomp1 && decomp2) {
                // Interleave schedule
                const daily = [];
                let c1 = count1, c2 = count2;
                for (let k = 0; k < 7; k++) {
                  if (k % 2 === 0 && c1 > 0) { daily.push(d1); c1--; }
                  else if (c2 > 0) { daily.push(d2); c2--; }
                  else { daily.push(d1); c1--; }
                }

                const strengthsUsed = new Set([
                  ...decomp1.map(x => x.strength),
                  ...decomp2.map(x => x.strength)
                ]);

                if (strengthsUsed.size <= 2) { // max 2 strengths
                  candidates.push({
                    name: `สูตรสลับ: ${d2} mg (${count2} วัน) / ${d1} mg (${count1} วัน)`,
                    tag: strengthsUsed.size === 1 ? 'ใช้ยาความแรงเดียว' : 'สลับขนาดใกล้เคียงกัน',
                    twd: sumTWD,
                    diff: Math.abs(sumTWD - targetTWD),
                    dailyDoses: daily,
                    dailyDetails: daily.map(d => ({
                      dose: d,
                      tablets: d === d1 ? decomp1 : decomp2
                    })),
                    usedStrengths: strengthsUsed.size,
                    halfDays: (decomp1.some(x => x.tablets % 1 !== 0) ? count1 : 0) +
                              (decomp2.some(x => x.tablets % 1 !== 0) ? count2 : 0)
                  });
                }
              }
            }
          });
        }
      }

      // Deduplicate & sort by quality: Exact TWD match, fewer strengths, fewer half-tabs
      const unique = [];
      const seen = new Set();
      candidates.sort((a, b) => {
        if (a.diff !== b.diff) return a.diff - b.diff;
        if (a.usedStrengths !== b.usedStrengths) return a.usedStrengths - b.usedStrengths;
        return a.halfDays - b.halfDays;
      });

      candidates.forEach(c => {
        const key = c.dailyDoses.join('-');
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(c);
        }
      });

      return unique.slice(0, 3);
    }

    /* -------------------------------------------------------------------------
       3. PHARMACY DISPENSING CALCULATION (Integer Ceiling for Hospital Inventory)
       ------------------------------------------------------------------------- */
    function calculateHospitalDispense(dailyDetails, daysSupply) {
      if (!dailyDetails || !dailyDetails.length) return null;
      const usageMap = {};

      for (let day = 0; day < daysSupply; day++) {
        const dayPlan = dailyDetails[day % 7];
        (dayPlan.tablets || []).forEach(t => {
          usageMap[t.strength] = (usageMap[t.strength] || 0) + t.tablets;
        });
      }

      const rows = Object.keys(usageMap).map(s => {
        const str = Number(s);
        const exact = usageMap[str];
        const dispenseTablets = Math.ceil(exact); // Round up to whole tablet!
        const spareHalves = Math.round((dispenseTablets - exact) * 2);
        return {
          strength: str,
          exactUnits: exact,
          dispenseTablets: dispenseTablets,
          spareHalves: spareHalves
        };
      }).sort((a, b) => a.strength - b.strength);

      return {
        daysSupply,
        rows
      };
    }

    /* -------------------------------------------------------------------------
       4. TTR ANALYZER ENGINE (Rosendaal Linear Interpolation Method)
       ------------------------------------------------------------------------- */
    function calculateTTRRosendaal(records, targetMin, targetMax) {
      if (!records || records.length < 2) {
        return { ttrPct: 0, inRangeDays: 0, totalDays: 0, directVisitPct: 0 };
      }

      // Sort records by date
      const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
      let totalDays = 0;
      let inRangeDays = 0.0;
      let inRangeVisits = 0;

      sorted.forEach(r => {
        if (r.inr >= targetMin && r.inr <= targetMax) inRangeVisits++;
      });
      const directVisitPct = Math.round((inRangeVisits / sorted.length) * 100);

      for (let i = 0; i < sorted.length - 1; i++) {
        const d1 = new Date(sorted[i].date);
        const d2 = new Date(sorted[i + 1].date);
        const inr1 = Number(sorted[i].inr);
        const inr2 = Number(sorted[i + 1].inr);

        const diffTime = d2.getTime() - d1.getTime();
        const intervalDays = Math.round(diffTime / (1000 * 3600 * 24));

        // Guidelines suggest ignoring intervals > 90 days or treating separately
        if (intervalDays <= 0 || intervalDays > 90) continue;

        totalDays += intervalDays;

        if (inr1 === inr2) {
          if (inr1 >= targetMin && inr1 <= targetMax) {
            inRangeDays += intervalDays;
          }
        } else {
          const slope = (inr2 - inr1) / intervalDays;
          for (let day = 0; day < intervalDays; day++) {
            const dayINR = inr1 + slope * (day + 0.5); // mid-day estimate
            if (dayINR >= targetMin && dayINR <= targetMax) {
              inRangeDays += 1.0;
            }
          }
        }
      }

      const ttrPct = totalDays > 0 ? Math.round((inRangeDays / totalDays) * 1000) / 10 : 0;

      return {
        ttrPct,
        inRangeDays: Math.round(inRangeDays),
        totalDays,
        directVisitPct
      };
    }

    /* -------------------------------------------------------------------------
       5. UI CONTROLLER & RENDERING LOGIC
       ------------------------------------------------------------------------- */
    const UI = {
      init() {
        this.bindEvents();
        this.syncDates();
        this.renderTTRTable();
      },

      syncDates() {
        const today = new Date();
        document.getElementById('startDate').value = today.toISOString().split('T')[0];
        const nextMonth = new Date(today.getTime() + (28 * 86400000));
        document.getElementById('followUpDate').value = nextMonth.toISOString().split('T')[0];
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

        // Print header button
        document.getElementById('printHeaderBtn').addEventListener('click', () => {
          window.print();
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
        // Read form values
        const inr = Number(document.getElementById('currentINR').value);
        const currentTWD = Number(document.getElementById('currentWeeklyDose').value);
        let targetTWD = Number(document.getElementById('targetWeeklyDose').value);

        if (!inr || !currentTWD) {
          alert('กรุณากรอกค่า INR และขนาดยาเดิม (mg/สัปดาห์)');
          return;
        }

        const modifiers = {
          bleedingStatus: document.getElementById('bleedingStatus').value,
          missedDoses: Number(document.getElementById('missedDoses').value),
          drugInteraction: document.getElementById('drugInteraction').value,
          dietChange: document.getElementById('dietChange').value
        };

        // Get target range
        let targetMin = appState.targetRange.min;
        let targetMax = appState.targetRange.max;
        if (appState.indication === 'custom') {
          targetMin = Number(document.getElementById('customMinINR').value) || 2.0;
          targetMax = Number(document.getElementById('customMaxINR').value) || 3.0;
        }

        // Evaluate clinical rule engine
        const rec = evaluateClinicalGuideline(inr, currentTWD, targetMin, targetMax, modifiers);
        appState.recommendation = rec;

        // Auto-fill target TWD if not manually overridden
        if (!targetTWD || isNaN(targetTWD)) {
          targetTWD = rec.suggestedTWD;
          document.getElementById('targetWeeklyDose').value = targetTWD;
        }
        appState.targetWeeklyDose = targetTWD;

        // Read strengths
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

        // Generate Candidates
        if (rec.canAutoGenerate) {
          appState.regimenCandidates = generateRegimens(targetTWD, strengths, appState.allowHalfTabs, appState.startDayIdx);
        } else {
          appState.regimenCandidates = [];
        }

        appState.selectedCandidateIdx = 0;

        // Render UI
        this.renderMetrics(currentTWD, targetTWD, rec);
        this.renderClinicalAlert(rec);
        this.renderAcuteTransition(rec, currentTWD);
        this.renderRegimenCandidates();
        this.renderSelectedRegimen();
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

        container.innerHTML = `
          <div class="clinical-alert ${rec.urgency}">
            <div class="alert-icon">${icon}</div>
            <div class="alert-content">
              <h4>${rec.actionTitle}</h4>
              <p>${rec.actionDescription}</p>
              ${rec.messages.length ? `<ul>${rec.messages.map(m => `<li>${m}</li>`).join('')}</ul>` : ''}
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

        // Card select click
        grid.querySelectorAll('.candidate-card').forEach(card => {
          card.addEventListener('click', () => {
            appState.selectedCandidateIdx = Number(card.dataset.idx);
            UI.renderRegimenCandidates();
            UI.renderSelectedRegimen();
            UI.renderDispense();
            UI.generateEMRNote();
          });
        });
      },

      renderSelectedRegimen() {
        const detailsContainer = document.getElementById('selectedRegimenDetails');
        const selected = appState.regimenCandidates[appState.selectedCandidateIdx];
        if (!selected) {
          detailsContainer.style.display = 'none';
          return;
        }
        detailsContainer.style.display = 'block';

        const tbody = document.getElementById('weeklyScheduleTbody');
        const startDay = appState.startDayIdx; // 0=Mon
        
        tbody.innerHTML = selected.dailyDetails.map((item, idx) => {
          const dayNameIdx = (startDay + idx) % 7;
          const dayName = DAY_NAMES_TH[dayNameIdx];
          
          const pillText = item.tablets.map(t => {
            const countStr = (t.tablets === 0.5) ? 'ครึ่งเม็ด (½)' : `${t.tablets} เม็ด`;
            return `Warfarin ${t.strength} mg: ${countStr}`;
          }).join(', ') || 'หยุดยา (0 mg)';

          const pillIcons = item.tablets.map(t => {
            return `<span class="pill-badge pill-${t.strength}">${t.tablets === 0.5 ? '½' : t.tablets} × ${t.strength}mg</span>`;
          }).join('') || '<span class="pill-badge pill-hold">Hold (0 mg)</span>';

          return `
            <tr>
              <td class="day-name">วัน${dayName}</td>
              <td style="font-weight: 700;">${item.dose} mg</td>
              <td style="text-align: left;">${pillText}</td>
              <td>${pillIcons}</td>
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

        // Bind input updates
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

    // Initialize Application
    window.addEventListener('DOMContentLoaded', () => {
      UI.init();
    });
  