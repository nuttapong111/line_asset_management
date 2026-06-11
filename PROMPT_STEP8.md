# Claude Code Prompt — Step 8: Meter Recording + Invoice Builder + Billing Overview

---

## Task: Meter + Invoice builder + Billing overview

### Backend: Meter routes

**POST /api/meters**              record meter reading (admin)
**GET  /api/meters/:unitId**      list readings for a unit
**GET  /api/meters/:unitId/latest** get latest reading (used to pre-fill invoice)

Validation: month+year must not already exist for this unit.
Auto-calculate: usedElec = currElec - prevElec, usedWater = currWater - prevWater

### Backend: Invoice builder

**POST /api/invoices/build-preview**
Body: { unitId, month, year }
Return: calculated invoice draft (not saved):
```json
{
  "unitId": "...",
  "month": 6, "year": 2567,
  "rentAmount": 4500,
  "electricAmount": 910,  // 182 units × 5
  "waterAmount": 108,     // 6 units × 18
  "commonFee": 50,
  "lateFee": 0,
  "total": 5568,
  "dueDate": "2567-06-05",
  "meterReading": { "prevElec": 5170, "currElec": 5352, ... }
}
```

**POST /api/invoices/send-all**
Body: { propertyId, month, year }
1. Build invoices for all OCCUPIED units
2. Save each Invoice
3. Push LINE Flex to each tenant
4. Return: { sent: number, failed: number, errors: [] }

### Frontend: MeterRecording.tsx

- Unit selector (dropdown if admin has many units, or fixed if from unit context)
- Two meter boxes side by side: ⚡ ไฟฟ้า | 💧 น้ำ
  Each box:
  - Previous reading (read-only, from last MeterReading)
  - Current reading (input, numeric, large monospace font)
  - Calculated usage: "ใช้ไป X หน่วย = ฿Y" (green pill)
- Photo upload: 2 slots (เลือกรูปมิเตอร์ไฟ / รูปมิเตอร์น้ำ)
- "บันทึกมิเตอร์" button → POST /api/meters

### Frontend: InvoiceBuilder.tsx

- Month/year selector (defaults to current month)
- Property selector (admin's properties)
- Unit list with preview calculations:
  Each unit row: room + tenant name + calculated total + "แก้ไข" link
- Grand total at bottom
- "ส่งใบแจ้งหนี้ทั้งหมด" button → POST /api/invoices/send-all
- Success modal: "ส่งสำเร็จ X ห้อง / ล้มเหลว Y ห้อง"

### Frontend: BillingOverview.tsx

- Month/year selector
- 3 metric cards: รับแล้ว | รอรับ | ค้างชำระ
- Bulk action buttons: "ส่งบิลทั้งหมด" | "เตือนค้างชำระ"
- Grouped by property:
  Section header: property name
  UnitRows: tenant + amount + status badge
  Tap row → SlipReview (if pending) or ReceiptView (if paid)
- Tenant with overdue: show days overdue + late fee in red

### Test
- Record meter for seed unit
- Build preview invoice — verify calculations correct
- Send all invoices — verify LINE messages fired
- Billing overview shows correct status grouping
