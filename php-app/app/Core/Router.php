<?php

declare(strict_types=1);

namespace App\Core;

class Router
{
    /** @var array<string, list<array{pattern: string, regex: string, params: list<string>, callback: callable}>> */
    private array $routes = [];

    // ── ルート登録 ────────────────────────────────────────────────────────────

    public function get(string $pattern, callable $callback): void
    {
        $this->addRoute('GET', $pattern, $callback);
    }

    public function post(string $pattern, callable $callback): void
    {
        $this->addRoute('POST', $pattern, $callback);
    }

    public function put(string $pattern, callable $callback): void
    {
        $this->addRoute('PUT', $pattern, $callback);
    }

    public function patch(string $pattern, callable $callback): void
    {
        $this->addRoute('PATCH', $pattern, $callback);
    }

    public function delete(string $pattern, callable $callback): void
    {
        $this->addRoute('DELETE', $pattern, $callback);
    }

    private function addRoute(string $method, string $pattern, callable $callback): void
    {
        [$regex, $paramNames] = $this->compilePattern($pattern);

        $this->routes[$method][] = [
            'pattern'  => $pattern,
            'regex'    => $regex,
            'params'   => $paramNames,
            'callback' => $callback,
        ];
    }

    /**
     * {id} 形式のプレースホルダーを正規表現へ変換する。
     *
     * @return array{string, list<string>}
     */
    private function compilePattern(string $pattern): array
    {
        $paramNames = [];

        $regex = preg_replace_callback(
            '/\{(\w+)\}/',
            static function (array $m) use (&$paramNames): string {
                $paramNames[] = $m[1];
                return '([^/]+)';
            },
            $pattern,
        );

        return ['#^' . $regex . '$#', $paramNames];
    }

    // ── ディスパッチ ──────────────────────────────────────────────────────────

    /**
     * @return array{callable, array<string, string>}|array{int, array<string, string>}
     */
    public function dispatch(string $method, string $uri): array
    {
        $method = strtoupper($method);

        // 末尾スラッシュを除去（ルートパス "/" は除く）
        if ($uri !== '/' && str_ends_with($uri, '/')) {
            $uri = rtrim($uri, '/');
        }

        // OPTIONS は CORS プリフライト用に常に 200 を返す
        if ($method === 'OPTIONS') {
            return [static fn() => null, []];
        }

        $candidates = $this->routes[$method] ?? [];

        foreach ($candidates as $route) {
            if (preg_match($route['regex'], $uri, $matches)) {
                array_shift($matches); // フルマッチ部分を除去

                $params = [];
                foreach ($route['params'] as $i => $name) {
                    $params[$name] = $matches[$i] ?? '';
                }

                return [$route['callback'], $params];
            }
        }

        return [404, ['code' => 'NOT_FOUND', 'message' => 'Not Found']];
    }
}
