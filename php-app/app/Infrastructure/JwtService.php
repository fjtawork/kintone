<?php

declare(strict_types=1);

namespace App\Infrastructure;

use Throwable;

/**
 * 外部ライブラリ不要のJWT実装（HS256のみ）。
 * firebase/php-jwt を使わず、PHP標準関数のみで動作する。
 */
class JwtService
{
    private const ALGORITHM = 'HS256';

    public function __construct(
        private readonly string $secret,
        private readonly int $ttl,
    ) {}

    /**
     * ペイロードを受け取りJWTトークン文字列を返す。
     * iat / exp は自動付与する（呼び出し側からの指定は上書きされる）。
     *
     * @param array<string, mixed> $payload
     */
    public function create(array $payload): string
    {
        $now = time();

        $payload['iat'] = $now;
        $payload['exp'] = $now + $this->ttl;

        $header = self::base64UrlEncode(json_encode([
            'typ' => 'JWT',
            'alg' => self::ALGORITHM,
        ], JSON_THROW_ON_ERROR));

        $body = self::base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));

        $signature = self::base64UrlEncode(
            hash_hmac('sha256', "{$header}.{$body}", $this->secret, true)
        );

        return "{$header}.{$body}.{$signature}";
    }

    /**
     * トークンを検証し、デコードしたペイロードを配列で返す。
     * 署名不正・期限切れ等の場合は null を返す。
     *
     * @return array<string, mixed>|null
     */
    public function verify(string $token): ?array
    {
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                return null;
            }

            [$headerB64, $bodyB64, $signatureB64] = $parts;

            // 署名検証
            $expectedSignature = self::base64UrlEncode(
                hash_hmac('sha256', "{$headerB64}.{$bodyB64}", $this->secret, true)
            );

            if (!hash_equals($expectedSignature, $signatureB64)) {
                return null;
            }

            // ペイロードデコード
            $payload = json_decode(self::base64UrlDecode($bodyB64), true, 512, JSON_THROW_ON_ERROR);

            // 有効期限チェック
            if (isset($payload['exp']) && $payload['exp'] < time()) {
                return null;
            }

            return $payload;
        } catch (Throwable) {
            return null;
        }
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        $padded = str_pad($data, (int) (ceil(strlen($data) / 4) * 4), '=');
        return base64_decode(strtr($padded, '-_', '+/'), true) ?: '';
    }
}
