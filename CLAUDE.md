# PropFlow — LINE Rental Management System
## Master Prompt for Claude Code (VS Code)

> วางไฟล์นี้ไว้ที่ root ของ project แล้วเปิด Claude Code ใน VS Code
> Claude Code จะอ่านไฟล์นี้เป็น context หลักอัตโนมัติ

---

## 1. Project Vision

**PropFlow** คือระบบจัดการบ้านเช่าผ่าน LINE ออกแบบสำหรับเจ้าของอสังหาฯ ที่มีหลายอาคาร/หลายห้อง โดยผู้เช่าทำทุกอย่างผ่าน LINE OA chat เพียงช่องทางเดียว ได้แก่ รับใบแจ้งหนี้ ชำระเงิน แนบสลิป รับใบเสร็จ และแจ้งซ่อม

**Core concept:**
- เจ้าของมีหลาย Property แต่ละแห่งมีบัญชีรับเงิน/PromptPay แยกกัน
- ผู้เช่าผูก LINE ผ่าน invite link (SMS หรือ LINE) ไม่มี username/password
- ทุก notification ส่งผ่าน LINE Messaging API → LINE OA → inbox ผู้เช่า
- Rich Menu 6 ปุ่มอยู่ด้านล่าง chat ตลอดเวลา (ชำระเงิน / ใบเสร็จ / ใบแจ้งหนี้ / แจ้งซ่อม / สัญญา / ติดต่อ)
- Admin จัดการผ่าน LIFF web app

---

## 2. Tech Stack

### Frontend (LIFF App)
```
Framework:    React 18 + TypeScript + Vite
Styling:      Tailwind CSS  (primary: #06C755 LINE green)
State:        Zustand
HTTP:         Axios + JWT interceptor
Routing:      React Router v6 (role-based guards)
LINE SDK:     @line/liff
QR:           qrcode.react  (PromptPay QR)
PDF preview:  @react-pdf/renderer
Font:         Sarabun (Google Fonts, Thai)
```

### Backend (Express API)
```
Runtime:      Node.js + Express + TypeScript
ORM:          Prisma + PostgreSQL
Auth:         LINE Login via LIFF (no username/password)
LINE:         @line/bot-sdk  (Messaging API + webhook)
Scheduler:    node-cron  (notification jobs)
PDF gen:      PDFKit + Sarabun font embed
File upload:  multer → AWS S3 (local disk for dev)
QR payload:   promptpay-qr
SMS invite:   twilio (or AWS SNS)
```

### Infrastructure
```
Dev:    Docker Compose (postgres, redis, backend, frontend)
Env:    .env  (never commit)
```

---

## 3. Monorepo Structure

