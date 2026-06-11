# Claude Code Prompt — Step 5: Payment Flow (QR + Slip + Receipt)

Read CLAUDE.md section 8 (payment flow) carefully. This is the most critical flow.

---

## Task: Complete payment flow end-to-end

### Backend routes

**GET  /api/invoices**                    list invoices (admin: all; tenant: own unit)
**GET  /api/invoices/:id**                invoice detail with payment status
**POST /api/invoices**                    create invoice (admin only)
**POST /api/invoices/send-bulk**          send invoices to all tenants of a property
**GET  /api/payments/:invoiceId/qr**      generate PromptPay QR payload + amount
**POST /api/payments/:invoiceId/slip**    upload slip image (multipart/form-data)
**POST /api/payments/:paymentId/approve** admin approve → generate receipt PDF
**POST /api/payments/:paymentId/reject**  admin reject { rejectReason }
**GET  /api/payments/:paymentId/receipt** get receipt URL

#### QR endpoint implementation:
```typescript
// GET /api/payments/:invoiceId/qr
// 1. Find invoice, verify tenant owns it (or admin)
// 2. Get property.promptpayNumber
// 3. import generatePayload from 'promptpay-qr'
//    const payload = generatePayload(promptpayNumber, { amount: invoice.total })
// 4. Return { payload, amount, promptpayNumber, expiresAt: now + 30min }
```

#### Slip upload implementation:
```typescript
// POST /api/payments/:invoiceId/slip
// 1. multer: accept image/jpeg, image/png, max 10MB
// 2. Upload to S3: key = `slips/${invoiceId}/${timestamp}.jpg`
// 3. Create/update Payment record: slipUrl, slipUploadedAt, status=SLIP_UPLOADED
// 4. Update invoice.status = SLIP_UPLOADED
// 5. Push LINE Flex to Admin: buildMaintNewFlex → buildSlipReceivedFlex (new template needed)
// 6. Reply to tenant (if replyToken available): "ได้รับสลิปแล้วครับ กำลังตรวจสอบ"
```

#### Approve + Receipt PDF:
```typescript
// POST /api/payments/:paymentId/approve
// 1. Update payment: status=APPROVED, approvedAt=now
// 2. Update invoice: status=PAID
// 3. Generate receipt number: RCP-${year}-${String(seq).padStart(5,'0')}
// 4. Call pdfService.generateReceipt(data) → Buffer
// 5. Upload PDF to S3: key = `receipts/${paymentId}.pdf`
// 6. Update payment: receiptNo, receiptUrl, receiptPdfUrl
// 7. Push LINE to tenant: buildReceiptFlex with download URL
```

#### pdfService.ts — Receipt generation:
```typescript
import PDFDocument from 'pdfkit'
// 1. Create doc, register Sarabun font (embed TTF from assets/)
// 2. Header: property name + address (bold, centered)
// 3. "ใบเสร็จรับเงิน" title
// 4. Info grid: receipt no, date, tenant name, room
// 5. Line items table: item | amount
// 6. Total line (bold, green color)
// 7. "ชำระครบถ้วนแล้ว ✓" stamp box
// 8. Signature line at bottom
// Return as Buffer, caller uploads to S3
```

### Frontend — Tenant payment flow (5 screens)

**TenantHome.tsx**
- Green header: greeting + room info
- Invoice card: amount (large), due date badge, "ชำระเงิน" button (opens PaymentSelect)
- 2×2 quick grid: ใบแจ้งหนี้ | ใบเสร็จ | แจ้งซ่อม | สัญญา
- Latest payment row at bottom

**InvoiceDetail.tsx**
- Green header: invoice title + amount
- Line items card: rent, electric (X units × ฿Y), water, common fee
- Meter readings card: prev/curr for elec + water (2-col grid)
- "ชำระเงิน ฿X,XXX" primary button

**PaymentSelect.tsx**
- Amount display
- PromptPay option (selected by default, green border)
- LINE Pay option (disabled, "เร็ว ๆ นี้" label)
- "แสดง QR Code" button

**PaymentQR.tsx**
- Back button to PaymentSelect
- Fetch QR from GET /api/payments/:invoiceId/qr
- Display: <QRCode value={payload} size={200} />
- Amount + PromptPay number below QR
- Countdown timer (30 min)
- Slip upload zone below:
  - Dashed border → camera / gallery picker
  - When file selected: show preview + "ส่งสลิป" button

**SlipUpload.tsx** (or inline in PaymentQR)
- Show selected file preview
- Confirm amount display
- "ส่งสลิป" button → POST /api/payments/:invoiceId/slip
- Loading state during upload

**PaymentSuccess.tsx**
- Green checkmark ring
- "ส่งสลิปเรียบร้อย" title
- Summary card: amount, room, timestamp
- "กลับ LINE Chat" button → liff.closeWindow()

### Frontend — Admin slip review

**SlipReview.tsx**
- Tenant info + status badge
- Slip image display (from S3 URL)
- OCR result card (green box: ยอด ✓ วันที่ ✓ ตรงกัน ✓)
- Reject reason input (shown when reject button tapped)
- Two buttons: "ปฏิเสธ" (red bg) | "อนุมัติ" (green)

**ReceiptView.tsx**
- Receipt details: no, date, tenant, room, line items, total
- "ชำระครบถ้วนแล้ว ✓" badge
- Two buttons: "PDF ↓" (open S3 URL in new tab) | "ปริ้น" (window.print())
- "ส่งให้ผู้เช่าทาง LINE" button (resend flex)

### Test
- Create invoice for seed tenant
- Fetch QR and verify payload is valid PromptPay string
- Upload a test slip image
- Approve and verify receipt PDF is generated and stored
- Verify LINE messages are pushed (check LINE bot test tool or mock)
