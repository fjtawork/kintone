<?php

declare(strict_types=1);

namespace App\Infrastructure;

use PDO;
use PDOException;

class Database
{
    private PDO $pdo;

    /**
     * @param array{host: string, port: int, name: string, user: string, pass: string} $config
     */
    public function __construct(array $config)
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $config['host'],
            $config['port'],
            $config['name'],
        );

        try {
            $this->pdo = new PDO(
                $dsn,
                $config['user'],
                $config['pass'],
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ],
            );
        } catch (PDOException $e) {
            // 接続エラーはログに記録し、汎用メッセージで再スロー
            error_log('Database connection failed: ' . $e->getMessage());
            throw new \RuntimeException('Database connection failed.', 0, $e);
        }
    }

    public function pdo(): PDO
    {
        return $this->pdo;
    }
}
