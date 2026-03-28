<?php

declare(strict_types=1);

namespace Tests\Api;

use Tests\TestCase;

/**
 * CSV Export API 統合テスト。
 *
 * kintone互換CSVエクスポート機能のテスト:
 * - superuser のみ実行可能
 * - BOM付きUTF-8
 * - ヘッダー行にフィールドラベル + 組み込みフィールド
 * - チェックボックスはセル内改行
 * - 日付・日時フォーマット
 * - USER_SELECTION はメールアドレスに変換
 */
class ExportTest extends TestCase
{
    private static string $appId = '';
    private static array  $fieldCodes = [];
    private static array  $recordIds = [];
    private static string $normalUserToken = '';
    private static string $normalUserEmail = '';

    // ── テストデータ準備 ──────────────────────────────────────────────────────

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        // テスト用アプリを作成
        $res = self::authPost('/api/v1/apps', ['name' => 'CSV Export Test ' . uniqid()]);
        self::assertEquals(200, $res->getStatusCode(), 'Failed to create test app');
        $body        = self::decode($res);
        self::$appId = (string) ($body['id'] ?? '');

        // フィールドを定義（複数タイプ）
        $fields = [
            [
                'code'       => 'title',
                'type'       => 'SINGLE_LINE_TEXT',
                'label'      => 'タイトル',
                'config'     => ['required' => true],
                'sort_order' => 1,
            ],
            [
                'code'       => 'description',
                'type'       => 'MULTI_LINE_TEXT',
                'label'      => '説明',
                'config'     => [],
                'sort_order' => 2,
            ],
            [
                'code'       => 'amount',
                'type'       => 'NUMBER',
                'label'      => '金額',
                'config'     => [],
                'sort_order' => 3,
            ],
            [
                'code'       => 'due_date',
                'type'       => 'DATE',
                'label'      => '期限日',
                'config'     => [],
                'sort_order' => 4,
            ],
            [
                'code'       => 'category',
                'type'       => 'DROP_DOWN',
                'label'      => 'カテゴリ',
                'config'     => ['options' => ['営業', '開発', '管理']],
                'sort_order' => 5,
            ],
            [
                'code'       => 'tags',
                'type'       => 'CHECKBOX',
                'label'      => 'タグ',
                'config'     => ['options' => ['重要', '緊急', '対応中']],
                'sort_order' => 6,
            ],
            [
                'code'       => 'priority',
                'type'       => 'RADIO_BUTTON',
                'label'      => '優先度',
                'config'     => ['options' => ['高', '中', '低']],
                'sort_order' => 7,
            ],
            [
                'code'       => 'site_url',
                'type'       => 'LINK',
                'label'      => 'URL',
                'config'     => [],
                'sort_order' => 8,
            ],
            [
                'code'       => 'note_label',
                'type'       => 'LABEL',
                'label'      => '備考ラベル',
                'config'     => [],
                'sort_order' => 9,
            ],
        ];

        $res = self::authPut('/api/v1/apps/' . self::$appId . '/fields', ['fields' => $fields]);
        self::assertEquals(200, $res->getStatusCode(), 'Failed to create fields');

        self::$fieldCodes = array_column($fields, 'code');

        // レコードを作成（複数件）
        $records = [
            [
                'title'       => 'レコードA',
                'description' => "1行目\n2行目\n3行目",
                'amount'      => 12500,
                'due_date'    => '2026-04-15',
                'category'    => '営業',
                'tags'        => ['重要', '緊急'],
                'priority'    => '高',
                'site_url'    => 'https://example.com',
            ],
            [
                'title'       => 'レコードB',
                'description' => 'シンプルな説明',
                'amount'      => 8200,
                'due_date'    => '2026-05-01',
                'category'    => '開発',
                'tags'        => ['対応中'],
                'priority'    => '中',
                'site_url'    => '',
            ],
            [
                'title'       => 'カンマ,を含む"タイトル"',
                'description' => '',
                'amount'      => 0,
                'due_date'    => '',
                'category'    => '',
                'tags'        => [],
                'priority'    => '',
                'site_url'    => '',
            ],
        ];

        foreach ($records as $data) {
            $res = self::authPost('/api/v1/records', [
                'app_id' => self::$appId,
                'data'   => $data,
            ]);
            if ($res->getStatusCode() === 200) {
                self::$recordIds[] = (string) (self::decode($res)['record']['id'] ?? '');
            }
        }

