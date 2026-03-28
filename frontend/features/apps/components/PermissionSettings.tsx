'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';
import { getDepartments, getJobTitles } from '@/features/organization/api';
import { getUsers } from '@/features/users/api';
import { toast } from 'sonner';

interface PermissionSettingsProps {
    appId: string;
    app: any;
}

// entity_type の表示ラベル
const ENTITY_TYPE_LABELS: Record<string, string> = {
    everyone:   '全員',
    creator:    '作成者',
    user:       'ユーザー',
    department: '部署',
    job_title:  '役職',
};

export const PermissionSettings = ({ appId, app }: PermissionSettingsProps) => {
    const [appAcl,    setAppAcl]    = useState<any[]>(app.app_acl    || []);
    const [recordAcl, setRecordAcl] = useState<any[]>(app.record_acl || []);

    // アプリACL 追加フォーム
    const [appEntityType, setAppEntityType] = useState('user');
    const [appEntityId,   setAppEntityId]   = useState('');

    // レコードACL 追加エンティティフォーム（ルールごと）
    const [recEntityType, setRecEntityType] = useState<Record<number, string>>({});
    const [recEntityId,   setRecEntityId]   = useState<Record<number, string>>({});

    const queryClient = useQueryClient();

    const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: getDepartments });
    const { data: jobTitles }   = useQuery({ queryKey: ['jobTitles'],   queryFn: getJobTitles });
    const { data: users }       = useQuery({ queryKey: ['users'],       queryFn: () => getUsers(0, 500) });
    const { data: fields }      = useQuery({
        queryKey: ['fields', appId],
        queryFn: async () => {
            const { data } = await api.get(`/fields/app/${appId}`);
            return data as { code: string; label: string; type: string }[];
        },
    });

    const mutation = useMutation({
        mutationFn: async (payload: any) => {
            await api.put(`/apps/${appId}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['app', appId] });
            toast.success('権限設定を保存しました');
        },
        onError: () => toast.error('保存に失敗しました'),
    });

    const handleSave = () => {
        mutation.mutate({ app_acl: appAcl, record_acl: recordAcl });
    };

    // ── アプリACL ──────────────────────────────
    const addAppRule = () => {
        if (['user', 'department', 'job_title'].includes(appEntityType) && !appEntityId) return;
        setAppAcl([...appAcl, {
            entity_type: appEntityType,
            entity_id:   ['creator', 'everyone'].includes(appEntityType) ? null : appEntityId,
            allow_view:   true,
            allow_edit:   false,
            allow_delete: false,
            allow_manage: false,
        }]);
        setAppEntityId('');
    };

    const removeAppRule   = (i: number) => setAppAcl(appAcl.filter((_, idx) => idx !== i));
    const updateAppRule   = (i: number, field: string, val: boolean) => {
        const next = [...appAcl];
        next[i][field] = val;
        setAppAcl(next);
    };

    // ── レコードACL ────────────────────────────
    const addRecordRule = () => {
        setRecordAcl([...recordAcl, {
            condition:   { field: 'status', operator: '=', value: '' },
            permissions: { view: [] },
        }]);
    };

    const removeRecordRule = (i: number) => setRecordAcl(recordAcl.filter((_, idx) => idx !== i));

    const updateCondition = (ruleIdx: number, key: string, val: string) => {
        const next = [...recordAcl];
        next[ruleIdx].condition = { ...next[ruleIdx].condition, [key]: val };
        setRecordAcl(next);
    };

    const addRecordEntity = (ruleIdx: number) => {
        const type = recEntityType[ruleIdx] ?? 'creator';
        const id   = recEntityId[ruleIdx]   ?? '';
        if (['user', 'department', 'job_title'].includes(type) && !id) return;

        const next = [...recordAcl];
        const currentView = next[ruleIdx].permissions?.view ?? [];
        next[ruleIdx].permissions = {
            ...next[ruleIdx].permissions,
            view: [...currentView, {
                entity_type: type,
                entity_id:   ['creator', 'everyone'].includes(type) ? null : id,
            }],
        };
        setRecordAcl(next);
        setRecEntityId(prev => ({ ...prev, [ruleIdx]: '' }));
    };

    const removeRecordEntity = (ruleIdx: number, entityIdx: number) => {
        const next = [...recordAcl];
        next[ruleIdx].permissions.view = next[ruleIdx].permissions.view.filter((_: any, i: number) => i !== entityIdx);
        setRecordAcl(next);
    };

    // ── 表示名ヘルパー ─────────────────────────
    const entityName = (type: string, id: string | null) => {
        if (type === 'everyone') return '全員';
        if (type === 'creator')  return '作成者';
        if (type === 'user')       return users?.find(u => u.id === id)?.full_name || users?.find(u => u.id === id)?.email || id;
        if (type === 'department') return departments?.find((d: any) => d.id === id)?.name || id;
        if (type === 'job_title')  return jobTitles?.find((t: any)  => t.id === id)?.name || id;
        return `${type}:${id}`;
    };

    // エンティティ選択 UI（アプリACL・レコードACL共通）
    const EntitySelector = ({
        type, setType, id, setId, onAdd, label = 'ルール追加',
    }: {
        type: string; setType: (v: string) => void;
        id: string;   setId:   (v: string) => void;
        onAdd: () => void; label?: string;
    }) => (
        <div className="flex flex-wrap gap-2 items-end p-3 bg-muted/40 rounded-md">
            <div className="space-y-1 min-w-[120px]">
                <Label className="text-xs">種別</Label>
                <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="everyone">全員</SelectItem>
                        <SelectItem value="creator">作成者</SelectItem>
                        <SelectItem value="user">ユーザー</SelectItem>
                        <SelectItem value="department">部署</SelectItem>
                        <SelectItem value="job_title">役職</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {['user', 'department', 'job_title'].includes(type) && (
                <div className="space-y-1 min-w-[180px]">
                    <Label className="text-xs">対象</Label>
                    <Select value={id} onValueChange={setId}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="選択..." /></SelectTrigger>
                        <SelectContent>
                            {type === 'user' && users?.map((u: any) => (
                                <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                            ))}
                            {type === 'department' && departments?.map((d: any) => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                            {type === 'job_title' && jobTitles?.map((t: any) => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <Button size="sm" variant="outline" onClick={onAdd}>{label}</Button>
        </div>
    );

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

                {/* ─── アプリ権限タブ ─── */}
                <TabsContent value="app">
                    <Card>
                        <CardHeader>
                            <CardTitle>アプリアクセス制御</CardTitle>
                            <CardDescription>このアプリの閲覧・編集・削除・管理権限を設定します。ルールが空の場合はデフォルト（全員閲覧、作成者管理）が適用されます。</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <EntitySelector
                                type={appEntityType} setType={setAppEntityType}
                                id={appEntityId}     setId={setAppEntityId}
                                onAdd={addAppRule}   label="追加"
                            />

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>対象</TableHead>
                                        <TableHead className="text-center">閲覧</TableHead>
                                        <TableHead className="text-center">編集</TableHead>
                                        <TableHead className="text-center">削除</TableHead>
                                        <TableHead className="text-center">管理</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {appAcl.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-6">
                                                ルールなし（デフォルト: 全員閲覧、作成者管理）
                                            </TableCell>
                                        </TableRow>
                                    ) : appAcl.map((rule, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium">
                                                {entityName(rule.entity_type, rule.entity_id)}
                                            </TableCell>
                                            {(['allow_view', 'allow_edit', 'allow_delete', 'allow_manage'] as const).map(f => (
                                                <TableCell key={f} className="text-center">
                                                    <Checkbox
                                                        checked={!!rule[f]}
                                                        onCheckedChange={c => updateAppRule(idx, f, !!c)}
                                                    />
                                                </TableCell>
                                            ))}
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => removeAppRule(idx)}
                                                    className="text-destructive hover:text-destructive">
                                                    <X className="size-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── レコード権限タブ ─── */}
                <TabsContent value="record">
                    <Card>
                        <CardHeader>
                            <CardTitle>レコードアクセス制御</CardTitle>
                            <CardDescription>
                                フィールドの値に応じてレコードの閲覧権限を絞り込みます。条件に一致したルールの「閲覧許可対象」に含まれないユーザーはそのレコードを見られません。ルールがない場合は全員が閲覧できます。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button variant="outline" onClick={addRecordRule}>+ 条件ルールを追加</Button>

                            {recordAcl.length === 0 && (
                                <p className="text-sm text-muted-foreground">ルールなし（全レコードを全員が閲覧可能）</p>
                            )}

                            {recordAcl.map((rule, rIdx) => (
                                <div key={rIdx} className="border rounded-lg p-4 space-y-4 bg-muted/20">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-sm">ルール #{rIdx + 1}</span>
                                        <Button variant="ghost" size="sm" onClick={() => removeRecordRule(rIdx)}
                                            className="text-destructive hover:text-destructive">
                                            <X className="size-4 mr-1" />削除
                                        </Button>
                                    </div>

                                    {/* 条件 */}
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">適用条件（このフィールド値のときに権限を制限）</Label>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <Select
                                                value={rule.condition?.field ?? 'status'}
                                                onValueChange={v => updateCondition(rIdx, 'field', v)}
                                            >
                                                <SelectTrigger className="h-8 text-sm w-44">
                                                    <SelectValue placeholder="フィールド" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="status">ステータス</SelectItem>
                                                    {fields?.map(f => (
                                                        <SelectItem key={f.code} value={f.code}>{f.label}（{f.code}）</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Select
                                                value={rule.condition?.operator ?? '='}
                                                onValueChange={v => updateCondition(rIdx, 'operator', v)}
                                            >
                                                <SelectTrigger className="h-8 text-sm w-20">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="=">=（等しい）</SelectItem>
                                                    <SelectItem value="!=">≠（等しくない）</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            <Input
                                                className="h-8 text-sm w-40"
                                                placeholder="値を入力"
                                                value={rule.condition?.value ?? ''}
                                                onChange={e => updateCondition(rIdx, 'value', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* 閲覧許可対象 */}
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">閲覧を許可する対象</Label>
                                        <div className="flex flex-wrap gap-1.5 min-h-8">
                                            {(rule.permissions?.view ?? []).length === 0 && (
                                                <span className="text-xs text-muted-foreground">（未設定 = 誰も閲覧不可）</span>
                                            )}
                                            {(rule.permissions?.view ?? []).map((entity: any, eIdx: number) => (
                                                <span key={eIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
                                                    {entityName(entity.entity_type, entity.entity_id)}
                                                    <button
                                                        onClick={() => removeRecordEntity(rIdx, eIdx)}
                                                        className="hover:text-destructive ml-0.5"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>

                                        <EntitySelector
                                            type={recEntityType[rIdx] ?? 'creator'}
                                            setType={v => setRecEntityType(prev => ({ ...prev, [rIdx]: v }))}
                                            id={recEntityId[rIdx] ?? ''}
                                            setId={v => setRecEntityId(prev => ({ ...prev, [rIdx]: v }))}
                                            onAdd={() => addRecordEntity(rIdx)}
                                            label="許可対象を追加"
                                        />
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
