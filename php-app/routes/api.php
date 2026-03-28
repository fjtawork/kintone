<?php

declare(strict_types=1);

use App\Core\Request;

// ─── Public routes ───────────────────────────────────────────────────────────

$router->get('/', static function (Request $request) use ($config): array {
    return [200, ['message' => $config['app']['name'] . ' PHP Runtime']];
});

$router->get('/api/v1/health/live',    static fn($r) => $health->live($r));
$router->get('/api/v1/health/ready',   static fn($r) => $health->ready($r));
$router->get('/api/v1/system/version', static fn($r) => $health->version($r));
$router->get('/api/v1/system/info',    static fn($r) => $health->info($r));

$router->post('/api/v1/auth/login',   static fn($r) => $authCtrl->login($r));
$router->post('/api/v1/auth/signup',  static fn($r) => $authCtrl->signup($r));

// ─── Protected routes (JWT required) ─────────────────────────────────────────

// Auth / Me
$router->get('/api/v1/auth/me', $auth->protect(
    static fn($req, $user) => [200, array_diff_key($user, ['hashed_password' => ''])]
));

// Users
$router->get('/api/v1/users/me', $auth->protect(
    static fn($req, $user) => [200, array_diff_key($user, ['hashed_password' => ''])]
));
$router->get('/api/v1/users',    $auth->protect(fn($req, $user) => $userCtrl->index($req, $user)));
$router->post('/api/v1/users',   $auth->protect(fn($req, $user) => $userCtrl->create($req, $user)));
$router->put('/api/v1/users/{user_id}',    $auth->protect(fn($req, $user) => $userCtrl->update($req, $user)));
$router->delete('/api/v1/users/{user_id}', $auth->protect(fn($req, $user) => $userCtrl->destroy($req, $user)));

// Pinned Apps
$router->get('/api/v1/users/me/pinned-apps', $auth->protect(fn($req, $user) => $pinnedCtrl->index($req, $user)));
$router->put('/api/v1/users/me/pinned-apps', $auth->protect(fn($req, $user) => $pinnedCtrl->update($req, $user)));

// Notifications
$router->get('/api/v1/notifications',                   $auth->protect(fn($req, $user) => $notifCtrl->index($req, $user)));
$router->patch('/api/v1/notifications/{id}/read',       $auth->protect(fn($req, $user) => $notifCtrl->markRead($req, $user)));
$router->patch('/api/v1/notifications/read-all',        $auth->protect(fn($req, $user) => $notifCtrl->markAllRead($req, $user)));
$router->post('/api/v1/notifications/read-all',         $auth->protect(fn($req, $user) => $notifCtrl->markAllRead($req, $user)));

// Apps
$router->get('/api/v1/apps',                    $auth->protect(fn($req, $user) => $appCtrl->index($req, $user)));
$router->post('/api/v1/apps',                   $auth->protect(fn($req, $user) => $appCtrl->create($req, $user)));
$router->get('/api/v1/apps/{app_id}',           $auth->protect(fn($req, $user) => $appCtrl->show($req, $user)));
$router->put('/api/v1/apps/{app_id}',           $auth->protect(fn($req, $user) => $appCtrl->update($req, $user)));
$router->put('/api/v1/apps/{app_id}/view',      $auth->protect(fn($req, $user) => $appCtrl->updateView($req, $user)));
$router->delete('/api/v1/apps/{app_id}',        $auth->protect(fn($req, $user) => $appCtrl->destroy($req, $user)));

// Fields
$router->get('/api/v1/fields/app/{app_id}',  $auth->protect(fn($req, $user) => $fieldCtrl->listByApp($req, $user)));
$router->put('/api/v1/fields/app/{app_id}',  $auth->protect(fn($req, $user) => $fieldCtrl->bulkUpdate($req, $user)));

