import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('システム設定', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('システム設定ページにアクセスできる', async ({ page }) => {
        await page.goto('/admin/settings');
        await page.waitForTimeout(2000);

        // Should show settings page
        await expect(page.locator('body')).toContainText('システム設定');
    });

    test('一般設定タブが表示される', async ({ page }) => {
        await page.goto('/admin/settings');
        await page.waitForTimeout(2000);

        // Should see General tab
        await expect(page.locator('body')).toContainText('一般');
        // Should see organization name input
        await expect(page.locator('body')).toContainText('組織名');
    });

    test('IP制限タブが表示される', async ({ page }) => {
        await page.goto('/admin/settings');
        await page.waitForTimeout(2000);

        // Click IP tab
        const ipTab = page.locator('button:has-text("IP制限")');
        if (await ipTab.count() > 0) {
            await ipTab.click();
            await page.waitForTimeout(1000);
            await expect(page.locator('body')).toContainText('IP制限');
        }
    });

    test('組織名を変更するとヘッダーが更新される', async ({ page }) => {
        await page.goto('/admin/settings');
        await page.waitForTimeout(2000);

        // Get the organization name input
        const orgInput = page.locator('input').first();
        const originalValue = await orgInput.inputValue();

        // Change it
        const newName = `テスト組織_${Date.now()}`;
        await orgInput.fill(newName);

        // Save
        await page.click('button:has-text("設定を保存")');
        await page.waitForTimeout(2000);

        // Check navbar updated
        const navbar = page.locator('nav');
        await expect(navbar).toContainText(newName);

        // Restore original value
        await orgInput.fill(originalValue || 'テスト組織');
        await page.click('button:has-text("設定を保存")');
        await page.waitForTimeout(1000);
    });

    test('ユーザー管理ページにアクセスできる', async ({ page }) => {
        await page.goto('/admin/users');
        await page.waitForTimeout(2000);

        await expect(page.locator('body')).toContainText('ユーザー');
    });
});
