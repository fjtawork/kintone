import { Page, expect } from '@playwright/test';

/** Admin credentials (must match the test environment) */
export const ADMIN = {
    email: 'admin@example.com',
    password: 'password123',
};

/** Login as admin and return to the dashboard */
export async function loginAsAdmin(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', ADMIN.email);
    await page.fill('input[type="password"]', ADMIN.password);
    await page.click('button[type="submit"]');
    // Wait for redirect to dashboard
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText('ログイン');
}

/** Generate a unique string for test isolation */
export function uniqueName(prefix = 'test') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
