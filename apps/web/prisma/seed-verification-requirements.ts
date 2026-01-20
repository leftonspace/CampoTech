/**
 * Verification Requirements Seed Script
 * =====================================
 *
 * Seeds the verification_requirements table with all Tier 2, 3, and 4 requirements.
 *
 * Run with: npx tsx prisma/seed-verification-requirements.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type VerificationCategory =
  | 'identity'
  | 'business'
  | 'professional'
  | 'insurance'
  | 'background'
  | 'financial';

type VerificationAppliesTo = 'organization' | 'owner' | 'employee';

interface VerificationRequirementSeed {
  code: string;
  name: string;
  description: string;
  category: VerificationCategory;
  appliesTo: VerificationAppliesTo;
  tier: number;
  isRequired: boolean;
  requiresDocument: boolean;
  requiresExpiration: boolean;
  autoVerifySource: string | null;
  renewalPeriodDays: number | null;
  reminderDaysBefore: number[];
  gracePeriodDays: number;
  badgeIcon: string | null;
  badgeLabel: string | null;
  displayOrder: number;
}

const verificationRequirements: VerificationRequirementSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════════
  // TIER 2 - REQUIRED FOR BUSINESS (Organization/Owner)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    code: 'owner_cuit',
    name: 'CUIT del Negocio',
    description: 'Clave Única de Identificación Tributaria del negocio',
    category: 'business',
    appliesTo: 'organization',
    tier: 2,
    isRequired: true,
    requiresDocument: false,
    requiresExpiration: false,
    autoVerifySource: 'afip',
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 1,
  },
  {
    code: 'afip_status',
    name: 'Estado AFIP Activo',
    description: 'Verificación de estado activo en AFIP',
    category: 'business',
    appliesTo: 'organization',
    tier: 2,
    isRequired: true,
    requiresDocument: false,
    requiresExpiration: false,
    autoVerifySource: 'afip',
    renewalPeriodDays: 30,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 2,
  },
  {
    code: 'activity_code_match',
    name: 'Actividad Registrada',
    description: 'Código de actividad en AFIP coincide con servicios ofrecidos',
    category: 'business',
    appliesTo: 'organization',
    tier: 2,
    isRequired: true,
    requiresDocument: false,
    requiresExpiration: false,
    autoVerifySource: 'afip',
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 3,
  },
  {
    code: 'business_address',
    name: 'Domicilio Fiscal',
    description: 'Dirección fiscal registrada en AFIP',
    category: 'business',
    appliesTo: 'organization',
    tier: 2,
    isRequired: true,
    requiresDocument: false,
    requiresExpiration: false,
    autoVerifySource: 'afip',
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 4,
  },
  {
    code: 'owner_dni',
    name: 'DNI del Titular',
    description: 'Documento Nacional de Identidad del titular del negocio',
    category: 'identity',
    appliesTo: 'owner',
    tier: 2,
    isRequired: true,
    requiresDocument: true,
    requiresExpiration: false,
    autoVerifySource: null,
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 5,
  },
  {
    code: 'owner_dni_selfie',
    name: 'Selfie con DNI',
    description: 'Foto del titular sosteniendo su DNI para verificación de identidad',
    category: 'identity',
    appliesTo: 'owner',
    tier: 2,
    isRequired: true,
    requiresDocument: true,
    requiresExpiration: false,
    autoVerifySource: null,
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 6,
  },
  {
    code: 'terms_acceptance',
    name: 'Aceptación de Términos',
    description: 'Aceptación de términos de servicio y política de privacidad',
    category: 'business',
    appliesTo: 'owner',
    tier: 2,
    isRequired: true,
    requiresDocument: false,
    requiresExpiration: false,
    autoVerifySource: null,
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 7,
  },
  {
    code: 'verification_responsibility',
    name: 'Responsabilidad de Verificación',
    description: 'Declaración jurada de veracidad de los datos proporcionados',
    category: 'business',
    appliesTo: 'owner',
    tier: 2,
    isRequired: true,
    requiresDocument: false,
    requiresExpiration: false,
    autoVerifySource: null,
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 8,
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // TIER 3 - REQUIRED FOR EMPLOYEES
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    code: 'employee_cuil',
    name: 'CUIL del Empleado',
    description: 'Clave Única de Identificación Laboral del empleado',
    category: 'identity',
    appliesTo: 'employee',
    tier: 3,
    isRequired: true,
    requiresDocument: false,
    requiresExpiration: false,
    autoVerifySource: 'afip',
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 20,
  },
  {
    code: 'employee_dni',
    name: 'DNI del Empleado',
    description: 'Documento Nacional de Identidad del empleado',
    category: 'identity',
    appliesTo: 'employee',
    tier: 3,
    isRequired: true,
    requiresDocument: true,
    requiresExpiration: false,
    autoVerifySource: null,
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 21,
  },
  {
    code: 'employee_dni_selfie',
    name: 'Selfie con DNI (Empleado)',
    description: 'Foto del empleado sosteniendo su DNI para verificación de identidad',
    category: 'identity',
    appliesTo: 'employee',
    tier: 3,
    isRequired: true,
    requiresDocument: true,
    requiresExpiration: false,
    autoVerifySource: null,
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 22,
  },
  {
    code: 'employee_phone',
    name: 'Teléfono Verificado (Empleado)',
    description: 'Número de teléfono del empleado verificado por SMS',
    category: 'identity',
    appliesTo: 'employee',
    tier: 3,
    isRequired: true,
    requiresDocument: false,
    requiresExpiration: false,
    autoVerifySource: 'sms',
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 23,
  },
  {
    code: 'employee_responsibility',
    name: 'Responsabilidad del Empleado',
    description: 'Aceptación de responsabilidades y código de conducta',
    category: 'business',
    appliesTo: 'employee',
    tier: 3,
    isRequired: true,
    requiresDocument: false,
    requiresExpiration: false,
    autoVerifySource: null,
    renewalPeriodDays: null,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 7,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 24,
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // TIER 4 - OPTIONAL BADGES & CERTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    code: 'gas_matricula',
    name: 'Matrícula de Gasista',
    description: 'Registro de instalador de gas en ENARGAS',
    category: 'professional',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: 'registry',  // Auto-verify against scraped registry data
    renewalPeriodDays: 365,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 30,
    badgeIcon: 'flame',
    badgeLabel: 'Gasista Matriculado',
    displayOrder: 40,
  },
  {
    code: 'electrician_matricula',
    name: 'Matrícula de Electricista',
    description: 'Registro de Instalador Electricista autorizado',
    category: 'professional',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: 'registry',  // Auto-verify against scraped registry data
    renewalPeriodDays: 365,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 30,
    badgeIcon: 'zap',
    badgeLabel: 'Electricista Matriculado',
    displayOrder: 41,
  },
  {
    code: 'plumber_matricula',
    name: 'Matrícula de Plomero',
    description: 'Registro de instalador sanitario autorizado',
    category: 'professional',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: 'registry',  // Auto-verify against scraped registry data
    renewalPeriodDays: 365,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 30,
    badgeIcon: 'droplet',
    badgeLabel: 'Plomero Matriculado',
    displayOrder: 42,
  },
  {
    code: 'antecedentes_owner',
    name: 'Certificado de Antecedentes (Titular)',
    description: 'Certificado del Registro Nacional de Reincidencia para el titular',
    category: 'background',
    appliesTo: 'owner',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: null,
    renewalPeriodDays: 180,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 14,
    badgeIcon: 'shield-check',
    badgeLabel: 'Antecedentes Verificados',
    displayOrder: 43,
  },
  {
    code: 'antecedentes_employee',
    name: 'Certificado de Antecedentes (Empleado)',
    description: 'Certificado del Registro Nacional de Reincidencia para empleados',
    category: 'background',
    appliesTo: 'employee',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: null,
    renewalPeriodDays: 180,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 14,
    badgeIcon: null,
    badgeLabel: null,
    displayOrder: 44,
  },
  {
    code: 'seguro_responsabilidad_civil',
    name: 'Seguro de Responsabilidad Civil',
    description: 'Póliza de seguro de responsabilidad civil profesional vigente',
    category: 'insurance',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: null,
    renewalPeriodDays: 365,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 14,
    badgeIcon: 'shield',
    badgeLabel: 'Asegurado',
    displayOrder: 45,
  },
  {
    code: 'art_certificate',
    name: 'Certificado ART',
    description: 'Aseguradora de Riesgos del Trabajo vigente',
    category: 'insurance',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: null,
    renewalPeriodDays: 30,
    reminderDaysBefore: [14, 7, 3, 1],
    gracePeriodDays: 7,
    badgeIcon: 'hard-hat',
    badgeLabel: 'ART Vigente',
    displayOrder: 46,
  },
  {
    code: 'constancia_afip',
    name: 'Constancia de Inscripción AFIP',
    description: 'Documento completo de constancia de inscripción en AFIP',
    category: 'financial',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: null,
    renewalPeriodDays: 90,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 14,
    badgeIcon: 'file-check',
    badgeLabel: 'Fiscalmente al Día',
    displayOrder: 47,
  },
  {
    code: 'habilitacion_municipal',
    name: 'Habilitación Municipal',
    description: 'Permiso comercial municipal para operar',
    category: 'business',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: null,
    renewalPeriodDays: 365,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 30,
    badgeIcon: 'building',
    badgeLabel: 'Habilitación Municipal',
    displayOrder: 48,
  },
  {
    code: 'monotributo_certificate',
    name: 'Constancia de Monotributo',
    description: 'Constancia de inscripción en Monotributo vigente',
    category: 'financial',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: null,
    renewalPeriodDays: 30,
    reminderDaysBefore: [14, 7, 3, 1],
    gracePeriodDays: 7,
    badgeIcon: 'receipt',
    badgeLabel: 'Monotributo al Día',
    displayOrder: 49,
  },
  {
    code: 'vehicle_insurance',
    name: 'Seguro de Vehículos',
    description: 'Póliza de seguro de vehículos de trabajo',
    category: 'insurance',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: null,
    renewalPeriodDays: 365,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 14,
    badgeIcon: 'car',
    badgeLabel: 'Flota Asegurada',
    displayOrder: 50,
  },
  {
    code: 'tool_certification',
    name: 'Certificación de Herramientas',
    description: 'Certificación de calibración y seguridad de herramientas',
    category: 'professional',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: null,
    renewalPeriodDays: 365,
    reminderDaysBefore: [30, 14, 7, 1],
    gracePeriodDays: 14,
    badgeIcon: 'wrench',
    badgeLabel: 'Herramientas Certificadas',
    displayOrder: 51,
  },
  {
    code: 'refrigeration_license',
    name: 'Licencia de Refrigeración',
    description: 'Licencia para manipulación de gases refrigerantes',
    category: 'professional',
    appliesTo: 'organization',
    tier: 4,
    isRequired: false,
    requiresDocument: true,
    requiresExpiration: true,
    autoVerifySource: null,
    renewalPeriodDays: 730, // 2 years
    reminderDaysBefore: [60, 30, 14, 7, 1],
    gracePeriodDays: 30,
    badgeIcon: 'thermometer-snowflake',
    badgeLabel: 'Técnico en Refrigeración',
    displayOrder: 52,
  },
];

async function seed() {
  console.log('🌱 Seeding verification requirements...\n');

  let created = 0;
  let skipped = 0;

  for (const req of verificationRequirements) {
    try {
      await prisma.verificationRequirement.upsert({
        where: { code: req.code },
        update: {
          name: req.name,
          description: req.description,
          category: req.category,
          appliesTo: req.appliesTo,
          tier: req.tier,
          isRequired: req.isRequired,
          requiresDocument: req.requiresDocument,
          requiresExpiration: req.requiresExpiration,
          autoVerifySource: req.autoVerifySource,
          renewalPeriodDays: req.renewalPeriodDays,
          reminderDaysBefore: req.reminderDaysBefore,
          gracePeriodDays: req.gracePeriodDays,
          badgeIcon: req.badgeIcon,
          badgeLabel: req.badgeLabel,
          displayOrder: req.displayOrder,
        },
        create: {
          code: req.code,
          name: req.name,
          description: req.description,
          category: req.category,
          appliesTo: req.appliesTo,
          tier: req.tier,
          isRequired: req.isRequired,
          requiresDocument: req.requiresDocument,
          requiresExpiration: req.requiresExpiration,
          autoVerifySource: req.autoVerifySource,
          renewalPeriodDays: req.renewalPeriodDays,
          reminderDaysBefore: req.reminderDaysBefore,
          gracePeriodDays: req.gracePeriodDays,
          badgeIcon: req.badgeIcon,
          badgeLabel: req.badgeLabel,
          displayOrder: req.displayOrder,
          isActive: true,
        },
      });
      created++;
      console.log(`  ✅ ${req.code} (Tier ${req.tier})`);
    } catch (error) {
      console.error(`  ❌ Failed to seed ${req.code}:`, error);
      skipped++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Created/Updated: ${created}`);
  console.log(`   Skipped/Failed: ${skipped}`);
  console.log(`   Total: ${verificationRequirements.length}`);
}

seed()
  .then(() => {
    console.log('\n✨ Seed completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
