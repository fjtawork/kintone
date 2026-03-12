<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * Fields API 統合テスト。
 */
class FieldsTest extends TestCase
{
    private static string $appId = '';

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        $res = self::authPost('/api/v1/apps', ['name' => 'Fields Test App ' . uniqid()]);
        if ($res->getStatusCode() === 200) {
            self::$appId = (string) (self::decode($res)['id'] ?? '');
        }
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$appId !== '') {
            self::authDelete('/api/v1/apps/' . self::$appId);
        }
        parent::tearDownAfterClass();
    }

    // ── フィールド一覧 ────────────────────────────────────────────────────────

    /** GET /api/v1/fields/app/{id} はフィールド一覧を返すこと */
    public function testListFieldsByApp(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        $res = self::authGet('/api/v1/fields/app/' . self::$appId);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertIsArray($body);
    }

    /** GET /api/v1/fields/app/{id} で存在しない id は 404 を返すこと */
    public function testListFieldsNonExistentAppReturns404(): void
    {
        $res = self::authGet('/api/v1/fields/app/non-existent-app-id');
        self::assertStatus(404, $res);
    }

    // ── bulkUpdate ────────────────────────────────────────────────────────────

    /** PUT /api/v1/fields/app/{id} でフィールドを一括登録できること */
    public function testBulkUpdateFields(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        $fields = [
            ['code' => 'title', 'type' => 'SINGLE_LINE_TEXT', 'label' => 'タイトル'],
            ['code' => 'status', 'type' => 'DROP_DOWN',        'label' => 'ステータス'],
            ['code' => 'body',   'type' => 'MULTI_LINE_TEXT',  'label' => '本文',
             'config' => ['maxLength' => 1000]],
        ];

        $res = self::authPut('/api/v1/fields/app/' . self::$appId, $fields);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertIsArray($body);
        self::assertCount(3, $body);
        self::assertEquals('title', $body[0]['code']);
    }

    /** PUT /api/v1/fields/app/{id} で既存フィールドが置換されること */
    public function testBulkUpdateReplacesExistingFields(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        // 1件だけに置換
        $res = self::authPut('/api/v1/fields/app/' . self::$appId, [
            ['code' => 'only_field', 'type' => 'SINGLE_LINE_TEXT', 'label' => 'Only'],
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertCount(1, $body);

        // 一覧も1件になっていること
        $res  = self::authGet('/api/v1/fields/app/' . self::$appId);
        $body = self::decode($res);
        self::assertCount(1, $body);
    }

    /** PUT /api/v1/fields/app/{id} で code なしは 400 を返すこと */
    public function testBulkUpdateWithoutCodeReturns400(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        $res = self::authPut('/api/v1/fields/app/' . self::$appId, [
            ['type' => 'SINGLE_LINE_TEXT', 'label' => 'No Code'],
        ]);
        self::assertStatus(400, $res);
    }

    /** PUT /api/v1/fields/app/{id} で code 重複は 400 を返すこと */
    public function testBulkUpdateWithDuplicateCodeReturns400(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        $res = self::authPut('/api/v1/fields/app/' . self::$appId, [
            ['code' => 'dup', 'type' => 'SINGLE_LINE_TEXT', 'label' => 'A'],
            ['code' => 'dup', 'type' => 'SINGLE_LINE_TEXT', 'label' => 'B'],
        ]);
        self::assertStatus(400, $res);
    }

    /** PUT /api/v1/fields/app/{id} で空配列を渡すとフィールドが全削除されること */
    public function testBulkUpdateWithEmptyArrayClearsFields(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        $res = self::authPut('/api/v1/fields/app/' . self::$appId, []);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertIsArray($body);
        self::assertCount(0, $body);
    }

    /** PUT /api/v1/fields/app/{id} で存在しない app_id は 404 を返すこと */
    public function testBulkUpdateNonExistentAppReturns404(): void
    {
        $res = self::authPut('/api/v1/fields/app/non-existent-app-id', []);
        self::assertStatus(404, $res);
    }
}