```
propflow/
├── CLAUDE.md                    ← this file
├── .env                         ← all secrets
├── .env.example
├── docker-compose.yml
├── Makefile                     ← shortcuts: make dev, make migrate, make seed
│
├── frontend/                    ← React LIFF app
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx              ← route guard (role → redirect)
│       ├── pages/
│       │   ├── Splash.tsx       ← loading + LINE login
│       │   ├── LinkRoom.tsx     ← tenant opens invite link
│       │   ├── admin/
│       │   │   ├── Portfolio.tsx         ← all properties overview
│       │   │   ├── PropertyDetail.tsx    ← rooms list + filter chips
│       │   │   ├── AddProperty.tsx       ← property form (name, bank, promptpay)
│       │   │   ├── AddUnit.tsx           ← room form (rent, rates, floor)
│       │   │   ├── AddTenant.tsx         ← tenant form step 1 (name, phone, lineId)
│       │   │   ├── ContractSetup.tsx     ← step 2 (dates, deposit, terms)
│       │   │   ├── InviteTenant.tsx      ← step 3 (send SMS + LINE invite)
│       │   │   ├── ContractView.tsx      ← view + PDF + print
│       │   │   ├── MeterRecording.tsx    ← elec/water meter form + photo
│       │   │   ├── InvoiceBuilder.tsx    ← create + send invoices
│       │   │   ├── BillingOverview.tsx   ← all properties billing (grouped)
│       │   │   ├── SlipReview.tsx        ← approve/reject slip + OCR result
│       │   │   ├── ReceiptView.tsx       ← receipt + PDF + print
│       │   │   ├── Reports.tsx           ← revenue charts + export
│       │   │   ├── NotifSettings.tsx     ← notification config (time, days)
│       │   │   └── Settings.tsx          ← account + property settings
│       │   └── tenant/
│       │       ├── TenantHome.tsx        ← dashboard (invoice card + quick grid)
│       │       ├── InvoiceDetail.tsx     ← breakdown + meter readings
│       │       ├── PaymentSelect.tsx     ← choose payment method
│       │       ├── PaymentQR.tsx         ← PromptPay QR + countdown + slip upload
│       │       ├── SlipUpload.tsx        ← attach slip + confirm amount
│       │       ├── PaymentSuccess.tsx    ← success state + back to LINE
│       │       ├── PaymentHistory.tsx    ← all payments list
│       │       ├── ReceiptDownload.tsx   ← receipt PDF download + print
│       │       ├── ContractView.tsx      ← view + download contract
│       │       ├── MaintenanceList.tsx   ← ticket list + filter
│       │       ├── MaintenanceForm.tsx   ← new ticket (category + photo)
│       │       └── MaintenanceDetail.tsx ← ticket detail + chat + timeline
│       ├── components/
│       │   ├── ui/              ← Button, Badge, Card, Avatar, Toggle, Input
│       │   ├── layout/          ← TopBar, BottomNav, RichMenuBar
│       │   └── pdf/             ← ContractPDF, ReceiptPDF (react-pdf)
│       ├── store/               ← Zustand: auth, property, ui
│       ├── hooks/               ← useLiff, useAuth, useRole
│       └── lib/
│           ├── axios.ts         ← axios instance + JWT interceptor
│           ├── liff.ts          ← liff.init() + getProfile()
│           └── utils.ts         ← date, currency formatters (Thai)
│
└── backend/
    ├── src/
    │   ├── app.ts               ← Express setup
    │   ├── routes/
    │   │   ├── auth.ts          ← POST /auth/line
    │   │   ├── properties.ts    ← CRUD properties
    │   │   ├── units.ts         ← CRUD units + invite token
    │   │   ├── tenants.ts       ← CRUD tenants + link LINE
    │   │   ├── contracts.ts     ← CRUD contracts + PDF gen
    │   │   ├── meters.ts        ← meter readings
    │   │   ├── invoices.ts      ← create, send, list
    │   │   ├── payments.ts      ← slip upload, approve, receipt
    │   │   ├── maintenance.ts   ← tickets + messages
    │   │   ├── notifications.ts ← GET/PUT notif settings
    │   │   ├── reports.ts       ← revenue aggregation
    │   │   └── webhook.ts       ← LINE webhook (follow, message, postback)
    │   ├── lib/
    │   │   └── line/
    │   │       ├── index.ts         ← re-export all
    │   │       ├── client.ts        ← LINE Client singleton
    │   │       ├── lineService.ts   ← push / reply / broadcast
    │   │       ├── flexMessages.ts  ← all Flex JSON builders
    │   │       ├── richMenu.ts      ← create + assign Rich Menu
    │   │       ├── webhook.ts       ← event handler (follow/msg/postback)
    │   │       └── types/
    │   │           ├── line.types.ts    ← InvoiceData, OverdueData, etc.
    │   │           └── flex.types.ts
    │   ├── services/
    │   │   ├── pdfService.ts        ← PDFKit: receipt + contract
    │   │   ├── contractTemplate.ts  ← Thai contract text builder
    │   │   ├── qrService.ts         ← PromptPay QR payload
    │   │   ├── smsService.ts        ← Twilio SMS invite
    │   │   ├── ocrService.ts        ← slip OCR (optional)
    │   │   ├── storageService.ts    ← S3 / local upload
    │   │   └── scheduler.ts         ← node-cron notification jobs
    │   └── middleware/
    │       ├── auth.ts              ← JWT verify
    │       └── lineSignature.ts     ← LINE webhook signature
    └── prisma/
        └── schema.prisma
```

