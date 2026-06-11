import { Client, ClientConfig } from '@line/bot-sdk'
import { env, isLineConfigured } from '../env'

const config: ClientConfig = {
  // Provide a placeholder in mock mode so the SDK constructor doesn't throw.
  // Every real call is still guarded by `isLineConfigured` in lineService.
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN || 'mock-access-token',
  channelSecret: env.LINE_CHANNEL_SECRET || 'mock-channel-secret',
}

/**
 * LINE Client singleton. When LINE is not configured we still construct it but
 * lineService guards every call with `isLineConfigured` and logs instead.
 */
export const lineClient = new Client(config)

export { isLineConfigured }
