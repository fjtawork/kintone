'use client';

import {
    Layout,
    Database,
    Table,
    List,
    FileText,
    BarChart,
    PieChart,
    Settings,
    Users,
    Calendar,
    Clock,
    CheckSquare,
    MessageSquare,
    Mail,
    Phone,
    Map,
    Briefcase,
    Folder,
    Archive,
    Star,
    Heart,
    Zap,
    Flag,
    Bookmark
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const ICONS = [
    { name: 'Layout', icon: Layout },
    { name: 'Database', icon: Database },
    { name: 'Table', icon: Table },
    { name: 'List', icon: List },
    { name: 'FileText', icon: FileText },
    { name: 'BarChart', icon: BarChart },
    { name: 'PieChart', icon: PieChart },
    { name: 'Settings', icon: Settings },
    { name: 'Users', icon: Users },
    { name: 'Calendar', icon: Calendar },
    { name: 'Clock', icon: Clock },
    { name: 'CheckSquare', icon: CheckSquare },
    { name: 'MessageSquare', icon: MessageSquare },
    { name: 'Mail', icon: Mail },
    { name: 'Phone', icon: Phone },
    { name: 'Map', icon: Map },
    { name: 'Briefcase', icon: Briefcase },
    { name: 'Folder', icon: Folder },
    { name: 'Archive', icon: Archive },
    { name: 'Star', icon: Star },
    { name: 'Heart', icon: Heart },
    { name: 'Zap', icon: Zap },
    { name: 'Flag', icon: Flag },
    { name: 'Bookmark', icon: Bookmark },
];

interface IconPickerProps {
    value?: string;
    onChange: (iconName: string) => void;
}

export const IconPicker = ({ value, onChange }: IconPickerProps) => {
    const [open, setOpen] = useState(false);
    const SelectedIcon = ICONS.find(i => i.name === value)?.icon || Layout;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start pl-3 text-left font-normal">
                    <SelectedIcon className="mr-2 h-4 w-4" />
                    {value || "アイコンを選択"}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-2" align="start">
                <ScrollArea className="h-[200px]">
                    <div className="grid grid-cols-6 gap-2">
                        {ICONS.map((item) => (
                            <Button
                                key={item.name}
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-10 w-10 p-0",
                                    value === item.name && "bg-accent text-accent-foreground"
                                )}
                                onClick={() => {
                                    onChange(item.name);
                                    setOpen(false);
                                }}
                            >
                                <item.icon className="h-6 w-6" />
                                <span className="sr-only">{item.name}</span>
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
};

export const getIconComponent = (iconName?: string) => {
    return ICONS.find(i => i.name === iconName)?.icon || Layout;
};
