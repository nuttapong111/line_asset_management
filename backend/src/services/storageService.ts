import fs from 'fs'
import path from 'path'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { env, isR2Configured } from '../lib/env'

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

let s3: S3Client | null = null
if (isR2Configured) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  })
}

/** Extract the storage key from a stored URL or return the key as-is. */
export function extractStorageKey(stored: string): string {
  if (!stored) return stored
  // Internal R2 reference: r2://bucket/key
  if (stored.startsWith('r2://')) {
    const rest = stored.slice(6)
    const i = rest.indexOf('/')
    return i >= 0 ? rest.slice(i + 1) : rest
  }
  // Legacy S3 URL
  const s3Match = stored.match(/\.amazonaws\.com\/(.+)$/)
  if (s3Match) return decodeURIComponent(s3Match[1])
  // R2 S3-compatible URL
  const r2Match = stored.match(/r2\.cloudflarestorage\.com\/[^/]+\/(.+)$/)
  if (r2Match) return decodeURIComponent(r2Match[1])
  // Local upload URL: http://host/uploads/key
  const localMatch = stored.match(/\/uploads\/(.+)$/)
  if (localMatch) return localMatch[1]
  return stored
}

/**
 * Upload a buffer to Cloudflare R2 (if configured) or local disk.
 * Returns a reference string (r2:// or local URL). Private buckets must
 * be read via readFile() + an authenticated API route.
 */
export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )
    return `r2://${env.R2_BUCKET}/${key}`
  }

  const filePath = path.join(UPLOAD_DIR, key)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, body)
  return `${env.BACKEND_URL}/uploads/${key}`
}

/** Read a file by storage key. Works with R2 (private bucket) or local disk. */
export async function readFile(key: string): Promise<{ body: Buffer; contentType: string }> {
  const normalized = extractStorageKey(key)
  if (s3) {
    const res = await s3.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: normalized }))
    const bytes = await res.Body!.transformToByteArray()
    return { body: Buffer.from(bytes), contentType: res.ContentType || 'application/octet-stream' }
  }
  const filePath = path.join(UPLOAD_DIR, normalized)
  if (!fs.existsSync(filePath)) throw new Error('File not found')
  return { body: fs.readFileSync(filePath), contentType: guessContentType(normalized) }
}

/** Legacy helper — production files must be served via readFile/API. */
export function publicUrl(key: string): string {
  if (s3) return `r2://${env.R2_BUCKET}/${extractStorageKey(key)}`
  return `${env.BACKEND_URL}/uploads/${extractStorageKey(key)}`
}

function guessContentType(key: string): string {
  if (key.endsWith('.pdf')) return 'application/pdf'
  if (key.endsWith('.png')) return 'image/png'
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

export { UPLOAD_DIR }
