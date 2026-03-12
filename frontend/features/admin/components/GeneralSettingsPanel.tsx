'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useSystemSettings, useUpdateSystemSettings } from '../api/useSystemSettings';
import { Skeleton } from '@/components/ui/skeleton';

export const GeneralSettingsPanel = () => {
    const { data: settings, isLoading } = useSystemSettings();
    const { mutate: updateSettings, isPending } = useUpdateSystemSettings();

    const [orgName, setOrgName] = useState('');
    const [signupEnabled, setSignupEnabled] = useState(true);
    const [sessionTimeout, setSessionTimeout] = useState(24);

    useEffect(() => {
        if (settings) {
            setOrgName(settings.organization_name ?? '');
            setSignupEnabled(settings.signup_enabled ?? true);
            setSessionTimeout(settings.session_timeout_hours ?? 24);
        }
    }, [settings]);

    const handleSave = () => {
        updateSettings(
            {
                organization_name: orgName,
                signup_enabled: signupEnabled,
                session_timeout_hours: sessionTimeout,
            },
            {
                onSuccess: () => toast.success('設定を保存しました'),
                onError: () => toast.error('保存に失敗しました'),
            }
        );
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-lg">
            <div className="space-y-2">
                <Label>組織名</Label>
                <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="組織名を入力..."
                />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
                <div>
                    <p className="text-sm font-medium">新規ユーザー登録</p>
                    <p className="text-xs text-muted-foreground">無効にするとサインアップページへのアクセスを禁止します</p>
                </div>
                <Switch checked={signupEnabled} onCheckedChange={setSignupEnabled} />
            </div>

            <div className="space-y-2 border-t pt-3">
                <Label>セッションタイムアウト（時間）</Label>
                <Input
                    type="number"
                    min={1}
                    max={720}
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(Number(e.target.value))}
                    className="w-32"
                />
                <p className="text-xs text-muted-foreground">JWTトークンの有効期限（時間）。変更は次回ログイン時から適用されます。</p>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? '保存中...' : '設定を保存'}
                </Button>
            </div>
        </div>
    );
};
