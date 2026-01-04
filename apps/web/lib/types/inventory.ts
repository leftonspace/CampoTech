export interface ProductWithStock {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    category?: { name: string } | null;
    unitOfMeasure: string;
    minStockLevel: number;
    costPrice: number | string;
    salePrice: number | string;
    imageUrl?: string | null;
    isActive: boolean;
    stock: {
        onHand: number;
        isLowStock: boolean;
    };
    inventoryLevels: Array<{
        warehouseId: string;
        warehouse?: { name: string } | null;
        quantityOnHand: number;
        quantityAvailable: number;
    }>;
}

export interface StockAlert {
    type: 'OUT_OF_STOCK' | 'LOW_STOCK';
    severity: 'critical' | 'warning' | 'info';
    item: {
        id: string;
        name: string;
        sku: string;
    };
    message: string;
    details: {
        currentStock: number;
        minStockLevel: number;
        locationBreakdown: Array<{
            locationId: string;
            locationName: string;
            quantity: number;
        }>;
    };
}
