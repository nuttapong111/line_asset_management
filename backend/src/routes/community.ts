import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import { propertyWhere } from '../lib/scope'
import { uploadFile, readFile, extractStorageKey } from '../services/storageService'
import type { JwtPayload } from '../middleware/auth'

const router = Router()
router.use(authMiddleware, requireRole('ADMIN', 'OWNER', 'TENANT'))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG/PNG/WebP allowed'))
  },
})

async function resolveCommunity(user: JwtPayload, requestedOwnerId?: string) {
  if (user.role === 'OWNER' && user.ownerId) {
    const owner = await prisma.owner.findUnique({
      where: { id: user.ownerId },
      include: { properties: { select: { id: true, name: true } } },
    })
    if (!owner) return null
    return {
      ownerId: owner.id,
      ownerName: owner.name,
      owners: [{ id: owner.id, name: owner.name }],
      properties: owner.properties,
      tenantId: null as string | null,
      roomNumber: null as string | null,
      propertyId: null as string | null,
      canModerate: true,
      canAnnounce: true,
      authorName: owner.name,
    }
  }

  if (user.role === 'TENANT' && user.unitId) {
    const unit = await prisma.unit.findUnique({
      where: { id: user.unitId },
      include: {
        property: { include: { owner: true } },
        tenants: { where: { isActive: true } },
      },
    })
    const owner = unit?.property.owner
    if (!unit || !owner) return null
    const tenant = unit.tenants.find((t) => t.id === user.tenantId) || unit.tenants[0]
    return {
      ownerId: owner.id,
      ownerName: owner.name,
      owners: [{ id: owner.id, name: owner.name }],
      properties: [{ id: unit.property.id, name: unit.property.name }],
      tenantId: tenant?.id ?? null,
      roomNumber: unit.roomNumber,
      propertyId: unit.property.id,
      canModerate: false,
      canAnnounce: false,
      authorName: tenant?.name || user.lineUserId || 'ผู้เช่า',
    }
  }

  if (user.role === 'ADMIN' && user.adminId) {
    const owners = await prisma.owner.findMany({
      where: { adminId: user.adminId },
      include: { properties: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (!owners.length) return null
    const owner = owners.find((o) => o.id === requestedOwnerId) || owners[0]
    return {
      ownerId: owner.id,
      ownerName: owner.name,
      owners: owners.map((o) => ({ id: o.id, name: o.name })),
      properties: owner.properties,
      tenantId: null as string | null,
      roomNumber: null as string | null,
      propertyId: null as string | null,
      canModerate: true,
      canAnnounce: true,
      authorName: 'ผู้ดูแล',
    }
  }

  return null
}

function requestedOwnerId(req: { query: { ownerId?: unknown }; body?: { ownerId?: unknown } }) {
  const raw = req.query.ownerId ?? req.body?.ownerId
  return typeof raw === 'string' && raw ? raw : undefined
}

function serializePost(p: {
  id: string
  type: string
  title: string | null
  body: string
  price: unknown
  sold: boolean
  photoUrls: string[]
  pinned: boolean
  authorRole: string
  authorName: string
  roomNumber: string | null
  propertyId: string | null
  createdAt: Date
  property: { name: string } | null
  _count?: { comments: number }
}) {
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    body: p.body,
    price: p.price != null ? Number(p.price) : null,
    sold: p.sold,
    photoUrls: p.photoUrls,
    pinned: p.pinned,
    authorRole: p.authorRole,
    authorName: p.authorName,
    roomNumber: p.roomNumber,
    propertyId: p.propertyId,
    propertyName: p.property?.name ?? null,
    createdAt: p.createdAt,
    commentCount: p._count?.comments ?? 0,
  }
}

router.get('/meta', async (req, res) => {
  const ctx = await resolveCommunity(req.user!, requestedOwnerId(req))
  if (!ctx) return res.status(404).json({ error: 'ยังไม่มีชุมชนสำหรับบัญชีนี้' })
  res.json({
    ownerId: ctx.ownerId,
    ownerName: ctx.ownerName,
    owners: ctx.owners,
    properties: ctx.properties,
    propertyId: ctx.propertyId,
    canModerate: ctx.canModerate,
    canAnnounce: ctx.canAnnounce,
  })
})

router.get('/posts', async (req, res) => {
  const ctx = await resolveCommunity(req.user!, requestedOwnerId(req))
  if (!ctx) return res.status(404).json({ error: 'ยังไม่มีชุมชนสำหรับบัญชีนี้' })
  const type = req.query.type as string | undefined
  const propertyId = req.query.propertyId as string | undefined

  const posts = await prisma.communityPost.findMany({
    where: {
      ownerId: ctx.ownerId,
      hidden: false,
      ...(type && ['ANNOUNCEMENT', 'DISCUSSION', 'MARKETPLACE'].includes(type)
        ? { type: type as 'ANNOUNCEMENT' | 'DISCUSSION' | 'MARKETPLACE' }
        : {}),
      ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : {}),
    },
    include: { property: { select: { name: true } }, _count: { select: { comments: true } } },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 80,
  })
  res.json(posts.map(serializePost))
})

router.get('/posts/:id/photos/:index', async (req, res) => {
  const ctx = await resolveCommunity(req.user!, requestedOwnerId(req))
  if (!ctx) return res.status(404).json({ error: 'ยังไม่มีชุมชนสำหรับบัญชีนี้' })
  const post = await prisma.communityPost.findFirst({
    where: { id: req.params.id, ownerId: ctx.ownerId, hidden: false },
    select: { photoUrls: true },
  })
  const index = Number(req.params.index)
  const stored = post?.photoUrls[index]
  if (!stored) return res.status(404).json({ error: 'ไม่พบรูป' })
  try {
    const file = await readFile(extractStorageKey(stored))
    res.setHeader('Content-Type', file.contentType)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.send(file.body)
  } catch {
    res.status(404).json({ error: 'ไม่พบรูป' })
  }
})

router.get('/posts/:id', async (req, res) => {
  const ctx = await resolveCommunity(req.user!, requestedOwnerId(req))
  if (!ctx) return res.status(404).json({ error: 'ยังไม่มีชุมชนสำหรับบัญชีนี้' })
  const post = await prisma.communityPost.findFirst({
    where: { id: req.params.id, ownerId: ctx.ownerId, hidden: false },
    include: {
      property: { select: { name: true } },
      comments: { orderBy: { createdAt: 'asc' } },
      _count: { select: { comments: true } },
    },
  })
  if (!post) return res.status(404).json({ error: 'ไม่พบโพสต์' })
  res.json({
    ...serializePost(post),
    comments: post.comments.map((c) => ({
      id: c.id,
      authorRole: c.authorRole,
      authorName: c.authorName,
      message: c.message,
      createdAt: c.createdAt,
    })),
  })
})

router.post('/posts', upload.array('photos', 4), async (req, res) => {
  const ctx = await resolveCommunity(req.user!, requestedOwnerId(req))
  if (!ctx) return res.status(404).json({ error: 'ยังไม่มีชุมชนสำหรับบัญชีนี้' })

  const schema = z.object({
    type: z.enum(['ANNOUNCEMENT', 'DISCUSSION', 'MARKETPLACE']),
    title: z.string().max(80).optional(),
    body: z.string().min(1).max(2000),
    price: z.coerce.number().nonnegative().optional(),
    propertyId: z.string().optional(),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })

  if (parse.data.type === 'ANNOUNCEMENT' && !ctx.canAnnounce) {
    return res.status(403).json({ error: 'เฉพาะเจ้าของที่ประกาศได้' })
  }
  if (parse.data.type === 'MARKETPLACE' && (parse.data.price == null || !parse.data.title?.trim())) {
    return res.status(400).json({ error: 'กรุณาใส่ชื่อสินค้าและราคา' })
  }

  let propertyId = parse.data.propertyId || ctx.propertyId || null
  if (req.user!.role === 'OWNER' || req.user!.role === 'ADMIN') {
    if (propertyId) {
      const ok = await prisma.property.findFirst({
        where: { id: propertyId, ...propertyWhere(req.user!) },
      })
      if (!ok) propertyId = null
    }
  } else if (propertyId && propertyId !== ctx.propertyId) {
    propertyId = ctx.propertyId
  }

  const files = (req.files as Express.Multer.File[]) || []
  const photoUrls: string[] = []
  for (const file of files) {
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg'
    const url = await uploadFile(
      `community/${ctx.ownerId}/${Date.now()}-${photoUrls.length}.${ext}`,
      file.buffer,
      file.mimetype
    )
    photoUrls.push(url)
  }

  const post = await prisma.communityPost.create({
    data: {
      ownerId: ctx.ownerId,
      propertyId,
      type: parse.data.type,
      title: parse.data.title?.trim() || null,
      body: parse.data.body.trim(),
      price: parse.data.type === 'MARKETPLACE' ? parse.data.price : null,
      photoUrls,
      pinned: parse.data.type === 'ANNOUNCEMENT',
      authorRole: req.user!.role,
      authorName: ctx.authorName,
      tenantId: ctx.tenantId,
      roomNumber: ctx.roomNumber,
    },
    include: { property: { select: { name: true } }, _count: { select: { comments: true } } },
  })
  res.status(201).json(serializePost(post))
})

router.post('/posts/:id/comments', async (req, res) => {
  const ctx = await resolveCommunity(req.user!, requestedOwnerId(req))
  if (!ctx) return res.status(404).json({ error: 'ยังไม่มีชุมชนสำหรับบัญชีนี้' })
  const schema = z.object({ message: z.string().min(1).max(500) })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const post = await prisma.communityPost.findFirst({
    where: { id: req.params.id, ownerId: ctx.ownerId, hidden: false },
  })
  if (!post) return res.status(404).json({ error: 'ไม่พบโพสต์' })
  const comment = await prisma.communityComment.create({
    data: {
      postId: post.id,
      authorRole: req.user!.role,
      authorName: ctx.authorName,
      tenantId: ctx.tenantId,
      message: parse.data.message.trim(),
    },
  })
  res.status(201).json(comment)
})

router.put('/posts/:id/pin', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const ctx = await resolveCommunity(req.user!, requestedOwnerId(req))
  if (!ctx?.canModerate) return res.status(403).json({ error: 'Forbidden' })
  const post = await prisma.communityPost.findFirst({ where: { id: req.params.id, ownerId: ctx.ownerId } })
  if (!post) return res.status(404).json({ error: 'ไม่พบโพสต์' })
  const updated = await prisma.communityPost.update({
    where: { id: post.id },
    data: { pinned: !post.pinned },
  })
  res.json(updated)
})

