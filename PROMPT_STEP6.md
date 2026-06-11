# Claude Code Prompt — Step 6: Notification Settings + Cron Scheduler

Read CLAUDE.md section 10 (scheduler) and the NotifSettings schema in section 4.

---

## Task: Notification settings UI + cron jobs

### Backend routes

**GET /api/notifications/settings**       get admin's NotifSettings (create defaults if not exist)
**PUT /api/notifications/settings**       update settings (validate with Zod)

Zod schema to validate:
```typescript
const NotifSettingsSchema = z.object({
  invoiceEnabled:       z.boolean(),
  invoiceSendDay:       z.number().int().min(1).max(28),
  invoiceSendTime:      z.string().regex(/^\d{2}:\d{2}$/),
  rentReminderEnabled:  z.boolean(),
  rentReminderDays:     z.array(z.number().int().min(1).max(30)),
  rentReminderTime:     z.string().regex(/^\d{2}:\d{2}$/),
  overdueEnabled:       z.boolean(),
  overdueRepeatDays:    z.number().int().min(1).max(7),
  overdueSendTime:      z.string().regex(/^\d{2}:\d{2}$/),
  contractEnabled:      z.boolean(),
  contractReminderDays: z.array(z.number().int().min(1).max(90)),
  contractSendTime:     z.string().regex(/^\d{2}:\d{2}$/),
  notifyTenant:         z.boolean(),
  maintEnabled:         z.boolean(),
  maintUnackHours:      z.number().int().min(1).max(24),
  quietEnabled:         z.boolean(),
  quietStart:           z.string().regex(/^\d{2}:\d{2}$/),
  quietEnd:             z.string().regex(/^\d{2}:\d{2}$/),
})
```

### Backend: scheduler.ts

Implement full cron from CLAUDE.md section 10:

```typescript
// Helper: isQuietHour(current: string, start: string, end: string): boolean
// Handle overnight quiet hours (e.g. 22:00 to 07:00)

// sendInvoicesForAdmin(adminId):
//   Find all OCCUPIED units for admin's properties
//   For each unit: find or create Invoice for current month
//   If not sentAt: call lineService.pushInvoice + mark sentAt=now

// sendRentReminders(adminId, daysAhead):
//   Find invoices where dueDate = today + daysAhead, status=PENDING
//   Push buildReminderFlex to each tenant

// sendOverdueReminders(adminId, repeatDays):
//   Find OVERDUE invoices where (today - dueDate) % repeatDays === 0
//   Calculate lateFee = daysLate * contract.lateFeePerDay
//   Push buildOverdueFlex to each tenant

// sendContractExpiryReminders(adminId, daysAhead, notifyTenant):
//   Find contracts where endDate = today + daysAhead, status=ACTIVE
//   Push to admin always; push to tenant if notifyTenant=true

// sendUnacknowledgedMaintReminders(adminId, hours):
//   Find maintenance tickets status=NEW, createdAt < now - hours
//   Push reminder to admin
```

Register cron in app.ts after DB connection:
```typescript
import { startScheduler } from './services/scheduler'
startScheduler()
```

### Frontend: NotifSettings.tsx (4 sections)

**Section 1 — Overview + master toggle**
- Master toggle: "แจ้งเตือนทั้งหมด" (toggles all sub-toggles)
- NotifRow for each type:
  ใบแจ้งหนี้ | เตือนล่วงหน้าค่าเช่า | ค่าชำระค้าง | สัญญาใกล้หมด | แจ้งซ่อมใหม่
  Each row: icon + name + current config summary + on/off toggle
- Quiet hours: toggle + start/end time selects (HH:mm options)
- "บันทึก" button (PUT /api/notifications/settings)

**Section 2 — ค่าเช่า detail (tap NotifRow to expand)**
- Send day selector: chips [1, 5, 10, 15, 25, กำหนดเอง]
- Send time picker: 6-chip grid [06:00, 08:00, 09:00, 10:00, 12:00, 18:00] (single select)
- Reminder days: multi-select chips [7 วัน, 3 วัน, 1 วัน, วันนั้น]
- Overdue repeat toggle + interval chips [1, 2, 3, 5, 7 วัน]
- Overdue send time: 6-chip grid (single select)

**Section 3 — สัญญา + ซ่อม**
- Contract expiry: toggle, reminder days chips (multi: [60, 30, 14, 7, 3 วัน]), time picker
- Notify tenant toggle
- Maintenance: toggle, unack resend interval chips [30นาที, 1ชม., 3ชม., 1วัน]

**Section 4 — Preview (read-only)**
- Show 4 sample Flex cards (invoice, reminder, overdue, contract) as static previews
- Demonstrates what tenant will actually see in LINE

### Component: TimeChipGrid
```tsx
// Props: options: string[], selected: string, onChange: (v: string) => void
// Renders 6-chip grid, single select, green when selected
```

### Component: DayChipGroup
```tsx
// Props: options: number[], selected: number[], onChange: (v: number[]) => void
// Renders chips, multi-select, green when selected
```

### Test
- Save settings and reload — verify persisted
- Manually trigger sendInvoicesForAdmin in a test script → verify LINE push fires
- Check quiet hours logic with a unit test
