# Claude Code Prompt — Step 1: Project Scaffold

วางใน Claude Code input (VS Code) เพื่อสร้างโครงสร้าง project และ database

---

Read CLAUDE.md first, then do the following:

## Task: Project scaffold + database

### 1. Create monorepo structure
Create all directories and placeholder files exactly as defined in CLAUDE.md section 3 (Project Structure). For each `.ts` / `.tsx` file, create it with a minimal stub (export default function + TODO comment).

### 2. Docker Compose
Create `docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: propflow
      POSTGRES_PASSWORD: propflow
      POSTGRES_DB: propflow_db
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  backend:
    build: ./backend
    ports: ["4000:4000"]
    depends_on: [postgres, redis]
    env_file: .env
    volumes: [./backend:/app, /app/node_modules]

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    env_file: .env
    volumes: [./frontend:/app, /app/node_modules]

volumes:
  postgres_data:
```

### 3. .env.example
Create `.env.example` with all variables from CLAUDE.md section 5, values left blank.

### 4. Prisma schema
Create `backend/prisma/schema.prisma` with the complete schema from CLAUDE.md section 4. Do not omit any model or enum.

### 5. Backend package.json
```json
{
  "name": "propflow-backend",
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "migrate": "prisma migrate dev",
    "generate": "prisma generate",
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@line/bot-sdk": "^9",
    "@prisma/client": "^5",
    "axios": "^1",
    "cors": "^2",
    "dotenv": "^16",
    "express": "^4",
    "jsonwebtoken": "^9",
    "multer": "^1",
    "node-cron": "^3",
    "pdfkit": "^0.15",
    "promptpay-qr": "^0.5",
    "twilio": "^4",
    "zod": "^3"
  },
  "devDependencies": {
    "@types/express": "^4",
    "@types/node": "^20",
    "prisma": "^5",
    "tsx": "^4",
    "typescript": "^5"
  }
}
```

### 6. Frontend package.json
```json
{
  "name": "propflow-frontend",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@line/liff": "^2",
    "@react-pdf/renderer": "^3",
    "axios": "^1",
    "qrcode.react": "^3",
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "zustand": "^4"
  },
  "devDependencies": {
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@vitejs/plugin-react": "^4",
    "autoprefixer": "^10",
    "postcss": "^8",
    "tailwindcss": "^3",
    "typescript": "^5",
    "vite": "^5"
  }
}
```

### 7. Makefile
```makefile
.PHONY: dev migrate seed install

dev:
	docker-compose up postgres redis -d
	cd backend && npm run dev &
	cd frontend && npm run dev

migrate:
	cd backend && npx prisma migrate dev --name init

seed:
	cd backend && npm run seed

install:
	cd backend && npm install
	cd frontend && npm install
```

### 8. Prisma seed file
Create `backend/prisma/seed.ts` that creates:
- 1 Admin (lineUserId: "mock_admin_001", name: "วิชัย ทดสอบ")
- 1 Property (name: "คอนโด สุขุมวิท 31", promptpayNumber: "0812345678")
- 3 Units (ห้อง 101, 102, 103 ราคา 4500, 3500, 5000)
- 1 Tenant linked to ห้อง 101 (lineUserId: "mock_tenant_001", name: "สมชาย ทดสอบ")

### 9. Run and verify
After creating all files:
1. Run: `npm install` in both frontend/ and backend/
2. Run: `npx prisma generate` in backend/
3. Verify TypeScript compiles: `tsc --noEmit` in backend/
4. Report any errors and fix them.