router.put('/posts/:id/hide', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const ctx = await resolveCommunity(req.user!, requestedOwnerId(req))
  if (!ctx?.canModerate) return res.status(403).json({ error: 'Forbidden' })
  const post = await prisma.communityPost.findFirst({ where: { id: req.params.id, ownerId: ctx.ownerId } })
  if (!post) return res.status(404).json({ error: 'ไม่พบโพสต์' })
  await prisma.communityPost.update({ where: { id: post.id }, data: { hidden: true } })
  res.json({ ok: true })
})

router.put('/posts/:id/sold', async (req, res) => {
  const ctx = await resolveCommunity(req.user!, requestedOwnerId(req))
  if (!ctx) return res.status(404).json({ error: 'ยังไม่มีชุมชนสำหรับบัญชีนี้' })
  const post = await prisma.communityPost.findFirst({ where: { id: req.params.id, ownerId: ctx.ownerId } })
  if (!post) return res.status(404).json({ error: 'ไม่พบโพสต์' })
  const isAuthor = Boolean(post.tenantId && post.tenantId === ctx.tenantId)
  if (!ctx.canModerate && !isAuthor) return res.status(403).json({ error: 'Forbidden' })
  const updated = await prisma.communityPost.update({
    where: { id: post.id },
    data: { sold: !post.sold },
  })
  res.json(updated)
})

export default router
