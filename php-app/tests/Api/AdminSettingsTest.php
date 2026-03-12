<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * Admin Settings + IP Allowlist API 統合テスト。
 *
 * 全エンドポイントは superuser 専用。
 */
class AdminSettingsTest extends TestCase
{
    private static string $normalUserEmail = '';
    private static string $normalUserToken = '';
    private static string $normalUserId    = '';
    private static string $ipEntryId       = '';

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        // 非 superuser を作成してトークンを取得
        self::$normalUserEmail = self::uniqueEmail('admin_test_normal');
        $res = self::authPost('/api/v1/users', [
            'email'    => self::$normalUserEmail,
            'password' => 'TestPass123',
        ]);
        if ($res->getStatusCode() === 200) {
            self::$normalUserId = (string) (self::decode($res)['user']['id'] ?? '');
            $loginRes = self::post('/api/v1/auth/login', [
                'email'    => self::$normalUserEmail,
                'password' => 'TestPass123',
            ]);
            if ($loginRes->getStatusCode() === 200) {
                self::$normalUserToken = (string) (self::decode($loginRes)['access_token'] ?? '');
            }
        }
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$ipEntryId !== '') {
            self::authDelete('/api/v1/admin/ip-allowlist/' . self::$ipEntryId);
        }
        if (self::$normalUserId !== '') {
            self::authDelete('/api/v1/users/' . self::$normalUserId);
        }
        parent::tearDownAfterClass();
    }

    // ── System Settings ───────────────────────────────────────────────────────

    /** GET /api/v1/admin/settings は superuser に設定を返すこと */
    public function testGetSettings(): void
    {
        $res = self::authGet('/api/v1/admin/settings');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('settings', $body);
        self::assertIsArray($body['settings']);
    }

    /** GET /api/v1/admin/settings で認証なしは 401 を返すこと */
    public function testGetSettingsWithoutAuthReturns401(): void
    {
        $res = self::get('/api/v1/admin/settings');
        self::assertStatus(401, $res);
    }

    /** GET /api/v1/admin/settings で非 superuser は 403 を返すこと */
    public function testGetSettingsByNormalUserReturns403(): void
    {
        if (self::$normalUserToken === '') {
            self::markTestSkipped('Normal user token not available');
        }

        $res = self::authGet('/api/v1/admin/settings', [], self::$normalUserToken);
        self::assertStatus(403, $res);
    }

    /** PUT /api/v1/admin/settings で設定を更新できること */
    public function testUpdateSettings(): void
    {
        $key   = 'test_setting_' . uniqid();
        $value = 'test_value_' . uniqid();

        $res = self::authPut('/api/v1/admin/settings', [
            'settings' => [$key => $value],
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('settings', $body);
        self::assertEquals($value, $body['settings'][$key] ?? null);
    }

    /** PUT /api/v1/admin/settings で空 settings は 400 を返すこと */
    public function testUpdateSettingsWithEmptyObjectReturns400(): void
    {
        $res = self::authPut('/api/v1/admin/settings', ['settings' => []]);
        self::assertStatus(400, $res);
    }

    /** PUT /api/v1/admin/settings で settings キーなしは 400 を返すこと */
    public function testUpdateSettingsWithoutSettingsKeyReturns400(): void
    {
        $res = self::authPut('/api/v1/admin/settings', []);
        self::assertStatus(400, $res);
    }

    /** PUT /api/v1/admin/settings で非 superuser は 403 を返すこと */
    public function testUpdateSettingsByNormalUserReturns403(): void
    {
        if (self::$normalUserToken === '') {
            self::markTestSkipped('Normal user token not available');
        }

        $res = self::authPut('/api/v1/admin/settings', [
            'settings' => ['key' => 'value'],
        ], self::$normalUserToken);
        self::assertStatus(403, $res);
    }

    // ── IP Allowlist ──────────────────────────────────────────────────────────

    /** GET /api/v1/admin/ip-allowlist は一覧を返すこと */
    public function testGetIpAllowlist(): void
    {
        $res = self::authGet('/api/v1/admin/ip-allowlist');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('ip_allowlist', $body);
        self::assertIsArray($body['ip_allowlist']);
    }

    /** GET /api/v1/admin/ip-allowlist で非 superuser は 403 を返すこと */
    public function testGetIpAllowlistByNormalUserReturns403(): void
    {
        if (self::$normalUserToken === '') {
            self::markTestSkipped('Normal user token not available');
        }

        $res = self::authGet('/api/v1/admin/ip-allowlist', [], self::$normalUserToken);
        self::assertStatus(403, $res);
    }

    /** POST /api/v1/admin/ip-allowlist で IPエントリを作成できること */
    public function testCreateIpEntry(): void
    {
        $res = self::authPost('/api/v1/admin/ip-allowlist', [
            'cidr'        => '192.168.1.0/24',
            'description' => 'Test IP range',
            'is_active'   => true,
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('entry', $body);
        self::assertEquals('192.168.1.0/24', $body['entry']['cidr']);
        self::assertTrue($body['entry']['is_active']);

        self::$ipEntryId = (string) ($body['entry']['id'] ?? '');
    }

    /** POST /api/v1/admin/ip-allowlist で単一 IP（プレフィックスなし）も作成できること */
    public function testCreateIpEntryWithSingleIp(): void
    {
        $res = self::authPost('/api/v1/admin/ip-allowlist', [
            'cidr' => '10.0.0.1',
        ]);
        self::assertStatus(200, $res);

        // 後始末
        $id = (string) (self::decode($res)['entry']['id'] ?? '');
        if ($id) {
            self::authDelete('/api/v1/admin/ip-allowlist/' . $id);
        }
    }

    /** POST /api/v1/admin/ip-allowlist で cidr なしは 400 を返すこと */
    public function testCreateIpEntryWithoutCidrReturns400(): void
    {
        $res = self::authPost('/api/v1/admin/ip-allowlist', ['description' => 'no cidr']);
        self::assertStatus(400, $res);
    }

    /** POST /api/v1/admin/ip-allowlist で不正な CIDR は 400 を返すこと */
    public function testCreateIpEntryWithInvalidCidrReturns400(): void
    {
        $res = self::authPost('/api/v1/admin/ip-allowlist', ['cidr' => 'not-an-ip/99']);
        self::assertStatus(400, $res);
    }

    /** POST /api/v1/admin/ip-allowlist でプレフィックス > 32 は 400 を返すこと */
    public function testCreateIpEntryWithPrefixOver32Returns400(): void
    {
        $res = self::authPost('/api/v1/admin/ip-allowlist', ['cidr' => '192.168.1.0/33']);
        self::assertStatus(400, $res);
    }

    /** POST /api/v1/admin/ip-allowlist で非 superuser は 403 を返すこと */
    public function testCreateIpEntryByNormalUserReturns403(): void
    {
        if (self::$normalUserToken === '') {
            self::markTestSkipped('Normal user token not available');
        }

        $res = self::authPost('/api/v1/admin/ip-allowlist', [
            'cidr' => '10.0.0.0/8',
        ], self::$normalUserToken);
        self::assertStatus(403, $res);
    }

    /** PATCH /api/v1/admin/ip-allowlist/{id} で IPエントリを更新できること */
    public function testUpdateIpEntry(): void
    {
        if (self::$ipEntryId === '') {
            self::markTestSkipped('No IP entry created');
        }

        $res = self::authPatch('/api/v1/admin/ip-allowlist/' . self::$ipEntryId, [
            'description' => 'Updated description',
            'is_active'   => false,
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('entry', $body);
        self::assertEquals('Updated description', $body['entry']['description']);
        self::assertFalse($body['entry']['is_active']);
    }

    /** PATCH /api/v1/admin/ip-allowlist/{id} で更新フィールドなしは 400 を返すこと */
    public function testUpdateIpEntryWithNoFieldsReturns400(): void
    {
        if (self::$ipEntryId === '') {
            self::markTestSkipped('No IP entry created');
        }

        $res = self::authPatch('/api/v1/admin/ip-allowlist/' . self::$ipEntryId, []);
        self::assertStatus(400, $res);
    }

    /** PATCH /api/v1/admin/ip-allowlist/{id} で存在しない id は 404 を返すこと */
    public function testUpdateNonExistentIpEntryReturns404(): void
    {
        $res = self::authPatch('/api/v1/admin/ip-allowlist/non-existent-id', [
            'description' => 'x',
        ]);
        self::assertStatus(404, $res);
    }

    /** DELETE /api/v1/admin/ip-allowlist/{id} で IPエントリを削除できること */
    public function testDeleteIpEntry(): void
    {
        // 削除専用エントリを作成
        $res = self::authPost('/api/v1/admin/ip-allowlist', ['cidr' => '172.16.0.0/12']);
        self::assertStatus(200, $res);
        $id = (string) (self::decode($res)['entry']['id'] ?? '');
        self::assertNotEmpty($id);

        $res = self::authDelete('/api/v1/admin/ip-allowlist/' . $id);
        self::assertStatus(200, $res);
    }

    /** DELETE /api/v1/admin/ip-allowlist/{id} で存在しない id は 404 を返すこと */
    public function testDeleteNonExistentIpEntryReturns404(): void
    {
        $res = self::authDelete('/api/v1/admin/ip-allowlist/non-existent-id');
        self::assertStatus(404, $res);
    }

    /** DELETE /api/v1/admin/ip-allowlist/{id} で非 superuser は 403 を返すこと */
    public function testDeleteIpEntryByNormalUserReturns403(): void
    {
        if (self::$normalUserToken === '' || self::$ipEntryId === '') {
            self::markTestSkipped('Normal user token or IP entry not available');
        }

        $res = self::authDelete('/api/v1/admin/ip-allowlist/' . self::$ipEntryId, self::$normalUserToken);
        self::assertStatus(403, $res);
    }
}
