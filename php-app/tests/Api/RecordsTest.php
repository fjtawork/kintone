<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * Records API 統合テスト。
 *
 * リグレッション:
 * - app_id をリクエスト body で渡してレコードが作成できること（POST /api/v1/records）
 * - 末尾スラッシュ付き POST /api/v1/records/ も 404 にならないこと
 */
class RecordsTest extends TestCase
{
    private static string $appId = '';
    private static string $recordId = '';

    // ── テストデータ準備 ──────────────────────────────────────────────────────

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        // テスト用アプリを作成
        $res = self::authPost('/api/v1/apps', ['name' => 'Records Test App ' . uniqid()]);
        if ($res->getStatusCode() === 200) {
            $body        = self::decode($res);
            self::$appId = (string) ($body['id'] ?? '');
        }
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$appId !== '') {
            self::authDelete('/api/v1/apps/' . self::$appId);
        }
        parent::tearDownAfterClass();
    }

    // ── 前提条件チェック ──────────────────────────────────────────────────────

    public function testAppWasCreated(): void
    {
        self::assertNotEmpty(self::$appId, 'Test app must be created before running Records tests');
    }

    // ── リグレッション: app_id を body で渡す ─────────────────────────────────

    /** POST /api/v1/records に app_id を body で渡してレコードが作成できること */
    public function testCreateRecordWithAppIdInBody(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        $res = self::authPost('/api/v1/records', [
            'app_id' => self::$appId,
            'data'   => ['title' => 'regression test'],
        ]);

        self::assertStatus(200, $res, 'Should create record when app_id is in request body');
        $body = self::decode($res);
        self::assertArrayHasKey('record', $body);
        self::assertEquals(self::$appId, $body['record']['app_id']);

        // 後続テスト用に recordId を保存
        self::$recordId = (string) ($body['record']['id'] ?? '');
    }

    /** POST /api/v1/records/ (末尾スラッシュ) も 404 にならないこと */
    public function testCreateRecordWithTrailingSlashNotFound(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        $res = self::authPost('/api/v1/records/', [
            'app_id' => self::$appId,
            'data'   => [],
        ]);

        self::assertNotEquals(404, $res->getStatusCode(), 'POST /api/v1/records/ should not be 404');
    }

    // ── バリデーション ────────────────────────────────────────────────────────

    /** app_id なしで POST するとバリデーションエラーを返すこと */
    public function testCreateRecordWithoutAppIdReturns404Or400(): void
    {
        $res = self::authPost('/api/v1/records', ['data' => []]);
        // app_id 空の場合は NOT_FOUND(404) または VALIDATION_ERROR(400) のどちらか
        self::assertContains($res->getStatusCode(), [400, 404]);
    }

    /** 存在しない app_id で POST すると 404 を返すこと */
    public function testCreateRecordWithNonExistentAppIdReturns404(): void
    {
        $res = self::authPost('/api/v1/records', [
            'app_id' => 'non-existent-app-id-00000000',
            'data'   => [],
        ]);
        self::assertStatus(404, $res);
    }

    // ── 一覧取得 ──────────────────────────────────────────────────────────────

    /** GET /api/v1/records?app_id=... はレコード一覧を返すこと */
    public function testIndexRecords(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        $res = self::authGet('/api/v1/records', ['app_id' => self::$appId]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('records', $body);
        self::assertIsArray($body['records']);
    }

    /** GET /api/v1/records without app_id returns 400 */
    public function testIndexRecordsWithoutAppIdReturns400(): void
    {
        $res = self::authGet('/api/v1/records');
        self::assertStatus(400, $res);
    }

    // ── カーソルページング ────────────────────────────────────────────────────

    /** GET /api/v1/records/paged?app_id=... はページングレスポンスを返すこと */
    public function testPagedRecords(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        $res = self::authGet('/api/v1/records/paged', ['app_id' => self::$appId]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('items', $body);
        self::assertArrayHasKey('has_next', $body);
    }

    /** GET /api/v1/records/paged limit パラメータが動作すること */
    public function testPagedRecordsWithLimit(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        $res = self::authGet('/api/v1/records/paged', [
            'app_id' => self::$appId,
            'limit'  => 1,
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('items', $body);
        self::assertLessThanOrEqual(1, count($body['items']));
    }

    // ── 詳細取得 ──────────────────────────────────────────────────────────────

    /** GET /api/v1/records/{id} は作成したレコードを返すこと */
    public function testShowRecord(): void
    {
        if (self::$recordId === '') {
            self::markTestSkipped('No record created');
        }

        $res = self::authGet('/api/v1/records/' . self::$recordId);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('record', $body);
        self::assertEquals(self::$recordId, $body['record']['id']);
    }

    /** 存在しない record_id は 404 を返すこと */
    public function testShowNonExistentRecordReturns404(): void
    {
        $res = self::authGet('/api/v1/records/non-existent-record-id');
        self::assertStatus(404, $res);
    }

    // ── 更新 ─────────────────────────────────────────────────────────────────

    /** PUT /api/v1/records/{id} でデータを更新できること */
    public function testUpdateRecord(): void
    {
        if (self::$recordId === '') {
            self::markTestSkipped('No record created');
        }

        $res = self::authPut('/api/v1/records/' . self::$recordId, [
            'data' => ['title' => 'updated'],
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertEquals(['title' => 'updated'], $body['record']['data']);
    }

    /** PUT /api/v1/records/{id} で status を更新できること */
    public function testUpdateRecordStatus(): void
    {
        if (self::$recordId === '') {
            self::markTestSkipped('No record created');
        }

        $res = self::authPut('/api/v1/records/' . self::$recordId, [
            'status' => 'in_progress',
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertEquals('in_progress', $body['record']['status']);
    }

    /** PUT /api/v1/records/{id} で更新フィールドなしは 400 を返すこと */
    public function testUpdateRecordWithNoFieldsReturns400(): void
    {
        if (self::$recordId === '') {
            self::markTestSkipped('No record created');
        }

        $res = self::authPut('/api/v1/records/' . self::$recordId, []);
        self::assertStatus(400, $res);
    }

    // ── ワークフロー ──────────────────────────────────────────────────────────

    /** POST /api/v1/records/{id}/workflow/actions/{action} で status を変更できること */
    public function testWorkflowAction(): void
    {
        if (self::$recordId === '') {
            self::markTestSkipped('No record created');
        }

        $res = self::authPost('/api/v1/records/' . self::$recordId . '/workflow/actions/closed', [
            'action' => 'closed',
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertEquals('closed', $body['record']['status']);
    }

    // ── コメント ──────────────────────────────────────────────────────────────

    /** GET /api/v1/records/{id}/comments はコメント一覧を返すこと */
    public function testGetComments(): void
    {
        if (self::$recordId === '') {
            self::markTestSkipped('No record created');
        }

        $res = self::authGet('/api/v1/records/' . self::$recordId . '/comments');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('comments', $body);
    }

    /** POST /api/v1/records/{id}/comments でコメントを作成できること */
    public function testCreateComment(): void
    {
        if (self::$recordId === '') {
            self::markTestSkipped('No record created');
        }

        $res = self::authPost('/api/v1/records/' . self::$recordId . '/comments', [
            'body' => 'Test comment from integration test',
        ]);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('comment', $body);
        self::assertEquals('Test comment from integration test', $body['comment']['body']);
    }

    /** POST /api/v1/records/{id}/comments で body なしは 400 を返すこと */
    public function testCreateCommentWithoutBodyReturns400(): void
    {
        if (self::$recordId === '') {
            self::markTestSkipped('No record created');
        }

        $res = self::authPost('/api/v1/records/' . self::$recordId . '/comments', []);
        self::assertStatus(400, $res);
    }

    // ── メンション候補 ────────────────────────────────────────────────────────

    /** GET /api/v1/records/{id}/mention-candidates はユーザー一覧を返すこと */
    public function testMentionCandidates(): void
    {
        if (self::$recordId === '') {
            self::markTestSkipped('No record created');
        }

        $res = self::authGet('/api/v1/records/' . self::$recordId . '/mention-candidates');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('users', $body);
    }

    // ── 削除 ─────────────────────────────────────────────────────────────────

    /** DELETE /api/v1/records/{id} でレコードを削除できること */
    public function testDeleteRecord(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        // 削除用レコードを別途作成
        $res = self::authPost('/api/v1/records', [
            'app_id' => self::$appId,
            'data'   => ['title' => 'to be deleted'],
        ]);
        self::assertStatus(200, $res);
        $id = (string) (self::decode($res)['record']['id'] ?? '');

        $res = self::authDelete('/api/v1/records/' . $id);
        self::assertStatus(200, $res);

        // 削除後は 404
        $res = self::authGet('/api/v1/records/' . $id);
        self::assertStatus(404, $res);
    }

    /** DELETE /api/v1/records/{id} で存在しない id は 404 を返すこと */
    public function testDeleteNonExistentRecordReturns404(): void
    {
        $res = self::authDelete('/api/v1/records/non-existent-record-id');
        self::assertStatus(404, $res);
    }

    // ── record_number 連番 ────────────────────────────────────────────────────

    /** 同一アプリ内で record_number が 1, 2, 3... と連番になること */
    public function testRecordNumberIsSequential(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        // 3件連続作成
        $ids = [];
        for ($i = 0; $i < 3; $i++) {
            $res = self::authPost('/api/v1/records', [
                'app_id' => self::$appId,
                'data'   => ['seq_test' => $i],
            ]);
            self::assertStatus(200, $res);
            $body  = self::decode($res);
            $ids[] = (string) ($body['record']['id'] ?? '');
        }

        // 一覧取得して record_number が連番か確認
        $res     = self::authGet('/api/v1/records/paged', ['app_id' => self::$appId, 'limit' => 200]);
        $items   = self::decode($res)['items'] ?? [];
        $numbers = array_column($items, 'record_number');
        sort($numbers);

        // 連番であること（重複なし、1から始まる）
        $unique = array_unique($numbers);
        self::assertEquals(count($numbers), count($unique), 'record_number must be unique');
        self::assertEquals(min($numbers), 1, 'record_number must start from 1');
        self::assertEquals(
            range(1, count($numbers)),
            $numbers,
            'record_number must be sequential integers'
        );

        // 後始末
        foreach ($ids as $id) {
            self::authDelete('/api/v1/records/' . $id);
        }
    }

    // ── ページングの境界 ──────────────────────────────────────────────────────

    /** GET /api/v1/records/paged で app_id なしは 400 を返すこと */
    public function testPagedRecordsWithoutAppIdReturns400(): void
    {
        $res = self::authGet('/api/v1/records/paged');
        self::assertStatus(400, $res);
    }

    /** カーソルページングで複数ページを通過できること */
    public function testPagedRecordsCursorPagination(): void
    {
        if (self::$appId === '') {
            self::markTestSkipped('No test app available');
        }

        // ページング用レコードを5件作成
        $createdIds = [];
        for ($i = 0; $i < 5; $i++) {
            $res = self::authPost('/api/v1/records', [
                'app_id' => self::$appId,
                'data'   => ['paging_test' => $i],
            ]);
            if ($res->getStatusCode() === 200) {
                $createdIds[] = (string) (self::decode($res)['record']['id'] ?? '');
            }
        }

        // limit=2 で1ページ目を取得
        $res1  = self::authGet('/api/v1/records/paged', ['app_id' => self::$appId, 'limit' => 2]);
        $body1 = self::decode($res1);
        self::assertStatus(200, $res1);
        self::assertCount(2, $body1['items']);
        self::assertTrue($body1['has_next']);
        self::assertNotNull($body1['next_cursor']);

        // カーソルを使って2ページ目を取得
        $res2  = self::authGet('/api/v1/records/paged', [
            'app_id' => self::$appId,
            'limit'  => 2,
            'cursor' => $body1['next_cursor'],
        ]);
        $body2 = self::decode($res2);
        self::assertStatus(200, $res2);
        self::assertNotEmpty($body2['items']);

        // 1ページ目と2ページ目の record_number が重複しないこと
        $nums1 = array_column($body1['items'], 'record_number');
        $nums2 = array_column($body2['items'], 'record_number');
        self::assertEmpty(
            array_intersect($nums1, $nums2),
            'Page 1 and page 2 must not have overlapping record_numbers'
        );

        // 後始末
        foreach ($createdIds as $id) {
            self::authDelete('/api/v1/records/' . $id);
        }
    }
}
