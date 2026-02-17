'use client';

import Link from 'next/link';

import { useApps } from '../api/useApps';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateAppDialog } from './CreateAppDialog';
import { getIconComponent } from './IconPicker';

export const AppList = () => {
    const { data: apps, isLoading, error } = useApps();

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
