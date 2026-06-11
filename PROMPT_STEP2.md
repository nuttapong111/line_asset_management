# Claude Code Prompt — Step 2: Auth + LIFF Init

Read CLAUDE.md sections 6 (Auth Flow) and 7 (Invite Flow) first.

---

## Task: LINE Login authentication (end-to-end)

### Backend: POST /api/auth/line

Implement `backend/src/routes/auth.ts`:

```typescript
// POST /api/auth/line
// Body: { accessToken: string, profile: { userId, displayName, pictureUrl } }
// 1. Verify token with LINE: GET https://api.line.me/oauth2/v2.1/verify?access_token=...
// 2. Confirm channelId matches LINE_LOGIN_CHANNEL_ID
// 3. Find lineUserId in Admin table → role = "ADMIN"
//    Find lineUserId in Tenant table (isActive=true) → role = "TENANT", include unitId
//    Not found → role = "NEW"
// 4. Sign JWT: { lineUserId, role, unitId?, adminId? }
//    secret: JWT_SECRET, expiresIn: JWT_EXPIRES_IN
// 5. Return: { token, role, user: { lineUserId, name, pictureUrl } }
```

### Backend: JWT middleware

Implement `backend/src/middleware/auth.ts`:
- Extract Bearer token from Authorization header
- Verify with jsonwebtoken
- Attach decoded payload to `req.user`
- Return 401 if missing/invalid

### Backend: Mock mode for development

When `NODE_ENV=development` and no LINE credentials set:
- Accept POST /auth/line with `{ mockRole: "ADMIN" | "TENANT" }` in body
- Return mock JWT with seed data user

### Frontend: LIFF init + auth store

Implement `frontend/src/lib/liff.ts`:
```typescript
// initLiff(): void
//   await liff.init({ liffId: import.meta.env.VITE_LIFF_ID })
//   if !liff.isLoggedIn() → liff.login({ redirectUri: window.location.href })
//   const token = liff.getAccessToken()
//   const profile = await liff.getProfile()
//   POST /api/auth/line → get JWT
//   store in Zustand auth store

// In dev mode (no LIFF_ID): use mock login
```

Implement `frontend/src/store/authStore.ts` (Zustand):
```typescript
interface AuthState {
  jwt: string | null
  role: 'ADMIN' | 'TENANT' | 'NEW' | null
  user: { lineUserId: string; name: string; pictureUrl?: string } | null
  unitId?: string
  adminId?: string
  setAuth(jwt, role, user, unitId?, adminId?): void
  clearAuth(): void
}
```

### Frontend: App.tsx routing

```typescript
// Route logic after LIFF init:
// role === 'ADMIN'  → /admin/portfolio
// role === 'TENANT' → /tenant/home
// role === 'NEW'    → /link-room
// null (loading)    → <Splash />
// Check ?token= param first → if present, go to /link-room?token=...
```

### Frontend: Splash.tsx

Loading screen with:
- PropFlow logo (house icon)
- "ระบบจัดการบ้านเช่า" subtitle
- LINE green background
- Spinner while LIFF initializes

### Test
After implementation:
- In dev mode: visiting localhost:5173 should show Splash then redirect based on mock role
- Confirm JWT is stored in Zustand (check React DevTools)
- Confirm axios interceptor sends Bearer token on every request
