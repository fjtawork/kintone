<?php
/**
 * kintone Clone - Web Installer
 *
 * WordPress-like GUI installer for initial setup.
 * Handles: requirements check, DB config, table creation, admin account setup.
 */
declare(strict_types=1);

// Already installed?
$lockFile = __DIR__ . '/installed.lock';
if (file_exists($lockFile)) {
    header('Location: /');
    exit;
}

// ─── Helper Functions ──────────────────────────────────────────────

function generateUuid(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function generateJwtSecret(): string {
    return bin2hex(random_bytes(32));
}

function checkRequirements(): array {
    $checks = [];

    // PHP version
    $checks[] = [
        'name' => 'PHP バージョン',
        'required' => '8.1以上',
        'current' => PHP_VERSION,
        'ok' => version_compare(PHP_VERSION, '8.1.0', '>='),
    ];

    // Extensions
    $extensions = [
        'pdo' => 'PDO',
        'pdo_mysql' => 'PDO MySQL',
        'json' => 'JSON',
        'mbstring' => 'mbstring',
        'openssl' => 'OpenSSL',
    ];
    foreach ($extensions as $ext => $label) {
        $checks[] = [
            'name' => "PHP拡張: {$label}",
            'required' => '有効',
            'current' => extension_loaded($ext) ? '有効' : '無効',
            'ok' => extension_loaded($ext),
        ];
    }

    // Writable directories
    $writablePaths = [
        __DIR__ => 'ルートディレクトリ (.env書き込み用)',
        __DIR__ . '/storage' => 'storage/',
    ];
    foreach ($writablePaths as $path => $label) {
        $writable = is_writable($path) || (!file_exists($path) && is_writable(dirname($path)));
        $checks[] = [
            'name' => "書き込み権限: {$label}",
            'required' => '書き込み可',
            'current' => $writable ? '書き込み可' : '書き込み不可',
            'ok' => $writable,
        ];
    }

    // custom/ ディレクトリ書き込み権限
    $customDir = __DIR__ . '/custom';
    $customWritable = is_writable($customDir) || (!file_exists($customDir) && is_writable(__DIR__));
    $checks[] = [
        'name' => '書き込み権限: custom/',
        'required' => '書き込み可',
        'current' => $customWritable ? '書き込み可' : '書き込み不可',
        'ok' => $customWritable,
    ];

    return $checks;
}

function testDbConnection(string $host, int $port, string $user, string $pass, string $dbName): array {
    try {
        // First try connecting without database to check credentials
        $dsn = "mysql:host={$host};port={$port};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
        ]);

        // Check if database exists
        $stmt = $pdo->query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = " . $pdo->quote($dbName));
        $exists = $stmt->fetch();

        if (!$exists) {
            // Try to create it
            $pdo->exec("CREATE DATABASE `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }

        // Connect to the actual database
        $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);

        return ['ok' => true, 'message' => 'データベースに接続しました。', 'pdo' => $pdo, 'created' => !$exists];
    } catch (PDOException $e) {
        return ['ok' => false, 'message' => '接続エラー: ' . $e->getMessage()];
    }
}

function runMigration(PDO $pdo): array {
    $schemaFile = __DIR__ . '/app/Installer/schema.sql';
    if (!file_exists($schemaFile)) {
        return ['ok' => false, 'message' => 'schema.sql が見つかりません。'];
    }

    $sql = file_get_contents($schemaFile);

    // コメント行を除去してからセミコロンで分割
    $lines = explode("\n", $sql);
    $cleaned = implode("\n", array_filter($lines, fn($l) => !str_starts_with(trim($l), '--')));
    $statements = array_filter(
        array_map('trim', explode(';', $cleaned)),
        fn($s) => $s !== ''
    );

    $created = [];
    $errors = [];

    // 外部キーチェックを無効化（テーブル作成順序の依存関係を回避）
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

    foreach ($statements as $stmt) {
        try {
            $pdo->exec($stmt);
            // Extract table/index name for display
            if (preg_match('/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i', $stmt, $m)) {
                $created[] = "テーブル: {$m[1]}";
            } elseif (preg_match('/CREATE\s+INDEX\s+(\w+)/i', $stmt, $m)) {
                $created[] = "インデックス: {$m[1]}";
            }
        } catch (PDOException $e) {
            // Ignore "already exists" errors
            if ($e->getCode() !== '42S01' && !str_contains($e->getMessage(), 'Duplicate key name')) {
                $errors[] = $e->getMessage();
            }
        }
    }

    // 外部キーチェックを再有効化
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

    if (!empty($errors)) {
        return ['ok' => false, 'message' => implode("\n", $errors), 'created' => $created];
    }
    return ['ok' => true, 'message' => 'すべてのテーブルを作成しました。', 'created' => $created];
}

