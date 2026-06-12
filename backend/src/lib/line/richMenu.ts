import fs from 'fs'
import path from 'path'
import { RichMenu } from '@line/bot-sdk'
import { lineClient } from './client'
import { env, isLineConfigured } from '../env'

const liff = (p: string) => `${env.LIFF_BASE_URL}${p.startsWith('/') ? '' : '/'}${p}`

const RICHMENU_IMAGE = path.resolve(process.cwd(), 'assets', 'richmenu.png')

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

let cachedRichMenuId: string | null = null

async function uploadImage(richMenuId: string): Promise<void> {
  if (!fs.existsSync(RICHMENU_IMAGE)) {
    console.error('[LINE] rich menu image not found at', RICHMENU_IMAGE)
    return
  }
  const buffer = fs.readFileSync(RICHMENU_IMAGE)
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

/**
 * Create (or recreate) the rich menu, upload its image, and set it as the
 * default menu shown to every OA friend. Returns the rich menu id.
 */
export async function setupRichMenu(): Promise<{ ok: boolean; richMenuId?: string; error?: string }> {
  if (!isLineConfigured) return { ok: false, error: 'LINE ยังไม่ได้ตั้งค่า (LINE_CHANNEL_ACCESS_TOKEN/SECRET)' }
  if (!fs.existsSync(RICHMENU_IMAGE)) return { ok: false, error: 'ไม่พบรูป rich menu (assets/richmenu.png)' }
  try {
    // remove old menus with the same name to avoid duplicates
    const list = await lineClient.getRichMenuList()
    for (const m of list) {
      if (m.name === richMenuObject.name) {
        try {
          await lineClient.deleteRichMenu(m.richMenuId)
        } catch {
          /* ignore */
        }
      }
    }
    const id = await lineClient.createRichMenu(richMenuObject)
    await uploadImage(id)
    await lineClient.setDefaultRichMenu(id)
    cachedRichMenuId = id
    return { ok: true, richMenuId: id }
  } catch (err) {
    console.error('[LINE] setupRichMenu failed', err)
    return { ok: false, error: (err as Error).message }
  }
}

/** Remove the default rich menu and delete the app's menu(s). */
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
      if (m.name === richMenuObject.name) await lineClient.deleteRichMenu(m.richMenuId)
    }
    cachedRichMenuId = null
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
