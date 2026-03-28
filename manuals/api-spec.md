# PHP バックエンド API 仕様書

**Base URL**: `http://localhost:8081`
**Content-Type**: `application/json`
**認証方式**: Bearer JWT（`Authorization: Bearer <token>`）

---

## 共通仕様

### レスポンス形式

成功レスポンスは各エンドポイントのスキーマに従う。

エラーレスポンス例：
```json
{ "code": "VALIDATION_ERROR", "message": "name is required" }
```

主なエラーコード:

| code | HTTPステータス | 意味 |
|------|--------------|------|
| `VALIDATION_ERROR` | 400 | バリデーションエラー |
| `INVALID_CREDENTIALS` | 401 | 認証失敗 |
| `UNAUTHORIZED` | 401 | 認証トークン未提供・無効 |
| `FORBIDDEN` | 403 | 権限不足 |
| `ACCOUNT_DISABLED` | 403 | アカウント無効 |
| `NOT_FOUND` | 404 | リソース未存在 |
| `DUPLICATE_EMAIL` | 409 | メール重複 |
| `INTERNAL_ERROR` | 500 | サーバーエラー |

---

## 1. Health / System

### GET /

認証不要。サービス名を返す。

**レスポンス 200**:
```json
{ "message": "kintone Clone PHP Runtime" }
```

---

### GET /api/v1/health/live

認証不要。サービスが起動していれば 200 を返す。

**レスポンス 200**:
```json
{ "status": "ok" }
```

---

### GET /api/v1/health/ready

認証不要。DB接続含めてレディ状態なら 200 を返す。

**レスポンス 200**:
```json
{ "status": "ready" }
```

---

### GET /api/v1/system/version

認証不要。バージョン情報を返す。

**レスポンス 200**:
```json
{ "version": "1.0.0" }
```

---

### GET /api/v1/system/info

認証不要。システム情報を返す。

---

## 2. Auth

### POST /api/v1/auth/login

認証不要。

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| email | string | ✓ | メールアドレス |
| password | string | ✓ | パスワード |

**レスポンス 200**:
```json
{
  "access_token": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "full_name": "Admin User",
    "is_superuser": true,
    "created_at": "2024-01-01 00:00:00"
  }
}
```

**エラー**:
- 400: email または password が空
- 401: 認証情報不一致（`INVALID_CREDENTIALS`）
- 403: アカウント無効（`ACCOUNT_DISABLED`）

---

### POST /api/v1/auth/signup

認証不要。ユーザー自己登録。

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| email | string | ✓ | メールアドレス |
| password | string | ✓ | パスワード（8文字以上） |
| full_name | string | | 氏名 |

**レスポンス 200**:
```json
{
  "access_token": "eyJhbGci...",
  "user": { ... }
}
```

**エラー**:
- 400: バリデーションエラー
- 409: メール重複

---

### GET /api/v1/auth/me

**認証**: 必須

現在ログイン中のユーザー情報を返す。パスワードハッシュは含まない。

**レスポンス 200**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "User Name",
  "is_superuser": false
}
```

---

## 3. Users

> **注意**: 一覧・作成・更新・削除は superuser 専用。非 superuser からのリクエストは 403 を返す。

---

### GET /api/v1/users/me

**認証**: 必須

ログイン中ユーザーの情報を返す（`/api/v1/auth/me` と同等）。

---

### GET /api/v1/users

**認証**: 必須（superuser のみ）

全ユーザー一覧（作成日降順）。

**レスポンス 200**:
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "User",
    "is_active": true,
    "is_superuser": false,
    "created_at": "2024-01-01 00:00:00"
  }
]
```

---

### POST /api/v1/users

**認証**: 必須（superuser のみ）

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| email | string | ✓ | メールアドレス（有効な形式） |
| password | string | ✓ | パスワード（8文字以上） |
| full_name | string | | 氏名 |
| is_active | bool | | デフォルト true |
| is_superuser | bool | | デフォルト false |

**レスポンス 200**:
```json
{ "user": { "id": "uuid", "email": "...", ... } }
```

**エラー**:
- 400: バリデーションエラー
- 409: メール重複（`DUPLICATE_EMAIL`）

---

### PUT /api/v1/users/{user_id}

**認証**: 必須（superuser のみ）

**パスパラメータ**: `user_id` — 対象ユーザーID

**リクエスト body** (更新するフィールドのみ):

| フィールド | 型 | 説明 |
|-----------|---|------|
| full_name | string | 氏名 |
| is_active | bool | アクティブ状態 |
| is_superuser | bool | superuser権限（自分自身は変更不可） |
| password | string | パスワード（8文字以上） |

**エラー**:
- 400: 更新フィールドなし、または自分自身の is_superuser 変更
- 404: ユーザー未存在

