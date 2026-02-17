'use client';

import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/features/users/api';
import { useApps } from '@/features/apps/api/useApps';
import { getDepartments, getJobTitles } from '@/features/organization/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export default function ProfilePage() {
    const {
        data: user,
        isLoading: isUserLoading,
        isError: isUserError
    } = useQuery({
        queryKey: ['currentUser'],
        queryFn: getCurrentUser,
        retry: 1
    });

    const {
        data: apps,
        isLoading: isAppsLoading
    } = useApps(
        user ? { created_by: user.id } : undefined
    );

    const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: getDepartments });
    const { data: jobTitles } = useQuery({ queryKey: ['jobTitles'], queryFn: getJobTitles });

    if (isUserLoading || (isAppsLoading && !apps)) {
        return <div className="container mx-auto py-8 px-4 space-y-4">
            <h1 className="text-xl font-bold mb-4">マイプロフィール</h1>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>;
    }

    if (isUserError) {
        return (
            <div className="container mx-auto py-8 px-4 text-red-500">
                <h2 className="font-bold">プロフィールの読み込みエラー</h2>
                <p>ユーザーデータの取得に失敗しました。ネットワーク接続またはログイン状態を確認してください。</p>
            </div>
        );
    }

    if (!user) {
        return <div className="container mx-auto py-8 px-4">ユーザーデータがありません。</div>;
    }

    const deptName = user.department_id
        ? departments?.find(d => d.id === user.department_id)?.name
        : '未所属';

    const titleName = user.job_title_id
        ? jobTitles?.find(t => t.id === user.job_title_id)?.name
        : '未設定';

    return (
        <div className="container mx-auto py-8 px-4 space-y-8">
            {/* Profile Header */}
            <div className="flex items-center gap-6 p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border">
                <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">
                        {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-2xl font-bold">{user.full_name || '名前未設定'}</h1>
                    <p className="text-muted-foreground">{user.email}</p>
                    <div className="flex gap-2 mt-2">
                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md text-xs font-medium">
                            {deptName}
                        </span>
                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md text-xs font-medium">
                            {titleName}
                        </span>
                        {user.is_superuser && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium">
                                管理者
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Created Apps */}
            <div>
                <h2 className="text-xl font-bold mb-4">作成したアプリ</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lp:grid-cols-3 gap-4">
                    {apps?.length === 0 ? (
                        <p className="text-muted-foreground col-span-full">まだ作成したアプリはありません。</p>
                    ) : (
                        apps?.map((app) => (
                            <Link key={app.id} href={`/apps/${app.id}`}>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">
                                            {app.name}
                                        </CardTitle>
                                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {app.description || '説明なし'}
                                        </p>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
