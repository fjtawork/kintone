<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * Apps API 統合テスト。
 */
class AppsTest extends TestCase
{
    private static string $appId = '';

    public static function tearDownAfterClass(): void
    {
        if (self::$appId !== '') {
            self::authDelete('/api/v1/apps/' . self::$appId);
        }
        parent::tearDownAfterClass();
    }

    // ── 作成 ─────────────────────────────────────────────────────────────────

    /** POST /api/v1/apps でアプリを作成できること */
    public function testCreateApp(): void
    {
        $name = 'Apps Test App ' . uniqid();
        $res  = self::authPost('/api/v1/apps', [
            'name'        => $name,
            'description' => 'Integration test app',
        ]);

        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('id', $body);
        self::assertEquals($name, $body['name']);

        self::$appId = (string) $body['id'];
    }

    /** POST /api/v1/apps で name なしは 400 を返すこと */
    public function testCreateAppWithoutNameReturns400(): void
    {
        $res = self::authPost('/api/v1/apps', ['description' => 'no name']);
        self::assertStatus(400, $res);
    }

    /** POST /api/v1/apps で認証なしは 401 を返すこと */
    public function testCreateAppWithoutAuthReturns401(): void
    {
        $res = self::post('/api/v1/apps', ['name' => 'No Auth App']);
        self::assertStatus(401, $res);
    }

    // ── 一覧取得 ──────────────────────────────────────────────────────────────

    /** GET /api/v1/apps はアプリ一覧を返すこと */
    public function testIndexApps(): void
    {
        $res = self::authGet('/api/v1/apps');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertIsArray($body);
    }

    /** GET /api/v1/apps のレスポンスに作成したアプリが含まれること */
    public function testIndexAppsContainsCreatedApp(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No app created');
        }

        $res  = self::authGet('/api/v1/apps');
        $body = self::decode($res);
        $ids  = array_column($body, 'id');
        self::assertContains(self::$appId, $ids);
    }

    // ── 詳細取得 ──────────────────────────────────────────────────────────────

    /** GET /api/v1/apps/{id} は作成したアプリを返すこと */
    public function testShowApp(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No app created');
        }

        $res = self::authGet('/api/v1/apps/' . self::$appId);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertEquals(self::$appId, $body['id']);
    }

    /** GET /api/v1/apps/{id} で存在しない id は 404 を返すこと */
    public function testShowNonExistentAppReturns404(): void
    {
        $res = self::authGet('/api/v1/apps/non-existent-app-id');
        self::assertStatus(404, $res);
    }

    // ── 更新 ─────────────────────────────────────────────────────────────────

    /** PUT /api/v1/apps/{id} でアプリを更新できること */
    public function testUpdateApp(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No app created');
        }

        $newName = 'Updated App ' . uniqid();
        $res     = self::authPut('/api/v1/apps/' . self::$appId, ['name' => $newName]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertEquals($newName, $body['name']);
    }

    /** PUT /api/v1/apps/{id} で更新フィールドなしは 400 を返すこと */
    public function testUpdateAppWithNoFieldsReturns400(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No app created');
        }

        $res = self::authPut('/api/v1/apps/' . self::$appId, []);
        self::assertStatus(400, $res);
    }

    /** PUT /api/v1/apps/{id} で存在しない id は 404 を返すこと */
    public function testUpdateNonExistentAppReturns404(): void
    {
        $res = self::authPut('/api/v1/apps/non-existent-app-id', ['name' => 'x']);
        self::assertStatus(404, $res);
    }

    // ── ビュー設定更新 ────────────────────────────────────────────────────────

    /** PUT /api/v1/apps/{id}/view でビュー設定を更新できること */
    public function testUpdateAppView(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No app created');
        }

        $viewSettings = ['fields' => ['title', 'status']];
        $res          = self::authPut('/api/v1/apps/' . self::$appId . '/view', [
            'view_settings' => $viewSettings,
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertEquals($viewSettings, $body['view_settings']);
    }

    // ── 削除 ─────────────────────────────────────────────────────────────────

    /** DELETE /api/v1/apps/{id} でアプリを削除できること */
    public function testDeleteApp(): void
    {
        // 削除専用アプリを作成
        $res   = self::authPost('/api/v1/apps', ['name' => 'To Delete ' . uniqid()]);
        $appId = (string) (self::decode($res)['id'] ?? '');
        self::assertNotEmpty($appId);

        $res = self::authDelete('/api/v1/apps/' . $appId);
        self::assertStatus(200, $res);

        // 削除後は 404
        $res = self::authGet('/api/v1/apps/' . $appId);
        self::assertStatus(404, $res);
    }

    /** DELETE /api/v1/apps/{id} で存在しない id は 404 を返すこと */
    public function testDeleteNonExistentAppReturns404(): void
    {
        $res = self::authDelete('/api/v1/apps/non-existent-app-id');
        self::assertStatus(404, $res);
    }

    /** DELETE /api/v1/apps/{id} で認証なしは 401 を返すこと */
    public function testDeleteAppWithoutAuthReturns401(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No app created');
        }

        $res = self::delete('/api/v1/apps/' . self::$appId);
        self::assertStatus(401, $res);
    }
}
