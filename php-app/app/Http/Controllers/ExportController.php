<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\Request;
use App\Infrastructure\Database;
use PDO;

/**
 * kintone互換CSV形式でレコードをエクスポートする。
 * superuserのみ実行可能。
 */
class ExportController
{
    public function __construct(
        private readonly Database $db,
    ) {}

    /**
     * アプリのレコードをkintone互換CSVとしてダウンロード。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}|void
     */
    public function exportCsv(Request $req, array $user): array
    {
        if (empty($user['is_superuser'])) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Superuser権限が必要です。']];
        }

        $appId = (string) ($req->param('app_id') ?? '');
        if ($appId === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'app_id is required.']];
        }

        // アプリ情報取得
        $stmt = $this->db->pdo()->prepare('SELECT id, name FROM apps WHERE id = ? LIMIT 1');
        $stmt->execute([$appId]);
        $app = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($app === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'App not found.']];
        }

        // フィールド一覧取得（sort_order順）
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, code, type, label, config
             FROM fields
             WHERE app_id = ?
             ORDER BY sort_order ASC'
        );
        $stmt->execute([$appId]);
        $fields = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // LABEL型はデータを持たないので除外
        $fields = array_filter($fields, fn($f) => $f['type'] !== 'LABEL');
        $fields = array_values($fields);

        // レコード全件取得（record_number順）
        $stmt = $this->db->pdo()->prepare(
            'SELECT r.id, r.record_number, r.data, r.status, r.created_by, r.created_at, r.updated_at
             FROM records r
             WHERE r.app_id = ?
             ORDER BY r.record_number ASC'
        );
        $stmt->execute([$appId]);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // ユーザーIDマップ（created_by → email）
        $userIds = array_unique(array_column($records, 'created_by'));
        $userMap = [];
        if (!empty($userIds)) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $stmt = $this->db->pdo()->prepare(
                "SELECT id, email, full_name FROM users WHERE id IN ($placeholders)"
            );
            $stmt->execute(array_values($userIds));
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
                $userMap[$u['id']] = $u;
            }
        }

        // USER_SELECTIONフィールドで使われているユーザーIDも収集
        $userSelectionFields = array_filter($fields, fn($f) => $f['type'] === 'USER_SELECTION');
        if (!empty($userSelectionFields)) {
            $additionalIds = [];
            foreach ($records as $row) {
                $data = json_decode((string) $row['data'], true) ?? [];
                foreach ($userSelectionFields as $field) {
                    $val = $data[$field['code']] ?? null;
                    if (is_array($val)) {
                        foreach ($val as $uid) {
                            if (is_string($uid) && !isset($userMap[$uid])) {
                                $additionalIds[$uid] = true;
                            }
                        }
                    } elseif (is_string($val) && $val !== '' && !isset($userMap[$val])) {
                        $additionalIds[$val] = true;
                    }
                }
            }
            if (!empty($additionalIds)) {
                $ids = array_keys($additionalIds);
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $stmt = $this->db->pdo()->prepare(
                    "SELECT id, email, full_name FROM users WHERE id IN ($placeholders)"
                );
                $stmt->execute($ids);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
                    $userMap[$u['id']] = $u;
                }
            }
        }

        // CSVヘッダー構築
        // kintone形式: レコード番号, フィールド..., ステータス, 作成者, 作成日時, 更新日時
        $headers = ['レコード番号'];
        foreach ($fields as $field) {
            $headers[] = $field['label'];
        }
        $headers[] = 'ステータス';
        $headers[] = '作成者';
        $headers[] = '作成日時';
        $headers[] = '更新日時';

        // CSV生成
        $output = fopen('php://temp', 'r+');

        // BOM付きUTF-8
        fwrite($output, "\xEF\xBB\xBF");

        // ヘッダー行
        fputcsv($output, $headers);

        // データ行
        foreach ($records as $row) {
            $data = json_decode((string) $row['data'], true) ?? [];
            $csvRow = [];

            // レコード番号
            $csvRow[] = (string) $row['record_number'];

            // 各フィールド
            foreach ($fields as $field) {
                $val = $data[$field['code']] ?? '';
                $csvRow[] = $this->formatFieldValue($val, $field['type'], $userMap);
            }

            // ステータス
            $csvRow[] = $row['status'] ?? '';

            // 作成者（email形式 — kintone互換でログイン名として使用）
            $creatorEmail = $userMap[$row['created_by']]['email'] ?? '';
            $csvRow[] = $creatorEmail;

            // 作成日時（kintone形式: YYYY-MM-DDTHH:MM:SSZ）
            $csvRow[] = $this->toKintoneDateTime($row['created_at']);

            // 更新日時
            $csvRow[] = $this->toKintoneDateTime($row['updated_at']);

            fputcsv($output, $csvRow);
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        // ファイル名: アプリ名_エクスポート日.csv
        $filename = $app['name'] . '_' . date('Ymd') . '.csv';
        // ファイル名のサニタイズ（ヘッダーインジェクション防止）
        $filename = preg_replace('/[^\p{L}\p{N}_\-\.]/u', '_', $filename);

        // CSV直接出力（JSONレスポンスではなくファイルダウンロード）
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header_remove('Content-Type'); // Application.phpで設定されるJSONヘッダーを除去
        header('Content-Type: text/csv; charset=UTF-8');

        echo $csv;
        exit;
    }

    /**
     * フィールド値をkintone互換CSV形式に変換する。
     */
    private function formatFieldValue(mixed $val, string $type, array $userMap): string
    {
        if ($val === null || $val === '') {
            return '';
        }

        switch ($type) {
            case 'CHECKBOX':
                // 配列 → セル内改行
                if (is_array($val)) {
                    return implode("\n", $val);
                }
                return (string) $val;

            case 'USER_SELECTION':
                // ユーザーID → email（ログイン名として）
                if (is_array($val)) {
                    $emails = [];
                    foreach ($val as $uid) {
                        $emails[] = $userMap[$uid]['email'] ?? (string) $uid;
                    }
                    return implode("\n", $emails);
                }
                return $userMap[$val]['email'] ?? (string) $val;

            case 'DATETIME':
                // ISO形式 → kintone形式（UTC）
                return $this->toKintoneDateTime($val);

            case 'DATE':
                // YYYY-MM-DD はそのまま
                if (is_string($val) && preg_match('/^\d{4}-\d{2}-\d{2}/', $val)) {
                    return substr($val, 0, 10);
                }
                return (string) $val;

            case 'NUMBER':
                return (string) $val;

            case 'FILE':
                // ファイルキーのみ（kintoneでもCSVインポート不可）
                return (string) $val;

            case 'REFERENCE':
                // 関連レコードID（kintoneに対応する概念がないため、IDをそのまま出力）
                return (string) $val;

            default:
                // SINGLE_LINE_TEXT, MULTI_LINE_TEXT, RADIO_BUTTON, DROP_DOWN, LINK
                return (string) $val;
        }
    }

    /**
     * 日時文字列をkintone形式（YYYY-MM-DDTHH:MM:SSZ）に変換する。
     */
    private function toKintoneDateTime(?string $datetime): string
    {
        if ($datetime === null || $datetime === '') {
            return '';
        }

        try {
            $dt = new \DateTimeImmutable($datetime);
            $utc = $dt->setTimezone(new \DateTimeZone('UTC'));
            return $utc->format('Y-m-d\TH:i:s\Z');
        } catch (\Throwable) {
            return $datetime;
        }
    }
}
