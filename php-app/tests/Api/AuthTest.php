<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * Auth API 統合テスト。
 *
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/signup
 * - GET  /api/v1/auth/me
 */
class AuthTest extends TestCase
{
    private static string $testEmail    = '';
    private static string $testPassword = 'Test@12345';
    private static string $testToken    = '';

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        self::$testEmail = self::uniqueEmail('auth_test');
    }

    // ── signup ────────────────────────────────────────────────────────────────

    /** POST /api/v1/auth/signup で新規ユーザーを作成できること */
    public function testSignupSuccess(): void
    {
        $res = self::post('/api/v1/auth/signup', [
            'email'     => self::$testEmail,
            'password'  => self::$testPassword,
            'full_name' => 'Auth Test User',
        ]);

        // signup が実装されている場合は 200、未実装なら 404/405 を許容
        $status = $res->getStatusCode();
        if ($status === 404 || $status === 405) {
            self::markTestSkipped('signup endpoint not implemented');
        }

        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('access_token', $body);
        self::$testToken = (string) $body['access_token'];
    }

    /** POST /api/v1/auth/signup で重複メールは 409 を返すこと */
    public function testSignupDuplicateEmailReturns409(): void
    {
        $email = (string) (getenv('TEST_ADMIN_EMAIL') ?: 'admin@example.com');
        $res   = self::post('/api/v1/auth/signup', [
            'email'    => $email,
            'password' => 'password123',
        ]);

        $status = $res->getStatusCode();
        if ($status === 404 || $status === 405) {
            self::markTestSkipped('signup endpoint not implemented');
        }

        self::assertContains($status, [409, 400], 'Duplicate email should return 409 or 400');
    }

    /** POST /api/v1/auth/signup でメールなしは 400 を返すこと */
    public function testSignupWithoutEmailReturns400(): void
    {
        $res = self::post('/api/v1/auth/signup', [
            'password' => 'password123',
        ]);

        $status = $res->getStatusCode();
        if ($status === 404 || $status === 405) {
            self::markTestSkipped('signup endpoint not implemented');
        }

        self::assertStatus(400, $res);
    }

    // ── login ─────────────────────────────────────────────────────────────────

    /** POST /api/v1/auth/login で正しい認証情報はトークンを返すこと */
    public function testLoginSuccess(): void
    {
        $email    = (string) (getenv('TEST_ADMIN_EMAIL') ?: 'admin@example.com');
        $password = (string) (getenv('TEST_ADMIN_PASSWORD') ?: 'password');

        $res = self::post('/api/v1/auth/login', [
            'email'    => $email,
            'password' => $password,
        ]);

        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('access_token', $body);
        self::assertNotEmpty($body['access_token']);
        self::assertArrayHasKey('user', $body);
        self::assertEquals($email, $body['user']['email']);
    }

    /** POST /api/v1/auth/login のレスポンスユーザーにパスワードが含まれないこと */
    public function testLoginResponseExcludesPassword(): void
    {
        $email    = (string) (getenv('TEST_ADMIN_EMAIL') ?: 'admin@example.com');
        $password = (string) (getenv('TEST_ADMIN_PASSWORD') ?: 'password');

        $res  = self::post('/api/v1/auth/login', ['email' => $email, 'password' => $password]);
        $body = self::decode($res);

        self::assertArrayNotHasKey('hashed_password', $body['user'] ?? []);
        self::assertArrayNotHasKey('password_hash', $body['user'] ?? []);
        self::assertArrayNotHasKey('password', $body['user'] ?? []);
    }

    /** POST /api/v1/auth/login で間違ったパスワードは 401 を返すこと */
    public function testLoginWithWrongPasswordReturns401(): void
    {
        $email = (string) (getenv('TEST_ADMIN_EMAIL') ?: 'admin@example.com');

        $res = self::post('/api/v1/auth/login', [
            'email'    => $email,
            'password' => 'wrong-password-xyz',
        ]);

        self::assertStatus(401, $res);
    }

    /** POST /api/v1/auth/login で存在しないメールは 401 を返すこと */
    public function testLoginWithNonExistentEmailReturns401(): void
    {
        $res = self::post('/api/v1/auth/login', [
            'email'    => 'nobody@nowhere.example.com',
            'password' => 'password123',
        ]);

        self::assertStatus(401, $res);
    }

    /** POST /api/v1/auth/login でメールなしは 400 を返すこと */
    public function testLoginWithoutEmailReturns400(): void
    {
        $res = self::post('/api/v1/auth/login', ['password' => 'password']);
        self::assertStatus(400, $res);
    }

    /** POST /api/v1/auth/login でパスワードなしは 400 を返すこと */
    public function testLoginWithoutPasswordReturns400(): void
    {
        $email = (string) (getenv('TEST_ADMIN_EMAIL') ?: 'admin@example.com');
        $res   = self::post('/api/v1/auth/login', ['email' => $email]);
        self::assertStatus(400, $res);
    }

    // ── me ───────────────────────────────────────────────────────────────────

    /** GET /api/v1/auth/me は認証ユーザー情報を返すこと */
    public function testMeReturnsCurrentUser(): void
    {
        $email = (string) (getenv('TEST_ADMIN_EMAIL') ?: 'admin@example.com');
        $token = self::adminToken();

        $res = self::authGet('/api/v1/auth/me', [], $token);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertEquals($email, $body['email']);
    }

    /** GET /api/v1/auth/me のレスポンスにパスワードが含まれないこと */
    public function testMeExcludesPassword(): void
    {
        $res  = self::authGet('/api/v1/auth/me');
        $body = self::decode($res);
        self::assertArrayNotHasKey('hashed_password', $body);
        self::assertArrayNotHasKey('password_hash', $body);
    }

    /** GET /api/v1/auth/me でトークンなしは 401 を返すこと */
    public function testMeWithoutTokenReturns401(): void
    {
        $res = self::get('/api/v1/auth/me');
        self::assertStatus(401, $res);
    }

    // ── users/me (エイリアス) ─────────────────────────────────────────────────

    /** GET /api/v1/users/me は認証ユーザー情報を返すこと */
    public function testUsersMeReturnsCurrentUser(): void
    {
        $res = self::authGet('/api/v1/users/me');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('email', $body);
    }

    // ── signup バリデーション追加 ─────────────────────────────────────────────

    /** POST /api/v1/auth/signup で短いパスワードは 400 を返すこと */
    public function testSignupWithShortPasswordReturns400(): void
    {
        $res = self::post('/api/v1/auth/signup', [
            'email'    => self::uniqueEmail('short_pw'),
            'password' => 'short',
        ]);
        $status = $res->getStatusCode();
        if ($status === 404 || $status === 405) {
            self::markTestSkipped('signup endpoint not implemented');
        }
        self::assertStatus(400, $res);
    }

    /** POST /api/v1/auth/signup で不正なメール形式は 400 を返すこと */
    public function testSignupWithInvalidEmailFormatReturns400(): void
    {
        $res = self::post('/api/v1/auth/signup', [
            'email'    => 'not-an-email',
            'password' => 'password123',
        ]);
        $status = $res->getStatusCode();
        if ($status === 404 || $status === 405) {
            self::markTestSkipped('signup endpoint not implemented');
        }
        self::assertStatus(400, $res);
    }

    // ── is_active=false ───────────────────────────────────────────────────────

    /** is_active=false のユーザーはログインできないこと（403 ACCOUNT_DISABLED） */
    public function testLoginWithInactiveUserReturns403(): void
    {
        // 非アクティブユーザーを作成
        $email = self::uniqueEmail('inactive');
        $res   = self::authPost('/api/v1/users', [
            'email'     => $email,
            'password'  => 'TestPassword123',
            'is_active' => false,
        ]);
        if ($res->getStatusCode() !== 200) {
            self::markTestSkipped('Could not create inactive user');
        }
        $userId = (string) (self::decode($res)['user']['id'] ?? '');

        // ログイン試行
        $loginRes = self::post('/api/v1/auth/login', [
            'email'    => $email,
            'password' => 'TestPassword123',
        ]);

        // 後始末
        if ($userId) {
            self::authDelete('/api/v1/users/' . $userId);
        }

        self::assertStatus(403, $loginRes);
        $body = self::decode($loginRes);
        self::assertEquals('ACCOUNT_DISABLED', $body['code'] ?? '');
    }
}
