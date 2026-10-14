import { describe, expect, it } from 'vitest'
import { invoiceWhere, propertyWhere, unitWhere } from './scope'
import type { JwtPayload } from '../middleware/auth'

describe('propertyWhere scope', () => {
  it('scopes OWNER to their properties only', () => {
    const user = { role: 'OWNER', ownerId: 'own_1' } as JwtPayload
    expect(propertyWhere(user)).toEqual({ ownerId: 'own_1' })
    expect(unitWhere(user)).toEqual({ property: { ownerId: 'own_1' } })
    expect(invoiceWhere(user)).toEqual({ unit: { property: { ownerId: 'own_1' } } })
  })

  it('scopes ADMIN to adminId', () => {
    const user = { role: 'ADMIN', adminId: 'adm_1' } as JwtPayload
    expect(propertyWhere(user)).toEqual({ adminId: 'adm_1' })
  })

  it('denies TENANT / NEW with impossible id', () => {
    const user = { role: 'TENANT' } as JwtPayload
    expect(propertyWhere(user)).toEqual({ id: '__none__' })
  })

  it('uses __none__ when ownerId missing', () => {
    const user = { role: 'OWNER' } as JwtPayload
    expect(propertyWhere(user)).toEqual({ ownerId: '__none__' })
  })
})
