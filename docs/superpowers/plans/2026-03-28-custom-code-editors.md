# カスタムコードエディタ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** superuserがWeb管理画面からPHP（サーバーサイドフック）とJavaScript（フロントエンドカスタマイズ）を編集・保存できるようにする

**Architecture:** PHPバックエンドに `CustomCodeController` を追加し、ファイル読み書きAPIを提供。フロントエンドにMonaco Editorベースのコードエディタページを追加。カスタムJSは公開エンドポイント経由で配信し、`<script>` タグで実行。

**Tech Stack:** PHP 8.3, Next.js (static export), Monaco Editor (`@monaco-editor/react`), React Query

---

## File Structure

### PHP Backend (php-app/)

| File | Action | Responsibility |
|------|--------|----------------|
| `app/Http/Controllers/CustomCodeController.php` | Create | PHP/JS コード読み書き + JS配信 API |
| `routes/api.php` | Modify | 新規ルート追加 |
| `app/Core/Application.php` | Modify | CustomCodeController のインスタンス化 |
| `custom/global.js` | Create | グローバルJS 初期ファイル（空） |
| `custom/apps/.gitkeep` | Create | アプリ別JSディレクトリ |

### Frontend (frontend/)

| File | Action | Responsibility |
|------|--------|----------------|
| `features/customize/api.ts` | Create | カスタムコードAPI呼び出し関数 |
| `features/customize/components/CodeEditor.tsx` | Create | Monaco Editor ラッパーコンポーネント |
| `features/customize/components/PhpHookReference.tsx` | Create | PHPフック一覧リファレンス表示 |
| `app/admin/customize/php/page.tsx` | Create | PHP エディタページ（サーバーコンポーネント） |
| `app/admin/customize/php/PhpEditorClient.tsx` | Create | PHP エディタクライアント |
| `app/admin/customize/js/page.tsx` | Create | グローバルJS エディタページ（サーバーコンポーネント） |
| `app/admin/customize/js/JsEditorClient.tsx` | Create | グローバルJS エディタクライアント |
| `features/customize/components/AppJsEditor.tsx` | Create | アプリ別JS エディタ（設定画面埋め込み用） |
| `app/apps/[id]/settings/SettingsPageClient.tsx` | Modify | JavaScript タブ追加 |
| `components/layout/Navbar.tsx` | Modify | カスタマイズリンク追加 |
| `components/providers/CustomScriptLoader.tsx` | Create | グローバル/アプリJSを読み込み実行するコンポーネント |
| `app/layout.tsx` | Modify | CustomScriptLoader追加 |

---

### Task 1: CustomCodeController — PHP コード読み書きAPI

**Files:**
- Create: `php-app/app/Http/Controllers/CustomCodeController.php`
- Modify: `php-app/app/Core/Application.php`
- Modify: `php-app/routes/api.php`

- [ ] **Step 1: Create CustomCodeController with getPhp and updatePhp**

```php
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
}
```

- [ ] **Step 2: Register controller in Application.php**

In `php-app/app/Core/Application.php`, add the import:
```php
use App\Http\Controllers\CustomCodeController;
```

Add the property:
```php
private CustomCodeController $customCodeCtrl;
```

Add instantiation after `$this->userCtrl` (line 71):
```php
$this->customCodeCtrl = new CustomCodeController();
```

Add variable for routes file after `$userCtrl` (line 98):
```php
$customCodeCtrl = $this->customCodeCtrl;
```

- [ ] **Step 3: Add routes in api.php**

Add after the Admin Settings section (after line 87):
```php
// Custom Code
$router->get('/api/v1/admin/custom-php',  $auth->protect(fn($req, $user) => $customCodeCtrl->getPhp($req, $user)));
$router->put('/api/v1/admin/custom-php',  $auth->protect(fn($req, $user) => $customCodeCtrl->updatePhp($req, $user)));
```

- [ ] **Step 4: Test with curl**

