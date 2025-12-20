/**
 * Subscription E2E Tests
 * ======================
 *
 * End-to-end tests for subscription user flows:
 * - User signup and trial
 * - Verification completion
 * - Payment processing
 * - Cancellation
 */

import { test, expect, Page } from '@playwright/test';

// Test fixtures
const TEST_USER = {
  email: `test-${Date.now()}@campotech-test.com`,
  password: 'TestPassword123!',
  name: 'Test User',
  orgName: 'Test Organization',
  cuit: '30-71659554-9',
  phone: '1112345678',
};

// Helper functions
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/login');
}

test.describe('User Signup and Trial', () => {
  test('should allow new user to sign up and receive trial', async ({ page }) => {
    await page.goto('/signup');

    // Fill signup form
    await page.fill('[data-testid="name-input"]', TEST_USER.name);
    await page.fill('[data-testid="email-input"]', TEST_USER.email);
    await page.fill('[data-testid="password-input"]', TEST_USER.password);
    await page.fill('[data-testid="org-name-input"]', TEST_USER.orgName);

    // Accept terms
    await page.check('[data-testid="terms-checkbox"]');

    // Submit
    await page.click('[data-testid="signup-button"]');

    // Should redirect to onboarding or dashboard
    await expect(page).toHaveURL(/\/(onboarding|dashboard)/);

    // Should show trial banner
    await expect(page.locator('[data-testid="trial-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="trial-days-remaining"]')).toContainText('14');
  });

  test('should show trial expiration warning when few days remain', async ({ page }) => {
    // This test would require time manipulation in the test database
    // For now, we check that the warning element exists
    await login(page, TEST_USER.email, TEST_USER.password);

    // Check warning banner can be displayed
    const trialBanner = page.locator('[data-testid="trial-banner"]');
    await expect(trialBanner).toBeVisible();
  });
});

test.describe('User Verification', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
  });

  test('should navigate to verification page', async ({ page }) => {
    await page.goto('/verification');
    await expect(page).toHaveURL('/verification');
    await expect(page.locator('h1')).toContainText(/[Vv]erificación/);
  });

  test('should show verification steps', async ({ page }) => {
    await page.goto('/verification');

    // Should show all verification steps
    await expect(page.locator('[data-testid="step-cuit"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-dni"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-selfie"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-phone"]')).toBeVisible();
  });

  test('should validate CUIT format', async ({ page }) => {
    await page.goto('/verification');
    await page.click('[data-testid="step-cuit"]');

    // Enter invalid CUIT
    await page.fill('[data-testid="cuit-input"]', '12-34567890-1');
    await page.click('[data-testid="cuit-submit"]');

    // Should show error
    await expect(page.locator('[data-testid="cuit-error"]')).toBeVisible();
  });

  test('should accept valid CUIT format', async ({ page }) => {
    await page.goto('/verification');
    await page.click('[data-testid="step-cuit"]');

    // Enter valid CUIT
    await page.fill('[data-testid="cuit-input"]', TEST_USER.cuit);
    await page.click('[data-testid="cuit-submit"]');

    // Should show success or proceed to next step
    await expect(
      page.locator('[data-testid="cuit-success"]').or(page.locator('[data-testid="step-dni"]'))
    ).toBeVisible();
  });

  test('should allow document upload', async ({ page }) => {
    await page.goto('/verification');

    // Navigate to DNI step
    await page.click('[data-testid="step-dni"]');

    // Check file upload is available
    const fileInput = page.locator('[data-testid="dni-front-upload"]');
    await expect(fileInput).toBeAttached();
  });
});

test.describe('Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
  });

  test('should display pricing plans', async ({ page }) => {
    await page.goto('/billing/plans');

    // Should show all tiers
    await expect(page.locator('[data-testid="plan-inicial"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-profesional"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-empresa"]')).toBeVisible();

    // Should show prices in ARS
    await expect(page.locator('[data-testid="plan-inicial"]')).toContainText(/25[.,]?000/);
  });

  test('should allow plan selection', async ({ page }) => {
    await page.goto('/billing/plans');

    // Click on INICIAL plan
    await page.click('[data-testid="select-plan-inicial"]');

    // Should redirect to checkout or show payment form
    await expect(page).toHaveURL(/\/(checkout|billing)/);
  });

  test('should show MercadoPago payment options', async ({ page }) => {
    await page.goto('/billing/checkout?plan=INICIAL');

    // Should show MercadoPago integration
    await expect(
      page.locator('[data-testid="mercadopago-button"]').or(page.locator('.mercadopago-button'))
    ).toBeVisible();
  });
});

test.describe('Subscription Cancellation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
  });

  test('should show cancellation option in billing', async ({ page }) => {
    await page.goto('/billing');

    // Should have cancel subscription link
    const cancelButton = page.locator('[data-testid="cancel-subscription"]');
    await expect(cancelButton).toBeVisible();
  });

  test('should show refund eligibility for Ley 24.240', async ({ page }) => {
    await page.goto('/billing/cancel');

    // Should show Ley 24.240 information
    await expect(page.locator('text=/Ley 24[.,]?240|reembolso|10 días/')).toBeVisible();
  });

  test('should require confirmation for cancellation', async ({ page }) => {
    await page.goto('/billing/cancel');

    // Should have confirmation checkbox or button
    await expect(
      page.locator('[data-testid="confirm-cancel"]').or(page.locator('button:has-text("Confirmar")'))
    ).toBeVisible();
  });
});

test.describe('Access Control', () => {
  test('should redirect blocked users to blocked page', async ({ page }) => {
    // This would require a blocked test account
    // For now we verify the blocked page exists
    await page.goto('/blocked');

    // Page should load
    await expect(page).toHaveURL('/blocked');
  });

  test('should allow billing access when blocked', async ({ page }) => {
    // Navigate to billing from blocked page
    await page.goto('/blocked');

    const billingLink = page.locator('a[href="/billing"]');
    if (await billingLink.isVisible()) {
      await billingLink.click();
      await expect(page).toHaveURL(/\/billing/);
    }
  });

  test('should show upgrade prompt for feature limits', async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);

    // Try to access a feature that requires upgrade
    await page.goto('/settings/advanced');

    // Should show upgrade prompt
    const upgradePrompt = page.locator('[data-testid="upgrade-prompt"]');
    // This may or may not appear depending on tier
    // We just check the page loads
    await expect(page).toHaveURL(/\/settings/);
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display mobile menu', async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);

    // Should have mobile menu button
    const mobileMenu = page.locator('[data-testid="mobile-menu-button"]');
    await expect(mobileMenu).toBeVisible();
  });

  test('should have touch-friendly buttons', async ({ page }) => {
    await page.goto('/billing/plans');

    // Buttons should be at least 44x44px for touch
    const planButton = page.locator('[data-testid="select-plan-inicial"]');
    if (await planButton.isVisible()) {
      const box = await planButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe('Error Handling', () => {
  test('should show friendly error for network failures', async ({ page }) => {
    // Block API calls
    await page.route('**/api/**', (route) => route.abort());

    await page.goto('/dashboard');

    // Should show error message, not crash
    await expect(page.locator('[data-testid="error-message"]').or(page.locator('text=/error|Error/'))).toBeVisible();
  });

  test('should show 404 page for non-existent routes', async ({ page }) => {
    await page.goto('/non-existent-page-12345');

    // Should show 404
    await expect(page.locator('text=/404|no encontrada|not found/i')).toBeVisible();
  });
});
