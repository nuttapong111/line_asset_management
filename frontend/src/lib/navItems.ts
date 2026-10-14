export type NavRole = 'ADMIN' | 'OWNER' | 'TENANT'

export type NavItemDef = {
  label: string
  path: string
}

/** Platform admin: SaaS ops — owner bills + owner accounts (no property community). */
export const ADMIN_NAV: NavItemDef[] = [
  { label: 'ภาพรวม', path: '/admin/portfolio' },
  { label: 'ค่าบริการ', path: '/admin/subscriptions' },
  { label: 'เจ้าของ', path: '/admin/owners' },
  { label: 'ตั้งค่า', path: '/admin/settings' },
]

/** Property owner: rent billing + tenant community. */
export const OWNER_NAV: NavItemDef[] = [
  { label: 'ภาพรวม', path: '/admin/portfolio' },
  { label: 'บิล', path: '/admin/billing' },
  { label: 'ชุมชน', path: '/community' },
  { label: 'ตั้งค่า', path: '/admin/settings' },
]

export const TENANT_NAV: NavItemDef[] = [
  { label: 'หน้าหลัก', path: '/tenant/home' },
  { label: 'เอกสาร', path: '/documents' },
  { label: 'ชุมชน', path: '/community' },
  { label: 'แจ้งซ่อม', path: '/tenant/maintenance' },
]

export function navItemsForRole(role: NavRole): NavItemDef[] {
  if (role === 'TENANT') return TENANT_NAV
  if (role === 'OWNER') return OWNER_NAV
  return ADMIN_NAV
}

/** Owner must never see admin SaaS tabs; admin must never see owner billing/community. */
export function assertNavIsolation(role: NavRole): void {
  const items = navItemsForRole(role)
  const paths = items.map((i) => i.path)
  if (role === 'OWNER') {
    if (paths.includes('/admin/subscriptions') || paths.includes('/admin/owners')) {
      throw new Error('Owner nav must not include admin SaaS routes')
    }
    if (!paths.includes('/admin/billing') || !paths.includes('/community')) {
      throw new Error('Owner nav missing billing/community')
    }
  }
  if (role === 'ADMIN') {
    if (paths.includes('/admin/billing') || paths.includes('/community')) {
      throw new Error('Admin nav must not include owner property routes')
    }
  }
}
