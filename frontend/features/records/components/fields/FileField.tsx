'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Loader2, Paperclip, X } from 'lucide-react';

interface FileFieldProps {
    value?: string | null; // This will store the fileKey
    onChange: (value: string | null) => void;
    label: string;
    required?: boolean;
    disabled?: boolean;
}

export const FileField = ({ value, onChange, label, required, disabled }: FileFieldProps) => {
    const [fileName, setFileName] = useState<string | null>(null);

    // If there's a value (fileKey), we might want to fetch metadata or just show it as "Attached File"
    // For now, if value exists but fileName doesn't, assume it's an existing file.

    const { mutate: uploadFile, isPending } = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post('/files', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return data;
        },
        onSuccess: (data) => {
            onChange(data.fileKey);
            setFileName(data.originalName);
            toast.success("ファイルをアップロードしました");
        },
        onError: () => {
            toast.error("アップロードに失敗しました");
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            uploadFile(e.target.files[0]);
        }
    };

    const handleRemove = () => {
        onChange(null);
        setFileName(null);
    };

    // If value exists (stored in DB) but we don't have fileName locally (e.g. on load),
    // we can show a download link or just "File Attached".
    // For simplicity, we just show "File Attached" or the keys.
    const displayValue = fileName || (value ? "添付ファイル" : null);

    return (
        <div className="flex flex-col gap-2">
            <Label>
                {label} {required && <span className="text-red-500">*</span>}
            </Label>

            {value ? (
                <div className="flex items-center gap-2 p-2 border rounded bg-muted/50">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">
                        {displayValue}
                    </span>
                    {!disabled && (
                        <Button variant="ghost" size="icon" onClick={handleRemove} className="h-6 w-6">
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            ) : (
                <Input
                    type="file"
                    onChange={handleFileChange}
                    disabled={disabled || isPending}
                    className="cursor-pointer"
                />
            )}
            {isPending && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> アップロード中...</div>}
        </div>
    );
};
