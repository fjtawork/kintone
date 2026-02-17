'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useUsers } from '@/features/users/api/useUsers';
import { getDepartments, getJobTitles } from '@/features/organization/api';

type WorkflowStatus = {
    name: string;
    assignee?: WorkflowAssignee;
};

type WorkflowAction = {
    name: string;
    from: string;
    to: string;
};

type WorkflowEntityType = 'user' | 'department' | 'job_title';

type WorkflowEntity = {
    entity_type: WorkflowEntityType;
    entity_id: string;
};

type WorkflowAssigneeType = 'creator' | 'users' | 'field' | 'entities';
type WorkflowSelection = 'all' | 'single';

type WorkflowAssignee = {
    type?: WorkflowAssigneeType;
    selection?: WorkflowSelection;
    user_ids?: string[];
    field_code?: string;
    entities?: WorkflowEntity[];
};

type AppField = {
    code: string;
    label: string;
    type?: string;
};

interface ProcessManagementSettingsProps {
    appId: string;
    fields?: AppField[];
    settings?: {
        enabled?: boolean;
        statuses?: WorkflowStatus[];
        actions?: WorkflowAction[];
    };
}

const normalizeStatus = (status: WorkflowStatus): WorkflowStatus => ({
    name: status.name || '',
    assignee: {
        type: status.assignee?.type,
        selection: status.assignee?.selection || 'all',
        user_ids: status.assignee?.user_ids || [],
        field_code: status.assignee?.field_code || '',
        entities: status.assignee?.entities || [],
    }
});