---

### DELETE /api/v1/users/{user_id}

**認証**: 必須（superuser のみ）

**エラー**:
- 400: 自分自身の削除（`Cannot delete yourself.`）
- 404: ユーザー未存在

---

## 4. Apps

### GET /api/v1/apps

**認証**: 必須

全アプリ一覧（作成日降順）。

**レスポンス 200**:
```json
[
  {
    "id": "uuid",
    "name": "My App",
    "description": "",
    "icon": "",
    "theme": "",
    "process_management": {},
    "permissions": {},
    "app_acl": {},
    "record_acl": {},
    "view_settings": {},
    "created_by": "uuid",
    "created_at": "2024-01-01 00:00:00",
    "updated_at": "2024-01-01 00:00:00"
  }
]
```

---

### POST /api/v1/apps

**認証**: 必須

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| name | string | ✓ | アプリ名 |
| description | string | | 説明 |
| icon | string | | アイコン |
| theme | string | | テーマ |
| process_management | object | | プロセス管理設定 |
| permissions | object | | 権限設定 |
| app_acl | object | | アプリACL |
| record_acl | object | | レコードACL |
| view_settings | object | | ビュー設定 |

**レスポンス 200**: 作成されたアプリオブジェクト

---

### GET /api/v1/apps/{app_id}

**認証**: 必須

**レスポンス 200**: アプリオブジェクト
**エラー**: 404（`NOT_FOUND`）

---

### PUT /api/v1/apps/{app_id}

**認証**: 必須

更新するフィールドのみ送信。対応フィールド: `name`, `description`, `icon`, `theme`, `process_management`, `permissions`, `app_acl`, `record_acl`, `view_settings`

**エラー**:
- 400: 更新フィールドなし
- 404: アプリ未存在

---

### PUT /api/v1/apps/{app_id}/view

**認証**: 必須

**リクエスト body**:

| フィールド | 型 | 説明 |
|-----------|---|------|
| view_settings | object | ビュー設定 |

**レスポンス 200**: 更新後のアプリオブジェクト

---

### DELETE /api/v1/apps/{app_id}

**認証**: 必須

**レスポンス 200**:
```json
{ "message": "deleted" }
```

**エラー**: 404（`NOT_FOUND`）

---

## 5. Fields

フィールドはアプリに紐づく。全置換方式（DELETE + INSERT）。

### GET /api/v1/fields/app/{app_id}

**認証**: 必須

`sort_order` 昇順でフィールド一覧を返す。

**レスポンス 200**:
```json
[
  {
    "id": "uuid",
    "app_id": "uuid",
    "code": "title",
    "type": "SINGLE_LINE_TEXT",
    "label": "タイトル",
    "config": {},
    "sort_order": 0
  }
]
```

**エラー**: 404（アプリ未存在）

---

### PUT /api/v1/fields/app/{app_id}

**認証**: 必須

フィールドを全置換する（既存フィールドは全削除 → 新規 INSERT）。

**リクエスト body**: フィールドオブジェクトの配列（または `{"fields": [...]}` ラッパー付き）

各フィールドオブジェクト:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| code | string | ✓ | フィールドコード（アプリ内で一意） |
| type | string | ✓ | フィールドタイプ（例: `SINGLE_LINE_TEXT`） |
| label | string | ✓ | 表示ラベル |
| config | object | | フィールド固有設定 |
| sort_order | int | | 表示順序（省略時はインデックス順） |

**レスポンス 200**: 登録後のフィールド配列

**エラー**:
- 400: code/type/label 未指定、code 重複
- 404: アプリ未存在

---

## 6. Records

### GET /api/v1/records

**認証**: 必須

**クエリパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| app_id | string | ✓ | アプリID |

**レスポンス 200**:
```json
{
  "records": [
    {
      "id": "uuid",
      "app_id": "uuid",
      "record_number": 1,
      "data": {},
      "status": "open",
      "acl": null,
      "created_by": "uuid",
      "created_at": "2024-01-01 00:00:00",
      "updated_at": "2024-01-01 00:00:00"
    }
  ]
}
```

**エラー**: 400（`app_id` 未指定）

---

### GET /api/v1/records/paged

**認証**: 必須

カーソルベースのページング。

**クエリパラメータ**:

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|---|------|-----------|------|
| app_id | string | ✓ | | アプリID |
| cursor | string | | | 前ページ最後の record_number |
| limit | int | | 50 | 取得件数（最大200） |

**レスポンス 200**:
```json
{
  "items": [...],
  "next_cursor": "10",
  "has_next": true
}
```

---

### POST /api/v1/records

**認証**: 必須

