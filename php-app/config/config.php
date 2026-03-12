<?php

declare(strict_types=1);

use Dotenv\Dotenv;

$dotenvPath = dirname(__DIR__);
if (file_exists($dotenvPath . '/.env')) {
    $dotenv = Dotenv::createImmutable($dotenvPath);
    $dotenv->safeLoad();
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
