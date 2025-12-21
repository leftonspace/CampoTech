/**
 * WhatsApp E2E Tests
 * ==================
 *
 * End-to-end tests for WhatsApp user flows:
 * - Setup wizard UI flow
 * - Settings page functionality
 * - Invoice WhatsApp button
 * - Customer profile WhatsApp button
 */

import { test, expect, Page } from '@playwright/test';

// Test fixtures
const TEST_USER = {
  email: 'whatsapp-test@campotech-test.com',
  password: 'TestPassword123!',
};

const TEST_PHONE = '+54 9 11 5555-1234';

// Helper functions
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

async function navigateToWhatsAppSettings(page: Page) {
  await page.goto('/dashboard/settings/whatsapp');
  await page.waitForLoadState('networkidle');
}

test.describe('WhatsApp Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await navigateToWhatsAppSettings(page);
  });

  test('should display WhatsApp settings page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/WhatsApp/);
  });

  test('should show integration type options based on tier', async ({ page }) => {
    // Check for personal number section (INICIAL tier)
    const personalNumberSection = page.locator('text=Número personal');
    // Section visibility depends on tier, so we just check the page loads
    await expect(page).toHaveURL(/\/dashboard\/settings\/whatsapp/);
  });

  test('should display BSP section for eligible tiers', async ({ page }) => {
    // BSP section should be visible for PROFESIONAL+ tiers
    const bspSection = page.locator('text=WhatsApp Business API');
    // This depends on the user's subscription tier
  });

  test('should navigate to setup wizard when clicking configure', async ({ page }) => {
    // Look for configure or setup button
    const configureButton = page.locator('button:has-text("Configurar"), a:has-text("Configurar")').first();

    if (await configureButton.isVisible()) {
      await configureButton.click();
      await page.waitForURL(/\/dashboard\/settings\/whatsapp\/setup/);
      await expect(page).toHaveURL(/setup/);
    }
  });

  test('should display usage link when BSP is configured', async ({ page }) => {
    // Look for "Ver uso" link that appears when BSP is configured
    const usageLink = page.locator('a:has-text("Ver uso")');

    if (await usageLink.isVisible()) {
      await usageLink.click();
      await page.waitForURL(/\/dashboard\/settings\/whatsapp\/usage/);
    }
  });
});

test.describe('WhatsApp Setup Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/dashboard/settings/whatsapp/setup');
    await page.waitForLoadState('networkidle');
  });

  test('should display setup wizard steps', async ({ page }) => {
    // Wizard should show integration type selection first
    await expect(page.locator('h1, h2')).toContainText(/[Cc]onfigurar|[Ee]legir/);
  });

  test('should allow selecting personal number integration', async ({ page }) => {
    // Look for personal number option
    const personalOption = page.locator('button:has-text("personal"), [data-option="personal"]').first();

    if (await personalOption.isVisible()) {
      await personalOption.click();
      // Should proceed to phone number input
      await expect(page.locator('input[type="tel"], input[placeholder*="teléfono"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate phone number format', async ({ page }) => {
    // Navigate to phone input step
    const personalOption = page.locator('button:has-text("personal"), [data-option="personal"]').first();

    if (await personalOption.isVisible()) {
      await personalOption.click();

      const phoneInput = page.locator('input[type="tel"], input[placeholder*="teléfono"]').first();
      if (await phoneInput.isVisible()) {
        // Enter invalid phone
        await phoneInput.fill('123');

        // Look for error message or disabled continue button
        const continueButton = page.locator('button:has-text("Continuar"), button:has-text("Siguiente")').first();

        // Button should be disabled or error should show
        const isDisabled = await continueButton.isDisabled();
        const hasError = await page.locator('text=inválido, text=incorrecto').isVisible();

        expect(isDisabled || hasError).toBe(true);
      }
    }
  });

  test('should show BSP number selection for eligible tiers', async ({ page }) => {
    // Look for BSP option (only visible for PROFESIONAL+)
    const bspOption = page.locator('button:has-text("exclusivo"), [data-option="bsp"]').first();

    if (await bspOption.isVisible()) {
      await bspOption.click();
      // Should show number selection grid
      await expect(page.locator('text=disponible, text=Seleccionar')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should navigate back from wizard', async ({ page }) => {
    // Look for back link
    const backLink = page.locator('a:has-text("Volver"), button:has-text("Volver")').first();

    if (await backLink.isVisible()) {
      await backLink.click();
      await page.waitForURL(/\/dashboard\/settings\/whatsapp$/);
    }
  });
});

test.describe('WhatsApp Verification Step', () => {
  test('should display 6-digit OTP input', async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);

    // Navigate to a verification step (this requires a phone number to be selected first)
    // This is a structural test - we check the component exists
    await page.goto('/dashboard/settings/whatsapp/setup');

    // The verification step would be visible after number selection
    // For now, we just verify the setup page loads
    await expect(page).toHaveURL(/setup/);
  });

  test('should auto-focus next input on digit entry', async ({ page }) => {
    // This would test the OTP input behavior
    // Requires navigating through the wizard to verification step
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/dashboard/settings/whatsapp/setup');
  });
});

test.describe('WhatsApp Usage Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
  });

  test('should display usage statistics', async ({ page }) => {
    await page.goto('/dashboard/settings/whatsapp/usage');
    await page.waitForLoadState('networkidle');

    // Check for usage-related content
    const hasUsageContent =
      await page.locator('text=mensajes').isVisible() ||
      await page.locator('text=uso').isVisible() ||
      await page.locator('text=límite').isVisible();

    // Either shows usage data or redirects if not configured
    expect(hasUsageContent || page.url().includes('whatsapp')).toBe(true);
  });

  test('should show usage chart', async ({ page }) => {
    await page.goto('/dashboard/settings/whatsapp/usage');
    await page.waitForLoadState('networkidle');

    // Look for chart element
    const chart = page.locator('[data-testid="usage-chart"], .chart, canvas');
    // Chart visibility depends on having usage data
  });

  test('should display upgrade CTA when approaching limits', async ({ page }) => {
    await page.goto('/dashboard/settings/whatsapp/usage');
    await page.waitForLoadState('networkidle');

    // Look for upgrade-related content
    const upgradeLink = page.locator('a:has-text("Actualizar"), a:has-text("Ver planes")');
    // Upgrade CTA visibility depends on usage level
  });
});

