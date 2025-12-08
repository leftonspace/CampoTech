/**
 * Organization Types
 * ==================
 */

import { Organization, OrganizationSettings, IVACondition } from '../../shared/types/domain.types';

// ═══════════════════════════════════════════════════════════════════════════════
// DTOs
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateOrganizationDTO {
  name: string;
  cuit: string;
  ivaCondition: IVACondition;
  legalName?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}

export interface UpdateOrganizationDTO {
  name?: string;
  legalName?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  logo?: string;
}

export interface UpdateOrganizationSettingsDTO {
  timezone?: string;
  currency?: string;
  dateFormat?: string;
  defaultPuntoVenta?: number;
  autoInvoice?: boolean;
  sendInvoiceByWhatsapp?: boolean;
  requireSignature?: boolean;
  requirePhotos?: boolean;
}

export interface OnboardingDTO {
  name: string;
  cuit: string;
  ownerPhone: string;
  ownerName: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrganizationResponse {
  id: string;
  name: string;
  cuit: string;
  ivaCondition: IVACondition;
  legalName?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  logo?: string;
  settings: OrganizationSettings;
  afipConfigured: boolean;
  mercadopagoConfigured: boolean;
  whatsappConfigured: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface OnboardingResponse {
  organization: OrganizationResponse;
  owner: {
    id: string;
    phone: string;
    fullName: string;
    role: 'owner';
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AFIP CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface AFIPConfigDTO {
  certificate: string; // Base64 encoded .p12 or .pfx
  certificatePassword: string;
  puntoVenta: number;
  isHomologation: boolean;
}

export interface AFIPConfigStatus {
  configured: boolean;
  puntoVenta?: number;
  isHomologation?: boolean;
  certificateExpiry?: Date;
  lastAuthSuccess?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MERCADOPAGO CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface MercadoPagoOAuthResult {
  connected: boolean;
  merchantId?: string;
  publicKey?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function toOrganizationResponse(org: Organization): OrganizationResponse {
  return {
    id: org.id,
    name: org.name,
    cuit: org.cuit,
    ivaCondition: org.ivaCondition,
    legalName: org.legalName,
    address: org.address,
    city: org.city,
    province: org.province,
    postalCode: org.postalCode,
    phone: org.phone,
    email: org.email,
    logo: org.logo,
    settings: org.settings,
    afipConfigured: org.afipConfigured,
    mercadopagoConfigured: org.mercadopagoConfigured,
    whatsappConfigured: org.whatsappConfigured,
    isActive: org.isActive,
    createdAt: org.createdAt,
  };
}
