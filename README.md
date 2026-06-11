# PropFlow — ระบบจัดการบ้านเช่าผ่าน LINE

ระบบจัดการอสังหาฯ ให้เช่าแบบครบวงจร ผู้เช่าทำทุกอย่างผ่าน LINE (รับบิล / จ่ายเงิน / แนบสลิป / รับใบเสร็จ / แจ้งซ่อม) และแอดมินจัดการผ่าน LIFF web app

โครงสร้างเป็น monorepo:

```
.
├── backend/     Express + TypeScript + Prisma + PostgreSQL + LINE Messaging API
├── frontend/    React 18 + Vite + Tailwind + LIFF
├── Dockerfile   build รวม frontend+backend เป็น service เดียว (สำหรับ Railway)
├── railway.json ตั้งค่า build/deploy/healthcheck
└── docker-compose.yml  PostgreSQL สำหรับ dev
```

---

## รันแบบ Local (Development)

ต้องมี: Node.js 20+, Docker

```bash
# 1) เตรียม env
cp .env.example .env
# (ค่า DATABASE_URL ใน .env ชี้ไปที่ localhost:5434 ตาม docker-compose)

# 2) เปิดฐานข้อมูล
docker compose up postgres -d

# 3) ติดตั้ง dependency
cd backend && npm install
cd ../frontend && npm install

# 4) migrate + seed ฐานข้อมูล (รันใน backend/)
cd ../backend
export DATABASE_URL="postgresql://propflow:propflow@localhost:5434/propflow_db"
npx prisma migrate dev --name init
npm run seed

# 5) รัน backend (terminal 1)
npm run dev          # http://localhost:4000

# 6) รัน frontend (terminal 2)
cd ../frontend && npm run dev   # http://localhost:5173
```

### Mock mode (ไม่ต้องมี LINE credentials)
ถ้ายังไม่ได้ใส่ค่า LINE/Twilio ระบบจะทำงานในโหมดจำลอง:
- หน้าเว็บ dev จะมีปุ่มสลับบทบาท **Admin / Tenant** ที่มุมขวาล่าง
- การส่ง LINE / SMS จะถูก log ออก console แทนการส่งจริง
- การตรวจสลิป (OCR) จะถือว่าผ่านอัตโนมัติ

ข้อมูล seed: แอดมิน "วิชัย ทดสอบ", คอนโด สุขุมวิท 31 (3 ห้อง), ผู้เช่า "สมชาย ทดสอบ" ห้อง 101

---

## Deploy ขึ้น Railway

ระบบ build เป็น **service เดียว**: backend เสิร์ฟทั้ง REST API (`/api/*`) และไฟล์ frontend ที่ build แล้ว

### ขั้นตอน

1. **Push โค้ดขึ้น GitHub**
   ```bash
   git add -A && git commit -m "PropFlow initial" && git push
   ```

2. **สร้างโปรเจกต์ใน Railway**
   - ไปที่ [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → เลือก repo นี้
   - Railway จะอ่าน `railway.json` และ build ด้วย `Dockerfile` อัตโนมัติ

3. **เพิ่ม PostgreSQL**
   - ในโปรเจกต์ → New → Database → Add PostgreSQL
   - Railway จะสร้างตัวแปร `DATABASE_URL` ให้ ผูกเข้ากับ service backend (ใช้ reference `${{Postgres.DATABASE_URL}}`)

4. **ตั้งค่า Environment Variables** ของ service (Settings → Variables)
   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   JWT_SECRET   = <สุ่ม string ยาว ๆ>
   NODE_ENV     = production

   # LINE (ใส่เมื่อพร้อมใช้งานจริง)
   LINE_CHANNEL_ID=
   LINE_CHANNEL_SECRET=
   LINE_CHANNEL_ACCESS_TOKEN=
   LINE_LOGIN_CHANNEL_ID=
   LIFF_ID=
   LIFF_BASE_URL=https://liff.line.me/<LIFF_ID>

   # Twilio (optional)
   TWILIO_ACCOUNT_SID=
   TWILIO_AUTH_TOKEN=
   TWILIO_FROM_NUMBER=

   # S3 (แนะนำสำหรับเก็บสลิป/ใบเสร็จถาวร — ดูหมายเหตุด้านล่าง)
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=
   AWS_BUCKET=
   AWS_REGION=ap-southeast-1
   ```
   > Railway ตั้ง `PORT` ให้เองอัตโนมัติ — โค้ดอ่านค่าจาก `process.env.PORT`

5. **Migrate** จะรันอัตโนมัติทุกครั้งที่ deploy ผ่าน start command:
   ```
   npx prisma migrate deploy && node dist/app.js
   ```

6. **Seed (ครั้งแรก, ถ้าต้องการข้อมูลตัวอย่าง)** — รันใน Railway shell ของ service:
   ```bash
   npm run seed
   ```

7. **Healthcheck**: Railway ตรวจที่ `/api/health` (ตั้งไว้ใน `railway.json`)

8. **ตั้งค่า LINE หลัง deploy**
   - **Webhook URL**: `https://<your-app>.up.railway.app/api/webhook`
   - **LIFF Endpoint URL**: `https://<your-app>.up.railway.app`
   - หากตั้ง build arg `VITE_LIFF_ID` / `VITE_API_URL` ต้องการค่าตอน build — ค่าเริ่มต้น `VITE_API_URL=/api` (same-origin) ใช้ได้เลย ส่วน `VITE_LIFF_ID` ใส่ผ่าน Railway build arg ได้ภายหลัง

### หมายเหตุเรื่องไฟล์อัปโหลด
ดิสก์ของ Railway เป็น ephemeral (รีเซ็ตทุก deploy) — สลิป/ใบเสร็จที่เก็บแบบ local disk จะหายเมื่อ redeploy
แนะนำ 1 ใน 2 วิธี:
- **ตั้งค่า S3** (ใส่ `AWS_*`) — `storageService` จะสลับไปใช้ S3 อัตโนมัติ ✅ แนะนำ
- หรือเพิ่ม **Railway Volume** mount ที่ `/app/backend/uploads`

---

## คำสั่งที่มีให้

| ที่ | คำสั่ง | ความหมาย |
|-----|--------|----------|
| backend | `npm run dev` | dev server (tsx watch) |
| backend | `npm run build` | compile TypeScript → `dist/` |
| backend | `npm run seed` | ใส่ข้อมูลตัวอย่าง |
| backend | `npx prisma migrate dev` | สร้าง/อัปเดต schema |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run build` | build production → `dist/` |

---

## โครงสร้าง API หลัก

- `POST /api/auth/line` — login ผ่าน LINE (รองรับ mock)
- `GET/POST /api/properties`, `/api/properties/:id/units` — จัดการอาคาร/ห้อง
- `POST /api/tenants`, `/api/tenants/link`, `/api/tenants/:id/invite/{sms,line}` — ผู้เช่า + คำเชิญ
- `POST /api/invoices`, `/api/invoices/send-all`, `/api/invoices/build-preview` — ใบแจ้งหนี้
- `GET /api/payments/:invoiceId/qr`, `POST /api/payments/:invoiceId/slip`, `/api/payments/:id/approve` — ชำระเงิน
- `POST /api/meters` — มิเตอร์
- `POST /api/contracts`, `/api/contracts/:id/pdf` — สัญญา + PDF
- `POST /api/maintenance` — แจ้งซ่อม
- `GET/PUT /api/notifications/settings` — ตั้งค่าแจ้งเตือน
- `GET /api/reports/revenue`, `/api/reports/export` — รายงาน
- `POST /api/webhook` — LINE webhook
```
