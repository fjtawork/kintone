# kintone Clone 開発要件（技術）

最終更新: 2026-02-15

## 1. 技術スタック

### 1.1 バックエンド

- 言語: Python
- フレームワーク: FastAPI
- ASGIサーバー: Uvicorn
- ORM: SQLAlchemy (async)
- マイグレーション: Alembic
- 認証: OAuth2 Password Flow + JWT（`/api/v1/auth/login`）

### 1.2 フロントエンド

- 言語: TypeScript
- フレームワーク: Next.js（Reactベース、App Router構成）
- 実行基盤: Node.js / npm
- 主なライブラリ: React Query (`@tanstack/react-query`), Axios

### 1.3 データベース

- PostgreSQL 15（`postgres:15-alpine`）
- 開発環境は `docker-compose.yml` でDBコンテナのみ起動

## 2. 開発環境要件

- Python 仮想環境（`backend/.venv`）
- Node.js / npm（`frontend` 実行用）
- Docker / Docker Compose（DB起動用）

## 3. 現在のアーキテクチャ前提

- Frontend/Backend はローカル起動
- DB は Docker Compose 起動
- フロントは `next.config.ts` により `/api/*` を `http://127.0.0.1:8000/api/*` へリバースプロキシ

## 4. ローカル起動コマンド（開発）

```bash
# 1) DB起動（プロジェクトルート）
docker compose up -d

# 2) Backend起動
cd backend
./.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3) Frontend起動（別ターミナル）
cd frontend
npm run dev -- --hostname 0.0.0.0 --port 3000
```

## 5. 現在の主要データモデル（実装ベース）

- `users`
  - `email`, `full_name`, `hashed_password`, `is_active`, `is_superuser`
  - `department_id`, `job_title_id`
- `departments`
  - `name`, `code`
- `job_titles`
  - `name`, `rank`
- `apps`
  - `name`, `description`, `icon`, `theme`
  - `process_management` (JSONB)
  - `permissions` (JSONB), `app_acl` (JSONB), `record_acl` (JSONB)
  - `view_settings` (JSONB)
  - `created_by`
- `fields`
  - `app_id`, `code`, `type`, `label`, `config` (JSONB)
- `records`
  - `app_id`, `record_number`, `data` (JSONB), `status`, `created_by`

## 6. 実装状況メモ

- Users/Organization（部署・役職）機能はモデル/APIが存在する。
- `users` 追加系の Alembic migration は存在する。
- `departments` / `job_titles` はモデルとAPIがあるため、DB適用時は migration 状況を要確認。

## 7. インフラ前提

- 本番想定: AWS（ECS + Aurora + ALB）
- Terraform 雛形あり（`infrastructure/`）
