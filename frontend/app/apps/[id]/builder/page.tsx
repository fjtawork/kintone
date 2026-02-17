'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    DragStartEvent,
    DragEndEvent
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Toolbox } from '@/features/app-builder/components/Toolbox';
import { Canvas } from '@/features/app-builder/components/Canvas';
import { PropertiesPanel } from '@/features/app-builder/components/PropertiesPanel';
import { Field, FieldType } from '@/features/app-builder/types';
import { DynamicForm } from '@/features/records/components/DynamicForm';

export default function AppBuilderPage() {
    const params = useParams();
    const appId = params.id as string;
    const queryClient = useQueryClient();

    // State
    const [fields, setFields] = useState<Field[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeField, setActiveField] = useState<Field | null>(null);
    const [selectedField, setSelectedField] = useState<Field | null>(null);
    const [formColumns, setFormColumns] = useState<number>(1);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const { data: app, isLoading: isAppLoading } = useQuery({
        queryKey: ['app', appId],
        queryFn: async () => {
            const { data } = await api.get(`/apps/${appId}`);
            return data;
        },
    });

    const { data: existingFields, isLoading: isFieldsLoading } = useQuery({
        queryKey: ['fields', appId],
        queryFn: async () => {
            const { data } = await api.get(`/fields/app/${appId}`);
            return data;
        },
    });

    // Initialize fields from DB
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (existingFields && !initialized) {
            setFields(existingFields.map((f: any) => ({
                id: f.id,
                type: f.type,
                code: f.code,
                label: f.label,
                required: f.config?.required,
                options: f.config?.options,
                defaultValue: f.config?.defaultValue,
                relatedAppId: f.config?.relatedAppId,
                isMultiSelect: f.config?.isMultiSelect,
                columnSpan: f.config?.columnSpan || 1,
            })));
            const initialColumns = Number(app?.view_settings?.form_columns || 1);
            setFormColumns([1, 2, 3].includes(initialColumns) ? initialColumns : 1);
            setInitialized(true);
        }
    }, [existingFields, initialized, app?.view_settings?.form_columns]);

    // Handlers
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        if (event.active.data.current?.isToolboxItem) {
            setActiveField({
                id: event.active.id as string,
                type: event.active.data.current.type,
                label: event.active.data.current.type,
                code: event.active.data.current.type
            } as any);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveField(null);

        if (!over) return;
        const overId = String(over.id);
        const isSlotDrop = overId.startsWith('slot:');
        const slotIndex = isSlotDrop ? Number(overId.split(':')[1]) : -1;

        // Dropping a toolbox item onto the canvas
        if (active.data.current?.isToolboxItem) {
            if (over.id === 'canvas' || fields.some(f => f.id === over.id) || isSlotDrop) {
                const type = active.data.current.type as FieldType;
                const isSelectType = ['RADIO_BUTTON', 'CHECKBOX', 'DROP_DOWN'].includes(type);
                const newField: Field = {
                    id: uuidv4(),
                    type,
                    label: `新規 ${type}`,
                    code: `${type.toLowerCase()}_${Date.now()}`,
                    required: false,
                    options: isSelectType ? ['選択肢 1'] : undefined,
                    columnSpan: 1,
                };
                setFields((prev) => {
                    if (isSlotDrop && Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex <= prev.length) {
                        return [
                            ...prev.slice(0, slotIndex),
                            newField,
                            ...prev.slice(slotIndex),
                        ];
                    }
                    if (over.id === 'canvas') {
                        return [...prev, newField];
                    }
                    const overIndex = prev.findIndex((f) => f.id === over.id);
                    if (overIndex === -1) {
                        return [...prev, newField];
                    }
                    return [
                        ...prev.slice(0, overIndex),
                        newField,
                        ...prev.slice(overIndex),
                    ];
                });
                setSelectedField(newField);
            }
            return;
        }

        // Reordering existing fields
        if (active.id !== over.id || isSlotDrop) {
            setFields((items) => {
                const oldIndex = items.findIndex((f) => f.id === active.id);
                if (oldIndex === -1) return items;

                if (isSlotDrop && Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex <= items.length) {
                    const next = [...items];
                    const [moved] = next.splice(oldIndex, 1);
                    const insertionIndex = oldIndex < slotIndex ? slotIndex - 1 : slotIndex;
                    next.splice(insertionIndex, 0, moved);
                    return next;
                }

                const newIndex = items.findIndex((f) => f.id === over.id);
                if (newIndex === -1) return items;
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const updateField = (id: string, updates: Partial<Field>) => {
        setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        if (selectedField?.id === id) {
            setSelectedField(prev => prev ? { ...prev, ...updates } : null);
        }
    };

    const removeField = (id: string) => {
        setFields(prev => prev.filter(f => f.id !== id));
        if (selectedField?.id === id) {
            setSelectedField(null);
        }
    };

    const handleSave = async () => {
        try {
            const payload = fields.map(f => ({
                code: f.code,
                type: f.type,
                label: f.label,
                app_id: appId,
                config: {
                    required: f.required,
                    options: f.options,
                    defaultValue: f.defaultValue,
                    relatedAppId: f.relatedAppId,
                    isMultiSelect: f.isMultiSelect,
                    columnSpan: f.columnSpan || 1,
                }
            }));

            await api.put(`/fields/app/${appId}`, payload);
            await api.put(`/apps/${appId}/view`, { form_columns: formColumns });
            await queryClient.invalidateQueries({ queryKey: ['fields', appId] });
            await queryClient.invalidateQueries({ queryKey: ['app', appId] });
            alert('アプリを保存しました。');
        } catch (error) {
            console.error(error);
            alert('アプリの保存に失敗しました。');
        }
    };

    if (isAppLoading || isFieldsLoading) return <div>ビルダーを読み込み中...</div>;

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="h-screen flex flex-col">
                {/* Header */}
                <header className="border-b p-4 flex justify-between items-center bg-white dark:bg-zinc-950">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="font-bold">{app?.name}</h1>
                            <p className="text-xs text-muted-foreground">フォームビルダー</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Select value={String(formColumns)} onValueChange={(value) => setFormColumns(Number(value))}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="列数" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1列</SelectItem>
                                <SelectItem value="2">2列</SelectItem>
                                <SelectItem value="3">3列</SelectItem>
                            </SelectContent>
                        </Select>
                        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline">プレビュー</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>フォームプレビュー</DialogTitle>
                                    <DialogDescription>
                                        現在の設定で表示したフォームのプレビューです。
                                    </DialogDescription>
                                </DialogHeader>
                                <DynamicForm
                                    fields={fields}
                                    onSubmit={() => { }}
                                    columns={formColumns}
                                    hideSubmit
                                />
                            </DialogContent>
                        </Dialog>
                        <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> アプリを保存</Button>
                    </div>
                </header>

                {/* Main Workspace */}
                <div className="flex-1 flex bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
                    {/* Left Sidebar: Toolbox */}
                    <aside className="w-64 border-r bg-white dark:bg-zinc-950 overflow-y-auto">
                        <Toolbox />
                    </aside>

                    {/* Center Canvas */}
                    {/* Center Canvas */}
                    <main className="flex-1 p-8 overflow-y-auto bg-zinc-100 dark:bg-zinc-900/50">
                        <Canvas
                            fields={fields}
                            onRemoveField={removeField}
                            onSelectField={setSelectedField}
                            selectedFieldId={selectedField?.id}
                            columns={formColumns}
                        />
                    </main>

                    {/* Right Sidebar: Properties */}
                    <aside className="w-80 border-l bg-white dark:bg-zinc-950 overflow-y-auto">
                        <PropertiesPanel
                            field={selectedField}
                            onUpdate={updateField}
                        />
                    </aside>
                </div>

                {/* Drag Overlay */}
                <DragOverlay>
                    {activeId && activeField ? (
                        <div className="opacity-80 cursor-grabbing p-4 border rounded bg-white shadow-lg w-[200px]">
                            {activeField.type}
                        </div>
                    ) : null}
                </DragOverlay>
            </div>
        </DndContext>
    );
}
