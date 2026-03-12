<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\Request;
use App\Infrastructure\Database;
use PDO;

class AdminSettingsController
{
    public function __construct(
        private readonly Database $db,
    ) {}

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
     * superuserのみアクセス可能かチェック。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, string>}|null  エラー時はエラー配列、OKならnull
     */
    private function requireSuperuser(array $user): ?array
    {
        if (!(bool) ($user['is_superuser'] ?? false)) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Superuser privileges required.']];
        }
        return null;
    }

    /**
     * IPv4 CIDRのバリデーション（プレフィックス 0〜32）。
     */
    private function isValidCidr(string $cidr): bool
    {
        if (!str_contains($cidr, '/')) {
            // プレフィックスなしIPv4アドレスも許容
            return filter_var($cidr, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false;
        }

        [$ip, $prefix] = explode('/', $cidr, 2);

        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) === false) {
            return false;
        }

        if (!ctype_digit($prefix)) {
            return false;
        }

        $prefixInt = (int) $prefix;
        return $prefixInt >= 0 && $prefixInt <= 32;
    }

    // ── システム設定 ──────────────────────────────────────────────────────────

    /**
     * 全設定をkey=>valueのオブジェクトで返す。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function getSettings(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $stmt = $this->db->pdo()->query('SELECT `key`, value FROM system_settings');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $settings = [];
        foreach ($rows as $row) {
            // value カラムは JSON 型 — デコードして元の値を返す
            $decoded = json_decode((string) $row['value'], true);
            $settings[$row['key']] = $decoded ?? $row['value'];
        }

        return [200, ['settings' => $settings]];
    }

    /**
     * 設定をUPSERT（INSERT ON DUPLICATE KEY UPDATE）。
     * リクエストボディ: { "settings": { "key": "value", ... } }
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function updateSettings(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $body     = $req->json();
        $settings = $body['settings'] ?? [];

        if (!is_array($settings) || empty($settings)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'settings must be a non-empty object.']];
        }

        $pdo = $this->db->pdo();
        $pdo->beginTransaction();

        try {
            foreach ($settings as $key => $value) {
                $stmt = $pdo->prepare(
                    'INSERT INTO system_settings (`key`, value) VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE value = VALUES(value)'
                );
                // value カラムは JSON 型 — json_encode して保存
                $stmt->execute([(string) $key, json_encode($value, JSON_UNESCAPED_UNICODE)]);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('AdminSettingsController::updateSettings error: ' . $e->getMessage());
            return [500, ['code' => 'INTERNAL_ERROR', 'message' => 'Failed to update settings.']];
        }

        return $this->getSettings($req, $user);
    }

    // ── IPアローリスト ────────────────────────────────────────────────────────

    /**
     * IPアローリスト一覧。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function getIpAllowlist(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $stmt = $this->db->pdo()->query(
            'SELECT id, cidr, label AS description, is_active, created_at
             FROM ip_allowlist
             ORDER BY created_at DESC'
        );
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $list = array_map(function (array $row): array {
            $row['is_active'] = (bool) $row['is_active'];
            return $row;
        }, $rows);

        return [200, ['ip_allowlist' => $list]];
    }

    /**
     * IPエントリ作成。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function createIpEntry(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $body        = $req->json();
        $cidr        = trim((string) ($body['cidr'] ?? ''));
        $description = (string) ($body['description'] ?? ($body['label'] ?? ''));
        $isActive    = isset($body['is_active']) ? (bool) $body['is_active'] : true;

        if ($cidr === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'cidr is required.']];
        }

        if (!$this->isValidCidr($cidr)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'Invalid IPv4 CIDR format. Prefix must be 0-32.']];
        }

        $id  = $this->generateUuid();
        $now = date('Y-m-d H:i:s');

        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO ip_allowlist (id, cidr, label, is_active, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$id, $cidr, $description, $isActive ? 1 : 0, $user['id'], $now]);

        $entry = [
            'id'          => $id,
            'cidr'        => $cidr,
            'description' => $description,
            'is_active'   => $isActive,
            'created_at'  => $now,
        ];

        return [200, ['entry' => $entry]];
    }

    /**
     * IPエントリ更新。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function updateIpEntry(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $ipId = (string) $req->param('ip_id');

        $stmt = $this->db->pdo()->prepare('SELECT id FROM ip_allowlist WHERE id = ? LIMIT 1');
        $stmt->execute([$ipId]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'IP entry not found.']];
        }

        $body   = $req->json();
        $fields = [];
        $values = [];

        if (isset($body['cidr'])) {
            $cidr = trim((string) $body['cidr']);
            if (!$this->isValidCidr($cidr)) {
                return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'Invalid IPv4 CIDR format. Prefix must be 0-32.']];
            }
            $fields[] = 'cidr = ?';
            $values[] = $cidr;
        }
        if (array_key_exists('description', $body) || array_key_exists('label', $body)) {
            $fields[] = 'label = ?';
            $values[] = (string) ($body['description'] ?? $body['label'] ?? '');
        }
        if (array_key_exists('is_active', $body)) {
            $fields[] = 'is_active = ?';
            $values[] = $body['is_active'] ? 1 : 0;
        }

        if (empty($fields)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'No fields to update.']];
        }

        $values[] = $ipId;
        $sql      = 'UPDATE ip_allowlist SET ' . implode(', ', $fields) . ' WHERE id = ?';
        $stmt     = $this->db->pdo()->prepare($sql);
        $stmt->execute($values);

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, cidr, label AS description, is_active, created_at FROM ip_allowlist WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$ipId]);
        $entry = $stmt->fetch(PDO::FETCH_ASSOC);
        $entry['is_active'] = (bool) $entry['is_active'];

        return [200, ['entry' => $entry]];
    }

    /**
     * IPエントリ削除。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function deleteIpEntry(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $ipId = (string) $req->param('ip_id');

        $stmt = $this->db->pdo()->prepare('SELECT id FROM ip_allowlist WHERE id = ? LIMIT 1');
        $stmt->execute([$ipId]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'IP entry not found.']];
        }

        $stmt = $this->db->pdo()->prepare('DELETE FROM ip_allowlist WHERE id = ?');
        $stmt->execute([$ipId]);

        return [200, ['message' => 'IP entry deleted successfully.']];
    }
}
