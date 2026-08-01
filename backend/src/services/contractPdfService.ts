import { prisma } from '../lib/prisma'
import { generateContractPdf } from './pdfService'
import { uploadFile } from './storageService'
import { resolveDocumentTemplate, renderTemplatePdf } from './documentTemplateService'
import { contractValues } from './documentTemplateValues'
import { ContractData } from './contractTemplate'

type ContractForPdf = {
  id: string
  createdAt: Date
  startDate: Date
  endDate: Date
  rentAmount: { toString(): string } | number
  deposit: { toString(): string } | number
  dueDay: number
  lateFeePerDay: { toString(): string } | number
  terms: string | null
  tenant: {
    name: string
    phone: string
    idCardNumber: string | null
  }
  unit: {
    roomNumber: string
    floor: number | null
    property: {
      id: string
      name: string
      address: string | null
      ownerId: string | null
      admin: { name: string }
      owner?: { name: string } | null
    }
  }
}

function toData(contract: ContractForPdf, contractNo: string): ContractData {
  const prop = contract.unit.property
  const landlordName = prop.owner?.name || prop.admin.name
  return {
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
  }
}

export async function generateAndStoreContractPdf(contract: ContractForPdf): Promise<{
  pdf: Buffer
  contractNo: string
  stored: string
}> {
  const year = contract.startDate.getFullYear()
  const seq = (await prisma.contract.count({ where: { createdAt: { lte: contract.createdAt } } })) || 1
  const contractNo = `CTR-${year}-${String(seq).padStart(5, '0')}`
  const data = toData(contract, contractNo)
  const prop = contract.unit.property

  const template = await resolveDocumentTemplate(prop.ownerId, 'CONTRACT', prop.id)

  const pdf = template
    ? await renderTemplatePdf(template, contractValues(data))
    : await generateContractPdf(data)

  const stored = await uploadFile(`contracts/${contract.id}.pdf`, pdf, 'application/pdf')
  await prisma.contract.update({ where: { id: contract.id }, data: { pdfUrl: stored } })
  return { pdf, contractNo, stored }
}
