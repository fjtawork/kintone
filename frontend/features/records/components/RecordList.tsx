'use client';

import { useRecords, AppRecord } from '../api/useRecords';
import { useUpdateRecordStatus } from '../api/useUpdateRecordStatus';
import { Field } from '../../app-builder/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { getAvailableWorkflowActions, ProcessManagement } from '../workflow';
import { toast } from 'sonner';

interface RecordListProps {
    appId: string;
    fields: Field[];
    processManagement?: ProcessManagement;
    filters?: Record<string, unknown>;
}

export const RecordList = ({ appId, fields, processManagement, filters }: RecordListProps) => {
    const { data: records, isLoading, error } = useRecords(appId, filters);
    const { mutate: updateStatus } = useUpdateRecordStatus(appId);
    const router = useRouter();

    if (isLoading) {
        return <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>;
    }

    if (error) return <div className="text-red-500">レコードの読み込みに失敗しました。</div>;

    if (!records || records.length === 0) {
        return <div className="text-center p-10 border rounded-lg text-muted-foreground bg-zinc-50 dark:bg-zinc-900">
            レコードがありません。
        </div>
    }

    // Helper to render cell content based on field type
    const renderCell = (record: AppRecord, field: Field) => {
        const value = record.data[field.code];
        if (value === null || value === undefined) return '-';

        switch (field.type) {
            case 'DATE':
                try {
                    return format(new Date(value), 'yyyy-MM-dd');
                } catch { return String(value); }
            case 'DATETIME':
                try {
                    return format(new Date(value), 'yyyy-MM-dd p'); // Date + Time
                } catch { return String(value); }
            case 'CHECKBOX':
                return Array.isArray(value) ? value.join(', ') : String(value);
            case 'FILE':
                if (!value) return '-';
                // Value is the fileKey (e.g. uuid_filename.ext)
                const fileUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/static/uploads/${value}`;
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(value);

                return (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {isImage && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={fileUrl}
                                alt="thumb"
                                className="h-8 w-8 object-cover rounded border bg-white"
                            />
                        )}
                        <div className="flex flex-col text-xs">
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                表示
                            </a>
                            <a
                                href={fileUrl}
                                download
                                className="text-blue-600 hover:underline"
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

    const renderActions = (record: AppRecord) => {
        if (!processManagement?.enabled) return null;

        const actions = getAvailableWorkflowActions(processManagement, record.status);
        if (actions.length === 0) return <span className="text-xs text-muted-foreground">--</span>;

        return (
            <div className="flex gap-1">
                {actions.map((action, i: number) => (
                    <Button
                        key={i}
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            updateStatus(
                                { recordId: record.id, action: action.name },
                                {
                                    onSuccess: () => toast.success(`アクション「${action.name}」を実行しました`),
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
                        }}
                    >
                        {action.name}
                    </Button>
                ))}
            </div>
        );
    };

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[80px]">#</TableHead>
                        {fields.map(field => (
                            <TableHead key={field.id}>{field.label}</TableHead>
                        ))}
                        <TableHead>ステータス</TableHead>
                        {processManagement?.enabled && <TableHead>操作</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record) => (
                        <TableRow
                            key={record.id}
                            className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            onClick={() => router.push(`/apps/${appId}/records/${record.id}`)}
                        >
                            <TableCell className="font-medium">{record.record_number}</TableCell>
                            {fields.map(field => (
                                <TableCell key={field.id}>
                                    {renderCell(record, field)}
                                </TableCell>
                            ))}
                            <TableCell>{record.status}</TableCell>
                            {processManagement?.enabled && (
                                <TableCell>
                                    {renderActions(record)}
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
