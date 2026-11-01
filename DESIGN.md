# PropFlow Design Spec (v1.0)

Source of truth for rewriting the PropFlow frontend (React 18 + TypeScript + Vite + Tailwind).
Every screen in `screens/` is a high-fidelity mockup. Build the UI to match them pixel-close.

Package contents:

| Path | What |
|------|------|
| `DESIGN.md` | This spec: tokens, components, layout rules, screen ↔ route map |
| `tokens/tokens.css` | CSS variables + font import. Import once globally |
| `tokens/tailwind.config.js` | Tailwind preset with the same tokens |
| `tokens/tokens.json` | Same tokens as JSON + status → color/label map |
| `screens/**.dc.html` | Mockup source for each screen (43 screens + 2 shared components + design-system board + flows board) |
| `.cursor/rules/propflow-design.mdc` | Cursor rule that points the agent to this spec |

---

## 1. How to read the `.dc.html` mockups

Each file is plain HTML with **inline styles** (exact px values, hex colors) plus a small templating layer:

- `<x-dc> … </x-dc>` wraps the screen markup. Ignore `<helmet>`, `support.js` and `data-props`.
- `{{name}}` = a value returned by `renderVals()` in the `<script type="text/x-dc">` block at the bottom. That function holds the mock data (rows, chips, colors per status). Treat it as the **props/data shape** for the React component.
- `<sc-for list="{{items}}" as="item">` = `items.map(item => …)`.
- `<sc-if value="{{cond}}">` = `{cond && …}`.
- `<dc-import name="TabBar" role="owner" active="bill">` = render the shared component `<TabBar role="owner" active="bill" />` (source in `screens/components/`).
- `<a href="Other.dc.html">` = navigation to that screen (see route map in §6).

Inline style → Tailwind is a direct translation, using the tokens in §3 (e.g. `background:#047C3B` → `bg-primary`, `border-radius:16px` → `rounded-card`, `font-family:Anuphan` → `font-display`).

`screens/foundation/Main.dc.html` is the visual design-system board; `Flows.dc.html` shows the IA and the 5 core user flows.

---

## 2. Principles

1. **LINE-first.** Tenants never log in with a password. Every tenant task starts from a LINE Flex message or the Rich Menu and finishes in ≤ 4 taps.
2. **Money and status first.** Amounts are the largest text on a screen (Anuphan 700, tabular numbers). Every status is shown as **color + Thai word**, never color alone.
3. **One screen, one job.** Primary action lives in a sticky bottom action bar on mobile. Frequent owner tasks (review slip, read meters, send bills) are ≤ 2 taps from Overview.
4. **OCR is advice, not approval.** Slip OCR results are shown as hint cards (green match / red mismatch); the owner always presses Approve/Reject.
5. **Thai copy, short and polite.** Use the exact strings from the mockups. Use ครับ/ค่ะ only in system chat replies, not in UI labels.

---

## 3. Tokens

All values also live in `tokens/`. Never hard-code a hex that is not listed here.

### Color

| Token | Hex | Use |
|-------|-----|-----|
| `brand` | `#06C755` | Logo tile, icons on dark, progress bars, CTA on dark hero (with **ink** text). Never white text on it (2.2:1) |
| `primary` | `#047C3B` | Primary buttons, links, active tab, selected borders |
| `primary-hover` | `#035E2D` | Hover/pressed |
| `primary-soft` | `#E7F8EE` | Selected chip bg, success bg, icon tiles |
| `hero` | `#0F3D25` | Dark hero card (tenant total due, invite header, Portal login panel) |
| `sidebar` / `sidebar-admin` | `#0F2A1C` / `#1E1638` | Portal sidebars (owner / admin) |
| `ink` | `#0F1F17` | Primary text |
| `ink-2` | `#33403A` | Secondary body text |
| `muted` | `#4F5F57` | Labels, captions, inactive tab |
| `placeholder` | `#9AA8A1` | Dashed upload borders, chevrons (decorative only) |
| `canvas` | `#F4F6F5` | Page background |
| `surface` / `surface-2` | `#FFFFFF` / `#F0F2F1` | Cards / inset read-only fields |
| `segment` | `#E8ECEA` | Segmented control track |
| `line` / `line-soft` / `line-input` | `#DCE3DF` / `#EEF1EF` / `#C9D2CD` | Borders / list dividers / input borders |

### Status colors (fg text on bg pill)

