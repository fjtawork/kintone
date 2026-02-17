'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJobTitles, createJobTitle, updateJobTitle, deleteJobTitle, JobTitle } from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export const JobTitleList = () => {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTitle, setEditingTitle] = useState<JobTitle | null>(null);
    const [formData, setFormData] = useState({ name: '', rank: 0 });

    const { data: jobTitles, isLoading } = useQuery({
        queryKey: ['jobTitles'],
        queryFn: getJobTitles
    });

    const createMutation = useMutation({
        mutationFn: createJobTitle,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobTitles'] });
            setIsDialogOpen(false);
            setFormData({ name: '', rank: 0 });
            toast.success('役職を作成しました');
        },
        onError: () => toast.error('役職の作成に失敗しました')
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string, title: any }) => updateJobTitle(data.id, data.title),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobTitles'] });
            setIsDialogOpen(false);
            setEditingTitle(null);
            setFormData({ name: '', rank: 0 });
            toast.success('役職を更新しました');
        },
        onError: () => toast.error('役職の更新に失敗しました')
    });

    const deleteMutation = useMutation({
        mutationFn: deleteJobTitle,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobTitles'] });
            toast.success('役職を削除しました');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingTitle) {
            updateMutation.mutate({ id: editingTitle.id, title: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const openCreate = () => {
        setEditingTitle(null);
        setFormData({ name: '', rank: 0 });
        setIsDialogOpen(true);
    };

    const openEdit = (title: JobTitle) => {
        setEditingTitle(title);
        setFormData({ name: title.name, rank: title.rank });
        setIsDialogOpen(true);
    };

    if (isLoading) return <div>読み込み中...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">役職一覧</h2>
                <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> 役職を追加</Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>役職名</TableHead>
                            <TableHead>ランク</TableHead>
                            <TableHead className="w-[100px]">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {jobTitles?.map((title) => (
                            <TableRow key={title.id}>
                                <TableCell>{title.name}</TableCell>
                                <TableCell>{title.rank}</TableCell>
                                <TableCell className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(title)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => {
                                        if (confirm('この役職を削除しますか？')) deleteMutation.mutate(title.id);
                                    }}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {jobTitles?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground p-4">
                                    役職がありません。
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTitle ? '役職を編集' : '役職を新規作成'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>役職名</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="例: 部長"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>ランク（高いほど権限が強い）</Label>
                            <Input
                                type="number"
                                value={formData.rank}
                                onChange={(e) => setFormData({ ...formData, rank: parseInt(e.target.value) || 0 })}
                                required
                            />
                            <p className="text-xs text-muted-foreground">例: 一般=10、マネージャー=20、部長=30</p>
                        </div>
                        <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                            {editingTitle ? '更新' : '作成'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
