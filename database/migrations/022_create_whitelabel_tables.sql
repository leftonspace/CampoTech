-- Migration: 022_create_whitelabel_tables.sql
-- Description: Create tables for white-label configuration
-- Phase: 13.6 - White-Label Configuration

-- ══════════════════════════════════════════════════════════════════════════════
-- WHITE-LABEL BRANDING
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whitelabel_branding (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Logos
  logo_url TEXT,
  logo_small_url TEXT,
  favicon_url TEXT,

  -- Colors
  primary_color VARCHAR(20) DEFAULT '#0066CC',
  primary_color_light VARCHAR(20),
  primary_color_dark VARCHAR(20),
  secondary_color VARCHAR(20),
  accent_color VARCHAR(20),
  text_color VARCHAR(20),
  text_color_light VARCHAR(20),
  background_color VARCHAR(20),

  -- Typography
  font_family VARCHAR(255),
  heading_font_family VARCHAR(255),

  -- Content
  tagline VARCHAR(255),
  welcome_message TEXT,
  footer_text TEXT,

  -- Contact
  support_email VARCHAR(255),
  support_phone VARCHAR(50),
  support_whatsapp VARCHAR(50),

  -- Links
  social_links JSONB DEFAULT '{}',
  privacy_policy_url TEXT,
  terms_of_service_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE whitelabel_branding IS 'Organization-specific branding configuration';
COMMENT ON COLUMN whitelabel_branding.social_links IS 'JSON object with social media URLs';

-- ══════════════════════════════════════════════════════════════════════════════
-- WHITE-LABEL DOMAINS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whitelabel_domains (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  custom_domain VARCHAR(255) NOT NULL UNIQUE,
  subdomain VARCHAR(100),
  ssl_enabled BOOLEAN DEFAULT TRUE,
  ssl_certificate_id VARCHAR(255),
  verification_status VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'failed')),
  verification_token VARCHAR(64),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for domain lookups
CREATE INDEX IF NOT EXISTS idx_whitelabel_domains_domain
  ON whitelabel_domains(custom_domain)
  WHERE verification_status = 'verified';

COMMENT ON TABLE whitelabel_domains IS 'Custom domain configuration for white-label portals';