| Kind | fg | bg | Statuses |
|------|----|----|----------|
| info | `#1A4FBF` | `#EAF1FE` | Invoice `PENDING`, payment `WAITING_SLIP`, subscription `TRIAL`, maint `ACKNOWLEDGED` |
| warn | `#8A4B05` | `#FEF3E2` | `SLIP_UPLOADED`, `UNDER_REVIEW`, `IN_PROGRESS`, `SCHEDULED`, `GRACE`, unit `MAINTENANCE` |
| ok | `#046A33` | `#E7F8EE` | `PAID`, `APPROVED`, `DONE`, `ACTIVE`, unit `OCCUPIED` |
| danger | `#A8221A` | `#FDECEA` | `OVERDUE`, `REJECTED`, `SUSPENDED`, maint `NEW` (needs action) |
| neutral | `#4A5550` | `#F0F2F1` | `CANCELLED`, `CLOSED`, unit `VACANT` |
| admin | `#5A3496` | `#F1ECFA` | Admin badge, plan `PERMANENT` |

Full enum → `[kind, Thai label]` map: `tokens/tokens.json → statusMap`. Build one `<StatusBadge kind status />` from it.

### Typography

Fonts: **Anuphan** (display, headings, amounts) + **Sarabun** (body, UI). Load both from Google Fonts (`tokens.css`). PDFs keep Sarabun (unchanged).

| Style | Font | Size/line | Weight | Use |
|-------|------|-----------|--------|-----|
| Display | Anuphan | 32/40 | 700 | Desktop page titles (28px in Portal header) |
| Screen title | Anuphan | 26/34 | 700 | Mobile root-tab titles (เอกสาร, ชุมชน, บิล, ตั้งค่า) |
| Title | Anuphan | 22/30 | 600–700 | Card headers, names |
| Section | Anuphan | 18/26 | 600 | Section headings, AppBar title |
| Body | Sarabun | 16/26 | 400 | Paragraphs |
| UI | Sarabun | 15/22 | 600 | List row titles, buttons (desktop) |
| Label | Sarabun | 14/20 | 600 | Field labels, chips |
| Caption | Sarabun | 13/18 (12) | 400 | Meta lines, helper text |
| Amount L | Anuphan | 34–40 | 700 tabular | Hero amount |
| Amount M | Anuphan | 24–30 | 700 tabular | Bill totals, stat tiles |

Always `font-variant-numeric: tabular-nums` on money. Format: `฿7,300.00` in bills/receipts, `฿84,200` (no decimals) in summaries.

### Spacing, radius, size

- Spacing scale: 4, 8, 12, 16, 24, 32, 48. Mobile screen padding **16px**; card padding 14–16px; gap between cards 12–14px.
- Radius: input 10, button 12, mobile full-width CTA 14, card 16, hero/feature card 20, pill 999.
- Heights: mobile button **52**, desktop button **44**, input **48** (44 in dense forms), AppBar **56**, TabBar **82** (incl. 18px bottom safe area), list row ≥ 52, touch targets ≥ 44.
- Shadows: almost none. FAB `0 6px 16px rgba(4,124,59,.30)`; paper documents `0 2px 10px rgba(15,31,23,.10)`.

### Icons

Stroke icons, 2px stroke, round caps/joins, 20–24px (lucide-react matches closely: `Home, FileText, Users, Wrench, LayoutGrid, Receipt, Settings, QrCode, Phone, MessageSquare, Camera, Zap, Droplet, Calendar, ChevronRight, ChevronLeft, Plus, Search, Bell, Clock, AlertTriangle, CheckCircle2, Trash2, Download, Lock`). No emoji in UI.

---

## 4. Components

Build these once in `src/components/ui/` and compose screens from them.

