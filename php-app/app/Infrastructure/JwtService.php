<?php

declare(strict_types=1);

namespace App\Infrastructure;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Throwable;

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

        return JWT::encode($payload, $this->secret, self::ALGORITHM);
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
            $decoded = JWT::decode($token, new Key($this->secret, self::ALGORITHM));

            // stdClass → 配列へ変換
            return (array) $decoded;
        } catch (Throwable) {
            return null;
        }
    }
}
