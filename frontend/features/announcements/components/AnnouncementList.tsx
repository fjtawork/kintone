'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pin, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAnnouncements, useDeleteAnnouncement, type Announcement } from '../api/useAnnouncements';
import { AnnouncementEditor } from './AnnouncementEditor';

interface AnnouncementListProps {
    isAdmin: boolean;
}

export const AnnouncementList = ({ isAdmin }: AnnouncementListProps) => {
    const { data: announcements, isLoading } = useAnnouncements();
    const { mutate: deleteAnnouncement } = useDeleteAnnouncement();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDelete = (item: Announcement) => {
        if (!confirm(`「${item.title}」を削除しますか？`)) return;
        deleteAnnouncement(item.id, {
            onSuccess: () => toast.success('お知らせを削除しました'),
            onError: () => toast.error('削除に失敗しました'),
        });
    };

    if (isLoading) return <div className="text-sm text-muted-foreground">読み込み中...</div>;
    if (!announcements || announcements.length === 0) {
        if (!isAdmin) return null;
        return <p className="text-sm text-muted-foreground">お知らせはありません。</p>;
    }

    return (
        <div className="space-y-2">
            {announcements.map((item) => {
                const isExpanded = expandedIds.has(item.id);
                const bodyLines = item.body.split('\n');
                const isLong = bodyLines.length > 3 || item.body.length > 120;

                return (
                    <div
                        key={item.id}
                        className="border rounded-lg p-4 bg-white dark:bg-zinc-950 shadow-sm"
                    >
                        <div className="flex items-start gap-2">
                            {item.is_pinned && (
                                <Pin className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <p className="font-medium text-sm">{item.title}</p>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        {format(new Date(item.created_at), 'yyyy-MM-dd')}
                                    </span>
                                </div>
                                <div className={`mt-1 text-sm text-muted-foreground whitespace-pre-wrap ${!isExpanded && isLong ? 'line-clamp-3' : ''}`}>
                                    {item.body}
                                </div>
                                {isLong && (
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(item.id)}
                                        className="mt-1 text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                                    >
                                        {isExpanded ? (
                                            <><ChevronUp className="h-3 w-3" />閉じる</>
                                        ) : (
                                            <><ChevronDown className="h-3 w-3" />続きを読む</>
                                        )}
                                    </button>
                                )}
                            </div>
                            {isAdmin && (
                                <div className="flex gap-1 shrink-0">
                                    <AnnouncementEditor editing={item} />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(item)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
