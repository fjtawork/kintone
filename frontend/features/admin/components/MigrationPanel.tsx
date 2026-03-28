'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MigrationStatus {
    applied_count: number;
    pending_count: number;
    pending: Array<{ version: string; description: string }>;
}

export function MigrationPanel() {
    const queryClient = useQueryClient();

    const { data: status, isLoading } = useQuery<MigrationStatus>({
        queryKey: ['migrationStatus'],
        queryFn: async () => {
            const { data } = await api.get('/admin/migrations');
            return data;
        },
    });

    const mutation = useMutation({
        mutationFn: async () => {
            const { data } = await api.post('/admin/migrations');
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['migrationStatus'] });
            toast.success(data.message);
        },
        onError: () => {
            toast.error('マイグレーションの実行に失敗しました');
        },
    });

    if (isLoading) return <div>読み込み中...</div>;

    return (
        <div>
            <h3 className="text-lg font-semibold mb-4">データベースマイグレーション</h3>
            <p className="text-sm text-muted-foreground mb-6">
                アプリケーションのバージョンアップ時にデータベースの構造を更新します。
            </p>

            <div className="flex items-center gap-3 mb-6">
                {status?.pending_count === 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">最新の状態です</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">
                            {status?.pending_count} 件の未適用マイグレーションがあります
                        </span>
                    </div>
                )}
            </div>

            <div className="text-sm text-muted-foreground mb-4">
                適用済み: {status?.applied_count ?? 0} 件
            </div>

            {status?.pending && status.pending.length > 0 && (
                <div className="mb-6">
                    <h4 className="text-sm font-medium mb-2">未適用のマイグレーション:</h4>
                    <ul className="space-y-1">
                        {status.pending.map((m) => (
                            <li key={m.version} className="text-sm flex items-center gap-2">
                                <ArrowUpCircle className="h-4 w-4 text-amber-500" />
                                <code className="font-mono text-xs">{m.version}</code>
                                <span className="text-muted-foreground">{m.description}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {status?.pending_count !== undefined && status.pending_count > 0 && (
                <Button
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                >
                    {mutation.isPending ? '実行中...' : 'マイグレーションを実行'}
                </Button>
            )}
        </div>
    );
}
