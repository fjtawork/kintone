'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, GripVertical } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePinnedApps, useUpdatePinnedApps, type PinnedApp } from '../api/usePinnedApps';
import { getIconComponent } from './IconPicker';

export const PinnedApps = () => {
    const { data: pinnedApps, isLoading } = usePinnedApps();
    const { mutate: updatePinned } = useUpdatePinnedApps();
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [items, setItems] = useState<PinnedApp[] | null>(null);

    // サーバーデータが変わったらローカル状態をリセット
    const displayItems = items ?? pinnedApps ?? [];

    if (isLoading) {
        return (
            <div className="flex gap-3 flex-wrap">
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-[72px] w-[180px] rounded-xl" />
                ))}
            </div>
        );
    }

    if (displayItems.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                よく使うアプリのカードにある <Star className="inline h-3 w-3" /> をクリックしてピン留めできます。
            </p>
        );
    }

    const handleDragStart = (index: number) => {
        setDragIndex(index);
        if (!items) setItems([...displayItems]);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        const next = [...displayItems];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(index, 0, moved);
        setItems(next);
        setDragIndex(index);
    };

    const handleDrop = () => {
        if (!items) return;
        updatePinned(items.map((a) => a.id));
        setDragIndex(null);
    };

    return (
        <div className="flex gap-3 flex-wrap">
            {displayItems.map((app, i) => {
                const Icon = getIconComponent(app.icon);
                return (
                    <div
                        key={app.id}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDrop={handleDrop}
                        onDragEnd={() => { setDragIndex(null); setItems(null); }}
                        className={`relative group ${dragIndex === i ? 'opacity-50' : ''}`}
                    >
                        <Link href={`/apps/${app.id}`}>
                            <Card
                                className="cursor-pointer hover:shadow-md transition-shadow border-t-4 w-[180px]"
                                style={{ borderTopColor: app.theme || '#e5e7eb' }}
                            >
                                <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3">
                                    <div className="p-1.5 rounded-md bg-secondary" style={{ color: app.theme || 'inherit' }}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <CardTitle className="text-sm font-medium line-clamp-2 flex-1">{app.name}</CardTitle>
                                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
                                </CardHeader>
                            </Card>
                        </Link>
                    </div>
                );
            })}
        </div>
    );
};