function createAdmin(PDO $pdo, string $email, string $password, string $fullName): array {
    // Check if user already exists
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        return ['ok' => false, 'message' => 'このメールアドレスは既に登録されています。'];
    }

    $id = generateUuid();
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $now = date('Y-m-d H:i:s');

    $stmt = $pdo->prepare(
        'INSERT INTO users (id, email, full_name, hashed_password, is_active, is_superuser, created_at)
         VALUES (?, ?, ?, ?, 1, 1, ?)'
    );
    $stmt->execute([$id, $email, $fullName, $hash, $now]);

    return ['ok' => true, 'message' => '管理者アカウントを作成しました。', 'user_id' => $id];
}

function writeEnvFile(string $host, int $port, string $user, string $pass, string $dbName, string $jwtSecret, string $orgName): bool {
    $env = <<<ENV
APP_NAME="{$orgName}"
APP_ENV=production

DB_HOST={$host}
DB_PORT={$port}
DB_DATABASE={$dbName}
DB_USER={$user}
DB_PASSWORD={$pass}

JWT_SECRET={$jwtSecret}
JWT_TTL_SECONDS=86400
ENV;

    return file_put_contents(__DIR__ . '/.env', $env) !== false;
}

function writeLockFile(): bool {
    $data = json_encode([
        'installed_at' => date('c'),
        'version' => '1.0.0',
    ]);
    return file_put_contents(__DIR__ . '/installed.lock', $data) !== false;
}

function initSystemSettings(PDO $pdo, string $orgName): void {
    $settings = [
        'organization_name' => $orgName,
        'signup_enabled' => true,
        'session_timeout_hours' => 24,
        'ip_restriction_enabled' => false,
    ];
    $stmt = $pdo->prepare(
        'INSERT INTO system_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)'
    );
    foreach ($settings as $key => $value) {
        $stmt->execute([$key, json_encode($value)]);
    }
}

// ─── AJAX API Handler ──────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    header('Content-Type: application/json; charset=utf-8');

    $action = $_POST['action'];

    if ($action === 'test_db') {
        $result = testDbConnection(
            $_POST['db_host'] ?? 'localhost',
            (int) ($_POST['db_port'] ?? 3306),
            $_POST['db_user'] ?? 'root',
            $_POST['db_pass'] ?? '',
            $_POST['db_name'] ?? 'kintone_php',
        );
        unset($result['pdo']);
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'install') {
        $host   = $_POST['db_host'] ?? 'localhost';
        $port   = (int) ($_POST['db_port'] ?? 3306);
        $user   = $_POST['db_user'] ?? 'root';
        $pass   = $_POST['db_pass'] ?? '';
        $dbName = $_POST['db_name'] ?? 'kintone_php';

        $adminEmail    = $_POST['admin_email'] ?? '';
        $adminPassword = $_POST['admin_password'] ?? '';
        $adminName     = $_POST['admin_name'] ?? '';
        $orgName       = $_POST['org_name'] ?? 'My Organization';

        // Validate
        if (!$adminEmail || !$adminPassword) {
            echo json_encode(['ok' => false, 'step' => 'validate', 'message' => 'メールアドレスとパスワードは必須です。']);
            exit;
        }
        if (strlen($adminPassword) < 8) {
            echo json_encode(['ok' => false, 'step' => 'validate', 'message' => 'パスワードは8文字以上にしてください。']);
            exit;
        }
        if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['ok' => false, 'step' => 'validate', 'message' => 'メールアドレスの形式が正しくありません。']);
            exit;
        }

        // Step 1: Connect to DB
        $conn = testDbConnection($host, $port, $user, $pass, $dbName);
        if (!$conn['ok']) {
            echo json_encode(['ok' => false, 'step' => 'db', 'message' => $conn['message']]);
            exit;
        }
        $pdo = $conn['pdo'];

        // Step 2: Run migration
        $migration = runMigration($pdo);
        if (!$migration['ok']) {
            echo json_encode(['ok' => false, 'step' => 'migration', 'message' => $migration['message']]);
            exit;
        }

        // Step 3: Create admin account
        $admin = createAdmin($pdo, $adminEmail, $adminPassword, $adminName);
        if (!$admin['ok']) {
            echo json_encode(['ok' => false, 'step' => 'admin', 'message' => $admin['message']]);
            exit;
        }

        // Step 4: Init system settings
        initSystemSettings($pdo, $orgName);

        // Step 5: Write .env
        $jwtSecret = generateJwtSecret();
        if (!writeEnvFile($host, $port, $user, $pass, $dbName, $jwtSecret, $orgName)) {
            echo json_encode(['ok' => false, 'step' => 'env', 'message' => '.envファイルの書き込みに失敗しました。ディレクトリの権限を確認してください。']);
            exit;
        }

        // Step 6: Write lock file
        writeLockFile();

        echo json_encode([
            'ok' => true,
            'message' => 'インストールが完了しました！',
            'tables' => $migration['created'],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['ok' => false, 'message' => 'Unknown action']);
    exit;
}

