import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class InventoryService {
    /**
     * List products with filters and pagination
     */
    static async listProducts(orgId: string, filters: any = {}, pagination: any = {}) {
        const { search, categoryId, isActive, productType, lowStock } = filters;
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

        const where: any = {
            organizationId: orgId,
        };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (categoryId) where.categoryId = categoryId;
        if (isActive !== undefined) where.isActive = isActive;
        if (productType) where.productType = productType as any;

        const [items, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: {
                    category: true,
                    inventoryLevels: {
                        include: {
                            warehouse: true,
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.product.count({ where }),
        ]);

        // Add stock summaries
        const enrichedItems = items.map((product: any) => {
            const totalOnHand = product.inventoryLevels.reduce((sum: number, level: any) => sum + level.quantityOnHand, 0);
            const totalReserved = product.inventoryLevels.reduce((sum: number, level: any) => sum + level.quantityReserved, 0);
            const totalAvailable = product.inventoryLevels.reduce((sum: number, level: any) => sum + level.quantityAvailable, 0);

            return {
                ...product,
                stock: {
                    onHand: totalOnHand,
                    reserved: totalReserved,
                    available: totalAvailable,
                    isLowStock: product.trackInventory && totalOnHand <= product.minStockLevel && totalOnHand > 0,
                    isOutOfStock: product.trackInventory && totalOnHand === 0,
                }
            };
        });

        let finalItems = enrichedItems;
        if (lowStock) {
            finalItems = enrichedItems.filter((p: any) => p.stock.isLowStock || p.stock.isOutOfStock);
        }

        return {
            items: finalItems,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get a single product by ID
     */
    static async getProductById(orgId: string, id: string) {
        return prisma.product.findFirst({
            where: { id, organizationId: orgId },
            include: {
                category: true,
                inventoryLevels: {
                    include: {
                        warehouse: true,
                        storageLocation: true,
                    },
                },
                stockMovements: {
                    take: 10,
                    orderBy: { performedAt: 'desc' },
                    include: {
                        performedBy: {
                            select: { id: true, name: true }
                        }
                    }
                },
            },
        });
    }

    /**
     * Create a new product
     */
    static async createProduct(orgId: string, data: any) {
        const {
            sku, name, description, barcode, categoryId, productType,
            unitOfMeasure, costPrice, salePrice, taxRate, trackInventory,
            minStockLevel, isActive, initialStock, warehouseId
        } = data;

        // Check SKU uniqueness
        const existing = await prisma.product.findFirst({
            where: { organizationId: orgId, sku }
        });
        if (existing) throw new Error('Ya existe un producto con este SKU');

        return prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    organizationId: orgId,
                    sku,
                    name,
                    description,
                    barcode,
                    categoryId,
                    productType: (productType || 'PART') as any,
                    unitOfMeasure: unitOfMeasure || 'UNIDAD',
                    costPrice: (costPrice || 0) as any,
                    salePrice: (salePrice || 0) as any,
                    taxRate: (taxRate || 21) as any,
                    trackInventory: trackInventory !== false,
                    minStockLevel: minStockLevel || 0,
                    isActive: isActive !== false,
                },
            });

            // Initial stock if provided
            if (initialStock > 0 && warehouseId) {
                await tx.inventoryLevel.create({
                    data: {
                        organizationId: orgId,
                        productId: product.id,
                        warehouseId,
                        quantityOnHand: initialStock,
                        quantityAvailable: initialStock,
                        unitCost: (costPrice || 0) as any,
                        totalCost: ((costPrice || 0) * initialStock) as any,
                    }
                });

                await tx.stockMovement.create({
                    data: {
                        organizationId: orgId,
                        productId: product.id,
                        movementNumber: `INIT-${Date.now()}`,
                        movementType: 'INITIAL_STOCK' as any,
                        quantity: initialStock,
                        direction: 'IN',
                        toWarehouseId: warehouseId,
                        unitCost: (costPrice || 0) as any,
                        totalCost: ((costPrice || 0) * initialStock) as any,
                        notes: 'Stock inicial al crear producto',
                    }
                });
            }

            return product;
        });
    }

    /**
     * Update an existing product
     */
    static async updateProduct(orgId: string, id: string, data: any) {
        const {
            sku, name, description, barcode, categoryId, productType,
            unitOfMeasure, costPrice, salePrice, taxRate, trackInventory,
            minStockLevel, isActive
        } = data;

        // Check SKU uniqueness if changing
        if (sku) {
            const existing = await prisma.product.findFirst({
                where: { organizationId: orgId, sku, id: { not: id } }
            });
            if (existing) throw new Error('Ya existe un producto con este SKU');
        }

        return prisma.product.update({
            where: { id, organizationId: orgId },
            data: {
                sku,
                name,
                description,
                barcode,
                categoryId,
                productType: productType as any,
                unitOfMeasure,
                costPrice: costPrice !== undefined ? (costPrice as any) : undefined,
                salePrice: salePrice !== undefined ? (salePrice as any) : undefined,
                taxRate: taxRate !== undefined ? (taxRate as any) : undefined,
                trackInventory,
                minStockLevel,
                isActive,
            },
        });
    }

    /**
     * Delete a product
     */
    static async deleteProduct(orgId: string, id: string, force: boolean = false) {
        // Check for stock if not forcing
        if (!force) {
            const levels = await prisma.inventoryLevel.findMany({
                where: { productId: id, organizationId: orgId }
            });
            const hasStock = levels.some((l: any) => l.quantityOnHand > 0);
            if (hasStock) throw new Error('No se puede eliminar un producto con stock');
        }

        return prisma.product.delete({
            where: { id, organizationId: orgId }
        });
    }

    /**
     * Adjust stock levels
     */
    static async adjustStock(orgId: string, data: any) {
        const { productId, warehouseId, quantity, reason, notes, performedById } = data;

        const product = await prisma.product.findFirst({
            where: { id: productId, organizationId: orgId }
        });
        if (!product) throw new Error('Producto no encontrado');

        return prisma.$transaction(async (tx) => {
            let level = await tx.inventoryLevel.findFirst({
                where: { productId, warehouseId }
            });

            const adjQty = parseInt(quantity, 10);
            const isIncrease = adjQty > 0;

            if (!level) {
                if (adjQty < 0) throw new Error('No hay stock para ajustar');
                level = await tx.inventoryLevel.create({
                    data: {
                        organizationId: orgId,
                        productId,
                        warehouseId,
                        quantityOnHand: adjQty,
                        quantityAvailable: adjQty,
                        unitCost: product.costPrice,
                        totalCost: (Number(product.costPrice) * adjQty) as any,
                    }
                });
            } else {
                const newQty = level.quantityOnHand + adjQty;
                if (newQty < 0) throw new Error(`Stock insuficiente. Disponible: ${level.quantityOnHand}`);

                level = await tx.inventoryLevel.update({
                    where: { id: level.id },
                    data: {
                        quantityOnHand: newQty,
                        quantityAvailable: newQty - level.quantityReserved,
                        totalCost: (Number(level.unitCost) * newQty) as any,
                        lastMovementAt: new Date(),
                    }
                });
            }

            // Create movement record
            await tx.stockMovement.create({
                data: {
                    organizationId: orgId,
                    productId,
                    movementNumber: `ADJ-${Date.now()}`,
                    movementType: (isIncrease ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT') as any,
                    quantity: Math.abs(adjQty),
                    direction: isIncrease ? 'IN' : 'OUT',
                    toWarehouseId: isIncrease ? warehouseId : undefined,
                    fromWarehouseId: !isIncrease ? warehouseId : undefined,
                    unitCost: product.costPrice,
                    totalCost: (Number(product.costPrice) * Math.abs(adjQty)) as any,
                    reference: reason || 'Ajuste manual',
                    notes,
                    performedById,
                }
            });

            return level;
        });
    }

    /**
     * Transfer stock between warehouses
     */
    static async transferStock(orgId: string, data: any) {
        const { productId, fromWarehouseId, toWarehouseId, quantity, notes, performedById } = data;

        const product = await prisma.product.findFirst({
            where: { id: productId, organizationId: orgId }
        });
        if (!product) throw new Error('Producto no encontrado');

        return prisma.$transaction(async (tx) => {
            const sourceLevel = await tx.inventoryLevel.findFirst({
                where: { productId, warehouseId: fromWarehouseId }
            });

            const qty = parseInt(quantity, 10);
            if (!sourceLevel || sourceLevel.quantityAvailable < qty) {
                throw new Error(`Stock insuficiente en origen. Disponible: ${sourceLevel?.quantityAvailable || 0}`);
            }

            // Update source
            await tx.inventoryLevel.update({
                where: { id: sourceLevel.id },
                data: {
                    quantityOnHand: { decrement: qty },
                    quantityAvailable: { decrement: qty },
                    totalCost: { decrement: Number(sourceLevel.unitCost) * qty },
                    lastMovementAt: new Date(),
                }
            });

            // Update/Create destination
            let destLevel = await tx.inventoryLevel.findFirst({
                where: { productId, warehouseId: toWarehouseId }
            });

            if (destLevel) {
                await tx.inventoryLevel.update({
                    where: { id: destLevel.id },
                    data: {
                        quantityOnHand: { increment: qty },
                        quantityAvailable: { increment: qty },
                        totalCost: { increment: Number(sourceLevel.unitCost) * qty },
                        lastMovementAt: new Date(),
                    }
                });
            } else {
                await tx.inventoryLevel.create({
                    data: {
                        organizationId: orgId,
                        productId,
                        warehouseId: toWarehouseId,
                        quantityOnHand: qty,
                        quantityAvailable: qty,
                        unitCost: sourceLevel.unitCost,
                        totalCost: (Number(sourceLevel.unitCost) * qty) as any,
                    }
                });
            }

            // Create movement
            await tx.stockMovement.create({
                data: {
                    organizationId: orgId,
                    productId,
                    movementNumber: `TRF-${Date.now()}`,
                    movementType: 'TRANSFER' as any,
                    quantity: qty,
                    direction: 'OUT', // Convention for transfer: OUT from source
                    fromWarehouseId,
                    toWarehouseId,
                    unitCost: sourceLevel.unitCost,
                    totalCost: (Number(sourceLevel.unitCost) * qty) as any,
                    notes,
                    performedById,
                }
            });

            return true;
        });
    }

    /**
     * Get or create a warehouse for a vehicle
     */
    static async getVehicleWarehouse(orgId: string, vehicleId: string) {
        let warehouse = await prisma.warehouse.findFirst({
            where: { vehicleId, organizationId: orgId }
        });

        if (!warehouse) {
            const vehicle = await prisma.vehicle.findUnique({
                where: { id: vehicleId },
                select: { plateNumber: true, make: true, model: true }
            });
            if (!vehicle) throw new Error('Vehículo no encontrado');

            warehouse = await prisma.warehouse.create({
                data: {
                    organizationId: orgId,
                    vehicleId,
                    type: 'VEHICLE' as any,
                    code: `VEH-${vehicle.plateNumber || Date.now()}`,
                    name: `Vehículo: ${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})`,
                }
            });
        }
        return warehouse;
    }

    /**
     * Get all stock levels for an organization
     */
    static async getStockLevels(orgId: string, filters: any = {}) {
        const { productId, warehouseId, lowStock } = filters;

        const where: any = {
            organizationId: orgId,
        };

        if (productId) where.productId = productId;
        if (warehouseId) where.warehouseId = warehouseId;

        const levels = await prisma.inventoryLevel.findMany({
            where,
            include: {
                product: {
                    select: { id: true, sku: true, name: true, minStockLevel: true, trackInventory: true }
                },
                warehouse: true,
            }
        });

        if (lowStock) {
            return levels.filter((l: any) => l.product.trackInventory && l.quantityOnHand <= l.product.minStockLevel);
        }

        return levels;
    }
}
