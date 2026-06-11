import { RichMenu } from '@line/bot-sdk'
import { lineClient } from './client'
import { env, isLineConfigured } from '../env'

const liff = (path: string) => `${env.LIFF_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

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
    cachedRichMenuId = await lineClient.createRichMenu(richMenuObject)
    // NOTE: A 2500×843 PNG must be uploaded for the menu to display.
    // Upload via dashboard or lineClient.setRichMenuImage(cachedRichMenuId, buffer)
    return cachedRichMenuId
  } catch (err) {
    console.error('[LINE] ensureRichMenu failed', err)
    return null
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