---

## 4. Database Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Admin {
  id              String         @id @default(cuid())
  lineUserId      String         @unique
  name            String
  phone           String?
  properties      Property[]
  notifSettings   NotifSettings?
  createdAt       DateTime       @default(now())
}

model Property {
  id              String    @id @default(cuid())
  adminId         String
  admin           Admin     @relation(fields: [adminId], references: [id])
  name            String
  address         String?
  bankName        String?
  bankAccount     String?
  promptpayNumber String
  units           Unit[]
  createdAt       DateTime  @default(now())
}

model Unit {
  id              String         @id @default(cuid())
  propertyId      String
  property        Property       @relation(fields: [propertyId], references: [id])
  roomNumber      String
  floor           Int?
  rentPrice       Decimal
  electricRate    Decimal        @default(5)
  waterRate       Decimal        @default(18)
  commonFee       Decimal        @default(0)
  status          UnitStatus     @default(VACANT)
  inviteToken     String         @unique @default(cuid())
  inviteExpiry    DateTime?
  tenants         Tenant[]
  invoices        Invoice[]
  meterReadings   MeterReading[]
  maintenances    Maintenance[]
  createdAt       DateTime       @default(now())
}

enum UnitStatus { VACANT OCCUPIED MAINTENANCE }

model Tenant {
  id            String    @id @default(cuid())
  lineUserId    String?   @unique
  name          String
  phone         String
  lineId        String?
  idCardNumber  String?
  unitId        String
  unit          Unit      @relation(fields: [unitId], references: [id])
  startDate     DateTime
  endDate       DateTime?
  isActive      Boolean   @default(true)
  inviteSentAt  DateTime?
  linkedAt      DateTime?
  contracts     Contract[]
  payments      Payment[]
  chatMessages  ChatMessage[]
  createdAt     DateTime  @default(now())
}

model Contract {
  id            String         @id @default(cuid())
  tenantId      String
  tenant        Tenant         @relation(fields: [tenantId], references: [id])
  unitId        String
  startDate     DateTime
  endDate       DateTime
  rentAmount    Decimal
  deposit       Decimal
  lateFeePerDay Decimal        @default(30)
  dueDay        Int            @default(5)
  terms         String?
  pdfUrl        String?
  status        ContractStatus @default(ACTIVE)
  createdAt     DateTime       @default(now())
}

enum ContractStatus { ACTIVE EXPIRED TERMINATED }

model Invoice {
  id              String        @id @default(cuid())
  unitId          String
  unit            Unit          @relation(fields: [unitId], references: [id])
  month           Int
  year            Int
  rentAmount      Decimal
  electricAmount  Decimal
  waterAmount     Decimal
  commonFee       Decimal
  lateFee         Decimal       @default(0)
  total           Decimal
  dueDate         DateTime
  status          InvoiceStatus @default(PENDING)
  sentAt          DateTime?
  payment         Payment?
  createdAt       DateTime      @default(now())
}

enum InvoiceStatus { PENDING SLIP_UPLOADED PAID OVERDUE CANCELLED }

model Payment {
  id             String        @id @default(cuid())
  invoiceId      String        @unique
  invoice        Invoice       @relation(fields: [invoiceId], references: [id])
  tenantId       String
  tenant         Tenant        @relation(fields: [tenantId], references: [id])
  slipUrl        String?
  slipUploadedAt DateTime?
  ocrAmount      Decimal?
  ocrDate        DateTime?
  ocrMatched     Boolean?
  status         PaymentStatus @default(WAITING_SLIP)
  approvedAt     DateTime?
  rejectedAt     DateTime?
  rejectReason   String?
  receiptNo      String?       @unique
  receiptUrl     String?
  receiptPdfUrl  String?
  createdAt      DateTime      @default(now())
}

enum PaymentStatus { WAITING_SLIP UNDER_REVIEW APPROVED REJECTED }

model MeterReading {
  id            String   @id @default(cuid())
  unitId        String
  unit          Unit     @relation(fields: [unitId], references: [id])
  month         Int
  year          Int
  prevElec      Decimal
  currElec      Decimal
  prevWater     Decimal
  currWater     Decimal
  elecPhotoUrl  String?
  waterPhotoUrl String?
  createdAt     DateTime @default(now())
}

