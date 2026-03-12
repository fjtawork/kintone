'use client';

import { useState, useEffect } from 'react';

export type SectionKey = 'announcements' | 'pinned' | 'apps';

export interface SectionConfig {
    key: SectionKey;
    label: string;
    visible: boolean;
}

const DEFAULT_SECTIONS: SectionConfig[] = [
    { key: 'announcements', label: 'お知らせ', visible: true },
    { key: 'pinned', label: 'よく使うアプリ', visible: true },
    { key: 'apps', label: 'アプリ一覧', visible: true },
];

const STORAGE_KEY = 'dashboard_layout';

export const useDashboardLayout = () => {
    const [sections, setSections] = useState<SectionConfig[]>(DEFAULT_SECTIONS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed: SectionConfig[] = JSON.parse(saved);
                // 保存済みの順序・表示設定を適用（新しいセクションはデフォルトで追加）
                const keyOrder = parsed.map((s) => s.key);
                const merged = [
                    ...parsed.filter((s) => DEFAULT_SECTIONS.some((d) => d.key === s.key)),
                    ...DEFAULT_SECTIONS.filter((d) => !keyOrder.includes(d.key)),
                ];
                setSections(merged);
            }
        } catch {
            // ignore
        }
        setLoaded(true);
    }, []);

    const save = (next: SectionConfig[]) => {
        setSections(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    const toggleVisible = (key: SectionKey) => {
        save(sections.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s)));
    };

    const moveUp = (key: SectionKey) => {
        const idx = sections.findIndex((s) => s.key === key);
        if (idx <= 0) return;
        const next = [...sections];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        save(next);
    };

    const moveDown = (key: SectionKey) => {
        const idx = sections.findIndex((s) => s.key === key);
        if (idx < 0 || idx >= sections.length - 1) return;
        const next = [...sections];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        save(next);
    };

    return { sections, loaded, toggleVisible, moveUp, moveDown };
};
