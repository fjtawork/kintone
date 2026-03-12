<?php

declare(strict_types=1);

namespace App\Core;

class Request
{
    /** @var array<string, string> */
    private array $urlParams = [];

    // ── HTTPメソッド / URI ────────────────────────────────────────────────────

    public function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    /**
     * クエリストリングを除いたパス部分のみを返す。
     * 末尾スラッシュは除去する（ルートの '/' は除く）。
     */
    public function uri(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        $uri = '/' . trim($uri, '/');

        return $uri === '/' ? '/' : rtrim($uri, '/');
    }

    // ── クエリパラメータ ──────────────────────────────────────────────────────

    public function query(string $key, mixed $default = null): mixed
    {
        return $_GET[$key] ?? $default;
    }

    // ── リクエストボディ ──────────────────────────────────────────────────────

    /**
     * JSONボディをデコードして配列で返す。
     * 解析失敗時は空配列を返す。
     *
     * @return array<mixed>
     */
    public function json(): array
    {
        $raw = file_get_contents('php://input') ?: '';

        if ($raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    // ── URLパラメータ ─────────────────────────────────────────────────────────

    /**
     * @param array<string, string> $params
     */
    public function setParams(array $params): void
    {
        $this->urlParams = $params;
    }

    public function param(string $key, mixed $default = null): mixed
    {
        return $this->urlParams[$key] ?? $default;
    }

    public function getParam(string $key, mixed $default = null): mixed
    {
        return $this->param($key, $default);
    }

    // ── ヘッダー / IP ─────────────────────────────────────────────────────────

    /**
     * ヘッダー名は大文字小文字を問わない（HTTP_XXX 形式に変換して取得）。
     */
    public function header(string $name): ?string
    {
        // Authorization は Apache の RewriteRule で環境変数に移されている場合がある
        if (strtolower($name) === 'authorization') {
            if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
                return $_SERVER['HTTP_AUTHORIZATION'];
            }
            if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
                return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
            }
        }

        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));

        return $_SERVER[$key] ?? null;
    }

    public function ip(): string
    {
        foreach (['HTTP_X_FORWARDED_FOR', 'HTTP_CLIENT_IP', 'REMOTE_ADDR'] as $key) {
            if (!empty($_SERVER[$key])) {
                // X-Forwarded-For は複数IPがカンマ区切りで入る場合がある
                return trim(explode(',', $_SERVER[$key])[0]);
            }
        }

        return '0.0.0.0';
    }
}
