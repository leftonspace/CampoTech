/**
 * Location Invoice Router
 * =======================
 *
 * Routes invoices to the correct location's punto de venta based on:
 * - Job service location
 * - Customer primary location
 * - Organization default location (headquarters)
 */

import { PrismaClient } from '@prisma/client';
import { PuntoVentaManager, PuntoVentaConfig, InvoiceType } from './punto-venta-manager';
import { CoverageCalculator } from '../coverage-calculator';
import { Coordinates, CondicionIva } from '../location.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface InvoiceRoutingResult {
  locationId: string;
  locationCode: string;
  locationName: string;
  puntoDeVenta: number;
  invoiceType: InvoiceType;
  routingReason: RoutingReason;
  cuit: string;
  razonSocial: string;
  condicionIva: CondicionIva;
}

export type RoutingReason =
  | 'JOB_LOCATION'        // Invoice routed to job's service location
  | 'CUSTOMER_LOCATION'   // Invoice routed to customer's primary location
  | 'HEADQUARTERS'        // Invoice routed to organization headquarters
  | 'NEAREST_LOCATION'    // Invoice routed to nearest location with AFIP config
  | 'ONLY_LOCATION'       // Only one location available
  | 'EXPLICIT';           // Location explicitly specified

export interface InvoiceRoutingInput {
  jobId?: string;
  customerId?: string;
  customerCoordinates?: Coordinates;
  customerCondicionIva?: CondicionIva | 'CONSUMIDOR_FINAL';
  explicitLocationId?: string;
}

export interface LocationWithAfipConfig {
  id: string;
  code: string;
  name: string;
  isHeadquarters: boolean;
  coordinates: Coordinates | null;
  afipConfig: PuntoVentaConfig | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class InvoiceRoutingError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'InvoiceRoutingError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION INVOICE ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

export class LocationInvoiceRouter {
  private prisma: PrismaClient;
  private puntoVentaManager: PuntoVentaManager;
  private coverageCalculator: CoverageCalculator;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.puntoVentaManager = new PuntoVentaManager(prisma);
    this.coverageCalculator = new CoverageCalculator();
  }

  /**
   * Determine the best location to issue an invoice from
   */
  async routeInvoice(
    organizationId: string,
    input: InvoiceRoutingInput
  ): Promise<InvoiceRoutingResult> {
    // 1. If explicit location is specified, use it
    if (input.explicitLocationId) {
      return this.routeToExplicitLocation(organizationId, input);
    }

    // 2. If job is specified, route based on job's location
    if (input.jobId) {
      const jobRouting = await this.routeByJob(organizationId, input);
      if (jobRouting) {
        return jobRouting;
      }
    }

    // 3. If customer is specified, route based on customer's location
    if (input.customerId) {
      const customerRouting = await this.routeByCustomer(organizationId, input);
      if (customerRouting) {
        return customerRouting;
      }
    }

    // 4. If customer coordinates are provided, find nearest location
    if (input.customerCoordinates) {
      const nearestRouting = await this.routeByCoordinates(organizationId, input);
      if (nearestRouting) {
        return nearestRouting;
      }
    }

    // 5. Fall back to headquarters or any configured location
    return this.routeToDefault(organizationId, input);
  }

  /**
   * Route to explicitly specified location
   */
  private async routeToExplicitLocation(
    organizationId: string,
    input: InvoiceRoutingInput
  ): Promise<InvoiceRoutingResult> {
    const config = await this.puntoVentaManager.getPuntoVentaConfig(
      organizationId,
      input.explicitLocationId!
    );

    if (!config) {
      throw new InvoiceRoutingError(
        'LOCATION_NOT_CONFIGURED',
        'Specified location does not have AFIP configuration',
        404
      );
    }

    if (!config.isActive) {
      throw new InvoiceRoutingError(
        'LOCATION_INACTIVE',
        'Specified location AFIP configuration is inactive'
      );
    }

    const invoiceType = this.puntoVentaManager.determineInvoiceType(
      config.condicionIva,
      input.customerCondicionIva || 'CONSUMIDOR_FINAL'
    );

    return {
      locationId: config.locationId,
      locationCode: config.locationCode,
      locationName: config.locationName,
      puntoDeVenta: config.puntoDeVenta,
      invoiceType,
      routingReason: 'EXPLICIT',
      cuit: config.cuit,
      razonSocial: config.razonSocial,
      condicionIva: config.condicionIva,
    };
  }

