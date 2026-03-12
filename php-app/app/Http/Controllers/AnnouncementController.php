<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\Request;
use App\Infrastructure\Database;
use PDO;

class AnnouncementController
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

    private function selectSql(): string
    {
        return 'SELECT a.id, a.title, a.body, a.is_pinned, a.created_by,
                       a.created_at, a.updated_at,
                       u.full_name AS author_full_name
                FROM announcements a
                LEFT JOIN users u ON u.id = a.created_by';
    }

    private function format(array $row): array
    {
        $row['is_pinned'] = (bool)$row['is_pinned'];
        return $row;
    }

    public function index(Request $req, array $user): array
    {
        $stmt = $this->db->pdo()->prepare($this->selectSql() . ' ORDER BY a.is_pinned DESC, a.created_at DESC');
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return [200, array_map(fn($r) => $this->format($r), $rows)];
    }

    public function create(Request $req, array $user): array
    {
        $body  = $req->json();
        $title = trim((string)($body['title'] ?? ''));
        if ($title === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'title is required']];
        }

        $id  = $this->generateUuid();
        $now = date('Y-m-d H:i:s');
        $this->db->pdo()->prepare(
            'INSERT INTO announcements (id, title, body, is_pinned, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([$id, $title, (string)($body['body'] ?? ''), !empty($body['is_pinned']) ? 1 : 0, $user['id'], $now, $now]);

        $stmt = $this->db->pdo()->prepare($this->selectSql() . ' WHERE a.id = ? LIMIT 1');
        $stmt->execute([$id]);
        return [200, $this->format($stmt->fetch(PDO::FETCH_ASSOC))];
    }

    public function update(Request $req, array $user): array
    {
        if (!(bool)($user['is_superuser'] ?? false)) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Superuser required']];
        }

        $id   = (string)$req->param('announcement_id');
        $stmt = $this->db->pdo()->prepare('SELECT id FROM announcements WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'Not found']];
        }

        $body   = $req->json();
        $fields = [];
        $values = [];
        if (isset($body['title'])) { $fields[] = 'title = ?';     $values[] = trim((string)$body['title']); }
        if (array_key_exists('body', $body)) { $fields[] = 'body = ?'; $values[] = (string)$body['body']; }
        if (array_key_exists('is_pinned', $body)) { $fields[] = 'is_pinned = ?'; $values[] = $body['is_pinned'] ? 1 : 0; }
        if (empty($fields)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'Nothing to update']];
        }

        $now      = date('Y-m-d H:i:s');
        $fields[] = 'updated_at = ?'; $values[] = $now;
        $values[] = $id;
        $this->db->pdo()->prepare('UPDATE announcements SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

        $stmt = $this->db->pdo()->prepare($this->selectSql() . ' WHERE a.id = ? LIMIT 1');
        $stmt->execute([$id]);
        return [200, $this->format($stmt->fetch(PDO::FETCH_ASSOC))];
    }

    public function destroy(Request $req, array $user): array
    {
        if (!(bool)($user['is_superuser'] ?? false)) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Superuser required']];
        }

        $id   = (string)$req->param('announcement_id');
        $stmt = $this->db->pdo()->prepare('SELECT id FROM announcements WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'Not found']];
        }

        $this->db->pdo()->prepare('DELETE FROM announcements WHERE id = ?')->execute([$id]);
        return [200, ['message' => 'deleted']];
    }
}
