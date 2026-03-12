<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * Users API 統合テスト。
 *
 * 注意: superuser 権限が必要なエンドポイントを含むため、
 * TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD は superuser であること。
 */
class UsersTest extends TestCase
{
    private static string $createdUserId    = '';
    private static string $normalUserEmail  = '';
    private static string $normalUserToken  = '';

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        self::$normalUserEmail = self::uniqueEmail('normal_user');
    }

    public static function tearDownAfterClass(): void
    {
        // 作成したテストユーザーを削除
        if (self::$createdUserId !== '') {
            self::authDelete('/api/v1/users/' . self::$createdUserId);
        }
        parent::tearDownAfterClass();
    }

    // ── 一覧取得 ──────────────────────────────────────────────────────────────

    /** GET /api/v1/users は superuser にユーザー一覧を返すこと */
    public function testIndexUsersAsSuperuser(): void
    {
        $res = self::authGet('/api/v1/users');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertIsArray($body);
        self::assertNotEmpty($body);
    }

    /** GET /api/v1/users でパスワードハッシュが含まれないこと */
    public function testIndexUsersExcludesPasswordHash(): void
    {
        $res  = self::authGet('/api/v1/users');
        $body = self::decode($res);
        if (!empty($body)) {
            self::assertArrayNotHasKey('hashed_password', $body[0]);
            self::assertArrayNotHasKey('password_hash', $body[0]);
        }
    }

    /** GET /api/v1/users で認証なしは 401 を返すこと */
    public function testIndexUsersWithoutAuthReturns401(): void
    {
        $res = self::get('/api/v1/users');
        self::assertStatus(401, $res);
    }

    // ── 作成 ─────────────────────────────────────────────────────────────────

    /** POST /api/v1/users で superuser がユーザーを作成できること */
    public function testCreateUserAsSuperuser(): void
    {
        $res = self::authPost('/api/v1/users', [
            'email'     => self::$normalUserEmail,
            'password'  => 'TestPassword123',
            'full_name' => 'Normal User',
        ]);

        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('user', $body);
        self::assertEquals(self::$normalUserEmail, $body['user']['email']);
        self::$createdUserId = (string) ($body['user']['id'] ?? '');

        // ログイン可能か確認
        $loginRes = self::post('/api/v1/auth/login', [
            'email'    => self::$normalUserEmail,
            'password' => 'TestPassword123',
        ]);
        if ($loginRes->getStatusCode() === 200) {
            self::$normalUserToken = (string) (self::decode($loginRes)['access_token'] ?? '');
        }
    }

    /** POST /api/v1/users で重複メールは 409 を返すこと */
    public function testCreateUserDuplicateEmailReturns409(): void
    {
        $email = (string) (getenv('TEST_ADMIN_EMAIL') ?: 'admin@example.com');
        $res   = self::authPost('/api/v1/users', [
            'email'    => $email,
            'password' => 'TestPassword123',
        ]);
        self::assertStatus(409, $res);
    }

    /** POST /api/v1/users で invalid email は 400 を返すこと */
    public function testCreateUserInvalidEmailReturns400(): void
    {
        $res = self::authPost('/api/v1/users', [
            'email'    => 'not-an-email',
            'password' => 'TestPassword123',
        ]);
        self::assertStatus(400, $res);
    }

    /** POST /api/v1/users で短いパスワードは 400 を返すこと */
    public function testCreateUserShortPasswordReturns400(): void
    {
        $res = self::authPost('/api/v1/users', [
            'email'    => self::uniqueEmail('short_pw'),
            'password' => 'short',
        ]);
        self::assertStatus(400, $res);
    }

    // ── superuser 制限 ────────────────────────────────────────────────────────

    /** 非 superuser が GET /api/v1/users にアクセスすると 403 を返すこと */
    public function testIndexUsersByNormalUserReturns403(): void
    {
        if (self::$normalUserToken === '') {
            self::markTestSkipped('Normal user token not available');
        }

        $res = self::authGet('/api/v1/users', [], self::$normalUserToken);
        self::assertStatus(403, $res);
    }

    /** 非 superuser が POST /api/v1/users にアクセスすると 403 を返すこと */
    public function testCreateUserByNormalUserReturns403(): void
    {
        if (self::$normalUserToken === '') {
            self::markTestSkipped('Normal user token not available');
        }

        $res = self::authPost('/api/v1/users', [
            'email'    => self::uniqueEmail('forbidden'),
            'password' => 'TestPassword123',
        ], self::$normalUserToken);
        self::assertStatus(403, $res);
    }

    // ── 更新 ─────────────────────────────────────────────────────────────────

    /** PUT /api/v1/users/{id} で superuser がユーザーを更新できること */
    public function testUpdateUser(): void
    {
        if (self::$createdUserId === '') {
            self::markTestSkipped('No test user created');
        }

        $res = self::authPut('/api/v1/users/' . self::$createdUserId, [
            'full_name' => 'Updated Name',
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertEquals('Updated Name', $body['user']['full_name']);
    }

    /** PUT /api/v1/users/{id} で自分自身の superuser 権限は変更できないこと */
    public function testUpdateOwnSuperuserStatusReturns400(): void
    {
        // adminユーザーのIDを取得
        $res    = self::authGet('/api/v1/auth/me');
        $body   = self::decode($res);
        $adminId = (string) ($body['id'] ?? '');

        if ($adminId === '') {
            self::markTestSkipped('Could not get admin user ID');
        }

        $res = self::authPut('/api/v1/users/' . $adminId, [
            'is_superuser' => false,
        ]);
        self::assertStatus(400, $res);
    }

    // ── 削除 ─────────────────────────────────────────────────────────────────

    /** DELETE /api/v1/users/{id} で superuser がユーザーを削除できること */
    public function testDeleteUser(): void
    {
        // 削除専用ユーザーを作成
        $res    = self::authPost('/api/v1/users', [
            'email'    => self::uniqueEmail('to_delete'),
            'password' => 'TestPassword123',
        ]);
        if ($res->getStatusCode() !== 200) {
            self::markTestSkipped('Could not create user for deletion test');
        }
        $userId = (string) (self::decode($res)['user']['id'] ?? '');

        $res = self::authDelete('/api/v1/users/' . $userId);
        self::assertStatus(200, $res);
    }

    /** DELETE /api/v1/users/{id} で自分自身は削除できないこと */
    public function testDeleteSelfReturns400(): void
    {
        $res    = self::authGet('/api/v1/auth/me');
        $body   = self::decode($res);
        $adminId = (string) ($body['id'] ?? '');

        if ($adminId === '') {
            self::markTestSkipped('Could not get admin user ID');
        }

        $res = self::authDelete('/api/v1/users/' . $adminId);
        self::assertStatus(400, $res);
    }

    /** DELETE /api/v1/users/{id} で存在しない id は 404 を返すこと */
    public function testDeleteNonExistentUserReturns404(): void
    {
        $res = self::authDelete('/api/v1/users/non-existent-user-id');
        self::assertStatus(404, $res);
    }
}
