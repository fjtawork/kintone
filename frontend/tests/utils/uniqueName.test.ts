import { describe, it, expect } from 'vitest';

// Test helper functions that are reused across the app

function generateUniqueId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

describe('ユーティリティ関数', () => {
    describe('generateUniqueId', () => {
        it('ユニークなIDを生成する', () => {
            const id1 = generateUniqueId();
            const id2 = generateUniqueId();
            expect(id1).not.toBe(id2);
        });

        it('空でない文字列を返す', () => {
            const id = generateUniqueId();
            expect(id.length).toBeGreaterThan(0);
        });
    });

    describe('formatDate', () => {
        it('ISO文字列をyyyy-MM-dd形式に変換する', () => {
            expect(formatDate('2026-03-28T12:00:00Z')).toBe('2026-03-28');
        });

        it('月・日が1桁の場合にゼロ埋めする', () => {
            expect(formatDate('2026-01-05T00:00:00Z')).toBe('2026-01-05');
        });
    });
});
