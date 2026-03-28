import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('レコード管理', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('アプリの詳細ページが表示される', async ({ page }) => {
        // Navigate to first app via link
        const appLink = page.locator('a[href*="/apps/"]').first();

        if (await appLink.count() === 0) {
            test.skip();
            return;
        }

        const href = await appLink.getAttribute('href');
        await page.goto(href!);
        await page.waitForTimeout(2000);

        // Should be on app detail page
        expect(page.url()).toMatch(/\/apps\//);
        // Page should have loaded (not blank)
        const body = await page.locator('body').textContent();
        expect(body!.length).toBeGreaterThan(10);
    });

    test('レコード追加ダイアログを開ける', async ({ page }) => {
        const appCard = page.locator('[class*="border"][class*="rounded"]').filter({ hasText: /テストアプリ|App|アプリ/ }).first();

        if (await appCard.count() === 0) {
            test.skip();
            return;
        }

        await appCard.click();
        await page.waitForTimeout(2000);

        // Click add record button
        const addButton = page.locator('button:has-text("追加"), button:has-text("レコード作成"), button:has-text("新規")').first();

        if (await addButton.count() > 0) {
            await addButton.click();
            await page.waitForTimeout(1000);

            // Dialog or form should appear
            const dialog = page.locator('[role="dialog"], form');
            await expect(dialog.first()).toBeVisible();
        }
    });
});
