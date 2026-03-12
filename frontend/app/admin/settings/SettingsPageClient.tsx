'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import { getCurrentUser } from '@/features/users/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettingsPanel } from '@/features/admin/components/GeneralSettingsPanel';
import { IpAllowlistPanel } from '@/features/admin/components/IpAllowlistPanel';
import { Settings, Shield } from 'lucide-react';

export default function SettingsPageClient() {
    const { isAuthenticated } = useAuth();

    const { data: currentUser, isLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: getCurrentUser,
        enabled: isAuthenticated,
        retry: false,
    });

    if (isLoading) return <div>読み込み中...</div>;
    if (!currentUser?.is_superuser) {
        return <div className="text-destructive">管理者権限が必要です。</div>;
    }

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">システム設定</h1>
                <p className="text-muted-foreground mt-1">システム全体の設定を管理します。</p>
            </div>

            <Tabs defaultValue="general">
                <TabsList className="mb-6">
                    <TabsTrigger value="general" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        一般
                    </TabsTrigger>
                    <TabsTrigger value="ip" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        IP制限
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <div className="bg-white dark:bg-zinc-950 border rounded-lg p-6 shadow-sm">
                        <GeneralSettingsPanel />
                    </div>
                </TabsContent>

                <TabsContent value="ip">
                    <div className="bg-white dark:bg-zinc-950 border rounded-lg p-6 shadow-sm">
                        <IpAllowlistPanel />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
