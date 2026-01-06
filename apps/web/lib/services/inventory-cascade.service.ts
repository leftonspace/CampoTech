/**
 * Inventory Cascade Service
 * ==========================
 *
 * Phase 2.2: Automatic Fallback Logic for Inventory Deductions
 *
 * This service handles automatic cascade deduction of inventory:
 * Priority: 1. Assigned vehicle 2. Warehouse
 *
 * When recording material usage for a job, this service:
 * 1. Tries to deduct from the job's assigned vehicle first
 * 2. Falls back to warehouse if vehicle has insufficient stock
 * 3. Returns a summary of where each item was deducted from
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DeductionItem {
    productId: string;
    quantity: number;
}

export interface DeductionResult {
    productId: string;
    productName?: string;
    quantity: number;
    source: 'vehicle' | 'warehouse' | 'customer';
    sourceId?: string;
    sourceName?: string;
}

export interface CascadeDeductionResult {
    success: boolean;
    deductions: DeductionResult[];
    summary: string;
    error?: string;
}

export interface ManualDeductionOptions {
    forceVehicle?: boolean;
    forceWarehouse?: boolean;
    vehicleId?: string;
    warehouseId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class InventoryCascadeService {
    /**
     * Deduct inventory with automatic cascade
     * Priority: 1. Assigned vehicle 2. Warehouse
     */
    async deductWithCascade(
        jobId: string,
        items: DeductionItem[],
        userId: string,
        organizationId: string
    ): Promise<CascadeDeductionResult> {
        try {
            // Get job with assigned technician info
            const job = await prisma.job.findUnique({
                where: { id: jobId },
                include: {
                    assignments: {
                        include: {
                            user: true,
                        },
                        take: 1, // Primary technician
                    },
                },
            });

            if (!job) {
                return {
                    success: false,
                    deductions: [],
                    summary: '',
                    error: 'Trabajo no encontrado',
                };
            }

            const results: DeductionResult[] = [];
            const primaryTechnician = job.assignments[0]?.user;

            for (const item of items) {
                // Get product info
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                    select: { id: true, name: true, costPrice: true },
                });

                if (!product) {
                    return {
                        success: false,
                        deductions: results,
                        summary: '',
                        error: `Producto no encontrado: ${item.productId}`,
                    };
                }

                let deducted = false;

                // Step 1: Try vehicle first (if technician has assigned vehicle stock)
                if (primaryTechnician) {
                    const vehicleStock = await prisma.vehicleStock.findFirst({
                        where: {
                            userId: primaryTechnician.id,
                            productId: item.productId,
                            quantity: { gte: item.quantity },
                        },
                        include: {
                            vehicle: true,
                        },
                    });

                    if (vehicleStock) {
                        await this.deductFromVehicle(
                            vehicleStock.vehicleId,
                            item.productId,
                            item.quantity,
                            userId,
                            jobId,
                            organizationId,
                            Number(product.costPrice)
                        );

                        results.push({
                            productId: item.productId,
                            productName: product.name,
                            quantity: item.quantity,
                            source: 'vehicle',
                            sourceId: vehicleStock.vehicleId,
                            sourceName: vehicleStock.vehicle
                                ? `${vehicleStock.vehicle.make} ${vehicleStock.vehicle.model} (${vehicleStock.vehicle.plateNumber})`
                                : 'Vehículo',
                        });

                        deducted = true;
                    }
                }

                // Step 2: Fallback to warehouse if vehicle empty or no vehicle
                if (!deducted) {
                    const warehouseLevel = await prisma.inventoryLevel.findFirst({
                        where: {
                            productId: item.productId,
                            warehouse: {
                                organizationId,
                                type: 'WAREHOUSE',
                                isActive: true,
                            },
                            quantityAvailable: { gte: item.quantity },
                        },
                        include: {
                            warehouse: true,
                        },
                    });

                    if (!warehouseLevel) {
                        // Check if ANY stock exists
                        const anyVehicleStock = primaryTechnician
                            ? await prisma.vehicleStock.findFirst({
                                where: {
                                    userId: primaryTechnician.id,
                                    productId: item.productId,
                                },
                            })
                            : null;

                        const anyWarehouseStock = await prisma.inventoryLevel.aggregate({
                            where: {
                                productId: item.productId,
                                warehouse: { organizationId },
                            },
                            _sum: { quantityAvailable: true },
                        });

                        const vehicleAvailable = anyVehicleStock?.quantity || 0;
                        const warehouseAvailable = anyWarehouseStock._sum.quantityAvailable || 0;

                        return {
                            success: false,
                            deductions: results,
                            summary: '',
                            error: `Stock insuficiente para "${product.name}". ` +
                                `Necesario: ${item.quantity}. ` +
                                `Vehículo: ${vehicleAvailable}. ` +
                                `Depósito: ${warehouseAvailable}.`,
                        };
                    }

                    await this.deductFromWarehouse(
                        warehouseLevel.warehouseId,
                        item.productId,
                        item.quantity,
                        userId,
                        jobId,
                        organizationId,
                        Number(product.costPrice)
                    );

                    results.push({
                        productId: item.productId,
                        productName: product.name,
                        quantity: item.quantity,
                        source: 'warehouse',
                        sourceId: warehouseLevel.warehouseId,
                        sourceName: warehouseLevel.warehouse.name,
                    });
                }
            }

            return {
                success: true,
                deductions: results,
                summary: this.generateSummary(results),
            };
        } catch (error) {
            console.error('[InventoryCascade] Error in deductWithCascade:', error);
            return {
                success: false,
                deductions: [],
                summary: '',
                error: error instanceof Error ? error.message : 'Error en deducción automática',
            };
        }
    }

    /**
     * Deduct from a specific source (manual override)
     */
    async deductManual(
        jobId: string,
        items: DeductionItem[],
        userId: string,
        organizationId: string,
        options: ManualDeductionOptions
    ): Promise<CascadeDeductionResult> {
        const results: DeductionResult[] = [];

        try {
            for (const item of items) {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                    select: { id: true, name: true, costPrice: true },
                });

                if (!product) {
                    return {
                        success: false,
                        deductions: results,
                        summary: '',
                        error: `Producto no encontrado: ${item.productId}`,
                    };
                }

                if (options.forceVehicle && options.vehicleId) {
                    // Check vehicle stock
                    const vehicleStock = await prisma.vehicleStock.findFirst({
                        where: {
                            vehicleId: options.vehicleId,
                            productId: item.productId,
                        },
                        include: { vehicle: true },
                    });

                    if (!vehicleStock || vehicleStock.quantity < item.quantity) {
                        return {
                            success: false,
                            deductions: results,
                            summary: '',
                            error: `Stock insuficiente en vehículo para "${product.name}". ` +
                                `Disponible: ${vehicleStock?.quantity || 0}. Necesario: ${item.quantity}.`,
                        };
                    }

                    await this.deductFromVehicle(
                        options.vehicleId,
                        item.productId,
                        item.quantity,
                        userId,
                        jobId,
                        organizationId,
                        Number(product.costPrice)
                    );

                    results.push({
                        productId: item.productId,
                        productName: product.name,
                        quantity: item.quantity,
                        source: 'vehicle',
                        sourceId: options.vehicleId,
                        sourceName: vehicleStock.vehicle
                            ? `${vehicleStock.vehicle.make} ${vehicleStock.vehicle.model}`
                            : 'Vehículo',
                    });
                } else if (options.forceWarehouse && options.warehouseId) {
                    // Check warehouse stock
                    const warehouseLevel = await prisma.inventoryLevel.findFirst({
                        where: {
                            warehouseId: options.warehouseId,
                            productId: item.productId,
                        },
                        include: { warehouse: true },
                    });

                    if (!warehouseLevel || warehouseLevel.quantityAvailable < item.quantity) {
                        return {
                            success: false,
                            deductions: results,
                            summary: '',
                            error: `Stock insuficiente en depósito para "${product.name}". ` +
                                `Disponible: ${warehouseLevel?.quantityAvailable || 0}. Necesario: ${item.quantity}.`,
                        };
                    }

                    await this.deductFromWarehouse(
                        options.warehouseId,
                        item.productId,
                        item.quantity,
                        userId,
                        jobId,
                        organizationId,
                        Number(product.costPrice)
                    );

                    results.push({
                        productId: item.productId,
                        productName: product.name,
                        quantity: item.quantity,
                        source: 'warehouse',
                        sourceId: options.warehouseId,
                        sourceName: warehouseLevel.warehouse.name,
                    });
                }
            }

            return {
                success: true,
                deductions: results,
                summary: this.generateSummary(results),
            };
        } catch (error) {
            console.error('[InventoryCascade] Error in deductManual:', error);
            return {
                success: false,
                deductions: results,
                summary: '',
                error: error instanceof Error ? error.message : 'Error en deducción manual',
            };
        }
    }

    /**
     * Deduct from vehicle stock
     */
    private async deductFromVehicle(
        vehicleId: string,
        productId: string,
        quantity: number,
        userId: string,
        jobId: string,
        organizationId: string,
        unitCost: number
    ): Promise<void> {
        // Update vehicle stock
        const vehicleStock = await prisma.vehicleStock.findFirst({
            where: { vehicleId, productId },
        });

        if (!vehicleStock) {
            throw new Error('Stock de vehículo no encontrado');
        }

        await prisma.vehicleStock.update({
            where: { id: vehicleStock.id },
            data: { quantity: { decrement: quantity } },
        });

        // Create inventory transaction for audit trail
        await prisma.inventoryTransaction.create({
            data: {
                organizationId,
                productId,
                transactionType: 'JOB_USAGE',
                quantity: -quantity,
                unitCost,
                totalCost: unitCost * quantity,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                reference: jobId as any,
                notes: `Deducción automática desde vehículo para trabajo`,
                performedById: userId,
            },
        });
    }

    /**
     * Deduct from warehouse stock
     */
    private async deductFromWarehouse(
        warehouseId: string,
        productId: string,
        quantity: number,
        userId: string,
        jobId: string,
        organizationId: string,
        unitCost: number
    ): Promise<void> {
        // Update inventory level
        const inventoryLevel = await prisma.inventoryLevel.findFirst({
            where: { warehouseId, productId },
        });

        if (!inventoryLevel) {
            throw new Error('Nivel de inventario no encontrado');
        }

        await prisma.inventoryLevel.update({
            where: { id: inventoryLevel.id },
            data: {
                quantityOnHand: { decrement: quantity },
                quantityAvailable: { decrement: quantity },
                lastMovementAt: new Date(),
            },
        });

        // Create stock movement record
        const movementNumber = `CAS-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        await prisma.stockMovement.create({
            data: {
                organizationId,
                productId,
                movementNumber,
                movementType: 'SALE',
                quantity,
                direction: 'OUT',
                fromWarehouseId: warehouseId,
                jobId,
                unitCost,
                totalCost: unitCost * quantity,
                notes: `Deducción automática (cascade) para trabajo`,
                performedById: userId,
            },
        });
    }

    /**
     * Generate human-readable summary
     */
    private generateSummary(results: DeductionResult[]): string {
        const vehicleItems = results.filter((r) => r.source === 'vehicle');
        const warehouseItems = results.filter((r) => r.source === 'warehouse');

        if (vehicleItems.length > 0 && warehouseItems.length > 0) {
            return `${vehicleItems.length} producto${vehicleItems.length > 1 ? 's' : ''} del vehículo, ` +
                `${warehouseItems.length} del depósito`;
        } else if (vehicleItems.length > 0) {
            return `Todos los productos del vehículo`;
        } else if (warehouseItems.length > 0) {
            return `Todos los productos del depósito`;
        }
        return '';
    }

    /**
     * Check stock availability before deduction (preview mode)
     */
    async checkAvailability(
        jobId: string,
        items: DeductionItem[],
        organizationId: string
    ): Promise<{
        available: boolean;
        details: Array<{
            productId: string;
            productName: string;
            required: number;
            vehicleAvailable: number;
            warehouseAvailable: number;
            canFulfill: boolean;
            suggestedSource: 'vehicle' | 'warehouse' | 'insufficient';
        }>;
    }> {
        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: {
                assignments: {
                    include: { user: true },
                    take: 1,
                },
            },
        });

        const primaryTechnician = job?.assignments[0]?.user;
        const details = [];
        let allAvailable = true;

        for (const item of items) {
            const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { id: true, name: true },
            });

            // Check vehicle stock
            let vehicleAvailable = 0;
            if (primaryTechnician) {
                const vehicleStock = await prisma.vehicleStock.findFirst({
                    where: {
                        userId: primaryTechnician.id,
                        productId: item.productId,
                    },
                });
                vehicleAvailable = vehicleStock?.quantity || 0;
            }

            // Check warehouse stock
            const warehouseStock = await prisma.inventoryLevel.aggregate({
                where: {
                    productId: item.productId,
                    warehouse: {
                        organizationId,
                        type: 'WAREHOUSE',
                        isActive: true,
                    },
                },
                _sum: { quantityAvailable: true },
            });
            const warehouseAvailable = warehouseStock._sum.quantityAvailable || 0;

            const canFulfill =
                vehicleAvailable >= item.quantity || warehouseAvailable >= item.quantity;

            let suggestedSource: 'vehicle' | 'warehouse' | 'insufficient' = 'insufficient';
            if (vehicleAvailable >= item.quantity) {
                suggestedSource = 'vehicle';
            } else if (warehouseAvailable >= item.quantity) {
                suggestedSource = 'warehouse';
            }

            if (!canFulfill) {
                allAvailable = false;
            }

            details.push({
                productId: item.productId,
                productName: product?.name || 'Producto desconocido',
                required: item.quantity,
                vehicleAvailable,
                warehouseAvailable,
                canFulfill,
                suggestedSource,
            });
        }

        return { available: allAvailable, details };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const inventoryCascadeService = new InventoryCascadeService();
