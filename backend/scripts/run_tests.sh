#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${BACKEND_DIR}"

if [[ ! -f ".env" ]]; then
  echo "Error: backend/.env が見つかりません。TEST_DATABASE_URL を設定してください。" >&2
  exit 1
fi

if ! grep -q '^TEST_DATABASE_URL=' .env; then
  echo "Error: backend/.env に TEST_DATABASE_URL がありません。" >&2
  exit 1
fi

if [[ ! -x "./.venv/bin/pytest" ]]; then
  echo "Error: ./.venv/bin/pytest が見つかりません。backend/.venv を作成してください。" >&2
  exit 1
fi

TARGET="${1:-tests/api}"

exec ./.venv/bin/pytest "${TARGET}" -q
