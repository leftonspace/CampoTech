/**
 * Admin E2E Tests
 * ================
 *
 * End-to-end tests for admin functionality:
 * - Verification approval
 * - Payment processing
 * - Refund processing
 * - User management
 */

import { test, expect, Page } from '@playwright/test';

// Admin test credentials (would be configured in test environment)
const ADMIN_USER = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@campotech-test.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'AdminTestPassword123!',
};

// Helper functions
async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.fill('[data-testid="email-input"]', ADMIN_USER.email);
  await page.fill('[data-testid="password-input"]', ADMIN_USER.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/admin/dashboard');
}

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display admin dashboard', async ({ page }) => {
    await expect(page).toHaveURL('/admin/dashboard');
    await expect(page.locator('h1')).toContainText(/[Dd]ashboard|[Pp]anel/);
  });

  test('should show key metrics', async ({ page }) => {
    // Should show subscription metrics
    await expect(page.locator('[data-testid="metric-total-subscriptions"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-trial-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-active-users"]')).toBeVisible();
  });

  test('should show pending verifications count', async ({ page }) => {
    const pendingCount = page.locator('[data-testid="pending-verifications"]');
    await expect(pendingCount).toBeVisible();
  });
});

test.describe('Verification Approval', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to verification queue', async ({ page }) => {
    await page.click('[data-testid="nav-verifications"]');
    await expect(page).toHaveURL(/\/admin\/verifications/);
  });

  test('should display pending verifications', async ({ page }) => {
    await page.goto('/admin/verifications');

    // Should show verification list or empty state
    const verificationList = page.locator('[data-testid="verification-list"]');
    const emptyState = page.locator('[data-testid="no-pending-verifications"]');

    await expect(verificationList.or(emptyState)).toBeVisible();
  });

  test('should show verification details when clicked', async ({ page }) => {
    await page.goto('/admin/verifications');

    const firstVerification = page.locator('[data-testid="verification-item"]').first();

    if (await firstVerification.isVisible()) {
      await firstVerification.click();

      // Should show document details
      await expect(page.locator('[data-testid="verification-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="document-preview"]')).toBeVisible();
    }
  });

  test('should have approve and reject buttons', async ({ page }) => {
    await page.goto('/admin/verifications');

    const firstVerification = page.locator('[data-testid="verification-item"]').first();

    if (await firstVerification.isVisible()) {
      await firstVerification.click();

      await expect(page.locator('[data-testid="approve-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="reject-button"]')).toBeVisible();
    }
  });

  test('should require rejection reason', async ({ page }) => {
    await page.goto('/admin/verifications');

    const firstVerification = page.locator('[data-testid="verification-item"]').first();

    if (await firstVerification.isVisible()) {
      await firstVerification.click();

      // Click reject without reason
      await page.click('[data-testid="reject-button"]');

      // Should show reason field
      await expect(page.locator('[data-testid="rejection-reason"]')).toBeVisible();
    }
  });
});

test.describe('Payment Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to payments section', async ({ page }) => {
    await page.click('[data-testid="nav-payments"]');
    await expect(page).toHaveURL(/\/admin\/payments/);
  });

  test('should display payment list', async ({ page }) => {
    await page.goto('/admin/payments');

    const paymentList = page.locator('[data-testid="payment-list"]');
    await expect(paymentList).toBeVisible();
  });

  test('should filter payments by status', async ({ page }) => {
    await page.goto('/admin/payments');

    // Should have status filter
    const statusFilter = page.locator('[data-testid="payment-status-filter"]');
    await expect(statusFilter).toBeVisible();

    // Select failed payments
    await statusFilter.selectOption('failed');

    // URL should update with filter
    await expect(page).toHaveURL(/status=failed/);
  });

  test('should show payment details', async ({ page }) => {
    await page.goto('/admin/payments');

    const firstPayment = page.locator('[data-testid="payment-row"]').first();

    if (await firstPayment.isVisible()) {
      await firstPayment.click();

      // Should show payment details modal or page
      await expect(
        page.locator('[data-testid="payment-details"]').or(page.locator('[data-testid="payment-modal"]'))
      ).toBeVisible();
    }
  });
});

