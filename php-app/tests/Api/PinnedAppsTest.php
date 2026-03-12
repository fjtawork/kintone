<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * Pinned Apps API 統合テスト。
 *
 * GET /api/v1/users/me/pinned-apps
 * PUT /api/v1/users/me/pinned-apps
 */
class PinnedAppsTest extends TestCase
{
    private static string $appId1 = '';
    private static string $appId2 = '';

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        $res = self::authPost('/api/v1/apps', ['name' => 'Pinned Test App 1 ' . uniqid()]);
        if ($res->getStatusCode() === 200) {
            self::$appId1 = (string) (self::decode($res)['id'] ?? '');
        }

        $res = self::authPost('/api/v1/apps', ['name' => 'Pinned Test App 2 ' . uniqid()]);
        if ($res->getStatusCode() === 200) {
            self::$appId2 = (string) (self::decode($res)['id'] ?? '');
        }

        // テスト開始前にピン留めをクリア
        self::authPut('/api/v1/users/me/pinned-apps', ['app_ids' => []]);
    }

    public static function tearDownAfterClass(): void
    {
        // ピン留めをクリアしてからアプリ削除
        self::authPut('/api/v1/users/me/pinned-apps', ['app_ids' => []]);

        if (self::$appId1 !== '') {
            self::authDelete('/api/v1/apps/' . self::$appId1);
        }
        if (self::$appId2 !== '') {
            self::authDelete('/api/v1/apps/' . self::$appId2);
        }
        parent::tearDownAfterClass();
    }

    // ── 一覧取得 ──────────────────────────────────────────────────────────────

    /** GET /api/v1/users/me/pinned-apps はピン留め一覧を返すこと */
    public function testIndexPinnedApps(): void
    {
        $res = self::authGet('/api/v1/users/me/pinned-apps');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertIsArray($body);
    }

    /** GET /api/v1/users/me/pinned-apps で認証なしは 401 を返すこと */
    public function testIndexPinnedAppsWithoutAuthReturns401(): void
    {
        $res = self::get('/api/v1/users/me/pinned-apps');
        self::assertStatus(401, $res);
    }

    // ── 更新 ─────────────────────────────────────────────────────────────────

    /** PUT /api/v1/users/me/pinned-apps でアプリをピン留めできること */
    public function testUpdatePinnedApps(): void
    {
        if (self::$appId1 === '' || self::$appId2 === '') {
            self::markTestSkipped('Test apps not available');
        }

        $res = self::authPut('/api/v1/users/me/pinned-apps', [
            'app_ids' => [self::$appId1, self::$appId2],
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertIsArray($body);
        self::assertCount(2, $body);
    }

    /** PUT 後の GET でピン留めが反映されること */
    public function testPinnedAppsAreReturnedAfterUpdate(): void
    {
        if (self::$appId1 === '') {
            self::markTestSkipped('Test apps not available');
        }

        self::authPut('/api/v1/users/me/pinned-apps', ['app_ids' => [self::$appId1]]);

        $res  = self::authGet('/api/v1/users/me/pinned-apps');
        $body = self::decode($res);
        $ids  = array_column($body, 'id');
        self::assertContains(self::$appId1, $ids);
    }

    /** PUT でピン留めの順序が app_ids 配列順に保存されること */
    public function testPinnedAppsOrderMatchesInputOrder(): void
    {
        if (self::$appId1 === '' || self::$appId2 === '') {
            self::markTestSkipped('Test apps not available');
        }

        self::authPut('/api/v1/users/me/pinned-apps', [
            'app_ids' => [self::$appId2, self::$appId1],
        ]);

        $res  = self::authGet('/api/v1/users/me/pinned-apps');
        $body = self::decode($res);
        self::assertCount(2, $body);
        self::assertEquals(self::$appId2, $body[0]['id'], 'First pinned app should be appId2');
        self::assertEquals(self::$appId1, $body[1]['id'], 'Second pinned app should be appId1');
    }

    /** PUT で空配列を渡すとピン留めが全削除されること */
    public function testUpdatePinnedAppsWithEmptyArrayClearsPins(): void
    {
        if (self::$appId1 !== '') {
            self::authPut('/api/v1/users/me/pinned-apps', ['app_ids' => [self::$appId1]]);
        }

        $res = self::authPut('/api/v1/users/me/pinned-apps', ['app_ids' => []]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertCount(0, $body);
    }

    /** PUT で存在しない app_id は 404 を返すこと */
    public function testUpdatePinnedAppsWithNonExistentAppReturns404(): void
    {
        $res = self::authPut('/api/v1/users/me/pinned-apps', [
            'app_ids' => ['non-existent-app-id'],
        ]);
        self::assertStatus(404, $res);
    }

    /** PUT で app_ids が配列でない場合は 400 を返すこと */
    public function testUpdatePinnedAppsWithInvalidTypeReturns400(): void
    {
        $res = self::authPut('/api/v1/users/me/pinned-apps', [
            'app_ids' => 'not-an-array',
        ]);
        self::assertStatus(400, $res);
    }

    /** PUT で認証なしは 401 を返すこと */
    public function testUpdatePinnedAppsWithoutAuthReturns401(): void
    {
        $res = self::put('/api/v1/users/me/pinned-apps', ['app_ids' => []]);
        self::assertStatus(401, $res);
    }
}
