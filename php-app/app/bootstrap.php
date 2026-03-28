<?php

declare(strict_types=1);

/**
 * PSR-4 オートローダー（Composer不要）。
 * App\ 名前空間を app/ ディレクトリにマッピングする。
 */
spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $file = __DIR__ . '/' . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

// 未インストール時はAPIリクエストを拒否
if (!file_exists(dirname(__DIR__) . '/installed.lock')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(503);
    echo json_encode(['message' => 'Application is not installed. Please run the installer.']);
    exit;
}

// グローバルフック関数を定義（名前空間の外で定義する必要がある）
require __DIR__ . '/helpers.php';

$config = require dirname(__DIR__) . '/config/config.php';

$app = new App\Core\Application($config);
$app->run();
