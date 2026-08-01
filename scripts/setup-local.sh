#!/usr/bin/env bash
# Run this in macOS Terminal.app (outside Cursor) to start local Postgres + migrate.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/.tools/node/bin:$PATH"
export DYLD_LIBRARY_PATH="$ROOT/.tools/pgsql/lib"
PG="$ROOT/.tools/pgsql"
DATA="$ROOT/.tools/pgdata"
SOCK="$ROOT/.tools/pgsocket"

if [ ! -x "$ROOT/.tools/node/bin/node" ]; then
  echo "Node not found in .tools — ask the agent to reinstall Node first."
  exit 1
fi
if [ ! -x "$PG/bin/initdb" ]; then
  echo "Postgres binaries missing — ask the agent to reinstall portable Postgres."
  exit 1
fi

mkdir -p "$SOCK"
if [ -f "$DATA/postmaster.pid" ]; then
  "$PG/bin/pg_ctl" -D "$DATA" status && echo "Postgres already running" || true
else
  if [ ! -f "$DATA/PG_VERSION" ]; then
    rm -rf "$DATA"
    mkdir -p "$DATA"
    "$PG/bin/initdb" -D "$DATA" -U propflow --auth-local=trust --auth-host=trust --locale=C --encoding=UTF8
    {
      echo "port = 5434"
      echo "listen_addresses = '127.0.0.1'"
      echo "unix_socket_directories = '$SOCK'"
    } >> "$DATA/postgresql.conf"
  fi
  "$PG/bin/pg_ctl" -D "$DATA" -l "$ROOT/.tools/pg.log" start
  sleep 2
fi

"$PG/bin/pg_ctl" -D "$DATA" status

cd "$ROOT/backend"
npx prisma migrate deploy
npx prisma generate
echo ""
echo "✅ Database migrated."
echo "Start backend:  cd backend && npm run dev"
echo "Start frontend: cd frontend && npm run dev"
