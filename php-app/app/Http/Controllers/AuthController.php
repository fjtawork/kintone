<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\HookManager;
use App\Core\Request;
use App\Infrastructure\Database;
use App\Infrastructure\JwtService;
use PDO;

class AuthController
{
    public function __construct(
        private readonly Database    $db,
        private readonly JwtService  $jwt,
        private readonly HookManager $hooks,
    ) {}

    /**
     * ログイン処理。
     * email / password を受け取り、JWTトークンを返す。
     *
     * @return array{int, array<string, mixed>}
     */
    public function login(Request $request): array
    {
        $body     = $request->json();
        $email    = trim((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($email === '' || $password === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'email and password are required.']];
        }

        // ── ユーザー検索 ──────────────────────────────────────────────────────
        $stmt = $this->db->pdo()->prepare(
            'SELECT id, email, full_name, hashed_password, is_active, is_superuser, created_at
             FROM users
             WHERE email = ?
             LIMIT 1'
        );
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user === false) {
            $this->hooks->do_action('auth.login.failed', ['email' => $email, 'reason' => 'user_not_found']);
            return [401, ['code' => 'INVALID_CREDENTIALS', 'message' => 'Invalid email or password.']];
        }

        // ── パスワード検証 ────────────────────────────────────────────────────
        if (!password_verify($password, (string) $user['hashed_password'])) {
            $this->hooks->do_action('auth.login.failed', ['email' => $email, 'reason' => 'wrong_password']);
            return [401, ['code' => 'INVALID_CREDENTIALS', 'message' => 'Invalid email or password.']];
        }

        // ── アクティブ確認 ────────────────────────────────────────────────────
        if (!(bool) $user['is_active']) {
            $this->hooks->do_action('auth.login.failed', ['email' => $email, 'reason' => 'account_disabled']);
            return [403, ['code' => 'ACCOUNT_DISABLED', 'message' => 'Account is disabled.']];
        }

        // ── JWT生成 ───────────────────────────────────────────────────────────
        $token = $this->jwt->create([
            'sub'          => $user['id'],
            'email'        => $user['email'],
            'is_superuser' => (bool) $user['is_superuser'],
        ]);

        $publicUser = [
            'id'           => $user['id'],
            'email'        => $user['email'],
            'full_name'    => $user['full_name'],
            'is_superuser' => (bool) $user['is_superuser'],
            'created_at'   => $user['created_at'],
        ];

        $this->hooks->do_action('auth.login.success', $publicUser);

        return [200, [
            'access_token' => $token,
            'user'  => $publicUser,
        ]];
    }

    /**
     * 現在のユーザー情報を返す（JWTで認証済みのユーザー）。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function me(Request $request, array $user): array
    {
        return [200, [
            'id'           => $user['id'],
            'email'        => $user['email'],
            'full_name'    => $user['full_name'],
            'is_superuser' => (bool) $user['is_superuser'],
        ]];
    }

    /**
     * 新規ユーザー登録。
     *
     * @return array{int, array<string, mixed>}
     */
    public function signup(Request $request): array
    {
        $body     = $request->json();
        $email    = trim((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $fullName = trim((string) ($body['full_name'] ?? ''));

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

        $bytes    = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $id  = sprintf('%s-%s-%s-%s-%s',
            bin2hex(substr($bytes, 0, 4)), bin2hex(substr($bytes, 4, 2)),
            bin2hex(substr($bytes, 6, 2)), bin2hex(substr($bytes, 8, 2)),
            bin2hex(substr($bytes, 10, 6)));

        $now          = date('Y-m-d H:i:s');
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $stmt = $this->db->pdo()->prepare(
            'INSERT INTO users (id, email, full_name, hashed_password, is_active, is_superuser, created_at)
             VALUES (?, ?, ?, ?, 1, 0, ?)'
        );
        $stmt->execute([$id, $email, $fullName, $passwordHash, $now]);

        $token = $this->jwt->create([
            'sub'          => $id,
            'email'        => $email,
            'is_superuser' => false,
        ]);

        $publicUser = [
            'id'           => $id,
            'email'        => $email,
            'full_name'    => $fullName,
            'is_superuser' => false,
            'created_at'   => $now,
        ];

        $this->hooks->do_action('auth.signup', $publicUser);

        return [200, [
            'access_token' => $token,
            'user'         => $publicUser,
        ]];
    }

    /**
     * パスワード変更。
     *
     * @param array<string, mixed> $user
     * @return array{int, array<string, mixed>}
     */
    public function changePassword(Request $request, array $user): array
    {
        $body        = $request->json();
        $oldPassword = (string) ($body['old_password'] ?? '');
        $newPassword = (string) ($body['new_password'] ?? '');

        if ($oldPassword === '' || $newPassword === '') {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'old_password and new_password are required.']];
        }

        if (strlen($newPassword) < 8) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'new_password must be at least 8 characters.']];
        }

        // 現在のハッシュを取得
        $stmt = $this->db->pdo()->prepare(
            'SELECT hashed_password FROM users WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false || !password_verify($oldPassword, (string) $row['hashed_password'])) {
            return [401, ['code' => 'INVALID_CREDENTIALS', 'message' => 'Current password is incorrect.']];
        }

        $newHash = hashed_password($newPassword, PASSWORD_BCRYPT);

        $stmt = $this->db->pdo()->prepare(
            'UPDATE users SET hashed_password = ? WHERE id = ?'
        );
        $stmt->execute([$newHash, $user['id']]);

        return [200, ['message' => 'Password changed successfully.']];
    }
}
