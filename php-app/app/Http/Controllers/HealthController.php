<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\Request;
use App\Infrastructure\Database;
use PDO;

class HealthController
{
    public function __construct(
        private readonly Database $db,
    ) {}

    /**
     * Liveness probe — 常に 200 を返す。
     *
     * @return array{int, array<string, mixed>}
     */
    public function live(Request $req): array
    {
        return [200, ['status' => 'ok']];
    }

    /**
     * Readiness probe — DBへ SELECT 1 でpingする。
     *
     * @return array{int, array<string, mixed>}
     */
    public function ready(Request $req): array
    {
        try {
            $this->db->pdo()->query('SELECT 1');
            return [200, ['status' => 'ok']];
        } catch (\Throwable $e) {
            error_log('Health check failed: ' . $e->getMessage());
            return [503, ['status' => 'error', 'message' => 'Database unavailable.']];
        }
    }

    /**
     * バージョン情報を返す。
     *
     * @return array{int, array<string, mixed>}
     */
    public function version(Request $req): array
    {
        return [200, ['version' => '1.0.0', 'php' => PHP_VERSION]];
    }

    /**
     * system_settings から organization_name を取得して返す。
     *
     * @return array{int, array<string, mixed>}
     */
    public function info(Request $req): array
    {
        $organizationName = '';

        try {
            $stmt = $this->db->pdo()->prepare(
                "SELECT value FROM system_settings WHERE `key` = 'organization_name' LIMIT 1"
            );
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row !== false) {
                $val = $row['value'];
                // JSON文字列として保存されている場合はデコードする
                $decoded = json_decode((string)$val, true);
                $organizationName = is_string($decoded) ? $decoded : (string)$val;
            }
        } catch (\Throwable) {
            // テーブルが存在しない場合は空文字のまま
        }

        return [200, ['organization_name' => $organizationName]];
    }
}
