<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\Request;
use App\Infrastructure\Database;
use PDO;

class UserController
{
    public function __construct(
        private readonly Database $db,
    ) {}

    private function generateUuid(): string
    {
        $bytes    = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return sprintf(
            '%s-%s-%s-%s-%s',
            bin2hex(substr($bytes, 0, 4)),
            bin2hex(substr($bytes, 4, 2)),
            bin2hex(substr($bytes, 6, 2)),
            bin2hex(substr($bytes, 8, 2)),
            bin2hex(substr($bytes, 10, 6)),
        );
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatUser(array $row): array
    {
        $row['is_active']    = (bool) $row['is_active'];
        $row['is_superuser'] = (bool) $row['is_superuser'];
        unset($row['password_hash']); // パスワードハッシュは返さない
        return $row;
    }

    /**
     * ユーザー一覧（superuserのみ）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function index(Request $req, array $user): array
    {
        if (!(bool) ($user['is_superuser'] ?? false)) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Superuser privileges required.']];
        }

        $stmt = $this->db->pdo()->query(
            'SELECT id, email, full_name, is_active, is_superuser, created_at
             FROM users
             ORDER BY created_at DESC'
        );
        $rows  = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $users = array_map(fn($row) => $this->formatUser($row), $rows);

        return [200, $users];
    }

    /**
     * ユーザー作成（superuserのみ）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function create(Request $req, array $user): array
    {
        if (!(bool) ($user['is_superuser'] ?? false)) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Superuser privileges required.']];
        }

        $body     = $req->json();
        $email    = trim((string) ($body['email'] ?? ''));
        $fullName = trim((string) ($body['full_name'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($email === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'email is required.']];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'Invalid email format.']];
        }
        if ($password === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'password is required.']];
        }
        if (strlen($password) < 8) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'password must be at least 8 characters.']];
        }

        // 重複チェック
        $stmt = $this->db->pdo()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        if ($stmt->fetch() !== false) {
            return [409, ['code' => 'DUPLICATE_EMAIL', 'message' => 'Email already registered.']];
        }

        $id          = $this->generateUuid();
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        $isActive    = isset($body['is_active']) ? (bool) $body['is_active'] : true;
        $isSuperuser = !empty($body['is_superuser']);
        $now         = date('Y-m-d H:i:s');

        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO users (id, email, full_name, hashed_password, is_active, is_superuser, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $id, $email, $fullName, $passwordHash,
            $isActive ? 1 : 0, $isSuperuser ? 1 : 0, $now,
        ]);

        $newUser = $this->formatUser([
            'id'           => $id,
            'email'        => $email,
            'full_name'    => $fullName,
            'is_active'    => $isActive,
            'is_superuser' => $isSuperuser,
            'created_at'   => $now,
        ]);

        return [200, ['user' => $newUser]];
    }

    /**
     * ユーザー詳細取得（superuserのみ）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function show(Request $req, array $user): array
    {
        if (!(bool) ($user['is_superuser'] ?? false)) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Superuser privileges required.']];
        }

        $userId = (string) $req->param('user_id');

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, email, full_name, is_active, is_superuser, created_at
             FROM users WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'User not found.']];
        }

        return [200, ['user' => $this->formatUser($row)]];
    }

    /**
     * ユーザー更新（superuserのみ）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function update(Request $req, array $user): array
    {
        if (!(bool) ($user['is_superuser'] ?? false)) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Superuser privileges required.']];
        }

        $userId = (string) $req->param('user_id');

        $stmt = $this->db->pdo()->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'User not found.']];
        }

        $body   = $req->json();
        $fields = [];
        $values = [];

        if (isset($body['full_name'])) {
            $fields[] = 'full_name = ?';
            $values[] = (string) $body['full_name'];
        }
        if (array_key_exists('is_active', $body)) {
            $fields[] = 'is_active = ?';
            $values[] = $body['is_active'] ? 1 : 0;
        }
        if (array_key_exists('is_superuser', $body)) {
            // 自分自身のsuperuser権限は変更不可
            if ($userId === $user['id']) {
                return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'Cannot change own superuser status.']];
            }
            $fields[] = 'is_superuser = ?';
            $values[] = $body['is_superuser'] ? 1 : 0;
        }
        if (isset($body['password'])) {
            $password = (string) $body['password'];
            if (strlen($password) < 8) {
                return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'password must be at least 8 characters.']];
            }
            $fields[] = 'hashed_password = ?';
            $values[] = password_hash($password, PASSWORD_BCRYPT);
        }

        if (empty($fields)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'No fields to update.']];
        }

        $values[] = $userId;
        $sql      = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
        $stmt     = $this->db->pdo()->prepare($sql);
        $stmt->execute($values);

        $stmt = $this->db->pdo()->prepare(
            'SELECT id, email, full_name, is_active, is_superuser, created_at
             FROM users WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$userId]);
        $updatedUser = $this->formatUser($stmt->fetch(PDO::FETCH_ASSOC));

        return [200, ['user' => $updatedUser]];
    }

    /**
     * ユーザー削除（superuserのみ、自分自身は不可）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function destroy(Request $req, array $user): array
    {
        if (!(bool) ($user['is_superuser'] ?? false)) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Superuser privileges required.']];
        }

        $userId = (string) $req->param('user_id');

        if ($userId === $user['id']) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'Cannot delete yourself.']];
        }

        $stmt = $this->db->pdo()->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        if ($stmt->fetch() === false) {
            return [404, ['code' => 'NOT_FOUND', 'message' => 'User not found.']];
        }

        $stmt = $this->db->pdo()->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$userId]);

        return [200, ['message' => 'User deleted successfully.']];
    }
}
