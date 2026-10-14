import { describe, expect, it } from 'vitest'
import { assertNavIsolation, navItemsForRole } from './navItems'

describe('navItemsForRole', () => {
  it('isolates ADMIN vs OWNER menus', () => {
    const admin = navItemsForRole('ADMIN').map((i) => i.path)
    const owner = navItemsForRole('OWNER').map((i) => i.path)
    expect(admin).toContain('/admin/subscriptions')
    expect(admin).toContain('/admin/owners')
    expect(admin).not.toContain('/admin/billing')
    expect(admin).not.toContain('/community')
    expect(owner).toContain('/admin/billing')
    expect(owner).toContain('/community')
    expect(owner).not.toContain('/admin/subscriptions')
    expect(owner).not.toContain('/admin/owners')
    expect(() => assertNavIsolation('ADMIN')).not.toThrow()
    expect(() => assertNavIsolation('OWNER')).not.toThrow()
  })

  it('tenant has home/docs/community/maintenance', () => {
    const paths = navItemsForRole('TENANT').map((i) => i.path)
    expect(paths).toEqual(['/tenant/home', '/documents', '/community', '/tenant/maintenance'])
  })
})
