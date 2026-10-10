/**
 * Generates the PropFlow tenant Rich Menu image (2500x843, 2 rows x 3 cols).
 * Run: npx tsx scripts/genRichMenu.ts  →  assets/richmenu.png
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
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

function iconWrench(cx: number, cy: number) {
  stroke(() => {
    ctx.beginPath()
    ctx.arc(cx - 22, cy - 18, 22, Math.PI * 0.15, Math.PI * 1.6)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 8, cy - 4)
    ctx.lineTo(cx + 36, cy + 36)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + 28, cy + 28)
    ctx.lineTo(cx + 42, cy + 42)
    ctx.stroke()
  }, 10)
}

function iconPeople(cx: number, cy: number) {
  stroke(() => {
    ctx.beginPath()
    ctx.arc(cx - 16, cy - 18, 16, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx - 16, cy + 38, 28, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + 22, cy - 12, 13, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + 22, cy + 38, 22, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
  }, 9)
}

function iconHome(cx: number, cy: number) {
  stroke(() => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - 40)
    ctx.lineTo(cx + 42, cy - 4)
    ctx.lineTo(cx + 42, cy + 38)
    ctx.lineTo(cx - 42, cy + 38)
    ctx.lineTo(cx - 42, cy - 4)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.rect(cx - 12, cy + 10, 24, 28)
    ctx.stroke()
  })
}

const cells = [
  { label: 'ชำระเงิน', icon: iconMoney },
  { label: 'เอกสาร', icon: iconReceipt },
  { label: 'ชุมชน', icon: iconPeople },
  { label: 'แจ้งซ่อม', icon: iconWrench },
  { label: 'ติดต่อ', icon: iconChat },
  { label: 'หน้าหลัก', icon: iconHome },
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

// ---- Admin / Owner menu (2×2): ภาพรวม | การเงิน | ชุมชน | ตั้งค่า ----
{
  const adminCanvas = createCanvas(W, H)
  const actx = adminCanvas.getContext('2d')
  const ACW = W / 2
  const ACH = H / 2

  actx.fillStyle = '#FFFFFF'
  actx.fillRect(0, 0, W, H)
  actx.strokeStyle = DIVIDER
  actx.lineWidth = 3
  actx.beginPath()
  actx.moveTo(ACW, 24)
  actx.lineTo(ACW, H - 24)
  actx.stroke()
  actx.beginPath()
  actx.moveTo(40, ACH)
  actx.lineTo(W - 40, ACH)
  actx.stroke()

  function aStroke(cb: () => void, width = 9) {
    actx.strokeStyle = GREEN
    actx.fillStyle = GREEN
    actx.lineWidth = width
    actx.lineCap = 'round'
    actx.lineJoin = 'round'
    cb()
  }

  const adminDraw: { label: string; icon: (cx: number, cy: number) => void }[] = [
    {
      label: 'ภาพรวม',
      icon: (cx, cy) =>
        aStroke(() => {
          actx.beginPath()
          actx.moveTo(cx, cy - 40)
          actx.lineTo(cx + 42, cy - 4)
          actx.lineTo(cx + 42, cy + 38)
          actx.lineTo(cx - 42, cy + 38)
          actx.lineTo(cx - 42, cy - 4)
          actx.closePath()
          actx.stroke()
          actx.beginPath()
          actx.rect(cx - 12, cy + 10, 24, 28)
          actx.stroke()
        }),
    },
    {
      label: 'การเงิน',
      icon: (cx, cy) => {
        actx.fillStyle = GREEN
        actx.font = 'bold 92px Sarabun'
        actx.textAlign = 'center'
        actx.textBaseline = 'middle'
        actx.fillText('฿', cx, cy + 4)
      },
    },
    {
      label: 'ชุมชน',
      icon: (cx, cy) =>
        aStroke(() => {
          actx.beginPath()
          actx.arc(cx - 16, cy - 18, 16, 0, Math.PI * 2)
          actx.stroke()
          actx.beginPath()
          actx.arc(cx - 16, cy + 38, 28, Math.PI * 1.15, Math.PI * 1.85)
          actx.stroke()
          actx.beginPath()
          actx.arc(cx + 22, cy - 12, 13, 0, Math.PI * 2)
          actx.stroke()
          actx.beginPath()
          actx.arc(cx + 22, cy + 38, 22, Math.PI * 1.1, Math.PI * 1.9)
          actx.stroke()
        }, 9),
    },
    {
      label: 'ตั้งค่า',
      icon: (cx, cy) => {
        const teeth = 8
        const rOut = 52
        const rIn = 38
        aStroke(() => {
          actx.beginPath()
          for (let i = 0; i < teeth * 2; i++) {
            const r = i % 2 === 0 ? rOut : rIn
            const a = (Math.PI / teeth) * i
            const px = cx + r * Math.cos(a)
            const py = cy + r * Math.sin(a)
            if (i === 0) actx.moveTo(px, py)
            else actx.lineTo(px, py)
          }
          actx.closePath()
          actx.stroke()
          actx.beginPath()
          actx.arc(cx, cy, 17, 0, Math.PI * 2)
          actx.stroke()
        })
      },
    },
  ]

  adminDraw.forEach((cell, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const cx = col * ACW + ACW / 2
    const cyTop = row * ACH
    const iconCy = cyTop + ACH * 0.4
    actx.fillStyle = GREEN_LIGHT
    actx.beginPath()
    actx.arc(cx, iconCy, 78, 0, Math.PI * 2)
    actx.fill()
    cell.icon(cx, iconCy)
    actx.fillStyle = TEXT
    actx.font = 'bold 50px Sarabun'
    actx.textAlign = 'center'
    actx.textBaseline = 'middle'
    actx.fillText(cell.label, cx, cyTop + ACH * 0.75)
  })

  const adminOut = path.join(ASSETS, 'richmenu-admin.png')
  fs.writeFileSync(adminOut, adminCanvas.toBuffer('image/png'))
  console.log('✅ wrote', adminOut)
}
