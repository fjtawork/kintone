<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Core\Request;
use App\Infrastructure\Database;
use App\Infrastructure\JwtService;
use PDO;

class AuthMiddleware
{
    public function __construct(
        private readonly Database   $db,
        private readonly JwtService $jwt,
    ) {}

    /**
     * JWTを検証してhandlerをラップするclosureを返す。
     *
     * @param callable $handler function(Request $request, array $user): array
     * @return callable function(Request $request, array $params): array
     */
    public function protect(callable $handler): callable
    {
        return function (Request $request, array $params) use ($handler): array {
            $request->setParams($params);

            // ── JWT 検証 ─────────────────────────────────────────────────────
            $authHeader = $request->header('Authorization') ?? '';
            if (!str_starts_with($authHeader, 'Bearer ')) {
                return [401, ['code' => 'UNAUTHORIZED', 'message' => 'Authorization header missing or invalid.']];
            }

            $token   = substr($authHeader, 7);
            $payload = $this->jwt->verify($token);

            if ($payload === null) {
                return [401, ['code' => 'INVALID_TOKEN', 'message' => 'Token is invalid or expired.']];
            }

            $userId = $payload['sub'] ?? $payload['user_id'] ?? null;
            if ($userId === null) {
                return [401, ['code' => 'INVALID_TOKEN', 'message' => 'Token payload is missing user identifier.']];
            }

            // ── DBからユーザー取得 ────────────────────────────────────────────
            $stmt = $this->db->pdo()->prepare(
                'SELECT id, email, full_name, is_active, is_superuser FROM users WHERE id = ? LIMIT 1'
            );
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user === false) {
                return [401, ['code' => 'USER_NOT_FOUND', 'message' => 'User not found.']];
            }

            if (!(bool) $user['is_active']) {
                return [403, ['code' => 'ACCOUNT_DISABLED', 'message' => 'Account is disabled.']];
            }

            // ── IP制限チェック ────────────────────────────────────────────────
            $clientIp    = $this->getClientIp();
            $ipCheckResult = $this->checkIpRestriction($user, $clientIp);
            if ($ipCheckResult !== null) {
                return $ipCheckResult;
            }

            return $handler($request, $user);
        };
    }

    /**
     * IP制限を確認する。制限違反の場合は [403, エラー配列] を返す。問題なければ null。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, string>}|null
     */
    public function checkIpRestriction(array $user, string $ip): ?array
    {
        // superuserはIP制限をスキップ
        if ((bool) ($user['is_superuser'] ?? false)) {
            return null;
        }

        // system_settingsからip_restriction_enabledを確認
        try {
            $stmt = $this->db->pdo()->prepare(
                "SELECT value FROM system_settings WHERE `key` = 'ip_restriction_enabled' LIMIT 1"
            );
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (\Throwable) {
            // テーブルが存在しない場合はIP制限なし
            return null;
        }

        if ($row === false || $row['value'] !== '1') {
            return null;
        }

        // allowlistに1件もなければアクセス拒否しない（設定ミス防止）
        try {
            $stmt = $this->db->pdo()->prepare(
                "SELECT cidr FROM ip_allowlist WHERE is_active = 1"
            );
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Throwable) {
            return null;
        }

        if (empty($rows)) {
            return null;
        }

        foreach ($rows as $row) {
            if ($this->ipMatchesCidr($ip, (string) $row['cidr'])) {
                return null;
            }
        }

        return [403, ['code' => 'IP_RESTRICTED', 'message' => 'Access denied: your IP address is not allowed.']];
    }

    /**
     * クライアントIPアドレスを取得する。
     * X-Forwarded-For → X-Real-IP → REMOTE_ADDR の優先順位。
     */
    public function getClientIp(): string
    {
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            return trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        }
        if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            return trim($_SERVER['HTTP_X_REAL_IP']);
        }
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    /**
     * IPv4アドレスがCIDR範囲に含まれるかビット演算で判定する。
     */
    public function ipMatchesCidr(string $ip, string $cidr): bool
    {
        if (!str_contains($cidr, '/')) {
            return $ip === $cidr;
        }

        [$network, $prefixStr] = explode('/', $cidr, 2);
        $prefix = (int) $prefixStr;

        if ($prefix < 0 || $prefix > 32) {
            return false;
        }

        $ipLong      = ip2long($ip);
        $networkLong = ip2long($network);

        if ($ipLong === false || $networkLong === false) {
            return false;
        }

        if ($prefix === 0) {
            return true;
        }

        $mask = ~((1 << (32 - $prefix)) - 1);

        return ($ipLong & $mask) === ($networkLong & $mask);
    }
}
