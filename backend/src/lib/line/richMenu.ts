import fs from 'fs'
import path from 'path'
import { RichMenu } from '@line/bot-sdk'
import { lineClient } from './client'
import { env, isLineConfigured, liffEntryUrl } from '../env'

const liff = (p: string) => `${env.LIFF_BASE_URL}${p.startsWith('/') ? '' : '/'}${p}`
const liffAdmin = (p: string) => `${liffEntryUrl.replace(/\/$/, '')}${p.startsWith('/') ? '' : '/'}${p}`

const RICHMENU_IMAGE = path.resolve(process.cwd(), 'assets', 'richmenu.png')
const OWNER_RICHMENU_IMAGE = path.resolve(process.cwd(), 'assets', 'richmenu-owner.png')
const ADMIN_RICHMENU_IMAGE = path.resolve(process.cwd(), 'assets', 'richmenu-admin.png')

const TENANT_MENU_NAME = 'PropFlow Tenant Menu v2'
const TENANT_MENU_ALIASES = ['PropFlow Tenant Menu', TENANT_MENU_NAME]

const OWNER_MENU_NAME = 'PropFlow Owner Menu v4'
const OWNER_MENU_ALIASES = ['PropFlow Admin Menu', 'PropFlow Admin Menu v2', OWNER_MENU_NAME]

const ADMIN_MENU_NAME = 'PropFlow Platform Admin Menu v3'
const ADMIN_MENU_ALIASES = [ADMIN_MENU_NAME]

const richMenuObject: RichMenu = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: TENANT_MENU_NAME,
  chatBarText: 'เมนู',
  areas: [
    { bounds: { x: 0, y: 0, width: 833, height: 421 }, action: { type: 'uri', uri: liff('/pay') } },
    { bounds: { x: 833, y: 0, width: 834, height: 421 }, action: { type: 'uri', uri: liff('/documents') } },
    { bounds: { x: 1667, y: 0, width: 833, height: 421 }, action: { type: 'uri', uri: liff('/community') } },
    { bounds: { x: 0, y: 421, width: 833, height: 422 }, action: { type: 'uri', uri: liff('/maintenance/new') } },
    { bounds: { x: 833, y: 421, width: 834, height: 422 }, action: { type: 'uri', uri: liff('/contact') } },
    { bounds: { x: 1667, y: 421, width: 833, height: 422 }, action: { type: 'uri', uri: liff('/tenant/home') } },
  ],
}

/** Property owner — rent + community */
const ownerRichMenuObject: RichMenu = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: OWNER_MENU_NAME,
  chatBarText: 'เมนูเจ้าของ',
  areas: [
    { bounds: { x: 0, y: 0, width: 1250, height: 421 }, action: { type: 'uri', uri: liffAdmin('/admin/portfolio') } },
    { bounds: { x: 1250, y: 0, width: 1250, height: 421 }, action: { type: 'uri', uri: liffAdmin('/admin/billing') } },
    { bounds: { x: 0, y: 421, width: 1250, height: 422 }, action: { type: 'uri', uri: liffAdmin('/community') } },
    { bounds: { x: 1250, y: 421, width: 1250, height: 422 }, action: { type: 'uri', uri: liffAdmin('/admin/settings') } },
  ],
}

/** Platform admin — SaaS: owner fees + owner accounts (no community) */
const adminRichMenuObject: RichMenu = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: ADMIN_MENU_NAME,
  chatBarText: 'เมนูแอดมิน',
  areas: [
    { bounds: { x: 0, y: 0, width: 1250, height: 421 }, action: { type: 'uri', uri: liffAdmin('/admin/portfolio') } },
    { bounds: { x: 1250, y: 0, width: 1250, height: 421 }, action: { type: 'uri', uri: liffAdmin('/admin/subscriptions') } },
    { bounds: { x: 0, y: 421, width: 1250, height: 422 }, action: { type: 'uri', uri: liffAdmin('/admin/owners') } },
    { bounds: { x: 1250, y: 421, width: 1250, height: 422 }, action: { type: 'uri', uri: liffAdmin('/admin/settings') } },
  ],
}

let cachedRichMenuId: string | null = null
let cachedOwnerRichMenuId: string | null = null
let cachedAdminRichMenuId: string | null = null

async function uploadImage(richMenuId: string, imagePath: string): Promise<void> {
  if (!fs.existsSync(imagePath)) {
    console.error('[LINE] rich menu image not found at', imagePath)
    return
  }
  const buffer = fs.readFileSync(imagePath)
  await lineClient.setRichMenuImage(richMenuId, buffer, 'image/png')
}

async function ensureByName(
  menu: RichMenu,
  imagePath: string,
  getCache: () => string | null,
  setCache: (id: string) => void
): Promise<string | null> {
  if (!isLineConfigured) return null
  const cached = getCache()
  if (cached) return cached
  try {
    const list = await lineClient.getRichMenuList()
    const existing = list.find((m) => m.name === menu.name)
    if (existing) {
      setCache(existing.richMenuId)
      return existing.richMenuId
    }
    const id = await lineClient.createRichMenu(menu)
    await uploadImage(id, imagePath)
    setCache(id)
    return id
  } catch (err) {
    console.error('[LINE] ensure rich menu failed', menu.name, err)
    return null
  }
}

