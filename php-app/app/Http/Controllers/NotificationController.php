<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\Request;
use App\Infrastructure\Database;
use PDO;

class NotificationController
{
    public function __construct(
        private readonly Database $db,
    ) {}

    /**
     * ログインユーザーの通知一覧（新しい順）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function index(Request $req, array $user): array
    {
        $onlyUnread = $req->query('unread') === '1';
        $limit      = min((int) ($req->query('limit') ?? 50), 200);
        if ($limit < 1) {
            $limit = 50;
        }

        $sql    = 'SELECT id, user_id, type, title, body, link, is_read, created_at
                   FROM notifications
                   WHERE user_id = ?';
        $params = [$user['id']];

        if ($onlyUnread) {
            $sql .= ' AND is_read = 0';
        }

        $sql .= ' ORDER BY created_at DESC LIMIT ?';
        $params[] = $limit;

        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $notifications = array_map(function (array $row): array {
            $row['is_read'] = (bool) $row['is_read'];
            $row['data']    = isset($row['data'])
                ? json_decode((string) $row['data'], true)
                : null;
            return $row;
        }, $rows);

        // 未読カウント
        $stmt = $this->db->pdo()->prepare(
            'SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0'
        );
        $stmt->execute([$user['id']]);
        $unreadCount = (int) $stmt->fetchColumn();

        return [200, [
            'items' => $notifications,
            'unread_count'  => $unreadCount,
        ]];
    }

    /**
     * 通知を既読にする。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function markRead(Request $req, array $user): array
    {
        $notifId = (string) $req->param('notification_id');

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, user_id FROM notifications WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$notifId]);
        $notif = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($notif === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'Notification not found.']];
        }

        // 自分の通知のみ
        if ($notif['user_id'] !== $user['id']) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Cannot mark others\' notifications.']];
        }

        $stmt = $this->db->pdo()->prepare(
            'UPDATE notifications SET is_read = 1 WHERE id = ?'
        );
        $stmt->execute([$notifId]);

        return [200, ['message' => 'Notification marked as read.']];
    }

    /**
     * 全通知を既読にする。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function markAllRead(Request $req, array $user): array
    {
        $stmt = $this->db->pdo()->prepare(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
        );
        $stmt->execute([$user['id']]);
        $affected = $stmt->rowCount();

        return [200, ['message' => "$affected notification(s) marked as read."]];
    }
}
