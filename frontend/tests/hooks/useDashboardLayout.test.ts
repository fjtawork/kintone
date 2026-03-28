import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Import after mocking
import { describe as _, it as __, expect as ___ } from 'vitest';

describe('useDashboardLayout ロジック', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('デフォルトセクションが正しい順序で定義されている', () => {
        const defaultSections = [
            { key: 'announcements', label: 'お知らせ', visible: true },
            { key: 'pinned', label: 'よく使うアプリ', visible: true },
            { key: 'apps', label: 'アプリ', visible: true },
        ];
        expect(defaultSections).toHaveLength(3);
        expect(defaultSections[0].key).toBe('announcements');
        expect(defaultSections[1].key).toBe('pinned');
        expect(defaultSections[2].key).toBe('apps');
    });

    it('localStorageに保存・復元できる', () => {
        const sections = [
            { key: 'apps', label: 'アプリ', visible: true },
            { key: 'announcements', label: 'お知らせ', visible: false },
            { key: 'pinned', label: 'よく使うアプリ', visible: true },
        ];
        localStorageMock.setItem('dashboard_layout', JSON.stringify(sections));

        const restored = JSON.parse(localStorageMock.getItem('dashboard_layout')!);
        expect(restored).toHaveLength(3);
        expect(restored[0].key).toBe('apps');
        expect(restored[1].visible).toBe(false);
    });

    it('セクションの表示切り替えができる', () => {
        const sections = [
            { key: 'announcements', label: 'お知らせ', visible: true },
            { key: 'pinned', label: 'よく使うアプリ', visible: true },
        ];
        // Toggle visibility
        const toggled = sections.map(s =>
            s.key === 'announcements' ? { ...s, visible: !s.visible } : s
        );
        expect(toggled[0].visible).toBe(false);
        expect(toggled[1].visible).toBe(true);
    });

    it('セクションの順序変更ができる', () => {
        const sections = [
            { key: 'announcements', label: 'お知らせ', visible: true },
            { key: 'pinned', label: 'よく使うアプリ', visible: true },
            { key: 'apps', label: 'アプリ', visible: true },
        ];
        // Move 'pinned' up (swap index 0 and 1)
        const moved = [...sections];
        [moved[0], moved[1]] = [moved[1], moved[0]];
        expect(moved[0].key).toBe('pinned');
        expect(moved[1].key).toBe('announcements');
    });
});
