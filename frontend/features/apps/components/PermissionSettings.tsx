'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { getDepartments } from '@/features/organization/api';
import { getJobTitles } from '@/features/organization/api';
import { getUsers } from '@/features/users/api';

interface PermissionSettingsProps {
    appId: string;
    app: any; // The full app object
}

export const PermissionSettings = ({ appId, app }: PermissionSettingsProps) => {
    const [appAcl, setAppAcl] = useState<any[]>(app.app_acl || []);
    const [recordAcl, setRecordAcl] = useState<any[]>(app.record_acl || []);

    // Entity Selection States
    const [selectedEntityType, setSelectedEntityType] = useState('user');
    const [selectedEntityId, setSelectedEntityId] = useState('');

    const queryClient = useQueryClient();

    // Fetch Master Data
    const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: getDepartments });
    const { data: jobTitles } = useQuery({ queryKey: ['jobTitles'], queryFn: getJobTitles });
    const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => getUsers(0, 500) }); // Fetch reasonable limit

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            // Update using General App Update endpoint which supports ACLs now
            await api.put(`/apps/${appId}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['app', appId] });
            alert('権限設定を保存しました。');
        }
    });

    const handleSave = () => {
        mutation.mutate({
            app_acl: appAcl,
            record_acl: recordAcl
        });
    };

    // --- App ACL Helpers ---
    const addAppRule = () => {
        const newRule = {
            entity_type: selectedEntityType,
            entity_id: selectedEntityType === 'creator' || selectedEntityType === 'everyone' ? null : selectedEntityId,
            allow_view: true,
            allow_edit: false,
            allow_delete: false,
            allow_manage: false
        };

        // Prevent duplicates? logic here if needed
        setAppAcl([...appAcl, newRule]);
    };

    const removeAppRule = (index: number) => {
        const newAcl = [...appAcl];
        newAcl.splice(index, 1);
        setAppAcl(newAcl);
    };

    const updateAppRule = (index: number, field: string, value: boolean) => {
        const newAcl = [...appAcl];
        newAcl[index][field] = value;
        setAppAcl(newAcl);
    };

    // --- Record ACL Helpers ---
    const addRecordRule = () => {
        setRecordAcl([
            ...recordAcl,
            {
                condition: { field: '', operator: '=', value: '' },
                permissions: { view: [] } // For simplicity, only VIEW restrictions on records for now as per MVP
            }
        ]);
    };

    const updateRecordCondition = (index: number, field: string, value: string) => {
        const newAcl = [...recordAcl];
        newAcl[index].condition = { ...newAcl[index].condition, [field]: value };
        setRecordAcl(newAcl);
    };

    const addRecordPermEntity = (ruleIndex: number, type: string, id: string) => {
        const newAcl = [...recordAcl];
        const currentView = newAcl[ruleIndex].permissions?.view || [];

        // Add
        const newEntity = { entity_type: type, entity_id: (type === 'creator' || type === 'everyone') ? null : id };
        newAcl[ruleIndex].permissions = {
            ...newAcl[ruleIndex].permissions,
            view: [...currentView, newEntity]
        };
        setRecordAcl(newAcl);
    };

    const removeRecordPermEntity = (ruleIndex: number, entityIndex: number) => {
        const newAcl = [...recordAcl];
        newAcl[ruleIndex].permissions.view.splice(entityIndex, 1);
        setRecordAcl(newAcl);
    };

    // Helper to get entity name
    const getEntityName = (type: string, id: string) => {
        if (type === 'everyone') return '全員';
        if (type === 'creator') return '作成者';
        if (type === 'user') return users?.find(u => u.id === id)?.full_name || users?.find(u => u.id === id)?.email || id;
        if (type === 'department') return departments?.find(d => d.id === id)?.name || id;
        if (type === 'job_title') return jobTitles?.find(t => t.id === id)?.name || id;
        return `${type}:${id}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">権限設定</h2>
                <Button onClick={handleSave} disabled={mutation.isPending}>
                    {mutation.isPending ? '保存中...' : '変更を保存'}
                </Button>
            </div>

            <Tabs defaultValue="app">
                <TabsList>
                    <TabsTrigger value="app">アプリ権限</TabsTrigger>
                    <TabsTrigger value="record">レコード権限</TabsTrigger>
                </TabsList>

                {/* --- APP ACCESS TAB --- */}
                <TabsContent value="app">
                    <Card>
                        <CardHeader>
                            <CardTitle>アプリアクセス制御</CardTitle>
                            <CardDescription>このアプリの閲覧・編集・管理・削除権限を設定します。</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Entity Selector */}
                            <div className="flex gap-2 items-end border p-4 rounded-md bg-gray-50">
                                <div className="space-y-2 w-40">
                                    <Label>種別</Label>
                                    <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="user">ユーザー</SelectItem>
                                            <SelectItem value="department">部署</SelectItem>
                                            <SelectItem value="job_title">役職</SelectItem>
                                            <SelectItem value="everyone">全員</SelectItem>
                                            <SelectItem value="creator">作成者</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {['user', 'department', 'job_title'].includes(selectedEntityType) && (
                                    <div className="space-y-2 w-60">
                                        <Label>対象を選択</Label>
                                        <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                                            <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                                            <SelectContent>
                                                {selectedEntityType === 'user' && users?.map((u: any) => (
                                                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                                                ))}
                                                {selectedEntityType === 'department' && departments?.map((d: any) => (
                                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                ))}
                                                {selectedEntityType === 'job_title' && jobTitles?.map((t: any) => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <Button onClick={addAppRule} variant="outline">ルール追加</Button>
                            </div>

                            {/* Rules Table */}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>対象</TableHead>
                                        <TableHead>閲覧</TableHead>
                                        <TableHead>編集</TableHead>
                                        <TableHead>削除</TableHead>
                                        <TableHead>管理</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {appAcl.map((rule, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium">
                                                {getEntityName(rule.entity_type, rule.entity_id)}
                                            </TableCell>
                                            <TableCell>
                                                <Checkbox checked={rule.allow_view} onCheckedChange={(c) => updateAppRule(idx, 'allow_view', !!c)} />
                                            </TableCell>
                                            <TableCell>
                                                <Checkbox checked={rule.allow_edit} onCheckedChange={(c) => updateAppRule(idx, 'allow_edit', !!c)} />
                                            </TableCell>
                                            <TableCell>
                                                <Checkbox checked={rule.allow_delete} onCheckedChange={(c) => updateAppRule(idx, 'allow_delete', !!c)} />
                                            </TableCell>
                                            <TableCell>
                                                <Checkbox checked={rule.allow_manage} onCheckedChange={(c) => updateAppRule(idx, 'allow_manage', !!c)} />
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => removeAppRule(idx)} className="text-red-500">削除</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {appAcl.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-gray-500">ルールがありません。（既定: 全員閲覧、作成者管理）</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- RECORD ACCESS TAB --- */}
                <TabsContent value="record">
                    <Card>
                        <CardHeader>
                            <CardTitle>レコードアクセス制御</CardTitle>
                            <CardDescription>条件に基づいてレコードの閲覧権限を制御します。</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Button onClick={addRecordRule}>条件を追加</Button>

                            {recordAcl.map((rule, idx) => (
                                <div key={idx} className="border p-4 rounded-md mb-4 bg-slate-50">
                                    <div className="flex justify-between mb-4">
                                        <h4 className="font-bold">ルール #{idx + 1}</h4>
                                        <Button variant="ghost" size="sm" onClick={() => {
                                            const n = [...recordAcl]; n.splice(idx, 1); setRecordAcl(n);
                                        }} className="text-red-500">ルール削除</Button>
                                    </div>

                                    {/* Condition Builder */}
                                    <div className="flex gap-2 items-center mb-4">
                                        <span className="text-sm font-medium">条件</span>
                                        <Select value={rule.condition?.field} onValueChange={(v) => updateRecordCondition(idx, 'field', v)}>
                                            <SelectTrigger className="w-40"><SelectValue placeholder="項目" /></SelectTrigger>
                                            <SelectContent>
                                                {/* We need app fields here. Assuming 'app.fields' exists if fetched with relation or process fields manually?
                                                     Let's assume app.fields is available or we default to static options for now. 
                                                     Actually App object usually needs fields. 
                                                     The 'app' prop might not have fields populated unless we included them. 
                                                     Let's assume 'status' and basic fields plus dynamic ones. */}
                                                <SelectItem value="status">ステータス</SelectItem>
                                                {/* TODO: Map dynamic fields if available */}
                                            </SelectContent>
                                        </Select>
                                        <Select value={rule.condition?.operator} onValueChange={(v) => updateRecordCondition(idx, 'operator', v)}>
                                            <SelectTrigger className="w-24"><SelectValue placeholder="演算子" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="=">=</SelectItem>
                                                <SelectItem value="!=">!=</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            className="w-40"
                                            placeholder="値"
                                            value={rule.condition?.value}
                                            onChange={(e) => updateRecordCondition(idx, 'value', e.target.value)}
                                        />
                                        <span className="text-sm font-medium">閲覧許可:</span>
                                    </div>

                                    {/* Permission List for this Rule */}
                                    <div className="pl-4 border-l-2 border-blue-200">
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {rule.permissions?.view?.map((entity: any, eIdx: number) => (
                                                <div key={eIdx} className="bg-white border px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                                    {getEntityName(entity.entity_type, entity.entity_id)}
                                                    <button onClick={() => removeRecordPermEntity(idx, eIdx)} className="text-red-500 hover:text-red-700">×</button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add Entity to Rule */}
                                        <div className="flex gap-2 items-center mt-2">
                                            <Select onValueChange={(val) => {
                                                // Simple hack: value="type:id"
                                                const [t, i] = val.split(':');
                                                addRecordPermEntity(idx, t, i || '');
                                            }}>
                                                <SelectTrigger className="w-60"><SelectValue placeholder="対象を追加..." /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="everyone:">全員</SelectItem>
                                                    <SelectItem value="creator:">作成者</SelectItem>
                                                    {departments?.map((d: any) => <SelectItem key={d.id} value={`department:${d.id}`}>部署: {d.name}</SelectItem>)}
                                                    {jobTitles?.map((t: any) => <SelectItem key={t.id} value={`job_title:${t.id}`}>役職: {t.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};
