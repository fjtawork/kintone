'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useRecord, useUpdateRecord } from '@/features/records/api/useRecord';
import { useUpdateRecordStatus } from '@/features/records/api/useUpdateRecordStatus';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DynamicForm } from '@/features/records/components/DynamicForm';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUsers } from '@/features/users/api/useUsers';
import {
    getAvailableWorkflowActions,
    type ProcessManagement,
    type WorkflowAction,
    requiresSingleSelection,
    resolveNextAssigneeCandidates,
} from '@/features/records/workflow';

type AppPermission = {
    edit?: boolean;
};

type AppDetails = {
    name: string;
    process_management?: ProcessManagement;
    user_permissions?: AppPermission;
    view_settings?: {
        form_columns?: number;
    };
};

type FieldDetails = {
    id: string;
    type: string;
    code: string;
    label: string;
    required?: boolean;
    options?: string[];
    defaultValue?: string | number | boolean;
    relatedAppId?: string;
    isMultiSelect?: boolean;
    columnSpan?: number;
};

export default function RecordDetailPage() {
    const params = useParams();
    const appId = params.id as string;
    const recordId = params.recordId as string;
    const [isEditing, setIsEditing] = useState(false);
    const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
    const [selectedAction, setSelectedAction] = useState<WorkflowAction | null>(null);
    const [nextAssigneeId, setNextAssigneeId] = useState<string>('');
    const [workflowComment, setWorkflowComment] = useState('');

    const { data: record, isLoading: isRecordLoading } = useRecord(recordId);
    const { data: users } = useUsers();

    // Fetch App for name and permissions
    const { data: app, isLoading: isAppLoading } = useQuery<AppDetails>({
        queryKey: ['app', appId],
        queryFn: async () => {
            const { data } = await api.get(`/apps/${appId}`);
            return data;
        },
        enabled: !!appId
    });

    const { data: fields, isLoading: isFieldsLoading } = useQuery<FieldDetails[]>({
        queryKey: ['fields', appId],
        queryFn: async () => {
            const { data } = await api.get(`/fields/app/${appId}`);
            return data.map((f: {
                id: string;
                type: string;
                code: string;
                label: string;
                config?: {
                    required?: boolean;
                    options?: string[];
                    defaultValue?: string | number | boolean;
                    relatedAppId?: string;
                    isMultiSelect?: boolean;
                    columnSpan?: number;
                };
            }) => ({
                id: f.id,
                type: f.type,
                code: f.code,
                label: f.label,
                required: f.config?.required,
                options: f.config?.options,
                defaultValue: f.config?.defaultValue,
                relatedAppId: f.config?.relatedAppId,
                isMultiSelect: f.config?.isMultiSelect,
                columnSpan: f.config?.columnSpan || 1,
            }));
        },
        enabled: !!appId
    });

    const { mutate: updateRecord, isPending: isSaving } = useUpdateRecord(appId, recordId);
    const { mutate: executeWorkflowAction, isPending: isExecutingWorkflow } = useUpdateRecordStatus(appId);

    if (isRecordLoading || isAppLoading || isFieldsLoading) return <div>読み込み中...</div>;
    if (!record || !app) return <div>レコードが見つかりません</div>;

    const canEdit = app.user_permissions?.edit ?? false;
    const formColumns = app?.view_settings?.form_columns || 1;
    const displayGridClass =
        formColumns >= 3
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
            : formColumns === 2
                ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
                : 'grid grid-cols-1 gap-6';
    const availableActions = getAvailableWorkflowActions(app?.process_management, record.status);
    const canOperateWorkflow = app?.process_management?.enabled && availableActions.length > 0;

    const runWorkflowAction = (action: WorkflowAction, selectedNextAssigneeId?: string, comment?: string) => {
        executeWorkflowAction(
            {
                recordId,
                action: action.name,
                nextAssigneeId: selectedNextAssigneeId,
                comment,
            },
            {
                onSuccess: () => {
                    toast.success(`アクション「${action.name}」を実行しました`);
                    setIsWorkflowDialogOpen(false);
                    setSelectedAction(null);
                    setNextAssigneeId('');
                    setWorkflowComment('');
                },
                onError: (error: unknown) => {
                    const message =
                        typeof error === 'object' &&
                        error !== null &&
                        'response' in error &&
                        typeof (error as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
                            ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
                            : 'ワークフローアクションの実行に失敗しました';
                    toast.error(message);
                }
            }
        );
    };

    const onActionClick = (action: WorkflowAction) => {
        const needsSelection = requiresSingleSelection(app?.process_management, action);
        const candidates = resolveNextAssigneeCandidates(app?.process_management, action, record);

        if (needsSelection && candidates.length > 1) {
            setSelectedAction(action);
            setNextAssigneeId(candidates[0]);
            setWorkflowComment('');
            setIsWorkflowDialogOpen(true);
            return;
        }

        const assignee = needsSelection && candidates.length === 1 ? candidates[0] : undefined;
        runWorkflowAction(action, assignee);
    };

    const workflowCandidates = selectedAction
        ? resolveNextAssigneeCandidates(app?.process_management, selectedAction, record)
        : [];
    const workflowHistory = record.workflow_history || [];
    const currentApprovers = record.workflow_approver_ids || [];

    const getUserLabel = (userId: string) => {
        const user = users?.find((item) => item.id === userId);
        return user?.full_name || user?.email || userId;
    };

    const handleSave = (data: Record<string, unknown>) => {
        updateRecord({ data }, {
            onSuccess: () => {
                toast.success('レコードを更新しました');
                setIsEditing(false);
            },
            onError: () => {
                toast.error('レコードの更新に失敗しました');
            }
        });
    };

    const renderFieldValue = (field: FieldDetails, value: unknown) => {
        if (value === null || value === undefined) return '-';
        switch (field.type) {
            case 'DATE':
                try { return format(new Date(value), 'yyyy-MM-dd'); } catch { return String(value); }
            case 'DATETIME':
                try { return format(new Date(value), 'yyyy-MM-dd p'); } catch { return String(value); }
            case 'CHECKBOX':
                return Array.isArray(value) ? value.join(', ') : String(value);
            case 'FILE':
                if (!value) return '-';
                const fileUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/static/uploads/${value}`;
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(value);

                return (
                    <div className="space-y-2">
                        {isImage && (
                            <div className="relative w-full max-w-sm h-48 border rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={fileUrl}
                                    alt="添付ファイル"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        )}
                        <div className="flex gap-4 text-sm">
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                                ファイルを表示
                            </a>
                            <a
                                href={fileUrl}
                                download
                                className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                                ダウンロード
                            </a>
                        </div>
                    </div>
                );
            default:
                return String(value);
        }
    };

    // Prepare default values for form. 
    // DynamicForm expects flat object for simple fields.
    // We pass record.data directly.
    // However, we need to handle if some fields are missing in data but present in schema.

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="flex items-center gap-4 mb-8">
                <Link href={`/apps/${appId}`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">レコード #{record.record_number}</h1>
                    <p className="text-muted-foreground">{app.name} &bull; {record.status}</p>
                </div>

                {canEdit && !isEditing && (
                    <Button onClick={() => setIsEditing(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        編集
                    </Button>
                )}
                {isEditing && (
                    <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
                        <X className="mr-2 h-4 w-4" />
                        キャンセル
                    </Button>
                )}
            </div>

            {canOperateWorkflow && (
                <div className="bg-white dark:bg-zinc-950 border rounded-lg p-4 shadow-sm mb-6">
                    <p className="text-sm font-medium mb-3">ワークフロー操作</p>
                    <div className="flex flex-wrap gap-2">
                        {availableActions.map((action) => (
                            <Button
                                key={`${record.id}-${action.name}`}
                                variant="outline"
                                onClick={() => onActionClick(action)}
                                disabled={isExecutingWorkflow}
                            >
                                {action.name}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-zinc-950 border rounded-lg p-6 shadow-sm mb-6">
                <h2 className="text-lg font-semibold mb-3">ワークフロー履歴</h2>
                <div className="space-y-2 mb-4 text-sm">
                    <p>
                        <span className="text-muted-foreground mr-2">申請者:</span>
                        <span>{record.workflow_requester_id ? getUserLabel(record.workflow_requester_id) : '-'}</span>
                    </p>
                    <p>
                        <span className="text-muted-foreground mr-2">現在の承認者:</span>
                        <span>
                            {currentApprovers.length > 0
                                ? currentApprovers.map((id) => getUserLabel(id)).join(', ')
                                : '-'}
                        </span>
                    </p>
                </div>
                {workflowHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">まだワークフロー操作は実行されていません。</p>
                ) : (
                    <div className="space-y-3">
                        {workflowHistory
                            .slice()
                            .reverse()
                            .map((event, index) => (
                                <div key={`${event.at}-${event.actor_id}-${index}`} className="border rounded-md p-3">
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="font-medium">{event.action}</span>
                                        <span className="text-muted-foreground">実行者: {getUserLabel(event.actor_id)}</span>
                                        <span className="text-muted-foreground">
                                            実行日時: {format(new Date(event.at), 'yyyy-MM-dd HH:mm')}
                                        </span>
                                    </div>
                                    {event.comment && (
                                        <p className="mt-1 text-sm text-muted-foreground">{event.comment}</p>
                                    )}
                                </div>
                            ))}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-950 border rounded-lg p-6 shadow-sm">
                {isEditing ? (
                    <div>
                        <DynamicForm
                            fields={fields || []}
                            onSubmit={handleSave}
                            isSubmitting={isSaving}
                            defaultValues={record.data}
                            columns={formColumns}
                            submitLabel="更新"
                        />
                    </div>
                ) : (
                    <div className={displayGridClass}>
                        {fields?.map((field) => (
                            <div key={field.id} className="space-y-1">
                                <span className="text-sm font-medium text-muted-foreground">{field.label}</span>
                                <div className="text-base">
                                    {renderFieldValue(field, record.data[field.code])}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedAction?.name}</DialogTitle>
                        <DialogDescription>
                            このステップは担当者を1人選択する必要があります。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">次の担当者</p>
                            <Select value={nextAssigneeId} onValueChange={setNextAssigneeId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="担当者を選択" />
                                </SelectTrigger>
                                <SelectContent>
                                    {workflowCandidates.map((userId) => {
                                        const user = users?.find((u) => u.id === userId);
                                        const label = user?.full_name || user?.email || userId;
                                        return (
                                            <SelectItem key={userId} value={userId}>
                                                {label}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">コメント（任意）</p>
                            <Textarea
                                value={workflowComment}
                                onChange={(e) => setWorkflowComment(e.target.value)}
                                placeholder="コメントを入力..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsWorkflowDialogOpen(false)}
                            disabled={isExecutingWorkflow}
                        >
                            キャンセル
                        </Button>
                        <Button
                            onClick={() => selectedAction && runWorkflowAction(selectedAction, nextAssigneeId, workflowComment)}
                            disabled={!nextAssigneeId || isExecutingWorkflow}
                        >
                            {isExecutingWorkflow ? '処理中...' : '実行'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
