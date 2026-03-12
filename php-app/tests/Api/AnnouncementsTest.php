<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * Announcements API 統合テスト。
 */
class AnnouncementsTest extends TestCase
{
    private static string $announcementId = '';

    public static function tearDownAfterClass(): void
    {
        if (self::$announcementId !== '') {
            self::authDelete('/api/v1/announcements/' . self::$announcementId);
        }
        parent::tearDownAfterClass();
    }

    // ── 一覧取得 ──────────────────────────────────────────────────────────────

    /** GET /api/v1/announcements はお知らせ一覧を返すこと */
    public function testIndexAnnouncements(): void
    {
        $res = self::authGet('/api/v1/announcements');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertIsArray($body);
    }

    /** GET /api/v1/announcements で認証なしは 401 を返すこと */
    public function testIndexAnnouncementsWithoutAuthReturns401(): void
    {
        $res = self::get('/api/v1/announcements');
        self::assertStatus(401, $res);
    }

    // ── 作成 ─────────────────────────────────────────────────────────────────

    /** POST /api/v1/announcements でお知らせを作成できること */
    public function testCreateAnnouncement(): void
    {
        $title = 'Test Announcement ' . uniqid();
        $res   = self::authPost('/api/v1/announcements', [
            'title'     => $title,
            'body'      => 'Test body content',
            'is_pinned' => false,
        ]);

        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertEquals($title, $body['title']);
        self::assertFalse($body['is_pinned']);

        self::$announcementId = (string) ($body['id'] ?? '');
    }

    /** POST /api/v1/announcements でピン留めお知らせを作成できること */
    public function testCreatePinnedAnnouncement(): void
    {
        $res = self::authPost('/api/v1/announcements', [
            'title'     => 'Pinned Announcement ' . uniqid(),
            'is_pinned' => true,
        ]);

        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertTrue($body['is_pinned']);

        // 後始末
        if (!empty($body['id'])) {
            self::authDelete('/api/v1/announcements/' . $body['id']);
        }
    }

    /** POST /api/v1/announcements で title なしは 400 を返すこと */
    public function testCreateAnnouncementWithoutTitleReturns400(): void
    {
        $res = self::authPost('/api/v1/announcements', ['body' => 'no title']);
        self::assertStatus(400, $res);
    }

    /** POST /api/v1/announcements のレスポンスに author_full_name が含まれること */
    public function testCreateAnnouncementResponseContainsAuthor(): void
    {
        $res  = self::authPost('/api/v1/announcements', ['title' => 'Author Test ' . uniqid()]);
        $body = self::decode($res);

        // 後始末
        if (!empty($body['id'])) {
            self::authDelete('/api/v1/announcements/' . $body['id']);
        }

        self::assertArrayHasKey('author_full_name', $body);
    }

    // ── 更新 ─────────────────────────────────────────────────────────────────

    /** PUT /api/v1/announcements/{id} で superuser がお知らせを更新できること */
    public function testUpdateAnnouncement(): void
    {
        if (self::$announcementId === '') {
            self::markTestSkipped('No announcement created');
        }

        $newTitle = 'Updated Announcement ' . uniqid();
        $res      = self::authPut('/api/v1/announcements/' . self::$announcementId, [
            'title'     => $newTitle,
            'is_pinned' => true,
        ]);

        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertEquals($newTitle, $body['title']);
        self::assertTrue($body['is_pinned']);
    }

    /** PUT /api/v1/announcements/{id} で更新フィールドなしは 400 を返すこと */
    public function testUpdateAnnouncementWithNoFieldsReturns400(): void
    {
        if (self::$announcementId === '') {
            self::markTestSkipped('No announcement created');
        }

        $res = self::authPut('/api/v1/announcements/' . self::$announcementId, []);
        self::assertStatus(400, $res);
    }

    /** PUT /api/v1/announcements/{id} で存在しない id は 404 を返すこと */
    public function testUpdateNonExistentAnnouncementReturns404(): void
    {
        $res = self::authPut('/api/v1/announcements/non-existent-id', ['title' => 'x']);
        self::assertStatus(404, $res);
    }

    // ── 削除 ─────────────────────────────────────────────────────────────────

    /** DELETE /api/v1/announcements/{id} で superuser がお知らせを削除できること */
    public function testDeleteAnnouncement(): void
    {
        $res  = self::authPost('/api/v1/announcements', ['title' => 'To Delete ' . uniqid()]);
        $id   = (string) (self::decode($res)['id'] ?? '');
        self::assertNotEmpty($id);

        $res = self::authDelete('/api/v1/announcements/' . $id);
        self::assertStatus(200, $res);
    }

    /** DELETE /api/v1/announcements/{id} で存在しない id は 404 を返すこと */
    public function testDeleteNonExistentAnnouncementReturns404(): void
    {
        $res = self::authDelete('/api/v1/announcements/non-existent-id');
        self::assertStatus(404, $res);
    }

