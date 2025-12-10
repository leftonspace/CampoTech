/**
 * Punto de Venta Manager
 * ======================
 *
 * Manages AFIP punto de venta (point of sale) numbers per location.
 * Each location can have its own punto de venta for invoice generation.
 */

import { PrismaClient } from '@prisma/client';
import { LocationAfipConfig, CondicionIva } from '../location.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type InvoiceType = 'A' | 'B' | 'C';
export type NotaCreditoType = 'NCA' | 'NCB' | 'NCC';

export interface PuntoVentaConfig {
  locationId: string;
  locationName: string;
  locationCode: string;
  puntoDeVenta: number;
  tiposPuntoDeVenta: string;
  cuit: string;
  razonSocial: string;
  condicionIva: CondicionIva;
  isActive: boolean;
  lastNumbers: {
    facturaA: number;
    facturaB: number;
    facturaC: number;
    notaCreditoA: number;
    notaCreditoB: number;
    notaCreditoC: number;
  };
}

export interface NextInvoiceNumber {
  locationId: string;
  puntoDeVenta: number;
  invoiceType: InvoiceType;
  number: number;
  fullNumber: string; // Format: "0001-00000001"
}

export interface InvoiceNumberUpdate {
  locationId: string;
  invoiceType: InvoiceType | NotaCreditoType;
  newNumber: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class PuntoVentaError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'PuntoVentaError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUNTO VENTA MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class PuntoVentaManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get punto de venta configuration for a location
   */
  async getPuntoVentaConfig(
    organizationId: string,
    locationId: string
  ): Promise<PuntoVentaConfig | null> {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
        isActive: true,
      },
      include: {
        afipConfig: true,
      },
    });

    if (!location || !location.afipConfig) {
      return null;
    }

    const config = location.afipConfig;

    // Get organization's CUIT if location doesn't have its own
    let cuit = config.cuit;
    let razonSocial = config.razonSocial;

    if (!cuit) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      // Organization settings should have CUIT - for now we'll use a placeholder
      cuit = (org?.settings as any)?.cuit || '';
      razonSocial = razonSocial || org?.name || '';
    }

    return {
      locationId: location.id,
      locationName: location.name,
      locationCode: location.code,
      puntoDeVenta: config.puntoDeVenta,
      tiposPuntoDeVenta: config.tiposPuntoDeVenta,
      cuit: cuit || '',
      razonSocial: razonSocial || location.name,
      condicionIva: config.condicionIva as CondicionIva,
      isActive: config.isActive,
      lastNumbers: {
        facturaA: config.facturaALastNumber,
        facturaB: config.facturaBLastNumber,
        facturaC: config.facturaCLastNumber,
        notaCreditoA: config.notaCreditoALastNumber,
        notaCreditoB: config.notaCreditoBLastNumber,
        notaCreditoC: config.notaCreditoCLastNumber,
      },
    };
  }

  /**
   * Get all punto de venta configurations for an organization
   */
  async getAllPuntoVentaConfigs(organizationId: string): Promise<PuntoVentaConfig[]> {
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
        afipConfig: {
          isNot: null,
        },
      },
      include: {
        afipConfig: true,
      },
      orderBy: {
        isHeadquarters: 'desc',
      },
    });

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    return locations
      .filter(l => l.afipConfig)
      .map(location => {
        const config = location.afipConfig!;
        return {
          locationId: location.id,
          locationName: location.name,
          locationCode: location.code,
          puntoDeVenta: config.puntoDeVenta,
          tiposPuntoDeVenta: config.tiposPuntoDeVenta,
          cuit: config.cuit || (org?.settings as any)?.cuit || '',
          razonSocial: config.razonSocial || org?.name || '',
          condicionIva: config.condicionIva as CondicionIva,
          isActive: config.isActive,
          lastNumbers: {
            facturaA: config.facturaALastNumber,
            facturaB: config.facturaBLastNumber,
            facturaC: config.facturaCLastNumber,
            notaCreditoA: config.notaCreditoALastNumber,
            notaCreditoB: config.notaCreditoBLastNumber,
            notaCreditoC: config.notaCreditoCLastNumber,
          },
        };
      });
  }

  /**
   * Get the next invoice number for a location and invoice type
   */
  async getNextInvoiceNumber(
    organizationId: string,
    locationId: string,
    invoiceType: InvoiceType
  ): Promise<NextInvoiceNumber> {
    const config = await this.getPuntoVentaConfig(organizationId, locationId);

    if (!config) {
      throw new PuntoVentaError(
        'AFIP_NOT_CONFIGURED',
        'AFIP punto de venta not configured for this location',
        404
      );
    }

    if (!config.isActive) {
      throw new PuntoVentaError(
        'PUNTO_VENTA_INACTIVE',
        'Punto de venta is inactive for this location'
      );
    }

    // Get the last number for this invoice type
    let lastNumber: number;
    switch (invoiceType) {
      case 'A':
        lastNumber = config.lastNumbers.facturaA;
        break;
      case 'B':
        lastNumber = config.lastNumbers.facturaB;
        break;
      case 'C':
        lastNumber = config.lastNumbers.facturaC;
        break;
      default:
        throw new PuntoVentaError('INVALID_INVOICE_TYPE', `Invalid invoice type: ${invoiceType}`);
    }

    const nextNumber = lastNumber + 1;

    return {
      locationId,
      puntoDeVenta: config.puntoDeVenta,
      invoiceType,
      number: nextNumber,
      fullNumber: this.formatInvoiceNumber(config.puntoDeVenta, nextNumber),
    };
  }

  /**
   * Reserve (increment) the next invoice number
   * Should be called atomically when creating an invoice
   */
  async reserveNextInvoiceNumber(
    organizationId: string,
    locationId: string,
    invoiceType: InvoiceType | NotaCreditoType
  ): Promise<NextInvoiceNumber> {
    // Use transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      const location = await tx.location.findFirst({
        where: {
          id: locationId,
          organizationId,
        },
        include: {
          afipConfig: true,
        },
      });

      if (!location?.afipConfig) {
        throw new PuntoVentaError(
          'AFIP_NOT_CONFIGURED',
          'AFIP punto de venta not configured for this location',
          404
        );
      }

      const config = location.afipConfig;

      if (!config.isActive) {
        throw new PuntoVentaError(
          'PUNTO_VENTA_INACTIVE',
          'Punto de venta is inactive for this location'
        );
      }

      // Determine which field to increment
      let updateField: string;
      let currentNumber: number;

      switch (invoiceType) {
        case 'A':
          updateField = 'facturaALastNumber';
          currentNumber = config.facturaALastNumber;
          break;
        case 'B':
          updateField = 'facturaBLastNumber';
          currentNumber = config.facturaBLastNumber;
          break;
        case 'C':
          updateField = 'facturaCLastNumber';
          currentNumber = config.facturaCLastNumber;
          break;
        case 'NCA':
          updateField = 'notaCreditoALastNumber';
          currentNumber = config.notaCreditoALastNumber;
          break;
        case 'NCB':
          updateField = 'notaCreditoBLastNumber';
          currentNumber = config.notaCreditoBLastNumber;
          break;
        case 'NCC':
          updateField = 'notaCreditoCLastNumber';
          currentNumber = config.notaCreditoCLastNumber;
          break;
        default:
          throw new PuntoVentaError('INVALID_INVOICE_TYPE', `Invalid invoice type: ${invoiceType}`);
      }

      const nextNumber = currentNumber + 1;

      // Increment the counter
      await tx.locationAfipConfig.update({
        where: { id: config.id },
        data: {
          [updateField]: nextNumber,
        },
      });

      // Map nota credito types to base invoice type for formatting
      const baseType = invoiceType.startsWith('NC')
        ? invoiceType.charAt(2) as InvoiceType
        : invoiceType as InvoiceType;

      return {
        locationId,
        puntoDeVenta: config.puntoDeVenta,
        invoiceType: baseType,
        number: nextNumber,
        fullNumber: this.formatInvoiceNumber(config.puntoDeVenta, nextNumber),
      };
    });
  }

  /**
   * Sync local sequence with AFIP's last authorized number
   * Should be called periodically or when discrepancies are detected
   */
  async syncWithAFIP(
    organizationId: string,
    locationId: string,
    invoiceType: InvoiceType,
    afipLastNumber: number
  ): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
      include: {
        afipConfig: true,
      },
    });

    if (!location?.afipConfig) {
      throw new PuntoVentaError(
        'AFIP_NOT_CONFIGURED',
        'AFIP punto de venta not configured for this location',
        404
      );
    }

    // Determine which field to update
    let updateField: string;
    switch (invoiceType) {
      case 'A':
        updateField = 'facturaALastNumber';
        break;
      case 'B':
        updateField = 'facturaBLastNumber';
        break;
      case 'C':
        updateField = 'facturaCLastNumber';
        break;
      default:
        throw new PuntoVentaError('INVALID_INVOICE_TYPE', `Invalid invoice type: ${invoiceType}`);
    }

    await this.prisma.locationAfipConfig.update({
      where: { id: location.afipConfig.id },
      data: {
        [updateField]: afipLastNumber,
        lastSyncAt: new Date(),
      },
    });
  }

  /**
   * Validate punto de venta is unique within organization
   */
  async validateUniquePuntoVenta(
    organizationId: string,
    puntoDeVenta: number,
    excludeLocationId?: string
  ): Promise<boolean> {
    const existing = await this.prisma.locationAfipConfig.findFirst({
      where: {
        puntoDeVenta,
        location: {
          organizationId,
          ...(excludeLocationId && { NOT: { id: excludeLocationId } }),
        },
      },
    });

    return !existing;
  }

  /**
   * Get available punto de venta numbers for organization
   * Returns suggested next available number
   */
  async getSuggestedPuntoVenta(organizationId: string): Promise<number> {
    const configs = await this.prisma.locationAfipConfig.findMany({
      where: {
        location: {
          organizationId,
        },
      },
      select: {
        puntoDeVenta: true,
      },
      orderBy: {
        puntoDeVenta: 'desc',
      },
    });

    if (configs.length === 0) {
      return 1;
    }

    // Find the highest punto de venta and suggest next
    const maxPdv = Math.max(...configs.map(c => c.puntoDeVenta));
    return maxPdv + 1;
  }

  /**
   * Determine invoice type based on customer's tax condition
   * Argentina-specific logic
   */
  determineInvoiceType(
    vendorCondicionIva: CondicionIva,
    customerCondicionIva: CondicionIva | 'CONSUMIDOR_FINAL'
  ): InvoiceType {
    // Responsable Inscripto vendor
    if (vendorCondicionIva === 'RESPONSABLE_INSCRIPTO') {
      if (customerCondicionIva === 'RESPONSABLE_INSCRIPTO') {
        return 'A'; // RI to RI = Factura A
      }
      return 'B'; // RI to anyone else = Factura B
    }

    // Monotributista vendor
    if (vendorCondicionIva === 'MONOTRIBUTISTA') {
      return 'C'; // Monotributista always issues Factura C
    }

    // Exento vendor
    if (vendorCondicionIva === 'EXENTO') {
      return 'C'; // Exento issues Factura C
    }

    // Default to C for safety
    return 'C';
  }

  /**
   * Format invoice number as "PPPP-NNNNNNNN"
   */
  formatInvoiceNumber(puntoVenta: number, number: number): string {
    const pdvStr = puntoVenta.toString().padStart(4, '0');
    const numStr = number.toString().padStart(8, '0');
    return `${pdvStr}-${numStr}`;
  }

  /**
   * Parse formatted invoice number
   */
  parseInvoiceNumber(formatted: string): { puntoVenta: number; number: number } | null {
    const match = formatted.match(/^(\d{4})-(\d{8})$/);
    if (!match) {
      return null;
    }
    return {
      puntoVenta: parseInt(match[1], 10),
      number: parseInt(match[2], 10),
    };
  }

  /**
   * Get invoice number statistics for a location
   */
  async getInvoiceStats(
    organizationId: string,
    locationId: string
  ): Promise<{
    locationId: string;
    puntoDeVenta: number;
    totals: {
      facturaA: number;
      facturaB: number;
      facturaC: number;
      notaCreditoA: number;
      notaCreditoB: number;
      notaCreditoC: number;
    };
    lastSync: Date | null;
  } | null> {
    const config = await this.getPuntoVentaConfig(organizationId, locationId);

    if (!config) {
      return null;
    }

    const afipConfig = await this.prisma.locationAfipConfig.findFirst({
      where: {
        locationId,
      },
      select: {
        lastSyncAt: true,
      },
    });

    return {
      locationId,
      puntoDeVenta: config.puntoDeVenta,
      totals: {
        facturaA: config.lastNumbers.facturaA,
        facturaB: config.lastNumbers.facturaB,
        facturaC: config.lastNumbers.facturaC,
        notaCreditoA: config.lastNumbers.notaCreditoA,
        notaCreditoB: config.lastNumbers.notaCreditoB,
        notaCreditoC: config.lastNumbers.notaCreditoC,
      },
      lastSync: afipConfig?.lastSyncAt || null,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let puntoVentaManager: PuntoVentaManager | null = null;

export function getPuntoVentaManager(prisma?: PrismaClient): PuntoVentaManager {
  if (!puntoVentaManager && prisma) {
    puntoVentaManager = new PuntoVentaManager(prisma);
  }
  if (!puntoVentaManager) {
    throw new Error('PuntoVentaManager not initialized');
  }
  return puntoVentaManager;
}
