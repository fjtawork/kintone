'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, AlertTriangle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
    useIpAllowlist,
    useCreateIpEntry,
    useToggleIpEntry,
    useDeleteIpEntry,
} from '../api/useIpAllowlist';
import { useSystemSettings, useUpdateSystemSettings } from '../api/useSystemSettings';
import { Skeleton } from '@/components/ui/skeleton';

export const IpAllowlistPanel = () => {
    const { data: settings, isLoading: isSettingsLoading } = useSystemSettings();
    const { data: entries, isLoading: isListLoading } = useIpAllowlist();
    const { mutate: updateSettings } = useUpdateSystemSettings();
    const { mutate: createEntry, isPending: isCreating } = useCreateIpEntry();
    const { mutate: toggleEntry } = useToggleIpEntry();
    const { mutate: deleteEntry } = useDeleteIpEntry();

    const [newLabel, setNewLabel] = useState('');
    const [newCidr, setNewCidr] = useState('');

    const isRestrictionEnabled = settings?.ip_restriction_enabled ?? false;

    const handleToggleRestriction = (enabled: boolean) => {
        if (enabled && (!entries || entries.length === 0)) {
            toast.error('IPアドレスを1件以上登録してから有効にしてください');
            return;
        }
        updateSettings(
            { ip_restriction_enabled: enabled },
            {
                onSuccess: () => toast.success(enabled ? 'IP制限を有効にしました' : 'IP制限を無効にしました'),
                onError: () => toast.error('設定の変更に失敗しました'),
            }
        );
    };

    const handleAdd = () => {
        if (!newLabel.trim() || !newCidr.trim()) {
            toast.error('ラベルとIPアドレスを入力してください');
            return;
        }
        createEntry(
            { label: newLabel.trim(), cidr: newCidr.trim() },
            {
                onSuccess: () => {
                    setNewLabel('');
                    setNewCidr('');
                    toast.success('IPアドレスを追加しました');
                },
                onError: (err: any) => {
                    const msg = err?.response?.data?.message || '追加に失敗しました';
                    toast.error(msg);
                },
            }
        );
    };

    const handleDelete = (id: string, label: string) => {
        if (!confirm(`「${label}」を削除しますか？`)) return;
        deleteEntry(id, {
            onSuccess: () => toast.success('削除しました'),
            onError: () => toast.error('削除に失敗しました'),
        });
    };

    if (isSettingsLoading || isListLoading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            {/* IP制限トグル */}
            <div className="flex items-start justify-between p-4 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-3">
                    <Shield className={`h-5 w-5 mt-0.5 ${isRestrictionEnabled ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    <div>
                        <p className="font-medium text-sm">IP制限を有効にする</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            有効にすると、許可リスト外のIPからのアクセスをブロックします。
                            管理者は常に許可されます。
                        </p>
                        {isRestrictionEnabled && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>現在IP制限が有効です。許可リストを正しく設定してください。</span>
                            </div>
                        )}
                    </div>
                </div>
                <Switch
                    checked={isRestrictionEnabled}
                    onCheckedChange={handleToggleRestriction}
                />
            </div>

            {/* IPアドレス追加フォーム */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium">IPアドレスを追加</h3>
                <div className="flex gap-2 flex-wrap">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">ラベル</Label>
                        <Input
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="社内ネットワーク"
                            className="w-44"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">CIDR / IPアドレス</Label>
                        <Input
                            value={newCidr}
                            onChange={(e) => setNewCidr(e.target.value)}
                            placeholder="192.168.0.0/24"
                            className="w-48"
                        />
                    </div>
                    <div className="flex items-end">
                        <Button onClick={handleAdd} disabled={isCreating} size="default">
                            <Plus className="mr-2 h-4 w-4" />
                            追加
                        </Button>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    例: <code className="bg-muted px-1 rounded">192.168.1.0/24</code>（サブネット）、
                    <code className="bg-muted px-1 rounded ml-1">203.0.113.5</code>（単一IP = /32扱い）
                </p>
            </div>

            {/* IPリスト */}
            <div className="space-y-2">
                <h3 className="text-sm font-medium">許可リスト ({entries?.length ?? 0}件)</h3>
                {(!entries || entries.length === 0) ? (
                    <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                        まだIPアドレスが登録されていません
                    </p>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left px-4 py-2 font-medium">ラベル</th>
                                    <th className="text-left px-4 py-2 font-medium">CIDR</th>
                                    <th className="text-left px-4 py-2 font-medium">状態</th>
                                    <th className="px-4 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-muted/30">
                                        <td className="px-4 py-2.5">{entry.label}</td>
                                        <td className="px-4 py-2.5">
                                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{entry.cidr}</code>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <button
                                                type="button"
                                                onClick={() => toggleEntry({ id: entry.id, is_active: !entry.is_active })}
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                                                    entry.is_active
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                                                }`}
                                            >
                                                {entry.is_active ? '有効' : '無効'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(entry.id, entry.label)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
