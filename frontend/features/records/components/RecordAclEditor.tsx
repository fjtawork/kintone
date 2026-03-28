'use client';

import { useState } from 'react';
import { useUsers } from '@/features/users/api/useUsers';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, Globe, X } from 'lucide-react';

export interface RecordAcl {
    enabled: boolean;
    view: { entity_type: 'creator' | 'user'; entity_id: string | null }[];
}

interface RecordAclEditorProps {
    value: RecordAcl | null;
    onChange: (acl: RecordAcl | null) => void;
}

export const defaultAcl = (): RecordAcl => ({
    enabled: true,
    view: [{ entity_type: 'creator', entity_id: null }],
});

export const RecordAclEditor = ({ value, onChange }: RecordAclEditorProps) => {
    const { data: users } = useUsers();
    const [selectedUserId, setSelectedUserId] = useState('');

    const enabled = value?.enabled ?? false;
    const viewEntities = value?.view ?? [];

    const toggle = () => {
        if (enabled) {
            onChange(null); // 制限なし
        } else {
            onChange(defaultAcl());
        }
    };

    const addUser = () => {
        if (!selectedUserId) return;
        if (viewEntities.some(e => e.entity_type === 'user' && e.entity_id === selectedUserId)) return;
        onChange({
            enabled: true,
            view: [...viewEntities, { entity_type: 'user', entity_id: selectedUserId }],
        });
        setSelectedUserId('');
    };

    const removeEntity = (index: number) => {
        const next = viewEntities.filter((_, i) => i !== index);
        onChange({ enabled: true, view: next });
    };

    const getUserLabel = (id: string | null) => {
        if (!id) return '';
        const u = users?.find(u => u.id === id);
        return u?.full_name || u?.email || id;
    };

    // 追加済みユーザーID一覧（ピッカーから除外）
    const addedUserIds = viewEntities
        .filter(e => e.entity_type === 'user')
        .map(e => e.entity_id);

    const availableUsers = users?.filter(u => !addedUserIds.includes(u.id)) ?? [];

    return (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {enabled ? <Lock className="size-4 text-amber-500" /> : <Globe className="size-4 text-muted-foreground" />}
                    <Label className="text-sm font-medium">閲覧制限</Label>
                </div>
                <button
                    type="button"
                    onClick={toggle}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
            </div>

            {!enabled && (
                <p className="text-xs text-muted-foreground">全員が閲覧できます。制限するにはオンにしてください。</p>
            )}

            {enabled && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">以下のユーザーのみ閲覧できます：</p>

                    {/* 許可済みエンティティ */}
                    <div className="flex flex-wrap gap-1.5 min-h-6">
                        {viewEntities.length === 0 && (
                            <span className="text-xs text-destructive">（誰も閲覧できません）</span>
                        )}
                        {viewEntities.map((entity, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                                {entity.entity_type === 'creator'
                                    ? '作成者（自分）'
                                    : getUserLabel(entity.entity_id)}
                                {entity.entity_type !== 'creator' && (
                                    <button type="button" onClick={() => removeEntity(i)} className="hover:text-destructive">
                                        <X className="size-3" />
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>

                    {/* ユーザー追加 */}
                    <div className="flex gap-2 items-center">
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger className="h-8 text-sm flex-1">
                                <SelectValue placeholder="ユーザーを追加..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableUsers.map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.full_name || u.email}
                                    </SelectItem>
                                ))}
                                {availableUsers.length === 0 && (
                                    <SelectItem value="_none" disabled>追加できるユーザーがいません</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        <Button type="button" size="sm" variant="outline" onClick={addUser} disabled={!selectedUserId}>
                            追加
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
