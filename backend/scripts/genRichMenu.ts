/**
 * Generates the PropFlow tenant Rich Menu image (2500x843, 2 rows x 3 cols).
 * Run: npx tsx scripts/genRichMenu.ts  →  assets/richmenu.png
 */
import { createCanvas, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'

const ASSETS = path.resolve(__dirname, '../assets')
GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts/Sarabun-Bold.ttf'), 'Sarabun')

const W = 2500
const H = 843
const COLS = 3
const ROWS = 2
const CW = W / COLS
const CH = H / ROWS

const GREEN = '#06C755'
const GREEN_LIGHT = '#E8F8EF'
const TEXT = '#1F2937'
const DIVIDER = '#ECEFF3'

const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')

// background
ctx.fillStyle = '#FFFFFF'
ctx.fillRect(0, 0, W, H)

// dividers
ctx.strokeStyle = DIVIDER
ctx.lineWidth = 3
for (let c = 1; c < COLS; c++) {
  ctx.beginPath()
  ctx.moveTo(c * CW, 24)
  ctx.lineTo(c * CW, H - 24)
  ctx.stroke()
}
ctx.beginPath()
ctx.moveTo(40, CH)
ctx.lineTo(W - 40, CH)
ctx.stroke()

function iconBg(cx: number, cy: number, r: number) {
  ctx.fillStyle = GREEN_LIGHT
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

function stroke(cb: () => void, width = 9) {
  ctx.strokeStyle = GREEN
  ctx.fillStyle = GREEN
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  cb()
}

// ---- icons (drawn centered at cx,cy within ~s box) ----
function iconMoney(cx: number, cy: number) {
  ctx.fillStyle = GREEN
  ctx.font = 'bold 92px Sarabun'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('฿', cx, cy + 4)
}

function iconReceipt(cx: number, cy: number) {
  const w = 78
  const h = 96
  const x = cx - w / 2
  const y = cy - h / 2
  stroke(() => {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x + w * 0.75, y + h - 14)
    ctx.lineTo(x + w * 0.5, y + h)
    ctx.lineTo(x + w * 0.25, y + h - 14)
    ctx.lineTo(x, y + h)
    ctx.closePath()
    ctx.stroke()
  })
  stroke(() => {
    for (const ly of [0.32, 0.52]) {
      ctx.beginPath()
      ctx.moveTo(x + 16, y + h * ly)
      ctx.lineTo(x + w - 16, y + h * ly)
      ctx.stroke()
    }
  }, 7)
}

function iconBill(cx: number, cy: number) {
  const w = 76
  const h = 98
  const x = cx - w / 2
  const y = cy - h / 2
  const fold = 26
  stroke(() => {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w - fold, y)
    ctx.lineTo(x + w, y + fold)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + w - fold, y)
    ctx.lineTo(x + w - fold, y + fold)
    ctx.lineTo(x + w, y + fold)
    ctx.stroke()
  })
  stroke(() => {
    for (const ly of [0.5, 0.66, 0.82]) {
      ctx.beginPath()
      ctx.moveTo(x + 16, y + h * ly)
      ctx.lineTo(x + w - 16, y + h * ly)
      ctx.stroke()
    }
  }, 7)
}

function iconGear(cx: number, cy: number) {
  const teeth = 8
  const rOut = 52
  const rIn = 38
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
    ctx.arc(cx, cy, 17, 0, Math.PI * 2)
    ctx.stroke()
  })
}

function iconContract(cx: number, cy: number) {
  const w = 76
  const h = 98
  const x = cx - w / 2
  const y = cy - h / 2
  stroke(() => {
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.stroke()
  })
  stroke(() => {
    for (const ly of [0.28, 0.45]) {
      ctx.beginPath()
      ctx.moveTo(x + 16, y + h * ly)
      ctx.lineTo(x + w - 16, y + h * ly)
      ctx.stroke()
    }
    // check mark
    ctx.beginPath()
    ctx.moveTo(x + 20, y + h * 0.72)
    ctx.lineTo(x + 34, y + h * 0.85)
    ctx.lineTo(x + w - 18, y + h * 0.58)
    ctx.stroke()
  }, 8)
}

function iconChat(cx: number, cy: number) {
  const w = 100
  const h = 76
  const x = cx - w / 2
  const y = cy - h / 2 - 6
  const r = 18
  stroke(() => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.lineTo(x + 40, y + h)
    ctx.lineTo(x + 26, y + h + 22)
    ctx.lineTo(x + 24, y + h)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
    ctx.stroke()
  })
  stroke(() => {
    for (const dx of [-22, 0, 22]) {
      ctx.beginPath()
      ctx.arc(cx + dx, y + h / 2, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

const cells = [
  { label: 'ชำระเงิน', icon: iconMoney },
  { label: 'ใบเสร็จ', icon: iconReceipt },
  { label: 'ใบแจ้งหนี้', icon: iconBill },
  { label: 'แจ้งซ่อม', icon: iconGear },
  { label: 'สัญญา', icon: iconContract },
  { label: 'ติดต่อ', icon: iconChat },
]

cells.forEach((cell, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const cx = col * CW + CW / 2
  const cyTop = row * CH
  const iconCy = cyTop + CH * 0.4
  iconBg(cx, iconCy, 78)
  cell.icon(cx, iconCy)
  ctx.fillStyle = TEXT
  ctx.font = 'bold 50px Sarabun'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(cell.label, cx, cyTop + CH * 0.75)
})

const out = path.join(ASSETS, 'richmenu.png')
fs.writeFileSync(out, canvas.toBuffer('image/png'))
console.log('✅ wrote', out)
