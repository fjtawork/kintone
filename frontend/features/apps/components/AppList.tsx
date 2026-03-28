'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';

import { useApps } from '../api/useApps';
import { usePinnedApps, useUpdatePinnedApps } from '../api/usePinnedApps';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateAppDialog } from './CreateAppDialog';
import { getIconComponent } from './IconPicker';

export const AppList = () => {
    const { data: apps, isLoading, error } = useApps();
    const { data: pinnedApps = [] } = usePinnedApps();
    const { mutate: updatePinned } = useUpdatePinnedApps();

    const pinnedIds = pinnedApps.map((a) => a.id);

    const togglePin = (e: React.MouseEvent, appId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const isPinned = pinnedIds.includes(appId);
        const next = isPinned
            ? pinnedIds.filter((id: string) => id !== appId)
            : [...pinnedIds, appId];
        updatePinned(next);
    };

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
                ))}
            </div>
        )
    }

    // ... imports moved to top
    if (error) return <div className="text-red-500">アプリの読み込みに失敗しました。</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">アプリ</h2>
                <CreateAppDialog />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {apps?.map((app: any) => {
                    const Icon = getIconComponent(app.icon);
                    return (
                        <Link key={app.id} href={`/apps/${app.id}`}>
                            <Card
                                className="cursor-pointer hover:shadow-md transition-shadow h-full border-t-4"
                                style={{ borderTopColor: app.theme || '#e5e7eb' }}
                            >
                                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                                    <div
                                        className="p-2 rounded-lg bg-secondary"
                                        style={{ color: app.theme || 'inherit' }}
                                    >
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <CardTitle className="text-base font-semibold">{app.name}</CardTitle>
                                        <CardDescription className="line-clamp-2 mt-1">
                                            {app.description || "説明なし"}
                                        </CardDescription>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => togglePin(e, app.id)}
                                        className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                                        title={pinnedIds.includes(app.id) ? 'ピン留め解除' : 'ピン留め'}
                                    >
                                        <Star
                                            className={`h-4 w-4 ${pinnedIds.includes(app.id) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                                        />
                                    </button>
                                </CardHeader>
                            </Card>
                        </Link>
                    );
                })}
                {apps?.length === 0 && (
                    <div className="col-span-4 flex flex-col items-center justify-center p-10 border border-dashed rounded-lg text-gray-500">
                        <p>アプリが見つかりません。</p>
                        <p className="text-sm">新しいアプリを作成してください。</p>
                    </div>
                )}
            </div>
        </div>
    );
};
