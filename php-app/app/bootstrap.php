<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

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