  /**
   * Route based on job's service location
   */
  private async routeByJob(
    organizationId: string,
    input: InvoiceRoutingInput
  ): Promise<InvoiceRoutingResult | null> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        organizationId,
      },
      include: {
        location: {
          include: {
            afipConfig: true,
          },
        },
      },
    });

    if (!job?.location?.afipConfig) {
      return null;
    }

    const config = await this.puntoVentaManager.getPuntoVentaConfig(
      organizationId,
      job.location.id
    );

    if (!config || !config.isActive) {
      return null;
    }

    const invoiceType = this.puntoVentaManager.determineInvoiceType(
      config.condicionIva,
      input.customerCondicionIva || 'CONSUMIDOR_FINAL'
    );

    return {
      locationId: config.locationId,
      locationCode: config.locationCode,
      locationName: config.locationName,
      puntoDeVenta: config.puntoDeVenta,
      invoiceType,
      routingReason: 'JOB_LOCATION',
      cuit: config.cuit,
      razonSocial: config.razonSocial,
      condicionIva: config.condicionIva,
    };
  }

  /**
   * Route based on customer's primary location
   */
  private async routeByCustomer(
    organizationId: string,
    input: InvoiceRoutingInput
  ): Promise<InvoiceRoutingResult | null> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: input.customerId,
        organizationId,
      },
      include: {
        location: {
          include: {
            afipConfig: true,
          },
        },
      },
    });

    if (!customer?.location?.afipConfig) {
      return null;
    }

    const config = await this.puntoVentaManager.getPuntoVentaConfig(
      organizationId,
      customer.location.id
    );

    if (!config || !config.isActive) {
      return null;
    }

    const invoiceType = this.puntoVentaManager.determineInvoiceType(
      config.condicionIva,
      input.customerCondicionIva || 'CONSUMIDOR_FINAL'
    );

    return {
      locationId: config.locationId,
      locationCode: config.locationCode,
      locationName: config.locationName,
      puntoDeVenta: config.puntoDeVenta,
      invoiceType,
      routingReason: 'CUSTOMER_LOCATION',
      cuit: config.cuit,
      razonSocial: config.razonSocial,
      condicionIva: config.condicionIva,
    };
  }

  /**
   * Route to nearest location based on coordinates
   */
  private async routeByCoordinates(
    organizationId: string,
    input: InvoiceRoutingInput
  ): Promise<InvoiceRoutingResult | null> {
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
        afipConfig: {
          isActive: true,
        },
      },
      include: {
        afipConfig: true,
      },
    });

    if (locations.length === 0) {
      return null;
    }

    // Find nearest location
    let nearestLocation = locations[0];
    let nearestDistance = Infinity;

    for (const location of locations) {
      if (location.coordinates) {
        const coords = location.coordinates as Coordinates;
        const distance = this.coverageCalculator.calculateDistance(
          coords,
          input.customerCoordinates!
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestLocation = location;
        }
      }
    }

    const config = await this.puntoVentaManager.getPuntoVentaConfig(
      organizationId,
      nearestLocation.id
    );

    if (!config) {
      return null;
    }

    const invoiceType = this.puntoVentaManager.determineInvoiceType(
      config.condicionIva,
      input.customerCondicionIva || 'CONSUMIDOR_FINAL'
    );

    return {
      locationId: config.locationId,
      locationCode: config.locationCode,
      locationName: config.locationName,
      puntoDeVenta: config.puntoDeVenta,
      invoiceType,
      routingReason: 'NEAREST_LOCATION',
      cuit: config.cuit,
      razonSocial: config.razonSocial,
      condicionIva: config.condicionIva,
    };
  }

  /**
   * Route to default location (headquarters or any configured)
   */
  private async routeToDefault(
    organizationId: string,
    input: InvoiceRoutingInput
  ): Promise<InvoiceRoutingResult> {
    // Try headquarters first
    const headquarters = await this.prisma.location.findFirst({
      where: {
        organizationId,
        isHeadquarters: true,
        isActive: true,
        afipConfig: {
          isActive: true,
        },
      },
      include: {
        afipConfig: true,
      },
    });

    if (headquarters?.afipConfig) {
      const config = await this.puntoVentaManager.getPuntoVentaConfig(
        organizationId,
        headquarters.id
      );

      if (config) {
        const invoiceType = this.puntoVentaManager.determineInvoiceType(
          config.condicionIva,
          input.customerCondicionIva || 'CONSUMIDOR_FINAL'
        );

        return {
          locationId: config.locationId,
          locationCode: config.locationCode,
          locationName: config.locationName,
          puntoDeVenta: config.puntoDeVenta,
          invoiceType,
          routingReason: 'HEADQUARTERS',
          cuit: config.cuit,
          razonSocial: config.razonSocial,
          condicionIva: config.condicionIva,
        };
      }
    }

    // Fall back to any active location with AFIP config
    const anyLocation = await this.prisma.location.findFirst({
      where: {
        organizationId,
        isActive: true,
        afipConfig: {
          isActive: true,
        },
      },
      include: {
        afipConfig: true,
      },
      orderBy: {
        createdAt: 'asc', // Prefer oldest location
      },
    });

    if (!anyLocation?.afipConfig) {
      throw new InvoiceRoutingError(
        'NO_AFIP_CONFIG',
        'No location with active AFIP configuration found',
        404
      );
    }

    const config = await this.puntoVentaManager.getPuntoVentaConfig(
      organizationId,
      anyLocation.id
    );

    if (!config) {
      throw new InvoiceRoutingError(
        'NO_AFIP_CONFIG',
        'No location with active AFIP configuration found',
        404
      );
    }

    const invoiceType = this.puntoVentaManager.determineInvoiceType(
      config.condicionIva,
      input.customerCondicionIva || 'CONSUMIDOR_FINAL'
    );

    return {
      locationId: config.locationId,
      locationCode: config.locationCode,
      locationName: config.locationName,
      puntoDeVenta: config.puntoDeVenta,
      invoiceType,
      routingReason: 'ONLY_LOCATION',
      cuit: config.cuit,
      razonSocial: config.razonSocial,
      condicionIva: config.condicionIva,
    };
  }

  /**
   * Get all locations available for invoice routing
   */
  async getRoutingOptions(organizationId: string): Promise<LocationWithAfipConfig[]> {
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        afipConfig: true,
      },
      orderBy: [
        { isHeadquarters: 'desc' },
        { name: 'asc' },
      ],
    });

    const results: LocationWithAfipConfig[] = [];

    for (const location of locations) {
      let afipConfig: PuntoVentaConfig | null = null;

      if (location.afipConfig) {
        afipConfig = await this.puntoVentaManager.getPuntoVentaConfig(
          organizationId,
          location.id
        );
      }

      results.push({
        id: location.id,
        code: location.code,
        name: location.name,
        isHeadquarters: location.isHeadquarters,
        coordinates: location.coordinates as Coordinates | null,
        afipConfig,
      });
    }

    return results;
  }

  /**
   * Validate invoice can be routed
   */
  async validateRouting(
    organizationId: string,
    input: InvoiceRoutingInput
  ): Promise<{ valid: boolean; error?: string; suggestion?: string }> {
    try {
      await this.routeInvoice(organizationId, input);
      return { valid: true };
    } catch (error) {
      if (error instanceof InvoiceRoutingError) {
        let suggestion: string | undefined;

        if (error.code === 'NO_AFIP_CONFIG') {
          suggestion = 'Configure AFIP punto de venta for at least one location';
        } else if (error.code === 'LOCATION_INACTIVE') {
          suggestion = 'Activate AFIP configuration for the specified location';
        }

        return {
          valid: false,
          error: error.message,
          suggestion,
        };
      }
      throw error;
    }
  }

  /**
   * Update invoice with routing information after creation
   */
  async updateInvoiceLocation(
    invoiceId: string,
    locationId: string
  ): Promise<void> {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { locationId },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let invoiceRouter: LocationInvoiceRouter | null = null;

export function getLocationInvoiceRouter(prisma?: PrismaClient): LocationInvoiceRouter {
  if (!invoiceRouter && prisma) {
    invoiceRouter = new LocationInvoiceRouter(prisma);
  }
  if (!invoiceRouter) {
    throw new Error('LocationInvoiceRouter not initialized');
  }
  return invoiceRouter;
}
