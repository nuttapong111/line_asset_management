# วิธีใช้ไฟล์ prompt เหล่านี้กับ Claude Code

## ขั้นตอน

### 1. สร้าง project folder
```bash
mkdir propflow && cd propflow
```

### 2. copy CLAUDE.md ไปไว้ที่ root
```bash
cp CLAUDE.md ./propflow/CLAUDE.md
```
> Claude Code ใน VS Code จะอ่านไฟล์นี้เป็น context อัตโนมัติทุก session

### 3. เปิด VS Code + Claude Code
```bash
code propflow
```
เปิด Claude Code panel (icon ดาวซ้ายมือ หรือ Cmd+Shift+P → "Claude Code")

### 4. รัน Step by Step

**วาง prompt ทีละ step เข้า Claude Code input:**

```
Step 1: วาง PROMPT_STEP1.md  → scaffold + database
Step 2: วาง PROMPT_STEP2.md  → auth + LIFF
Step 3: วาง PROMPT_STEP3.md  → LINE lib + webhook + Rich Menu
Step 4: วาง PROMPT_STEP4.md  → property + tenant + invite
Step 5: วาง PROMPT_STEP5.md  → QR payment + slip + receipt PDF
Step 6: วาง PROMPT_STEP6.md  → notification settings + cron
Step 7: วาง PROMPT_STEP7.md  → contract PDF + maintenance + reports
Step 8: วาง PROMPT_STEP8.md  → meter + invoice builder + billing
```

### 5. หลังแต่ละ step
- ดู error ใน terminal และให้ Claude Code แก้ไข
- รัน test ตามที่ระบุในแต่ละ step
- commit code ก่อนไป step ถัดไป

---

## Tips

**ถ้า Claude Code หลุด context:**
พิมพ์ใน input: `Read CLAUDE.md and continue from where we left off at Step X`

**ถ้าต้องการให้ทำแค่บางส่วน:**
```
Read CLAUDE.md, then implement only the backend routes in PROMPT_STEP5.md.
Skip frontend for now.
```

**ถ้า LINE credentials ยังไม่มี:**
ระบบมี mock mode — dev สามารถทำงานได้โดยไม่ต้องมี LINE credentials จริง

**สิ่งที่ต้องกรอกเองใน .env:**
```
LINE_CHANNEL_ID         จาก LINE Developers Console → Messaging API channel
LINE_CHANNEL_SECRET     จาก Basic settings
LINE_CHANNEL_ACCESS_TOKEN จาก Messaging API tab → Issue
LINE_LOGIN_CHANNEL_ID   จาก LINE Login channel
LIFF_ID                 จาก LINE Login channel → LIFF tab
TWILIO_ACCOUNT_SID      จาก Twilio Console
TWILIO_AUTH_TOKEN       จาก Twilio Console
```

---

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | วัตถุประสงค์ |
|------|-------------|
| `CLAUDE.md` | Master spec — วางที่ root ของ project |
| `PROMPT_STEP1.md` | Scaffold + Docker + Prisma schema |
| `PROMPT_STEP2.md` | Auth + LIFF init |
| `PROMPT_STEP3.md` | LINE lib (flex, webhook, rich menu) |
| `PROMPT_STEP4.md` | Property + Unit + Tenant + Invite |
| `PROMPT_STEP5.md` | QR Payment + Slip + Receipt PDF |
| `PROMPT_STEP6.md` | Notification settings + Cron scheduler |
| `PROMPT_STEP7.md` | Contract PDF + Maintenance + Reports |
| `PROMPT_STEP8.md` | Meter recording + Invoice builder |
| `HOW_TO_USE.md` | ไฟล์นี้ |

