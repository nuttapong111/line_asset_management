# Claude Code Prompt — Step 3: LINE lib + Webhook + Rich Menu

Read CLAUDE.md section 9 (LINE lib) and section 8 (payment flow) first.

---

## Task: Complete LINE integration layer

### 1. backend/src/lib/line/client.ts
Singleton LINE Client + middleware export.

### 2. backend/src/lib/line/types/line.types.ts
All TypeScript interfaces:
- InvoiceData, ReminderData, OverdueData, ReceiptData
- ContractExpiryData, MaintData, LinkedData, InviteData
- ChatMessage

### 3. backend/src/lib/line/flexMessages.ts
Implement ALL builders from CLAUDE.md section 9.

**buildInvoiceFlex(d: InvoiceData)**
- Header: LINE green (#06C755), show month/year, total amount bold, room + tenant name
- Body: line items (ค่าเช่า, ค่าไฟ, ค่าน้ำ, ส่วนกลาง), separator, total in green
- Footer: primary button "#06C755" label "ชำระเงิน" → uri: d.liffUrl

**buildReminderFlex(d: ReminderData)**
- Header: amber (#EF9F27), "ครบกำหนดใน X วัน", amount
- Footer: "ชำระเงินตอนนี้" button

**buildOverdueFlex(d: OverdueData)**
- Header: red (#E24B4A), "ค้างชำระ X วัน", total + late fee
- Body: original amount + late fee rows
- Footer: "ชำระด่วน" button red

**buildReceiptFlex(d: ReceiptData)**
- Header: blue (#185FA5), "ชำระเงินสำเร็จ", amount
- Body: receipt no, date
- Footer: "ดาวน์โหลดใบเสร็จ PDF" button → uri: d.receiptUrl

**buildContractExpiryFlex(d: ContractExpiryData)**
- Header: blue, "สัญญาใกล้หมด X วัน", room name
- Body: end date
- Footer: 2 buttons side-by-side: "ต่อสัญญา" (primary) + "ดูสัญญา" (secondary)

**buildMaintNewFlex(d: MaintData)**
- Header: gray (#888780), "แจ้งซ่อมใหม่", ticket title
- Body: room, tenant, category, time
- Footer: 2 buttons: "รับเรื่อง" (postback action) + "ดู ticket" (uri)

**buildLinkedFlex(d: LinkedData)**
- Header: green, "ผูก LINE สำเร็จ", tenant name
- Body: room, linked time
- Footer: "ดูโปรไฟล์ผู้เช่า" button

**buildInviteFlex(d: InviteData)**
- Header: green, "คำเชิญเป็นผู้เช่า", property name
- Body: room no, rent amount, start date
- Footer: "ยืนยันและผูก LINE" button → uri: invite LIFF url

### 4. backend/src/lib/line/lineService.ts
Implement all push/reply/broadcast functions from CLAUDE.md section 9.
Use Promise.allSettled for broadcastInvoices (never fail all if one fails).

### 5. backend/src/lib/line/richMenu.ts
```typescript
// Rich Menu layout: 2500 × 843 px, 2 rows × 3 cols
// Row 1: ชำระเงิน (x:0)   | ใบเสร็จ (x:833)   | ใบแจ้งหนี้ (x:1667)
// Row 2: แจ้งซ่อม (x:0,y:421) | สัญญา (x:833,y:421) | ติดต่อ (x:1667,y:421)
// Each action: type "uri", uri = `${LIFF_BASE_URL}/{path}`
// Paths: /payment | /receipt | /invoice | /maintenance/new | /contract | /contact

export async function setTenantRichMenu(lineUserId: string): Promise<void>
export async function removeTenantRichMenu(lineUserId: string): Promise<void>
// Note: Rich Menu image must be uploaded separately (create a placeholder 2500×843 PNG)
```

### 6. backend/src/lib/line/webhook.ts + route

Router at POST /api/webhook (protected by lineMiddleware):

**follow event:**
```
1. find Tenant by lineUserId
2. if found: setTenantRichMenu(userId)
3. reply: "สวัสดีครับ {name} ยินดีต้อนรับ"
4. if not found: reply with invite info
```

**message event (text):**
```
Switch on text.trim():
  "ใบเสร็จล่าสุด" → find latest APPROVED payment → pushReceiptFlex
  "ชำระเงิน" | "จ่ายค่าเช่า" → find PENDING invoice → reply LIFF link
  "แจ้งซ่อม"  → reply LIFF /maintenance/new link
  "สัญญา"     → reply LIFF /contract link
  default     → save ChatMessage + notify admin + reply quick menu
```

**postback event:**
```
Parse: JSON.parse(event.postback.data) → { action, paymentId?, ticketId? }
  APPROVE_PAYMENT  → call approvePayment service
  REJECT_PAYMENT   → call rejectPayment service
  ACK_MAINTENANCE  → update ticket status to ACKNOWLEDGED
```

### 7. Register webhook route in app.ts
`app.use('/api/webhook', webhookRouter)`

### 8. Test
- Send mock webhook POST to /api/webhook with follow event body
- Confirm lineService functions are callable without errors
- Check TypeScript compiles clean
