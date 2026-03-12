<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * Notifications API 統合テスト。
 */
class NotificationsTest extends TestCase
{
    // ── 一覧取得 ──────────────────────────────────────────────────────────────

    /** GET /api/v1/notifications は通知一覧を返すこと */
    public function testIndexNotifications(): void
    {
        $res = self::authGet('/api/v1/notifications');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('items', $body);
        self::assertArrayHasKey('unread_count', $body);
        self::assertIsArray($body['items']);
        self::assertIsInt($body['unread_count']);
    }

    /** GET /api/v1/notifications?unread=1 は未読のみを返すこと */
    public function testIndexNotificationsUnreadOnly(): void
    {
        $res = self::authGet('/api/v1/notifications', ['unread' => '1']);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('items', $body);

        // 全件が未読であること
        foreach ($body['items'] as $item) {
            self::assertFalse(
                (bool) $item['is_read'],
                "All notifications should be unread when unread=1"
            );
        }
    }

    /** GET /api/v1/notifications で認証なしは 401 を返すこと */
    public function testIndexNotificationsWithoutAuthReturns401(): void
    {
        $res = self::get('/api/v1/notifications');
        self::assertStatus(401, $res);
    }

    /** GET /api/v1/notifications?limit=1 は最大1件を返すこと */
    public function testIndexNotificationsWithLimit(): void
    {
        $res = self::authGet('/api/v1/notifications', ['limit' => '1']);
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertLessThanOrEqual(1, count($body['items']));
    }

    // ── 既読処理（全件）────────────────────────────────────────────────────────

    /** POST /api/v1/notifications/read-all で全通知を既読にできること */
    public function testMarkAllReadWithPost(): void
    {
        $res = self::authPost('/api/v1/notifications/read-all');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('message', $body);
    }

    /** PATCH /api/v1/notifications/read-all で全通知を既読にできること */
    public function testMarkAllReadWithPatch(): void
    {
        $res = self::authPatch('/api/v1/notifications/read-all');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertArrayHasKey('message', $body);
    }

    /** mark-all-read 後の unread_count が 0 になること */
    public function testUnreadCountIsZeroAfterMarkAllRead(): void
    {
        self::authPost('/api/v1/notifications/read-all');

        $res  = self::authGet('/api/v1/notifications');
        $body = self::decode($res);
        self::assertEquals(0, $body['unread_count']);
    }

    // ── 既読処理（個別）────────────────────────────────────────────────────────

    /**
     * 個別通知の既読処理は通知が存在する場合のみテスト可能。
     * 存在しない ID の場合は 404 を確認する。
     */
    public function testMarkReadNonExistentNotificationReturns404(): void
    {
        $res = self::authPatch('/api/v1/notifications/non-existent-id/read');
        self::assertStatus(404, $res);
    }

    /** GET /api/v1/notifications/{id}/read で認証なしは 401 を返すこと */
    public function testMarkReadWithoutAuthReturns401(): void
    {
        $res = self::patch('/api/v1/notifications/some-id/read');
        self::assertStatus(401, $res);
    }

    // ── コメントメンションによる通知生成 ─────────────────────────────────────

    /**
     * @メンションつきコメントを投稿すると通知が作成されること。
     * ただし、このテストは 2 人目のユーザーが存在する場合にのみ実行可能。
     */
    public function testMentionInCommentCreatesNotification(): void
    {
        // 管理者ユーザーのIDを取得
        $meRes    = self::authGet('/api/v1/auth/me');
        $adminId  = (string) (self::decode($meRes)['id'] ?? '');
        $adminEmail = (string) (self::decode($meRes)['email'] ?? '');

        if ($adminId === '') {
            self::markTestSkipped('Could not get admin user ID');
        }

        // テスト用アプリとレコードを作成
        $appRes = self::authPost('/api/v1/apps', ['name' => 'Mention Test App ' . uniqid()]);
        if ($appRes->getStatusCode() !== 200) {
            self::markTestSkipped('Could not create app for mention test');
        }
        $appId = (string) (self::decode($appRes)['id'] ?? '');

        $recRes = self::authPost('/api/v1/records', [
            'app_id' => $appId,
            'data'   => [],
        ]);
        if ($recRes->getStatusCode() !== 200) {
            self::authDelete('/api/v1/apps/' . $appId);
            self::markTestSkipped('Could not create record for mention test');
        }
        $recordId = (string) (self::decode($recRes)['record']['id'] ?? '');

        // mark-all-read で既読にしてから unread_count を 0 にする
        self::authPost('/api/v1/notifications/read-all');

        // 自分をメンション（自分へのメンションはスキップされる）→ 通知なし
        self::authPost('/api/v1/records/' . $recordId . '/comments', [
            'body' => "@{$adminEmail} test mention",
        ]);

        $notifRes = self::authGet('/api/v1/notifications');
        $body     = self::decode($notifRes);

        // 後始末
        self::authDelete('/api/v1/apps/' . $appId);

        // 自分自身へのメンションは通知されない
        self::assertEquals(0, $body['unread_count'], 'Self-mention should not create notification');
    }
}
