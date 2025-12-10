/**
 * Theme Generator Service
 * =======================
 *
 * Generates CSS theme variables and styles based on organization branding.
 * Supports white-label customization for customer portal.
 */

import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

export interface ThemeTypography {
  fontFamily: string;
  headingFontFamily: string;
  baseFontSize: string;
  lineHeight: string;
}

export interface ThemeSpacing {
  borderRadius: string;
  buttonRadius: string;
  cardRadius: string;
  inputRadius: string;
}

export interface ThemeConfig {
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  darkMode: boolean;
}

export interface BrandingConfig {
  organizationId: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  fontFamily?: string;
  darkModeEnabled?: boolean;
  customCss?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert hex color to HSL components
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, '');

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate lighter/darker variations of a color
 */
function adjustLightness(hex: string, amount: number): string {
  const { h, s, l } = hexToHSL(hex);
  const newL = Math.max(0, Math.min(100, l + amount));
  return hslToHex(h, s, newL);
}

/**
 * Generate complementary color
 */
function getComplementaryColor(hex: string): string {
  const { h, s, l } = hexToHSL(hex);
  return hslToHex((h + 180) % 360, s, l);
}

/**
 * Check if color is light or dark
 */
function isLightColor(hex: string): boolean {
  const { l } = hexToHSL(hex);
  return l > 50;
}

// ═══════════════════════════════════════════════════════════════════════════════
// THEME GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a complete theme from branding config
 */
export function generateTheme(branding: BrandingConfig): ThemeConfig {
  const primaryColor = branding.primaryColor || '#16a34a';
  const secondaryColor = branding.secondaryColor || getComplementaryColor(primaryColor);
  const accentColor = branding.accentColor || adjustLightness(primaryColor, 20);

  const colors: ThemeColors = {
    primary: primaryColor,
    primaryLight: adjustLightness(primaryColor, 15),
    primaryDark: adjustLightness(primaryColor, -15),
    secondary: secondaryColor,
    accent: accentColor,
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textMuted: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info: '#3b82f6',
  };

  const typography: ThemeTypography = {
    fontFamily: branding.fontFamily || "'Inter', system-ui, -apple-system, sans-serif",
    headingFontFamily: branding.fontFamily || "'Inter', system-ui, -apple-system, sans-serif",
    baseFontSize: '16px',
    lineHeight: '1.5',
  };

  const spacing: ThemeSpacing = {
    borderRadius: '0.5rem',
    buttonRadius: '0.5rem',
    cardRadius: '0.75rem',
    inputRadius: '0.5rem',
  };

  return {
    colors,
    typography,
    spacing,
    darkMode: branding.darkModeEnabled ?? false,
  };
}

/**
 * Generate dark mode variation of theme
 */
export function generateDarkTheme(theme: ThemeConfig): ThemeConfig {
  return {
    ...theme,
    darkMode: true,
    colors: {
      ...theme.colors,
      background: '#111827',
      surface: '#1f2937',
      text: '#f9fafb',
      textMuted: '#9ca3af',
      border: '#374151',
    },
  };
}

/**
 * Generate CSS variables from theme
 */
export function generateCSSVariables(theme: ThemeConfig): string {
  const { colors, typography, spacing } = theme;

  return `
:root {
  /* Colors */
  --color-primary: ${colors.primary};
  --color-primary-light: ${colors.primaryLight};
  --color-primary-dark: ${colors.primaryDark};
  --color-secondary: ${colors.secondary};
  --color-accent: ${colors.accent};
  --color-background: ${colors.background};
  --color-surface: ${colors.surface};
  --color-text: ${colors.text};
  --color-text-muted: ${colors.textMuted};
  --color-border: ${colors.border};
  --color-error: ${colors.error};
  --color-warning: ${colors.warning};
  --color-success: ${colors.success};
  --color-info: ${colors.info};

  /* Typography */
  --font-family: ${typography.fontFamily};
  --font-family-heading: ${typography.headingFontFamily};
  --font-size-base: ${typography.baseFontSize};
  --line-height: ${typography.lineHeight};

  /* Spacing */
  --radius: ${spacing.borderRadius};
  --radius-button: ${spacing.buttonRadius};
  --radius-card: ${spacing.cardRadius};
  --radius-input: ${spacing.inputRadius};
}
`.trim();
}

/**
 * Generate Tailwind CSS theme override
 */
