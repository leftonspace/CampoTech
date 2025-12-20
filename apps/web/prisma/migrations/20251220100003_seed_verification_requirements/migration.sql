-- CampoTech Verification Requirements Seed Data
-- ==============================================
-- Phase 1.3: Seed Verification Requirements Master Data
--
-- This migration seeds all verification requirements:
-- - Tier 2: Required for business operation
-- - Tier 3: Required for employees
-- - Tier 4: Optional badges and certifications

-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTION FOR CUID GENERATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Simple ID generator for seed data
CREATE OR REPLACE FUNCTION generate_seed_id(prefix TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN prefix || '_' || encode(gen_random_bytes(8), 'hex');
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TIER 2 - REQUIRED FOR BUSINESS (Organization/Owner)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Organization CUIT
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'owner_cuit',
    'CUIT del Negocio',
    'Clave Única de Identificación Tributaria del negocio',
    'business',
    'organization',
    2,
    true,
    false,
    false,
    'afip',
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    1
) ON CONFLICT (code) DO NOTHING;

-- AFIP Status
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'afip_status',
    'Estado AFIP Activo',
    'Verificación de estado activo en AFIP',
    'business',
    'organization',
    2,
    true,
    false,
    false,
    'afip',
    30,  -- Re-check every 30 days
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    2
) ON CONFLICT (code) DO NOTHING;

-- Activity Code Match
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'activity_code_match',
    'Actividad Registrada',
    'Código de actividad en AFIP coincide con servicios ofrecidos',
    'business',
    'organization',
    2,
    true,
    false,
    false,
    'afip',
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    3
) ON CONFLICT (code) DO NOTHING;

-- Business Address
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'business_address',
    'Domicilio Fiscal',
    'Dirección fiscal registrada en AFIP',
    'business',
    'organization',
    2,
    true,
    false,
    false,
    'afip',
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    4
) ON CONFLICT (code) DO NOTHING;

-- Owner DNI
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'owner_dni',
    'DNI del Titular',
    'Documento Nacional de Identidad del titular del negocio',
    'identity',
    'owner',
    2,
    true,
    true,
    false,
    NULL,  -- Manual verification
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    5
) ON CONFLICT (code) DO NOTHING;

-- Owner DNI Selfie
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'owner_dni_selfie',
    'Selfie con DNI',
    'Foto del titular sosteniendo su DNI para verificación de identidad',
    'identity',
    'owner',
    2,
    true,
    true,
    false,
    NULL,
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    6
) ON CONFLICT (code) DO NOTHING;

-- Terms of Service Acceptance
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'terms_acceptance',
    'Aceptación de Términos',
    'Aceptación de términos de servicio y política de privacidad',
    'business',
    'owner',
    2,
    true,
    false,
    false,
    NULL,
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    7
) ON CONFLICT (code) DO NOTHING;

-- Verification Responsibility
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'verification_responsibility',
    'Responsabilidad de Verificación',
    'Declaración jurada de veracidad de los datos proporcionados',
    'business',
    'owner',
    2,
    true,
    false,
    false,
    NULL,
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    8
) ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TIER 3 - REQUIRED FOR EMPLOYEES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Employee CUIL
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'employee_cuil',
    'CUIL del Empleado',
    'Clave Única de Identificación Laboral del empleado',
    'identity',
    'employee',
    3,
    true,
    false,
    false,
    'afip',
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    20
) ON CONFLICT (code) DO NOTHING;

-- Employee DNI
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'employee_dni',
    'DNI del Empleado',
    'Documento Nacional de Identidad del empleado',
    'identity',
    'employee',
    3,
    true,
    true,
    false,
    NULL,
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    21
) ON CONFLICT (code) DO NOTHING;

-- Employee DNI Selfie
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'employee_dni_selfie',
    'Selfie con DNI (Empleado)',
    'Foto del empleado sosteniendo su DNI para verificación de identidad',
    'identity',
    'employee',
    3,
    true,
    true,
    false,
    NULL,
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    22
) ON CONFLICT (code) DO NOTHING;

-- Employee Phone Verification
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'employee_phone',
    'Teléfono Verificado (Empleado)',
    'Número de teléfono del empleado verificado por SMS',
    'identity',
    'employee',
    3,
    true,
    false,
    false,
    'sms',
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    23
) ON CONFLICT (code) DO NOTHING;

-- Employee Responsibility Acknowledgment
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'employee_responsibility',
    'Responsabilidad del Empleado',
    'Aceptación de responsabilidades y código de conducta',
    'business',
    'employee',
    3,
    true,
    false,
    false,
    NULL,
    NULL,
    '{30,14,7,1}',
    7,
    NULL,
    NULL,
    true,
    24
) ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TIER 4 - OPTIONAL BADGES & CERTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Gas Matricula (ENARGAS)
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'gas_matricula',
    'Matrícula de Gasista',
    'Registro de instalador de gas en ENARGAS',
    'professional',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    365,
    '{30,14,7,1}',
    30,
    'flame',
    'Gasista Matriculado',
    true,
    40
) ON CONFLICT (code) DO NOTHING;

