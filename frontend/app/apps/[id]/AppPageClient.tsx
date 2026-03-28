'use client';

import { useAppId } from '@/lib/useRouteParams';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useAuth } from '@/components/providers/AuthProvider';
import { getCurrentUser } from '@/features/users/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Download } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { RecordList } from '@/features/records/components/RecordList';
import { useState } from 'react';
import { RecordSearch } from '@/features/records/components/RecordSearch';
import { CreateRecordDialog } from '@/features/records/components/CreateRecordDialog';
import { Field } from '@/features/app-builder/types';

export default function AppPageClient() {
    const appId = useAppId();
    const [filters, setFilters] = useState({});
    const [isExporting, setIsExporting] = useState(false);
    const { isAuthenticated } = useAuth();

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: getCurrentUser,
        enabled: isAuthenticated,
        retry: false,
    });

    const { data: app, isLoading: isAppLoading } = useQuery({
        queryKey: ['app', appId],
        queryFn: async () => {
            const { data } = await api.get(`/apps/${appId}`);
            return data;
        },
    });

    const { data: fields, isLoading: isFieldsLoading } = useQuery({
        queryKey: ['fields', appId],
        queryFn: async () => {
            try {
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
            } catch {
                return [];
            }
        },
    });

    const handleExportCsv = async () => {
        setIsExporting(true);
        try {
            const response = await api.get(`/apps/${appId}/export/csv`, {
                responseType: 'blob',
            });
            const blob = new Blob([response.data], { type: 'text/csv; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const disposition = response.headers['content-disposition'];
            const match = disposition?.match(/filename="?([^"]+)"?/);
            a.download = match?.[1] || `${app?.name || 'export'}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('CSVエクスポートが完了しました');
        } catch {
            toast.error('CSVエクスポートに失敗しました');
        } finally {
            setIsExporting(false);
        }
    };

    if (isAppLoading || isFieldsLoading) return <div>アプリを読み込み中...</div>;

    return (
        <div className="container mx-auto py-6 px-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{app?.name}</h1>
                        <p className="text-muted-foreground">{app?.description || 'アプリダッシュボード'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <RecordSearch fields={fields || []} onSearch={setFilters} />
                    {currentUser?.is_superuser && (
                        <Button
                            variant="outline"
                            onClick={handleExportCsv}
                            disabled={isExporting}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            {isExporting ? 'エクスポート中...' : 'CSV出力'}
                        </Button>
                    )}
                    <Link href={`/apps/${appId}/settings`}>
                        <Button variant="outline">
                            <Settings className="mr-2 h-4 w-4" /> アプリ設定
                        </Button>
                    </Link>
                    <CreateRecordDialog
                        appId={appId}
                        fields={fields || []}
                        formColumns={app?.view_settings?.form_columns || 1}
                    />
                </div>
            </div>

            {/* Main Content */}
            {/* Main Content */}
            <RecordList
                appId={appId}
                fields={
                    app?.view_settings?.list_fields?.length > 0
                        ? (fields || []).filter((f: Field) => app.view_settings.list_fields.includes(f.code))
                        : (fields || [])
                }
                processManagement={app?.process_management}
                filters={filters}
            />
        </div>
    );
}
