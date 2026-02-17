'use client';

import { useDraggable } from '@dnd-kit/core';
import { FIELD_TYPES, FieldType } from '../types';
import { Type, AlignLeft, Hash, Calendar, CheckSquare, CircleDot, ChevronDown, GripVertical, Clock, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, any> = {
    Type,
    AlignLeft,
    Hash,
    Calendar,
    Clock,
    Paperclip,
    CheckSquare,
    CircleDot,
    ChevronDown,
};

export const ToolboxItem = ({ type, label, icon }: { type: FieldType; label: string; icon: string }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `toolbox-${type}`,
        data: {
            type,
            isToolboxItem: true,
        },
    });

    const IconComponent = iconMap[icon];

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={style}
            className={cn(
                "flex items-center gap-3 p-3 mb-2 rounded-md border border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-800 cursor-grab hover:border-blue-500 hover:shadow-sm transition-all select-none",
                transform && "opacity-50"
            )}
        >
            <GripVertical className="h-4 w-4 text-zinc-400" />
            <div className="flex items-center gap-2">
                {IconComponent && <IconComponent className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />}
                <span className="text-sm font-medium">{label}</span>
            </div>
        </div>
    );
};

export const Toolbox = () => {
    return (
        <div className="p-4">
            <h2 className="font-semibold mb-4 text-sm text-zinc-700 dark:text-zinc-300">フォーム部品</h2>
            {FIELD_TYPES.map((field) => (
                <ToolboxItem key={field.type} {...field} />
            ))}
        </div>
    );
};
