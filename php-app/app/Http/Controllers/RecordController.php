<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\HookManager;
use App\Core\Request;
use App\Infrastructure\Database;
use PDO;

class RecordController
{
    public function __construct(
        private readonly Database    $db,
        private readonly HookManager $hooks,
    ) {}

    // ── ヘルパー ──────────────────────────────────────────────────────────────

    private function generateUuid(): string
    {
        $bytes    = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return sprintf(
            '%s-%s-%s-%s-%s',
            bin2hex(substr($bytes, 0, 4)),
            bin2hex(substr($bytes, 4, 2)),
            bin2hex(substr($bytes, 6, 2)),
            bin2hex(substr($bytes, 8, 2)),
            bin2hex(substr($bytes, 10, 6)),
        );
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatRecord(array $row): array
    {
        $row['record_number'] = (int) $row['record_number'];
        $row['data']          = isset($row['data'])
            ? json_decode((string) $row['data'], true)
            : [];
        $row['acl']           = isset($row['acl'])
            ? json_decode((string) $row['acl'], true)
            : null;

        return $row;
    }

    // ── アクション ────────────────────────────────────────────────────────────

    /**
     * レコード一覧（app_idクエリ、新しい順）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function index(Request $req, array $user): array
    {
        $appId = (string) ($req->query('app_id') ?? $req->param('app_id') ?? '');

        if ($appId === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'app_id is required.']];
        }

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, app_id, record_number, data, status, acl, created_by, created_at, updated_at
             FROM records
             WHERE app_id = ?
             ORDER BY created_at DESC'
        );
        $stmt->execute([$appId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $records = array_map(fn($row) => $this->formatRecord($row), $rows);

        return [200, ['records' => $records]];
    }

    /**
     * カーソルページング。
     * クエリパラメータ: cursor(last record id), limit(デフォルト50)
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function paged(Request $req, array $user): array
    {
        $appId  = (string) ($req->query('app_id') ?? $req->param('app_id') ?? '');
        $cursor = (string) ($req->query('cursor') ?? '');
        $limit  = min((int) ($req->query('limit') ?? 50), 200);

        if ($appId === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'app_id is required.']];
        }

        if ($limit < 1) {
            $limit = 50;
        }

        if ($cursor === '') {
            // 最初のページ
            $stmt = $this->db->pdo()->prepare(
                'SELECT id, app_id, record_number, data, status, acl, created_by, created_at, updated_at
                 FROM records
                 WHERE app_id = ?
                 ORDER BY record_number ASC
                 LIMIT ?'
            );
            $stmt->execute([$appId, $limit + 1]);
        } else {
            // カーソル以降のページ
            // cursorはrecord_numberを使う
            $stmt = $this->db->pdo()->prepare(
                'SELECT id, app_id, record_number, data, status, acl, created_by, created_at, updated_at
                 FROM records
                 WHERE app_id = ? AND record_number > ?
                 ORDER BY record_number ASC
                 LIMIT ?'
            );
            $stmt->execute([$appId, (int) $cursor, $limit + 1]);
        }

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $hasNext = count($rows) > $limit;
        if ($hasNext) {
            array_pop($rows);
        }

        $records   = array_map(fn($row) => $this->formatRecord($row), $rows);
        $nextCursor = $hasNext && !empty($records)
            ? (string) end($records)['record_number']
            : null;

        return [200, [
            'items'       => $records,
            'next_cursor' => $nextCursor,
            'has_next'    => $hasNext,
        ]];
    }

    /**
     * レコード作成。record_numberは連番。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function create(Request $req, array $user): array
    {
        $body  = $req->json();
        $appId = (string) ($req->query('app_id') ?? $req->param('app_id') ?? $body['app_id'] ?? '');

        // アプリの存在確認
        $stmt = $this->db->pdo()->prepare('SELECT id FROM apps WHERE id = ? LIMIT 1');
        $stmt->execute([$appId]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'App not found.']];
        }

        $pdo = $this->db->pdo();
        $pdo->beginTransaction();

        try {
            // 連番取得（FOR UPDATE でロック）
            $stmt = $pdo->prepare(
                'SELECT COALESCE(MAX(record_number), 0) + 1 AS next_num
                 FROM records
                 WHERE app_id = ?
                 FOR UPDATE'
            );
            $stmt->execute([$appId]);
            $nextNum = (int) $stmt->fetchColumn();

            $id     = $this->generateUuid();
            $data   = $body['data'] ?? [];
            $status = (string) ($body['status'] ?? 'open');
            $acl    = isset($body['acl'])
                ? json_encode($body['acl'], JSON_UNESCAPED_UNICODE)
                : null;
            $now    = date('Y-m-d H:i:s');

            $stmt = $pdo->prepare(
                'INSERT INTO records (id, app_id, record_number, data, status, acl, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $id,
                $appId,
                $nextNum,
                json_encode($data, JSON_UNESCAPED_UNICODE),
                $status,
                $acl,
                $user['id'],
                $now,
                $now,
            ]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('RecordController::create error: ' . $e->getMessage());
            return [500, ['code' => 'INTERNAL_ERROR', 'message' => 'Failed to create record.']];
        }

        $record = $this->formatRecord([
            'id'            => $id,
            'app_id'        => $appId,
            'record_number' => $nextNum,
            'data'          => json_encode($data, JSON_UNESCAPED_UNICODE),
            'status'        => $status,
            'acl'           => $acl,
            'created_by'    => $user['id'],
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);

        $this->hooks->do_action('record.created', $record, $user);

        return [200, ['record' => $record]];
    }

    /**
     * レコード詳細取得。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function show(Request $req, array $user): array
    {
        $recordId = (string) $req->param('record_id');

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, app_id, record_number, data, status, acl, created_by, created_at, updated_at
             FROM records
             WHERE id = ?
             LIMIT 1'
        );
        $stmt->execute([$recordId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'Record not found.']];
        }

        return [200, ['record' => $this->formatRecord($row)]];
    }

    /**
     * レコード更新。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function update(Request $req, array $user): array
    {
        $recordId = (string) $req->param('record_id');

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, app_id FROM records WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$recordId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'Record not found.']];
        }

        $body   = $req->json();
        $fields = [];
        $values = [];

        if (array_key_exists('data', $body)) {
            $fields[] = 'data = ?';
            $values[] = json_encode($body['data'], JSON_UNESCAPED_UNICODE);
        }
        if (array_key_exists('status', $body)) {
            $fields[] = 'status = ?';
            $values[] = (string) $body['status'];
        }
        if (array_key_exists('acl', $body)) {
            $fields[] = 'acl = ?';
            $values[] = $body['acl'] !== null
                ? json_encode($body['acl'], JSON_UNESCAPED_UNICODE)
                : null;
        }

        if (empty($fields)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'No fields to update.']];
        }

        $now      = date('Y-m-d H:i:s');
        $fields[] = 'updated_at = ?';
        $values[] = $now;
        $values[] = $recordId;

        $sql  = 'UPDATE records SET ' . implode(', ', $fields) . ' WHERE id = ?';
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($values);

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, app_id, record_number, data, status, acl, created_by, created_at, updated_at
             FROM records WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$recordId]);
        $record = $this->formatRecord($stmt->fetch(PDO::FETCH_ASSOC));

        $this->hooks->do_action('record.updated', $record, $user);

        return [200, ['record' => $record]];
    }

    /**
     * レコード削除。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function destroy(Request $req, array $user): array
    {
        $recordId = (string) $req->param('record_id');

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, app_id FROM records WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$recordId]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($record === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'Record not found.']];
        }

        $stmt = $this->db->pdo()->prepare('DELETE FROM records WHERE id = ?');
        $stmt->execute([$recordId]);

        $this->hooks->do_action('record.deleted', $record, $user);

        return [200, ['message' => 'Record deleted successfully.']];
    }

    /**
     * ワークフローアクション実行（status変更）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function workflowAction(Request $req, array $user): array
    {
        $recordId = (string) $req->param('record_id');
        $body     = $req->json();
        $action   = (string) ($body['action'] ?? '');

        if ($action === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'action is required.']];
        }

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, app_id, status FROM records WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$recordId]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($record === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'Record not found.']];
        }

        $oldStatus = $record['status'];
        $newStatus = $action; // actionがそのままnewStatusになる
        $now       = date('Y-m-d H:i:s');

        $stmt = $this->db->pdo()->prepare(
            'UPDATE records SET status = ?, updated_at = ? WHERE id = ?'
        );
        $stmt->execute([$newStatus, $now, $recordId]);

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, app_id, record_number, data, status, acl, created_by, created_at, updated_at
             FROM records WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$recordId]);
        $updatedRecord = $this->formatRecord($stmt->fetch(PDO::FETCH_ASSOC));

        $this->hooks->do_action('record.status.changed', $updatedRecord, $oldStatus, $newStatus, $user);

        return [200, ['record' => $updatedRecord]];
    }

    /**
     * コメント一覧（users JOINしてfull_name含む）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function comments(Request $req, array $user): array
    {
        $recordId = (string) $req->param('record_id');

        // レコード存在確認
        $stmt = $this->db->pdo()->prepare('SELECT id FROM records WHERE id = ? LIMIT 1');
        $stmt->execute([$recordId]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'Record not found.']];
        }

        $stmt = $this->db->pdo()->prepare(
            'SELECT rc.id, rc.record_id, rc.user_id, rc.content AS body, rc.created_at,
                    u.email AS user_email, u.full_name AS user_full_name
             FROM record_comments rc
             INNER JOIN users u ON u.id = rc.user_id
             WHERE rc.record_id = ?
             ORDER BY rc.created_at ASC'
        );
        $stmt->execute([$recordId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [200, ['comments' => $rows]];
    }

    /**
     * コメント作成。@メンション検出してnotifications作成。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function createComment(Request $req, array $user): array
    {
        $recordId = (string) $req->param('record_id');
        $body     = $req->json();
        $bodyText = trim((string) ($body['body'] ?? ''));

        if ($bodyText === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'body is required.']];
        }

        // レコード存在確認
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, app_id FROM records WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$recordId]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($record === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'Record not found.']];
        }

        $commentId = $this->generateUuid();
        $now       = date('Y-m-d H:i:s');

        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO record_comments (id, record_id, user_id, content, created_at)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$commentId, $recordId, $user['id'], $bodyText, $now]);

        // @メンション検出: @[UUID] or @email パターン
        // ここでは @email 形式をサポート
        $mentionedUsers = $this->detectMentions($bodyText);

        foreach ($mentionedUsers as $mentionedUserId) {
            // 自分自身へのメンションはスキップ
            if ($mentionedUserId === $user['id']) {
                continue;
            }

            $notifId = $this->generateUuid();
            $message = sprintf(
                '%s があなたをコメントでメンションしました。',
                $user['full_name'] ?? $user['email']
            );

            try {
                $stmt = $this->db->pdo()->prepare(
                    'INSERT INTO notifications (id, user_id, type, message, data, is_read, created_at)
                     VALUES (?, ?, ?, ?, ?, 0, ?)'
                );
                $stmt->execute([
                    $notifId,
                    $mentionedUserId,
                    'mention',
                    $message,
                    json_encode([
                        'record_id'  => $recordId,
                        'app_id'     => $record['app_id'],
                        'comment_id' => $commentId,
                        'from_user'  => $user['id'],
                    ], JSON_UNESCAPED_UNICODE),
                    $now,
                ]);
            } catch (\Throwable $e) {
                // notificationsテーブルがない場合は無視
                error_log('Notification insert failed: ' . $e->getMessage());
            }
        }

        // 作成されたコメントをuser情報付きで返す
        $comment = [
            'id'             => $commentId,
            'record_id'      => $recordId,
            'user_id'        => $user['id'],
            'body'           => $bodyText,
            'created_at'     => $now,
            'user_email'     => $user['email'],
            'user_full_name' => $user['full_name'],
        ];

        $this->hooks->do_action('record.comment.created', $comment, $record, $user);

        return [200, ['comment' => $comment]];
    }

    /**
     * テキストから @[user_id] または @email 形式のメンションを検出してuser IDの配列を返す。
     *
     * @return list<string>
     */
    private function detectMentions(string $text): array
    {
        $userIds = [];

        // @[UUID] 形式 (例: @[550e8400-e29b-41d4-a716-446655440000])
        if (preg_match_all('/@\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i', $text, $matches)) {
            foreach ($matches[1] as $id) {
                // ユーザーの存在確認
                $stmt = $this->db->pdo()->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
                $stmt->execute([$id]);
                if ($stmt->fetch() !== false) {
                    $userIds[] = $id;
                }
            }
        }

        // @email 形式 (例: @user@example.com)
        if (preg_match_all('/@([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/', $text, $matches)) {
            foreach ($matches[1] as $email) {
                $stmt = $this->db->pdo()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
                $stmt->execute([$email]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row !== false) {
                    $userIds[] = (string) $row['id'];
                }
            }
        }

        return array_values(array_unique($userIds));
    }

    /**
     * @メンション候補のユーザー一覧（id, email, full_name）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function mentionCandidates(Request $req, array $user): array
    {
        $q = (string) ($req->query('q') ?? '');

        if ($q !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
            $stmt = $this->db->pdo()->prepare(
                'SELECT id, email, full_name
                 FROM users
                 WHERE is_active = 1
                   AND (email LIKE ? OR full_name LIKE ?)
                 ORDER BY full_name ASC
                 LIMIT 20'
            );
            $stmt->execute([$like, $like]);
        } else {
            $stmt = $this->db->pdo()->prepare(
                'SELECT id, email, full_name
                 FROM users
                 WHERE is_active = 1
                 ORDER BY full_name ASC
                 LIMIT 50'
            );
            $stmt->execute();
        }

        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [200, ['users' => $users]];
    }
}
