'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import { getCurrentUser } from '@/features/users/api';
import { getCustomPhp, updateCustomPhp } from '@/features/customize/api';
import { CodeEditor } from '@/features/customize/components/CodeEditor';
import { PhpHookReference } from '@/features/customize/components/PhpHookReference';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function PhpEditorClient() {
    const { isAuthenticated } = useAuth();
    const [code, setCode] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    const { data: currentUser, isLoading: isUserLoading } = useQuery({
        queryKey: ['currentUser'],
        queryFn: getCurrentUser,
        enabled: isAuthenticated,
        retry: false,
    });

    const { data: phpCode, isLoading: isCodeLoading } = useQuery({
        queryKey: ['customPhp'],
        queryFn: getCustomPhp,
        enabled: !!currentUser?.is_superuser,
    });

    useEffect(() => {
        if (phpCode !== undefined) {
            setCode(phpCode);
        }
    }, [phpCode]);

    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: () => updateCustomPhp(code),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customPhp'] });
            setHasChanges(false);
            toast.success('PHPコードを保存しました');
        },
        onError: () => {
            toast.error('保存に失敗しました');
        },
    });

    if (isUserLoading) return <div>読み込み中...</div>;
    if (!currentUser?.is_superuser) {
        return <div className="text-destructive p-4">管理者権限が必要です。</div>;
    }

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">PHPカスタマイズ</h1>
                    <p className="text-muted-foreground mt-1">
                        custom/functions.php を編集します。サーバーサイドのフック処理を記述できます。
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/admin/customize/js">JavaScript</Link>
                    </Button>
                    <Button
                        onClick={() => mutation.mutate()}
                        disabled={!hasChanges || mutation.isPending}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        {mutation.isPending ? '保存中...' : '保存'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 border rounded-lg overflow-hidden">
                    {isCodeLoading ? (
                        <div className="h-[500px] flex items-center justify-center">読み込み中...</div>
                    ) : (
                        <CodeEditor
                            value={code}
                            onChange={(val) => {
                                setCode(val);
                                setHasChanges(true);
                            }}
                            language="php"
                        />
                    )}
                </div>
                <div className="lg:col-span-1">
                    <PhpHookReference />
                </div>
            </div>
        </div>
    );
}
