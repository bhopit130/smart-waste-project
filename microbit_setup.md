# คู่มือติดตั้งฮาร์ดแวร์ — Smart Waste Bin

## อุปกรณ์ที่ต้องใช้

| อุปกรณ์ | รายละเอียด |
|---------|-----------|
| Micro:bit v1/v2 | บอร์ดหลัก |
| AX-microBIT หรือ Breakout Board | สำหรับต่อ Pin ออก |
| Servo Motor (SG90 หรือ MG90S) | เปิด-ปิดฝาถัง |
| ZX-RGB3C (NeoPixel WS2812) | แสดงสีตามประเภทขยะ |
| สาย USB Micro-B | เชื่อมต่อกับคอมพิวเตอร์/โน๊ตบุ๊ค |
| สาย Dupont (Female-Female) | เชื่อมต่อ Pin |
| แหล่งจ่ายไฟ 5V | สำหรับ Servo (แนะนำ Power Bank หรือ Adapter) |

---

## วงจรการเชื่อมต่อ

### Servo Motor (SG90) → Micro:bit Pin 8

```
Servo Motor          Micro:bit / AX-microBIT
-----------          -----------------------
สายส้ม (Signal)  →   Pin 8
สายแดง (VCC 5V)  →   ต่อ VCC 5V ภายนอก (ไม่ควรต่อกับ 3V ของ Micro:bit)
สายน้ำตาล (GND)  →   GND
```

> ⚠️ **สำคัญ**: Servo Motor ต้องการไฟ 5V กระแสสูง อย่าต่อ VCC ของ Servo เข้ากับ 3V ของ Micro:bit โดยตรง ให้ใช้แหล่งจ่ายไฟภายนอก และต่อ GND ร่วมกัน

### ZX-RGB3C (NeoPixel LED) → Micro:bit Pin 16

```
ZX-RGB3C             Micro:bit / AX-microBIT
--------             -----------------------
DIN (Data In)    →   Pin 16
VCC (5V)         →   ต่อ 5V ภายนอก (หรือ 3.3V ของ Micro:bit ถ้า LED สว่างพอ)
GND              →   GND (ร่วมกับ Servo)
```

---

## แผนผังวงจรอย่างง่าย

```
[Power Bank 5V]
      |
      +-------- VCC Servo --------+
      |                           |
      +-------- VCC ZX-RGB3C     |
      |                           |
     GND (ร่วมทั้งหมด) ──────────+──── GND Micro:bit
                                  |
[Micro:bit]                       |
  Pin 8  ────── Signal Servo ─────+
  Pin 16 ────── DIN ZX-RGB3C ─────+
  USB    ────── คอมพิวเตอร์ (Web Serial)
```

---

## ขั้นตอนการ Flash Code ลง Micro:bit

### วิธีที่ 1: Python Editor Online (แนะนำ)

1. เปิดเบราว์เซอร์ไปที่ **[https://python.microbit.org/](https://python.microbit.org/)**
2. คลิก **"Open"** หรือ **"Load"** แล้วเลือกไฟล์ `microbit_code.py`
3. เสียบ Micro:bit ด้วยสาย USB
4. คลิกปุ่ม **"Send to micro:bit"** (ปุ่มสีม่วง)
5. รอจนหน้าจอ Micro:bit แสดง **"READY"** เลื่อนผ่าน

### วิธีที่ 2: Mu Editor (ติดตั้งในเครื่อง)

1. ดาวน์โหลด **Mu Editor** จาก [https://codewith.mu/](https://codewith.mu/)
2. เลือก Mode: **BBC micro:bit**
3. เปิดไฟล์ `microbit_code.py`
4. คลิก **"Flash"**

---

## ขั้นตอนการใช้งานกับเว็บแอป

1. ต่อสาย USB จาก Micro:bit เข้ากับคอมพิวเตอร์ที่รันเว็บแอป
2. เปิดเว็บแอป **Smart Waste Classifier** บน **Chrome หรือ Edge** (ต้องการ Web Serial API)
3. ไปที่เมนู **Smart Bin** (ไอคอน CPU)
4. คลิกปุ่ม **"เชื่อมต่อ USB"**
5. เลือก Port ของ Micro:bit จาก popup (ชื่อประมาณ "BBC micro:bit CMSIS-DAP" หรือ "USB Serial Device")
6. รอให้ขึ้น ✅ **USB Connected**
7. สแกนขยะได้เลย! ถังขยะจะเปิดอัตโนมัติตามประเภทที่ AI วิเคราะห์

---

## การทำงานของระบบ

```
[กล้อง] → [AI วิเคราะห์] → [ส่งคำสั่ง]
                                  |
                    +-------------+-------------+
                    |                           |
             [Firebase] ←── Cloud          [USB Serial]
             (ESP32/KidBright)           (Micro:bit โดยตรง)
                    |                           |
             [ถังขยะอื่น]              [ถังขยะต้นแบบ]
                                        Servo + LED
```

---

## Troubleshooting

| ปัญหา | วิธีแก้ |
|-------|--------|
| ไม่เห็น Port ใน popup | ตรวจสอบ Driver, ลองเปลี่ยนสาย USB |
| Servo ไม่หมุน | ตรวจสอบไฟ 5V และ GND ร่วม |
| LED ไม่ติด | ตรวจสอบ DIN ต่อที่ Pin 16 และ GND ร่วม |
| เว็บไม่เห็นปุ่ม USB | ใช้ Chrome หรือ Edge เท่านั้น (Firefox ไม่รองรับ) |
| Micro:bit แสดง Error | Flash code ใหม่ผ่าน python.microbit.org |
