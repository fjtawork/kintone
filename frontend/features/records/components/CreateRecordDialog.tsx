'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { DynamicForm } from './DynamicForm';
import { Field } from '../../app-builder/types';

interface CreateRecordDialogProps {
    appId: string;
    fields: Field[];
    formColumns?: number;
}

export const CreateRecordDialog = ({ appId, fields, formColumns = 1 }: CreateRecordDialogProps) => {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            // Backend expects { app_id: uuid, data: jsonb }
            await api.post('/records/', {
                app_id: appId,
                data: data
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['records', appId] });
            queryClient.invalidateQueries({ queryKey: ['records-infinite', appId] });
            setOpen(false);
        },
    });

    const dialogWidthClass =
        formColumns >= 3 ? 'sm:max-w-[1000px]' : formColumns === 2 ? 'sm:max-w-[820px]' : 'sm:max-w-[600px]';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> レコード追加
                </Button>
            </DialogTrigger>
            <DialogContent className={`${dialogWidthClass} max-h-[90vh] overflow-y-auto`}>
                <DialogHeader>
                    <DialogTitle>新規レコード</DialogTitle>
                    <DialogDescription>
                        以下の内容を入力してください。
                    </DialogDescription>
                </DialogHeader>

                <DynamicForm
                    fields={fields}
                    onSubmit={(data) => mutation.mutate(data)}
                    isSubmitting={mutation.isPending}
                    columns={formColumns}
                    submitLabel="登録"
                />
            </DialogContent>
        </Dialog>
    );
};