        // 一般ユーザーを作成（権限テスト用）
        self::$normalUserEmail = self::uniqueEmail('csvtest');
        $res = self::authPost('/api/v1/users', [
            'email'        => self::$normalUserEmail,
            'password'     => 'testpass123',
            'full_name'    => 'CSV Test User',
            'is_superuser' => false,
        ]);
        if ($res->getStatusCode() === 200) {
            self::$normalUserToken = self::getToken(self::$normalUserEmail, 'testpass123');
        }
    }

    public static function tearDownAfterClass(): void
    {
        // レコード削除
        foreach (self::$recordIds as $id) {
            self::authDelete('/api/v1/records/' . $id);
        }
        // アプリ削除
        if (self::$appId !== '') {
            self::authDelete('/api/v1/apps/' . self::$appId);
        }
        // 一般ユーザー削除
        if (self::$normalUserEmail !== '') {
            $res = self::authGet('/api/v1/users');
            if ($res->getStatusCode() === 200) {
                $users = self::decode($res)['users'] ?? [];
                foreach ($users as $u) {
                    if (($u['email'] ?? '') === self::$normalUserEmail) {
                        self::authDelete('/api/v1/users/' . $u['id']);
                        break;
                    }
                }
            }
        }
        parent::tearDownAfterClass();
    }

    // ── ヘルパー ──────────────────────────────────────────────────────────────

    /**
     * CSVレスポンスをパースして行配列を返す。BOMを除去する。
     * @return array<int, array<int, string>>
     */
    private static function parseCsv(string $body): array
    {
        // BOM除去
        if (str_starts_with($body, "\xEF\xBB\xBF")) {
            $body = substr($body, 3);
        }

        $rows = [];
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $body);
        rewind($stream);
        while (($row = fgetcsv($stream)) !== false) {
            $rows[] = $row;
        }
        fclose($stream);

        return $rows;
    }

    /**
     * CSVヘッダーから指定ラベルの列インデックスを返す。
     */
    private static function columnIndex(array $header, string $label): int
    {
        $idx = array_search($label, $header, true);
        self::assertNotFalse($idx, "Column '{$label}' not found in header: " . implode(', ', $header));
        return (int) $idx;
    }

    // ── 前提条件チェック ──────────────────────────────────────────────────────

    public function testSetupCompleted(): void
    {
        self::assertNotEmpty(self::$appId, 'Test app must be created');
        self::assertCount(3, self::$recordIds, 'Three test records must be created');
    }

    // ── 認証・権限テスト ──────────────────────────────────────────────────────

    /** 未認証でアクセスすると 401 を返すこと */
    public function testExportWithoutAuthReturns401(): void
    {
        $res = self::get('/api/v1/apps/' . self::$appId . '/export/csv');
        self::assertStatus(401, $res);
    }

    /** 一般ユーザーでアクセスすると 403 を返すこと */
    public function testExportAsNormalUserReturns403(): void
    {
        if (self::$normalUserToken === '') {
            self::markTestSkipped('Normal user not available');
        }

        $res = self::get('/api/v1/apps/' . self::$appId . '/export/csv', [], self::$normalUserToken);
        self::assertStatus(403, $res);
    }

    // ── 基本動作テスト ────────────────────────────────────────────────────────

    /** superuserでCSVエクスポートが成功すること */
    public function testExportCsvSuccess(): void
    {
        $res = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');

        // ステータス200
        self::assertEquals(200, $res->getStatusCode());

        // Content-Type が text/csv
        $contentType = $res->getHeaderLine('Content-Type');
        self::assertStringContainsString('text/csv', $contentType);

        // Content-Disposition にファイル名が含まれる
        $disposition = $res->getHeaderLine('Content-Disposition');
        self::assertStringContainsString('attachment', $disposition);
        self::assertStringContainsString('.csv', $disposition);
    }

    /** CSVがBOM付きUTF-8であること */
    public function testCsvHasBom(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $body = (string) $res->getBody();

        // BOM (\xEF\xBB\xBF) で始まること
        self::assertTrue(
            str_starts_with($body, "\xEF\xBB\xBF"),
            'CSV must start with UTF-8 BOM'
        );
    }

    // ── ヘッダー行テスト ──────────────────────────────────────────────────────

    /** ヘッダー行にフィールドラベルと組み込みフィールドが含まれること */
    public function testCsvHeaderRow(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());

        self::assertNotEmpty($rows, 'CSV must have at least one row');
        $header = $rows[0];

        // 組み込みフィールド
        self::assertContains('レコード番号', $header);
        self::assertContains('ステータス', $header);
        self::assertContains('作成者', $header);
        self::assertContains('作成日時', $header);
        self::assertContains('更新日時', $header);

        // フィールドラベル
        self::assertContains('タイトル', $header);
        self::assertContains('説明', $header);
        self::assertContains('金額', $header);
        self::assertContains('期限日', $header);
        self::assertContains('カテゴリ', $header);
        self::assertContains('タグ', $header);
        self::assertContains('優先度', $header);
        self::assertContains('URL', $header);

        // LABELフィールドは含まれないこと
        self::assertNotContains('備考ラベル', $header);
    }

    // ── データ行テスト ────────────────────────────────────────────────────────

    /** レコード件数がヘッダー+3行であること */
    public function testCsvRowCount(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());

        // ヘッダー1行 + データ3行 = 4行
        self::assertCount(4, $rows, 'CSV must have header + 3 data rows');
    }

    /** レコード番号が連番で出力されること */
    public function testCsvRecordNumbers(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $header = $rows[0];
        $col    = self::columnIndex($header, 'レコード番号');

        $numbers = [];
        for ($i = 1; $i < count($rows); $i++) {
            $numbers[] = (int) $rows[$i][$col];
        }

        // 昇順であること（record_number ASC でソート）
        $sorted = $numbers;
        sort($sorted);
        self::assertEquals($sorted, $numbers, 'Record numbers must be in ascending order');
    }

    // ── フィールドタイプ別テスト ──────────────────────────────────────────────

    /** SINGLE_LINE_TEXT がそのまま出力されること */
    public function testCsvSingleLineText(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], 'タイトル');

        self::assertEquals('レコードA', $rows[1][$col]);
        self::assertEquals('レコードB', $rows[2][$col]);
    }

    /** カンマやダブルクォートを含むテキストが正しくエスケープされること */
    public function testCsvSpecialCharacters(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], 'タイトル');

        // fgetcsv が自動的にエスケープ解除するので、元の値が復元されること
        self::assertEquals('カンマ,を含む"タイトル"', $rows[3][$col]);
    }

    /** MULTI_LINE_TEXT（改行含む）が正しく出力されること */
    public function testCsvMultiLineText(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], '説明');

        // fgetcsv がセル内改行を正しく解析できること
        self::assertStringContainsString("1行目", $rows[1][$col]);
        self::assertStringContainsString("2行目", $rows[1][$col]);
        self::assertStringContainsString("3行目", $rows[1][$col]);
    }

    /** NUMBER がそのまま出力されること */
    public function testCsvNumber(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], '金額');

        self::assertEquals('12500', $rows[1][$col]);
        self::assertEquals('8200', $rows[2][$col]);
    }

    /** DATE が YYYY-MM-DD 形式で出力されること */
    public function testCsvDate(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], '期限日');

        self::assertEquals('2026-04-15', $rows[1][$col]);
        self::assertEquals('2026-05-01', $rows[2][$col]);
    }

    /** DROP_DOWN の選択値がそのまま出力されること */
    public function testCsvDropDown(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], 'カテゴリ');

        self::assertEquals('営業', $rows[1][$col]);
        self::assertEquals('開発', $rows[2][$col]);
    }

    /** CHECKBOX（複数選択）がセル内改行で出力されること（kintone互換） */
    public function testCsvCheckboxCellNewline(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], 'タグ');

        // レコードA: ['重要', '緊急'] → セル内改行
        $val = $rows[1][$col];
        self::assertStringContainsString('重要', $val);
        self::assertStringContainsString('緊急', $val);
        self::assertStringContainsString("\n", $val, 'Multiple checkbox values must be separated by newline');

        // レコードB: ['対応中'] → 改行なし
        self::assertEquals('対応中', $rows[2][$col]);

        // レコードC: [] → 空
        self::assertEquals('', $rows[3][$col]);
    }

    /** RADIO_BUTTON がそのまま出力されること */
    public function testCsvRadioButton(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], '優先度');

        self::assertEquals('高', $rows[1][$col]);
        self::assertEquals('中', $rows[2][$col]);
    }

    /** LINK がURL文字列として出力されること */
    public function testCsvLink(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], 'URL');

        self::assertEquals('https://example.com', $rows[1][$col]);
    }

    // ── 組み込みフィールドテスト ──────────────────────────────────────────────

    /** 作成者がメールアドレスで出力されること */
    public function testCsvCreatorEmail(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], '作成者');

        // adminユーザーが作成したので admin のメールアドレス
        $adminEmail = (string) (getenv('TEST_ADMIN_EMAIL') ?: 'admin@example.com');
        self::assertEquals($adminEmail, $rows[1][$col]);
    }

    /** 作成日時が kintone形式（YYYY-MM-DDTHH:MM:SSZ）で出力されること */
    public function testCsvCreatedAtFormat(): void
    {
        $res  = self::authGet('/api/v1/apps/' . self::$appId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());
        $col  = self::columnIndex($rows[0], '作成日時');

        // ISO 8601 UTC形式であること
        $value = $rows[1][$col];
        self::assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/',
            $value,
            "Created at must be in kintone datetime format: got '{$value}'"
        );
    }

    // ── エラーケース ──────────────────────────────────────────────────────────

    /** 存在しないアプリIDで 404 を返すこと */
    public function testExportNonExistentAppReturns404(): void
    {
        $res = self::authGet('/api/v1/apps/non-existent-app-id/export/csv');
        self::assertStatus(404, $res);
    }

    // ── 空アプリのテスト ──────────────────────────────────────────────────────

    /** レコードが0件のアプリでもヘッダー行だけのCSVが返ること */
    public function testExportEmptyAppReturnsHeaderOnly(): void
    {
        // 空のアプリを作成
        $res = self::authPost('/api/v1/apps', ['name' => 'Empty App ' . uniqid()]);
        self::assertStatus(200, $res);
        $emptyAppId = (string) (self::decode($res)['id'] ?? '');

        $res  = self::authGet('/api/v1/apps/' . $emptyAppId . '/export/csv');
        $rows = self::parseCsv((string) $res->getBody());

        // ヘッダー行のみ（組み込みフィールドは常に含まれる）
        self::assertCount(1, $rows, 'Empty app CSV should have header row only');
        self::assertContains('レコード番号', $rows[0]);

        // 後始末
        self::authDelete('/api/v1/apps/' . $emptyAppId);
    }
}