model Maintenance {
  id          String              @id @default(cuid())
  unitId      String
  unit        Unit                @relation(fields: [unitId], references: [id])
  ticketNo    String              @unique
  category    MaintenanceCategory
  title       String
  description String?
  photoUrls   String[]
  status      MaintenanceStatus   @default(NEW)
  scheduledAt DateTime?
  completedAt DateTime?
  messages    MaintenanceMessage[]
  createdAt   DateTime            @default(now())
}

enum MaintenanceCategory { ELECTRIC PLUMBING APPLIANCE GENERAL }
enum MaintenanceStatus   { NEW ACKNOWLEDGED IN_PROGRESS SCHEDULED DONE CLOSED }

model MaintenanceMessage {
  id            String      @id @default(cuid())
  maintenanceId String
  maintenance   Maintenance @relation(fields: [maintenanceId], references: [id])
  senderRole    String
  senderName    String
  message       String
  createdAt     DateTime    @default(now())
}

model ChatMessage {
  id         String   @id @default(cuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  senderRole String
  message    String
  createdAt  DateTime @default(now())
}

model NotifSettings {
  id                   String   @id @default(cuid())
  adminId              String   @unique
  admin                Admin    @relation(fields: [adminId], references: [id])
  invoiceEnabled       Boolean  @default(true)
  invoiceSendDay       Int      @default(1)
  invoiceSendTime      String   @default("08:00")
  rentReminderEnabled  Boolean  @default(true)
  rentReminderDays     Int[]    @default([3, 1])
  rentReminderTime     String   @default("08:00")
  overdueEnabled       Boolean  @default(true)
  overdueRepeatDays    Int      @default(2)
  overdueSendTime      String   @default("09:00")
  contractEnabled      Boolean  @default(true)
  contractReminderDays Int[]    @default([60, 30, 14, 7])
  contractSendTime     String   @default("08:00")
  notifyTenant         Boolean  @default(true)
  maintEnabled         Boolean  @default(true)
  maintUnackHours      Int      @default(1)
  quietEnabled         Boolean  @default(true)
  quietStart           String   @default("22:00")
  quietEnd             String   @default("07:00")
  updatedAt            DateTime @updatedAt
}
```

---

## 5. Environment Variables

```env
# .env (copy from .env.example and fill in)

# Database
DATABASE_URL=postgresql://propflow:propflow@localhost:5432/propflow_db

# JWT
JWT_SECRET=change-this-to-a-256-bit-random-secret
JWT_EXPIRES_IN=7d

# LINE Messaging API channel (OA)
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=

# LINE Login channel (LIFF)
LINE_LOGIN_CHANNEL_ID=
LIFF_ID=

# App URLs
FRONTEND_URL=https://liff.line.me/YOUR_LIFF_ID
LIFF_BASE_URL=https://liff.line.me/YOUR_LIFF_ID
BACKEND_URL=http://localhost:4000
PORT=4000
NODE_ENV=development

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET=propflow-uploads
AWS_REGION=ap-southeast-1

# SMS (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# PromptPay (Admin default, overridden per-property)
DEFAULT_PROMPTPAY_NUMBER=

# Frontend env (Vite prefix)
VITE_LIFF_ID=
VITE_API_URL=http://localhost:4000/api
```

---

## 6. Authentication Flow

```
1. Frontend: liff.init({ liffId })
2. If !liff.isLoggedIn() → liff.login()
3. Get: accessToken = liff.getAccessToken()
        profile    = liff.getProfile()
4. POST /api/auth/line { accessToken, profile }
5. Backend:
   - Verify token: GET https://api.line.me/oauth2/v2.1/verify
   - Find lineUserId in Admin  → role = "ADMIN"
   - Find lineUserId in Tenant → role = "TENANT"
   - Not found                 → role = "NEW" (show LinkRoom)
   - Return JWT { lineUserId, role, unitId?, adminId? }
6. Frontend: store JWT in Zustand (memory only, no localStorage)
7. Axios interceptor: adds Authorization: Bearer <jwt>
```

---

## 7. Tenant Invite Flow

```
Admin fills: name, phone, LINE ID (optional)
    ↓
Backend creates Tenant record (lineUserId = null)
Backend generates: inviteToken (cuid), inviteExpiry = now + 7 days
    ↓
Admin chooses channel(s):
  SMS  → Twilio: "คุณได้รับคำเชิญเป็นผู้เช่า [property] ห้อง [room]
                  กรุณากดลิงก์: https://liff.line.me/[ID]?token=[token]"
  LINE → Messaging API: Flex Message invite card to @lineId
    ↓
Tenant taps link → LIFF opens → liff.getProfile()
POST /api/tenants/link { inviteToken, lineUserId }
Backend:
  - validate token not expired
  - set tenant.lineUserId = lineUserId, tenant.linkedAt = now
  - update unit.status = OCCUPIED
  - call setTenantRichMenu(lineUserId)  ← assign Rich Menu
    ↓
Admin receives LINE push: "สมหญิง ผูก LINE สำเร็จ ห้อง 201"
```

---

## 8. LINE Payment Flow (Full)

```
[Cron] วันที่ 1 เวลา 08:00
  → สร้าง Invoice ทุกห้องที่มีผู้เช่า
  → push Flex Message "ใบแจ้งหนี้" ไปทุก tenant LINE

Tenant กดปุ่ม "ชำระเงิน" ใน Flex Message
  → เปิด LIFF /payment/:invoiceId
  → แสดงรายละเอียด + เลือกวิธีชำระ

Tenant กด "แสดง QR Code"
  → Backend: GET /api/payments/:invoiceId/qr
  → Return PromptPay payload (promptpay-qr)
  → Frontend: <QRCode value={payload} />  + countdown 30 นาที

Tenant สแกน QR → โอนเงิน → กลับ LIFF → แนบสลิป
  → POST /api/payments/:invoiceId/slip  { file: FormData }
  → Backend: upload to S3, update invoice.status = SLIP_UPLOADED
  → push Flex Message ไปหา Admin: "มีสลิปใหม่ ห้อง 201"
  → reply ผู้เช่า: "ได้รับสลิปแล้ว รอ Admin ยืนยัน"

Admin เปิด LIFF /admin/slip/:paymentId
  → เห็นรูปสลิป + OCR result (ยอด, วันที่, match status)
  → กด Approve
  → Backend:
      - update payment.status = APPROVED
      - generate receipt PDF (PDFKit + Sarabun)
      - upload to S3
      - push Flex Message "ใบเสร็จ" ไปหา tenant พร้อมลิงก์ PDF
```

---

## 9. LINE lib — Key Files

### backend/src/lib/line/client.ts
```typescript
import { Client, middleware } from '@line/bot-sdk'
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
}
export const lineClient = new Client(config)
export const lineMiddleware = middleware(config)
```

### backend/src/lib/line/lineService.ts
```typescript
// Functions to implement:
pushInvoice(lineUserId, InvoiceData)
pushRentReminder(lineUserId, ReminderData)
pushOverdue(lineUserId, OverdueData)
pushSlipApproved(lineUserId, ReceiptData)       // → send receipt Flex
pushContractExpiry(lineUserId, ContractData)
pushMaintNew(adminLineUserId, MaintData)
pushLinked(adminLineUserId, LinkedData)
broadcastInvoices(tenants[], invoices[])        // Promise.allSettled
replyQuickMenu(replyToken)                      // quick reply buttons
```

### backend/src/lib/line/flexMessages.ts
```typescript
// Builders to implement (return FlexMessage):
buildInvoiceFlex(d: InvoiceData)    // green header, line items, "ชำระเงิน" btn
buildReminderFlex(d: ReminderData)  // amber header, days left, "ชำระตอนนี้" btn
buildOverdueFlex(d: OverdueData)    // red header, late fee, "ชำระด่วน" btn
buildReceiptFlex(d: ReceiptData)    // green header, "ดาวน์โหลดใบเสร็จ" btn
buildContractExpiryFlex(d)          // blue header, "ต่อสัญญา" + "ดูสัญญา" btns
buildMaintNewFlex(d: MaintData)     // gray header, "รับเรื่อง" + "ดู ticket" btns
buildLinkedFlex(d: LinkedData)      // green header, "ดูโปรไฟล์ผู้เช่า" btn
buildInviteFlex(d: InviteData)      // invite card, "ยืนยันและผูก LINE" btn
```

### backend/src/lib/line/richMenu.ts
```typescript
// Rich Menu 2 rows × 3 cols (2500×843px):
// Row 1: ชำระเงิน | ใบเสร็จ | ใบแจ้งหนี้
// Row 2: แจ้งซ่อม | สัญญา   | ติดต่อ
// Each button opens: https://liff.line.me/{LIFF_ID}/{path}
export async function setTenantRichMenu(lineUserId: string)
export async function removeTenantRichMenu(lineUserId: string)
```

### backend/src/lib/line/webhook.ts
```typescript
// Event handlers:
// follow    → setTenantRichMenu + welcome message
// unfollow  → log only
// message   → keyword routing:
//   "ใบเสร็จล่าสุด" → pushReceiptFlex
//   "ชำระเงิน"      → reply LIFF link
//   "แจ้งซ่อม"      → reply LIFF link
//   default         → save to ChatMessage DB + notify admin
// postback  → parse { action, paymentId }
//   APPROVE → approvePayment()
//   REJECT  → rejectPayment()
```

---

## 10. Notification Scheduler

```typescript
// backend/src/services/scheduler.ts
// Run every hour at :00
cron.schedule('0 * * * *', async () => {
  const HH_mm = format(new Date(), 'HH:mm')
  const admins = await prisma.admin.findMany({ include: { notifSettings: true }})

  for (const admin of admins) {
    const s = admin.notifSettings
    if (!s) continue
    if (s.quietEnabled && isQuietHour(HH_mm, s.quietStart, s.quietEnd)) continue

    // 1. ส่งใบแจ้งหนี้ (วันที่ invoiceSendDay เวลา invoiceSendTime)
    if (s.invoiceEnabled && HH_mm === s.invoiceSendTime
        && new Date().getDate() === s.invoiceSendDay)
      await sendInvoicesForAdmin(admin.id)

    // 2. เตือนล่วงหน้า (X วันก่อนครบกำหนด เวลา rentReminderTime)
    if (s.rentReminderEnabled && HH_mm === s.rentReminderTime)
      for (const days of s.rentReminderDays)
        await sendRentReminders(admin.id, days)

    // 3. เตือนค้างชำระ (ทุก overdueRepeatDays วัน เวลา overdueSendTime)
    if (s.overdueEnabled && HH_mm === s.overdueSendTime)
      await sendOverdueReminders(admin.id, s.overdueRepeatDays)

    // 4. สัญญาใกล้หมด (X วันก่อน เวลา contractSendTime)
    if (s.contractEnabled && HH_mm === s.contractSendTime)
      for (const days of s.contractReminderDays)
        await sendContractExpiryReminders(admin.id, days, s.notifyTenant)

    // 5. แจ้งซ่อมไม่มีคนรับ (หลัง maintUnackHours)
    if (s.maintEnabled)
      await sendUnacknowledgedMaintReminders(admin.id, s.maintUnackHours)
  }
})
```

---

## 11. PDF Generation

### Receipt PDF (PDFKit)
```
Layout:
  Header: apartment name, address, logo placeholder
  Info:   receipt no (#RCP-YYYY-XXXXX), date, tenant name, room
  Items:  rent | electric | water | common fee | late fee
  Total:  bold, green
  Footer: "ชำระครบถ้วนแล้ว" stamp + signature line
Font: embed Sarabun-Regular.ttf + Sarabun-Bold.ttf
```

### Contract PDF (PDFKit)
```
Layout:
  Title:  "สัญญาเช่าที่พัก" centered
  No:     CTR-YYYY-XXXXX
  Parties: landlord info, tenant info (name, ID card)
  Terms:  room no, rent, deposit, start/end date, due day, late fee
  Custom: terms text block
  Sign:   two signature lines (landlord + tenant) with date
Font: same Sarabun embed
```

---

## 12. Design System (Tailwind)

```javascript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      line: {
        DEFAULT: '#06C755',
        dark:    '#04A244',
        light:   '#EAF3DE',
      }
    },
    fontFamily: {
      sans: ['Sarabun', 'sans-serif'],
    }
  }
}
```

**UI Patterns:**
- TopBar: back arrow + title + right action (ทุกหน้า LIFF)
- BottomNav admin: ภาพรวม / บิล / แชท / ตั้งค่า
- BottomNav tenant: หน้าหลัก / บิล / แจ้งซ่อม / โปรไฟล์
- StatusBadge: green=paid, amber=pending, red=overdue, blue=info, gray=vacant
- PropertyCard: icon + name + bank + occupancy bar + 3 stats
- UnitRow: room chip (color by status) + tenant name + amount + badge
- NotifRow: icon + title + current config + toggle
- InvoiceFlexCard in LIFF: green header, line items, total, pay button
- Rich Menu: 2×3 grid, each button opens LIFF path

---

## 13. Build Order

Implement **strictly in this sequence** — do not skip ahead:

```
Step 1  │ Docker Compose + .env + Prisma schema + migration + seed
Step 2  │ Backend auth: POST /auth/line → verify LINE token → JWT
Step 3  │ Frontend LIFF init → login → call /auth/line → role routing
Step 4  │ Property CRUD (admin: create property with bank/promptpay)
Step 5  │ Unit CRUD (rooms within a property)
Step 6  │ Tenant form (3 steps: info → contract → invite send)
Step 7  │ LinkRoom.tsx — tenant clicks invite → POST /tenants/link
Step 8  │ LINE Rich Menu — setTenantRichMenu() after link
Step 9  │ Meter recording + Invoice builder + send via LINE Bot
Step 10 │ Tenant: payment flow (QR → slip upload → success screen)
Step 11 │ Admin: SlipReview (approve/reject + receipt PDF)
Step 12 │ Notification settings UI + cron scheduler
Step 13 │ Contract PDF generation + print
Step 14 │ Maintenance tickets (create, status, chat)
Step 15 │ Reports + tenant chat via webhook
```

---

## 14. Testing Checklist

```
Auth
□ LINE Login works on real device (HTTPS + LINE app required)
□ Role routing: Admin → Portfolio, Tenant → TenantHome, NEW → LinkRoom

