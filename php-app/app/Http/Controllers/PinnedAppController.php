<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\Request;
use App\Infrastructure\Database;
use PDO;

class PinnedAppController
{
    public function __construct(
        private readonly Database $db,
    ) {}

    /**
     * ユーザーのピン留めアプリ一覧（sort_order順）。appsテーブルとJOIN。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function index(Request $req, array $user): array
    {
        $stmt = $this->db->pdo()->prepare(
            'SELECT upa.sort_order,
                    a.id, a.name, a.description, a.icon, a.theme,
                    a.created_by, a.created_at, a.updated_at
             FROM user_pinned_apps upa
             INNER JOIN apps a ON a.id = upa.app_id
             WHERE upa.user_id = ?
             ORDER BY upa.sort_order ASC'
        );
        $stmt->execute([$user['id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $apps = array_map(function (array $row): array {
            $row['sort_order'] = (int) $row['sort_order'];
            return $row;
        }, $rows);

        return [200, $apps];
    }

    /**
     * ピン留めを全置換する。
     * リクエストボディ: { "app_ids": ["uuid1", "uuid2", ...] }
     * sort_orderは配列インデックス順。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function update(Request $req, array $user): array
    {
        $body   = $req->json();
        $appIds = $body['app_ids'] ?? [];

        if (!is_array($appIds)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'app_ids must be an array.']];
        }

        // 全て文字列に変換
        $appIds = array_values(array_map('strval', $appIds));

        // 指定されたapp_idが全て存在するか確認
        foreach ($appIds as $appId) {
            $stmt = $this->db->pdo()->prepare('SELECT id FROM apps WHERE id = ? LIMIT 1');
            $stmt->execute([$appId]);
            if ($stmt->fetch() === false) {
                return [404, ['code' => 'NOT_FOUND', 'message' => "App not found: $appId"]];
            }
        }

        $pdo = $this->db->pdo();
        $pdo->beginTransaction();

        try {
            // 既存のピン留めを削除
            $stmt = $pdo->prepare('DELETE FROM user_pinned_apps WHERE user_id = ?');
            $stmt->execute([$user['id']]);

            // 新しいピン留めをINSERT
            foreach ($appIds as $i => $appId) {
                $stmt = $pdo->prepare(
                    'INSERT INTO user_pinned_apps (user_id, app_id, sort_order) VALUES (?, ?, ?)'
                );
                $stmt->execute([$user['id'], $appId, $i]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('PinnedAppController::update error: ' . $e->getMessage());
            return [500, ['code' => 'INTERNAL_ERROR', 'message' => 'Failed to update pinned apps.']];
        }

        // 更新後のリストを返す
        return $this->index($req, $user);
    }
}
