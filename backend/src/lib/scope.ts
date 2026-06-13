import { Prisma } from '@prisma/client'
import { JwtPayload } from '../middleware/auth'

/**
 * Property-level access scope for a "manager" (ADMIN or OWNER).
 *
 *  - ADMIN sees every property they operate (Property.adminId === admin)
 *  - OWNER sees only the properties they own (Property.ownerId === owner)
 *
 * Use this everywhere a manager queries properties or anything nested under a
 * property (units, invoices, payments, etc.) so owners are confined to their
 * own data while admins keep full reach.
 */
export function propertyWhere(user: JwtPayload): Prisma.PropertyWhereInput {
  if (user.role === 'OWNER') return { ownerId: user.ownerId ?? '__none__' }
  if (user.role === 'ADMIN') return { adminId: user.adminId ?? '__none__' }
  return { id: '__none__' }
}

/** Where-filter for a Unit that belongs to a property in scope. */
export function unitWhere(user: JwtPayload): Prisma.UnitWhereInput {
  return { property: propertyWhere(user) }
}

/** Where-filter for an Invoice whose unit is in scope. */
export function invoiceWhere(user: JwtPayload): Prisma.InvoiceWhereInput {
  return { unit: { property: propertyWhere(user) } }
}

/** Where-filter for a Payment whose invoice/unit is in scope. */
export function paymentWhere(user: JwtPayload): Prisma.PaymentWhereInput {
  return { invoice: { unit: { property: propertyWhere(user) } } }
}

/** Where-filter for a Maintenance ticket whose unit is in scope. */
export function maintenanceWhere(user: JwtPayload): Prisma.MaintenanceWhereInput {
  return { unit: { property: propertyWhere(user) } }
}

/**
 * The adminId to stamp on records a manager creates. For an admin it's their own
 * id; for an owner it's the admin that operates them (so the SaaS admin keeps
 * visibility and the scheduler — which is admin-scoped — still works).
 */
export async function resolveAdminId(
  prisma: Prisma.TransactionClient | import('@prisma/client').PrismaClient,
  user: JwtPayload
): Promise<string | null> {
  if (user.role === 'ADMIN') return user.adminId ?? null
  if (user.role === 'OWNER' && user.ownerId) {
    const owner = await prisma.owner.findUnique({ where: { id: user.ownerId } })
    return owner?.adminId ?? null
  }
  return null
}
