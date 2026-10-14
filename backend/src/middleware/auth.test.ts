import { describe, expect, it } from 'vitest'
import { authMiddleware, requireRole, signToken } from './auth'
import { mockNext, mockReq, mockRes } from '../test/httpMock'

describe('signToken / authMiddleware', () => {
  it('signs and verifies JWT into req.user', () => {
    const token = signToken({ role: 'ADMIN', adminId: 'a1', lineUserId: 'U1' })
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()
    const next = mockNext()
    authMiddleware(req, res, next)
    expect(next.called).toBe(true)
    expect(req.user?.role).toBe('ADMIN')
    expect(req.user?.adminId).toBe('a1')
  })

  it('rejects missing token', () => {
    const res = mockRes()
    const next = mockNext()
    authMiddleware(mockReq(), res, next)
    expect(next.called).toBe(false)
    expect(res.statusCode).toBe(401)
  })

  it('rejects invalid token', () => {
    const res = mockRes()
    const next = mockNext()
    authMiddleware(mockReq({ headers: { authorization: 'Bearer not-a-jwt' } }), res, next)
    expect(res.statusCode).toBe(401)
  })
})

describe('requireRole', () => {
  it('allows matching role', () => {
    const req = mockReq({ user: { role: 'OWNER', ownerId: 'o1' } })
    const res = mockRes()
    const next = mockNext()
    requireRole('OWNER', 'ADMIN')(req, res, next)
    expect(next.called).toBe(true)
  })

  it('forbids wrong role (OWNER cannot use ADMIN-only)', () => {
    const req = mockReq({ user: { role: 'OWNER', ownerId: 'o1' } })
    const res = mockRes()
    const next = mockNext()
    requireRole('ADMIN')(req, res, next)
    expect(next.called).toBe(false)
    expect(res.statusCode).toBe(403)
  })

  it('401 when no user', () => {
    const res = mockRes()
    const next = mockNext()
    requireRole('TENANT')(mockReq(), res, next)
    expect(res.statusCode).toBe(401)
  })
})
