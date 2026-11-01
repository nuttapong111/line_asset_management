# PropFlow design package

ใช้กับ Cursor ตอน rewrite แอป (React 18 + TS + Vite + Tailwind)

## วิธีใช้
1. คัดลอกโฟลเดอร์นี้ไปไว้ที่ `design/` ใน repo ของแอป
2. ย้าย `design/.cursor/rules/propflow-design.mdc` ไปไว้ที่ `.cursor/rules/` ที่ root ของ repo
3. ใน `tailwind.config.js` ของแอปเพิ่ม `presets: [require('./design/tokens/tailwind.config.js')]`
4. ใน `src/index.css` เพิ่ม `@import '../design/tokens/tokens.css';` ก่อน `@tailwind base;`
5. สั่ง Cursor ทีละหน้า เช่น `สร้างหน้า /owner/slips ให้ตรงกับ @design/screens/owner/OwnerSlip.dc.html ตาม @design/DESIGN.md`

แนะนำให้เริ่มจาก component กลางใน DESIGN.md §4 ก่อน แล้วค่อยทำทีละหน้า

## โครงสร้าง
- `DESIGN.md` สเปกเต็ม: tokens, components, layout, แผนที่หน้าจอกับ route, จุดที่ต้องแก้ backend
- `tokens/` CSS variables, Tailwind preset, JSON (รวม statusMap สีและคำไทยของทุกสถานะ)
- `screens/` ต้นแบบทุกหน้า แยกตาม tenant / owner / admin / portal
- `screens/components/` TabBar และ AppBar ที่หน้าอื่นเรียกผ่าน `<dc-import>`
- `screens/foundation/` บอร์ด design system และ flow

ดูภาพหน้าจอจริงได้ที่ https://claude.ai/artifact/2onuP8DuvdwoaH93L3e7dm
