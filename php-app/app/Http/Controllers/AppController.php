<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\HookManager;
use App\Core\Request;
use App\Infrastructure\Database;
use PDO;

class AppController
{
    public function __construct(
        private readonly Database    $db,
        private readonly HookManager $hooks,
    ) {}

    private function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return sprintf('%s-%s-%s-%s-%s',
            bin2hex(substr($bytes, 0, 4)), bin2hex(substr($bytes, 4, 2)),
            bin2hex(substr($bytes, 6, 2)), bin2hex(substr($bytes, 8, 2)),
            bin2hex(substr($bytes, 10, 6)));
    }

    private function formatApp(array $row): array
    {
        foreach (['process_management', 'permissions', 'app_acl', 'record_acl', 'view_settings'] as $col) {
            if (isset($row[$col]) && is_string($row[$col])) {
                $row[$col] = json_decode($row[$col], true);
            }
        }
        return $row;
    }

    private function selectColumns(): string
    {
        return 'id, name, description, icon, theme, process_management, permissions,
                app_acl, record_acl, view_settings, created_by, created_at, updated_at';
    }

    public function index(Request $req, array $user): array
    {
        $stmt = $this->db->pdo()->query(
            'SELECT ' . $this->selectColumns() . ' FROM apps ORDER BY created_at DESC'
        );
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return [200, array_map(fn($r) => $this->formatApp($r), $rows)];
    }

    public function create(Request $req, array $user): array
    {
        $body = $req->json();
        $name = trim((string)($body['name'] ?? ''));
        if ($name === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'name is required']];
        }

        $id   = $this->generateUuid();
        $now  = date('Y-m-d H:i:s');
        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO apps (id, name, description, icon, theme, process_management, permissions,
                               app_acl, record_acl, view_settings, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $id,
            $name,
            (string)($body['description'] ?? ''),
            (string)($body['icon'] ?? ''),
            (string)($body['theme'] ?? ''),
            json_encode($body['process_management'] ?? new \stdClass(), JSON_UNESCAPED_UNICODE),
            json_encode($body['permissions']        ?? new \stdClass(), JSON_UNESCAPED_UNICODE),
            json_encode($body['app_acl']            ?? new \stdClass(), JSON_UNESCAPED_UNICODE),
            json_encode($body['record_acl']         ?? new \stdClass(), JSON_UNESCAPED_UNICODE),
            json_encode($body['view_settings']      ?? new \stdClass(), JSON_UNESCAPED_UNICODE),
            $user['id'],
            $now,
            $now,
        ]);

        $stmt = $this->db->pdo()->prepare('SELECT ' . $this->selectColumns() . ' FROM apps WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $app = $this->formatApp($stmt->fetch(PDO::FETCH_ASSOC));

        $this->hooks->do_action('app.created', $app, $user);
        return [200, $app];
    }

    public function show(Request $req, array $user): array
    {
        $appId = (string)$req->param('app_id');
        $stmt  = $this->db->pdo()->prepare('SELECT ' . $this->selectColumns() . ' FROM apps WHERE id = ? LIMIT 1');
        $stmt->execute([$appId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'App not found']];
        }
        return [200, $this->formatApp($row)];
    }

    public function update(Request $req, array $user): array
    {
        $appId = (string)$req->param('app_id');
        $stmt  = $this->db->pdo()->prepare('SELECT id FROM apps WHERE id = ? LIMIT 1');
        $stmt->execute([$appId]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'App not found']];
        }

        $body   = $req->json();
        $fields = [];
        $values = [];
        $jsonCols = ['process_management', 'permissions', 'app_acl', 'record_acl', 'view_settings'];

        foreach (['name', 'description', 'icon', 'theme'] as $col) {
            if (array_key_exists($col, $body)) {
                $fields[] = "$col = ?";
                $values[] = (string)$body[$col];
            }
        }
        foreach ($jsonCols as $col) {
            if (array_key_exists($col, $body)) {
                $fields[] = "$col = ?";
                $values[] = json_encode($body[$col], JSON_UNESCAPED_UNICODE);
            }
        }
        if (empty($fields)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'No fields to update']];
        }

        $now      = date('Y-m-d H:i:s');
        $fields[] = 'updated_at = ?';
        $values[] = $now;
        $values[] = $appId;

        $this->db->pdo()->prepare('UPDATE apps SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

        $stmt = $this->db->pdo()->prepare('SELECT ' . $this->selectColumns() . ' FROM apps WHERE id = ? LIMIT 1');
        $stmt->execute([$appId]);
        $app = $this->formatApp($stmt->fetch(PDO::FETCH_ASSOC));

        $this->hooks->do_action('app.updated', $app, $user);
        return [200, $app];
    }

    public function updateView(Request $req, array $user): array
    {
        $appId = (string)$req->param('app_id');
        $body  = $req->json();
        $now   = date('Y-m-d H:i:s');

        $this->db->pdo()->prepare('UPDATE apps SET view_settings = ?, updated_at = ? WHERE id = ?')
            ->execute([json_encode($body['view_settings'] ?? new \stdClass(), JSON_UNESCAPED_UNICODE), $now, $appId]);

        $stmt = $this->db->pdo()->prepare('SELECT ' . $this->selectColumns() . ' FROM apps WHERE id = ? LIMIT 1');
        $stmt->execute([$appId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'App not found']];
        }
        return [200, $this->formatApp($row)];
    }

    public function destroy(Request $req, array $user): array
    {
        $appId = (string)$req->param('app_id');
        $stmt  = $this->db->pdo()->prepare('SELECT id, name FROM apps WHERE id = ? LIMIT 1');
        $stmt->execute([$appId]);
        $app = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($app === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'App not found']];
        }

        $this->db->pdo()->prepare('DELETE FROM apps WHERE id = ?')->execute([$appId]);
        $this->hooks->do_action('app.deleted', $app, $user);
        return [200, ['message' => 'deleted']];
    }
}
