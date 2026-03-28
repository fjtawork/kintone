'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAppJs, updateAppJs } from '@/features/customize/api';
import { CodeEditor } from './CodeEditor';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

interface AppJsEditorProps {
    appId: string;
}

export function AppJsEditor({ appId }: AppJsEditorProps) {
    const [code, setCode] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    const { data: jsCode, isLoading } = useQuery({
        queryKey: ['customAppJs', appId],
        queryFn: () => getAppJs(appId),
        enabled: !!appId,
    });

    useEffect(() => {
        if (jsCode !== undefined) {
            setCode(jsCode);
        }
    }, [jsCode]);

    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: () => updateAppJs(appId, code),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customAppJs', appId] });
            setHasChanges(false);
            toast.success('JavaScriptコードを保存しました');
        },
        onError: () => {
            toast.error('保存に失敗しました');
        },
    });

    return (
        <div className="border p-4 rounded-md">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="font-semibold">JavaScriptカスタマイズ</h2>
                    <p className="text-sm text-muted-foreground">このアプリのページでのみ実行されるJavaScriptを編集します。</p>
                </div>
                <Button
                    onClick={() => mutation.mutate()}
                    disabled={!hasChanges || mutation.isPending}
                    size="sm"
                >
                    <Save className="mr-2 h-4 w-4" />
                    {mutation.isPending ? '保存中...' : '保存'}
                </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
                {isLoading ? (
                    <div className="h-[400px] flex items-center justify-center">読み込み中...</div>
                ) : (
                    <CodeEditor
                        value={code}
                        onChange={(val) => {
                            setCode(val);
                            setHasChanges(true);
                        }}
                        language="javascript"
                        height="400px"
                    />
                )}
            </div>
        </div>
    );
}
