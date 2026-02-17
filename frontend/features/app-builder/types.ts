export type FieldType = 'SINGLE_LINE_TEXT' | 'NUMBER' | 'MULTI_LINE_TEXT' | 'DATE' | 'DATETIME' | 'CHECKBOX' | 'RADIO_BUTTON' | 'DROP_DOWN' | 'FILE' | 'LABEL' | 'LINK' | 'REFERENCE' | 'USER_SELECTION';

export interface Field {
    id: string; // Internal temporary ID for the builder
    type: FieldType;
    code: string;
    label: string;
    required?: boolean;
    options?: string[]; // For Checkbox, Radio, Dropdown
    defaultValue?: string | number | boolean;
    relatedAppId?: string; // For Reference field
    isMultiSelect?: boolean; // For User Selection (and potentially others)
    columnSpan?: number; // 1-3 columns in multi-column layouts
}

export const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
    { type: 'SINGLE_LINE_TEXT', label: '1行テキスト', icon: 'Type' },
    { type: 'MULTI_LINE_TEXT', label: '複数行テキスト', icon: 'AlignLeft' },
    { type: 'NUMBER', label: '数値', icon: 'Hash' },
    { type: 'DATE', label: '日付', icon: 'Calendar' },
    { type: 'DATETIME', label: '日時', icon: 'Clock' },
    { type: 'CHECKBOX', label: 'チェックボックス', icon: 'CheckSquare' },
    { type: 'RADIO_BUTTON', label: 'ラジオボタン', icon: 'CircleDot' },
    { type: 'DROP_DOWN', label: 'ドロップダウン', icon: 'ChevronDown' },
    { type: 'FILE', label: 'ファイル添付', icon: 'Paperclip' },
    { type: 'LABEL', label: 'ラベル', icon: 'FileType' },
    { type: 'LINK', label: 'リンク', icon: 'Link' },
    { type: 'REFERENCE', label: '関連レコード', icon: 'Database' },
    { type: 'USER_SELECTION', label: 'ユーザー選択', icon: 'Users' },
];
