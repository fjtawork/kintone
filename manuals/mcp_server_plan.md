# MCPサーバー化 計画書（コンテキスト込み）

最終更新: 2026-02-17

## 1. 背景

本プロダクトは、kintoneクローンとして以下を実装済み。

- アプリ/レコード管理
- ワークフロー
- レコードチャット（コメント）
- `@` メンション候補（権限フィルタ）
- メンション時の画面通知（ベル通知）
- 通知から対象レコードへの遷移導線

今後、これらの操作を MCP サーバー経由でも実行可能にし、外部エージェント/自動化フローから安全に利用できるようにしたい。

## 2. 目的

- 既存機能を MCP Tool として提供
- 既存の認証/権限ロジックを維持
- APIを重複実装せず、サービス層を再利用
- 段階的に導入し、運用リスクを抑える

## 3. 前提と方針

### 3.1 プロトコル/トランスポート

- MCPは JSON-RPC ベース。
- ただし WebSocket 必須ではない。
- 初期は `stdio` を優先（実装・検証が速い）。
- 必要に応じて HTTP/SSE（常駐運用向け）へ拡張する。

### 3.2 実装方針

- 既存 `backend/app/services/*` を呼ぶ薄いアダプタ層として MCP サーバーを作る。
- DBアクセス・認証コンテキスト注入を MCP 側で行う。
- 権限判定は既存ロジック（AppService / RecordService / PermissionService）を再利用する。

## 4. スコープ（段階導入）

### Phase 1（読み取り中心・最小導入）

- `list_apps`
- `get_records`
- `get_record`
- `list_record_comments`
- `list_notifications`

### Phase 2（書き込み導入）

- `create_record`
- `post_record_comment`
- `mark_notification_read`
- `mark_all_notifications_read`

### Phase 3（チャット体験向上）

- `list_mention_candidates`
- `post_comment_with_mentions`（通知生成含む）

### Phase 4（運用拡張）

- HTTP/SSEトランスポート
- 運用監視・障害時の可観測性拡充

## 5. Tool候補（最小I/O定義）

### 5.1 list_apps

- Input: `{ token, skip?, limit? }`
- Output: `[{ id, name, ... }]`

### 5.2 get_records

- Input: `{ token, app_id, filters?, limit?, cursor? }`
- Output: `{ items, next_cursor, has_next }`

### 5.3 get_record

- Input: `{ token, record_id }`
- Output: `{ id, app_id, data, status, ... }`

### 5.4 create_record

- Input: `{ token, app_id, data }`
- Output: `{ id, record_number, ... }`

### 5.5 list_record_comments

- Input: `{ token, record_id, limit? }`
- Output: `[{ id, user_id, user_name, message, created_at }]`

### 5.6 post_record_comment

- Input: `{ token, record_id, message }`
- Output: `{ id, ... }`

### 5.7 list_mention_candidates

- Input: `{ token, record_id, q?, limit? }`
- Output: `[{ id, full_name, email }]`（閲覧可能ユーザーのみ）

### 5.8 list_notifications

- Input: `{ token, skip?, limit?, unread_only? }`
- Output: `{ items, unread_count }`

### 5.9 mark_notification_read

- Input: `{ token, notification_id }`
- Output: `notification`

## 6. 認証・権限

- すべての tool に `token`（またはセッション）を要求。
- 既存API同等の権限チェックを強制。
  - アプリ閲覧権限
  - レコードACL
  - チャット有効化設定（record_chat_enabled）
- 権限不足時は統一エラーを返す。

## 7. エラー仕様（統一）

- 返却形式: `{ code, message, details? }`
- 代表コード:
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `NOT_FOUND`
  - `VALIDATION_ERROR`
  - `INTERNAL_ERROR`

## 8. 監査ログ要件

最低限、以下を記録。

- 実行時刻
- actor（ユーザー識別子）
- tool名
- 引数（必要に応じてマスキング）
- 結果（成功/失敗）
- 処理時間

## 9. 既存機能との整合メモ

- レコードチャット: 1レコード単位、保持件数上限あり（既定300）。
- メンション通知: ベル通知へ連携済み。
- 通知文面: アプリ名/送信者/本文先頭を表示。
- 通知リンク: 対象レコードへ遷移可能。

MCP Tool化では、上記挙動と一致することを受け入れ条件にする。

## 10. 受け入れ条件（MVP）

- `stdio` トランスポートで tool 呼び出し可能。
- read系tool で既存UIと同じ結果を返す。
- write系tool で既存API同等の権限・副作用（通知など）が動作。
- 監査ログが取得できる。

## 11. 将来検討（非MVP）

- Tool単位のレート制限
- 顧客ごとの機能フラグ連携
- 更新通知機構（売り切りモデル向け）とMCP運用の統合
- 管理画面からMCP設定確認UI

