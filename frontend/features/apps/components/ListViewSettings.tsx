'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Field } from '@/features/app-builder/types';

interface ListViewSettingsProps {
    appId: string;
    fields: Field[]; // Passing fields from parent or fetch them? Parent is better if available.
    settings?: {
        list_fields?: string[];
    };
}

export const ListViewSettings = ({ appId, fields, settings }: ListViewSettingsProps) => {
    // const { toast } = useToast(); // Removed
    const queryClient = useQueryClient();
    const [selectedFields, setSelectedFields] = useState<string[]>([]);

    useEffect(() => {
        if (settings?.list_fields && Array.isArray(settings.list_fields)) {
            setSelectedFields(settings.list_fields);
        } else {
            // Default: maybe first 5 fields? or none?
            setSelectedFields([]);
        }
    }, [settings]);

    const { mutate: updateSettings, isPending } = useMutation({
        mutationFn: async (newFields: string[]) => {
            await api.put(`/apps/${appId}/view`, {
                list_fields: newFields
            });
        },
        onSuccess: () => {
            toast.success("設定を保存しました", {
                description: "一覧表示の列を更新しました。",
            });
            queryClient.invalidateQueries({ queryKey: ['app', appId] });
        },
        onError: () => {
            toast.error("エラー", {
                description: "設定の保存に失敗しました。",
            });
        }
    });

    const handleCheck = (code: string, checked: boolean) => {
        if (checked) {
            if (selectedFields.length >= 10) {
                toast.error("上限に達しました", {
                    description: "選択できる項目は最大10件です。",
                });
                return;
            }
            setSelectedFields(prev => [...prev, code]);
        } else {
            setSelectedFields(prev => prev.filter(f => f !== code));
        }
    };

    const handleSave = () => {
        updateSettings(selectedFields);
    };

    // Filter out fields that probably shouldn't be in list view (like rich text if heavy, though user asked for choice)
    // For now, allow all.

    return (
        <div className="border p-4 rounded-md space-y-4">
            <div>
                <h2 className="font-semibold">一覧表示設定</h2>
                <p className="text-sm text-muted-foreground">一覧画面に表示する列を選択してください（最大10件）。</p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto border p-2 rounded bg-zinc-50 dark:bg-zinc-900">
                {fields.map(field => (
                    <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`view-${field.id}`}
                            checked={selectedFields.includes(field.code)}
                            onCheckedChange={(checked) => handleCheck(field.code, checked === true)}
                            disabled={!selectedFields.includes(field.code) && selectedFields.length >= 10}
                        />
                        <Label htmlFor={`view-${field.id}`} className="cursor-pointer">{field.label} <span className="text-xs text-muted-foreground">({field.code})</span></Label>
                    </div>
                ))}
                {fields.length === 0 && <p className="text-sm text-muted-foreground col-span-2">表示可能なフィールドがありません。</p>}
            </div>

            <div className="flex justify-end items-center gap-2">
                <span className="text-sm text-muted-foreground mr-auto">選択中: {selectedFields.length} / 10</span>
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    設定を保存
                </Button>
            </div>
        </div>
    );
};