Invite
□ SMS delivered to real phone number
□ Tenant taps link → LIFF opens → LINE linked → Admin notified
□ Rich Menu appears on tenant's LINE OA chat after linking

Payment
□ PromptPay QR amount matches invoice total exactly
□ Slip upload reaches S3 and appears in Admin SlipReview
□ OCR extracts correct amount and date from slip
□ Approve → receipt PDF generated → LINE message sent to tenant
□ Receipt PDF: Thai text renders correctly (Sarabun embedded)

Notifications
□ Invoice sent on correct day + time
□ Reminder sent X days before due
□ Overdue reminder repeats every N days
□ Quiet hours block all notifications
□ Contract expiry alert fires at correct days

Maintenance
□ Ticket created → Admin notified immediately
□ Status update → tenant notified via LINE push

General
□ All screens work at 360px viewport (mobile)
□ Thai language throughout, no garbled characters
□ HTTPS enforced (required for LIFF)
□ Webhook signature verified on every LINE request
```

---

## 15. Contract Template (Placeholder)

> **รอรับ format สัญญาจากเจ้าของโปรเจกต์**
>
> เมื่อได้รับ ให้ implement ใน:
> - `backend/src/services/contractTemplate.ts` — Thai text builder
> - `frontend/src/components/pdf/ContractPDF.tsx` — react-pdf component
>
> Requirements:
> - Embed Sarabun font (Thai characters)
> - Server-side: PDFKit for download link (presigned S3 URL)
> - Client-side: open in new tab → browser print dialog
> - Fields: contract no, parties, room details, financial terms, signature lines
