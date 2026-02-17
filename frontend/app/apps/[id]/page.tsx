'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';

import { RecordList } from '@/features/records/components/RecordList';
import { useState } from 'react';
import { RecordSearch } from '@/features/records/components/RecordSearch';
import { CreateRecordDialog } from '@/features/records/components/CreateRecordDialog';
import { Field } from '@/features/app-builder/types';

export default function AppDashboardPage() {
    const params = useParams();
    const appId = params.id as string;
    const [filters, setFilters] = useState({});

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
