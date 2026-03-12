<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * ルーターのリグレッションテスト。
 *
 * - 末尾スラッシュの有無どちらでもルーティングされること
 * - 未定義パスは 404 を返すこと
 * - OPTIONS (CORS プリフライト) は 204 を返すこと
 */
class RouterTest extends TestCase
{
    // ── 末尾スラッシュ ────────────────────────────────────────────────────────

    /** POST /api/v1/records/ (末尾スラッシュあり) はルーターが処理すること（ルーター 404 にならないこと） */
    public function testPostRecordsWithTrailingSlashIsNotNotFound(): void
    {
        $res  = self::authPost('/api/v1/records/', ['app_id' => '__nonexistent__', 'data' => []]);
        $body = self::decode($res);
        // ルーター 404 の message は "Not Found"（大文字）
        // コントローラー 404 は "App not found." → ルーティング成功の証拠
        self::assertNotEquals(
            'Not Found',
            $body['message'] ?? '',
            'POST /api/v1/records/ should be routed to controller, not return router-level 404'
        );
    }

    /** POST /api/v1/apps/ (末尾スラッシュあり) は 404 以外を返すこと */
    public function testPostAppsWithTrailingSlashIsNotNotFound(): void
    {
        $res = self::authPost('/api/v1/apps/', ['name' => '__router_test__']);
        self::assertNotEquals(404, $res->getStatusCode(), 'POST /api/v1/apps/ should not return 404');

        // 作成されてしまった場合は後始末
        if ($res->getStatusCode() === 200) {
            $body = self::decode($res);
            $id   = $body['id'] ?? null;
            if ($id) {
                self::authDelete("/api/v1/apps/{$id}");
            }
        }
    }

    /** GET /api/v1/apps/ (末尾スラッシュあり) は 404 以外を返すこと */
    public function testGetAppsWithTrailingSlashIsNotNotFound(): void
    {
        $res = self::authGet('/api/v1/apps/');
        self::assertNotEquals(404, $res->getStatusCode(), 'GET /api/v1/apps/ should not return 404');
    }

    /** GET /api/v1/records/ (末尾スラッシュあり) は 404 以外を返すこと */
    public function testGetRecordsWithTrailingSlashIsNotNotFound(): void
    {
        // app_id なしなので 400 が返るはずだが 404 ではない
        $res = self::authGet('/api/v1/records/');
        self::assertNotEquals(404, $res->getStatusCode(), 'GET /api/v1/records/ should not return 404');
    }

    // ── 末尾スラッシュなし（正常系を念のため確認）──────────────────────────

    /** GET /api/v1/apps はリストを返すこと */
    public function testGetAppsWithoutTrailingSlash(): void
    {
        $res = self::authGet('/api/v1/apps');
        self::assertStatus(200, $res);
    }

    // ── 未定義パス ────────────────────────────────────────────────────────────

    /** 存在しないパスは 404 を返すこと */
    public function testUndefinedPathReturns404(): void
    {
        $res = self::authGet('/api/v1/this-path-does-not-exist');
        self::assertStatus(404, $res);
    }

    /** 存在しないパスのレスポンスは code フィールドを含むこと */
    public function testUndefinedPathResponseBody(): void
    {
        $res  = self::authGet('/api/v1/no-such-endpoint-xyz');
        $body = self::decode($res);
        self::assertArrayHasKey('code', $body);
    }

    // ── 認証なしアクセス ──────────────────────────────────────────────────────

    /** JWT なしで保護されたエンドポイントにアクセスすると 401 を返すこと */
    public function testProtectedEndpointWithoutTokenReturns401(): void
    {
        $res = self::get('/api/v1/apps');
        self::assertStatus(401, $res);
    }

    /** 不正な JWT で保護されたエンドポイントにアクセスすると 401 を返すこと */
    public function testProtectedEndpointWithInvalidTokenReturns401(): void
    {
        $res = self::get('/api/v1/apps', [], 'invalid.token.here');
        self::assertStatus(401, $res);
    }

    // ── パブリックエンドポイント ───────────────────────────────────────────────

    /** GET /api/v1/system/version はシステム情報を返すこと */
    public function testRootEndpointReturns200(): void
    {
        // GET / はドキュメントルートの index.html (Next.js) が優先されるため
        // /api/v1/system/version でシステム情報を確認する
        $res = self::get('/api/v1/system/version');
        self::assertStatus(200, $res);
    }

    /** GET /api/v1/health/live は 200 を返すこと */
    public function testHealthLiveReturns200(): void
    {
        $res = self::get('/api/v1/health/live');
        self::assertStatus(200, $res);
    }

    /** GET /api/v1/health/ready は 200 を返すこと */
    public function testHealthReadyReturns200(): void
    {
        $res = self::get('/api/v1/health/ready');
        self::assertStatus(200, $res);
    }

    // ── OPTIONS (CORS プリフライト) ───────────────────────────────────────────

    /** OPTIONS リクエストは 204 を返すこと */
    public function testOptionsRequestReturns204(): void
    {
        $res = self::$client->options('/api/v1/apps');
        // 204 または 200 を許容
        self::assertContains($res->getStatusCode(), [200, 204], 'OPTIONS should return 204 or 200');
    }

    /** OPTIONS レスポンスは CORS ヘッダーを含むこと */
    public function testOptionsResponseHasCorsHeaders(): void
    {
        $res = self::$client->options('/api/v1/apps');
        self::assertTrue(
            $res->hasHeader('Access-Control-Allow-Origin'),
            'OPTIONS response should have Access-Control-Allow-Origin header'
        );
    }

    // ── Organization スタブエンドポイント ────────────────────────────────────

    /** GET /api/v1/organization/departments は空配列を返すこと */
    public function testOrganizationDepartmentsReturnsEmptyArray(): void
    {
        $res  = self::authGet('/api/v1/organization/departments');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertIsArray($body);
        self::assertCount(0, $body, 'departments stub should return empty array');
    }

    /** GET /api/v1/organization/job_titles は空配列を返すこと */
    public function testOrganizationJobTitlesReturnsEmptyArray(): void
    {
        $res  = self::authGet('/api/v1/organization/job_titles');
        self::assertStatus(200, $res);
        $body = self::decode($res);
        self::assertIsArray($body);
        self::assertCount(0, $body, 'job_titles stub should return empty array');
    }

    /** GET /api/v1/organization/departments で認証なしは 401 を返すこと */
    public function testOrganizationDepartmentsWithoutAuthReturns401(): void
    {
        $res = self::get('/api/v1/organization/departments');
        self::assertStatus(401, $res);
    }
}
