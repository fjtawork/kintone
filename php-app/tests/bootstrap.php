<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

// .env があれば読み込む（テスト環境変数の上書きを許可）
$dotenvPath = dirname(__DIR__);
if (file_exists($dotenvPath . '/.env')) {
    $dotenv = \Dotenv\Dotenv::createMutable($dotenvPath);
    $dotenv->safeLoad();
}

// phpunit.xml の <env> は putenv しないため手動でも設定
foreach ([
    'TEST_BASE_URL'       => 'http://localhost:8081',
    'TEST_ADMIN_EMAIL'    => 'admin@example.com',
    'TEST_ADMIN_PASSWORD' => 'password123',
] as $key => $default) {
    if (getenv($key) === false) {
        putenv("{$key}={$default}");
    }
}