-- Electrician Matricula
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'electrician_matricula',
    'Matrícula de Electricista',
    'Registro de Instalador Electricista autorizado',
    'professional',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    365,
    '{30,14,7,1}',
    30,
    'zap',
    'Electricista Matriculado',
    true,
    41
) ON CONFLICT (code) DO NOTHING;

-- Plumber Matricula
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'plumber_matricula',
    'Matrícula de Plomero',
    'Registro de instalador sanitario autorizado',
    'professional',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    365,
    '{30,14,7,1}',
    30,
    'droplet',
    'Plomero Matriculado',
    true,
    42
) ON CONFLICT (code) DO NOTHING;

-- Owner Background Check
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'antecedentes_owner',
    'Certificado de Antecedentes (Titular)',
    'Certificado del Registro Nacional de Reincidencia para el titular',
    'background',
    'owner',
    4,
    false,
    true,
    true,
    NULL,
    180,
    '{30,14,7,1}',
    14,
    'shield-check',
    'Antecedentes Verificados',
    true,
    43
) ON CONFLICT (code) DO NOTHING;

-- Employee Background Check
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'antecedentes_employee',
    'Certificado de Antecedentes (Empleado)',
    'Certificado del Registro Nacional de Reincidencia para empleados',
    'background',
    'employee',
    4,
    false,
    true,
    true,
    NULL,
    180,
    '{30,14,7,1}',
    14,
    NULL,
    NULL,
    true,
    44
) ON CONFLICT (code) DO NOTHING;

-- Civil Liability Insurance
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'seguro_responsabilidad_civil',
    'Seguro de Responsabilidad Civil',
    'Póliza de seguro de responsabilidad civil profesional vigente',
    'insurance',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    365,
    '{30,14,7,1}',
    14,
    'shield',
    'Asegurado',
    true,
    45
) ON CONFLICT (code) DO NOTHING;

-- ART Certificate
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'art_certificate',
    'Certificado ART',
    'Aseguradora de Riesgos del Trabajo vigente',
    'insurance',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    30,
    '{14,7,3,1}',
    7,
    'hard-hat',
    'ART Vigente',
    true,
    46
) ON CONFLICT (code) DO NOTHING;

-- AFIP Constancia (Full Document)
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'constancia_afip',
    'Constancia de Inscripción AFIP',
    'Documento completo de constancia de inscripción en AFIP',
    'financial',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    90,
    '{30,14,7,1}',
    14,
    'file-check',
    'Fiscalmente al Día',
    true,
    47
) ON CONFLICT (code) DO NOTHING;

-- Municipal Permit
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'habilitacion_municipal',
    'Habilitación Municipal',
    'Permiso comercial municipal para operar',
    'business',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    365,
    '{30,14,7,1}',
    30,
    'building',
    'Habilitación Municipal',
    true,
    48
) ON CONFLICT (code) DO NOTHING;

-- Monotributo Certificate
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'monotributo_certificate',
    'Constancia de Monotributo',
    'Constancia de inscripción en Monotributo vigente',
    'financial',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    30,
    '{14,7,3,1}',
    7,
    'receipt',
    'Monotributo al Día',
    true,
    49
) ON CONFLICT (code) DO NOTHING;

-- Vehicle Insurance (for fleet)
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'vehicle_insurance',
    'Seguro de Vehículos',
    'Póliza de seguro de vehículos de trabajo',
    'insurance',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    365,
    '{30,14,7,1}',
    14,
    'car',
    'Flota Asegurada',
    true,
    50
) ON CONFLICT (code) DO NOTHING;

-- Tool Certification
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'tool_certification',
    'Certificación de Herramientas',
    'Certificación de calibración y seguridad de herramientas',
    'professional',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    365,
    '{30,14,7,1}',
    14,
    'wrench',
    'Herramientas Certificadas',
    true,
    51
) ON CONFLICT (code) DO NOTHING;

-- Refrigeration License (for HVAC)
INSERT INTO verification_requirements (
    id, code, name, description, category, applies_to, tier,
    is_required, requires_document, requires_expiration, auto_verify_source,
    renewal_period_days, reminder_days_before, grace_period_days,
    badge_icon, badge_label, is_active, display_order
) VALUES (
    generate_seed_id('vr'),
    'refrigeration_license',
    'Licencia de Refrigeración',
    'Licencia para manipulación de gases refrigerantes',
    'professional',
    'organization',
    4,
    false,
    true,
    true,
    NULL,
    730, -- 2 years
    '{60,30,14,7,1}',
    30,
    'thermometer-snowflake',
    'Técnico en Refrigeración',
    true,
    52
) ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CLEANUP
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop the helper function (optional, can keep for future use)
-- DROP FUNCTION IF EXISTS generate_seed_id(TEXT);

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE verification_requirements IS 'Master list of all verification requirements seeded with Tier 2, 3, and 4 requirements';
