import { describe, expect, it, vi } from 'vitest'
import { resolveAdminId } from './scope'
import type { JwtPayload } from '../middleware/auth'

describe('resolveAdminId', () => {
  it('returns adminId for ADMIN', async () => {
    const prisma = { owner: { findUnique: vi.fn() } }
    const id = await resolveAdminId(prisma as never, { role: 'ADMIN', adminId: 'adm' } as JwtPayload)
    expect(id).toBe('adm')
    expect(prisma.owner.findUnique).not.toHaveBeenCalled()
  })

  it('looks up owner.adminId for OWNER', async () => {
    const prisma = { owner: { findUnique: vi.fn().mockResolvedValue({ adminId: 'adm2' }) } }
    const id = await resolveAdminId(prisma as never, { role: 'OWNER', ownerId: 'o1' } as JwtPayload)
    expect(id).toBe('adm2')
  })

  it('returns null for TENANT', async () => {
    const id = await resolveAdminId({} as never, { role: 'TENANT' } as JwtPayload)
    expect(id).toBeNull()
  })
})
