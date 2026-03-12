<?php

declare(strict_types=1);

namespace Tests;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\BadResponseException;
use PHPUnit\Framework\TestCase as BaseTestCase;
use Psr\Http\Message\ResponseInterface;

abstract class TestCase extends BaseTestCase
{
    protected static Client $client;
    protected static string $baseUrl;

    // ── セットアップ ──────────────────────────────────────────────────────────

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        self::$baseUrl = rtrim((string) (getenv('TEST_BASE_URL') ?: 'http://localhost:8081'), '/');
        self::$client  = new Client([
            'base_uri'        => self::$baseUrl,
            'http_errors'     => false,
            'timeout'         => 10,
            'connect_timeout' => 5,
        ]);
    }

    // ── JWT ヘルパー ──────────────────────────────────────────────────────────

    /**
     * 指定したメール/パスワードでログインしてアクセストークンを返す。
     */
    protected static function getToken(string $email, string $password): string
    {
        $res  = self::$client->post('/api/v1/auth/login', [
            'json' => ['email' => $email, 'password' => $password],
        ]);
        $body = self::decode($res);
        return (string) ($body['access_token'] ?? '');
    }

    /**
     * 管理者（superuser）のトークンを返す。
     */
    protected static function adminToken(): string
    {
        static $token = null;
        if ($token === null) {
            $email    = (string) (getenv('TEST_ADMIN_EMAIL') ?: 'admin@example.com');
            $password = (string) (getenv('TEST_ADMIN_PASSWORD') ?: 'password');
            $token    = self::getToken($email, $password);
        }
        return $token;
    }

    // ── HTTP ヘルパー ─────────────────────────────────────────────────────────

    protected static function get(string $path, array $query = [], ?string $token = null): ResponseInterface
    {
        $options = [];
        if (!empty($query)) {
            $options['query'] = $query;
        }
        if ($token !== null) {
            $options['headers']['Authorization'] = "Bearer {$token}";
        }
        return self::$client->get($path, $options);
    }

    protected static function post(string $path, array $body = [], ?string $token = null): ResponseInterface
    {
        $options = ['json' => $body];
        if ($token !== null) {
            $options['headers']['Authorization'] = "Bearer {$token}";
        }
        return self::$client->post($path, $options);
    }

    protected static function put(string $path, array $body = [], ?string $token = null): ResponseInterface
    {
        $options = ['json' => $body];
        if ($token !== null) {
            $options['headers']['Authorization'] = "Bearer {$token}";
        }
        return self::$client->put($path, $options);
    }

    protected static function patch(string $path, array $body = [], ?string $token = null): ResponseInterface
    {
        $options = ['json' => $body];
        if ($token !== null) {
            $options['headers']['Authorization'] = "Bearer {$token}";
        }
        return self::$client->patch($path, $options);
    }

    protected static function delete(string $path, ?string $token = null): ResponseInterface
    {
        $options = [];
        if ($token !== null) {
            $options['headers']['Authorization'] = "Bearer {$token}";
        }
        return self::$client->delete($path, $options);
    }

    // ── 認証付きショートハンド ────────────────────────────────────────────────

    protected static function authGet(string $path, array $query = [], ?string $token = null): ResponseInterface
    {
        return self::get($path, $query, $token ?? self::adminToken());
    }

    protected static function authPost(string $path, array $body = [], ?string $token = null): ResponseInterface
    {
        return self::post($path, $body, $token ?? self::adminToken());
    }

    protected static function authPut(string $path, array $body = [], ?string $token = null): ResponseInterface
    {
        return self::put($path, $body, $token ?? self::adminToken());
    }

    protected static function authPatch(string $path, array $body = [], ?string $token = null): ResponseInterface
    {
        return self::patch($path, $body, $token ?? self::adminToken());
    }

    protected static function authDelete(string $path, ?string $token = null): ResponseInterface
    {
        return self::delete($path, $token ?? self::adminToken());
    }

    // ── レスポンスヘルパー ────────────────────────────────────────────────────

    protected static function decode(ResponseInterface $res): array
    {
        return (array) json_decode((string) $res->getBody(), true);
    }

    protected static function assertStatus(int $expected, ResponseInterface $res, string $message = ''): void
    {
        $actual = $res->getStatusCode();
        $body   = (string) $res->getBody();
        static::assertEquals(
            $expected,
            $actual,
            $message !== '' ? $message : "Expected HTTP {$expected}, got {$actual}. Body: {$body}"
        );
    }

    // ── ユニークな値の生成 ────────────────────────────────────────────────────

    protected static function uniqueEmail(string $prefix = 'test'): string
    {
        return $prefix . '_' . uniqid() . '@example.com';
    }

    protected static function uniqueName(string $prefix = 'Test'): string
    {
        return $prefix . '_' . uniqid();
    }
}
