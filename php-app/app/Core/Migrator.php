<?php

declare(strict_types=1);

namespace App\Core;

use PDO;

/**
 * シンプルなDBマイグレーションランナー。
 *
 * migrations/ ディレクトリ内の PHP ファイルを番号順に実行する。
 * ファイル名形式: NNNN_description.php（例: 0001_initial.php）
 * 各ファイルは PDO インスタンスを受け取り、SQL を実行する無名関数を返す。
 */
class Migrator
{
    private PDO $pdo;
    private string $migrationsDir;

    public function __construct(PDO $pdo, ?string $migrationsDir = null)
    {
        $this->pdo = $pdo;
        $this->migrationsDir = $migrationsDir ?? dirname(__DIR__, 2) . '/migrations';
        $this->ensureMigrationsTable();
    }

    /**
     * migrations テーブルがなければ作成する。
     */
    private function ensureMigrationsTable(): void
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                version VARCHAR(255) NOT NULL UNIQUE,
                description VARCHAR(255) DEFAULT NULL,
                applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    /**
     * 適用済みマイグレーション一覧を返す。
     *
     * @return string[] バージョン文字列の配列
     */
    public function getApplied(): array
    {
        $stmt = $this->pdo->query('SELECT version FROM migrations ORDER BY version ASC');
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * 未適用マイグレーション一覧を返す。
     *
     * @return array<array{version: string, description: string, file: string}>
     */
    public function getPending(): array
    {
        $applied = $this->getApplied();
        $all = $this->scanMigrationFiles();
        $pending = [];

        foreach ($all as $migration) {
            if (!in_array($migration['version'], $applied, true)) {
                $pending[] = $migration;
            }
        }

        return $pending;
    }

    /**
     * 未適用マイグレーションを全て実行する。
     *
     * @return array{applied: string[], errors: string[]}
     */
    public function migrate(): array
    {
        $pending = $this->getPending();
        $applied = [];
        $errors  = [];

        foreach ($pending as $migration) {
            try {
                // MySQL の DDL（CREATE TABLE 等）は暗黙コミットするため
                // トランザクションは使わない
                $callback = require $migration['file'];
                if (is_callable($callback)) {
                    $callback($this->pdo);
                }

                $stmt = $this->pdo->prepare(
                    'INSERT INTO migrations (version, description) VALUES (?, ?)'
                );
                $stmt->execute([$migration['version'], $migration['description']]);

                $applied[] = $migration['version'] . ': ' . $migration['description'];
            } catch (\Throwable $e) {
                $errors[] = $migration['version'] . ': ' . $e->getMessage();
                break; // 1つ失敗したら停止
            }
        }

        return ['applied' => $applied, 'errors' => $errors];
    }

    /**
     * 指定バージョンを適用済みとして記録する（実際のSQLは実行しない）。
     * インストーラーが初回スキーマ適用後に呼ぶ。
     */
    public function markAsApplied(string $version, string $description = ''): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT IGNORE INTO migrations (version, description) VALUES (?, ?)'
        );
        $stmt->execute([$version, $description]);
    }

    /**
     * 全マイグレーションを適用済みとして記録する。
     * インストーラーが schema.sql 実行後に呼ぶ。
     */
    public function markAllAsApplied(): void
    {
        $all = $this->scanMigrationFiles();
        foreach ($all as $migration) {
            $this->markAsApplied($migration['version'], $migration['description']);
        }
    }

    /**
     * migrations/ ディレクトリからファイルをスキャンする。
     *
     * @return array<array{version: string, description: string, file: string}>
     */
    private function scanMigrationFiles(): array
    {
        $files = glob($this->migrationsDir . '/*.php') ?: [];
        sort($files);

        $migrations = [];
        foreach ($files as $file) {
            $basename = basename($file, '.php');
            // 形式: NNNN_description
            if (preg_match('/^(\d{4})_(.+)$/', $basename, $matches)) {
                $migrations[] = [
                    'version'     => $matches[1],
                    'description' => str_replace('_', ' ', $matches[2]),
                    'file'        => $file,
                ];
            }
        }

        return $migrations;
    }

    /**
     * 現在のステータスを返す。
     *
     * @return array{applied_count: int, pending_count: int, pending: array<array{version: string, description: string}>}
     */
    public function getStatus(): array
    {
        $applied = $this->getApplied();
        $pending = $this->getPending();

        return [
            'applied_count' => count($applied),
            'pending_count' => count($pending),
            'pending' => array_map(fn($m) => [
                'version' => $m['version'],
                'description' => $m['description'],
            ], $pending),
        ];
    }
}
