'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment, Department } from '../api';
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

export const DepartmentList = () => {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [formData, setFormData] = useState({ name: '', code: '' });

    const { data: departments, isLoading } = useQuery({
        queryKey: ['departments'],
        queryFn: getDepartments
    });

    const createMutation = useMutation({
        mutationFn: createDepartment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            setIsDialogOpen(false);
            setFormData({ name: '', code: '' });
            toast.success('部署を作成しました');
        },
        onError: () => toast.error('部署の作成に失敗しました')
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string, dept: any }) => updateDepartment(data.id, data.dept),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            setIsDialogOpen(false);
            setEditingDept(null);
            setFormData({ name: '', code: '' });
            toast.success('部署を更新しました');
        },
        onError: () => toast.error('部署の更新に失敗しました')
    });

    const deleteMutation = useMutation({
        mutationFn: deleteDepartment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            toast.success('部署を削除しました');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingDept) {
            updateMutation.mutate({ id: editingDept.id, dept: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const openCreate = () => {
        setEditingDept(null);
        setFormData({ name: '', code: '' });
        setIsDialogOpen(true);
    };

    const openEdit = (dept: Department) => {
        setEditingDept(dept);
        setFormData({ name: dept.name, code: dept.code });
        setIsDialogOpen(true);
    };

    if (isLoading) return <div>読み込み中...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">部署一覧</h2>
                <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> 部署を追加</Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>部署名</TableHead>
                            <TableHead>コード</TableHead>
                            <TableHead className="w-[100px]">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {departments?.map((dept) => (
                            <TableRow key={dept.id}>
                                <TableCell>{dept.name}</TableCell>
                                <TableCell>{dept.code}</TableCell>
                                <TableCell className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => {
                                        if (confirm('この部署を削除しますか？')) deleteMutation.mutate(dept.id);
                                    }}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {departments?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground p-4">
                                    部署がありません。
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingDept ? '部署を編集' : '部署を新規作成'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>部署名</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="例: 営業部"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>コード</Label>
                            <Input
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                placeholder="例: sales_dept"
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                            {editingDept ? '更新' : '作成'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
