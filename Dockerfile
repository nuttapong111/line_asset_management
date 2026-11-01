# ---- PropFlow single-service image for Railway ----
# Builds the React frontend, then the Express backend, and serves both
# from one Node process (backend serves /api + static frontend).

# 1) Build frontend
FROM node:20-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Same-origin API in production single-service deploy
ARG VITE_API_URL=/api
ARG VITE_LIFF_ID=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_LIFF_ID=$VITE_LIFF_ID
RUN npm run build

# 2) Build backend
FROM node:20-bookworm-slim AS backend
WORKDIR /app/backend
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN ./node_modules/.bin/prisma generate && npm run build

# 3) Runtime
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Production deps, then the same Prisma CLI as the repo (5.22).
# `npx prisma` without this can download Prisma 8, which will not apply these migrations.
COPY backend/package*.json ./
RUN npm ci && npm install --no-save --no-package-lock prisma@5.22.0

# Prisma schema + generated client + built code + fonts
COPY --from=backend /app/backend/prisma ./prisma
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/assets ./assets
RUN ./node_modules/.bin/prisma generate

# Frontend build served from backend/public
COPY --from=frontend /app/frontend/dist ./public

EXPOSE 4000
CMD ["node", "dist/start.js"]
