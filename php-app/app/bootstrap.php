<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

// グローバルフック関数を定義（名前空間の外で定義する必要がある）
require __DIR__ . '/helpers.php';

$config = require dirname(__DIR__) . '/config/config.php';

$app = new App\Core\Application($config);
$app->run();
