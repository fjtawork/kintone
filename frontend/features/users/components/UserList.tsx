'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, deleteUser, User } from '../api';
import { getDepartments, getJobTitles } from '@/features/organization/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export const UserList = () => {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        email: '',
        full_name: '',
        password: '',
        department_id: '',
        job_title_id: '',
        is_superuser: false,
        is_active: true
    });

    const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });
    const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: getDepartments });
    const { data: jobTitles } = useQuery({ queryKey: ['jobTitles'], queryFn: getJobTitles });

    const createMutation = useMutation({
        mutationFn: createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsDialogOpen(false);
            resetForm();
            toast.success('ユーザーを作成しました');
        },
        onError: (err: any) => toast.error(err.response?.data?.detail || 'ユーザーの作成に失敗しました')
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string, user: any }) => updateUser(data.id, data.user),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsDialogOpen(false);
            setEditingUser(null);
            resetForm();
            toast.success('ユーザーを更新しました');
        },
        onError: (err: any) => toast.error(err.response?.data?.detail || 'ユーザーの更新に失敗しました')
    });

    const deleteMutation = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('ユーザーを削除しました');
        }
    });

    const resetForm = () => {
        setFormData({
            email: '',
            full_name: '',
            password: '',
            department_id: '',
            job_title_id: '',
            is_superuser: false,
            is_active: true
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = { ...formData };
        if (!payload.password && editingUser) delete payload.password; // Don't send empty password on update
        if (!payload.department_id) payload.department_id = null;
        if (!payload.job_title_id) payload.job_title_id = null;

        if (editingUser) {
            updateMutation.mutate({ id: editingUser.id, user: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const openCreate = () => {
        setEditingUser(null);
        resetForm();
        setIsDialogOpen(true);
    };

    const openEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            full_name: user.full_name || '',
            password: '',
            department_id: user.department_id || '',
            job_title_id: user.job_title_id || '',
            is_superuser: user.is_superuser,
            is_active: user.is_active
        });
        setIsDialogOpen(true);
    };

    const getDeptName = (id: string) => departments?.find(d => d.id === id)?.name || '-';
    const getTitleName = (id: string) => jobTitles?.find(t => t.id === id)?.name || '-';

    if (isLoading) return <div>読み込み中...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">ユーザー一覧</h2>
                <Button onClick={openCreate}><UserPlus className="mr-2 h-4 w-4" /> ユーザーを追加</Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>名前</TableHead>
                            <TableHead>メールアドレス</TableHead>
                            <TableHead>部署</TableHead>
                            <TableHead>役職</TableHead>
                            <TableHead>権限</TableHead>
                            <TableHead className="w-[100px]">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users?.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.full_name || user.email}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.department_id ? getDeptName(user.department_id) : '-'}</TableCell>
                                <TableCell>{user.job_title_id ? getTitleName(user.job_title_id) : '-'}</TableCell>
                                <TableCell>
                                    {user.is_superuser ? <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">管理者</span> : '一般ユーザー'}
                                </TableCell>
                                <TableCell className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => {
                                        if (confirm('このユーザーを削除しますか？')) deleteMutation.mutate(user.id);
                                    }}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'ユーザーを編集' : 'ユーザーを新規作成'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>氏名</Label>
                                <Input
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>メールアドレス</Label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{editingUser ? 'パスワード（空欄で変更しない）' : 'パスワード'}</Label>
                            <Input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required={!editingUser}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>部署</Label>
                                <Select
                                    value={formData.department_id || '__NONE__'}
                                    onValueChange={(val) => setFormData({ ...formData, department_id: val === '__NONE__' ? '' : val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="部署を選択" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__NONE__">未設定</SelectItem>
                                        {departments?.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>役職</Label>
                                <Select
                                    value={formData.job_title_id || '__NONE__'}
                                    onValueChange={(val) => setFormData({ ...formData, job_title_id: val === '__NONE__' ? '' : val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="役職を選択" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__NONE__">未設定</SelectItem>
                                        {jobTitles?.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}（ランク: {t.rank}）</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox
                                id="superuser"
                                checked={formData.is_superuser}
                                onCheckedChange={(c) => setFormData({ ...formData, is_superuser: c === true })}
                            />
                            <Label htmlFor="superuser">システム管理者（スーパーユーザー）</Label>
                        </div>

                        <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                            {editingUser ? 'ユーザーを更新' : 'ユーザーを作成'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
