<?php

declare(strict_types=1);

namespace App\Core;

use App\Http\Controllers\AdminSettingsController;
use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\AppController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\FieldController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PinnedAppController;
use App\Http\Controllers\RecordController;
use App\Http\Controllers\CustomCodeController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\AuthMiddleware;
use App\Infrastructure\Database;
use App\Infrastructure\JwtService;

class Application
{
    private Router          $router;
    private Request         $request;
    private Database        $database;
    private JwtService      $jwtService;
    private HookManager     $hookManager;
    private AuthMiddleware  $auth;

    // Controllers
    private HealthController       $health;
    private AuthController         $authCtrl;
    private AppController          $appCtrl;
    private FieldController        $fieldCtrl;
    private RecordController       $recordCtrl;
    private AnnouncementController $annoCtrl;
    private PinnedAppController    $pinnedCtrl;
    private AdminSettingsController $adminCtrl;
    private NotificationController $notifCtrl;
    private UserController         $userCtrl;
    private CustomCodeController   $customCodeCtrl;
    private ExportController       $exportCtrl;

    /**
     * @param array<string, mixed> $config
     */
    public function __construct(array $config)
    {
        // ── インフラストラクチャ ──────────────────────────────────────────────
        $this->database    = new Database($config['db']);
        $this->jwtService  = new JwtService($config['jwt']['secret'], $config['jwt']['ttl']);
        $this->hookManager = new HookManager();
        $this->router      = new Router();
        $this->request     = new Request();

        // グローバル関数用に設定
        global $hookManager;
        $hookManager = $this->hookManager;

        // ── ミドルウェア ──────────────────────────────────────────────────────
        $this->auth = new AuthMiddleware($this->database, $this->jwtService);

        // ── コントローラー ────────────────────────────────────────────────────
        $this->health     = new HealthController($this->database);
        $this->authCtrl   = new AuthController($this->database, $this->jwtService, $this->hookManager);
        $this->appCtrl    = new AppController($this->database, $this->hookManager);
        $this->fieldCtrl  = new FieldController($this->database);
        $this->recordCtrl = new RecordController($this->database, $this->hookManager);
        $this->annoCtrl   = new AnnouncementController($this->database);
        $this->pinnedCtrl = new PinnedAppController($this->database);
        $this->adminCtrl  = new AdminSettingsController($this->database);
        $this->notifCtrl  = new NotificationController($this->database);
        $this->userCtrl   = new UserController($this->database);
        $this->customCodeCtrl = new CustomCodeController();
        $this->exportCtrl     = new ExportController($this->database);

        // ── カスタムfunctions.phpの読み込み ──────────────────────────────────
        $customFunctions = dirname(__DIR__, 2) . '/custom/functions.php';
        if (file_exists($customFunctions)) {
            require $customFunctions;
        }

        // ── プラグインの読み込み ──────────────────────────────────────────────
        $pluginFiles = glob(dirname(__DIR__, 2) . '/custom/plugins/*.php') ?: [];
        foreach ($pluginFiles as $pluginFile) {
            require $pluginFile;
        }

        // ── ルート定義の読み込み ──────────────────────────────────────────────
        $router     = $this->router;
        $auth       = $this->auth;
        $config     = $config;
        $health     = $this->health;
        $authCtrl   = $this->authCtrl;
        $appCtrl    = $this->appCtrl;
        $fieldCtrl  = $this->fieldCtrl;
        $recordCtrl = $this->recordCtrl;
        $annoCtrl   = $this->annoCtrl;
        $pinnedCtrl = $this->pinnedCtrl;
        $adminCtrl  = $this->adminCtrl;
        $notifCtrl  = $this->notifCtrl;
        $userCtrl   = $this->userCtrl;
        $customCodeCtrl = $this->customCodeCtrl;
        $exportCtrl     = $this->exportCtrl;

        $routesFile = dirname(__DIR__, 2) . '/routes/api.php';
        if (file_exists($routesFile)) {
            require $routesFile;
        }
    }

    /**
     * リクエストをディスパッチしてレスポンスを出力する。
     */
    public function run(): void
    {
        // CORS ヘッダー
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Content-Type: application/json; charset=utf-8');

        // OPTIONS プリフライト
        if ($this->request->method() === 'OPTIONS') {
            http_response_code(204);
            return;
        }

        $result = $this->router->dispatch($this->request->method(), $this->request->uri());

        // 404
        if (is_array($result) && is_int($result[0]) && !is_callable($result[0])) {
            [$status, $body] = $result;
            http_response_code($status);
            echo json_encode($body, JSON_UNESCAPED_UNICODE);
            return;
        }

        [$callback, $params] = $result;
        $this->request->setParams($params);

        // コールバック実行
        $response = $callback($this->request, $params);

        $this->sendResponse($response);
    }

    /**
     * レスポンス配列を HTTP レスポンスとして出力する。
     *
     * @param mixed $response
     */
    private function sendResponse(mixed $response): void
    {
        if (!is_array($response) || count($response) < 2) {
            http_response_code(200);
            return;
        }

        [$status, $body] = $response;

        if (!is_int($status)) {
            http_response_code(200);
            echo json_encode($response, JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code($status);

        if (is_array($body)) {
            echo json_encode($body, JSON_UNESCAPED_UNICODE);
        }
    }
}
