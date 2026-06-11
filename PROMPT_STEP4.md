# Claude Code Prompt — Step 4: Admin — Property + Unit + Tenant + Invite

Read CLAUDE.md sections 4 (schema), 7 (invite flow), and design patterns section 12.

---

## Task: Admin property management + tenant invite

### Backend routes

**POST   /api/properties**         create property (name, address, bankName, bankAccount, promptpayNumber)
**GET    /api/properties**         list all properties for current admin (include unit count, occupancy)
**GET    /api/properties/:id**     single property + units with tenant + latest invoice status
**PUT    /api/properties/:id**     update property
**DELETE /api/properties/:id**     delete (only if no active tenants)

**POST   /api/properties/:id/units**      create unit
**GET    /api/properties/:id/units**      list units with status
**PUT    /api/units/:id**                 update unit
**DELETE /api/units/:id**                delete (only if VACANT)
**GET    /api/units/:id/invite-link**     return invite URL with fresh token (reset expiry to +7 days)

**POST   /api/tenants**                  create tenant record (no lineUserId yet)
**GET    /api/tenants/:id**              tenant detail
**PUT    /api/tenants/:id**              update
**POST   /api/tenants/link**             { inviteToken, lineUserId } — link LINE
**POST   /api/tenants/:id/invite/sms**   send SMS via Twilio
**POST   /api/tenants/:id/invite/line**  send Flex invite via LINE Messaging API

All routes: require JWT auth middleware, verify adminId owns the resource.

### Frontend pages (admin)

**Portfolio.tsx**
- Grid of PropertyCard components
- Each card: property name, bank info, occupancy bar (occupied/total), 3 stats (rooms, tenants, overdue count)
- "เพิ่มอสังหาฯใหม่" dashed card at bottom
- KPI strip at top: total properties, total rooms, total monthly revenue, total overdue
- Bottom nav: ภาพรวม | บิล | แชท | ตั้งค่า

**PropertyDetail.tsx**
- TopBar with property name
- Filter chips: ทั้งหมด | มีผู้เช่า | รอยืนยัน | ค้าง | ว่าง
- UnitRow list: room chip (color by status) + tenant name + amount + badge
- Bank account info card at bottom
- FAB or TopBar button: "เพิ่มห้อง"

**AddProperty.tsx**
- Form: ชื่ออสังหาฯ, ที่อยู่, ธนาคาร, เลขบัญชี, เบอร์ PromptPay
- Validate all fields with Zod
- On submit → POST /api/properties → navigate to PropertyDetail

**AddUnit.tsx**
- Form: เลขห้อง, ชั้น, ราคาเช่า, ค่าไฟ/หน่วย, ค่าน้ำ/หน่วย, ค่าส่วนกลาง
- Amenity tags: แอร์, เฟอร์นิเจอร์, ที่จอดรถ, etc.
- Photo upload (optional)

**AddTenant.tsx → ContractSetup.tsx → InviteTenant.tsx**

3-step wizard with stepper indicator:

Step 1 (AddTenant):
- ชื่อ-นามสกุล*, เบอร์โทร*, LINE ID (optional), เลขบัตรประชาชน
- เอกสารแนบ (optional file upload)
- "ถัดไป" → Step 2

Step 2 (ContractSetup):
- วันเริ่มเช่า, ระยะสัญญา (6m/1y/2y/custom), ค่าเช่า, เงินประกัน, วันครบกำหนด, ค่าปรับ/วัน
- Terms text area (optional)
- "ถัดไป" → Step 3

Step 3 (InviteTenant):
- Show tenant summary card
- Invite channel selection:
  SMS card: phone number, "ส่ง SMS" button
  LINE card: LINE ID (if provided), "ส่งผ่าน LINE" button (green border)
- Invite link display + copy button
- Status indicator: "รอผู้เช่ากดลิงก์" with "ส่งซ้ำ" button

### Components to build

**PropertyCard** — icon, name, bank info, occupancy bar, 3 stats, chevron right
**UnitRow** — room number chip (green=occupied, red=overdue, amber=pending, gray=vacant), tenant name, amount, badge
**InviteStatusCard** — clock icon, waiting text, resend button (warning border)

### Test
- Create a property in the UI
- Add a unit to it
- Create tenant + contract through 3-step wizard
- Verify invite link is generated
- Verify SMS would be sent (check Twilio console in dev/test mode)
