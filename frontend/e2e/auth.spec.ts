import { test, expect } from '@playwright/test';
import { ADMIN, loginAsAdmin } from './helpers';

test.describe('認証', () => {
    test('ログインページが表示される', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('正しい認証情報でログインできる', async ({ page }) => {
        await loginAsAdmin(page);
        // Dashboard should be visible
        await expect(page.locator('body')).toContainText('アプリ');
    });

    test('間違ったパスワードでログインに失敗する', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', ADMIN.email);
        await page.fill('input[type="password"]', 'wrong_password');
        await page.click('button[type="submit"]');
        // Should stay on login page or show error
        await page.waitForTimeout(2000);
        const url = page.url();
        const hasError = await page.locator('[role="alert"], [data-sonner-toast], .text-destructive, li[data-toast]').count();
        expect(url.includes('/login') || hasError > 0).toBeTruthy();
    });

    test('ログアウトできる', async ({ page }) => {
        await loginAsAdmin(page);
        await page.click('text=ログアウト');
        await page.waitForURL(/\/login/, { timeout: 5000 });
        await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test('未認証でダッシュボードにアクセスするとリダイレクトされる', async ({ page }) => {
        // Clear any existing token
        await page.goto('/login');
        await page.evaluate(() => localStorage.removeItem('token'));
        await page.goto('/');
        await page.waitForTimeout(2000);
        // Should redirect to login or show login button
        const isOnLogin = page.url().includes('/login');
        const hasLoginButton = await page.locator('text=ログイン').count();
        expect(isOnLogin || hasLoginButton > 0).toBeTruthy();
    });
});