> **特記**: `app_id` はクエリパラメータ・パスパラメータ・リクエスト **body** のいずれかで指定可能。

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| app_id | string | ✓* | アプリID（クエリ/bodyのどちらでも可） |
| data | object | | フィールドデータ |
| status | string | | ステータス（デフォルト: `open`） |
| acl | object\|null | | レコードACL |

**レスポンス 200**:
```json
{ "record": { "id": "uuid", "app_id": "uuid", "record_number": 1, ... } }
```

**エラー**:
- 400/404: `app_id` 未指定または空
- 404: 指定した `app_id` のアプリが存在しない

---

### GET /api/v1/records/{record_id}

**認証**: 必須

**レスポンス 200**:
```json
{ "record": { ... } }
```

**エラー**: 404

---

### PUT /api/v1/records/{record_id}

**認証**: 必須

更新するフィールドのみ送信。対応フィールド: `data`, `status`, `acl`

**エラー**:
- 400: 更新フィールドなし
- 404: レコード未存在

---

### DELETE /api/v1/records/{record_id}

**認証**: 必須

**レスポンス 200**:
```json
{ "message": "Record deleted successfully." }
```

**エラー**: 404

---

### POST /api/v1/records/{record_id}/workflow/actions/{action}

**認証**: 必須

ワークフローアクションを実行し、ステータスを変更する。`action` がそのまま新ステータスになる。

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| action | string | ✓ | 新しいステータス値 |

**レスポンス 200**:
```json
{ "record": { ... } }
```

---

### GET /api/v1/records/{record_id}/comments

**認証**: 必須

コメント一覧（作成日昇順）。user情報（email, full_name）含む。

**レスポンス 200**:
```json
{
  "comments": [
    {
      "id": "uuid",
      "record_id": "uuid",
      "user_id": "uuid",
      "body": "コメント本文",
      "created_at": "2024-01-01 00:00:00",
      "user_email": "user@example.com",
      "user_full_name": "User Name"
    }
  ]
}
```

---

### POST /api/v1/records/{record_id}/comments

**認証**: 必須

コメントを作成する。本文中の `@[UUID]` または `@email` 形式のメンションを検出し、対象ユーザーに通知を作成する（自分自身へのメンションは除く）。

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| body | string | ✓ | コメント本文 |

**メンション形式**:
- `@[550e8400-e29b-41d4-a716-446655440000]` — UUID形式
- `@user@example.com` — メールアドレス形式

**レスポンス 200**:
```json
{ "comment": { "id": "uuid", "body": "...", ... } }
```

**エラー**: 400（body が空）, 404（レコード未存在）

---

### GET /api/v1/records/{record_id}/mention-candidates

**認証**: 必須

メンション候補のユーザー一覧（アクティブユーザー、氏名昇順）。

**クエリパラメータ**:

| パラメータ | 型 | 説明 |
|-----------|---|------|
| q | string | email または full_name の部分一致フィルター |

**レスポンス 200**:
```json
{ "users": [{ "id": "uuid", "email": "...", "full_name": "..." }] }
```

---

## 7. Notifications

### GET /api/v1/notifications

**認証**: 必須

ログインユーザーの通知一覧（新しい順）。

**クエリパラメータ**:

| パラメータ | 型 | デフォルト | 説明 |
|-----------|---|-----------|------|
| unread | string | | `1` で未読のみ取得 |
| limit | int | 50 | 取得件数（最大200） |

