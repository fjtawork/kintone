'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateTimeFieldProps {
    value?: string;
    onChange: (value: string) => void;
    label: string;
    required?: boolean;
    disabled?: boolean;
}

export const DateTimeField = ({ value, onChange, label, required, disabled }: DateTimeFieldProps) => {
    return (
        <div className="flex flex-col gap-2">
            <Label>
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <Input
                type="datetime-local"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
        </div>
    );
};
