import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('ダッシュボード', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('ダッシュボードが表示される', async ({ page }) => {
        await expect(page.locator('body')).toContainText('お知らせ');
        await expect(page.locator('body')).toContainText('アプリ');
    });

    test('ナビバーに組織名が表示される', async ({ page }) => {
        const navbar = page.locator('nav');
        await expect(navbar).toBeVisible();
        // Should show organization name (not empty)
        const navText = await navbar.textContent();
        expect(navText?.length).toBeGreaterThan(0);
    });

    test('お知らせセクションが表示される', async ({ page }) => {
        const section = page.locator('text=お知らせ').first();
        await expect(section).toBeVisible();
    });

    test('管理者にはお知らせの編集ボタンが表示される', async ({ page }) => {
        // Admin should see edit button
        const editButton = page.locator('button:has-text("編集")').first();
        await expect(editButton).toBeVisible();
    });

    test('お知らせを編集して保存できる', async ({ page }) => {
        // Click edit button
        await page.click('button:has-text("編集")');
        // Textarea should appear
        const textarea = page.locator('textarea').first();
        await expect(textarea).toBeVisible();

        // Type some content
        await textarea.fill('## テスト用お知らせ\n\nPlaywrightテストから投稿しています。');

        // Click save
        await page.click('button:has-text("保存")');

        // Wait for save to complete
        await page.waitForTimeout(1500);

        // Should show rendered markdown
        await expect(page.locator('body')).toContainText('テスト用お知らせ');
    });

    test('アプリ一覧が表示される', async ({ page }) => {
        const appSection = page.locator('text=アプリ').first();
        await expect(appSection).toBeVisible();
    });

    test('ダッシュボードレイアウト設定ボタンが存在する', async ({ page }) => {
        // Settings gear icon should be visible
        const settingsButton = page.locator('[class*="justify-end"] button').first();
        await expect(settingsButton).toBeVisible();
    });
});
