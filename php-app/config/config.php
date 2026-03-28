<?php

declare(strict_types=1);

/**
 * .env ファイルを読み込んで $_ENV にセットする。
 * vlucas/phpdotenv を使わず、PHP標準関数のみで動作する。
 */
$dotenvPath = dirname(__DIR__) . '/.env';
if (file_exists($dotenvPath)) {
    $lines = file($dotenvPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        // コメント行をスキップ
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        // KEY=VALUE の形式を解析
        if (str_contains($line, '=')) {
            [$key, $value] = explode('=', $line, 2);
            $key   = trim($key);
            $value = trim($value);
            // クォートを除去
            if (strlen($value) >= 2 && ($value[0] === '"' || $value[0] === "'")) {
                $value = substr($value, 1, -1);
            }
            $_ENV[$key] = $value;
            putenv("{$key}={$value}");
        }
    }
}

return [
    'app' => [
        'name' => $_ENV['APP_NAME'] ?? 'kintone Clone',
        'env'  => $_ENV['APP_ENV']  ?? 'production',
    ],
    'jwt' => [
        'secret' => $_ENV['JWT_SECRET']      ?? 'change-me-in-production',
        'ttl'    => (int) ($_ENV['JWT_TTL_SECONDS'] ?? $_ENV['JWT_TTL'] ?? 3600),
    ],
    'db' => [
        'host' => $_ENV['DB_HOST']     ?? 'db',
        'port' => (int) ($_ENV['DB_PORT'] ?? 3306),
        'name' => $_ENV['DB_DATABASE'] ?? $_ENV['DB_NAME'] ?? 'kintone_php',
        'user' => $_ENV['DB_USER']     ?? 'root',
        'pass' => $_ENV['DB_PASSWORD'] ?? $_ENV['DB_PASS'] ?? '',
    ],
];
