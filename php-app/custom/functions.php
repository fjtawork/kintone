<?php

declare(strict_types=1);

/**
 * custom/functions.php
 *
 * ここに書いたコードはコアのアップデートで上書きされません。
 * WordPress の functions.php と同じ感覚で使えます。
 *
 * 利用可能な関数:
 *   add_action(string $hook, callable $callback, int $priority = 10)
 *   add_filter(string $hook, callable $callback, int $priority = 10)
 *
 * 利用可能なフック一覧は plugins/README.md を参照してください。
 */

// ─── サンプル: ログイン監査ログ ───────────────────────────────────────────
// ログイン成功時にストレージへ記録します。
// 不要な場合はこのブロックごと削除してください。
add_action('auth.login.success', static function (array $user): void {
    $logDir = dirname(__DIR__) . '/storage/logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0775, true);
    }

    $line = sprintf("[%s] login: %s\n", date('c'), $user['email'] ?? 'unknown');
    file_put_contents($logDir . '/audit.log', $line, FILE_APPEND);
});
