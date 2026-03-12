<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\Request;
use App\Infrastructure\Database;
use PDO;

class FieldController
{
    public function __construct(
        private readonly Database $db,
    ) {}

    private function generateUuid(): string
    {
        $bytes    = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return sprintf('%s-%s-%s-%s-%s',
            bin2hex(substr($bytes, 0, 4)), bin2hex(substr($bytes, 4, 2)),
            bin2hex(substr($bytes, 6, 2)), bin2hex(substr($bytes, 8, 2)),
            bin2hex(substr($bytes, 10, 6)));
    }

    private function formatField(array $row): array
    {
        $row['sort_order'] = (int) $row['sort_order'];
        if (isset($row['config']) && is_string($row['config'])) {
            $row['config'] = json_decode($row['config'], true);
        }
        return $row;
    }

    /**
     * アプリに紐づくフィールド一覧を取得する（sort_order順）。
     * レスポンス: フィールドオブジェクトの配列（直接）
     */
    public function listByApp(Request $req, array $user): array
    {
        $appId = (string) $req->param('app_id');

        $stmt = $this->db->pdo()->prepare('SELECT id FROM apps WHERE id = ? LIMIT 1');
        $stmt->execute([$appId]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'App not found.']];
        }

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, app_id, code, type, label, config, sort_order
             FROM fields
             WHERE app_id = ?
             ORDER BY sort_order ASC'
        );
        $stmt->execute([$appId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [200, array_map(fn($row) => $this->formatField($row), $rows)];
    }

    /**
     * フィールドを全置換（DELETE + INSERT）する。
     * リクエストボディ: [ { code, type, label, config? }, ... ]（配列直接）
     */
    public function bulkUpdate(Request $req, array $user): array
    {
        $appId = (string) $req->param('app_id');

        $stmt = $this->db->pdo()->prepare('SELECT id FROM apps WHERE id = ? LIMIT 1');
        $stmt->execute([$appId]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'App not found.']];
        }

        $body = $req->json();

        // 配列直接（ラッパーなし）を受け取る
        $fields = is_array($body) && isset($body[0]) ? $body : ($body['fields'] ?? []);

        if (!is_array($fields)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'Request body must be an array of fields.']];
        }

        foreach ($fields as $i => $field) {
            if (empty($field['code'])) {
                return [400, ['code' => 'VALIDATION_ERROR', 'message' => "fields[$i].code is required."]];
            }
            if (empty($field['type'])) {
                return [400, ['code' => 'VALIDATION_ERROR', 'message' => "fields[$i].type is required."]];
            }
            if (empty($field['label'])) {
                return [400, ['code' => 'VALIDATION_ERROR', 'message' => "fields[$i].label is required."]];
            }
        }

        // codeの重複チェック
        $codes = array_column($fields, 'code');
        if (count($codes) !== count(array_unique($codes))) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'field code must be unique within the app.']];
        }

        $pdo = $this->db->pdo();
        $pdo->beginTransaction();

        try {
            $pdo->prepare('DELETE FROM fields WHERE app_id = ?')->execute([$appId]);

            $inserted = [];
            foreach ($fields as $i => $field) {
                $id        = $this->generateUuid();
                $code      = (string) $field['code'];
                $type      = (string) $field['type'];
                $label     = (string) $field['label'];
                $config    = json_encode($field['config'] ?? new \stdClass(), JSON_UNESCAPED_UNICODE);
                $sortOrder = (int) ($field['sort_order'] ?? $i);

                $pdo->prepare(
                    'INSERT INTO fields (id, app_id, code, type, label, config, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?)'
                )->execute([$id, $appId, $code, $type, $label, $config, $sortOrder]);

                $inserted[] = $this->formatField([
                    'id'         => $id,
                    'app_id'     => $appId,
                    'code'       => $code,
                    'type'       => $type,
                    'label'      => $label,
                    'config'     => $config,
                    'sort_order' => $sortOrder,
                ]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('FieldController::bulkUpdate error: ' . $e->getMessage());
            return [500, ['code' => 'INTERNAL_ERROR', 'message' => 'Failed to update fields.']];
        }

        return [200, $inserted];
    }
}
