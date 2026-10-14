import { prisma } from '../lib/prisma'
import { uploadFile, readFile, extractStorageKey } from './storageService'
import { generateContractPdf } from './pdfService'
import { notifyOwnersOfProperty } from './ownerNotify'
import { pushText } from '../lib/line/lineService'
import { env } from '../lib/env'

const MAX_PNG_BYTES = 800_000

/** Parse data-URL or raw base64 PNG into a Buffer. */
export function parseSignaturePng(input: string): Buffer {
  const raw = input.trim()
  const m = raw.match(/^data:image\/png;base64,(.+)$/i)
  const b64 = m ? m[1] : raw.replace(/\s/g, '')
  if (!b64 || b64.length < 32) throw new Error('ลายเซ็นไม่ถูกต้อง')
  const buf = Buffer.from(b64, 'base64')
  if (buf.length < 64) throw new Error('ลายเซ็นว่างหรือสั้นเกินไป')
  if (buf.length > MAX_PNG_BYTES) throw new Error('ไฟล์ลายเซ็นใหญ่เกินไป')
  // PNG magic
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new Error('ต้องเป็นรูป PNG')
  }
  return buf
}

export type EsignParty = 'LANDLORD' | 'TENANT'

type ContractWithRelations = {
  id: string
  createdAt: Date
  startDate: Date
  endDate: Date
  rentAmount: { toString(): string } | number
  deposit: { toString(): string } | number
  dueDay: number
  lateFeePerDay: { toString(): string } | number
  terms: string | null
  landlordSignatureUrl: string | null
  landlordSignedAt: Date | null
  tenantSignatureUrl: string | null
  tenantSignedAt: Date | null
  tenant: {
    name: string
    phone: string
    idCardNumber: string | null
    lineUserId: string | null
  }
  unit: {
    roomNumber: string
    floor: number | null
    property: {
      id: string
      name: string
      address: string | null
      admin: { name: string }
      owner?: { name: string } | null
    }
  }
}

async function loadForEsign(contractId: string) {
  return prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      tenant: true,
      unit: { include: { property: { include: { admin: true, owner: true } } } },
    },
  })
}

async function readSigOptional(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null
  try {
    const file = await readFile(extractStorageKey(url))
    return file.body
  } catch {
    return null
  }
}

/** Rebuild signed PDF from stored signature PNGs (standard contract layout). */
export async function rebuildSignedContractPdf(contract: ContractWithRelations): Promise<string> {
  const year = contract.startDate.getFullYear()
  const seq = (await prisma.contract.count({ where: { createdAt: { lte: contract.createdAt } } })) || 1
  const contractNo = `CTR-${year}-${String(seq).padStart(5, '0')}`
  const prop = contract.unit.property
  const landlordName = prop.owner?.name || prop.admin.name

  const landlordPng = await readSigOptional(contract.landlordSignatureUrl)
  const tenantPng = await readSigOptional(contract.tenantSignatureUrl)

  const pdf = await generateContractPdf(
    {
      contractNo,
      landlordName,
      propertyName: prop.name,
      propertyAddress: prop.address || '-',
      roomNumber: contract.unit.roomNumber,
      floor: contract.unit.floor,
      tenantName: contract.tenant.name,
      tenantIdCard: contract.tenant.idCardNumber,
      tenantPhone: contract.tenant.phone,
      rentAmount: Number(contract.rentAmount),
      deposit: Number(contract.deposit),
      dueDay: contract.dueDay,
      lateFeePerDay: Number(contract.lateFeePerDay),
      startDate: contract.startDate,
      endDate: contract.endDate,
      terms: contract.terms,
    },
    {
      landlordPng,
      tenantPng,
      landlordSignedAt: contract.landlordSignedAt,
      tenantSignedAt: contract.tenantSignedAt,
    }
  )

  return uploadFile(`contracts/${contract.id}/signed-esign.pdf`, pdf, 'application/pdf')
}

export async function applyContractEsign(
  contractId: string,
  party: EsignParty,
  signaturePng: string
): Promise<{
  landlordSignedAt: Date | null
  tenantSignedAt: Date | null
  signedAt: Date | null
  signedDocumentUrl: string | null
  complete: boolean
}> {
  const contract = await loadForEsign(contractId)
  if (!contract) throw new Error('Contract not found')
  if (contract.status !== 'ACTIVE') throw new Error('สัญญาไม่พร้อมลงนาม')

  const png = parseSignaturePng(signaturePng)
  const now = new Date()
  const key =
    party === 'LANDLORD'
      ? `contracts/${contract.id}/signature-landlord.png`
      : `contracts/${contract.id}/signature-tenant.png`
  const url = await uploadFile(key, png, 'image/png')

  const patch =
    party === 'LANDLORD'
      ? { landlordSignatureUrl: url, landlordSignedAt: now }
      : { tenantSignatureUrl: url, tenantSignedAt: now }

  let updated = await prisma.contract.update({
    where: { id: contractId },
    data: patch,
    include: {
      tenant: true,
      unit: { include: { property: { include: { admin: true, owner: true } } } },
    },
  })

  const complete = Boolean(updated.landlordSignedAt && updated.tenantSignedAt)
  const signedDocumentUrl = await rebuildSignedContractPdf(updated)
  updated = await prisma.contract.update({
    where: { id: contractId },
    data: {
      signedDocumentUrl,
      signedAt: complete ? updated.signedAt ?? now : null,
    },
    include: {
      tenant: true,
      unit: { include: { property: { include: { admin: true, owner: true } } } },
    },
  })

  const liff = env.LIFF_BASE_URL.replace(/\/$/, '')
  if (party === 'TENANT') {
    await notifyOwnersOfProperty(
      contract.unit.property.id,
      `ผู้เช่าลงนามสัญญาแล้ว (e-sign)\nห้อง ${contract.unit.roomNumber} · ${contract.tenant.name}\n${complete ? 'ครบทั้งสองฝ่ายแล้ว' : 'รอเจ้าของลงนาม'}\n${liff}/admin/contract/${contract.id}`
    )
  } else if (contract.tenant.lineUserId) {
    await pushText(
      contract.tenant.lineUserId,
      complete
        ? `เจ้าของลงนามสัญญาแล้ว — สัญญาครบทั้งสองฝ่ายแล้ว\nดูสัญญา: ${liff}/contract/${contract.id}`
        : `เจ้าของลงนามสัญญาแล้ว — กรุณาลงนามฝั่งผู้เช่า\nลงนาม: ${liff}/contract/${contract.id}/esign`
    )
  }

  return {
    landlordSignedAt: updated.landlordSignedAt,
    tenantSignedAt: updated.tenantSignedAt,
    signedAt: updated.signedAt,
    signedDocumentUrl: updated.signedDocumentUrl,
    complete,
  }
}