```bash
# Get PHP code (should return current functions.php content)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/api/v1/admin/custom-php | jq .

# Update PHP code
curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"<?php\n// updated"}' \
  http://localhost:8081/api/v1/admin/custom-php | jq .
```

Expected: 200 with `{"code": "..."}` and `{"success": true}`

- [ ] **Step 5: Commit**

```bash
git add php-app/app/Http/Controllers/CustomCodeController.php php-app/app/Core/Application.php php-app/routes/api.php
git commit -m "feat: add custom PHP code read/write API"
```

---

### Task 2: CustomCodeController — JS コード読み書き + 配信API

**Files:**
- Modify: `php-app/app/Http/Controllers/CustomCodeController.php`
- Modify: `php-app/routes/api.php`
- Create: `php-app/custom/global.js`
- Create: `php-app/custom/apps/.gitkeep`

- [ ] **Step 1: Add JS methods to CustomCodeController**

Add these methods to `CustomCodeController`:

```php
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
```

- [ ] **Step 2: Add routes in api.php**

Add after the custom-php routes:
```php
$router->get('/api/v1/admin/custom-js/global',  $auth->protect(fn($req, $user) => $customCodeCtrl->getGlobalJs($req, $user)));
$router->put('/api/v1/admin/custom-js/global',  $auth->protect(fn($req, $user) => $customCodeCtrl->updateGlobalJs($req, $user)));
$router->get('/api/v1/apps/{app_id}/custom-js',  $auth->protect(fn($req, $user) => $customCodeCtrl->getAppJs($req, $user)));
$router->put('/api/v1/apps/{app_id}/custom-js',  $auth->protect(fn($req, $user) => $customCodeCtrl->updateAppJs($req, $user)));

// JS配信（認証不要）
$router->get('/api/v1/custom-js/global.js',         static fn($req) => $customCodeCtrl->serveGlobalJs($req));
$router->get('/api/v1/custom-js/apps/{app_id}.js',  static fn($req) => $customCodeCtrl->serveAppJs($req));
```

- [ ] **Step 3: Create initial files**

Create `php-app/custom/global.js`:
```js
// グローバルJavaScriptカスタマイズ
// ここに書いたコードは全ページで実行されます。
```

Create `php-app/custom/apps/.gitkeep` (empty file).

- [ ] **Step 4: Test with curl**

```bash
# Get global JS
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/api/v1/admin/custom-js/global | jq .

# Update global JS
curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(\"hello from global\");"}' \
  http://localhost:8081/api/v1/admin/custom-js/global | jq .

# Serve global JS (no auth)
curl -s http://localhost:8081/api/v1/custom-js/global.js

# App JS
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/api/v1/apps/some-app-id/custom-js | jq .
curl -s http://localhost:8081/api/v1/custom-js/apps/some-app-id.js
```

Expected: 200 responses with code content

- [ ] **Step 5: Commit**

```bash
git add php-app/app/Http/Controllers/CustomCodeController.php php-app/routes/api.php php-app/custom/global.js php-app/custom/apps/.gitkeep
git commit -m "feat: add custom JS read/write and serving API"
```

---

### Task 3: Frontend — Monaco Editor パッケージ追加 + API関数 + 共通コンポーネント

**Files:**
- Create: `frontend/features/customize/api.ts`
- Create: `frontend/features/customize/components/CodeEditor.tsx`
- Create: `frontend/features/customize/components/PhpHookReference.tsx`

- [ ] **Step 1: Install @monaco-editor/react**

```bash
cd frontend && npm install @monaco-editor/react
```

- [ ] **Step 2: Create API functions**

Create `frontend/features/customize/api.ts`:

```typescript
import { api } from '@/lib/axios';

export async function getCustomPhp(): Promise<string> {
    const { data } = await api.get('/admin/custom-php');
    return data.code;
}

export async function updateCustomPhp(code: string): Promise<void> {
    await api.put('/admin/custom-php', { code });
}

export async function getGlobalJs(): Promise<string> {
    const { data } = await api.get('/admin/custom-js/global');
    return data.code;
}

export async function updateGlobalJs(code: string): Promise<void> {
    await api.put('/admin/custom-js/global', { code });
}

export async function getAppJs(appId: string): Promise<string> {
    const { data } = await api.get(`/apps/${appId}/custom-js`);
    return data.code;
}

export async function updateAppJs(appId: string, code: string): Promise<void> {
    await api.put(`/apps/${appId}/custom-js`, { code });
}
```