    // ── ピン留め優先ソート ────────────────────────────────────────────────────

    // ── 非 superuser の権限 ───────────────────────────────────────────────────

    /** 非 superuser でもお知らせを作成できること */
    public function testCreateAnnouncementByNormalUserIsAllowed(): void
    {
        // 非 superuser を作成
        $email = self::uniqueEmail('normal_anno');
        $res   = self::authPost('/api/v1/users', [
            'email'    => $email,
            'password' => 'TestPass123',
        ]);
        if ($res->getStatusCode() !== 200) {
            self::markTestSkipped('Could not create normal user');
        }
        $userId = (string) (self::decode($res)['user']['id'] ?? '');

        $loginRes = self::post('/api/v1/auth/login', ['email' => $email, 'password' => 'TestPass123']);
        $token    = (string) (self::decode($loginRes)['access_token'] ?? '');

        $createRes = self::authPost('/api/v1/announcements', [
            'title' => 'Normal User Announcement ' . uniqid(),
        ], $token);

        // 後始末
        if ($createRes->getStatusCode() === 200) {
            $annoId = (string) (self::decode($createRes)['id'] ?? '');
            if ($annoId) {
                self::authDelete('/api/v1/announcements/' . $annoId);
            }
        }
        if ($userId) {
            self::authDelete('/api/v1/users/' . $userId);
        }

        // 非 superuser でも作成可能
        self::assertStatus(200, $createRes, 'Normal user should be able to create announcements');
    }

    /** 非 superuser はお知らせを更新できないこと（403） */
    public function testUpdateAnnouncementByNormalUserReturns403(): void
    {
        if (self::$announcementId === '') {
            self::markTestSkipped('No announcement created');
        }

        // 非 superuser を作成
        $email = self::uniqueEmail('normal_anno_upd');
        $res   = self::authPost('/api/v1/users', [
            'email'    => $email,
            'password' => 'TestPass123',
        ]);
        if ($res->getStatusCode() !== 200) {
            self::markTestSkipped('Could not create normal user');
        }
        $userId = (string) (self::decode($res)['user']['id'] ?? '');

        $loginRes = self::post('/api/v1/auth/login', ['email' => $email, 'password' => 'TestPass123']);
        $token    = (string) (self::decode($loginRes)['access_token'] ?? '');

        $updateRes = self::authPut('/api/v1/announcements/' . self::$announcementId, [
            'title' => 'Hacked Title',
        ], $token);

        if ($userId) {
            self::authDelete('/api/v1/users/' . $userId);
        }

        self::assertStatus(403, $updateRes);
    }

    /** 非 superuser はお知らせを削除できないこと（403） */
    public function testDeleteAnnouncementByNormalUserReturns403(): void
    {
        if (self::$announcementId === '') {
            self::markTestSkipped('No announcement created');
        }

        // 非 superuser を作成
        $email = self::uniqueEmail('normal_anno_del');
        $res   = self::authPost('/api/v1/users', [
            'email'    => $email,
            'password' => 'TestPass123',
        ]);
        if ($res->getStatusCode() !== 200) {
            self::markTestSkipped('Could not create normal user');
        }
        $userId = (string) (self::decode($res)['user']['id'] ?? '');

        $loginRes = self::post('/api/v1/auth/login', ['email' => $email, 'password' => 'TestPass123']);
        $token    = (string) (self::decode($loginRes)['access_token'] ?? '');

        $deleteRes = self::authDelete('/api/v1/announcements/' . self::$announcementId, $token);

        if ($userId) {
            self::authDelete('/api/v1/users/' . $userId);
        }

        self::assertStatus(403, $deleteRes);
    }

    /** GET /api/v1/announcements のレスポンスはピン留めが先頭に来ること */
    public function testIndexAnnouncementsOrderByPinned(): void
    {
        // ピン留めなしを先に作成
        $unpinned = self::authPost('/api/v1/announcements', [
            'title' => 'Unpinned ' . uniqid(), 'is_pinned' => false,
        ]);
        $unpinnedId = (string) (self::decode($unpinned)['id'] ?? '');

        // ピン留めを後から作成
        $pinned = self::authPost('/api/v1/announcements', [
            'title' => 'Pinned ' . uniqid(), 'is_pinned' => true,
        ]);
        $pinnedId = (string) (self::decode($pinned)['id'] ?? '');

        $res  = self::authGet('/api/v1/announcements');
        $list = self::decode($res);

        // 後始末
        if ($unpinnedId) {
            self::authDelete('/api/v1/announcements/' . $unpinnedId);
        }
        if ($pinnedId) {
            self::authDelete('/api/v1/announcements/' . $pinnedId);
        }

        // ピン留めが先頭付近に来ていること（全一覧の先頭がピン留めか確認）
        if (!empty($list)) {
            self::assertTrue($list[0]['is_pinned'], 'First announcement should be pinned');
        }
    }
}
