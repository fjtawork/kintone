'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ProcessManagementSettings } from '@/features/apps/components/ProcessManagementSettings';
import { PermissionSettings } from '@/features/apps/components/PermissionSettings';
import { ListViewSettings } from '@/features/apps/components/ListViewSettings';
import { GeneralSettings } from '@/features/apps/components/GeneralSettings';

export default function AppSettingsPage() {
    const params = useParams();
    const appId = params.id as string;

    const { data: app, isLoading } = useQuery({
        queryKey: ['app', appId],
        queryFn: async () => {
            const { data } = await api.get(`/apps/${appId}`);
            return data;
        },
    });

    const { data: fields } = useQuery({
        queryKey: ['fields', appId],
        queryFn: async () => {
            const { data } = await api.get(`/fields/app/${appId}`);
            return data;
        },
        enabled: !!appId
    });

    if (isLoading) return <div>設定を読み込み中...</div>;

    const canManage = app?.user_permissions?.manage ?? false;

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="flex items-center gap-4 mb-8">
                <Link href={`/apps/${appId}`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">アプリ設定</h1>
                    <p className="text-muted-foreground">{app?.name}</p>
                </div>
            </div>

            {canManage ? (
                <div className="grid gap-8">
                    <GeneralSettings appId={appId} settings={app} />
                    <ProcessManagementSettings
                        appId={appId}
                        settings={app?.process_management}
                        fields={(fields || []).map((field: { code: string; label?: string; type?: string }) => ({
                            code: field.code,
                            label: field.label || field.code,
                            type: field.type,
                        }))}
                    />
                    <ListViewSettings appId={appId} fields={fields || []} settings={app?.view_settings} />
                    <PermissionSettings appId={appId} app={app} />

                    <div className="border p-4 rounded-md">
                        <h2 className="font-semibold mb-2">フォームビルダー</h2>
                        <p className="text-sm text-muted-foreground mb-4">フォームのレイアウトとフィールドを編集します。</p>
                        <Link href={`/apps/${appId}/builder`}>
                            <Button variant="outline">フォームビルダーを開く</Button>
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="p-4 border rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200">
                    <h2 className="font-semibold">アクセス権限がありません</h2>
                    <p>このアプリの設定を編集する権限がありません。</p>
                </div>
            )}
        </div>
    );
}
