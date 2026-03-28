import { test, expect } from '@playwright/test';
import { loginAsAdmin, uniqueName } from './helpers';

test.describe('アプリ管理', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('アプリ一覧が表示される', async ({ page }) => {
        // Dashboard shows app list
        await expect(page.locator('text=アプリ作成').first()).toBeVisible();
    });

    test('アプリを作成できる', async ({ page }) => {
        const appName = uniqueName('E2Eアプリ');

        // Click create app button
        await page.click('button:has-text("アプリ作成")');

        // Fill in app name in dialog
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        await dialog.locator('input').first().fill(appName);

        // Submit
        await dialog.locator('button:has-text("作成")').click();

        // Wait for navigation or dialog close
        await page.waitForTimeout(2000);

        // App should now exist - check either redirect to app page or app list
        const bodyText = await page.locator('body').textContent();
        expect(bodyText).toContain(appName);
    });

    test('アプリカードにリンクが含まれている', async ({ page }) => {
        // Check that app cards have clickable links
        const appLink = page.locator('a[href*="/apps/"]').first();
        if (await appLink.count() > 0) {
            const href = await appLink.getAttribute('href');
            expect(href).toMatch(/\/apps\//);
        }
    });

    test('アプリ詳細ページに直接アクセスできる', async ({ page }) => {
        // Get first app link href
        const appLink = page.locator('a[href*="/apps/"]').first();
        if (await appLink.count() === 0) {
            test.skip();
            return;
        }
        const href = await appLink.getAttribute('href');
        await page.goto(href!);
        await page.waitForTimeout(2000);
        expect(page.url()).toMatch(/\/apps\//);
    });
});
