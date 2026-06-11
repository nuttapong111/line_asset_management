# Claude Code Prompt — Step 7: Contract PDF + Maintenance + Reports

Read CLAUDE.md section 11 (PDF) and section 12 (design system).

---

## Task: Contract PDF, maintenance tickets, and reports

### Backend: Contract routes

**POST /api/contracts**             create contract (linked to tenant + unit)
**GET  /api/contracts/:id**         get contract detail
**POST /api/contracts/:id/pdf**     generate PDF → return S3 URL
**PUT  /api/contracts/:id/renew**   renew contract (extend endDate, keep same terms)
**PUT  /api/contracts/:id/terminate** terminate early

#### contractTemplate.ts — Thai text builder:
```typescript
export function buildContractText(data: ContractData): ContractSection[] {
  // Returns structured sections for PDFKit to render:
  // 1. Title: "สัญญาเช่าที่พัก"
  // 2. Contract no: CTR-YYYY-XXXXX
  // 3. Parties: ผู้ให้เช่า (admin/property), ผู้เช่า (tenant)
  // 4. Property details: address, room no, floor
  // 5. Financial: ค่าเช่า, เงินประกัน, วันครบกำหนด, ค่าปรับ
  // 6. Term: start date, end date, duration
  // 7. Custom terms text (if any)
  // 8. Signature section: 2 lines + date fields
  // NOTE: Full format TBD by project owner — use placeholder format for now
}
```

pdfService.generateContract(contractId): Promise<string> (returns S3 URL)

### Backend: Maintenance routes

**POST /api/maintenance**                    create ticket (tenant or admin)
**GET  /api/maintenance**                    list (admin: all; tenant: own unit)
**GET  /api/maintenance/:id**                ticket detail + messages
**PUT  /api/maintenance/:id/status**         update status (admin only)
**POST /api/maintenance/:id/messages**       add chat message
**PUT  /api/maintenance/:id/schedule**       set scheduledAt (admin only)

Auto-generate ticketNo: MT-${year}-${String(seq).padStart(5,'0')}
On create: push LINE to admin (buildMaintNewFlex)
On status change: push LINE to tenant with new status

### Backend: Reports routes

**GET /api/reports/revenue**
Query: ?adminId, ?propertyId, ?year, ?month
Return: {
  summary: { total, collected, pending, overdue },
  byProperty: [{ propertyId, name, revenue, occupancyRate }],
  byMonth: [{ month, year, revenue }]  // last 6 months
}

**GET /api/reports/export**
Query: ?format=csv (simple CSV export of invoices)

### Frontend: Contract

**ContractView.tsx (admin)**
- Contract header card: no, parties, dates, financial terms (2-col grid)
- Expiry warning card (amber border) with "ต่อสัญญา" button
- Activity timeline: linked, signed, etc.
- Buttons: PDF ↓ | ปริ้น | ยกเลิกสัญญา

**ContractView.tsx (tenant)**
- Same layout, read-only
- Download + Print buttons

### Frontend: Maintenance

**MaintenanceList.tsx (tenant)**
- Filter chips: ทั้งหมด | รอดำเนินการ | กำลังซ่อม | เสร็จแล้ว
- MaintenanceCard per ticket: category icon + title + date + status badge
- "แจ้งซ่อมใหม่" FAB

**MaintenanceForm.tsx**
- Category chips: ไฟฟ้า | ประปา | เครื่องใช้ไฟฟ้า | ทั่วไป
- Title input, description textarea
- Photo upload (max 5 images, show thumbnails)
- Submit → POST /api/maintenance

**MaintenanceDetail.tsx**
- Status badge + ticket info
- Photo gallery
- Timeline (status history)
- Chat section: messages list + input
- Appointment card (if scheduledAt set)
- Tenant: "ยืนยันเสร็จสิ้น" button when status=DONE

### Frontend: Reports.tsx (admin)

- Period selector: รายเดือน | รายไตรมาส | รายปี
- 3 metric cards: รับแล้ว | รอรับ | ค้างชำระ
- Bar chart (last 6 months revenue): use SVG bars, no external chart lib
- Per-property breakdown list
- Per-tenant status list (for current period)
- Export CSV button

### Test
- Generate contract PDF for seed tenant — verify Thai text renders
- Create maintenance ticket — verify admin gets LINE notification
- Check status update pushes LINE to tenant
- Load reports page — verify revenue numbers match seed data