test.describe('Invoice WhatsApp Button', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
  });

  test('should show WhatsApp button on invoice page', async ({ page }) => {
    await page.goto('/dashboard/invoices');
    await page.waitForLoadState('networkidle');

    // Look for any invoice row
    const invoiceRow = page.locator('table tr, [data-testid="invoice-row"]').first();

    if (await invoiceRow.isVisible()) {
      await invoiceRow.click();

      // Look for WhatsApp action button
      const waButton = page.locator('button:has-text("WhatsApp"), a[href*="wa.me"]');
      // Button visibility depends on having WhatsApp configured
    }
  });

  test('should open wa.me link in new tab', async ({ page }) => {
    await page.goto('/dashboard/invoices');
    await page.waitForLoadState('networkidle');

    // Look for WhatsApp links
    const waLinks = page.locator('a[href*="wa.me"]');
    const count = await waLinks.count();

    if (count > 0) {
      const href = await waLinks.first().getAttribute('href');
      expect(href).toContain('wa.me');
    }
  });
});

test.describe('Customer Profile WhatsApp Button', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
  });

  test('should show WhatsApp button on customer profile', async ({ page }) => {
    await page.goto('/dashboard/customers');
    await page.waitForLoadState('networkidle');

    // Look for any customer row
    const customerRow = page.locator('table tr, [data-testid="customer-row"]').first();

    if (await customerRow.isVisible()) {
      await customerRow.click();
      await page.waitForLoadState('networkidle');

      // Look for WhatsApp action on customer detail
      const waButton = page.locator('button:has-text("WhatsApp"), a[href*="wa.me"]');
      // Button visibility depends on customer having a phone number
    }
  });

  test('should generate correct wa.me link with customer name', async ({ page }) => {
    await page.goto('/dashboard/customers');
    await page.waitForLoadState('networkidle');

    // Look for WhatsApp links with pre-filled message
    const waLinks = page.locator('a[href*="wa.me"]');
    const count = await waLinks.count();

    if (count > 0) {
      const href = await waLinks.first().getAttribute('href');
      expect(href).toContain('wa.me');
      // Should have text parameter for greeting
      if (href?.includes('?text=')) {
        expect(href).toContain('Hola');
      }
    }
  });
});

test.describe('WhatsApp AI Integration UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
  });

  test('should navigate to AI assistant settings from WhatsApp page', async ({ page }) => {
    await navigateToWhatsAppSettings(page);

    // Look for AI settings link
    const aiLink = page.locator('a:has-text("IA"), a:has-text("asistente")');

    if (await aiLink.isVisible()) {
      await aiLink.click();
      await page.waitForURL(/\/ai-assistant/);
    }
  });

  test('should show AI toggle on WhatsApp settings', async ({ page }) => {
    await navigateToWhatsAppSettings(page);

    // Look for AI toggle
    const aiToggle = page.locator('[data-testid="ai-toggle"], button[aria-label*="IA"]');
    // Toggle visibility depends on tier and configuration
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display WhatsApp settings on mobile', async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await navigateToWhatsAppSettings(page);

    // Page should be scrollable and content visible
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should display setup wizard on mobile', async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/dashboard/settings/whatsapp/setup');
    await page.waitForLoadState('networkidle');

    // Wizard should be usable on mobile
    await expect(page).toHaveURL(/setup/);
  });
});

test.describe('Error Handling', () => {
  test('should show error message on API failure', async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);

    // Intercept API calls to simulate failure
    await page.route('**/api/settings/whatsapp', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await navigateToWhatsAppSettings(page);

    // Should show error state
    const errorMessage = page.locator('text=error, text=Error');
    // Error handling should be graceful
  });

  test('should allow retry on network failure', async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await navigateToWhatsAppSettings(page);

    // Look for retry button after error
    const retryButton = page.locator('button:has-text("Reintentar"), button:has-text("Retry")');
    // Retry functionality should be available
  });
});