async function ensureTenantRichMenu() {
  return ensureByName(
    richMenuObject,
    RICHMENU_IMAGE,
    () => cachedRichMenuId,
    (id) => {
      cachedRichMenuId = id
    }
  )
}

async function ensureOwnerRichMenu() {
  const image = fs.existsSync(OWNER_RICHMENU_IMAGE) ? OWNER_RICHMENU_IMAGE : ADMIN_RICHMENU_IMAGE
  return ensureByName(
    ownerRichMenuObject,
    image,
    () => cachedOwnerRichMenuId,
    (id) => {
      cachedOwnerRichMenuId = id
    }
  )
}

async function ensureAdminRichMenu() {
  return ensureByName(
    adminRichMenuObject,
    ADMIN_RICHMENU_IMAGE,
    () => cachedAdminRichMenuId,
    (id) => {
      cachedAdminRichMenuId = id
    }
  )
}

function allKnownNames(name: string) {
  return (
    TENANT_MENU_ALIASES.includes(name) ||
    OWNER_MENU_ALIASES.includes(name) ||
    ADMIN_MENU_ALIASES.includes(name) ||
    name === richMenuObject.name ||
    name === ownerRichMenuObject.name ||
    name === adminRichMenuObject.name
  )
}

export async function setupRichMenu(): Promise<{
  ok: boolean
  richMenuId?: string
  ownerRichMenuId?: string
  adminRichMenuId?: string
  error?: string
}> {
  if (!isLineConfigured) return { ok: false, error: 'LINE ยังไม่ได้ตั้งค่า (LINE_CHANNEL_ACCESS_TOKEN/SECRET)' }
  if (!fs.existsSync(RICHMENU_IMAGE)) return { ok: false, error: 'ไม่พบรูป rich menu ผู้เช่า (assets/richmenu.png)' }
  if (!fs.existsSync(ADMIN_RICHMENU_IMAGE)) return { ok: false, error: 'ไม่พบรูป rich menu แอดมิน (assets/richmenu-admin.png)' }
  try {
    const list = await lineClient.getRichMenuList()
    for (const m of list) {
      if (allKnownNames(m.name)) {
        try {
          await lineClient.deleteRichMenu(m.richMenuId)
        } catch {
          /* ignore */
        }
      }
    }
    cachedRichMenuId = null
    cachedOwnerRichMenuId = null
    cachedAdminRichMenuId = null

    const tenantId = await lineClient.createRichMenu(richMenuObject)
    await uploadImage(tenantId, RICHMENU_IMAGE)
    cachedRichMenuId = tenantId

    const ownerImage = fs.existsSync(OWNER_RICHMENU_IMAGE) ? OWNER_RICHMENU_IMAGE : ADMIN_RICHMENU_IMAGE
    const ownerId = await lineClient.createRichMenu(ownerRichMenuObject)
    await uploadImage(ownerId, ownerImage)
    cachedOwnerRichMenuId = ownerId

    const adminId = await lineClient.createRichMenu(adminRichMenuObject)
    await uploadImage(adminId, ADMIN_RICHMENU_IMAGE)
    cachedAdminRichMenuId = adminId

    return { ok: true, richMenuId: tenantId, ownerRichMenuId: ownerId, adminRichMenuId: adminId }
  } catch (err) {
    console.error('[LINE] setupRichMenu failed', err)
    return { ok: false, error: (err as Error).message }
  }
}

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
      if (allKnownNames(m.name)) await lineClient.deleteRichMenu(m.richMenuId)
    }
    cachedRichMenuId = null
    cachedOwnerRichMenuId = null
    cachedAdminRichMenuId = null
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

async function linkMenu(lineUserId: string, id: string | null, label: string) {
  if (!id) return
  try {
    await lineClient.linkRichMenuToUser(lineUserId, id)
  } catch (err) {
    console.error(`[LINE] ${label} failed`, err)
  }
}

export async function setTenantRichMenu(lineUserId: string): Promise<void> {
  if (!isLineConfigured) {
    console.log(`[LINE mock] setTenantRichMenu → ${lineUserId}`)
    return
  }
  await linkMenu(lineUserId, await ensureTenantRichMenu(), 'setTenantRichMenu')
}

/** Property owner LINE menu (บิลทรัพย์สิน + ชุมชน) */
export async function setOwnerRichMenu(lineUserId: string): Promise<void> {
  if (!isLineConfigured) {
    console.log(`[LINE mock] setOwnerRichMenu → ${lineUserId}`)
    return
  }
  await linkMenu(lineUserId, await ensureOwnerRichMenu(), 'setOwnerRichMenu')
}

/** Platform admin LINE menu (ค่าบริการ Owner + จัดการเจ้าของ) */
export async function setAdminRichMenu(lineUserId: string): Promise<void> {
  if (!isLineConfigured) {
    console.log(`[LINE mock] setAdminRichMenu → ${lineUserId}`)
    return
  }
  await linkMenu(lineUserId, await ensureAdminRichMenu(), 'setAdminRichMenu')
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
