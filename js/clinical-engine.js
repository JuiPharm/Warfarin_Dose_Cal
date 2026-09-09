/**
 * Warfarin Clinic Pro - Pure Clinical Computation Engine
 * Conforms to CHEST Guidelines & Thai Heart Association Warfarin Guidelines
 * Verified by Clinical Pharmacist & Senior Web App Developer
 */

const INDICATIONS = {
  af: { label: 'Atrial Fibrillation / VTE Prophylaxis', min: 2.0, max: 3.0 },
  vte: { label: 'DVT / Pulmonary Embolism Treatment', min: 2.0, max: 3.0 },
  mech_avr: { label: 'Mechanical Aortic Valve (Low risk)', min: 2.0, max: 3.0 },
  mech_mvr: { label: 'Mechanical Mitral Valve / High Risk', min: 2.5, max: 3.5 },
  aps: { label: 'Antiphospholipid Syndrome (APS)', min: 2.5, max: 3.5 },
  custom: { label: 'Custom Range', min: 2.0, max: 3.0 }
};

const DAY_NAMES_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Evaluates INR against guideline rules and returns clinical recommendations
 */
function evaluateClinicalGuideline(inr, currentTWD, targetMin, targetMax, modifiers = {}, indication = 'af') {
  const res = {
    urgency: 'info', // 'danger', 'warning', 'success', 'info'
    percentAdjustment: 0,
    suggestedTWD: currentTWD,
    acuteHoldDays: 0,
    boosterMg: 0,
    actionTitle: 'คงขนาดยาเดิม (Maintain Current Dose)',
    actionDescription: 'ระดับ INR อยู่ในช่วงเป้าหมายที่ต้องการ',
    messages: [],
    canAutoGenerate: true,
    vitaminK: null,
    bloodProduct: null,
    monitoring: null
  };

  if (!inr || inr <= 0 || !currentTWD || currentTWD <= 0) {
    res.messages.push('กรุณาระบุค่า INR และขนาดยาเดิมเพื่อประเมิน');
    return res;
  }

  const isHighBleedingRisk = (modifiers.highBleedingRisk === true || modifiers.highBleedingRisk === 'true');

  // =========================================================================
  // RULE 1: Major / Life-Threatening Bleeding (ระดับ INR ใดๆ)
  // =========================================================================
  if (modifiers.bleedingStatus === 'major') {
    res.urgency = 'danger';
    res.canAutoGenerate = false;
    res.acuteHoldDays = 2;
    res.actionTitle = '🚨 เลือดออกรุนแรง / วิกฤตคุกคามชีวิต (Major Bleeding) - ฉุกเฉิน';
    res.actionDescription = 'หยุดยา Warfarin ทันที และส่งตัวพบแพทย์/ห้องฉุกเฉินด่วน เพื่อให้ IV Vitamin K1 ร่วมกับ 4-Factor PCC หรือ FFP';
    res.messages.push('มีภาวะเลือดออกรุนแรง: ต้องหยุดยา Warfarin ทันที และรับการรักษาฉุกเฉินในโรงพยาบาล');
    
    res.vitaminK = {
      needed: true,
      dose: '10 mg',
      route: 'Slow IV Infusion',
      duration: 'อย่างน้อย 30 นาที',
      rationale: 'แก้ไขการขาด Clotting Factors อย่างเร่งด่วนเพื่อหยุดภาวะเลือดออกวิกฤต',
      warning: '⚠️ ต้องผสมสารน้ำหยดช้าๆ อย่างน้อย 30 นาที เพื่อป้องกันปฏิกิริยาแพ้รุนแรง (Anaphylaxis/Hypotension) | ❌ ห้ามฉีด IM หรือ SC เด็ดขาด (ดูดซึมไม่แน่นอนและเสี่ยง Hematoma)'
    };

    res.bloodProduct = {
      needed: true,
      primary: '4-Factor PCC (25–50 IU/kg IV Direct / Infusion)',
      alternative: 'FFP (15 mL/kg หรือ 2–4 units) หากไม่มี PCC',
      details: 'First-line Agent: 4-Factor PCC ออกฤทธิ์ทันที (15–30 นาที) มี Factors II, VII, IX, X เข้มข้น ปริมาตรสารน้ำน้อย | Second-line: FFP (ระวังภาวะน้ำเกิน Fluid Overload)'
    };

    res.monitoring = {
      recheckTimeline: 'เจาะ INR ซ้ำใน 30 นาที (หลังให้ 4F-PCC) หรือติดตามทุก 12 ชม. (หากให้ FFP)',
      actionOnRecheck: 'สามารถพิจารณาให้ IV Vitamin K1 10 mg ซ้ำได้ทุก 12 ชม. ตามอาการทางคลินิก'
    };
    return res;
  }

  // =========================================================================
  // RULE 2: INR >= 9.0 (ไม่มีเลือดออกรุนแรง)
  // =========================================================================
  if (inr >= 9.0) {
    res.urgency = 'danger';
    res.acuteHoldDays = 2;
    res.percentAdjustment = -20;
    res.suggestedTWD = Math.round(currentTWD * 0.80 * 2) / 2;
    res.actionTitle = '⚠️ INR วิกฤต (INR ≥ 9.0) - เสี่ยงเลือดออกสูงมาก';
    res.actionDescription = 'งดยา Warfarin ชั่วคราว (1–2 วัน) และให้ Oral Vitamin K1: 2.5 – 5.0 mg รับประทาน 1 ครั้ง';
    res.messages.push('ค่า INR ≥ 9.0 เสี่ยงต่อการมีเลือดออกรุนแรง ต้องงดยาและให้ Oral Vitamin K1 ทันที');
    
    res.vitaminK = {
      needed: true,
      dose: '2.5 – 5.0 mg',
      route: 'Oral (รับประทาน)',
      duration: 'ทาน 1 ครั้ง',
      rationale: 'ลดระดับ INR อย่างปลอดภัย หลีกเลี่ยงการใช้ขนาดสูงเกินไปเพื่อป้องกันภาวะดื้อยาวาร์ฟาริน (Warfarin Resistance) เมื่อเริ่มยาใหม่',
      warning: 'Onset: 8–24 ชม., Peak: 24 ชม. เป็นเส้นทางที่ปลอดภัยที่สุด'
    };

    res.bloodProduct = {
      needed: false,
      primary: 'ไม่ต้องให้ (No Blood Product Indicated)',
      alternative: '-',
      details: 'ไม่มีภาวะเลือดออกรุนแรง ไม่จำเป็นต้องให้สารทดแทน Clotting Factors'
    };

    res.monitoring = {
      recheckTimeline: 'ตรวจ INR ซ้ำใน 24 ชั่วโมง',
      actionOnRecheck: 'หาก INR ยังคงสูงต่อเนื่อง พิจารณาให้ Oral Vitamin K1 ซ้ำ 1.0 – 2.0 mg จากนั้นเมื่อ INR เข้าสู่เป้าหมาย ให้เริ่มยาใหม่โดยปรับลด TWD ลง 10%–20%'
    };
    return res;
  }

  // =========================================================================
  // RULE 3: INR 5.0 – 8.9 (ไม่มีเลือดออกรุนแรง)
  // =========================================================================
  if (inr >= 5.0) {
    res.urgency = 'warning';
    res.acuteHoldDays = (inr >= 6.0) ? 2 : 1;
    res.percentAdjustment = -15; // 10-20%
    res.suggestedTWD = Math.round(currentTWD * 0.85 * 2) / 2;

    if (isHighBleedingRisk) {
      res.actionTitle = `งดยา ${res.acuteHoldDays} มื้อ + Oral Vitamin K1 (1.0 – 2.5 mg) ในผู้ป่วยเสี่ยงเลือดออกสูง`;
      res.actionDescription = `งดยา Warfarin ${res.acuteHoldDays} มื้อ ให้ Oral Vitamin K1 1.0–2.5 mg ทาน 1 ครั้ง และนัดตรวจ INR ซ้ำใน 24–48 ชม.`;
      res.messages.push(`INR ${inr} ร่วมกับมีปัจจัยเสี่ยงเลือดออกสูง (High Bleeding Risk): แนะนำให้ Oral Vitamin K1 ขนาดต่ำเพื่อความปลอดภัย`);

      res.vitaminK = {
        needed: true,
        dose: '1.0 – 2.5 mg',
        route: 'Oral (รับประทาน)',
        duration: 'ทาน 1 ครั้ง',
        rationale: 'สำหรับผู้ป่วยที่มีปัจจัยเสี่ยงเลือดออกสูง (อายุ ≥ 65 ปี, ประวัติ GI bleed, eGFR < 30, ใช้ antiplatelet/NSAIDs ร่วม)',
        warning: 'เป็นเส้นทางที่ปลอดภัยที่สุด หลีกเลี่ยงขนาดยาสูงเพื่อป้องกัน Warfarin Resistance'
      };
      res.bloodProduct = {
        needed: false,
        primary: 'ไม่ต้องให้',
        alternative: '-',
        details: 'ไม่มีภาวะเลือดออกรุนแรง ไม่ต้องให้ Blood Products'
      };
      res.monitoring = {
        recheckTimeline: 'ตรวจ INR ซ้ำใน 24 – 48 ชั่วโมง',
        actionOnRecheck: 'เมื่อ INR เข้าสู่เป้าหมาย ให้เริ่มยาใหม่โดยปรับลดขนาดยารายสัปดาห์ (TWD) ลง 10% – 20%'
      };
    } else {
      res.actionTitle = `งดยา ${res.acuteHoldDays} มื้อ (ไม่ต้องให้ Vitamin K1 ในผู้ป่วยเสี่ยงต่ำ)`;
      res.actionDescription = `งดยา Warfarin ${res.acuteHoldDays} มื้อ ไม่จำเป็นต้องให้ Vitamin K1 ติดตาม INR จนเข้าเป้าหมาย แล้วเริ่มยาใหม่โดยลด TWD ลง 10%–20%`;
      res.messages.push(`INR ${inr} (ผู้ป่วยเสี่ยงต่ำ): การงดยาเพียงอย่างเดียวเพียงพอให้ INR ลดลงเอง ป้องกันภาวะดื้อยาวาร์ฟาริน`);

      res.vitaminK = {
        needed: false,
        dose: 'ไม่ต้องให้ (No Vitamin K1)',
        route: '-',
        duration: '-',
        rationale: 'ผู้ป่วยความเสี่ยงเลือดออกต่ำ การงดยา 1–2 มื้อจะทำให้ระดับ INR ค่อยๆ ลดลงอย่างปลอดภัย การให้ Vitamin K1 อาจทำให้ INR ตกฮวบและดื้อยาวาร์ฟารินเมื่อเริ่มใหม่',
        warning: 'หากมีอาการเลือดออกผิดปกติให้มาพบแพทย์ทันที'
      };
      res.bloodProduct = {
        needed: false,
        primary: 'ไม่ต้องให้',
        alternative: '-',
        details: 'ไม่มีภาวะเลือดออกรุนแรง ไม่ต้องให้ Blood Products'
      };
      res.monitoring = {
        recheckTimeline: 'ตรวจติดตาม INR ซ้ำใน 3 – 5 วัน (หรือจนเข้าเป้าหมาย)',
        actionOnRecheck: 'เมื่อระดับ INR เข้าสู่เป้าหมายแล้ว ให้เริ่มยาใหม่โดยปรับลดขนาดยารายสัปดาห์ (TWD) ลง 10% – 20%'
      };
    }
    return res;
  }

  // =========================================================================
  // RULE 4: Modifiers - Missed Doses Logic
  // =========================================================================
  if (modifiers.missedDoses >= 1 && inr < targetMin) {
    res.urgency = 'warning';
    res.percentAdjustment = 0; // Strictly NO dose increase!
    res.suggestedTWD = currentTWD;
    res.actionTitle = 'คงขนาดยาเดิม (ห้ามเพิ่มยาเนื่องจากลืมทานยา)';
    res.actionDescription = `ผู้ป่วยลืมทานยา ${modifiers.missedDoses} วันในสัปดาห์ที่ผ่านมา INR ที่ต่ำเกิดจากการขาดยา ไม่ใช่ความดื้อยา`;
    res.messages.push('เน้นย้ำความสม่ำเสมอในการรับประทานยา และนัดตรวจติดตามซ้ำใน 1-2 สัปดาห์');
    return res;
  }

  // =========================================================================
  // RULE 5: Standard Target Bands
  // =========================================================================
  if (inr < targetMin - 0.5) { // e.g. < 1.5
    res.percentAdjustment = 15; // 10-20%
    res.suggestedTWD = Math.round(currentTWD * 1.15 * 2) / 2;
    res.actionTitle = 'ปรับเพิ่มขนาดยารายสัปดาห์ขึ้น 10% – 20% (เฉลี่ย +15%)';
    res.actionDescription = 'INR ต่ำกว่าเป้าหมายชัดเจน ปรับเพิ่มขนาดยา และหาสาเหตุ (อาหาร, ยาตีกัน)';
    if (indication === 'mech_mvr' || indication === 'aps') {
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
  } else { // targetMax + 0.5 < inr < 5.0 (e.g. 3.6 - 4.9)
    res.percentAdjustment = -12.5; // -10% to -15%
    res.suggestedTWD = Math.round(currentTWD * 0.875 * 2) / 2;
    res.acuteHoldDays = 1;
    res.actionTitle = 'หยุดยา 1 วัน แล้วปรับลดขนาดยารายสัปดาห์ลง 10% – 15%';
    res.actionDescription = 'หยุดยา Warfarin วันแรก 1 วัน จากนั้นรับประทานตามสูตรใหม่';
  }

  // Modifiers Notes
  if (modifiers.drugInteraction === 'cyp_inhibitor') {
    res.messages.push('⚠️ มีการเริ่มยา CYP Inhibitor: ระดับ Warfarin ในเลือดจะสูงขึ้น ควรพิจารณาเจาะ INR เร็วกว่าปกติใน 3-5 วัน');
  } else if (modifiers.drugInteraction === 'cyp_inducer') {
    res.messages.push('⚠️ มีการเริ่มยา CYP Inducer: ระดับ Warfarin ในเลือดจะลดลง อาจต้องปรับเพิ่มยาตามผลเลือด');
  } else if (modifiers.drugInteraction === 'nsaids') {
    res.messages.push('🚨 ผู้ป่วยใช้ NSAIDs/Antiplatelet: เพิ่มความเสี่ยงเลือดออกทางเดินอาหารอย่างมีนัยสำคัญ ควรหลีกเลี่ยงหรือให้ Gastroprotection (PPI)');
  }

  return res;
}

/**
 * Decompose a daily dose into tablet pieces (preferring single strength, minimal half tabs)
 */
function decomposeDoseToTablets(dailyDose, strengths, allowHalf) {
  if (dailyDose === 0) return [];
  const validStrengths = [...strengths].sort((a, b) => b - a);
  let bestCombination = null;
  let lowestScore = Infinity;

  const pieces = [];
  validStrengths.forEach(s => {
    pieces.push({ value: s, strength: s, count: 1 });
    if (allowHalf) pieces.push({ value: s / 2, strength: s, count: 0.5 });
  });

  function search(idx, remaining, chosen) {
    if (Math.abs(remaining) < 0.001) {
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

    const piece = pieces[idx];
    const maxTake = Math.min(3, Math.floor((remaining + 0.001) / piece.value));
    for (let t = maxTake; t >= 0; t--) {
      for (let i = 0; i < t; i++) chosen.push(piece);
      search(idx + 1, remaining - (t * piece.value), chosen);
      for (let i = 0; i < t; i++) chosen.pop();
    }
  }

  search(0, dailyDose, []);

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

/**
 * Generates 3 candidate regimens optimizing for patient simplicity and adherence
 */
function generateRegimens(targetTWD, strengths, allowHalf, startDayIdx) {
  const candidates = [];
  const targetDailyAvg = targetTWD / 7;

  // 1. Equal Daily Dose
  const roundedDaily = Math.round(targetDailyAvg * 2) / 2;
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

  // 2. Alternating Doses
  const possibleDailyDoses = [];
  strengths.forEach(s => {
    possibleDailyDoses.push(s);
    if (allowHalf) possibleDailyDoses.push(s / 2);
  });
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
      if (Math.abs(d2 - d1) > 2.5) continue;

      [ [4, 3], [3, 4], [5, 2], [2, 5] ].forEach(([count1, count2]) => {
        const sumTWD = (count1 * d1) + (count2 * d2);
        if (Math.abs(sumTWD - targetTWD) <= 0.5) {
          const decomp1 = decomposeDoseToTablets(d1, strengths, allowHalf);
          const decomp2 = decomposeDoseToTablets(d2, strengths, allowHalf);
          if (decomp1 && decomp2) {
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

            if (strengthsUsed.size <= 2) {
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

/**
 * Calculates hospital pharmacy dispensing with integer rounding up
 */
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
    const dispenseTablets = Math.ceil(exact);
    const spareHalves = Math.round((dispenseTablets - exact) * 2);
    return {
      strength: str,
      exactUnits: exact,
      dispenseTablets: dispenseTablets,
      spareHalves: spareHalves
    };
  }).sort((a, b) => a.strength - b.strength);

  return { daysSupply, rows };
}

/**
 * Calculates Time in Therapeutic Range (TTR) using the Rosendaal Linear Interpolation Method
 */
function calculateTTRRosendaal(records, targetMin, targetMax) {
  if (!records || records.length < 2) {
    return { ttrPct: 0, inRangeDays: 0, totalDays: 0, directVisitPct: 0 };
  }

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

    if (intervalDays <= 0 || intervalDays > 90) continue;

    totalDays += intervalDays;

    if (inr1 === inr2) {
      if (inr1 >= targetMin && inr1 <= targetMax) {
        inRangeDays += intervalDays;
      }
    } else {
      const slope = (inr2 - inr1) / intervalDays;
      for (let day = 0; day < intervalDays; day++) {
        const dayINR = inr1 + slope * (day + 0.5);
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


/**
 * Builds full day-by-day medication schedule with date projection and acute hold handling
 */
function buildFullMedicationSchedule(dailyDetails, daysSupply, startDateStr, acuteHoldDays = 0) {
  if (!dailyDetails || !dailyDetails.length) return [];
  const baseDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();
  const rows = [];
  
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  for (let i = 0; i < daysSupply; i++) {
    const curDate = new Date(baseDate.getTime() + (i * 86400000));
    const day = curDate.getDate();
    const month = thaiMonths[curDate.getMonth()];
    const year = curDate.getFullYear() + 543; // Buddhist Era
    const weekdayIdx = (curDate.getDay() + 6) % 7; // 0=Mon, 6=Sun
    const weekdayName = DAY_NAMES_TH[weekdayIdx];

    const isHold = (i < acuteHoldDays);
    let dose = 0;
    let tablets = [];
    let note = '';

    if (isHold) {
      dose = 0;
      tablets = [];
      note = '🛑 หยุดรับประทานยา (HOLD WARFARIN 0 mg)';
    } else {
      const planDay = dailyDetails[i % 7];
      dose = planDay.dose;
      tablets = planDay.tablets || [];
      const parts = tablets.map(t => {
        const countStr = (t.tablets === 0.5) ? 'ครึ่งเม็ด (½)' : `${t.tablets} เม็ด`;
        return `Warfarin ${t.strength} mg: ${countStr}`;
      });
      note = parts.join(', ') || '0 mg';
    }

    rows.append ? null : rows.push({
      dayIndex: i + 1,
      dateObj: curDate,
      dateLabel: `${day} ${month} ${year.toString().slice(-2)}`,
      weekdayName: `วัน${weekdayName}`,
      weekdayIdx: weekdayIdx,
      dose: dose,
      tablets: tablets,
      isHold: isHold,
      note: note
    });
  }

  return rows;
}


/**
 * Helper to get color code for tablet strength
 */
function getStrengthHexColor(strength) {
  if (strength === 2) return '#ef8d2f'; // Orange/Purple
  if (strength === 3) return '#175da8'; // Blue
  if (strength === 5) return '#e24a93'; // Pink
  return '#1e40af';
}

function getStrengthColor(strength) {
  return getStrengthHexColor(strength);
}

/**
 * Renders authentic vector SVG pill icons with crystal-clear half-split (½) support
 * Vector SVGs are guaranteed to print on all printers (even if print background graphics is off!)
 */
function renderPillVisual(tablets) {
  if (!tablets || !tablets.length) {
    return '<span style="color:#64748b; font-size:0.75rem;">(0 mg)</span>';
  }
  let html = '<div class="pill-group-cell">';
  tablets.forEach(t => {
    if (t.tablets <= 0) return;
    const full = Math.floor(t.tablets);
    const hasHalf = Math.abs(t.tablets - full) >= 0.49;
    const color = getStrengthHexColor(t.strength);

    // 1. Full Tablets
    for (let i = 0; i < full; i++) {
      html += `<span class="pill-wrapper full" title="Warfarin ${t.strength} mg เต็มเม็ด (1 เม็ด)">` +
        `<svg class="pill-svg full" viewBox="0 0 24 24" width="24" height="24" style="vertical-align:middle; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15));">` +
        `<circle cx="12" cy="12" r="9.5" fill="${color}" stroke="${color}" stroke-width="1.5"/>` +
        `<line x1="12" y1="3.5" x2="12" y2="20.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.75"/>` +
        `</svg></span>`;
    }
    // 2. Half Tablet (ครึ่งเม็ด) - Explicit colored half, score line, and '½' mark
    if (hasHalf) {
      html += `<span class="pill-wrapper half" title="Warfarin ${t.strength} mg ครึ่งเม็ด (½ เม็ด)">` +
        `<svg class="pill-svg half" viewBox="0 0 24 24" width="24" height="24" style="vertical-align:middle; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15));">` +
        `<circle cx="12" cy="12" r="9.5" fill="#ffffff" stroke="${color}" stroke-width="2"/>` +
        `<path d="M 12,2.5 A 9.5,9.5 0 0,0 12,21.5 Z" fill="${color}"/>` +
        `<line x1="12" y1="2.5" x2="12" y2="21.5" stroke="#1e293b" stroke-width="1.5"/>` +
        `<text x="16.5" y="15" font-size="7.5" font-weight="900" fill="${color}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">½</text>` +
        `</svg></span>`;
    }
  });
  html += '</div>';
  return html;
}

function renderHoldPillVisual() {
  return `<span class="pill-wrapper hold" title="หยุดยา (HOLD 0 mg)">` +
    `<svg class="pill-svg hold" viewBox="0 0 24 24" width="24" height="24" style="vertical-align:middle;">` +
    `<circle cx="12" cy="12" r="9.5" fill="#fee2e2" stroke="#dc2626" stroke-width="2" stroke-dasharray="3,2"/>` +
    `<line x1="7" y1="7" x2="17" y2="17" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>` +
    `<line x1="17" y1="7" x2="7" y2="17" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>` +
    `</svg></span>`;
}

/**
 * Generates structured calendar sets organized by actual calendar months
 */
function generateMonthlyCalendars(startDateStr, daysSupply, dailyDetails, acuteHoldDays = 0) {
  if (!dailyDetails || !dailyDetails.length || daysSupply <= 0) return [];
  const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();
  const endDate = new Date(startDate.getTime() + ((daysSupply - 1) * 86400000));

  // Build treatment map: 'YYYY-MM-DD' -> { dose, tablets, isHold, note }
  const treatmentMap = {};
  for (let i = 0; i < daysSupply; i++) {
    const curDate = new Date(startDate.getTime() + (i * 86400000));
    const dKey = curDate.toISOString().split('T')[0];
    const isHold = (i < acuteHoldDays);

    if (isHold) {
      treatmentMap[dKey] = {
        dose: 0,
        tablets: [],
        isHold: true,
        note: '🛑 หยุดยา (HOLD 0 mg)'
      };
    } else {
      const planDay = dailyDetails[i % 7];
      const tStrs = (planDay.tablets || []).map(t => {
        const cnt = (t.tablets === 0.5) ? 'ครึ่งเม็ด (½)' : `${t.tablets} เม็ด`;
        return `${t.strength}mg: ${cnt}`;
      });
      treatmentMap[dKey] = {
        dose: planDay.dose,
        tablets: planDay.tablets || [],
        isHold: false,
        note: tStrs.join(' + ') || '0 mg'
      };
    }
  }

  // Find all distinct year-months
  const months = [];
  let curY = startDate.getFullYear();
  let curM = startDate.getMonth(); // 0-11
  const endY = endDate.getFullYear();
  const endM = endDate.getMonth();

  while ((curY < endY) || (curY === endY && curM <= endM)) {
    months.push({ year: curY, month: curM });
    curM++;
    if (curM > 11) {
      curM = 0;
      curY++;
    }
  }

  const thaiMonthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const englishMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const resultMonths = [];

  months.forEach(({ year, month }) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();

    // In JS: getDay() 0=Sun, 1=Mon, ..., 6=Sat
    // Convert to Monday=0, ..., Saturday=5, Sunday=6
    const firstWeekdayIdx = (firstDay.getDay() + 6) % 7;

    const cells = [];
    // 1. Pre-padding cells
    for (let p = 0; p < firstWeekdayIdx; p++) {
      cells.push({ type: 'empty' });
    }

    // 2. Days of this month
    let activeDaysInMonth = 0;
    for (let day = 1; day <= numDays; day++) {
      const dObj = new Date(year, month, day);
      const dKey = dObj.toISOString().split('T')[0];
      const weekdayIdx = (dObj.getDay() + 6) % 7;
      const isWeekend = (weekdayIdx === 5 || weekdayIdx === 6); // Sat or Sun

      if (treatmentMap[dKey]) {
        activeDaysInMonth++;
        const info = treatmentMap[dKey];
        cells.push({
          type: 'active',
          day: day,
          dateStr: dKey,
          weekdayIdx: weekdayIdx,
          isWeekend: isWeekend,
          dose: info.dose,
          tablets: info.tablets,
          isHold: info.isHold,
          note: info.note
        });
      } else {
        cells.push({
          type: 'inactive',
          day: day,
          dateStr: dKey,
          weekdayIdx: weekdayIdx,
          isWeekend: isWeekend
        });
      }
    }

    // 3. Post-padding to complete the last 7-day row
    while (cells.length % 7 !== 0) {
      cells.push({ type: 'empty' });
    }

    const titleTH = `เดือน${thaiMonthNames[month]} พ.ศ. ${year + 543} (${englishMonthNames[month]} ${year})`;

    resultMonths.push({
      year,
      month,
      title: titleTH,
      activeDaysCount: activeDaysInMonth,
      cells: cells
    });
  });

  return resultMonths;
}

// =============================================================================
// CLINICAL REFERENCE DATA: VITAMIN K1, BLOOD PRODUCTS & REFACTOR COMPARISON
// =============================================================================

const CLINICAL_DECISION_MATRIX = [
  {
    condition: 'INR 5.0 – 8.9 (ไม่มีเลือดออกรุนแรง & เสี่ยงต่ำ)',
    inrBadge: '5.0 – 8.9',
    bleeding: 'ไม่มี (None)',
    riskLevel: 'ความเสี่ยงต่ำ (Low Risk)',
    warfarinAction: 'งดยา 1–2 มื้อ',
    vitKAction: 'ไม่ต้องให้ (No Vitamin K1)',
    bloodProducts: 'ไม่ต้องให้',
    monitoring: 'ติดตาม INR จนเข้าเป้าหมาย แล้วเริ่มยาใหม่โดยลด TWD ลง 10%–20%',
    statusClass: 'status-warning'
  },
  {
    condition: 'INR 5.0 – 8.9 (ไม่มีเลือดออกรุนแรง แต่เสี่ยงเลือดออกสูง)',
    inrBadge: '5.0 – 8.9',
    bleeding: 'ไม่มี (None)',
    riskLevel: 'ความเสี่ยงสูง (High Risk: อายุ ≥ 65, ประวัติ GI bleed, eGFR < 30, ใช้ antiplatelet)',
    warfarinAction: 'งดยา 1–2 มื้อ',
    vitKAction: 'Oral Vitamin K1: 1.0 – 2.5 mg (ทาน 1 ครั้ง)',
    bloodProducts: 'ไม่ต้องให้',
    monitoring: 'ตรวจ INR ซ้ำใน 24–48 ชม. แล้วปรับลด TWD ลง 10%–20%',
    statusClass: 'status-warning-high'
  },
  {
    condition: 'INR ≥ 9.0 (ไม่มีเลือดออกรุนแรง)',
    inrBadge: '≥ 9.0',
    bleeding: 'ไม่มี (None)',
    riskLevel: 'วิกฤต (Critical High INR)',
    warfarinAction: 'งดยาชั่วคราว (1–2 วัน)',
    vitKAction: 'Oral Vitamin K1: 2.5 – 5.0 mg (ทาน 1 ครั้ง)',
    bloodProducts: 'ไม่ต้องให้',
    monitoring: 'ตรวจ INR ซ้ำใน 24 ชม. หากยังสูงพิจารณาให้ oral Vit K1 ซ้ำ 1.0–2.0 mg',
    statusClass: 'status-danger'
  },
  {
    condition: 'Major / Life-Threatening Bleeding (ระดับ INR ใดๆ)',
    inrBadge: 'ระดับใดๆ (Any)',
    bleeding: 'เลือดออกรุนแรง / วิกฤตคุกคามชีวิต (Major Bleeding)',
    riskLevel: 'ฉุกเฉินสูงสุด (Life-Threatening)',
    warfarinAction: 'หยุดยาทันที (Stop Immediately)',
    vitKAction: 'IV Vitamin K1: 10 mg (Slow IV Infusion อย่างน้อย 30 นาที)',
    bloodProducts: '4-Factor PCC (25–50 IU/kg) หรือ FFP (15 mL/kg) หากไม่มี PCC',
    monitoring: 'เจาะ INR ซ้ำใน 30 นาที (หลัง PCC) หรือติดตามทุก 12 ชม. ให้ Vit K1 ซ้ำได้ทุก 12 ชม.',
    statusClass: 'status-critical'
  }
];

const PHARMACOLOGY_RULES = [
  {
    name: 'Oral Vitamin K1 (Phytonadione)',
    route: 'รับประทาน (PO)',
    routeType: 'oral',
    onset: '8 – 24 ชั่วโมง',
    peak: '24 ชั่วโมง',
    precautions: 'เป็นเส้นทางที่ปลอดภัยที่สุด หลีกเลี่ยงการใช้ขนาดสูงเกินไปเพื่อป้องกันภาวะดื้อยาวาร์ฟาริน (Warfarin Resistance) เมื่อเริ่มยาใหม่'
  },
  {
    name: 'IV Vitamin K1 (Phytonadione)',
    route: 'หยดเข้าทางหลอดเลือดดำช้าๆ (Slow IV Infusion)',
    routeType: 'iv',
    onset: '6 – 8 ชั่วโมง',
    peak: '12 – 24 ชั่วโมง',
    precautions: 'ต้องผสมสารน้ำหยดช้าๆ อย่างน้อย 30 นาที เพื่อป้องกันปฏิกิริยาแพ้รุนแรง (Anaphylaxis/Hypotension) | ❌ ห้ามฉีด IM หรือ SC เนื่องจากดูดซึมไม่แน่นอนและเสี่ยงต่อการเกิดก้อนเลือดอุดกั้น (Hematoma)'
  },
  {
    name: '4-Factor PCC (Prothrombin Complex Concentrate)',
    route: 'IV Direct / Infusion',
    routeType: 'pcc',
    onset: 'ทันที (ภายใน 15 – 30 นาที)',
    peak: 'ทันที',
    precautions: 'เป็น First-line Agent ในการแก้ไขภาวะเลือดออกวิกฤต เนื่องจากมีปริมาณ Clotting Factors II, VII, IX, X เข้มข้น และใช้ปริมาตรสารน้ำน้อย'
  },
  {
    name: 'FFP (Fresh Frozen Plasma)',
    route: 'IV Infusion',
    routeType: 'ffp',
    onset: 'ช้ากว่า PCC (ต้องใช้เวลาละลายและให้ปริมาตรมาก)',
    peak: 'หลายชั่วโมง',
    precautions: 'ใช้เป็น Second-line เมื่อไม่มี PCC | ขนาดบริหารมาตรฐาน 15 mL/kg หรือ 2–4 units | ระวังภาวะน้ำเกิน (Fluid Overload)'
  }
];

const CODE_REFACTOR_COMPARISON = [
  {
    domain: 'การคำนวณขนาดยาประจำสัปดาห์ (TWD Calculation)',
    legacy: 'นำขนาดยาที่สั่งหยุดชั่วคราว (Hold dose เช่น 5 mg) ไปลบออกจาก Total Weekly Dose (TWD) ถาวร',
    refactored: 'แยกสัปดาห์แรก (Acute Transition) ออกจากสัปดาห์ถัดไป (Maintenance Regimen) อย่างเด็ดขาด',
    clinicalImpact: 'ป้องกันภาวะผู้ป่วยได้รับยาต่ำกว่ามาตรฐานถาวร (Permanent Underdosing) ลดความเสี่ยงต่อการเกิดลิ่มเลือดอุดตันซ้ำ (Thromboembolism/Stroke)',
    badge: 'ความปลอดภัยสูง (Critical)'
  },
  {
    domain: 'การคำนวณ TTR (Rosendaal Interpolation)',
    legacy: 'คำนวณแบบ Simple Percentage (PINRR) หรือประมวลผลช่วงวันที่นัดเจาะผิดพลาดเมื่อวันนัดไม่สม่ำเสมอ',
    refactored: 'ใช้ Linear Interpolation ตามวิธี Rosendaal Method คำนวณตามจำนวนวันจริง (Person-Time)',
    clinicalImpact: 'ได้ค่า TTR ที่สะท้อนคุณภาพการควบคุมระดับยาที่แท้จริงตามมาตรฐานสากล (Target TTR ≥ 65% – 70%)',
    badge: 'มาตรฐานสากล (Gold Standard)'
  },
  {
    domain: 'การจัดการภาวะ INR สูงวิกฤต (High INR Crisis)',
    legacy: 'คำนวณเฉพาะการลดขนาดยา โดยไม่ได้ประเมินภาวะ Bleeding และปัจจัยเสี่ยงร่วม',
    refactored: 'ประมวลผล Rule-Based Engine ครอบคลุมทั้ง INR, Bleeding Severity, High Risk Factors และชนิดลิ้นหัวใจ',
    clinicalImpact: 'แนะนำการสั่งใช้อย่างถูกต้อง ทั้งชนิดขนาดยา (Oral/IV Vitamin K1) และสารทดแทน Blood Products ตาม Guideline',
    badge: 'แนวทาง CHEST / THA'
  },
  {
    domain: 'การจัดตารางเม็ดยา (Tablet Fractional Allocation)',
    legacy: 'กระจายเม็ดยาโดยอาจเกิดเศษยารายวันที่ไม่สามารถหักเม็ดได้จริง',
    refactored: 'คำนวณจับคู่ความแรงเม็ดยาที่มีจริง (2, 3, 5 mg) พร้อมรองรับการหักครึ่งเม็ด (0.5 เม็ด) และเกลี่ยขนาดยาลงตารางรายวันสม่ำเสมอ',
    clinicalImpact: 'ผู้ป่วยทานยาง่าย ไม่สับสน ลดความคลาดเคลื่อนทางยา (Medication Error)',
    badge: 'ความร่วมมือในการทานยา (Adherence)'
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    evaluateClinicalGuideline,
    decomposeDoseToTablets,
    generateRegimens,
    calculateHospitalDispense,
    calculateTTRRosendaal,
    buildFullMedicationSchedule,
    getStrengthColor,
    renderPillVisual,
    generateMonthlyCalendars,
    CLINICAL_DECISION_MATRIX,
    PHARMACOLOGY_RULES,
    CODE_REFACTOR_COMPARISON
  };
}