// ─── Requirements Check for Template ───────────────────────────────

$requirements = checkRequirements();
$allOk = !in_array(false, array_column($requirements, 'ok'), true);

?><!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kintone Clone - インストール</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f5f5f4; color: #1c1917; line-height: 1.6; min-height: 100vh; }

.installer { max-width: 640px; margin: 40px auto; padding: 0 16px; }
.logo { text-align: center; margin-bottom: 32px; }
.logo h1 { font-size: 28px; font-weight: 700; color: #0c0a09; }
.logo p { color: #78716c; font-size: 14px; margin-top: 4px; }

.card { background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.card + .card { margin-top: 24px; }

.step-indicator { display: flex; justify-content: center; gap: 8px; margin-bottom: 32px; }
.step-dot { width: 10px; height: 10px; border-radius: 50%; background: #d6d3d1; transition: all 0.3s; }
.step-dot.active { background: #0c0a09; transform: scale(1.2); }
.step-dot.done { background: #16a34a; }

h2 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
.subtitle { color: #78716c; font-size: 14px; margin-bottom: 24px; }

/* Requirements table */
.req-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.req-table th { text-align: left; padding: 8px 12px; background: #fafaf9; border-bottom: 1px solid #e7e5e4; font-weight: 500; color: #57534e; }
.req-table td { padding: 8px 12px; border-bottom: 1px solid #f5f5f4; }
.req-table tr:last-child td { border-bottom: none; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 500; }
.badge-ok { background: #dcfce7; color: #166534; }
.badge-ng { background: #fee2e2; color: #991b1b; }

/* Form */
.form-group { margin-bottom: 20px; }
.form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #292524; }
.form-group .hint { font-size: 12px; color: #a8a29e; margin-top: 4px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

input[type="text"], input[type="email"], input[type="password"], input[type="number"] {
    width: 100%; padding: 10px 12px; border: 1px solid #d6d3d1; border-radius: 8px;
    font-size: 14px; transition: border-color 0.2s, box-shadow 0.2s; background: #fff;
}
input:focus { outline: none; border-color: #0c0a09; box-shadow: 0 0 0 3px rgba(12,10,9,0.08); }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: all 0.2s; }
.btn-primary { background: #0c0a09; color: #fff; }
.btn-primary:hover { background: #292524; }
.btn-primary:disabled { background: #a8a29e; cursor: not-allowed; }
.btn-outline { background: #fff; color: #292524; border: 1px solid #d6d3d1; }
.btn-outline:hover { background: #fafaf9; }

.btn-group { display: flex; justify-content: space-between; margin-top: 28px; }

/* Alert */
.alert { padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 20px; }
.alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.alert-info { background: #e0f2fe; color: #075985; border: 1px solid #bae6fd; }

/* Progress */
.progress-list { list-style: none; font-size: 14px; }
.progress-list li { padding: 6px 0; display: flex; align-items: center; gap: 8px; }
.progress-list li::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #d6d3d1; flex-shrink: 0; }
.progress-list li.done::before { background: #16a34a; }
.progress-list li.error::before { background: #dc2626; }

/* Spinner */
.spinner { width: 20px; height: 20px; border: 2px solid #e7e5e4; border-top-color: #0c0a09;
    border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Complete */
.complete-icon { width: 64px; height: 64px; margin: 0 auto 16px; background: #dcfce7; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; }
.complete-icon svg { width: 32px; height: 32px; color: #16a34a; }
.complete-text { text-align: center; }

/* Visibility */
.hidden { display: none !important; }
</style>
</head>
<body>

<div class="installer">
    <div class="logo">
        <h1>kintone Clone</h1>
        <p>インストールウィザード</p>
    </div>

    <div class="step-indicator">
        <div class="step-dot active" id="dot-0"></div>
        <div class="step-dot" id="dot-1"></div>
        <div class="step-dot" id="dot-2"></div>
        <div class="step-dot" id="dot-3"></div>
    </div>

    <!-- ════════ Step 0: Requirements ════════ -->
    <div class="card step" id="step-0">
        <h2>ようこそ</h2>
        <p class="subtitle">インストールを開始する前に、サーバー環境をチェックします。</p>

        <table class="req-table">
            <thead>
                <tr><th>項目</th><th>必要</th><th>状態</th></tr>
            </thead>
            <tbody>
                <?php foreach ($requirements as $req): ?>
                <tr>
                    <td><?= htmlspecialchars($req['name']) ?></td>
                    <td><?= htmlspecialchars($req['required']) ?></td>
                    <td>
                        <span class="badge <?= $req['ok'] ? 'badge-ok' : 'badge-ng' ?>">
                            <?= htmlspecialchars($req['current']) ?>
                        </span>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>

        <?php if (!$allOk): ?>
        <div class="alert alert-error" style="margin-top: 20px;">
            一部の要件が満たされていません。サーバー環境を確認してから再度お試しください。
        </div>
        <?php endif; ?>

        <div class="btn-group">
            <div></div>
            <button class="btn btn-primary" onclick="goStep(1)" <?= $allOk ? '' : 'disabled' ?>>
                次へ &rarr;
            </button>
        </div>
    </div>

    <!-- ════════ Step 1: Database ════════ -->
    <div class="card step hidden" id="step-1">
        <h2>データベース設定</h2>
        <p class="subtitle">MySQLデータベースの接続情報を入力してください。</p>

        <div id="db-alert"></div>

        <div class="form-row">
            <div class="form-group">
                <label>ホスト名</label>
                <input type="text" id="db_host" value="localhost">
            </div>
            <div class="form-group">
                <label>ポート</label>
                <input type="number" id="db_port" value="3306">
            </div>
        </div>
        <div class="form-group">
            <label>データベース名</label>
            <input type="text" id="db_name" value="kintone_php">
            <p class="hint">データベースが存在しない場合は自動的に作成を試みます。</p>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>ユーザー名</label>
                <input type="text" id="db_user" value="root">
            </div>
            <div class="form-group">
                <label>パスワード</label>
                <input type="password" id="db_pass" value="">
            </div>
        </div>

        <div class="btn-group">
            <button class="btn btn-outline" onclick="goStep(0)">&larr; 戻る</button>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-outline" id="btn-test-db" onclick="testDb()">接続テスト</button>
                <button class="btn btn-primary" id="btn-db-next" onclick="goStep(2)" disabled>次へ &rarr;</button>
            </div>
        </div>
    </div>

    <!-- ════════ Step 2: Admin + Settings ════════ -->
    <div class="card step hidden" id="step-2">
        <h2>管理者アカウント</h2>
        <p class="subtitle">管理者アカウントとサイトの基本設定を行います。</p>

        <div id="admin-alert"></div>

        <div class="form-group">
            <label>組織名（サイト名）</label>
            <input type="text" id="org_name" value="" placeholder="例: 株式会社サンプル">
        </div>

        <hr style="border:none;border-top:1px solid #e7e5e4;margin:20px 0;">

        <div class="form-group">
            <label>管理者の名前</label>
            <input type="text" id="admin_name" placeholder="例: 山田 太郎">
        </div>
        <div class="form-group">
            <label>メールアドレス</label>
            <input type="email" id="admin_email" placeholder="admin@example.com">
        </div>
        <div class="form-group">
            <label>パスワード</label>
            <input type="password" id="admin_password" placeholder="8文字以上">
            <p class="hint">英数字8文字以上を推奨します。</p>
        </div>
        <div class="form-group">
            <label>パスワード（確認）</label>
            <input type="password" id="admin_password2" placeholder="もう一度入力">
        </div>

        <div class="btn-group">
            <button class="btn btn-outline" onclick="goStep(1)">&larr; 戻る</button>
            <button class="btn btn-primary" id="btn-install" onclick="runInstall()">
                インストール実行
            </button>
        </div>
    </div>

    <!-- ════════ Step 3: Complete ════════ -->
    <div class="card step hidden" id="step-3">
        <div class="complete-text">
            <div class="complete-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                </svg>
            </div>
            <h2>インストール完了！</h2>
            <p class="subtitle" style="margin-bottom:16px;">kintone Clone のセットアップが正常に完了しました。</p>

            <div id="install-summary" class="alert alert-info" style="text-align:left;"></div>

            <div style="margin-top:24px;">
                <a href="/login" class="btn btn-primary" style="text-decoration:none;">
                    ログイン画面へ &rarr;
                </a>
            </div>
        </div>
    </div>
</div>

<script>
let currentStep = 0;
let dbVerified = false;

function goStep(n) {
    document.querySelectorAll('.step').forEach(el => el.classList.add('hidden'));
    document.getElementById('step-' + n).classList.remove('hidden');

    document.querySelectorAll('.step-dot').forEach((dot, i) => {
        dot.classList.remove('active', 'done');
        if (i < n) dot.classList.add('done');
        if (i === n) dot.classList.add('active');
    });
    currentStep = n;
    window.scrollTo(0, 0);
}

function showAlert(containerId, message, type) {
    const el = document.getElementById(containerId);
    el.innerHTML = '<div class="alert alert-' + type + '">' + escapeHtml(message) + '</div>';
}

function clearAlert(containerId) {
    document.getElementById(containerId).innerHTML = '';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getDbFields() {
    return {
        db_host: document.getElementById('db_host').value,
        db_port: document.getElementById('db_port').value,
        db_user: document.getElementById('db_user').value,
        db_pass: document.getElementById('db_pass').value,
        db_name: document.getElementById('db_name').value,
    };
}

async function testDb() {
    const btn = document.getElementById('btn-test-db');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> テスト中...';
    clearAlert('db-alert');

    const body = new URLSearchParams({ action: 'test_db', ...getDbFields() });

    try {
        const res = await fetch('/install.php', { method: 'POST', body });
        const data = await res.json();
        if (data.ok) {
            let msg = data.message;
            if (data.created) msg += '（データベースを新規作成しました）';
            showAlert('db-alert', msg, 'success');
            dbVerified = true;
            document.getElementById('btn-db-next').disabled = false;
        } else {
            showAlert('db-alert', data.message, 'error');
            dbVerified = false;
            document.getElementById('btn-db-next').disabled = true;
        }
    } catch (e) {
        showAlert('db-alert', '通信エラー: ' + e.message, 'error');
    }

    btn.disabled = false;
    btn.textContent = '接続テスト';
}

async function runInstall() {
    // Validate
    const email = document.getElementById('admin_email').value;
    const pw = document.getElementById('admin_password').value;
    const pw2 = document.getElementById('admin_password2').value;
    const name = document.getElementById('admin_name').value;
    const org = document.getElementById('org_name').value;

    clearAlert('admin-alert');

    if (!email || !pw) {
        showAlert('admin-alert', 'メールアドレスとパスワードは必須です。', 'error');
        return;
    }
    if (pw.length < 8) {
        showAlert('admin-alert', 'パスワードは8文字以上にしてください。', 'error');
        return;
    }
    if (pw !== pw2) {
        showAlert('admin-alert', 'パスワードが一致しません。', 'error');
        return;
    }
    if (!org.trim()) {
        showAlert('admin-alert', '組織名を入力してください。', 'error');
        return;
    }

    const btn = document.getElementById('btn-install');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> インストール中...';

    const body = new URLSearchParams({
        action: 'install',
        ...getDbFields(),
        admin_email: email,
        admin_password: pw,
        admin_name: name,
        org_name: org,
    });

    try {
        const res = await fetch('/install.php', { method: 'POST', body });
        const data = await res.json();

        if (data.ok) {
            // Show summary
            let html = '<strong>作成されたオブジェクト:</strong><ul style="margin:8px 0 0 20px;">';
            if (data.tables) {
                data.tables.forEach(t => { html += '<li>' + escapeHtml(t) + '</li>'; });
            }
            html += '</ul>';
            html += '<p style="margin-top:8px;"><strong>管理者:</strong> ' + escapeHtml(email) + '</p>';
            html += '<p><strong>組織名:</strong> ' + escapeHtml(org) + '</p>';
            document.getElementById('install-summary').innerHTML = html;
            goStep(3);
        } else {
            showAlert('admin-alert', data.message, 'error');
            btn.disabled = false;
            btn.textContent = 'インストール実行';
        }
    } catch (e) {
        showAlert('admin-alert', '通信エラー: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'インストール実行';
    }
}
</script>

</body>
</html>
