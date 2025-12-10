/**
 * White-Label Configuration Types
 * ================================
 *
 * Type definitions for the white-label customization system.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BRANDING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface BrandingConfig {
  orgId: string;

  // Basic info
  companyName: string;
  tagline?: string;

  // Logos
  logoUrl?: string;
  logoSmallUrl?: string;
  faviconUrl?: string;

  // Colors (CSS color values)
  primaryColor: string;
  primaryColorLight?: string;
  primaryColorDark?: string;
  secondaryColor?: string;
  accentColor?: string;

  // Text colors
  textColor?: string;
  textColorLight?: string;
  backgroundColor?: string;

  // Typography
  fontFamily?: string;
  headingFontFamily?: string;

  // Contact
  supportEmail?: string;
  supportPhone?: string;
  supportWhatsApp?: string;

  // Social links
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };

  // Custom content
  welcomeMessage?: string;
  footerText?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface DomainConfig {
  orgId: string;
  customDomain: string;
  subdomain?: string;
  sslEnabled: boolean;
  sslCertificateId?: string;
  verificationStatus: 'pending' | 'verified' | 'failed';
  verificationToken?: string;
  createdAt: Date;
  verifiedAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// THEME CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ThemeConfig {
  // CSS Variables
  cssVariables: Record<string, string>;

  // Component-specific styles
  buttonStyle: 'rounded' | 'square' | 'pill';
  cardStyle: 'flat' | 'elevated' | 'bordered';
  inputStyle: 'outlined' | 'filled' | 'underlined';

  // Layout
  borderRadius: 'none' | 'small' | 'medium' | 'large';
  spacing: 'compact' | 'normal' | 'relaxed';

  // Dark mode
  darkModeEnabled: boolean;
  darkModeDefault: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface PortalConfig {
  orgId: string;

  // Features enabled
  features: {
    booking: boolean;
    jobTracking: boolean;
    invoices: boolean;
    payments: boolean;
    support: boolean;
    feedback: boolean;
    profile: boolean;
  };

  // Auth options
  authMethods: {
    magicLink: boolean;
    phoneOtp: boolean;
    whatsapp: boolean;
  };

  // Display options
  showPricing: boolean;
  showTechnicianInfo: boolean;
  showEstimatedTime: boolean;

  // Locale
  defaultLanguage: string;
  availableLanguages: string[];
  currency: string;
  timezone: string;
  dateFormat: string;

  // Custom pages
  customPages?: Array<{
    slug: string;
    title: string;
    content: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmailTemplateConfig {
  orgId: string;
  templateType: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  enabled: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE WHITE-LABEL CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export interface WhiteLabelConfig {
  orgId: string;
  branding: BrandingConfig;
  theme: ThemeConfig;
  portal: PortalConfig;
  domain?: DomainConfig;
  emailTemplates?: EmailTemplateConfig[];
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WhiteLabelRepository {
  getConfigByOrgId(orgId: string): Promise<WhiteLabelConfig | null>;
  getConfigByDomain(domain: string): Promise<WhiteLabelConfig | null>;
  updateBranding(orgId: string, branding: Partial<BrandingConfig>): Promise<void>;
  updateTheme(orgId: string, theme: Partial<ThemeConfig>): Promise<void>;
  updatePortalConfig(orgId: string, config: Partial<PortalConfig>): Promise<void>;
  setCustomDomain(orgId: string, domain: string): Promise<DomainConfig>;
  verifyDomain(orgId: string, domain: string): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_BRANDING: Omit<BrandingConfig, 'orgId' | 'companyName'> = {
  primaryColor: '#0066CC',
  primaryColorLight: '#3399FF',
  primaryColorDark: '#004499',
  secondaryColor: '#6B7280',
  accentColor: '#10B981',
  textColor: '#111827',
  textColorLight: '#6B7280',
  backgroundColor: '#FFFFFF',
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
};

export const DEFAULT_THEME: ThemeConfig = {
  cssVariables: {},
  buttonStyle: 'rounded',
  cardStyle: 'bordered',
  inputStyle: 'outlined',
  borderRadius: 'medium',
  spacing: 'normal',
  darkModeEnabled: false,
  darkModeDefault: false,
};

export const DEFAULT_PORTAL_CONFIG: Omit<PortalConfig, 'orgId'> = {
  features: {
    booking: true,
    jobTracking: true,
    invoices: true,
    payments: true,
    support: true,
    feedback: true,
    profile: true,
  },
  authMethods: {
    magicLink: true,
    phoneOtp: true,
    whatsapp: false,
  },
  showPricing: true,
  showTechnicianInfo: true,
  showEstimatedTime: true,
  defaultLanguage: 'es',
  availableLanguages: ['es'],
  currency: 'ARS',
  timezone: 'America/Argentina/Buenos_Aires',
  dateFormat: 'dd/MM/yyyy',
};
