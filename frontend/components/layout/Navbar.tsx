'use client';

import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/features/users/api';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';

export const Navbar = () => {
    const { isAuthenticated, logout } = useAuth();
    const pathname = usePathname();

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: getCurrentUser,
        enabled: isAuthenticated,
        retry: false
    });

    const isAdmin = currentUser?.is_superuser;

    // Don't show navbar on login/signup pages to avoid clutter
    if (['/login', '/signup'].includes(pathname)) {
        return null;
    }

    return (
        <nav className="border-b bg-background">
            <div className="flex h-16 items-center px-4 container mx-auto justify-between">
                <div className="flex items-center space-x-4">
                    <Link href="/" className="font-bold text-xl">
                        kintone Clone
                    </Link>
                    {isAuthenticated && (
                        <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
                            アプリ
                        </Link>
                    )}
                    {isAdmin && (
                        <>
                            <Link href="/admin/users" className="text-sm font-medium transition-colors hover:text-primary">
                                ユーザー管理
                            </Link>
                            <Link href="/admin/organization" className="text-sm font-medium transition-colors hover:text-primary">
                                組織管理
                            </Link>
                        </>
                    )}
                </div>
                <div>
                    {isAuthenticated ? (
                        <div className="flex items-center gap-4">
                            <NotificationBell />
                            <span className="text-sm text-muted-foreground">{currentUser?.full_name || currentUser?.email}</span>
                            <Button asChild variant="ghost">
                                <Link href="/profile">プロフィール</Link>
                            </Button>
                            <Button variant="ghost" onClick={logout}>
                                ログアウト
                            </Button>
                        </div>
                    ) : (
                        <div className="space-x-2">
                            <Button asChild variant="ghost">
                                <Link href="/login">ログイン</Link>
                            </Button>
                            <Button asChild>
                                <Link href="/signup">新規登録</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};