**レスポンス 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "mention",
      "title": null,
      "body": null,
      "link": null,
      "is_read": false,
      "created_at": "2024-01-01 00:00:00"
    }
  ],
  "unread_count": 3
}
```

---

### PATCH /api/v1/notifications/{id}/read

**認証**: 必須

指定した通知を既読にする。自分の通知のみ操作可能。

**レスポンス 200**:
```json
{ "message": "Notification marked as read." }
```

**エラー**:
- 403: 他ユーザーの通知
- 404: 通知未存在

---

### PATCH /api/v1/notifications/read-all

**認証**: 必須

ログインユーザーの全未読通知を既読にする。

**レスポンス 200**:
```json
{ "message": "5 notification(s) marked as read." }
```

---

### POST /api/v1/notifications/read-all

`PATCH /api/v1/notifications/read-all` と同じ。クライアント互換性のために提供。

---

## 8. Announcements

### GET /api/v1/announcements

**認証**: 必須

お知らせ一覧（ピン留め優先、作成日降順）。author の氏名を含む。

**レスポンス 200**:
```json
[
  {
    "id": "uuid",
    "title": "重要なお知らせ",
    "body": "本文",
    "is_pinned": true,
    "created_by": "uuid",
    "created_at": "2024-01-01 00:00:00",
    "updated_at": "2024-01-01 00:00:00",
    "author_full_name": "Admin User"
  }
]
```

---

### POST /api/v1/announcements

**認証**: 必須

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| title | string | ✓ | タイトル |
| body | string | | 本文 |
| is_pinned | bool | | ピン留め（デフォルト false） |

**レスポンス 200**: 作成されたお知らせオブジェクト

---

### PUT /api/v1/announcements/{announcement_id}

**認証**: 必須（superuser のみ）

更新するフィールドのみ送信。対応フィールド: `title`, `body`, `is_pinned`

**エラー**:
- 400: 更新フィールドなし
- 403: superuser 以外
- 404: お知らせ未存在

---

### DELETE /api/v1/announcements/{announcement_id}

**認証**: 必須（superuser のみ）

**レスポンス 200**:
```json
{ "message": "deleted" }
```

---

## 9. Admin Settings

> **注意**: 全エンドポイントは superuser 専用。

### GET /api/v1/admin/settings

**認証**: 必須（superuser のみ）

管理者設定を返す。

---

### PUT /api/v1/admin/settings

**認証**: 必須（superuser のみ）

管理者設定を更新する。

---

### GET /api/v1/admin/ip-allowlist

**認証**: 必須（superuser のみ）

IPアロウリストを返す。

---

### POST /api/v1/admin/ip-allowlist

**認証**: 必須（superuser のみ）

IPエントリを追加する。

---

### PATCH /api/v1/admin/ip-allowlist/{ip_id}

**認証**: 必須（superuser のみ）

IPエントリを更新する。

---

### DELETE /api/v1/admin/ip-allowlist/{ip_id}

**認証**: 必須（superuser のみ）

IPエントリを削除する。

---

## 10. Custom Code

> **注意**: 読み書きエンドポイントは superuser 専用。配信エンドポイントは認証不要。

### GET /api/v1/admin/custom-php

**認証**: 必須（superuser のみ）

`custom/functions.php` の内容を返す。

**レスポンス 200**:
```json
{ "code": "<?php\ndeclare(strict_types=1);\n// ..." }
```

---

### PUT /api/v1/admin/custom-php

**認証**: 必須（superuser のみ）

`custom/functions.php` を上書きする。

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| code | string | ✓ | PHPコード全体 |

**レスポンス 200**:
```json
{ "success": true }
```

**エラー**: 400（code が文字列でない）, 403（superuser 以外）

---

### GET /api/v1/admin/custom-js/global

**認証**: 必須（superuser のみ）

`custom/global.js` の内容を返す。

**レスポンス 200**:
```json
{ "code": "// global JS code..." }
```

---

### PUT /api/v1/admin/custom-js/global

**認証**: 必須（superuser のみ）

`custom/global.js` を上書きする。

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| code | string | ✓ | JavaScriptコード全体 |

**レスポンス 200**:
```json
{ "success": true }
```

---

### GET /api/v1/apps/{app_id}/custom-js

**認証**: 必須（superuser のみ）

アプリ別 `custom/apps/{app_id}.js` の内容を返す。

**レスポンス 200**:
```json
{ "code": "// app-specific JS..." }
```

---

### PUT /api/v1/apps/{app_id}/custom-js

**認証**: 必須（superuser のみ）

アプリ別JSファイルを上書きする。

**リクエスト body**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| code | string | ✓ | JavaScriptコード全体 |

**レスポンス 200**:
```json
{ "success": true }
```

---

### GET /api/v1/custom-js/global.js

**認証**: 不要

グローバルJSファイルを `application/javascript` として配信する。フロントエンドが `<script>` タグで読み込む用途。

---

### GET /api/v1/custom-js/apps/{app_id}.js

**認証**: 不要

アプリ別JSファイルを `application/javascript` として配信する。該当アプリが存在しない場合は空のJSを返す。

---

## 12. Pinned Apps

### GET /api/v1/users/me/pinned-apps

**認証**: 必須

ログインユーザーのピン留めアプリ一覧を返す。

---

### PUT /api/v1/users/me/pinned-apps

**認証**: 必須

ピン留めアプリを更新する。

---

## 13. Organization (Stub)

現在はテーブル未実装のため空配列を返す。

### GET /api/v1/organization/departments

**認証**: 必須
**レスポンス 200**: `[]`

### GET /api/v1/organization/job_titles

**認証**: 必須
**レスポンス 200**: `[]`

---

## 付録: JWT トークン仕様

- アルゴリズム: HS256
- ペイロード: `sub`（user_id）, `email`, `is_superuser`, `iat`, `exp`
- 有効期限: 環境変数 `JWT_TTL_SECONDS`（デフォルト 3600 秒）
- ヘッダー: `Authorization: Bearer <token>`
