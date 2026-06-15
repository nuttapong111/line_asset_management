import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { issueFileViewUrls, isAllowedFilePath } from '../services/fileViewService'

const router = Router()
router.use(authMiddleware)

const schema = z.object({
  path: z.string().min(1),
})

// POST /api/files/view-token — short-lived HTTPS URL for LIFF external browser (download/print on mobile)
router.post('/view-token', async (req, res) => {
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid path' })

  const clean = parse.data.path.replace(/^\//, '')
  if (!isAllowedFilePath(clean)) return res.status(400).json({ error: 'Path not allowed' })

  try {
    const urls = await issueFileViewUrls(req.user!, clean)
    res.json(urls)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('not found') || msg.includes('Not found')) {
      return res.status(404).json({ error: msg })
    }
    return res.status(403).json({ error: 'Access denied' })
  }
})

export default router