| Component | Spec (see `Main.dc.html` for visuals) |
|-----------|----------------------------------------|
| **Button** | variants `primary` (bg primary, white), `secondary` (white, 1.5px primary border, primary text), `ghost` (surface-2 bg, ink), `danger` (danger-bg, danger-fg), `onDark` (brand bg, ink text). Sizes `lg` 52h/r14/17px/700 (mobile CTA), `md` 44h/r12/15px, `sm` 36h/r10/14px. Optional leading icon 18–20px, gap 8 |
| **BottomActionBar** | Sticky bottom, white, top border `line-soft`, padding `12px 16px 24px`. Holds 1 full-width CTA, or 2 buttons in a `1fr 1.6fr` grid (secondary/danger left, primary right) |
| **AppBar** | 56h, white, bottom border. Back button 44×44 (chevron-left), title Anuphan 18/700 truncate, optional subtitle 12px muted, optional right text action (primary 14/700). Source: `components/AppBar.dc.html` |
| **TabBar** | 4 equal tabs, icon 24 + label 12px. Active = primary + 700, inactive = muted + 600. Role sets: tenant (หน้าหลัก, เอกสาร, ชุมชน, แจ้งซ่อม), owner (ภาพรวม, บิล, ชุมชน, ตั้งค่า), admin (ภาพรวม, ค่าบริการ, เจ้าของ, ตั้งค่า). Source: `components/TabBar.dc.html` |
| **TextField** | Label above (14/600 or 13/600 muted in dense forms), 48h, r10, 1.5px `line-input` border, 0 14px padding, 16px text. Focus/active: 2px primary border + 3px `primary-soft` outline. Warning state: border warn-fg. Error: border danger-fg + 13px danger helper below. Numeric meter fields use Anuphan 18/600 |
| **ReadonlyField** | Same size, `surface-2` bg, muted text (e.g. previous meter reading) |
| **StatusBadge** | Pill, padding 3–5px × 10–12px, 12–14px/600–700, optional 7px dot. Colors from status table |
| **Chip / FilterChip** | 34–36h pill. Unselected: white, 1.5px `line`. Selected (filters): ink bg, white text. Selected (choice): primary-soft bg, 1.5–2px primary border, ok-fg text. Use `aria-pressed` |
| **SegmentedControl** | Track `segment` bg, r12, 4px padding, gap 4. Selected segment white r9 700; others transparent muted 600. 36–38h. `role=tablist` |
| **Card** | White, r16 (hero r20), padding 14–16, no shadow |
| **ListGroup / ListRow** | White r16 container, rows separated by `line-soft`; row = optional leading tile/avatar, title 15/600 + meta 13 muted, trailing badge or chevron |
| **IconTile** | 40×40 r12, soft status bg + 20px icon in status fg. Used in task inbox rows and shortcuts |
| **BillCard** | Header row (type · month 14/600 muted + StatusBadge), amount Amount M, due line 14 muted |
| **HeroDueCard** | Tenant home: `hero` bg, white text, label `#BFE9CF`, amount 38px, line items, CTA `onDark` "จ่ายรวมครั้งเดียว" |
| **StatTile** | `canvas` bg (on white card) or white (on canvas), r14–18, label 13–14 muted, value Anuphan 24–30/700, sub 13 muted. Overdue values in danger-fg, review values in warn-fg |
| **ProgressBar** | 8h pill, track `#E3E8E5`, fill brand. Stacked variant (collected brand + pending `#E3A13B`) |
| **Stepper (linear)** | N equal columns, 4px bars (done/current primary, todo line) + 12px label under. Used for pay flow, onboarding wizard, e-sign |
| **StatusTimeline (vertical)** | 22px circles (done = primary filled + check, current = 3px warn ring, todo = 2px line ring) joined by 2px lines |
| **OcrHint** | r12–14 card, padding 10–14. Match → ok-bg + check icon; mismatch → danger-bg/warn-bg + triangle icon. Title 15/700 in status fg, detail 13 ink |
| **Toggle** | 48×28 pill, on = primary with white 22px knob right. Real `<input type=checkbox>` underneath |
| **UploadDrop** | 1.5px dashed `placeholder`, r12–16, primary 15/700 text, optional selected-file row with thumbnail 52×72 and "เปลี่ยน" |
| **ChatBubble** | Mine: primary bg, white, r `16 16 4 16`. Theirs: white, r `16 16 16 4`, with 32px avatar + 12px name. System event: centered pill `segment` bg 12px |
| **FAB** | 52h pill, primary, white 16/700, plus icon, shadow fab; sits 16px above TabBar |
| **Banner** | Full-width r14, warn-bg (trial/grace) or danger-bg (overdue/NEW ticket), 20px icon + 13–14px text + optional right link |
| **PortalSidebar** | 240px min (flex `1 1 240px`), dark bg, logo row, nav items 44h r10 15/600; active item bg `rgba(6,199,85,.22)` white text (admin: `rgba(200,184,240,.20)`); count badge warn `#E3A13B` with ink text |
| **DataTable** | White r18 card, `overflow-x:auto` wrapper, min-width 640–760. Header 13/600 muted with `line` bottom; rows 14px, padding 12, `line-soft` dividers; money right-aligned tabular; selected row bg `#F3FBF6` |
| **BulkActionBar** | Dark (`sidebar`) strip on top of the table when rows are selected: "เลือก N บิล" + action buttons |

---

## 5. Layout rules

### LIFF (mobile, tenant / owner / admin)