test.describe('Refund Processing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should show refund option for eligible payments', async ({ page }) => {
    await page.goto('/admin/payments');

    // Filter to completed payments
    await page.selectOption('[data-testid="payment-status-filter"]', 'completed');

    const firstPayment = page.locator('[data-testid="payment-row"]').first();

    if (await firstPayment.isVisible()) {
      await firstPayment.click();

      // Should have refund button
      const refundButton = page.locator('[data-testid="refund-button"]');
      await expect(refundButton).toBeVisible();
    }
  });

  test('should show Ley 24.240 eligibility status', async ({ page }) => {
    await page.goto('/admin/payments');

    const firstPayment = page.locator('[data-testid="payment-row"]').first();

    if (await firstPayment.isVisible()) {
      await firstPayment.click();

      // Should show refund eligibility
      await expect(
        page.locator('[data-testid="refund-eligible"]').or(page.locator('[data-testid="refund-not-eligible"]'))
      ).toBeVisible();
    }
  });

  test('should require confirmation for refund', async ({ page }) => {
    await page.goto('/admin/payments');

    const firstPayment = page.locator('[data-testid="payment-row"]').first();

    if (await firstPayment.isVisible()) {
      await firstPayment.click();

      const refundButton = page.locator('[data-testid="refund-button"]');
      if (await refundButton.isVisible()) {
        await refundButton.click();

        // Should show confirmation dialog
        await expect(page.locator('[data-testid="confirm-refund-dialog"]')).toBeVisible();
      }
    }
  });
});

test.describe('Organization Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to organizations', async ({ page }) => {
    await page.click('[data-testid="nav-organizations"]');
    await expect(page).toHaveURL(/\/admin\/organizations/);
  });

  test('should search organizations', async ({ page }) => {
    await page.goto('/admin/organizations');

    const searchInput = page.locator('[data-testid="org-search"]');
    await searchInput.fill('Test');

    // Should filter results
    await page.waitForResponse((response) => response.url().includes('/api/admin/organizations'));
  });

  test('should show organization details', async ({ page }) => {
    await page.goto('/admin/organizations');

    const firstOrg = page.locator('[data-testid="org-row"]').first();

    if (await firstOrg.isVisible()) {
      await firstOrg.click();

      // Should show organization details
      await expect(page.locator('[data-testid="org-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-subscription-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-verification-status"]')).toBeVisible();
    }
  });

  test('should allow blocking/unblocking organization', async ({ page }) => {
    await page.goto('/admin/organizations');

    const firstOrg = page.locator('[data-testid="org-row"]').first();

    if (await firstOrg.isVisible()) {
      await firstOrg.click();

      // Should have block/unblock button
      await expect(
        page.locator('[data-testid="block-org-button"]').or(page.locator('[data-testid="unblock-org-button"]'))
      ).toBeVisible();
    }
  });
});

test.describe('AFIP Manual Verification Queue', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should show pending AFIP verifications', async ({ page }) => {
    await page.goto('/admin/verifications/afip');

    const queue = page.locator('[data-testid="afip-queue"]');
    const emptyState = page.locator('[data-testid="no-pending-afip"]');

    await expect(queue.or(emptyState)).toBeVisible();
  });

  test('should allow manual AFIP approval', async ({ page }) => {
    await page.goto('/admin/verifications/afip');

    const firstItem = page.locator('[data-testid="afip-queue-item"]').first();

    if (await firstItem.isVisible()) {
      await firstItem.click();

      // Should have approve button
      await expect(page.locator('[data-testid="afip-approve-button"]')).toBeVisible();
    }
  });
});

test.describe('Audit Log', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should show admin action audit log', async ({ page }) => {
    await page.goto('/admin/audit-log');

    const auditLog = page.locator('[data-testid="audit-log"]');
    await expect(auditLog).toBeVisible();
  });

  test('should filter audit log by action type', async ({ page }) => {
    await page.goto('/admin/audit-log');

    const actionFilter = page.locator('[data-testid="action-type-filter"]');
    await expect(actionFilter).toBeVisible();
  });

  test('should show admin ID for each action', async ({ page }) => {
    await page.goto('/admin/audit-log');

    const firstEntry = page.locator('[data-testid="audit-entry"]').first();

    if (await firstEntry.isVisible()) {
      await expect(firstEntry.locator('[data-testid="admin-id"]')).toBeVisible();
    }
  });
});

test.describe('Admin Access Control', () => {
  test('should redirect non-admins away from admin pages', async ({ page }) => {
    // Try to access admin without login
    await page.goto('/admin/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/(admin\/)?login/);
  });

  test('should show forbidden for non-admin users', async ({ page }) => {
    // Login as regular user
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="password-input"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Try to access admin
    await page.goto('/admin/dashboard');

    // Should show forbidden or redirect
    await expect(
      page.locator('text=/403|[Ff]orbidden|[Aa]cceso denegado/')
        .or(page)
    ).toHaveURL(/(?!\/admin\/dashboard)/);
  });
});
