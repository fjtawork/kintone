import { Field } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { useApps } from '@/features/apps/api/useApps';

interface PropertiesPanelProps {
    field: Field | null;
    onUpdate: (id: string, updates: Partial<Field>) => void;
}

export const PropertiesPanel = ({ field, onUpdate }: PropertiesPanelProps) => {
    const { data: apps } = useApps();

    if (!field) {
        return (
            <div className="p-4 text-center text-muted-foreground mt-10">
                <p>項目を選択すると詳細設定を編集できます。</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            <h2 className="font-semibold text-sm">項目プロパティ</h2>

            <div className="space-y-4">
                {/* Label */}
                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="label">項目名（表示ラベル）</Label>
                    <Input
                        type="text"
                        id="label"
                        value={field.label}
                        onChange={(e) => onUpdate(field.id, { label: e.target.value })}
                    />
                </div>

                {/* Field Code */}
                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="code">項目コード</Label>
                    <Input
                        type="text"
                        id="code"
                        value={field.code}
                        onChange={(e) => onUpdate(field.id, { code: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">APIで使用する一意の識別子です。</p>
                </div>

                {/* Layout Width */}
                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="columnSpan">横幅（列占有）</Label>
                    <Select
                        value={String(field.columnSpan || 1)}
                        onValueChange={(val) => onUpdate(field.id, { columnSpan: Number(val) })}
                    >
                        <SelectTrigger id="columnSpan">
                            <SelectValue placeholder="横幅を選択" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1列分</SelectItem>
                            <SelectItem value="2">2列分</SelectItem>
                            <SelectItem value="3">3列分</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">2列/3列レイアウト時に項目の横幅を調整します。</p>
                </div>

                {/* LABEL Specific: Text Content */}
                {field.type === 'LABEL' && (
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="defaultValue">ラベル本文</Label>
                        <Input
                            type="text"
                            id="defaultValue"
                            value={field.defaultValue as string || ''}
                            onChange={(e) => onUpdate(field.id, { defaultValue: e.target.value })}
                        />
                        <p className="text-[10px] text-muted-foreground">このテキストがフォーム上に表示されます。</p>
                    </div>
                )}

                {/* REFERENCE Specific: Target App */}
                {field.type === 'REFERENCE' && (
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="relatedAppId">参照先アプリ</Label>
                        <Select
                            value={field.relatedAppId}
                            onValueChange={(val) => onUpdate(field.id, { relatedAppId: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="アプリを選択" />
                            </SelectTrigger>
                            <SelectContent>
                                {apps?.map((app: any) => (
                                    <SelectItem key={app.id} value={app.id}>
                                        {app.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">関連付けるレコードの参照先アプリを選択します。</p>
                    </div>
                )}

                {/* USER_SELECTION Specific */}
                {field.type === 'USER_SELECTION' && (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="multiSelect"
                            checked={field.isMultiSelect}
                            onCheckedChange={(checked) => onUpdate(field.id, { isMultiSelect: checked === true })}
                        />
                        <Label htmlFor="multiSelect">複数選択を許可</Label>
                    </div>
                )}

                <Separator />

                {/* Required - Not applicable for LABEL */}
                {field.type !== 'LABEL' && (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="required"
                            checked={field.required}
                            onCheckedChange={(checked) => onUpdate(field.id, { required: checked === true })}
                        />
                        <Label htmlFor="required">必須項目</Label>
                    </div>
                )}

                <Separator />

                {/* Options Editor */}
                {['RADIO_BUTTON', 'CHECKBOX', 'DROP_DOWN'].includes(field.type) && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>選択肢</Label>
                            <div className="space-y-2">
                                {(field.options || []).map((option, index) => (
                                    <div key={index} className="flex gap-2">
                                        <Input
                                            value={option}
                                            onChange={(e) => {
                                                const newOptions = [...(field.options || [])];
                                                newOptions[index] = e.target.value;
                                                onUpdate(field.id, { options: newOptions });
                                            }}
                                            placeholder={`選択肢 ${index + 1}`}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const newOptions = field.options?.filter((_, i) => i !== index);
                                                onUpdate(field.id, { options: newOptions });
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => {
                                        const newOptions = [...(field.options || []), `選択肢 ${(field.options?.length || 0) + 1}`];
                                        onUpdate(field.id, { options: newOptions });
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" /> 選択肢を追加
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