- Design width 390, must work from **360**. Center with `max-width: 430px; margin: 0 auto`.
- Structure: `AppBar` (sub-screens) or large screen title (tab roots) → scrollable content (padding 16, gap 12–16) → `BottomActionBar` **or** `TabBar` (never both).
- Root tab screens have TabBar; drill-down screens have AppBar + back.
- Respect iOS safe area: TabBar/ActionBar bottom padding 18–24px.

### Web Portal (desktop)

- Row with `flex-wrap: wrap`: sidebar `flex: 1 1 240px` + main `flex: 999 1 560px; min-width: 0`. Below ~800px the sidebar stacks on top.
- Main padding `28px clamp(16px,3vw,40px) 40px`, gap 18–24.
- Page header: title (Anuphan 28/700) + subtitle left; filters/actions right, wrapping.
- Stat tiles: `grid-template-columns: repeat(auto-fit, minmax(210px, 1fr))`.
- Content + side panel: flex-wrap, table `flex: 3 1 560px`, detail panel `flex: 1 1 320px`.

---

## 6. Screen inventory ↔ routes

`→` = suggested new route where the SRS has none.

### Tenant (LINE + LIFF) — `screens/tenant/`

| File | Route | Notes |
|------|-------|-------|
| `LineChat.dc.html` | LINE OA (not a web page) | Spec for the **Flex bill message** + tenant Rich Menu (2×3: ชำระเงิน highlighted, เอกสาร, ชุมชน, แจ้งซ่อม, ติดต่อ, หน้าหลัก) |
| `TenantLink.dc.html` | `/link?token=` (`/link-room`) | Invite confirmation before LINE linking; show room/contract summary |
| `TenantHome.dc.html` | `/tenant/home` | Hero total due, shortcuts, latest bills, pinned announcement |
| `TenantPay.dc.html` | `/pay`, `/payment/:invoiceId`, `/payment/:invoiceId/qr` | 3-step stepper, QR (PromptPay payload or uploaded QR), save QR, copy account, slip upload |
| `TenantSuccess.dc.html` | `/payment/:invoiceId/success` | Status timeline: ส่งสลิปแล้ว → เจ้าของกำลังตรวจ → ได้รับใบเสร็จ |
| `TenantDocs.dc.html` | `/documents` | Segmented ทั้งหมด/บิล/ใบเสร็จ/สัญญา, grouped by month |
| `TenantReceipt.dc.html` | `/pdf-viewer` (receipt) | Paper-style preview + Share / Download PDF |
| `TenantContract.dc.html` | `/contract/:id` | Expiry banner, key terms, signatures, PDF link, ขอต่อสัญญา |
| `TenantEsign.dc.html` | `/contract/:id/esign` | Signature pad + consent checkbox |
| `TenantMaint.dc.html` | `/tenant/maintenance`, `/maintenance/new` | Active ticket card + new ticket form (category grid, title, detail, photos) |
| `TenantTicket.dc.html` | `/tenant/maintenance/:id` | Status stepper, appointment card (confirm/reschedule), chat |
| `Community.dc.html` | `/community` | Type filter chips, posts, FAB |
| `CommunityPost.dc.html` | `/community/:id` | Marketplace detail: gallery, price, sold status, comments |
| `CommunityNew.dc.html` | `/community/new` | Type picker (ประกาศ = owner only), price for marketplace, ≤ 4 photos |
| `TenantContact.dc.html` | `/tenant/profile`, `/contact` | Owner card (call / message), my room info, building emergency numbers |

### Owner (LIFF) — `screens/owner/`

| File | Route | Notes |
|------|-------|-------|
| `OwnerHome.dc.html` | `/admin/portfolio` landing (Owner overview) | Subscription banner, building switcher, month income card, **task inbox**, room grid by floor |
| `OwnerSlip.dc.html` | `/admin/slip/:paymentId` | Queue counter (2/3), OCR hints, quick reject reasons, accept-with-shortfall option |
| `OwnerMeter.dc.html` | `/admin/property/:id/meter` | Room chips stepper, prev/current for electric & water, anomaly warning, photo, "บันทึก แล้วไป A-210" |
| `OwnerBilling.dc.html` | `/admin/billing` | Status filter chips with counts, room list |
| `OwnerInvoice.dc.html` | `/admin/invoice-builder` | Rent/utility tabs, auto items, extra items editor, channels, preview |
| `OwnerPortfolio.dc.html` | `/admin/portfolio` (building list) | Building cards with occupancy, paid, due, open tickets |
| `OwnerProperty.dc.html` | `/admin/property/:id` | Unit counts, rooms grouped by floor, status tiles |
| `OwnerUnit.dc.html` | `/admin/unit/:unitId` | Tenant/contract card, unit status radio, rates, recurring charges |
| `OwnerOnboard.dc.html` | `/admin/unit/:unitId/onboard`, `/admin/tenant/:tenantId/contract` | Wizard step 2 (contract); step 1 = tenant info form in the same style |
| `OwnerInvite.dc.html` | `/admin/tenant/:tenantId/invite` | Wizard step 3: channels, message preview, in-person QR |
| `OwnerTicket.dc.html` | `/admin/maintenance/:id` | NEW-ticket banner, tenant report, schedule picker, technician, message |
| `OwnerMoveOut.dc.html` | `/admin/contract/:id/move-out` | Final meters, deposit calculation, refund method |
| `OwnerNotif.dc.html` | `/admin/notifications` | Toggle + value chips per rule, quiet hours |
| `OwnerTemplate.dc.html` | `/admin/document-templates` | Background + draggable variable chips (0–1 coordinates) |
| `OwnerSettings.dc.html` | `/admin/settings` | Profile, plan card, grouped links |
| `OwnerSub.dc.html` | `/admin/subscription` | Trial → grace → suspended timeline, plan choice, QR, slip upload |

