/**
 * Generates the PropFlow ADMIN Rich Menu image (2500x843, 1 row x 3 cols).
 * Buttons: ภาพรวม | การเงิน | ตั้งค่า
 * Run: npx tsx scripts/genAdminRichMenu.ts  →  assets/richmenu-admin.png
 */
import { createCanvas } from '@napi-rs/canvas'
import { GlobalFonts } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'

const ASSETS = path.resolve(__dirname, '../assets')
GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts/Sarabun-Bold.ttf'), 'Sarabun')

const W = 2500
const H = 843
const COLS = 3
const CW = W / COLS

const GREEN = '#06C755'
const GREEN_DARK = '#04A244'
const GREEN_LIGHT = '#E8F8EF'
const TEXT = '#1F2937'
const DIVIDER = '#ECEFF3'

const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')

ctx.fillStyle = '#FFFFFF'
ctx.fillRect(0, 0, W, H)

// top accent bar
ctx.fillStyle = GREEN
ctx.fillRect(0, 0, W, 12)

// dividers
ctx.strokeStyle = DIVIDER
ctx.lineWidth = 3
for (let c = 1; c < COLS; c++) {
  ctx.beginPath()
  ctx.moveTo(c * CW, 60)
  ctx.lineTo(c * CW, H - 60)
  ctx.stroke()
}

function iconBg(cx: number, cy: number, r: number) {
  ctx.fillStyle = GREEN_LIGHT
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

function stroke(cb: () => void, width = 10) {
  ctx.strokeStyle = GREEN_DARK
  ctx.fillStyle = GREEN_DARK
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  cb()
}

function iconBuilding(cx: number, cy: number) {
  const w = 96
  const h = 110
  const x = cx - w / 2
  const y = cy - h / 2
  stroke(() => {
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.stroke()
  })
  stroke(() => {
    for (let ry = 0; ry < 4; ry++) {
      for (let cxn = 0; cxn < 2; cxn++) {
        const wx = x + 18 + cxn * 42
        const wy = y + 16 + ry * 22
        ctx.beginPath()
        ctx.rect(wx, wy, 22, 14)
        ctx.stroke()
      }
    }
  }, 6)
}

function iconMoney(cx: number, cy: number) {
  iconBg(cx, cy, 78)
  ctx.fillStyle = GREEN_DARK
  ctx.font = 'bold 100px Sarabun'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('฿', cx, cy + 4)
}

function iconGear(cx: number, cy: number) {
  const teeth = 8
  const rOut = 56
  const rIn = 40
  stroke(() => {
    ctx.beginPath()
    for (let i = 0; i < teeth * 2; i++) {
      const r = i % 2 === 0 ? rOut : rIn
      const a = (Math.PI / teeth) * i
      const px = cx + r * Math.cos(a)
      const py = cy + r * Math.sin(a)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, 18, 0, Math.PI * 2)
    ctx.stroke()
  })
}

const cells: { label: string; icon: (cx: number, cy: number) => void; bg?: boolean }[] = [
  { label: 'ภาพรวม', icon: iconBuilding, bg: true },
  { label: 'การเงิน', icon: iconMoney },
  { label: 'ตั้งค่า', icon: iconGear, bg: true },
]

cells.forEach((cell, i) => {
  const cx = i * CW + CW / 2
  const iconCy = H * 0.4
  if (cell.bg) iconBg(cx, iconCy, 78)
  cell.icon(cx, iconCy)
  ctx.fillStyle = TEXT
  ctx.font = 'bold 58px Sarabun'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(cell.label, cx, H * 0.75)
})

const out = path.join(ASSETS, 'richmenu-admin.png')
fs.writeFileSync(out, canvas.toBuffer('image/png'))
console.log('✅ wrote', out)