-- ══════════════════════════════════════════════════════════════════════════════
-- WHITE-LABEL PORTAL CONFIG
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whitelabel_portal_config (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Feature toggles
  feature_booking BOOLEAN DEFAULT TRUE,
  feature_job_tracking BOOLEAN DEFAULT TRUE,
  feature_invoices BOOLEAN DEFAULT TRUE,
  feature_payments BOOLEAN DEFAULT TRUE,
  feature_support BOOLEAN DEFAULT TRUE,
  feature_feedback BOOLEAN DEFAULT TRUE,
  feature_profile BOOLEAN DEFAULT TRUE,

  -- Auth options
  auth_magic_link BOOLEAN DEFAULT TRUE,
  auth_phone_otp BOOLEAN DEFAULT TRUE,
  auth_whatsapp BOOLEAN DEFAULT FALSE,

  -- Display options
  show_pricing BOOLEAN DEFAULT TRUE,
  show_technician_info BOOLEAN DEFAULT TRUE,
  show_estimated_time BOOLEAN DEFAULT TRUE,

  -- Locale
  default_language VARCHAR(10) DEFAULT 'es',
  available_languages TEXT[] DEFAULT ARRAY['es'],
  currency VARCHAR(3) DEFAULT 'ARS',
  timezone VARCHAR(50) DEFAULT 'America/Argentina/Buenos_Aires',
  date_format VARCHAR(20) DEFAULT 'dd/MM/yyyy',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE whitelabel_portal_config IS 'Portal feature and display configuration';

-- ══════════════════════════════════════════════════════════════════════════════
-- WHITE-LABEL THEMES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whitelabel_themes (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- CSS Variables
  css_variables JSONB DEFAULT '{}',

  -- Component styles
  button_style VARCHAR(20) DEFAULT 'rounded'
    CHECK (button_style IN ('rounded', 'square', 'pill')),
  card_style VARCHAR(20) DEFAULT 'bordered'
    CHECK (card_style IN ('flat', 'elevated', 'bordered')),
  input_style VARCHAR(20) DEFAULT 'outlined'
    CHECK (input_style IN ('outlined', 'filled', 'underlined')),

  -- Layout
  border_radius VARCHAR(20) DEFAULT 'medium'
    CHECK (border_radius IN ('none', 'small', 'medium', 'large')),
  spacing VARCHAR(20) DEFAULT 'normal'
    CHECK (spacing IN ('compact', 'normal', 'relaxed')),

  -- Dark mode
  dark_mode_enabled BOOLEAN DEFAULT FALSE,
  dark_mode_default BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE whitelabel_themes IS 'Theme customization settings';

-- ══════════════════════════════════════════════════════════════════════════════
-- WHITE-LABEL EMAIL TEMPLATES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whitelabel_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_type VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html_template TEXT NOT NULL,
  text_template TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_whitelabel_email_templates_org
  ON whitelabel_email_templates(org_id, template_type)
  WHERE enabled = TRUE;

COMMENT ON TABLE whitelabel_email_templates IS 'Custom email templates per organization';
COMMENT ON COLUMN whitelabel_email_templates.template_type IS 'e.g., magic_link, booking_confirmation, invoice';

-- ══════════════════════════════════════════════════════════════════════════════
-- WHITE-LABEL CUSTOM PAGES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS whitelabel_custom_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_whitelabel_custom_pages_org
  ON whitelabel_custom_pages(org_id, slug)
  WHERE is_published = TRUE;

COMMENT ON TABLE whitelabel_custom_pages IS 'Custom content pages for white-label portals';

-- ══════════════════════════════════════════════════════════════════════════════
-- ADD COLUMNS TO ORGANIZATIONS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

-- Add slug for subdomain routing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'slug'
  ) THEN
    ALTER TABLE organizations ADD COLUMN slug VARCHAR(100) UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
    COMMENT ON COLUMN organizations.slug IS 'URL-friendly identifier for subdomain routing';
  END IF;
END $$;

-- Add custom_domain for quick lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'custom_domain'
  ) THEN
    ALTER TABLE organizations ADD COLUMN custom_domain VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_organizations_custom_domain ON organizations(custom_domain);
    COMMENT ON COLUMN organizations.custom_domain IS 'Verified custom domain for portal';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_whitelabel_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_whitelabel_branding_timestamp
  BEFORE UPDATE ON whitelabel_branding
  FOR EACH ROW EXECUTE FUNCTION update_whitelabel_timestamp();

CREATE TRIGGER update_whitelabel_portal_config_timestamp
  BEFORE UPDATE ON whitelabel_portal_config
  FOR EACH ROW EXECUTE FUNCTION update_whitelabel_timestamp();

CREATE TRIGGER update_whitelabel_themes_timestamp
  BEFORE UPDATE ON whitelabel_themes
  FOR EACH ROW EXECUTE FUNCTION update_whitelabel_timestamp();

CREATE TRIGGER update_whitelabel_email_templates_timestamp
  BEFORE UPDATE ON whitelabel_email_templates
  FOR EACH ROW EXECUTE FUNCTION update_whitelabel_timestamp();

CREATE TRIGGER update_whitelabel_custom_pages_timestamp
  BEFORE UPDATE ON whitelabel_custom_pages
  FOR EACH ROW EXECUTE FUNCTION update_whitelabel_timestamp();

-- Sync custom_domain to organizations table when verified
CREATE OR REPLACE FUNCTION sync_custom_domain_to_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_status = 'verified' THEN
    UPDATE organizations SET custom_domain = NEW.custom_domain WHERE id = NEW.org_id;
  ELSIF OLD.verification_status = 'verified' AND NEW.verification_status != 'verified' THEN
    UPDATE organizations SET custom_domain = NULL WHERE id = NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_custom_domain
  AFTER INSERT OR UPDATE ON whitelabel_domains
  FOR EACH ROW EXECUTE FUNCTION sync_custom_domain_to_org();

-- ══════════════════════════════════════════════════════════════════════════════
-- DEFAULT TEMPLATE TYPES
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON COLUMN whitelabel_email_templates.template_type IS
'Standard template types:
- magic_link: Magic link authentication email
- otp_code: OTP code SMS/email
- booking_confirmation: Booking confirmed notification
- booking_reminder: Upcoming booking reminder
- job_started: Technician started work notification
- job_completed: Job completion notification
- invoice: Invoice email
- payment_received: Payment confirmation
- support_ticket_created: New support ticket confirmation
- support_ticket_reply: Support ticket reply notification
';
