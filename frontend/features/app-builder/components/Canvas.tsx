'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Field } from '../types';
import { cn } from '@/lib/utils';
import { Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SortableFieldProps {
    field: Field;
    onRemove: (id: string) => void;
    onSelect: (field: Field) => void;
    isSelected?: boolean;
    columnSpanClass?: string;
}

const SortableField = ({ field, onRemove, onSelect, isSelected, columnSpanClass }: SortableFieldProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: field.id, data: { field } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={() => onSelect(field)}
            className={cn(
                "group relative flex h-full items-center gap-4 p-4 rounded-lg border bg-white shadow-sm transition-all",
                columnSpanClass,
                isSelected ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-200 hover:border-blue-400",
                "dark:bg-zinc-900 dark:border-zinc-800"
            )}
        >
            {/* Drag Handle */}
            <div {...attributes} {...listeners} className="cursor-move p-1 text-zinc-400 hover:text-zinc-600">
                <GripVertical className="h-5 w-5" />
            </div>

            {/* Field Content Preview */}
            <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <div className="min-h-[2.25rem] w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                    {(() => {
                        switch (field.type) {
                            case 'RADIO_BUTTON':
                                return (
                                    <RadioGroup disabled defaultValue={field.options?.[0]}>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="option1" id="r1" />
                                            <Label htmlFor="r1">選択肢 1</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="option2" id="r2" />
                                            <Label htmlFor="r2">選択肢 2</Label>
                                        </div>
                                    </RadioGroup>
                                );
                            case 'CHECKBOX':
                                return (
                                    <div className="flex items-center space-x-2">
                                        <Checkbox disabled />
                                        <Label>チェック項目</Label>
                                    </div>
                                );
                            case 'DROP_DOWN':
                                return (
                                    <Select disabled>
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="選択してください" />
                                        </SelectTrigger>
                                    </Select>
                                );
                            case 'MULTI_LINE_TEXT':
                                return <div className="h-12 w-full bg-transparent text-zinc-400">複数行テキストの入力欄</div>;
                            case 'DATE':
                                return <div className="text-zinc-400">日付を選択</div>;
                            case 'LABEL':
                                return <div>{field.defaultValue as string || "ラベルテキスト"}</div>;
                            case 'LINK':
                                return <div className="text-blue-500 underline">https://example.com</div>;
                            case 'REFERENCE':
                                return <div className="text-zinc-400 border p-2 rounded bg-zinc-100 dark:bg-zinc-900">関連レコードを参照</div>;
                            case 'USER_SELECTION':
                                return (
                                    <div className="flex gap-2 items-center text-zinc-400 border p-2 rounded bg-zinc-100 dark:bg-zinc-900">
                                        <div className="bg-zinc-300 w-6 h-6 rounded-full"></div>
                                        <span>ユーザーを選択...</span>
                                    </div>
                                );
                            default:
                                return <div className="text-zinc-400">テキスト入力欄</div>;
                        }
                    })()}
                </div>
                <p className="text-xs text-zinc-500 mt-1">コード: {field.code}</p>
            </div>

            {/* Actions */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemove(field.id); }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
            </div>
        </div>
    );
};

interface SlotDropzoneProps {
    id: string;
    columnSpanClass: string;
}

const SlotDropzone = ({ id, columnSpanClass }: SlotDropzoneProps) => {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "min-h-[88px] rounded-lg border-2 border-dashed transition-colors",
                "border-zinc-200/80 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/30",
                "hidden md:block",
                isOver && "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20",
                columnSpanClass
            )}
        />
    );
};

interface CanvasProps {
    fields: Field[];
    onRemoveField: (id: string) => void;
    onSelectField: (field: Field) => void;
    selectedFieldId?: string;
    columns?: number;
}

export const Canvas = ({ fields, onRemoveField, onSelectField, selectedFieldId, columns = 1 }: CanvasProps) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'canvas',
    });
    const gridClass = columns >= 3
        ? 'grid-cols-1 md:grid-cols-3'
        : columns === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1';
    const getColumnSpanClass = (field: Field) => {
        const span = Math.max(1, Math.min(field.columnSpan || 1, columns));
        if (columns >= 3) {
            if (span >= 3) return 'md:col-span-3';
            if (span === 2) return 'md:col-span-2';
            return 'md:col-span-1';
        }
        if (columns === 2) {
            return span >= 2 ? 'md:col-span-2' : 'md:col-span-1';
        }
        return 'col-span-1';
    };
    const getSlotSpanClass = (span: number) => {
        const safeSpan = Math.max(1, Math.min(span, columns));
        if (columns >= 3) {
            if (safeSpan >= 3) return 'md:col-span-3';
            if (safeSpan === 2) return 'md:col-span-2';
            return 'md:col-span-1';
        }
        if (columns === 2) {
            return safeSpan >= 2 ? 'md:col-span-2' : 'md:col-span-1';
        }
        return 'col-span-1';
    };
    const normalizedColumns = Math.max(1, Math.min(columns, 3));
    const displayItems: Array<
        | { kind: 'field'; field: Field }
        | { kind: 'slot'; id: string; insertionIndex: number; span: number }
    > = [];
    let currentCol = 1;
    let slotCounter = 0;

    fields.forEach((field, index) => {
        const span = Math.max(1, Math.min(field.columnSpan || 1, normalizedColumns));
        const remainingInRow = normalizedColumns - currentCol + 1;

        if (span > remainingInRow) {
            displayItems.push({
                kind: 'slot',
                id: `slot:${index}:${slotCounter}`,
                insertionIndex: index,
                span: remainingInRow,
            });
            slotCounter += 1;
            currentCol = 1;
        }

        displayItems.push({ kind: 'field', field });
        currentCol += span;
        if (currentCol > normalizedColumns) {
            currentCol = 1;
        }
    });

    if (fields.length > 0 && currentCol > 1) {
        const trailingSpan = normalizedColumns - currentCol + 1;
        displayItems.push({
            kind: 'slot',
            id: `slot:${fields.length}:${slotCounter}`,
            insertionIndex: fields.length,
            span: trailingSpan,
        });
    }

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "w-full max-w-6xl min-h-[calc(100vh-12rem)] mx-auto p-8 pb-32 rounded-xl border-2 border-dashed transition-all bg-white dark:bg-zinc-950",
                isOver ? "border-blue-500 ring-4 ring-blue-500/10" : "border-zinc-200 dark:border-zinc-800",
                fields.length === 0 && "flex items-center justify-center"
            )}
        >
            {fields.length > 0 && (
                <SortableContext items={fields.map(f => f.id)} strategy={rectSortingStrategy}>
                    <div className={cn("grid gap-3", gridClass)}>
                        {displayItems.map((item) => {
                            if (item.kind === 'slot') {
                                return (
                                    <SlotDropzone
                                        key={item.id}
                                        id={item.id}
                                        columnSpanClass={getSlotSpanClass(item.span)}
                                    />
                                );
                            }

                            return (
                                <SortableField
                                    key={item.field.id}
                                    field={item.field}
                                    onRemove={onRemoveField}
                                    onSelect={onSelectField}
                                    isSelected={selectedFieldId === item.field.id}
                                    columnSpanClass={getColumnSpanClass(item.field)}
                                />
                            );
                        })}
                    </div>
                </SortableContext>
            )}

            {
                fields.length === 0 && (
                    <div className="text-center text-zinc-400">
                        <p className="text-lg font-medium">キャンバスは空です</p>
                        <p className="text-sm">左サイドバーから項目をドラッグして追加してください。</p>
                    </div>
                )
            }
        </div >
    );
};
