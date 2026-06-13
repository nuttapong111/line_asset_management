import fs from 'fs'
import path from 'path'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { env, isS3Configured } from '../lib/env'

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

let s3: S3Client | null = null
if (isS3Configured) {
  s3 = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  })
}

/** Extract the storage key from a stored URL or return the key as-is. */
export function extractStorageKey(stored: string): string {
  if (!stored) return stored
  // S3 virtual-hosted URL: https://bucket.s3.region.amazonaws.com/key
  const s3Match = stored.match(/\.amazonaws\.com\/(.+)$/)
  if (s3Match) return decodeURIComponent(s3Match[1])
  // Local upload URL: http://host/uploads/key
  const localMatch = stored.match(/\/uploads\/(.+)$/)
  if (localMatch) return localMatch[1]
  return stored
}

/**
 * Upload a buffer to S3 (if configured) or local disk.
 * Returns a reference string (S3 URL or local URL). Private S3 buckets cannot
 * be read directly — use readFile() + an authenticated API route instead.
 */
export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.AWS_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )
    return `https://${env.AWS_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`
  }

  // Local disk fallback
  const filePath = path.join(UPLOAD_DIR, key)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, body)
  return `${env.BACKEND_URL}/uploads/${key}`
}

/** Read a file by storage key. Works with S3 (private bucket) or local disk. */
export async function readFile(key: string): Promise<{ body: Buffer; contentType: string }> {
  const normalized = extractStorageKey(key)
  if (s3) {
    const res = await s3.send(new GetObjectCommand({ Bucket: env.AWS_BUCKET, Key: normalized }))
    const bytes = await res.Body!.transformToByteArray()
    return { body: Buffer.from(bytes), contentType: res.ContentType || 'application/octet-stream' }
  }
  const filePath = path.join(UPLOAD_DIR, normalized)
  if (!fs.existsSync(filePath)) throw new Error('File not found')
  return { body: fs.readFileSync(filePath), contentType: guessContentType(normalized) }
}

/** Public URL for local dev only; production S3 files must be served via readFile/API. */
export function publicUrl(key: string): string {
  if (s3) return `https://${env.AWS_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`
  return `${env.BACKEND_URL}/uploads/${key}`
}

function guessContentType(key: string): string {
  if (key.endsWith('.pdf')) return 'application/pdf'
  if (key.endsWith('.png')) return 'image/png'
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

export { UPLOAD_DIR }
