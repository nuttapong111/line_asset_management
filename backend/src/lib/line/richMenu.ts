import fs from 'fs'
import path from 'path'
import { RichMenu } from '@line/bot-sdk'
import { lineClient } from './client'
import { env, isLineConfigured, liffEntryUrl } from '../env'

const liff = (p: string) => `${env.LIFF_BASE_URL}${p.startsWith('/') ? '' : '/'}${p}`
// Admin menu uses the canonical LIFF entry URL (built from LIFF_ID) for reliability
const liffAdmin = (p: string) => `${liffEntryUrl.replace(/\/$/, '')}${p.startsWith('/') ? '' : '/'}${p}`

const RICHMENU_IMAGE = path.resolve(process.cwd(), 'assets', 'richmenu.png')
const ADMIN_RICHMENU_IMAGE = path.resolve(process.cwd(), 'assets', 'richmenu-admin.png')

const richMenuObject: RichMenu = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'PropFlow Tenant Menu',
  chatBarText: 'เมนู',
  areas: [
    { bounds: { x: 0, y: 0, width: 833, height: 421 }, action: { type: 'uri', uri: liff('/payment') } },
    { bounds: { x: 833, y: 0, width: 834, height: 421 }, action: { type: 'uri', uri: liff('/receipt') } },
    { bounds: { x: 1667, y: 0, width: 833, height: 421 }, action: { type: 'uri', uri: liff('/invoice') } },
    { bounds: { x: 0, y: 421, width: 833, height: 422 }, action: { type: 'uri', uri: liff('/maintenance/new') } },
    { bounds: { x: 833, y: 421, width: 834, height: 422 }, action: { type: 'uri', uri: liff('/contract') } },
    { bounds: { x: 1667, y: 421, width: 833, height: 422 }, action: { type: 'uri', uri: liff('/contact') } },
  ],
}

const adminRichMenuObject: RichMenu = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'PropFlow Admin Menu',
  chatBarText: 'เมนูผู้ดูแล',
  areas: [
    { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: liffAdmin('/admin/portfolio') } },
    { bounds: { x: 833, y: 0, width: 834, height: 843 }, action: { type: 'uri', uri: liffAdmin('/admin/billing') } },
    { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: liffAdmin('/admin/settings') } },
  ],
}

let cachedRichMenuId: string | null = null
let cachedAdminRichMenuId: string | null = null

async function uploadImage(richMenuId: string, imagePath = RICHMENU_IMAGE): Promise<void> {
  if (!fs.existsSync(imagePath)) {
    console.error('[LINE] rich menu image not found at', imagePath)
    return
  }
  const buffer = fs.readFileSync(imagePath)
  await lineClient.setRichMenuImage(richMenuId, buffer, 'image/png')
}

async function ensureRichMenu(): Promise<string | null> {
  if (!isLineConfigured) return null
  if (cachedRichMenuId) return cachedRichMenuId
  try {
    const list = await lineClient.getRichMenuList()
    const existing = list.find((m) => m.name === richMenuObject.name)
    if (existing) {
      cachedRichMenuId = existing.richMenuId
      return cachedRichMenuId
    }
    const id = await lineClient.createRichMenu(richMenuObject)
    await uploadImage(id)
    cachedRichMenuId = id
    return cachedRichMenuId
  } catch (err) {
    console.error('[LINE] ensureRichMenu failed', err)
    return null
  }
}

async function ensureAdminRichMenu(): Promise<string | null> {
  if (!isLineConfigured) return null
  if (cachedAdminRichMenuId) return cachedAdminRichMenuId
  try {
    const list = await lineClient.getRichMenuList()
    const existing = list.find((m) => m.name === adminRichMenuObject.name)
    if (existing) {
      cachedAdminRichMenuId = existing.richMenuId
      return cachedAdminRichMenuId
    }
    const id = await lineClient.createRichMenu(adminRichMenuObject)
    await uploadImage(id, ADMIN_RICHMENU_IMAGE)
    cachedAdminRichMenuId = id
    return cachedAdminRichMenuId
  } catch (err) {
    console.error('[LINE] ensureAdminRichMenu failed', err)
    return null
  }
}

