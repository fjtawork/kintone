'use client';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useState } from 'react';

const COLORS = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Lime', value: '#84cc16' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Violet', value: '#8b5cf6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Fuchsia', value: '#d946ef' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Slate', value: '#64748b' },
];

interface ColorPickerProps {
    value?: string;
    onChange: (color: string) => void;
}

export const ColorPicker = ({ value, onChange }: ColorPickerProps) => {
    const [open, setOpen] = useState(false);
    const selectedColor = COLORS.find(c => c.value === value)?.value || value || '#3b82f6';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="w-full justify-start pl-3 text-left font-normal"
                >
                    <div
                        className="mr-2 h-4 w-4 rounded-full border"
                        style={{ backgroundColor: selectedColor }}
                    />
                    {COLORS.find(c => c.value === value)?.name || 'Custom'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-3" align="start">
                <div className="grid grid-cols-6 gap-2">
                    {COLORS.map((color) => (
                        <button
                            key={color.value}
                            className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center border transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2",
                                value === color.value && "ring-2 ring-offset-2 ring-black dark:ring-white"
                            )}
                            style={{ backgroundColor: color.value }}
                            onClick={() => {
                                onChange(color.value);
                                setOpen(false);
                            }}
                        >
                            {value === color.value && <Check className="h-4 w-4 text-white drop-shadow-md" />}
                            <span className="sr-only">{color.name}</span>
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};
