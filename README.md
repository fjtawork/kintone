# kintone Clone

## Documents

- Requirements index: `manuals/project_requirements.md`
- Project overview (non-engineering): `manuals/project_overview.md`
- Development requirements (engineering): `manuals/development_requirements.md`
- PHP Backend API spec: `manuals/api-spec.md`
- Testing guide: `manuals/testing_guide.md`
- Deployment guide: `manuals/deployment_guide.md`
- Seeded development accounts: `manuals/seed_accounts.md`
- Update distribution strategy memo: `manuals/update_distribution_strategy.md`
- MCP server plan: `manuals/mcp_server_plan.md`

## Features

- **アプリ管理**: アプリの作成・編集・削除、フォームビルダー
- **レコード管理**: CRUD、ページネーション、ワークフロー（ステータス遷移）、コメント・メンション
- **ユーザー管理**: ユーザーCRUD、権限制御（superuser/一般）
- **通知**: メンション通知、既読管理
- **お知らせ**: ダッシュボードへのお知らせ掲示、ピン留め
- **システム設定**: 組織名、セッション設定、IPアロウリスト
- **カスタマイズ**: 管理画面からPHP（サーバーサイドフック）とJavaScript（フロントエンド）を直接編集。WordPress の functions.php + kintone 本家のJSカスタマイズに相当
- **GUIインストーラー**: WordPress風のWebベースインストーラー（DB設定・管理者作成）
