#!/usr/bin/env bash
# Push local main to GitHub (run in Terminal.app outside Cursor if needed)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/.tools/gh:$ROOT/.tools/node/bin:$PATH"
cd "$ROOT"

if ! gh auth status >/dev/null 2>&1; then
  echo "ยังไม่ได้ login GitHub — กำลังเปิดหน้า login..."
  gh auth login --hostname github.com --git-protocol https --web
fi

gh auth setup-git
git status
git push -u origin HEAD
echo ""
echo "✅ Pushed. Railway ควรเริ่ม deploy จาก main อัตโนมัติ"
echo "Repo: https://github.com/nuttapong111/line_asset_management"
