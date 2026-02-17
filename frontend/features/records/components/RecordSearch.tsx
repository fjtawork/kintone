'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';
import { Field } from '../../app-builder/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface RecordSearchProps {
    fields: Field[];
    onSearch: (filters: Record<string, any>) => void;
}

export const RecordSearch = ({ fields, onSearch }: RecordSearchProps) => {
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [isOpen, setIsOpen] = useState(false);

    const handleFilterChange = (code: string, value: any) => {
        setFilters(prev => {
            const next = { ...prev, [code]: value };
            if (value === '' || value === null || value === undefined) {
                delete next[code];
            }
            return next;
        });
    };

    const handleApply = () => {
        onSearch(filters);
        setIsOpen(false);
    };

    const handleClear = () => {
        setFilters({});
        onSearch({});
        setIsOpen(false);
    };

    const renderFilterInput = (field: Field) => {
        const value = filters[field.code] || '';

        switch (field.type) {
            case 'SINGLE_LINE_TEXT':
            case 'MULTI_LINE_TEXT':
                return (
                    <Input
                        placeholder="検索..."
                        value={value}
                        onChange={(e) => handleFilterChange(field.code, e.target.value)}
                    />
                );
            case 'NUMBER':
                return (
                    <Input
                        type="number"
                        placeholder="数値を入力"
                        value={value}
                        onChange={(e) => handleFilterChange(field.code, e.target.value)}
                    />
                );
            case 'DROP_DOWN':
            case 'RADIO_BUTTON':
                return (
                    <Select value={value} onValueChange={(val) => handleFilterChange(field.code, val)}>
                        <SelectTrigger>
                            <SelectValue placeholder="すべて" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all_clear_option">すべて（解除）</SelectItem>
                            {field.options?.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case 'DATE':
            case 'DATETIME':
                // Search is hard for dates (range vs exact). 
                // For MVP, exact string match or simple text input might be easiest, but user likely wants DatePicker.
                // Let's us Input type="date"
                return (
                    <Input
                        type="date"
                        value={value}
                        onChange={(e) => handleFilterChange(field.code, e.target.value)}
                    />
                );
            // Ignore File, Checkbox for simple search unless requested. Checkbox could be select.
            case 'CHECKBOX':
                return (
                    <Select value={value} onValueChange={(val) => handleFilterChange(field.code, val === 'true')}>
                        <SelectTrigger>
                            <SelectValue placeholder="すべて" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all_clear_option">すべて</SelectItem>
                            <SelectItem value="true">チェックあり</SelectItem>
                            <SelectItem value="false">チェックなし</SelectItem>
                        </SelectContent>
                    </Select>
                );
            default:
                return null;
        }
    };

    // Filter out fields that are null/non-searchable if any
    const searchableFields = fields.filter(f => f.code);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    絞り込み
                    {Object.keys(filters).length > 0 && (
                        <span className="bg-blue-100 text-blue-700 rounded-full px-2 text-xs font-bold">
                            {Object.keys(filters).length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-[500px] overflow-y-auto" align="start">
                <div className="space-y-4">
                    <div className="font-medium text-sm border-b pb-2">レコード絞り込み</div>

                    {searchableFields.map(field => (
                        <div key={field.id} className="space-y-1">
                            <Label className="text-xs">{field.label}</Label>
                            {renderFilterInput(field)}
                        </div>
                    ))}

                    <div className="flex justify-between pt-2 border-t mt-4">
                        <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
                            クリア
                        </Button>
                        <Button size="sm" onClick={handleApply}>
                            適用
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
