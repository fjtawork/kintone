# カスタムコードエディタ機能 設計書

## 概要

ユーザー（superuser）がWeb管理画面からPHP/JavaScriptコードを編集・保存できるカスタマイズ機構。WordPress の functions.php エディタや kintone 本家の JavaScript カスタマイズに相当する。

## 背景

既存のHookManager（WordPress式 action/filter）と `custom/functions.php` の仕組みがあり、サーバーサイドのフックポイントは揃っている。しかし編集にはサーバーへのファイルアクセスが必要で、管理画面からは操作できない。また、フロントエンド側のカスタマイズ（条件付き書式、DOM操作、外部連携）の仕組みがない。

## 機能

### 1. カスタムPHPエディタ（サーバーサイド）

**目的**: `custom/functions.php` を管理画面から編集可能にする

- **UI**: 管理画面の新規メニュー「カスタマイズ」→「PHP」
- **エディタ**: Monaco Editor（PHPシンタックスハイライト、行番号）
- **権限**: superuser のみ
- **保存先**: `custom/functions.php`（既存ファイル）
- **リファレンス**: エディタの横に利用可能なフック一覧と引数の説明を表示

#### 利用可能なフック一覧（リファレンス表示用）

| フック名 | 引数 | 説明 |
|----------|------|------|
| `record.created` | `$record, $user` | レコード作成時 |
| `record.updated` | `$record, $user` | レコード更新時 |
| `record.deleted` | `$record, $user` | レコード削除時 |
| `record.status.changed` | `$record, $oldStatus, $newStatus, $user` | ステータス変更時 |
| `record.comment.created` | `$comment, $record, $user` | コメント追加時 |
| `app.created` | `$app, $user` | アプリ作成時 |
| `app.updated` | `$app, $user` | アプリ更新時 |
| `app.deleted` | `$app, $user` | アプリ削除時 |
| `auth.login.success` | `$user` | ログイン成功時 |
| `auth.login.failed` | `$email` | ログイン失敗時 |
| `auth.signup` | `$user` | サインアップ時 |

### 2. カスタムJavaScriptエディタ（クライアントサイド）

**目的**: フロントエンドで実行されるJSコードをユーザーが自由に編集できるようにする

#### 2a. グローバルJS

- **UI**: 管理画面の「カスタマイズ」→「JavaScript」
- **エディタ**: Monaco Editor（JSシンタックスハイライト）
- **権限**: superuser のみ
- **保存先**: `custom/global.js`
- **読み込み**: 全ページのレイアウトで読み込み・実行

#### 2b. アプリJS

- **UI**: アプリ設定画面の新規タブ「JavaScript」
- **エディタ**: Monaco Editor（JSシンタックスハイライト）
- **権限**: superuser のみ
- **保存先**: `custom/apps/{app_id}.js`
- **読み込み**: 該当アプリのページでのみ読み込み・実行

## API設計

### カスタムPHP

```
GET  /api/v1/admin/custom-php
  Response: { "code": "<?php\n// custom code..." }

PUT  /api/v1/admin/custom-php
  Body: { "code": "<?php\nadd_action(...);" }
  Response: { "success": true }
```

### カスタムJS（グローバル）

```
GET  /api/v1/admin/custom-js/global
  Response: { "code": "// global JS..." }

PUT  /api/v1/admin/custom-js/global
  Body: { "code": "console.log('hello');" }
  Response: { "success": true }
```

### カスタムJS（アプリ別）

```
GET  /api/v1/apps/{id}/custom-js
  Response: { "code": "// app JS..." }

PUT  /api/v1/apps/{id}/custom-js
  Body: { "code": "// app specific JS" }
  Response: { "success": true }
```

### JS配信エンドポイント（認証不要）

フロントエンドが `<script>` タグで読み込むための公開エンドポイント:

```
GET  /api/v1/custom-js/global.js
  Response: Content-Type: application/javascript
  Body: // raw JS code

GET  /api/v1/custom-js/apps/{app_id}.js
  Response: Content-Type: application/javascript
  Body: // raw JS code
```

## アーキテクチャ

### PHP バックエンド（php-app/）

- `CustomCodeController` — PHP/JSコードの読み書きAPI
- superuser チェックは既存の AuthMiddleware + role チェック
- ファイル読み書きは `file_get_contents` / `file_put_contents`
- JS配信エンドポイントは認証なし（静的JSファイルとして配信）

### フロントエンド（frontend/）

- `@monaco-editor/react` パッケージ追加
- 管理画面:
  - `/admin/customize/php` — PHPエディタページ
  - `/admin/customize/js` — グローバルJSエディタページ
- アプリ設定画面:
  - 既存の設定タブに「JavaScript」タブ追加
- JS読み込み:
  - レイアウト（`layout.tsx`）でグローバルJS を `<script>` タグで注入
  - アプリページでアプリJS を `<script>` タグで注入

### ファイル構成

```
custom/
  functions.php    # カスタムPHP（既存）
  global.js        # グローバルJS（新規、初期は空ファイル）
  apps/            # アプリ別JSディレクトリ（新規）
    {app_id}.js    # アプリ別JS
```

## セキュリティ

- **PHP/JSの編集はsuperuserのみ**: APIレベルで `is_superuser` チェック
- **PHPコード実行**: サーバー上で既に `custom/functions.php` が require されている仕組みそのまま。管理者はサーバーを信頼する前提（WordPress同様）
- **JSコード実行**: ブラウザで全ユーザーに対して実行される。superuserが悪意あるコードを入れないことを前提とする（kintone本家と同様）

## 実装しないもの

- コードのバージョン管理・履歴（将来の拡張としてあり得る）
- PHPコードのサンドボックス実行
- JSコードのバリデーション・lint
- ファイルアップロードによるプラグイン管理
