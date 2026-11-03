# นำ Web Lab ขึ้น GitHub Pages

ลิงก์ที่ QR ในสไลด์และใบกิจกรรมชี้ไป: `https://wirunsit.github.io/science1/heat-lab/` (ตั้งใน `config.json` → `baseUrl`)

ทำครั้งแรกครั้งเดียว (ครูทำเองในบัญชี GitHub ของครู):

1. repository: `https://github.com/WirunSit/science1` (ครูสร้างแล้ว 3 พ.ย. 2569)
2. ใน repository ไปที่ Settings → Pages → Source เลือก **GitHub Actions**
3. ในเครื่องนี้ เชื่อมโฟลเดอร์โปรเจกต์กับ repository แล้ว push สาขา `main`

```bash
git remote add origin https://github.com/WirunSit/science1.git
git push -u origin main
```

หลัง push ทุกครั้ง GitHub Actions (`.github/workflows/pages.yml`) จะรัน unit test, build แล็บทุกตัว แล้วเผยแพร่โฟลเดอร์ `dist/` ใช้เวลาประมาณ 2–3 นาที ดูสถานะได้ที่แท็บ Actions ของ repository

## หน้ารวมสื่อ (`dist/index.html`)

หน้าเดียวที่รวมแล็บ สไลด์ และใบงานทุกเรื่อง เรียงตามหน่วย → บท → เรื่อง กดแล้วเปิดได้ทันที
- นักเรียน: `https://wirunsit.github.io/science1/` มีแล็บ สไลด์ (PDF) และใบงานฉบับนักเรียน (PDF)
- ครู: เปิดไฟล์ `dist/index.html` ในเครื่องนี้ (ดับเบิลคลิก) จะมีส่วน "สำหรับครู" เพิ่ม ได้แก่ สไลด์ PowerPoint ที่มีบันทึกผู้สอน ใบงานฉบับครูที่มีเฉลย ไฟล์ Word ที่แก้ไขได้ และแบบทดสอบท้ายบท

เมื่อแก้เนื้อหาใน `content/` ให้รันตามลำดับ แล้ว commit โฟลเดอร์ `materials/` ด้วย

```bash
npm run materials
```

```bash
npm run build
```

`npm run materials` สร้างสไลด์และใบงานทั้งหมด แปลงเป็น PDF ด้วย Microsoft Office แล้วเก็บไว้ใน `materials/`
- `materials/slides` และ `materials/worksheets` (ฉบับนักเรียน) เผยแพร่บนเว็บ
- `materials/teacher` (เฉลย ไฟล์แก้ไขได้ แบบทดสอบ) อยู่ในเครื่องครูเท่านั้น git ไม่เก็บ จึงไม่ขึ้นเว็บ

หมายเหตุ
- แล็บเป็นไฟล์ HTML ไฟล์เดียว เปิดแบบออฟไลน์ได้เช่นกัน: ส่งไฟล์ `dist/heat-lab/index.html` ให้นักเรียนผ่าน LINE ได้ถ้าอินเทอร์เน็ตในห้องไม่ดี
- ข้อมูลนักเรียน (ชื่อ ผลการทดลอง คะแนน) เก็บในเครื่องของนักเรียนเท่านั้น ไม่ส่งขึ้นเว็บ
