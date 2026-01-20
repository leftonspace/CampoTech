/**
 * Auto-Verification Service
 * =========================
 *
 * Handles automatic verification of submissions based on the requirement's
 * auto_verify_source setting.
 *
 * Supported sources:
 * - 'afip': CUIT/CUIL validation via AFIP
 * - 'sms': Phone verification via SMS code
 * - 'registry': Matrícula verification against scraped public registries
 * - null: Manual review required
 */

import { afipClient, validateCUITFormat } from '@/lib/afip/client';
import { prisma } from '@/lib/prisma';
import type { VerificationSubmissionStatus } from '@/lib/types';

// Local interface definitions matching Prisma models
interface VerificationSubmission {
  id: string;
  organizationId: string;
  userId: string | null;
  requirementId: string;
  status: VerificationSubmissionStatus;
  submittedValue: string | null;
  documentUrl: string | null;
  expiresAt: Date | null;
  verificationData: Record<string, unknown> | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface VerificationRequirement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  tier: number;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  icon: string | null;
  badgeLabel: string | null;
  appliesTo: string;
  autoVerifySource: string | null;
  validationRules: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
import {
  matchActivityToServices,
  calculateActivityMatchScore,
} from '@/lib/afip/activity-codes';
import type {
  AutoVerifyResult,
  CUITVerifyResult,
  PhoneVerifyResult,
} from './verification-types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** SMS verification code expiry in minutes */
const SMS_CODE_EXPIRY_MINUTES = 10;

// In-memory store for SMS codes (in production, use Redis)
const smsCodeStore = new Map<
  string,
  { code: string; expiresAt: Date; attempts: number }
>();

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-VERIFIER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class AutoVerifierClass {
  /**
   * Attempt automatic verification based on requirement's auto_verify_source
   */
  async verifySubmission(
    submission: VerificationSubmission & { requirement: VerificationRequirement }
  ): Promise<AutoVerifyResult> {
    const { requirement } = submission;
    const autoVerifySource = requirement.autoVerifySource;

    if (!autoVerifySource) {
      // No auto-verification, needs manual review
      return {
        success: true,
        shouldApprove: false,
        needsReview: true,
        reason: 'Requiere revisión manual',
      };
    }

    switch (autoVerifySource) {
      case 'afip':
        return this.verifyAFIP(submission);

      case 'sms':
        // SMS verification requires a separate code confirmation flow
        return {
          success: true,
          shouldApprove: false,
          needsReview: false,
          reason: 'Esperando confirmación de código SMS',
        };

      case 'email':
        // Email verification requires a separate confirmation flow
        return {
          success: true,
          shouldApprove: false,
          needsReview: false,
          reason: 'Esperando confirmación de email',
        };

      case 'registry':
        return this.verifyAgainstRegistry(submission);

      default:
        console.warn(`[AutoVerifier] Unknown auto_verify_source: ${autoVerifySource}`);
        return {
          success: true,
          shouldApprove: false,
          needsReview: true,
          reason: 'Fuente de verificación desconocida',
        };
    }
  }

  /**
   * Verify AFIP-related requirements (CUIT, CUIL, activity codes)
   */
  private async verifyAFIP(
    submission: VerificationSubmission & { requirement: VerificationRequirement }
  ): Promise<AutoVerifyResult> {
    const { requirement, submittedValue } = submission;
    const code = requirement.code;

    // Route to specific AFIP verification
    switch (code) {
      case 'owner_cuit':
        return this.verifyCUIT(submittedValue || '');

      case 'employee_cuil':
        return this.verifyCUIL(submittedValue || '');

      case 'afip_status':
        // AFIP status is checked along with CUIT
        return this.verifyAFIPStatus(submittedValue || '');

      case 'activity_code_match':
        // Activity code match is checked along with CUIT
        return this.verifyActivityCodes(submittedValue || '');

      case 'business_address':
        // Business address is retrieved from AFIP
        return this.verifyBusinessAddress(submittedValue || '');

      default:
        return {
          success: true,
          shouldApprove: false,
          needsReview: true,
          reason: 'Requisito AFIP no reconocido',
        };
    }
  }

  /**
   * Verify CUIT (business tax ID)
   */
  async verifyCUIT(cuit: string): Promise<CUITVerifyResult> {
    if (!cuit) {
      return {
        success: false,
        shouldApprove: false,
        needsReview: false,
        isValid: false,
        exists: false,
        isActive: false,
        error: 'CUIT no proporcionado',
      };
    }

    try {
      // Validate format first
      const formatResult = validateCUITFormat(cuit);
      if (!formatResult.isValid) {
        return {
          success: true,
          shouldApprove: false,
          needsReview: false,
          isValid: false,
          exists: false,
          isActive: false,
          reason: formatResult.error,
        };
      }

      // Query AFIP
      const afipResult = await afipClient.validateCUIT(cuit);

      if (!afipResult.isValid || !afipResult.exists) {
        return {
          success: true,
          shouldApprove: false,
          needsReview: afipResult.error?.includes('no disponible') || false,
          isValid: afipResult.isValid,
          exists: afipResult.exists,
          isActive: afipResult.isActive,
          razonSocial: afipResult.razonSocial,
          categoriaTributaria: afipResult.categoriaTributaria,
          reason: afipResult.error || 'CUIT no válido o no existe en AFIP',
          verificationData: {
            cuit: formatResult.formattedCuit,
            afipResponse: afipResult,
          },
        };
      }

      // Valid and exists - auto-approve
      return {
        success: true,
        shouldApprove: true,
        needsReview: false,
        isValid: true,
        exists: true,
        isActive: afipResult.isActive,
        razonSocial: afipResult.razonSocial,
        categoriaTributaria: afipResult.categoriaTributaria,
        reason: 'CUIT verificado correctamente',
        verificationData: {
          cuit: formatResult.formattedCuit,
          razonSocial: afipResult.razonSocial,
          categoriaTributaria: afipResult.categoriaTributaria,
          isActive: afipResult.isActive,
          domicilioFiscal: afipResult.domicilioFiscal,
          actividadesPrincipales: afipResult.actividadesPrincipales,
          validatedAt: new Date().toISOString(),
          source: afipResult.source,
        },
      };
    } catch (error) {
      console.error('[AutoVerifier] CUIT verification error:', error);
      return {
        success: false,
        shouldApprove: false,
        needsReview: true,
        isValid: false,
        exists: false,
        isActive: false,
        error: error instanceof Error ? error.message : 'Error de verificación AFIP',
      };
    }
  }

  /**
   * Verify CUIL (employee labor ID)
   */
  async verifyCUIL(cuil: string): Promise<CUITVerifyResult> {
    // CUIL uses the same validation as CUIT
    return this.verifyCUIT(cuil);
  }

  /**
   * Verify AFIP active status
   */
  private async verifyAFIPStatus(cuitOrValue: string): Promise<AutoVerifyResult> {
    // If the value is 'ACTIVO', it was already verified
    if (cuitOrValue === 'ACTIVO') {
      return {
        success: true,
        shouldApprove: true,
        needsReview: false,
        reason: 'Estado AFIP activo verificado',
        verificationData: {
          status: 'ACTIVO',
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    // If it's a CUIT, query AFIP
    const formatResult = validateCUITFormat(cuitOrValue);
    if (formatResult.isValid) {
      const afipResult = await afipClient.validateCUIT(cuitOrValue);

      if (afipResult.isActive) {
        return {
          success: true,
          shouldApprove: true,
          needsReview: false,
          reason: 'Estado AFIP activo verificado',
          verificationData: {
            status: 'ACTIVO',
            cuit: formatResult.formattedCuit,
            verifiedAt: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        shouldApprove: false,
        needsReview: false,
        reason: 'El CUIT no está activo en AFIP',
        verificationData: {
          status: 'INACTIVO',
          cuit: formatResult.formattedCuit,
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    return {
      success: true,
      shouldApprove: false,
      needsReview: true,
      reason: 'No se pudo verificar el estado AFIP',
    };
  }

  /**
   * Verify activity codes match HVAC services
   */
  private async verifyActivityCodes(codesOrCuit: string): Promise<AutoVerifyResult> {
    // If it's a comma-separated list of codes
    if (codesOrCuit.includes(',') || /^\d{6}$/.test(codesOrCuit.trim())) {
      const codes = codesOrCuit.split(',').map((c) => ({
        code: c.trim(),
        description: '',
      }));

      const matchResult = calculateActivityMatchScore(codes);

      if (matchResult.recommendation === 'approved') {
        return {
          success: true,
          shouldApprove: true,
          needsReview: false,
          reason: matchResult.reason,
          verificationData: {
            codes: codes.map((c) => c.code),
            matchScore: matchResult.score,
            matchedServices: matchActivityToServices(codes),
            verifiedAt: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        shouldApprove: false,
        needsReview: matchResult.recommendation === 'review',
        reason: matchResult.reason,
        verificationData: {
          codes: codes.map((c) => c.code),
          matchScore: matchResult.score,
          matchedServices: matchActivityToServices(codes),
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    // If it's a CUIT, fetch activities from AFIP
    const formatResult = validateCUITFormat(codesOrCuit);
    if (formatResult.isValid) {
      const afipResult = await afipClient.validateCUIT(codesOrCuit);

      if (afipResult.actividadesPrincipales.length > 0) {
        const matchResult = calculateActivityMatchScore(afipResult.actividadesPrincipales);

        if (matchResult.recommendation === 'approved') {
          return {
            success: true,
            shouldApprove: true,
            needsReview: false,
            reason: matchResult.reason,
            verificationData: {
              codes: afipResult.actividadesPrincipales.map((a) => a.code),
              matchScore: matchResult.score,
              matchedServices: matchActivityToServices(afipResult.actividadesPrincipales),
              verifiedAt: new Date().toISOString(),
            },
          };
        }

        return {
          success: true,
          shouldApprove: false,
          needsReview: matchResult.recommendation === 'review',
          reason: matchResult.reason,
          verificationData: {
            codes: afipResult.actividadesPrincipales.map((a) => a.code),
            matchScore: matchResult.score,
            matchedServices: matchActivityToServices(afipResult.actividadesPrincipales),
            verifiedAt: new Date().toISOString(),
          },
        };
      }
    }

    return {
      success: true,
      shouldApprove: false,
      needsReview: true,
      reason: 'No se pudieron verificar los códigos de actividad',
    };
  }

  /**
   * Verify business address from AFIP
   */
  private async verifyBusinessAddress(addressOrCuit: string): Promise<AutoVerifyResult> {
    // If it looks like an address, it was already set
    if (addressOrCuit.length > 20 && !validateCUITFormat(addressOrCuit).isValid) {
      return {
        success: true,
        shouldApprove: true,
        needsReview: false,
        reason: 'Domicilio fiscal verificado',
        verificationData: {
          address: addressOrCuit,
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    // If it's a CUIT, fetch address from AFIP
    const formatResult = validateCUITFormat(addressOrCuit);
    if (formatResult.isValid) {
      const afipResult = await afipClient.validateCUIT(addressOrCuit);

      if (afipResult.domicilioFiscal) {
        return {
          success: true,
          shouldApprove: true,
          needsReview: false,
          reason: 'Domicilio fiscal verificado',
          verificationData: {
            address: afipResult.domicilioFiscal,
            personaInfo: afipResult.personaInfo?.domicilioFiscal,
            verifiedAt: new Date().toISOString(),
          },
        };
      }
    }

    return {
      success: true,
      shouldApprove: false,
      needsReview: true,
      reason: 'No se pudo verificar el domicilio fiscal',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REGISTRY VERIFICATION (Matrículas)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Map requirement codes to specialties for registry lookup
   */
  private getSpecialtyFromRequirementCode(code: string): string {
    const map: Record<string, string> = {
      gas_matricula: 'GASISTA',
      electrician_matricula: 'ELECTRICISTA',
      plumber_matricula: 'PLOMERO',
      refrigeration_license: 'REFRIGERACION',
    };
    return map[code] || 'UNKNOWN';
  }

  /**
   * Get registry URL for display/verification
   */
  private getRegistryUrl(source: string): string {
    const urls: Record<string, string> = {
      GASNOR: 'https://www.gasnor.com/matriculados',
      GASNEA: 'https://www.gasnea.com/matriculados',
      ERSEP: 'https://ersep.cba.gov.ar/instaladores',
      CACAAV: 'https://www.cacaav.com.ar/registro',
    };
    return urls[source] || '#';
  }

  /**
   * Verify matrícula against scraped registry data
   * Auto-approves if found in registry, otherwise requires manual review
   */
  private async verifyAgainstRegistry(
    submission: VerificationSubmission & { requirement: VerificationRequirement }
  ): Promise<AutoVerifyResult> {
    const { requirement, submittedValue } = submission;

    if (!submittedValue) {
      return {
        success: true,
        shouldApprove: false,
        needsReview: true,
        reason: 'No se proporcionó número de matrícula',
      };
    }

    // Normalize matricula (remove spaces, uppercase)
    const normalizedMatricula = submittedValue.trim().toUpperCase();
    const specialty = this.getSpecialtyFromRequirementCode(requirement.code);

    console.log('[AutoVerifier] Registry lookup:', {
      matricula: normalizedMatricula,
      specialty,
      requirementCode: requirement.code,
    });

    try {
      // Search for exact match in verification registry
      const exactMatch = await prisma.verificationRegistry.findFirst({
        where: {
          matricula: {
            equals: normalizedMatricula,
            mode: 'insensitive',
          },
          status: 'active',
        },
      });

      if (exactMatch) {
        // Found in registry - auto-approve!
        console.log('[AutoVerifier] Registry match found:', {
          matricula: exactMatch.matricula,
          source: exactMatch.source,
          specialty: exactMatch.specialty,
          fullName: exactMatch.fullName,
        });

        return {
          success: true,
          shouldApprove: true,
          needsReview: false,
          reason: `Matrícula verificada en registro ${exactMatch.source}`,
          verificationData: {
            verificationMethod: 'registry',
            source: exactMatch.source,
            sourceUrl: this.getRegistryUrl(exactMatch.source),
            matricula: exactMatch.matricula,
            registryName: exactMatch.fullName,
            registryProvince: exactMatch.province,
            registrySpecialty: exactMatch.specialty,
            verifiedAt: new Date().toISOString(),
            lastScraped: exactMatch.scrapedAt?.toISOString(),
          },
        };
      }

      // Also check with specialty filter if exact match not found
      const specialtyMatch = await prisma.verificationRegistry.findFirst({
        where: {
          matricula: {
            equals: normalizedMatricula,
            mode: 'insensitive',
          },
          specialty: specialty,
          status: 'active',
        },
      });

      if (specialtyMatch) {
        console.log('[AutoVerifier] Specialty-specific registry match found:', {
          matricula: specialtyMatch.matricula,
          source: specialtyMatch.source,
        });

        return {
          success: true,
          shouldApprove: true,
          needsReview: false,
          reason: `Matrícula de ${specialty} verificada en ${specialtyMatch.source}`,
          verificationData: {
            verificationMethod: 'registry',
            source: specialtyMatch.source,
            sourceUrl: this.getRegistryUrl(specialtyMatch.source),
            matricula: specialtyMatch.matricula,
            registryName: specialtyMatch.fullName,
            registryProvince: specialtyMatch.province,
            registrySpecialty: specialtyMatch.specialty,
            verifiedAt: new Date().toISOString(),
            lastScraped: specialtyMatch.scrapedAt?.toISOString(),
          },
        };
      }

      // Not found in registry - send to manual review queue
      console.log('[AutoVerifier] Matrícula not found in registry:', {
        matricula: normalizedMatricula,
        specialty,
      });

      return {
        success: true,
        shouldApprove: false,
        needsReview: true,
        reason: 'Matrícula no encontrada en registros públicos - requiere revisión manual',
        verificationData: {
          verificationMethod: 'registry',
          searchedMatricula: normalizedMatricula,
          searchedSpecialty: specialty,
          searchedAt: new Date().toISOString(),
          result: 'not_found',
        },
      };
    } catch (error) {
      console.error('[AutoVerifier] Registry lookup error:', error);

      return {
        success: false,
        shouldApprove: false,
        needsReview: true,
        reason: 'Error al consultar registros - requiere revisión manual',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SMS VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate and send SMS verification code
   */
  async sendPhoneVerificationCode(
    phone: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, '');

    if (normalizedPhone.length < 10) {
      return { success: false, error: 'Número de teléfono inválido' };
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code with expiry
    const key = `${userId}:${normalizedPhone}`;
    smsCodeStore.set(key, {
      code,
      expiresAt: new Date(Date.now() + SMS_CODE_EXPIRY_MINUTES * 60 * 1000),
      attempts: 0,
    });

    // TODO: Send SMS via Twilio
    // For now, log the code (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AutoVerifier] SMS Code for ${normalizedPhone}: ${code}`);
    }

    // In production, use Twilio:
    // await twilioClient.messages.create({
    //   body: `Tu código de verificación CampoTech es: ${code}`,
    //   to: normalizedPhone,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    // });

    return { success: true };
  }

  /**
   * Verify phone with SMS code
   */
  async verifyPhone(
    phone: string,
    code: string,
    userId: string
  ): Promise<PhoneVerifyResult> {
    const normalizedPhone = phone.replace(/\D/g, '');
    const key = `${userId}:${normalizedPhone}`;
    const stored = smsCodeStore.get(key);

    if (!stored) {
      return {
        success: true,
        shouldApprove: false,
        needsReview: false,
        codeMatched: false,
        reason: 'No hay código pendiente para este número',
      };
    }

    // Check expiry
    if (new Date() > stored.expiresAt) {
      smsCodeStore.delete(key);
      return {
        success: true,
        shouldApprove: false,
        needsReview: false,
        codeMatched: false,
        reason: 'El código ha expirado',
      };
    }

    // Check attempts
    if (stored.attempts >= 3) {
      smsCodeStore.delete(key);
      return {
        success: true,
        shouldApprove: false,
        needsReview: false,
        codeMatched: false,
        reason: 'Demasiados intentos fallidos',
      };
    }

    // Verify code
    if (stored.code !== code) {
      stored.attempts++;
      return {
        success: true,
        shouldApprove: false,
        needsReview: false,
        codeMatched: false,
        reason: 'Código incorrecto',
      };
    }

    // Code matched - cleanup and approve
    smsCodeStore.delete(key);

    return {
      success: true,
      shouldApprove: true,
      needsReview: false,
      codeMatched: true,
      phoneNumber: normalizedPhone,
      reason: 'Teléfono verificado correctamente',
      verificationData: {
        phone: normalizedPhone,
        verifiedAt: new Date().toISOString(),
      },
    };
  }
}

// Export singleton instance
export const autoVerifier = new AutoVerifierClass();