/**
 * Create (or recreate) the tenant rich menu and upload its image so it is
 * ready to be linked to tenants. This is a TENANT-only menu — it is NOT set
 * as the default menu, so admins/owners do not get it. Returns the menu id.
 */
export async function setupRichMenu(): Promise<{ ok: boolean; richMenuId?: string; adminRichMenuId?: string; error?: string }> {
  if (!isLineConfigured) return { ok: false, error: 'LINE ยังไม่ได้ตั้งค่า (LINE_CHANNEL_ACCESS_TOKEN/SECRET)' }
  if (!fs.existsSync(RICHMENU_IMAGE)) return { ok: false, error: 'ไม่พบรูป rich menu ผู้เช่า (assets/richmenu.png)' }
  if (!fs.existsSync(ADMIN_RICHMENU_IMAGE)) return { ok: false, error: 'ไม่พบรูป rich menu แอดมิน (assets/richmenu-admin.png)' }
  try {
    // remove old menus with the same names to avoid duplicates
    const list = await lineClient.getRichMenuList()
    for (const m of list) {
      if (m.name === richMenuObject.name || m.name === adminRichMenuObject.name) {
        try {
          await lineClient.deleteRichMenu(m.richMenuId)
        } catch {
          /* ignore */
        }
      }
    }
    const id = await lineClient.createRichMenu(richMenuObject)
    await uploadImage(id)
    cachedRichMenuId = id

    const adminId = await lineClient.createRichMenu(adminRichMenuObject)
    await uploadImage(adminId, ADMIN_RICHMENU_IMAGE)
    cachedAdminRichMenuId = adminId

    return { ok: true, richMenuId: id, adminRichMenuId: adminId }
  } catch (err) {
    console.error('[LINE] setupRichMenu failed', err)
    return { ok: false, error: (err as Error).message }
  }
}

/** Delete the app's rich menu(s) and clear any default. */
export async function teardownRichMenu(): Promise<{ ok: boolean; error?: string }> {
  if (!isLineConfigured) return { ok: false, error: 'LINE ยังไม่ได้ตั้งค่า' }
  try {
    try {
      await lineClient.deleteDefaultRichMenu()
    } catch {
      /* no default set */
    }
    const list = await lineClient.getRichMenuList()
    for (const m of list) {
      if (m.name === richMenuObject.name || m.name === adminRichMenuObject.name) {
        await lineClient.deleteRichMenu(m.richMenuId)
      }
    }
    cachedRichMenuId = null
    cachedAdminRichMenuId = null
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function setTenantRichMenu(lineUserId: string): Promise<void> {
  if (!isLineConfigured) {
    console.log(`[LINE mock] setTenantRichMenu → ${lineUserId}`)
    return
  }
  const id = await ensureRichMenu()
  if (!id) return
  try {
    await lineClient.linkRichMenuToUser(lineUserId, id)
  } catch (err) {
    console.error('[LINE] linkRichMenuToUser failed', err)
  }
}

/** Link the admin menu to a specific admin LINE user (per-user override). */
export async function setAdminRichMenu(lineUserId: string): Promise<void> {
  if (!isLineConfigured) {
    console.log(`[LINE mock] setAdminRichMenu → ${lineUserId}`)
    return
  }
  const id = await ensureAdminRichMenu()
  if (!id) return
  try {
    await lineClient.linkRichMenuToUser(lineUserId, id)
  } catch (err) {
    console.error('[LINE] setAdminRichMenu failed', err)
  }
}

export async function removeTenantRichMenu(lineUserId: string): Promise<void> {
  if (!isLineConfigured) {
    console.log(`[LINE mock] removeTenantRichMenu → ${lineUserId}`)
    return
  }
  try {
    await lineClient.unlinkRichMenuFromUser(lineUserId)
  } catch (err) {
    console.error('[LINE] unlinkRichMenuFromUser failed', err)
  }
}
