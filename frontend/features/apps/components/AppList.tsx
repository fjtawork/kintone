'use client';

import { useApps } from '../api/useApps';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateAppDialog } from './CreateAppDialog';

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

    if (error) return <div className="text-red-500">Failed to load apps.</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Apps</h2>
                <CreateAppDialog />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {apps?.map((app) => (
                    <Card key={app.id} className="cursor-pointer hover:shadow-md transition-shadow border-zinc-200 dark:border-zinc-800">
                        <CardHeader>
                            <CardTitle>{app.name}</CardTitle>
                            <CardDescription>{app.description || "No description"}</CardDescription>
                        </CardHeader>
                    </Card>
                ))}
                {apps?.length === 0 && (
                    <div className="col-span-4 flex flex-col items-center justify-center p-10 border border-dashed rounded-lg text-gray-500">
                        <p>No apps found.</p>
                        <p className="text-sm">Create one to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
