<?php

declare(strict_types=1);

/**
 * migrations テーブル自体のマイグレーション。
 * Migrator が ensureMigrationsTable() で自動作成するため、
 * このファイルは実質ノーオペレーション。
 * 既存環境でのベースライン記録用。
 */
return static function (PDO $pdo): void {
    // Migrator::ensureMigrationsTable() で既に作成済み
};
