# Warfarin Clinic Pro 💊🏥
**ระบบคำนวณขนาดยา ปรับตารางยา และประเมิน TTR ตามมาตรฐานวิชาชีพเภสัชกรรมคลินิก**

🌐 **Web Application:** [https://juipharm.github.io/Warfarin_Dose_Cal/](https://juipharm.github.io/Warfarin_Dose_Cal/)

---

## 📌 บทนำและวัตถุประสงค์ (Overview)

**Warfarin Clinic Pro** พัฒนาขึ้นโดยการผสานความเชี่ยวชาญของ **เภสัชกรผู้เชี่ยวชาญด้าน Warfarin Clinic**, **Senior Web App Developer**, และ **Web App Designer** เพื่อยกระดับความปลอดภัยในการดูแลผู้ป่วยที่ได้รับยาวาร์ฟาริน (Anticoagulation Therapy) ตามแนวทางเวชปฏิบัติมาตรฐานสากล (CHEST Guideline และแนวทางของสมาคมแพทย์โรคหัวใจแห่งประเทศไทยฯ)

โปรแกรมนี้ได้รับการออกแบบใหม่ด้วย **สถาปัตยกรรมแบบแยกส่วน (Modular Architecture)** แยกโค้ดส่วนการแสดงผล (HTML/CSS), ตัวควบคุมหน้าจอ (UI Controller), และเครื่องมือคำนวณทางคลินิก (Clinical Engine) ออกจากกันอย่างเป็นระบบ ทำให้มีความเสถียร ยืดหยุ่น และง่ายต่อการพัฒนาต่อยอด

---

## 🌟 คุณสมบัติเด่น (Key Features)

### 1. 📅 ระบบปฏิทินรายเดือนตามวันจริง (Multi-Month Calendar Sets)
- **จัดตำแหน่งวันในสัปดาห์ตรง 100%**: วันที่ 1 ของเดือนจะตรงกับคอลัมน์วันจริง (จันทร์–อาทิตย์) เสมอ
- **รองรับการสั่งยาข้ามเดือน**: แบ่งการ์ดปฏิทินออกเป็น 2 ชุดตามเดือนจริง (เช่น ชุดที่ 1: กันยายน, ชุดที่ 2: ตุลาคม) พร้อมสรุปจำนวนวันที่ต้องรับประทานในแต่ละเดือน
- **แยกสีพื้นหลังวันเสาร์-อาทิตย์**: 
  - 🟣 **วันเสาร์ (Saturday)**: สีม่วงพาสเทล (`#f5f3ff` / `#ede9fe`)
  - 🔴 **วันอาทิตย์ (Sunday)**: สีกุหลาบแดงพาสเทล (`#fff1f2` / `#ffe4e6`)
  - ช่วยให้ผู้ป่วยและผู้ดูแลสังเกตวันหยุดสุดสัปดาห์ได้ง่าย ชัดเจน และลดความผิดพลาดในการรับประทานยา

### 2. 💊 เวกเตอร์เม็ดยาเสมือนจริงและสัญลักษณ์ครึ่งเม็ด (Vector SVG Pill Engine)
- แสดงเม็ดยาด้วย **SVG Graphics** คุณภาพสูง:
  - 🟠 **Warfarin 2 mg**: สีส้ม/ม่วง (`#ef8d2f`)
  - 🔵 **Warfarin 3 mg**: สีฟ้า (`#175da8`)
  - 🌸 **Warfarin 5 mg**: สีชมพู (`#e24a93`)
- **การแสดงครึ่งเม็ด (½ เม็ด)**: ซีกซ้ายถมสีประจำความแรง ซีกขวามีสัญลักษณ์ **`½`** ตัวหนาเด่นชัด พร้อมเส้นผ่ากลาง
- **รองรับการพิมพ์ 100%**: ภาพเม็ดยาเวกเตอร์และตัวเลข `½` จะถูกพิมพ์ลงบนกระดาษเสมอ แม้ผู้ใช้จะไม่ได้เปิด Background Graphics บนเครื่องพิมพ์

### 3. 🖨️ แบบฟอร์มพิมพ์ตารางยาคนไข้เฉพาะทาง (Patient Print Calendar)
- มีปุ่ม **"🖨️ พิมพ์ตารางยาคนไข้"** ที่สลับเข้าสู่โหมดพิมพ์อัตโนมัติ
- ปรากฏหัวกระดาษเป็นทางการ: ชื่อคลินิก, โลโก้, ช่องเขียนชื่อ-นามสกุล, HN, ข้อบ่งใช้, Target INR, INR ครั้งนี้ และวันนัดครั้งถัดไป
- จัดหน้ากระดาษ A4 สวยงาม ซ่อนฟอร์มและปุ่มกดที่ไม่จำเป็นทั้งหมด

### 4. 📚 แนวทางการบริหาร Vitamin K1 และ Blood Products (Clinical Decision Engine)
- **ตารางที่ 1.1 Clinical Decision Matrix**: จำแนกตามระดับ INR และความเสี่ยงเลือดออก (High vs Low Bleeding Risk)
- **ตารางที่ 1.2 Pharmacology & Safety Rules**:
  - Oral Vitamin K1: ปลอดภัยที่สุด ป้องกัน Warfarin Resistance
  - IV Vitamin K1: Slow IV Infusion อย่างน้อย 30 นาที | ❌ ห้ามฉีด IM/SC เด็ดขาด
  - 4-Factor PCC: First-line Agent ในการแก้ไขภาวะเลือดออกวิกฤต (ออกฤทธิ์ใน 15–30 นาที)
  - FFP: Second-line เมื่อไม่มี PCC (ระวัง Fluid Overload)

### 5. 📈 การประเมิน Time in Therapeutic Range (TTR Analyzer)
- คำนวณด้วยวิธี **Rosendaal Linear Interpolation Method** ตามมาตรฐานสากล (เป้าหมาย TTR ≥ 65% – 70%)
- ประมวลผลตามจำนวนวันจริงระหว่างรอบนัด พร้อมระบบบันทึกประวัติ INR

### 6. 🩺 การคำนวณและปรับขนาดยาที่ถูกต้องทางคลินิก (Fixed Clinical Bugs)
- **แยกสัปดาห์แรก (Acute Transition) ออกจากสัปดาห์ถัดไป (Maintenance Regimen)** อย่างเด็ดขาด ไม่นำขนาดยาที่สั่งหยุดชั่วคราวไปหักลบออกจากเป้าหมายรายสัปดาห์ถาวร (ป้องกัน Permanent Underdosing)
- **Adherence Lock**: ตรวจจับประวัติการลืมทานยา หากลืมทานยาแล้ว INR ต่ำ บังคับคงขนาดยาเดิม ป้องกัน Supratherapeutic INR
- **Hospital Dispensing**: คำนวณจ่ายเม็ดยาจริงปัดเศษขึ้น (`Math.ceil`) ไม่มีเศษเม็ดค้าง

---

## 📂 โครงสร้างไฟล์ของระบบ (Project Architecture)

```
Warfarin_Dose_Cal/
├── index.html              # หน้าเว็บหลักแบบ Modular (เชื่อมโยง CSS/JS/Assets)
├── standalone.html         # ไฟล์รวมโค้ดเดี่ยวแบบพกพา สำหรับใช้งาน Offline
├── favicon.ico             # ไอคอน BDMS Favicon
├── README.md               # เอกสารประกอบโครงการ
├── css/
│   └── styles.css          # สไตล์ชีท ออกแบบด้วย CSS Variables, Flexbox, Grid, Print Media
├── js/
│   ├── clinical-engine.js  # เครื่องยนต์คำนวณทางคลินิก (TTR, Guidelines, Dose Decomposition, SVG)
│   └── app.js              # ตัวควบคุม UI, Event Listeners, EMR Note และการจัดการ Print
└── assets/
    ├── logo.jpg            # โลโก้ Warfarin Clinic ดั้งเดิม
    └── favicon.ico         # ไอคอนทางการของโรงพยาบาล BDMS
```

---

## 🚀 วิธีการติดตั้งและเปิดใช้งาน (Getting Started)

### 1. ใช้งานผ่าน Web Browser (Online)
เปิดผ่าน GitHub Pages ได้โดยตรงที่:
👉 **[https://juipharm.github.io/Warfarin_Dose_Cal/](https://juipharm.github.io/Warfarin_Dose_Cal/)**

### 2. ใช้งานแบบ Offline ในโรงพยาบาล (Local / Standalone)
- ดาวน์โหลดไฟล์ `standalone.html`
- ดับเบิ้ลคลิกเพื่อเปิดใช้งานบน Google Chrome หรือ Microsoft Edge ได้ทันทีโดยไม่ต้องเชื่อมต่ออินเทอร์เน็ต

---

## 📜 มาตรฐานอ้างอิงทางคลินิก (Clinical References)
1. CHEST Antithrombotic Therapy and Prevention of Thrombosis Guidelines (9th & 10th Editions)
2. Thai Heart Association Guidelines for Antithrombotic Therapy in Cardiac Diseases
3. Rosendaal FR, et al. *A method to determine the optimal intensity of oral anticoagulant therapy.* Thromb Haemost. 1993.
4. American College of Cardiology (ACC) Expert Consensus Decision Pathway on Management of Bleeding in Patients on Oral Anticoagulants.
