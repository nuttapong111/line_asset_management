import { DocumentTemplate, DocumentTemplateType, Prisma } from '@prisma/client'
import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'
import { prisma } from '../lib/prisma'
import { readFile, uploadFile } from './storageService'
import { sampleValues } from './documentTemplateVars'

const FONT_DIR = path.resolve(process.cwd(), 'assets/fonts')
const REGULAR = path.join(FONT_DIR, 'Sarabun-Regular.ttf')
const BOLD = path.join(FONT_DIR, 'Sarabun-Bold.ttf')
const hasThaiFont = fs.existsSync(REGULAR) && fs.existsSync(BOLD)

export type Placement = {
  key: string
  /** 0–1 fraction of page width (left edge) */
  x: number
  /** 0–1 fraction of page height (top edge) */
  y: number
  /** Font size in design pixels (scaled to PDF page) */
  fontSize: number
  align?: 'left' | 'center' | 'right'
  /** Text box width as 0–1 fraction of page width */
  width?: number
  color?: string
}

export function parsePlacements(raw: unknown): Placement[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((p) => {
      if (!p || typeof p !== 'object') return null
      const o = p as Record<string, unknown>
      if (typeof o.key !== 'string' || typeof o.x !== 'number' || typeof o.y !== 'number') return null
      return {
        key: o.key,
        x: clamp01(o.x),
        y: clamp01(o.y),
        fontSize: typeof o.fontSize === 'number' && o.fontSize > 0 ? o.fontSize : 14,
        align: o.align === 'center' || o.align === 'right' ? o.align : 'left',
        width: typeof o.width === 'number' ? clamp01(o.width) : 0.45,
        color: typeof o.color === 'string' ? o.color : '#111111',
      } satisfies Placement
    })
    .filter(Boolean) as Placement[]
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
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

/**
 * Render background image + text placements to a single-page PDF.
 * Page size follows the design canvas aspect ratio (max width ~ A4 595pt).
 */
export async function renderTemplatePdf(
  template: Pick<DocumentTemplate, 'backgroundUrl' | 'pageWidth' | 'pageHeight' | 'placements'>,
  values: Record<string, string>
): Promise<Buffer> {
  const { body, contentType } = await readFile(template.backgroundUrl)
  if (!contentType.startsWith('image/') && !guessIsImage(template.backgroundUrl)) {
    throw new Error('Template background must be an image (JPEG/PNG)')
  }

  const designW = Math.max(1, template.pageWidth)
  const designH = Math.max(1, template.pageHeight)
  // Fit to A4 width while keeping aspect ratio
  const pageW = 595
  const pageH = (designH / designW) * pageW
  const scale = pageW / designW

  const doc = new PDFDocument({ size: [pageW, pageH], margin: 0 })
  if (hasThaiFont) {
    doc.registerFont('TH', REGULAR)
    doc.registerFont('TH-Bold', BOLD)
    doc.font('TH')
  }

  doc.image(body, 0, 0, { width: pageW, height: pageH })

  const placements = parsePlacements(template.placements)
  for (const p of placements) {
    const text = values[p.key]
    if (text == null || text === '') continue
    const x = p.x * pageW
    const y = p.y * pageH
    const boxW = (p.width ?? 0.45) * pageW
    const fontSize = Math.max(6, p.fontSize * scale)
    doc.fillColor(p.color || '#111111')
    doc.font(hasThaiFont ? 'TH' : 'Helvetica')
    doc.fontSize(fontSize)
    doc.text(String(text), x, y, {
      width: boxW,
      align: p.align || 'left',
      lineBreak: true,
    })
  }

  return bufferFromDoc(doc)
}

function guessIsImage(url: string) {
  const k = url.toLowerCase()
  return k.endsWith('.png') || k.endsWith('.jpg') || k.endsWith('.jpeg') || k.endsWith('.webp')
}

/** Resolve template for an owner (+ optional property): property override → owner default → any */
export async function resolveDocumentTemplate(
  ownerId: string | null | undefined,
  type: DocumentTemplateType,
  propertyId?: string | null
): Promise<DocumentTemplate | null> {
  if (!ownerId) return null

  if (propertyId) {
    const forProp = await prisma.documentTemplate.findFirst({
      where: { ownerId, type, propertyId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })
    if (forProp) return forProp
  }

  const ownerDefault = await prisma.documentTemplate.findFirst({
    where: { ownerId, type, propertyId: null, isDefault: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (ownerDefault) return ownerDefault

  return prisma.documentTemplate.findFirst({
    where: { ownerId, type, propertyId: null },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function renderPreviewPdf(template: DocumentTemplate): Promise<Buffer> {
  return renderTemplatePdf(template, sampleValues(template.type))
}

export async function ensureSingleDefault(
  ownerId: string,
  type: DocumentTemplateType,
  templateId: string,
  propertyId: string | null
) {
  await prisma.documentTemplate.updateMany({
    where: {
      ownerId,
      type,
      propertyId,
      id: { not: templateId },
      isDefault: true,
    },
    data: { isDefault: false },
  })
}

export type CreateTemplateInput = {
  ownerId: string
  type: DocumentTemplateType
  name: string
  propertyId?: string | null
  background: Buffer
  mimeType: string
  pageWidth: number
  pageHeight: number
  isDefault?: boolean
}

export async function createTemplate(input: CreateTemplateInput): Promise<DocumentTemplate> {
  const ext = input.mimeType === 'image/png' ? 'png' : 'jpg'
  const id = `tmp_${Date.now()}`
  const key = `templates/${input.ownerId}/${id}.${ext}`
  const backgroundUrl = await uploadFile(key, input.background, input.mimeType)

  const tpl = await prisma.documentTemplate.create({
    data: {
      ownerId: input.ownerId,
      propertyId: input.propertyId || null,
      type: input.type,
      name: input.name,
      backgroundUrl,
      pageWidth: input.pageWidth,
      pageHeight: input.pageHeight,
      placements: [] as Prisma.InputJsonValue,
      isDefault: !!input.isDefault,
    },
  })

  if (tpl.isDefault) {
    await ensureSingleDefault(tpl.ownerId, tpl.type, tpl.id, tpl.propertyId)
  }
  return tpl
}
