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
import { RecordAclEditor, RecordAcl } from './RecordAclEditor';
import { Field } from '../../app-builder/types';

interface CreateRecordDialogProps {
    appId: string;
    fields: Field[];
    formColumns?: number;
}

export const CreateRecordDialog = ({ appId, fields, formColumns = 1 }: CreateRecordDialogProps) => {
    const [open, setOpen] = useState(false);
    const [acl, setAcl] = useState<RecordAcl | null>(null);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            await api.post('/records/', {
                app_id: appId,
                data,
                acl: acl ?? null,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['records', appId] });
            queryClient.invalidateQueries({ queryKey: ['records-infinite', appId] });
            setOpen(false);
            setAcl(null);
        },
    });

    const dialogWidthClass =
        formColumns >= 3 ? 'sm:max-w-[1000px]' : formColumns === 2 ? 'sm:max-w-[820px]' : 'sm:max-w-[600px]';

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setAcl(null); }}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> レコード追加
                </Button>
            </DialogTrigger>
            <DialogContent className={`${dialogWidthClass} max-h-[90vh] overflow-y-auto`}>
                <DialogHeader>
                    <DialogTitle>新規レコード</DialogTitle>
                    <DialogDescription>以下の内容を入力してください。</DialogDescription>
                </DialogHeader>

                <DynamicForm
                    fields={fields}
                    onSubmit={(data) => mutation.mutate(data)}
                    isSubmitting={mutation.isPending}
                    columns={formColumns}
                    submitLabel="登録"
                    extraFooter={
                        <RecordAclEditor value={acl} onChange={setAcl} />
                    }
                />
            </DialogContent>
        </Dialog>
    );
};
