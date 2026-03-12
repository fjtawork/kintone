'use client';

import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/features/users/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppList } from '@/features/apps/components/AppList';
import { PinnedApps } from '@/features/apps/components/PinnedApps';
import { AnnouncementBoard } from '@/features/announcements/components/AnnouncementBoard';
import { DashboardLayoutEditor } from '@/features/dashboard/DashboardLayoutEditor';
import { useDashboardLayout } from '@/features/dashboard/useDashboardLayout';
import { Bell, Star } from 'lucide-react';

export default function DashboardPageClient() {
    const { isAuthenticated } = useAuth();

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: getCurrentUser,
        enabled: isAuthenticated,
        retry: false,
    });

    const isAdmin = currentUser?.is_superuser ?? false;
    const { sections, loaded, toggleVisible, moveUp, moveDown } = useDashboardLayout();

    if (!loaded) return null;

    const renderSection = (key: string) => {
        switch (key) {
            case 'announcements':
                return (
                    <section key="announcements">
                        <div className="flex items-center gap-2 mb-3">
                            <Bell className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-lg font-semibold">お知らせ</h2>
                        </div>
                        <AnnouncementBoard isAdmin={isAdmin} />
                    </section>
                );
            case 'pinned':
                return (
                    <section key="pinned">
                        <div className="flex items-center gap-2 mb-3">
                            <Star className="h-5 w-5 text-amber-400" />
                            <h2 className="text-lg font-semibold">よく使うアプリ</h2>
                        </div>
                        <PinnedApps />
                    </section>
                );
            case 'apps':
                return (
                    <section key="apps">
                        <AppList />
                    </section>
                );
            default:
                return null;
        }
    };

    return (
        <div className="container mx-auto py-6 px-4 space-y-8">
            <div className="flex justify-end">
                <DashboardLayoutEditor
                    sections={sections}
                    onToggle={toggleVisible}
                    onMoveUp={moveUp}
                    onMoveDown={moveDown}
                />
            </div>
            {sections.filter((s) => s.visible).map((s) => renderSection(s.key))}
        </div>
    );
}
