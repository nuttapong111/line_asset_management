import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'
import { buildContractText, ContractData } from './contractTemplate'

const FONT_DIR = path.resolve(process.cwd(), 'assets/fonts')
const REGULAR = path.join(FONT_DIR, 'Sarabun-Regular.ttf')
const BOLD = path.join(FONT_DIR, 'Sarabun-Bold.ttf')
const hasThaiFont = fs.existsSync(REGULAR) && fs.existsSync(BOLD)

const GREEN = '#06C755'

function newDoc(): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  if (hasThaiFont) {
    doc.registerFont('TH', REGULAR)
    doc.registerFont('TH-Bold', BOLD)
    doc.font('TH')
  }
  return doc
}

function fontRegular(doc: PDFKit.PDFDocument) {
  doc.font(hasThaiFont ? 'TH' : 'Helvetica')
}
function fontBold(doc: PDFKit.PDFDocument) {
  doc.font(hasThaiFont ? 'TH-Bold' : 'Helvetica-Bold')
}

function bufferFromDoc(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c as Buffer))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

const baht = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface ReceiptInput {
  receiptNo: string
  date: Date
  propertyName: string
  propertyAddress?: string | null
  tenantName: string
  roomNumber: string
  items: { label: string; amount: number }[]
  total: number
}

export async function generateReceipt(d: ReceiptInput): Promise<Buffer> {
  const doc = newDoc()

  // Header
  fontBold(doc)
  doc.fontSize(18).text(d.propertyName, { align: 'center' })
  if (d.propertyAddress) {
    fontRegular(doc)
    doc.fontSize(10).fillColor('#666').text(d.propertyAddress, { align: 'center' })
  }
  doc.moveDown(0.5)
  fontBold(doc)
  doc.fillColor('#000').fontSize(16).text('ใบเสร็จรับเงิน', { align: 'center' })
  doc.moveDown(1)

  // Info grid
  fontRegular(doc)
  doc.fontSize(11).fillColor('#000')
  doc.text(`เลขที่ใบเสร็จ: ${d.receiptNo}`)
  doc.text(`วันที่: ${d.date.toLocaleDateString('th-TH')}`)
  doc.text(`ผู้เช่า: ${d.tenantName}`)
  doc.text(`ห้อง: ${d.roomNumber}`)
  doc.moveDown(1)

  // Items table
  const startX = 50
  const endX = 545
  let y = doc.y
  fontBold(doc)
  doc.fontSize(11)
  doc.text('รายการ', startX, y)
  doc.text('จำนวนเงิน (บาท)', startX, y, { align: 'right', width: endX - startX })
  y += 18
  doc.moveTo(startX, y).lineTo(endX, y).strokeColor('#cccccc').stroke()
  y += 8

  fontRegular(doc)
  for (const it of d.items) {
    doc.text(it.label, startX, y)
    doc.text(baht(it.amount), startX, y, { align: 'right', width: endX - startX })
    y += 20
  }

  y += 4
  doc.moveTo(startX, y).lineTo(endX, y).strokeColor('#cccccc').stroke()
  y += 10
  fontBold(doc)
  doc.fillColor(GREEN).fontSize(13)
  doc.text('รวมทั้งสิ้น', startX, y)
  doc.text(baht(d.total), startX, y, { align: 'right', width: endX - startX })

  // Paid stamp
  doc.moveDown(3)
  fontBold(doc)
  doc.fillColor(GREEN).fontSize(14).text('ชำระครบถ้วนแล้ว ✓', { align: 'center' })

  // Signature
  doc.moveDown(4)
  fontRegular(doc)
  doc.fillColor('#000').fontSize(11)
  const sigY = doc.y
  doc.text('....................................', 330, sigY, { align: 'left' })
  doc.text('(ผู้รับเงิน)', 360, sigY + 18)

  return bufferFromDoc(doc)
}

export async function generateContractPdf(d: ContractData): Promise<Buffer> {
  const doc = newDoc()
  const sections = buildContractText(d)

  fontBold(doc)
  doc.fontSize(18).text('สัญญาเช่าที่พัก', { align: 'center' })
  fontRegular(doc)
  doc.fontSize(11).fillColor('#666').text(`เลขที่สัญญา ${d.contractNo}`, { align: 'center' })
  doc.fillColor('#000').moveDown(1.5)

  for (const sec of sections) {
    if (sec.heading) {
      fontBold(doc)
      doc.fontSize(13).text(sec.heading)
      doc.moveDown(0.3)
    }
    fontRegular(doc)
    doc.fontSize(11)
    for (const line of sec.lines) {
      doc.text(line, { align: 'left' })
    }
    doc.moveDown(0.8)
  }

  // Signatures
  doc.moveDown(3)
  fontRegular(doc)
  const y = doc.y
  doc.fontSize(11)
  doc.text('ลงชื่อ ............................. ผู้ให้เช่า', 50, y)
  doc.text('ลงชื่อ ............................. ผู้เช่า', 320, y)
  doc.text(`(${d.landlordName})`, 70, y + 20)
  doc.text(`(${d.tenantName})`, 340, y + 20)

  return bufferFromDoc(doc)
}

export { hasThaiFont }
