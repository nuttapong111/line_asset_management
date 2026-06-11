import fs from 'fs'
import path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
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

/**
 * Upload a buffer to S3 (if configured) or local disk.
 * Returns a public URL.
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

export { UPLOAD_DIR }
