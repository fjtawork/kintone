'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentUser } from '@/features/users/api';
import { cn } from '@/lib/utils';
import { useCreateRecordComment, useRecordComments } from '../api/useRecordComments';
import { useMentionCandidates } from '../api/useRecordComments';

interface RecordChatProps {
    recordId: string;
    enabled: boolean;
    maxMessages?: number;
}

const URL_EXACT_PATTERN = /^https?:\/\/[^\s]+$/;
const MENTION_BOUNDARY_PATTERN = /[\s.,!?:;、。]/;

const splitAndRenderMentions = (text: string, mentionTokens: string[]) => {
    const tokens = mentionTokens.filter(Boolean).sort((a, b) => b.length - a.length);
    const nodes: React.ReactNode[] = [];
    let buffer = '';
    let i = 0;
    let keyIndex = 0;

    const flushBuffer = () => {
        if (!buffer) return;
        nodes.push(<span key={`txt-${keyIndex++}`}>{buffer}</span>);
        buffer = '';
    };

    const matchMentionToken = (source: string, atIndex: number): string | null => {
        if (source[atIndex] !== '@') return null;
        const mentionStart = atIndex + 1;
        for (const token of tokens) {
            const candidate = source.slice(mentionStart, mentionStart + token.length);
            if (candidate.toLowerCase() !== token.toLowerCase()) continue;
            const nextChar = source[mentionStart + token.length] || '';
            if (!nextChar || MENTION_BOUNDARY_PATTERN.test(nextChar)) {
                return source.slice(atIndex, mentionStart + token.length);
            }
        }
        return null;
    };

    while (i < text.length) {
        const mention = matchMentionToken(text, i);
        if (mention) {
            flushBuffer();
            nodes.push(
                <span
                    key={`mnt-${keyIndex++}`}
                    className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                >
                    {mention}
                </span>
            );
            i += mention.length;
            continue;
        }
        buffer += text[i];
        i += 1;
    }
    flushBuffer();
    return nodes;
};

const renderMessageWithLinks = (message: string, mentionTokens: string[]) => {
    const lines = message.split('\n');
    return lines.map((line, lineIndex) => {
        const segments = line.split(/(https?:\/\/[^\s]+)/g);
        return (
            <span key={`line-${lineIndex}`}>
                {segments.map((segment, segmentIndex) => {
                    if (URL_EXACT_PATTERN.test(segment)) {
                        return (
                            <a
                                key={`seg-${lineIndex}-${segmentIndex}`}
                                href={segment}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                            >
                                {segment}
                            </a>
                        );
                    }
                    return (
                        <span key={`seg-${lineIndex}-${segmentIndex}`}>
                            {splitAndRenderMentions(segment, mentionTokens)}
                        </span>
                    );
                })}
                {lineIndex < lines.length - 1 && <br />}
            </span>
        );
    });
};