// Records
$router->get('/api/v1/records/paged',                               $auth->protect(fn($req, $user) => $recordCtrl->paged($req, $user)));
$router->get('/api/v1/records',                                     $auth->protect(fn($req, $user) => $recordCtrl->index($req, $user)));
$router->post('/api/v1/records',                                    $auth->protect(fn($req, $user) => $recordCtrl->create($req, $user)));
$router->get('/api/v1/records/{record_id}',                         $auth->protect(fn($req, $user) => $recordCtrl->show($req, $user)));
$router->put('/api/v1/records/{record_id}',                         $auth->protect(fn($req, $user) => $recordCtrl->update($req, $user)));
$router->delete('/api/v1/records/{record_id}',                      $auth->protect(fn($req, $user) => $recordCtrl->destroy($req, $user)));
$router->post('/api/v1/records/{record_id}/workflow/actions/{action}', $auth->protect(fn($req, $user) => $recordCtrl->workflowAction($req, $user)));
$router->get('/api/v1/records/{record_id}/comments',                $auth->protect(fn($req, $user) => $recordCtrl->comments($req, $user)));
$router->post('/api/v1/records/{record_id}/comments',               $auth->protect(fn($req, $user) => $recordCtrl->createComment($req, $user)));
$router->get('/api/v1/records/{record_id}/mention-candidates',      $auth->protect(fn($req, $user) => $recordCtrl->mentionCandidates($req, $user)));

// Announcements
$router->get('/api/v1/announcements',                          $auth->protect(fn($req, $user) => $annoCtrl->index($req, $user)));
$router->post('/api/v1/announcements',                         $auth->protect(fn($req, $user) => $annoCtrl->create($req, $user)));
$router->put('/api/v1/announcements/{announcement_id}',        $auth->protect(fn($req, $user) => $annoCtrl->update($req, $user)));
$router->delete('/api/v1/announcements/{announcement_id}',     $auth->protect(fn($req, $user) => $annoCtrl->destroy($req, $user)));

// Organization (stub - テーブル未実装のため空配列を返す)
$router->get('/api/v1/organization/departments', $auth->protect(fn($req, $user) => [200, []]));
$router->get('/api/v1/organization/job_titles',  $auth->protect(fn($req, $user) => [200, []]));

// Admin Settings
$router->get('/api/v1/admin/settings',                $auth->protect(fn($req, $user) => $adminCtrl->getSettings($req, $user)));
$router->put('/api/v1/admin/settings',                $auth->protect(fn($req, $user) => $adminCtrl->updateSettings($req, $user)));
$router->get('/api/v1/admin/ip-allowlist',            $auth->protect(fn($req, $user) => $adminCtrl->getIpAllowlist($req, $user)));
$router->post('/api/v1/admin/ip-allowlist',           $auth->protect(fn($req, $user) => $adminCtrl->createIpEntry($req, $user)));
$router->patch('/api/v1/admin/ip-allowlist/{ip_id}',  $auth->protect(fn($req, $user) => $adminCtrl->updateIpEntry($req, $user)));
$router->delete('/api/v1/admin/ip-allowlist/{ip_id}', $auth->protect(fn($req, $user) => $adminCtrl->deleteIpEntry($req, $user)));

// Migrations
$router->get('/api/v1/admin/migrations',   $auth->protect(fn($req, $user) => $adminCtrl->getMigrationStatus($req, $user)));
$router->post('/api/v1/admin/migrations',  $auth->protect(fn($req, $user) => $adminCtrl->runMigrations($req, $user)));

// Custom Code
$router->get('/api/v1/admin/custom-php',  $auth->protect(fn($req, $user) => $customCodeCtrl->getPhp($req, $user)));
$router->put('/api/v1/admin/custom-php',  $auth->protect(fn($req, $user) => $customCodeCtrl->updatePhp($req, $user)));

$router->get('/api/v1/admin/custom-js/global',  $auth->protect(fn($req, $user) => $customCodeCtrl->getGlobalJs($req, $user)));
$router->put('/api/v1/admin/custom-js/global',  $auth->protect(fn($req, $user) => $customCodeCtrl->updateGlobalJs($req, $user)));
$router->get('/api/v1/apps/{app_id}/custom-js',  $auth->protect(fn($req, $user) => $customCodeCtrl->getAppJs($req, $user)));
$router->put('/api/v1/apps/{app_id}/custom-js',  $auth->protect(fn($req, $user) => $customCodeCtrl->updateAppJs($req, $user)));

// JS配信（認証不要）
$router->get('/api/v1/custom-js/global.js',         static fn($req) => $customCodeCtrl->serveGlobalJs($req));
$router->get('/api/v1/custom-js/apps/{app_id}.js',  static fn($req) => $customCodeCtrl->serveAppJs($req));
