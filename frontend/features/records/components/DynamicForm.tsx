'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DateTimeField } from './fields/DateTimeField';
import { FileField } from './fields/FileField';
import { RecordPicker } from './RecordPicker';
import { UserPicker } from '../../users/components/UserPicker';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { Field } from '../../app-builder/types';

interface DynamicFormProps {
    fields: Field[];
    onSubmit: (data: any) => void;
    isSubmitting?: boolean;
    defaultValues?: any;
    columns?: number;
    hideSubmit?: boolean;
    submitLabel?: string;
}

export const DynamicForm = ({
    fields,
    onSubmit,
    isSubmitting,
    defaultValues,
    columns = 1,
    hideSubmit = false,
    submitLabel,
}: DynamicFormProps) => {
    // Dynamically build Zod schema
    const schemaShape: any = {};
    fields.forEach((field) => {
        // ... (schema building logic is same)
        let fieldSchema;
        switch (field.type) {
            case 'NUMBER':
                fieldSchema = z.coerce.number();
                break;
            case 'DATE':
            case 'DATETIME': // DATETIME also uses z.date() for now
                fieldSchema = z.date();
                break;
            case 'CHECKBOX':
                fieldSchema = z.array(z.string());
                break;
            case 'FILE':
                fieldSchema = z.string().optional(); // Files will be handled as strings (URLs/paths)
                break;
            case 'LINK':
                fieldSchema = z.string().url().optional().or(z.literal(''));
                break;
            case 'REFERENCE':
                fieldSchema = z.string().optional();
                break;
            case 'LABEL':
                fieldSchema = z.string().optional();
                break;
            case 'USER_SELECTION':
                if (field.isMultiSelect) {
                    fieldSchema = z.array(z.string()).optional();
                } else {
                    fieldSchema = z.string().optional();
                }
                break;
            default:
                fieldSchema = z.string();
        }

        if (field.required) {
            if (field.type === 'NUMBER') {
                fieldSchema = (fieldSchema as z.ZodNumber).min(1, '必須です');
            } else if (field.type === 'CHECKBOX') {
                fieldSchema = (fieldSchema as z.ZodArray<z.ZodString>).min(1, '少なくとも1つ選択してください');
            } else if (field.type === 'SINGLE_LINE_TEXT' || field.type === 'MULTI_LINE_TEXT' || field.type === 'DROP_DOWN' || field.type === 'RADIO_BUTTON') {
                fieldSchema = (fieldSchema as z.ZodString).min(1, '必須です');
            } else if (field.type === 'FILE') {
                // File is string optional, but if required, make it string min 1
                fieldSchema = z.string().min(1, '必須です');
            }
            // Date types are already handled by z.date() which is inherently required unless optional() is called
        } else {
            // For Select to be clearable, we might need nullable or empty string handling
            // But optional() handles undefined.
            fieldSchema = fieldSchema.optional();
        }

        schemaShape[field.code] = fieldSchema;
    });

    const formSchema = z.object(schemaShape);

    // Process defaultValues for Date fields (string to Date object)
    const formattedDefaultValues = { ...defaultValues };
    if (defaultValues) {
        fields.forEach(field => {
            if ((field.type === 'DATE' || field.type === 'DATETIME') && defaultValues[field.code]) {
                formattedDefaultValues[field.code] = new Date(defaultValues[field.code]);
            }
        });
    }

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: formattedDefaultValues
    });

    const gridClass = columns >= 3
        ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        : columns === 2
            ? "grid grid-cols-1 md:grid-cols-2 gap-6"
            : "grid grid-cols-1 gap-6";
    const getColumnSpanClass = (field: Field) => {
        const span = Math.max(1, Math.min(field.columnSpan || 1, columns));
        if (columns >= 3) {
            if (span >= 3) return 'md:col-span-2 xl:col-span-3';
            if (span === 2) return 'md:col-span-2 xl:col-span-2';
            return 'md:col-span-1 xl:col-span-1';
        }
        if (columns === 2) {
            return span >= 2 ? 'md:col-span-2' : 'md:col-span-1';
        }
        return 'col-span-1';
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className={gridClass}>
                    {fields.map((field) => (
                        <div key={field.id} className={getColumnSpanClass(field)}>
                            <FormField
                                control={form.control}
                                name={field.code}
                                render={({ field: formField }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {field.label}
                                            {field.required && <span className="text-red-500 ml-1">*</span>}
                                        </FormLabel>
                                        <FormControl>
                                            {(() => {
                                            switch (field.type) {
                                                case 'SINGLE_LINE_TEXT':
                                                    return <Input {...formField} value={formField.value as string || ''} />;

                                            case 'MULTI_LINE_TEXT':
                                                return <Textarea {...formField} value={formField.value as string || ''} />;

                                            case 'NUMBER':
                                                return <Input type="number" {...formField} value={formField.value as string || ''} />;

                                            case 'RADIO_BUTTON':
                                                return (
                                                    <RadioGroup
                                                        onValueChange={formField.onChange}
                                                        defaultValue={formField.value as string}
                                                        className="flex flex-col space-y-1"
                                                    >
                                                        {field.options?.map((opt: any) => (
                                                            <div key={opt} className="flex items-center space-x-2">
                                                                <RadioGroupItem value={opt} id={`r-${field.id}-${opt}`} />
                                                                <Label htmlFor={`r-${field.id}-${opt}`}>{opt}</Label>
                                                            </div>
                                                        ))}
                                                        {!field.options && <div className="text-sm text-muted-foreground">選択肢が設定されていません</div>}
                                                    </RadioGroup>
                                                );

                                            case 'DATE':
                                                return (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full justify-start text-left font-normal",
                                                                    !formField.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {formField.value ? format(formField.value as Date, "yyyy-MM-dd") : <span>日付を選択</span>}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0">
                                                            <Calendar
                                                                mode="single"
                                                                selected={formField.value as Date}
                                                                onSelect={formField.onChange}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                );

                                            case 'DATETIME':
                                                return (
                                                    <DateTimeField
                                                        label={field.label}
                                                        required={field.required}
                                                        value={formField.value as string}
                                                        onChange={formField.onChange}
                                                        disabled={form.formState.isSubmitting}
                                                    />
                                                );

                                            case 'FILE':
                                                return (
                                                    <FileField
                                                        label={field.label}
                                                        required={field.required}
                                                        value={formField.value as string}
                                                        onChange={formField.onChange}
                                                        disabled={form.formState.isSubmitting}
                                                    />
                                                );

                                            case 'DROP_DOWN':
                                                return (
                                                    <Select onValueChange={formField.onChange} value={formField.value as string}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="選択してください" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {field.options?.map((opt: any) => (
                                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                            ))}
                                                            {!field.options && <SelectItem value="option1">選択肢 1（未設定）</SelectItem>}
                                                        </SelectContent>
                                                    </Select>
                                                );

                                            case 'CHECKBOX':
                                                return (
                                                    <div className="flex flex-col space-y-2">
                                                        {field.options?.map((opt: string) => {
                                                            const currentValues = Array.isArray(formField.value) ? formField.value : [];
                                                            return (
                                                                <div key={opt} className="flex items-center space-x-2">
                                                                    <Checkbox
                                                                        id={`chk-${field.id}-${opt}`}
                                                                        checked={currentValues.includes(opt)}
                                                                        onCheckedChange={(checked) => {
                                                                            const next = checked
                                                                                ? [...currentValues, opt]
                                                                                : currentValues.filter((v: string) => v !== opt);
                                                                            formField.onChange(next);
                                                                        }}
                                                                    />
                                                                    <Label htmlFor={`chk-${field.id}-${opt}`} className="cursor-pointer font-normal">
                                                                        {opt}
                                                                    </Label>
                                                                </div>
                                                            );
                                                        })}
                                                        {!field.options && <div className="text-sm text-muted-foreground ml-2">選択肢が設定されていません</div>}
                                                    </div>
                                                );

                                            case 'LABEL':
                                                return (
                                                    <div className="py-2 text-sm text-muted-foreground border-l-2 pl-3">
                                                        {field.defaultValue as string || field.label}
                                                    </div>
                                                );

                                            case 'LINK':
                                                return <Input type="url" placeholder="https://" {...formField} value={formField.value as string || ''} />;

                                            case 'REFERENCE':
                                                return (
                                                    <RecordPicker
                                                        appId={field.relatedAppId!}
                                                        value={formField.value as string}
                                                        onChange={formField.onChange}
                                                        disabled={form.formState.isSubmitting}
                                                    />
                                                );

                                            case 'USER_SELECTION':
                                                return (
                                                    <UserPicker
                                                        value={formField.value as string | string[]}
                                                        onChange={formField.onChange}
                                                        disabled={form.formState.isSubmitting}
                                                        multiSelect={field.isMultiSelect}
                                                    />
                                                );

                                                default:
                                                    return <Input {...formField} value={formField.value as string || ''} />;
                                            }
                                        })()}
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    ))}
                </div>

                {!hideSubmit && (
                    <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? '保存中...' : (submitLabel || '保存')}
                        </Button>
                    </div>
                )}
            </form>
        </Form>
    );
};