export const RecordChat = ({ recordId, enabled, maxMessages = 300 }: RecordChatProps) => {
    const [message, setMessage] = useState('');
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
    const [showMentionList, setShowMentionList] = useState(false);
    const { data: comments, isLoading, error } = useRecordComments(recordId, enabled);
    const createComment = useCreateRecordComment(recordId);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const { data: me } = useQuery({
        queryKey: ['me'],
        queryFn: getCurrentUser,
        enabled,
        staleTime: 60_000,
    });
    const { data: mentionCandidates } = useMentionCandidates(
        recordId,
        mentionQuery,
        enabled && showMentionList
    );
    const { data: mentionDirectory } = useMentionCandidates(
        recordId,
        '',
        enabled,
        100
    );

    const remainingHint = useMemo(() => {
        const count = comments?.length || 0;
        return `${Math.max(0, maxMessages - count)}件分の履歴余裕`;
    }, [comments, maxMessages]);
    const mentionTokens = useMemo(() => {
        const entries = mentionDirectory || [];
        const set = new Set<string>();
        entries.forEach((candidate) => {
            if (candidate.full_name) set.add(candidate.full_name);
            const localPart = candidate.email.split('@')[0];
            if (localPart) set.add(localPart);
            set.add(candidate.email);
        });
        return Array.from(set);
    }, [mentionDirectory]);

    useEffect(() => {
        if (!enabled) return;
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [enabled, comments?.length]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [message]);

    if (!enabled) {
        return (
            <div className="border rounded-md p-4 text-sm text-muted-foreground">
                レコードチャットはこのアプリで無効です。
            </div>
        );
    }

    const handleSend = () => {
        const text = message.trim();
        if (!text) return;

        createComment.mutate(text, {
            onSuccess: () => {
                setMessage('');
                setShowMentionList(false);
                setMentionQuery('');
                setMentionRange(null);
            },
        });
    };

    const updateMentionState = (nextText: string, cursorPos: number) => {
        const before = nextText.slice(0, cursorPos);
        const match = before.match(/(^|\s)@([^\s@]*)$/);
        if (!match) {
            setShowMentionList(false);
            setMentionQuery('');
            setMentionRange(null);
            return;
        }

        const query = match[2] ?? '';
        const mentionStart = before.length - query.length - 1;
        setMentionQuery(query);
        setMentionRange({ start: mentionStart, end: cursorPos });
        setShowMentionList(true);
    };

    const insertMention = (mentionToken: string) => {
        if (!mentionRange) return;
        const before = message.slice(0, mentionRange.start);
        const after = message.slice(mentionRange.end);
        const replacement = `@${mentionToken} `;
        const next = `${before}${replacement}${after}`;
        const nextCursor = before.length + replacement.length;

        setMessage(next);
        setShowMentionList(false);
        setMentionQuery('');
        setMentionRange(null);
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
        });
    };

    return (
        <div className="border rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> レコードチャット
                </h3>
                <span className="text-xs text-muted-foreground">{remainingHint}</span>
            </div>

            <ScrollArea className="h-64 border rounded-md p-3 bg-zinc-50 dark:bg-zinc-900">
                {isLoading && <p className="text-sm text-muted-foreground">読み込み中...</p>}
                {error && <p className="text-sm text-red-500">チャットの読み込みに失敗しました。</p>}
                {!isLoading && !error && (comments?.length || 0) === 0 && (
                    <p className="text-sm text-muted-foreground">まだ投稿がありません。</p>
                )}

                <div className="space-y-2">
                    {(comments || []).map((comment) => {
                        const isMine = Boolean(me?.id) && comment.user_id === me?.id;
                        return (
                        <div key={comment.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                            <div
                                className={cn(
                                    'max-w-[85%] rounded-md border p-2',
                                    isMine
                                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900'
                                        : 'bg-white dark:bg-zinc-950'
                                )}
                            >
                                <div className="text-xs text-muted-foreground">
                                    {isMine ? 'あなた' : (comment.user_name || 'ユーザー')} ・ {format(new Date(comment.created_at), 'yyyy-MM-dd HH:mm')}
                                </div>
                                <div className="text-sm whitespace-pre-wrap break-words">
                                    {renderMessageWithLinks(comment.message, mentionTokens)}
                                </div>
                            </div>
                        </div>
                    )})}
                    <div ref={bottomRef} />
                </div>
            </ScrollArea>

            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Textarea
                        ref={textareaRef}
                        placeholder="コメントを入力（@でメンション）"
                        value={message}
                        onChange={(e) => {
                            const next = e.target.value;
                            setMessage(next);
                            updateMentionState(next, e.target.selectionStart ?? next.length);
                        }}
                        onClick={(e) => {
                            const el = e.target as HTMLTextAreaElement;
                            updateMentionState(el.value, el.selectionStart ?? el.value.length);
                        }}
                        onKeyUp={(e) => {
                            const el = e.currentTarget;
                            updateMentionState(el.value, el.selectionStart ?? el.value.length);
                        }}
                        className="min-h-[40px] max-h-[160px] resize-none"
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setShowMentionList(false);
                                return;
                            }
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    {showMentionList && (mentionCandidates?.length || 0) > 0 && (
                        <div className="absolute bottom-full mb-2 left-0 right-0 z-20 rounded-md border bg-white dark:bg-zinc-950 shadow-lg overflow-hidden">
                            {(mentionCandidates || []).map((candidate) => {
                                const label = candidate.full_name || candidate.email;
                                return (
                                    <button
                                        key={candidate.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => insertMention(candidate.full_name || candidate.email.split('@')[0])}
                                    >
                                        <div className="text-sm font-medium">{label}</div>
                                        {candidate.full_name && (
                                            <div className="text-xs text-muted-foreground">{candidate.email}</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <Button onClick={handleSend} disabled={createComment.isPending}>
                    {createComment.isPending ? '送信中...' : '送信'}
                </Button>
            </div>
        </div>
    );
};
