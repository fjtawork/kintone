'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    getNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    NotificationItem,
} from '../api';

const formatDateTime = (value: string) => {
    try {
        return new Date(value).toLocaleString('ja-JP');
    } catch {
        return value;
    }
};

export const NotificationBell = () => {
    const queryClient = useQueryClient();
    const { data } = useQuery({
        queryKey: ['notifications'],
        queryFn: getNotifications,
        refetchInterval: 15000,
    });

    const markReadMutation = useMutation({
        mutationFn: markNotificationRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const markAllMutation = useMutation({
        mutationFn: markAllNotificationsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const unreadCount = data?.unread_count || 0;
    const items = data?.items || [];

    const handleClickItem = (item: NotificationItem) => {
        if (!item.is_read) {
            markReadMutation.mutate(item.id);
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-red-600 text-white text-[10px] px-1 flex items-center justify-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="end">
                <div className="border-b p-3 flex items-center justify-between">
                    <p className="font-semibold text-sm">通知</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAllMutation.mutate()}
                        disabled={markAllMutation.isPending || unreadCount === 0}
                    >
                        すべて既読
                    </Button>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                    {items.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">通知はありません。</div>
                    )}
                    {items.map((item) => {
                        const content = (
                            <div
                                className={`p-3 border-b hover:bg-zinc-50 dark:hover:bg-zinc-900 ${!item.is_read ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
                                onClick={() => handleClickItem(item)}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium">{item.title}</p>
                                    {!item.is_read && <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{item.message}</p>
                                <p className="text-[11px] text-muted-foreground mt-2">{formatDateTime(item.created_at)}</p>
                            </div>
                        );

                        if (item.link_path) {
                            return (
                                <Link key={item.id} href={item.link_path}>
                                    {content}
                                </Link>
                            );
                        }
                        return <div key={item.id}>{content}</div>;
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
};