export function generateTailwindTheme(theme: ThemeConfig): object {
  const { colors, typography, spacing } = theme;

  return {
    colors: {
      primary: {
        DEFAULT: colors.primary,
        50: adjustLightness(colors.primary, 45),
        100: adjustLightness(colors.primary, 40),
        200: adjustLightness(colors.primary, 30),
        300: adjustLightness(colors.primary, 20),
        400: adjustLightness(colors.primary, 10),
        500: colors.primary,
        600: adjustLightness(colors.primary, -10),
        700: adjustLightness(colors.primary, -20),
        800: adjustLightness(colors.primary, -30),
        900: adjustLightness(colors.primary, -40),
      },
      secondary: {
        DEFAULT: colors.secondary,
      },
      accent: {
        DEFAULT: colors.accent,
      },
    },
    fontFamily: {
      sans: [typography.fontFamily],
      heading: [typography.headingFontFamily],
    },
    borderRadius: {
      DEFAULT: spacing.borderRadius,
      btn: spacing.buttonRadius,
      card: spacing.cardRadius,
      input: spacing.inputRadius,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get branding config for an organization
 */
export async function getBrandingConfig(organizationId: string): Promise<BrandingConfig | null> {
  try {
    const branding = await prisma.organizationBranding.findUnique({
      where: { organizationId },
    });

    if (!branding) return null;

    return {
      organizationId: branding.organizationId,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor || undefined,
      accentColor: branding.accentColor || undefined,
      logoUrl: branding.logoUrl || undefined,
      faviconUrl: branding.faviconUrl || undefined,
      fontFamily: branding.fontFamily || undefined,
      darkModeEnabled: branding.darkModeEnabled,
      customCss: branding.customCss || undefined,
    };
  } catch (error) {
    log.error('Error getting branding config', { organizationId, error });
    return null;
  }
}

/**
 * Save branding config for an organization
 */
export async function saveBrandingConfig(config: BrandingConfig): Promise<BrandingConfig> {
  try {
    const result = await prisma.organizationBranding.upsert({
      where: { organizationId: config.organizationId },
      create: {
        organizationId: config.organizationId,
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        accentColor: config.accentColor,
        logoUrl: config.logoUrl,
        faviconUrl: config.faviconUrl,
        fontFamily: config.fontFamily,
        darkModeEnabled: config.darkModeEnabled ?? false,
        customCss: config.customCss,
      },
      update: {
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        accentColor: config.accentColor,
        logoUrl: config.logoUrl,
        faviconUrl: config.faviconUrl,
        fontFamily: config.fontFamily,
        darkModeEnabled: config.darkModeEnabled,
        customCss: config.customCss,
        updatedAt: new Date(),
      },
    });

    log.info('Saved branding config', { organizationId: config.organizationId });

    return {
      organizationId: result.organizationId,
      primaryColor: result.primaryColor,
      secondaryColor: result.secondaryColor || undefined,
      accentColor: result.accentColor || undefined,
      logoUrl: result.logoUrl || undefined,
      faviconUrl: result.faviconUrl || undefined,
      fontFamily: result.fontFamily || undefined,
      darkModeEnabled: result.darkModeEnabled,
      customCss: result.customCss || undefined,
    };
  } catch (error) {
    log.error('Error saving branding config', { organizationId: config.organizationId, error });
    throw error;
  }
}

/**
 * Generate and cache theme CSS for an organization
 */
export async function generateOrganizationThemeCSS(organizationId: string): Promise<string> {
  const branding = await getBrandingConfig(organizationId);

  if (!branding) {
    // Return default theme
    const defaultTheme = generateTheme({
      organizationId,
      primaryColor: '#16a34a',
    });
    return generateCSSVariables(defaultTheme);
  }

  const theme = generateTheme(branding);
  let css = generateCSSVariables(theme);

  // Add dark mode if enabled
  if (branding.darkModeEnabled) {
    const darkTheme = generateDarkTheme(theme);
    css += `

@media (prefers-color-scheme: dark) {
${generateCSSVariables(darkTheme).replace(':root', '.dark')}
}

.dark {
${generateCSSVariables(darkTheme).replace(':root {', '').replace('}', '')}
}`;
  }

  // Append custom CSS if provided
  if (branding.customCss) {
    css += `

/* Custom CSS */
${branding.customCss}`;
  }

  return css;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  hexToHSL,
  hslToHex,
  adjustLightness,
  getComplementaryColor,
  isLightColor,
};
