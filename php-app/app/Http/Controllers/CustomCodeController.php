<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Core\Request;

class CustomCodeController
{
    private string $customDir;

    public function __construct()
    {
        $this->customDir = dirname(__DIR__, 3) . '/custom';
    }

    private function requireSuperuser(array $user): ?array
    {
        if (!(bool) ($user['is_superuser'] ?? false)) {
            return [403, ['code' => 'FORBIDDEN', 'message' => 'Superuser privileges required.']];
        }
        return null;
    }

    public function getPhp(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $path = $this->customDir . '/functions.php';
        $code = file_exists($path) ? file_get_contents($path) : "<?php\n\ndeclare(strict_types=1);\n";

        return [200, ['code' => $code]];
    }

    public function updatePhp(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $body = $req->json();
        $code = $body['code'] ?? '';

        if (!is_string($code)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'code must be a string.']];
        }

        $path = $this->customDir . '/functions.php';
        file_put_contents($path, $code);

        return [200, ['success' => true]];
    }

    // ── グローバルJS ─────────────────────────────────────────────────────

    public function getGlobalJs(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $path = $this->customDir . '/global.js';
        $code = file_exists($path) ? file_get_contents($path) : '';

        return [200, ['code' => $code]];
    }

    public function updateGlobalJs(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $body = $req->json();
        $code = $body['code'] ?? '';

        if (!is_string($code)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'code must be a string.']];
        }

        $path = $this->customDir . '/global.js';
        file_put_contents($path, $code);

        return [200, ['success' => true]];
    }

    // ── アプリ別JS ───────────────────────────────────────────────────────

    public function getAppJs(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $appId = (string) $req->param('app_id');
        $path  = $this->customDir . '/apps/' . $appId . '.js';
        $code  = file_exists($path) ? file_get_contents($path) : '';

        return [200, ['code' => $code]];
    }

    public function updateAppJs(Request $req, array $user): array
    {
        if ($error = $this->requireSuperuser($user)) {
            return $error;
        }

        $body = $req->json();
        $code = $body['code'] ?? '';

        if (!is_string($code)) {
            return [400, ['code' => 'VALIDATION_ERROR', 'message' => 'code must be a string.']];
        }

        $appId  = (string) $req->param('app_id');
        $dir    = $this->customDir . '/apps';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $path = $dir . '/' . $appId . '.js';
        file_put_contents($path, $code);

        return [200, ['success' => true]];
    }

    // ── JS配信（認証不要） ───────────────────────────────────────────────

    public function serveGlobalJs(Request $req): array
    {
        $path = $this->customDir . '/global.js';
        $code = file_exists($path) ? file_get_contents($path) : '';

        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: no-cache');
        echo $code;
        exit;
    }

    public function serveAppJs(Request $req): array
    {
        $appId = (string) $req->param('app_id');
        $path  = $this->customDir . '/apps/' . $appId . '.js';
        $code  = file_exists($path) ? file_get_contents($path) : '';

        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: no-cache');
        echo $code;
        exit;
    }
}
