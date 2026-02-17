# テスト実行ガイド

最終更新: 2026-02-17

## 1. 目的

- 開発DBとテストDBを分離し、安全に自動テストを実行する
- 人・生成AIのどちらでも同じ手順で再現できるようにする

## 2. 前提

- PostgreSQL コンテナが起動している
- `backend/.venv` が作成済み
- `backend/.env` に `TEST_DATABASE_URL` が設定済み

`backend/.env` 例:

```env
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=kintone_user
POSTGRES_PASSWORD=kintone_password
POSTGRES_DB=kintone_db
TEST_DATABASE_URL=postgresql+asyncpg://kintone_user:kintone_password@localhost:5432/kintone_test_db
```

## 3. 簡易スクリプト

追加済みスクリプト:

- `backend/scripts/run_tests.sh`

使い方:

```bash
# APIテスト一式（デフォルト）
backend/scripts/run_tests.sh

# 特定ファイルのみ
backend/scripts/run_tests.sh tests/api/test_workflow.py

# 特定ディレクトリのみ
backend/scripts/run_tests.sh tests/api
```

## 4. DB分離ルール

- 開発サーバーは `POSTGRES_DB`（例: `kintone_db`）を使う
- テストは `TEST_DATABASE_URL`（例: `kintone_test_db`）のみを使う
- `TEST_DATABASE_URL` が未設定、または開発DBと同一ならテストは失敗させる

## 5. 運用ルール

- 開発DBを削除・リセットする前に、必ず事前確認を行う
- pytest 実行時は必ずテストDBを使う
- Seeder再投入が必要な場合は `backend/seed_demo_data.py` を実行する

