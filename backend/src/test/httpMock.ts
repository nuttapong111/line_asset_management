import type { NextFunction, Request, Response } from 'express'
import type { JwtPayload } from '../middleware/auth'

export type MockRes = Response & { statusCode: number; body: unknown }

export function mockRes(): MockRes {
  const res: Record<string, unknown> = {
    statusCode: 200,
    body: undefined,
  }
  res.status = (code: number) => {
    res.statusCode = code
    return res
  }
  res.json = (body: unknown) => {
    res.body = body
    return res
  }
  return res as MockRes
}

export function mockReq(partial: Partial<Request> & { user?: JwtPayload } = {}): Request {
  return {
    headers: {},
    method: 'GET',
    path: '/',
    originalUrl: '/',
    ...partial,
  } as Request
}

export function mockNext(): NextFunction & { called: boolean } {
  const fn = Object.assign(
    ((_err?: unknown) => {
      fn.called = true
    }) as NextFunction,
    { called: false }
  )
  return fn
}
