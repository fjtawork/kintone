'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useCreateAnnouncement, useUpdateAnnouncement, type Announcement } from '../api/useAnnouncements';
import { Plus } from 'lucide-react';

interface AnnouncementEditorProps {
    editing?: Announcement;
    onClose?: () => void;
}

export const AnnouncementEditor = ({ editing, onClose }: AnnouncementEditorProps) => {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(editing?.title ?? '');
    const [body, setBody] = useState(editing?.body ?? '');
    const [isPinned, setIsPinned] = useState(editing?.is_pinned ?? false);

    const { mutate: create, isPending: isCreating } = useCreateAnnouncement();
    const { mutate: update, isPending: isUpdating } = useUpdateAnnouncement();

    const isPending = isCreating || isUpdating;
    const isEdit = !!editing;

    const handleOpen = () => {
        setTitle(editing?.title ?? '');
        setBody(editing?.body ?? '');
        setIsPinned(editing?.is_pinned ?? false);
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        onClose?.();
    };

    const handleSubmit = () => {
        if (!title.trim() || !body.trim()) {
            toast.error('タイトルと本文は必須です');
            return;
        }
        const payload = { title: title.trim(), body: body.trim(), is_pinned: isPinned };

        if (isEdit) {
            update({ id: editing.id, ...payload }, {
                onSuccess: () => { toast.success('お知らせを更新しました'); handleClose(); },
                onError: () => toast.error('更新に失敗しました'),
            });
        } else {
            create(payload, {
                onSuccess: () => { toast.success('お知らせを投稿しました'); handleClose(); },
                onError: () => toast.error('投稿に失敗しました'),
            });
        }
    };

    return (
        <>
            {!isEdit && (
                <Button size="sm" onClick={handleOpen}>
                    <Plus className="mr-2 h-4 w-4" />
                    投稿する
                </Button>
            )}
            {isEdit && (
                <Button size="sm" variant="outline" onClick={handleOpen}>
                    編集
                </Button>
            )}

            <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>{isEdit ? 'お知らせを編集' : 'お知らせを投稿'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label>タイトル</Label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="タイトルを入力..."
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>本文</Label>
                            <Textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="内容を入力..."
                                rows={5}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch
                                id="pinned"
                                checked={isPinned}
                                onCheckedChange={setIsPinned}
                            />
                            <Label htmlFor="pinned" className="cursor-pointer">ピン留め（先頭に固定）</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose} disabled={isPending}>
                            キャンセル
                        </Button>
                        <Button onClick={handleSubmit} disabled={isPending}>
                            {isPending ? '保存中...' : (isEdit ? '更新' : '投稿')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