- [ ] **Step 3: Create CodeEditor component**

Create `frontend/features/customize/components/CodeEditor.tsx`:

```tsx
'use client';

import Editor from '@monaco-editor/react';

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    language: 'php' | 'javascript';
    height?: string;
}

export function CodeEditor({ value, onChange, language, height = '500px' }: CodeEditorProps) {
    return (
        <Editor
            height={height}
            language={language}
            value={value}
            onChange={(val) => onChange(val ?? '')}
            theme="vs-dark"
            options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 4,
            }}
        />
    );
}
```

- [ ] **Step 4: Create PhpHookReference component**

Create `frontend/features/customize/components/PhpHookReference.tsx`:

```tsx
'use client';

const hooks = [
    { name: 'record.created', args: '$record, $user', desc: 'レコード作成時' },
    { name: 'record.updated', args: '$record, $user', desc: 'レコード更新時' },
    { name: 'record.deleted', args: '$record, $user', desc: 'レコード削除時' },
    { name: 'record.status.changed', args: '$record, $oldStatus, $newStatus, $user', desc: 'ステータス変更時' },
    { name: 'record.comment.created', args: '$comment, $record, $user', desc: 'コメント追加時' },
    { name: 'app.created', args: '$app, $user', desc: 'アプリ作成時' },
    { name: 'app.updated', args: '$app, $user', desc: 'アプリ更新時' },
    { name: 'app.deleted', args: '$app, $user', desc: 'アプリ削除時' },
    { name: 'auth.login.success', args: '$user', desc: 'ログイン成功時' },
    { name: 'auth.login.failed', args: '$email', desc: 'ログイン失敗時' },
    { name: 'auth.signup', args: '$user', desc: 'サインアップ時' },
];

export function PhpHookReference() {
    return (
        <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">利用可能なフック</h3>
            <div className="space-y-2 text-sm">
                {hooks.map((hook) => (
                    <div key={hook.name} className="flex flex-col gap-0.5">
                        <code className="text-blue-600 dark:text-blue-400 font-mono text-xs">{hook.name}</code>
                        <span className="text-muted-foreground text-xs">
                            {hook.desc} — <code className="font-mono">{hook.args}</code>
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-4 p-3 bg-muted rounded text-xs font-mono whitespace-pre">{`add_action('record.created', function(\$record, \$user) {\n    // Webhook送信、メール通知など\n});`}</div>
        </div>
    );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/features/customize/
git commit -m "feat: add Monaco Editor components and customize API functions"
```

---

### Task 4: Frontend — PHPエディタページ

**Files:**
- Create: `frontend/app/admin/customize/php/page.tsx`
- Create: `frontend/app/admin/customize/php/PhpEditorClient.tsx`

- [ ] **Step 1: Create server component page**

Create `frontend/app/admin/customize/php/page.tsx`:

```tsx
import PhpEditorClient from './PhpEditorClient';

export function generateStaticParams() {
    return [{}];
}

export default function PhpEditorPage() {
    return <PhpEditorClient />;
}
```

- [ ] **Step 2: Create PhpEditorClient**

Create `frontend/app/admin/customize/php/PhpEditorClient.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import { getCurrentUser } from '@/features/users/api';
import { getCustomPhp, updateCustomPhp } from '@/features/customize/api';
import { CodeEditor } from '@/features/customize/components/CodeEditor';
import { PhpHookReference } from '@/features/customize/components/PhpHookReference';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function PhpEditorClient() {
    const { isAuthenticated } = useAuth();
    const [code, setCode] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    const { data: currentUser, isLoading: isUserLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: getCurrentUser,
        enabled: isAuthenticated,
        retry: false,
    });

    const { isLoading: isCodeLoading } = useQuery({
        queryKey: ['customPhp'],
        queryFn: getCustomPhp,
        enabled: !!currentUser?.is_superuser,
        onSuccess: (data: string) => {
            setCode(data);
        },
    });

    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: () => updateCustomPhp(code),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customPhp'] });
            setHasChanges(false);
            toast.success('PHPコードを保存しました');
        },
        onError: () => {
            toast.error('保存に失敗しました');
        },
    });

    if (isUserLoading) return <div>読み込み中...</div>;
    if (!currentUser?.is_superuser) {
        return <div className="text-destructive p-4">管理者権限が必要です。</div>;
    }

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">PHPカスタマイズ</h1>
                    <p className="text-muted-foreground mt-1">
                        custom/functions.php を編集します。サーバーサイドのフック処理を記述できます。
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/admin/customize/js">JavaScript</Link>
                    </Button>
                    <Button
                        onClick={() => mutation.mutate()}
                        disabled={!hasChanges || mutation.isPending}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        {mutation.isPending ? '保存中...' : '保存'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 border rounded-lg overflow-hidden">
                    {isCodeLoading ? (
                        <div className="h-[500px] flex items-center justify-center">読み込み中...</div>
                    ) : (
                        <CodeEditor
                            value={code}
                            onChange={(val) => {
                                setCode(val);
                                setHasChanges(true);
                            }}
                            language="php"
                        />
                    )}
                </div>
                <div className="lg:col-span-1">
                    <PhpHookReference />
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Verify page loads in browser**

Navigate to `http://localhost:8081/admin/customize/php/` as superuser. Should see Monaco Editor with PHP code and hook reference sidebar.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/admin/customize/php/
git commit -m "feat: add PHP customization editor page"
```

---

### Task 5: Frontend — グローバルJSエディタページ

**Files:**
- Create: `frontend/app/admin/customize/js/page.tsx`
- Create: `frontend/app/admin/customize/js/JsEditorClient.tsx`

- [ ] **Step 1: Create server component page**

Create `frontend/app/admin/customize/js/page.tsx`:

```tsx
import JsEditorClient from './JsEditorClient';

export function generateStaticParams() {
    return [{}];
}

export default function JsEditorPage() {
    return <JsEditorClient />;
}
```

- [ ] **Step 2: Create JsEditorClient**

Create `frontend/app/admin/customize/js/JsEditorClient.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import { getCurrentUser } from '@/features/users/api';
import { getGlobalJs, updateGlobalJs } from '@/features/customize/api';
import { CodeEditor } from '@/features/customize/components/CodeEditor';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function JsEditorClient() {
    const { isAuthenticated } = useAuth();
    const [code, setCode] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    const { data: currentUser, isLoading: isUserLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: getCurrentUser,
        enabled: isAuthenticated,
        retry: false,
    });

    const { isLoading: isCodeLoading } = useQuery({
        queryKey: ['customGlobalJs'],
        queryFn: getGlobalJs,
        enabled: !!currentUser?.is_superuser,
        onSuccess: (data: string) => {
            setCode(data);
        },
    });

    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: () => updateGlobalJs(code),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customGlobalJs'] });
            setHasChanges(false);
            toast.success('JavaScriptコードを保存しました');
        },
        onError: () => {
            toast.error('保存に失敗しました');
        },
    });

    if (isUserLoading) return <div>読み込み中...</div>;
    if (!currentUser?.is_superuser) {
        return <div className="text-destructive p-4">管理者権限が必要です。</div>;
    }

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">JavaScriptカスタマイズ（グローバル）</h1>
                    <p className="text-muted-foreground mt-1">
                        全ページで実行されるJavaScriptを編集します。
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/admin/customize/php">PHP</Link>
                    </Button>
                    <Button
                        onClick={() => mutation.mutate()}
                        disabled={!hasChanges || mutation.isPending}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        {mutation.isPending ? '保存中...' : '保存'}
                    </Button>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                {isCodeLoading ? (
                    <div className="h-[500px] flex items-center justify-center">読み込み中...</div>
                ) : (
                    <CodeEditor
                        value={code}
                        onChange={(val) => {
                            setCode(val);
                            setHasChanges(true);
                        }}
                        language="javascript"
                    />
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Verify page loads in browser**

Navigate to `http://localhost:8081/admin/customize/js/` as superuser.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/admin/customize/js/
git commit -m "feat: add global JavaScript customization editor page"
```

---

### Task 6: Frontend — アプリ別JSエディタ（設定画面に追加）

**Files:**
- Create: `frontend/features/customize/components/AppJsEditor.tsx`
- Modify: `frontend/app/apps/[id]/settings/SettingsPageClient.tsx`

- [ ] **Step 1: Create AppJsEditor component**

Create `frontend/features/customize/components/AppJsEditor.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAppJs, updateAppJs } from '@/features/customize/api';
import { CodeEditor } from './CodeEditor';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

interface AppJsEditorProps {
    appId: string;
}

export function AppJsEditor({ appId }: AppJsEditorProps) {
    const [code, setCode] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    const { isLoading } = useQuery({
        queryKey: ['customAppJs', appId],
        queryFn: () => getAppJs(appId),
        enabled: !!appId,
        onSuccess: (data: string) => {
            setCode(data);
        },
    });

    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: () => updateAppJs(appId, code),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customAppJs', appId] });
            setHasChanges(false);
            toast.success('JavaScriptコードを保存しました');
        },
        onError: () => {
            toast.error('保存に失敗しました');
        },
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="font-semibold">JavaScriptカスタマイズ</h2>
                    <p className="text-sm text-muted-foreground">このアプリのページでのみ実行されるJavaScriptを編集します。</p>
                </div>
                <Button
                    onClick={() => mutation.mutate()}
                    disabled={!hasChanges || mutation.isPending}
                    size="sm"
                >
                    <Save className="mr-2 h-4 w-4" />
                    {mutation.isPending ? '保存中...' : '保存'}
                </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
                {isLoading ? (
                    <div className="h-[400px] flex items-center justify-center">読み込み中...</div>
                ) : (
                    <CodeEditor
                        value={code}
                        onChange={(val) => {
                            setCode(val);
                            setHasChanges(true);
                        }}
                        language="javascript"
                        height="400px"
                    />
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Add JavaScript section to SettingsPageClient**

In `frontend/app/apps/[id]/settings/SettingsPageClient.tsx`, add the import:

```tsx
import { AppJsEditor } from '@/features/customize/components/AppJsEditor';
```

Add this block after the FormBuilder section (after the closing `</div>` at line 82), inside the `canManage` grid:

```tsx
<AppJsEditor appId={appId} />
```

- [ ] **Step 3: Verify in browser**

Navigate to an app's settings page. Should see the JavaScript editor at the bottom.

- [ ] **Step 4: Commit**

```bash
git add frontend/features/customize/components/AppJsEditor.tsx frontend/app/apps/\[id\]/settings/SettingsPageClient.tsx
git commit -m "feat: add per-app JavaScript editor to app settings"
```

---

### Task 7: Frontend — カスタムJS読み込み（CustomScriptLoader）

**Files:**
- Create: `frontend/components/providers/CustomScriptLoader.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create CustomScriptLoader**

Create `frontend/components/providers/CustomScriptLoader.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function getApiBase(): string {
    return process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ?? '';
}

export function CustomScriptLoader() {
    const pathname = usePathname();

    // グローバルJS読み込み
    useEffect(() => {
        const script = document.createElement('script');
        script.src = `${getApiBase()}/api/v1/custom-js/global.js?t=${Date.now()}`;
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    // アプリ別JS読み込み
    useEffect(() => {
        const match = pathname.match(/^\/apps\/([^/]+)/);
        if (!match) return;

        const appId = match[1];
        if (appId === '_') return; // placeholder route

        const script = document.createElement('script');
        script.src = `${getApiBase()}/api/v1/custom-js/apps/${appId}.js?t=${Date.now()}`;
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, [pathname]);

    return null;
}
```

- [ ] **Step 2: Add CustomScriptLoader to layout.tsx**

In `frontend/app/layout.tsx`, add import:

```tsx
import { CustomScriptLoader } from '@/components/providers/CustomScriptLoader';
```

Add `<CustomScriptLoader />` inside the providers, after `<Toaster />`:

```tsx
<Toaster />
<CustomScriptLoader />
```

- [ ] **Step 3: Test end-to-end**

1. Save `console.log('global JS loaded!');` via the global JS editor
2. Open browser console on any page — should see the message
3. Save `console.log('app JS loaded for app:', window.location.pathname);` via an app's JS editor
4. Navigate to that app page — should see the app-specific message

- [ ] **Step 4: Commit**

```bash
git add frontend/components/providers/CustomScriptLoader.tsx frontend/app/layout.tsx
git commit -m "feat: add CustomScriptLoader for global and per-app JS execution"
```

---

### Task 8: Frontend — Navbar にカスタマイズリンク追加

**Files:**
- Modify: `frontend/components/layout/Navbar.tsx`

- [ ] **Step 1: Add customize link to admin nav**

In `frontend/components/layout/Navbar.tsx`, add a new link inside the `{isAdmin && ( ... )}` block, after the システム設定 link:

```tsx
<Link href="/admin/customize/php" className="text-sm font-medium transition-colors hover:text-primary">
    カスタマイズ
</Link>
```

- [ ] **Step 2: Verify in browser**

Login as superuser, confirm "カスタマイズ" link appears in navbar and navigates to the PHP editor.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/layout/Navbar.tsx
git commit -m "feat: add customize link to admin navbar"
```

---

### Task 9: Static Export 対応 + .htaccess ルーティング

**Files:**
- Modify: `php-app/.htaccess` (or `php-app/public/.htaccess` — whichever handles SPA routing)

- [ ] **Step 1: Check current .htaccess and add rewrite rules for customize pages**

The static export generates pages at:
- `/admin/customize/php/index.html`
- `/admin/customize/js/index.html`

Following the existing pattern (MEMORY.md), add rewrite rules for the new admin pages. Since these are not dynamic routes (no `[id]` param), Next.js static export should generate them directly — no extra rewrite rules needed.

Verify by checking the build output:
```bash
cd frontend && npm run build
ls -la out/admin/customize/php/
ls -la out/admin/customize/js/
```

Expected: `index.html` files exist in both directories.

- [ ] **Step 2: Commit (if changes needed)**

```bash
git commit -m "fix: ensure static export routing for customize pages"
```

---

### Task 10: 動作確認 + 最終コミット

- [ ] **Step 1: End-to-end test — PHP editor**

1. Login as superuser
2. Navigate to カスタマイズ (navbar link)
3. See PHP editor with current `custom/functions.php` content
4. Edit code, click 保存
5. Verify file changed on disk: `docker exec php-app-app-1 cat /var/www/html/custom/functions.php`

- [ ] **Step 2: End-to-end test — Global JS editor**

1. Navigate to JavaScript editor (link from PHP editor page)
2. Type `console.log('custom global JS works!');`
3. Click 保存
4. Navigate to any page, open browser console
5. Verify message appears

- [ ] **Step 3: End-to-end test — App JS editor**

1. Navigate to an app's settings page
2. Scroll to JavaScript section
3. Type `console.log('app-specific JS for:', document.title);`
4. Click 保存
5. Navigate to the app page, open browser console
6. Verify message appears

- [ ] **Step 4: End-to-end test — Permission check**

1. Login as non-superuser
2. Navigate to `/admin/customize/php/`
3. Should see "管理者権限が必要です" message
4. API call `GET /api/v1/admin/custom-php` without superuser should return 403

- [ ] **Step 5: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "feat: complete custom code editors for PHP and JavaScript"
```
