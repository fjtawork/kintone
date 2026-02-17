'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { toast } from 'sonner';

const formSchema = z.object({
    name: z.string().min(1, '名前は必須です').max(100),
    description: z.string().optional(),
    icon: z.string().optional(),
    theme: z.string().optional(),
});

interface GeneralSettingsProps {
    appId: string;
    settings: any; // { name, description, icon, theme }
}

export const GeneralSettings = ({ appId, settings }: GeneralSettingsProps) => {
    const queryClient = useQueryClient();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: settings?.name || '',
            description: settings?.description || '',
            icon: settings?.icon || '',
            theme: settings?.theme || '',
        },
    });

    const mutation = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            // Reusing the process management or creating a new endpoint?
            // Usually general updates go to PATCH /apps/{id} or PUT /apps/{id}
            // backend/api/endpoints.py needs to support updating name/desc/icon/theme via PUT or PATCH
            await api.put(`/apps/${appId}`, values);
        },
        onSuccess: () => {
            // Invalidate app details
            queryClient.invalidateQueries({ queryKey: ['app', appId] });
            queryClient.invalidateQueries({ queryKey: ['apps'] }); // Update list too
            toast.success('設定を更新しました');
        },
        onError: () => {
            toast.error('設定の更新に失敗しました');
        }
    });

    // Wait, check if PUT /apps/{id} supports partial updates?
    // Pydantic schema AppUpdate typically allows optionals.
    // I need to check backend/api/endpoints.py update_app logic.

    function onSubmit(values: z.infer<typeof formSchema>) {
        mutation.mutate(values);
    }

    return (
        <div className="border p-4 rounded-md">
            <h2 className="font-semibold mb-4 text-lg">基本設定</h2>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>アプリ名</FormLabel>
                                <FormControl>
                                    <Input placeholder="アプリ名" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>説明</FormLabel>
                                <FormControl>
                                    <Input placeholder="説明" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="flex gap-4">
                        <FormField
                            control={form.control}
                            name="icon"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>アイコン</FormLabel>
                                    <FormControl>
                                        <IconPicker value={field.value} onChange={field.onChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="theme"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>テーマカラー</FormLabel>
                                    <FormControl>
                                        <ColorPicker value={field.value} onChange={field.onChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending ? '保存中...' : '変更を保存'}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
};