export const ProcessManagementSettings = ({ appId, fields = [], settings }: ProcessManagementSettingsProps) => {
    const { data: users } = useUsers();
    const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: getDepartments });
    const { data: jobTitles } = useQuery({ queryKey: ['job_titles'], queryFn: getJobTitles });

    const [enabled, setEnabled] = useState(settings?.enabled || false);
    const [statuses, setStatuses] = useState<WorkflowStatus[]>(
        (settings?.statuses || []).map(normalizeStatus)
    );
    const [actions, setActions] = useState<WorkflowAction[]>(settings?.actions || []);
    const queryClient = useQueryClient();
    const assigneeFieldCandidates = fields.filter((field) => field.type === 'USER_SELECTION');
    const hasUsers = (users?.length || 0) > 0;
    const hasEntities = (users?.length || 0) + (departments?.length || 0) + (jobTitles?.length || 0) > 0;

    const mutation = useMutation({
        mutationFn: async (newSettings: { enabled: boolean; statuses: WorkflowStatus[]; actions: WorkflowAction[] }) => {
            await api.put(`/apps/${appId}/process`, newSettings);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['app', appId] });
            toast.success('プロセス設定を保存しました');
        },
        onError: (error: unknown) => {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'response' in error &&
                typeof (error as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
                    ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : 'プロセス設定の保存に失敗しました';
            toast.error(message);
        }
    });

    const handleSave = () => {
        const assigneeFieldCodes = new Set(assigneeFieldCandidates.map((field) => field.code));
        for (const status of statuses) {
            if (status.assignee?.type === 'users') {
                const selectedUsers = (status.assignee.user_ids || []).filter(Boolean);
                if (selectedUsers.length === 0) {
                    toast.error(`ステータス「${status.name || '(名称未設定)'}」で担当ユーザーを1人以上選択してください`);
                    return;
                }
            }
            if (status.assignee?.type === 'field') {
                const fieldCode = (status.assignee.field_code || '').trim();
                if (!fieldCode) {
                    toast.error(`ステータス「${status.name || '(名称未設定)'}」の担当者フィールドを選択してください`);
                    return;
                }
                if (!assigneeFieldCodes.has(fieldCode)) {
                    toast.error('担当者タイプ「フィールド」ではユーザー選択フィールドのみ指定できます');
                    return;
                }
            }
            if (status.assignee?.type === 'entities') {
                const selectedEntities = (status.assignee.entities || []).filter(
                    (entity) => entity.entity_type && entity.entity_id
                );
                if (selectedEntities.length === 0) {
                    toast.error(`ステータス「${status.name || '(名称未設定)'}」で組織エンティティを1つ以上指定してください`);
                    return;
                }
            }
        }

        const normalizedStatuses = statuses
            .map((status) => {
                const type = status.assignee?.type;
                const selection = status.assignee?.selection || 'all';
                const userIds = (status.assignee?.user_ids || []).filter(Boolean);
                const entities = (status.assignee?.entities || []).filter((entity) => entity.entity_id && entity.entity_type);
                const fieldCode = (status.assignee?.field_code || '').trim();

                let assignee: WorkflowAssignee = {};
                if (type === 'creator') {
                    assignee = { type: 'creator' };
                } else if (type === 'users') {
                    assignee = { type: 'users', selection, user_ids: userIds };
                } else if (type === 'field') {
                    assignee = { type: 'field', selection, field_code: fieldCode };
                } else if (type === 'entities') {
                    assignee = { type: 'entities', selection, entities };
                }

                return {
                    name: status.name.trim(),
                    assignee
                };
            })
            .filter((status) => status.name.length > 0);

        const normalizedActions = actions
            .map((action) => ({
                name: action.name.trim(),
                from: action.from.trim(),
                to: action.to.trim(),
            }))
            .filter((action) => action.name && action.from && action.to);

        if (enabled && normalizedStatuses.length === 0) {
            toast.error('ステータスを1つ以上設定してください');
            return;
        }

        mutation.mutate({
            enabled,
            statuses: normalizedStatuses,
            actions: normalizedActions
        });
    };

    const addStatus = () => {
        setStatuses([
            ...statuses,
            normalizeStatus({
                name: '新規ステータス',
                assignee: {}
            })
        ]);
    };

    const removeStatus = (index: number) => {
        setStatuses(statuses.filter((_, i) => i !== index));
    };

    const updateStatus = (index: number, name: string) => {
        const newStatuses = [...statuses];
        newStatuses[index].name = name;
        setStatuses(newStatuses);
    };

    const updateStatusAssignee = (index: number, patch: Partial<WorkflowAssignee>) => {
        const nextStatuses = [...statuses];
        const current = normalizeStatus(nextStatuses[index]);
        nextStatuses[index] = {
            ...current,
            assignee: {
                ...current.assignee,
                ...patch,
            }
        };
        setStatuses(nextStatuses);
    };

    const setStatusAssigneeType = (index: number, rawType: string) => {
        if (rawType === 'users' && !hasUsers) {
            toast.error('利用可能なユーザーがいないため、担当者タイプ「ユーザー」は選択できません');
            return;
        }
        if (rawType === 'field' && assigneeFieldCandidates.length === 0) {
            toast.error('ユーザー選択フィールドがありません。先にフォーム項目を追加してください');
            return;
        }
        if (rawType === 'entities' && !hasEntities) {
            toast.error('組織エンティティ（ユーザー/部署/役職）がないため選択できません');
            return;
        }

        const type = rawType === 'none' ? undefined : (rawType as WorkflowAssigneeType);
        const base: WorkflowAssignee = {
            type,
            selection: 'all',
            user_ids: [],
            field_code: '',
            entities: [],
        };
        if (type === 'creator') {
            base.selection = undefined;
        }
        updateStatusAssignee(index, base);
    };

    const toggleStatusUser = (statusIndex: number, userId: string, checked: boolean) => {
        const current = normalizeStatus(statuses[statusIndex]);
        const currentIds = current.assignee?.user_ids || [];
        const nextIds = checked
            ? [...new Set([...currentIds, userId])]
            : currentIds.filter((id) => id !== userId);
        updateStatusAssignee(statusIndex, { user_ids: nextIds });
    };

    const addEntity = (statusIndex: number) => {
        const current = normalizeStatus(statuses[statusIndex]);
        const nextEntities = [...(current.assignee?.entities || []), { entity_type: 'user', entity_id: '' } satisfies WorkflowEntity];
        updateStatusAssignee(statusIndex, { entities: nextEntities });
    };

    const updateEntity = (statusIndex: number, entityIndex: number, patch: Partial<WorkflowEntity>) => {
        const current = normalizeStatus(statuses[statusIndex]);
        const nextEntities = [...(current.assignee?.entities || [])];
        nextEntities[entityIndex] = { ...nextEntities[entityIndex], ...patch };
        if (patch.entity_type) {
            nextEntities[entityIndex].entity_id = '';
        }
        updateStatusAssignee(statusIndex, { entities: nextEntities });
    };

    const removeEntity = (statusIndex: number, entityIndex: number) => {
        const current = normalizeStatus(statuses[statusIndex]);
        const nextEntities = (current.assignee?.entities || []).filter((_, idx) => idx !== entityIndex);
        updateStatusAssignee(statusIndex, { entities: nextEntities });
    };

    const addAction = () => {
        const defaultFrom = statuses[0]?.name || '';
        const defaultTo = statuses[1]?.name || statuses[0]?.name || '';
        setActions([
            ...actions,
            {
                name: '新規アクション',
                from: defaultFrom,
                to: defaultTo,
            }
        ]);
    };

    const removeAction = (index: number) => {
        setActions(actions.filter((_, i) => i !== index));
    };

    const updateAction = (index: number, patch: Partial<WorkflowAction>) => {
        const next = [...actions];
        next[index] = { ...next[index], ...patch };
        setActions(next);
    };

    const availableStatusNames = statuses
        .map((status) => status.name.trim())
        .filter((name) => name.length > 0);

    const ensureDefaultActions = (sourceStatuses: WorkflowStatus[]) => {
        if (actions.length > 0) return;
        const names = sourceStatuses.map((status) => status.name.trim()).filter((name) => name.length > 0);
        if (names.length < 2) return;

        const defaults: WorkflowAction[] = [];
        defaults.push({
            name: '開始する',
            from: names[0],
            to: names[1],
        });
        if (names.length >= 3) {
            defaults.push({
                name: '完了する',
                from: names[1],
                to: names[2],
            });
        }
        setActions(defaults);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>プロセス管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center space-x-2">
                    <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => {
                            setEnabled(checked);
                            if (checked) {
                                ensureDefaultActions(statuses);
                            }
                        }}
                    />
                    <Label>プロセス管理を有効化</Label>
                </div>

                {enabled && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-medium mb-2">ステータス</h3>
                            {statuses.map((status, index) => (
                                <div key={index} className="mb-3 rounded-md border p-3 space-y-3">
                                    <div className="flex gap-2">
                                        <Input
                                            value={status.name}
                                            onChange={(e) => updateStatus(index, e.target.value)}
                                            placeholder="ステータス名"
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => removeStatus(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">担当者タイプ</Label>
                                            <Select
                                                value={status.assignee?.type || 'none'}
                                                onValueChange={(value) => setStatusAssigneeType(index, value)}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="担当者タイプを選択" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">なし</SelectItem>
                                                    <SelectItem value="creator">作成者</SelectItem>
                                                    <SelectItem value="users" disabled={!hasUsers}>
                                                        ユーザー{!hasUsers ? '（利用不可）' : ''}
                                                    </SelectItem>
                                                    <SelectItem value="field" disabled={assigneeFieldCandidates.length === 0}>
                                                        フィールド{assigneeFieldCandidates.length === 0 ? '（利用不可）' : ''}
                                                    </SelectItem>
                                                    <SelectItem value="entities" disabled={!hasEntities}>
                                                        組織エンティティ{!hasEntities ? '（利用不可）' : ''}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {status.assignee?.type && status.assignee.type !== 'creator' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">選択方法</Label>
                                                <Select
                                                    value={status.assignee?.selection || 'all'}
                                                    onValueChange={(value) => updateStatusAssignee(index, { selection: value as WorkflowSelection })}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="選択方法を選択" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">全員</SelectItem>
                                                        <SelectItem value="single">1人</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>

                                    {status.assignee?.type === 'users' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">ユーザー</Label>
                                            <div className="max-h-44 overflow-auto border rounded-md p-2 space-y-2">
                                                {users?.map((user) => {
                                                    const selected = (status.assignee?.user_ids || []).includes(user.id);
                                                    return (
                                                        <label key={user.id} className="flex items-center justify-between gap-2 text-sm">
                                                            <span>{user.full_name || user.email}</span>
                                                            <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                onChange={(e) => toggleStatusUser(index, user.id, e.target.checked)}
                                                            />
                                                        </label>
                                                    );
                                                })}
                                                {!users?.length && (
                                                    <p className="text-xs text-muted-foreground">利用可能なユーザーがいません。</p>
                                                )}
                                            </div>
                                            {(status.assignee?.user_ids || []).length === 0 && (
                                                <p className="text-xs text-amber-600">担当ユーザーを1人以上選択してください。</p>
                                            )}
                                        </div>
                                    )}

                                    {status.assignee?.type === 'field' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">フィールドコード</Label>
                                            <Select
                                                value={status.assignee?.field_code || undefined}
                                                onValueChange={(value) => updateStatusAssignee(index, { field_code: value })}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="フィールドコードを選択" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {assigneeFieldCandidates.map((field) => (
                                                        <SelectItem key={field.code} value={field.code}>
                                                            {field.label} ({field.code})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {assigneeFieldCandidates.length === 0 && (
                                                <p className="text-xs text-amber-600">
                                                    ユーザー選択フィールドがありません。フォームで「ユーザー選択」フィールドを追加してください。
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {status.assignee?.type === 'entities' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs text-muted-foreground">組織エンティティ</Label>
                                                <Button variant="outline" size="sm" onClick={() => addEntity(index)}>
                                                    <Plus className="mr-2 h-4 w-4" /> 追加
                                                </Button>
                                            </div>
                                            <div className="space-y-2">
                                                {(status.assignee?.entities || []).map((entity, entityIndex) => (
                                                    <div key={`${index}-${entityIndex}`} className="grid grid-cols-1 md:grid-cols-[180px_1fr_44px] gap-2 items-center">
                                                        <Select
                                                            value={entity.entity_type}
                                                            onValueChange={(value) => updateEntity(index, entityIndex, { entity_type: value as WorkflowEntityType })}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="種別" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="user">ユーザー</SelectItem>
                                                                <SelectItem value="department">部署</SelectItem>
                                                                <SelectItem value="job_title">役職</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Select
                                                            value={entity.entity_id || undefined}
                                                            onValueChange={(value) => updateEntity(index, entityIndex, { entity_id: value })}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="対象" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {entity.entity_type === 'user' && users?.map((user) => (
                                                                    <SelectItem key={user.id} value={user.id}>
                                                                        {user.full_name || user.email}
                                                                    </SelectItem>
                                                                ))}
                                                                {entity.entity_type === 'department' && departments?.map((department) => (
                                                                    <SelectItem key={department.id} value={department.id}>
                                                                        {department.name}
                                                                    </SelectItem>
                                                                ))}
                                                                {entity.entity_type === 'job_title' && jobTitles?.map((title) => (
                                                                    <SelectItem key={title.id} value={title.id}>
                                                                        {title.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Button variant="ghost" size="icon" onClick={() => removeEntity(index, entityIndex)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                            {(status.assignee?.entities || []).filter((entity) => entity.entity_id && entity.entity_type).length === 0 && (
                                                <p className="text-xs text-amber-600">組織エンティティを1つ以上指定してください。</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={addStatus}>
                                <Plus className="mr-2 h-4 w-4" /> ステータス追加
                            </Button>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium mb-2">アクション</h3>
                            <div className="space-y-3">
                                {actions.map((action, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_160px_160px_44px] gap-2 items-center">
                                        <Input
                                            placeholder="アクション名"
                                            value={action.name}
                                            onChange={(e) => updateAction(index, { name: e.target.value })}
                                        />
                                        <Select
                                            value={action.from || undefined}
                                            onValueChange={(value) => updateAction(index, { from: value })}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="遷移元" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableStatusNames.map((statusName, statusIndex) => (
                                                    <SelectItem key={`${statusName}-${statusIndex}`} value={statusName}>
                                                        {statusName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={action.to || undefined}
                                            onValueChange={(value) => updateAction(index, { to: value })}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="遷移先" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableStatusNames.map((statusName, statusIndex) => (
                                                    <SelectItem key={`${statusName}-${statusIndex}`} value={statusName}>
                                                        {statusName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" onClick={() => removeAction(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" size="sm" onClick={addAction} className="mt-3">
                                <Plus className="mr-2 h-4 w-4" /> アクション追加
                            </Button>
                        </div>

                        <Button onClick={handleSave} disabled={mutation.isPending}>
                            {mutation.isPending ? '保存中...' : '設定を保存'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
