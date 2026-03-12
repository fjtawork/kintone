'use client';

import { useState } from 'react';
import { Settings, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { type SectionConfig, type SectionKey } from './useDashboardLayout';

interface Props {
    sections: SectionConfig[];
    onToggle: (key: SectionKey) => void;
    onMoveUp: (key: SectionKey) => void;
    onMoveDown: (key: SectionKey) => void;
}

export const DashboardLayoutEditor = ({ sections, onToggle, onMoveUp, onMoveDown }: Props) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" title="ダッシュボード設定">
                    <Settings className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
                <p className="text-sm font-semibold mb-2">セクション設定</p>
                <div className="space-y-1">
                    {sections.map((s, i) => (
                        <div key={s.key} className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => onToggle(s.key)}
                                title={s.visible ? '非表示にする' : '表示する'}
                            >
                                {s.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                            </Button>
                            <span className={`flex-1 text-sm ${!s.visible ? 'text-muted-foreground' : ''}`}>{s.label}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => onMoveUp(s.key)}
                                disabled={i === 0}
                            >
                                <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => onMoveDown(s.key)}
                                disabled={i === sections.length - 1}
                            >
                                <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};