### Admin — `screens/admin/`

| File | Route | Notes |
|------|-------|-------|
| `AdminHome.dc.html` | Admin LIFF overview | Revenue, owner counts by status, slips to review, expiring list |
| `AdminOwners.dc.html` | `/admin/owners` | Search, owner rows with plan + LINE status, FAB create |
| `AdminSubs.dc.html` | `/admin/subscriptions` | Tabs, slip cards with OCR hint and renewal date |
| `PortalOwners.dc.html` | `/portal/owners` | Table + create-owner panel (temp username/password, LINE link) |
| `PortalSubs.dc.html` | `/portal/subscriptions` | Queue · large slip · details + approve |

### Web Portal (Owner) — `screens/portal/`

| File | Route | Notes |
|------|-------|-------|
| `PortalLogin.dc.html` | `/portal/login` | Split brand panel + form, error state shown |
| `PortalChangePw.dc.html` | `/portal/change-password` | Forced first-login change, strength + checklist |
| `PortalDash.dc.html` | `/portal` | Stat tiles, 6-month income bars, task list, overdue table |
| `PortalBilling.dc.html` | → `/portal/billing` | Tabs, status filters, bulk actions, table, side slip-review panel |
| `PortalReports.dc.html` | `/portal/reports` | Range tabs, export CSV/PDF, summary tiles, monthly table |
| `PortalSettings.dc.html` | `/portal/settings` | Profile, LINE link, payment receiving per building, automation links |
| `PortalSubscription.dc.html` | `/portal/subscription` | Trial banner, plans, history, pay panel |

Screens referenced in nav but not separately drawn (build them from the same components): Portal อาคารและห้อง / ผู้เช่าและสัญญา / แจ้งซ่อม (reuse table + side panel pattern), `/portal/register`, `/portal/link-admin`, onboarding step 1, admin "อาคารไม่มีเจ้าของ".

---

## 7. UX changes vs. current SRS (need backend work)

Marked "ปรับใหม่" in `Flows.dc.html`. Confirm each before building.

1. **Pay all at once** – one QR/slip for multiple invoices (tenant home + pay screen). Needs a payment linked to N invoices.
2. **Owner task inbox** – aggregate of slips UNDER_REVIEW, maintenance NEW, units missing this month's meter, contracts expiring.
3. **Meter anomaly warning** – flag usage > 2× 3-month average or current < previous.
4. **Quick reject reasons** + **accept with shortfall** (record difference as outstanding).
5. **Maintenance appointment** – scheduled date/slot + technician on ticket; tenant confirm/reschedule; tenant confirms DONE.
6. **3-step onboarding wizard** with invite message preview and in-person QR.
7. **Subscription banners** at 7/3/1 days and during GRACE in app + Portal.
8. Portal billing page, bulk "send reminder" and CSV export.

---

## 8. States & accessibility

- **Loading**: skeleton blocks in `surface-2` with the card's radius; never spinners over full screens.
- **Empty**: one line of muted text + one primary action (e.g. "ยังไม่มีบิลเดือนนี้" + "สร้างบิล").
- **Error**: inline danger helper under the field; network errors as a danger Banner at top of content with "ลองอีกครั้ง".
- **Suspended owner** (NFR-05): danger Banner on every owner screen, disable write actions (buttons `opacity .5`, `aria-disabled`), keep reading available.
- Use real `<button>`, `<a>`, `<input>`, `<label>`; icon-only buttons need `aria-label` (Thai). Text contrast ≥ 4.5:1 (all token pairs above pass). Status is always color + text.
