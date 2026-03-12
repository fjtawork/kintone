'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Pencil, X, Check } from 'lucide-react';
import { useAnnouncementContent, useUpdateAnnouncementContent } from '../api/useAnnouncementContent';

interface AnnouncementBoardProps {
    isAdmin: boolean;
}

export const AnnouncementBoard = ({ isAdmin }: AnnouncementBoardProps) => {
    const { data: content, isLoading } = useAnnouncementContent();
    const { mutate: updateContent, isPending } = useUpdateAnnouncementContent();

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    useEffect(() => {
        if (content !== undefined) {
            setDraft(content);
        }
    }, [content]);

    const handleEdit = () => {
        setDraft(content ?? '');
        setEditing(true);
    };

    const handleCancel = () => {
        setDraft(content ?? '');
        setEditing(false);
    };

    const handleSave = () => {
        updateContent(draft, {
            onSuccess: () => {
                toast.success('お知らせを保存しました');
                setEditing(false);
            },
            onError: () => toast.error('保存に失敗しました'),
        });
    };

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">読み込み中...</div>;
    }

    const isEmpty = !content || content.trim() === '';

    return (
        <div className="relative">
            {/* 管理者用ボタン */}
            {isAdmin && !editing && (
                <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-0 right-0"
                    onClick={handleEdit}
                >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    編集
                </Button>
            )}

            {/* 編集モード */}
            {editing ? (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                        Markdown形式で記入できます。
                        <code className="mx-1 px-1 bg-muted rounded text-[11px]"># 見出し</code>
                        <code className="mx-1 px-1 bg-muted rounded text-[11px]">**太字**</code>
                        <code className="mx-1 px-1 bg-muted rounded text-[11px]">&lt;span style="color:red"&gt;赤文字&lt;/span&gt;</code>
                    </p>
                    <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={
                            '例:\n## 2025年4月のお知らせ\n\nシステムメンテナンスのため、**4月10日（木）22:00〜翌2:00** は利用できません。\n\n<span style="color:red">緊急</span> 重要なお知らせがあります。'
                        }
                        rows={10}
                        className="font-mono text-sm"
                        disabled={isPending}
                    />
                    <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
                            <X className="h-3.5 w-3.5 mr-1" />
                            キャンセル
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isPending}>
                            <Check className="h-3.5 w-3.5 mr-1" />
                            {isPending ? '保存中...' : '保存'}
                        </Button>
                    </div>
                </div>
            ) : (
                /* 表示モード */
                <div className={`pr-20 ${isEmpty ? 'min-h-[2rem]' : ''}`}>
                    {isEmpty ? (
                        isAdmin ? (
                            <p className="text-sm text-muted-foreground">
                                お知らせがありません。「編集」ボタンから内容を追加できます。
                            </p>
                        ) : null
                    ) : (
                        <div className="text-sm leading-relaxed">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                    h1: ({ children }) => <h1 className="text-2xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-xl font-semibold mt-3 mb-2 first:mt-0">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1 first:mt-0">{children}</h3>,
                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                    em: ({ children }) => <em className="italic">{children}</em>,
                                    ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
                                    li: ({ children }) => <li>{children}</li>,
                                    a: ({ href, children }) => <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                                    code: ({ children }) => <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{children}</code>,
                                    blockquote: ({ children }) => <blockquote className="border-l-4 border-muted-foreground/30 pl-3 italic text-muted-foreground my-2">{children}</blockquote>,
                                    hr: () => <hr className="my-3 border-border" />,
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
