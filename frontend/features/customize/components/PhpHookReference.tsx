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
            <div className="mt-4 p-3 bg-muted rounded text-xs font-mono whitespace-pre">{`add_action('record.created', function($record, $user) {\n    // Webhook送信、メール通知など\n});`}</div>
        </div>
    );
}
