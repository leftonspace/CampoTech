# Inventory Module - Complete Implementation Prompt

## Context

You are working on CampoTech, a Field Service Management (FSM) platform for Argentine trades businesses (plumbers, electricians, HVAC). The Inventory module UI exists but the backend returns a 501 "Not Implemented" error.

**Current State:** 
- UI forms exist at `/dashboard/inventory/products/new`
- API endpoint `/api/inventory/products` returns `501 Not Implemented`
- The form collects: name, description, SKU, barcode, category, unit, prices, stock levels

**Your Task:** Implement a fully functional inventory management system.

---

## Phase 1: Database Schema

### 1.1 Create/Verify Prisma Models

Add these models to `prisma/schema.prisma`:

```prisma
// ============================================
// INVENTORY MODULE
// ============================================

// Product Categories
model ProductCategory {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  name            String
  description     String?
  color           String?  // For UI display (hex color)
  icon            String?  // Icon identifier
  
  parentId        String?  // For subcategories
  parent          ProductCategory? @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children        ProductCategory[] @relation("CategoryHierarchy")
  
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  products        Product[]
  
  @@unique([organizationId, name])
  @@index([organizationId, isActive])
}

// Products / Items
model Product {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  // Basic Info
  name            String
  description     String?
  sku             String   // Stock Keeping Unit
  barcode         String?  // EAN/UPC barcode
  
  // Classification
  categoryId      String?
  category        ProductCategory? @relation(fields: [categoryId], references: [id])
  
  // Pricing (in ARS centavos for precision)
  costPrice       Int      @default(0)  // Purchase cost
  salePrice       Int      @default(0)  // Selling price
  
  // Tax
  ivaRate         Decimal  @default(21) // 0, 10.5, 21, 27
  
  // Units
  unitOfMeasure   UnitOfMeasure @default(UNIT)
  
  // Stock Configuration
  trackStock      Boolean  @default(true)
  minStockLevel   Int      @default(0)   // Alert when below this
  maxStockLevel   Int?                    // Optional max level
  reorderPoint    Int?                    // When to reorder
  reorderQuantity Int?                    // How much to reorder
  
  // Status
  isActive        Boolean  @default(true)
  isService       Boolean  @default(false) // True = service, no stock tracking
  
  // Media
  imageUrl        String?
  
  // Metadata
  notes           String?
  customFields    Json?    // For user-defined fields
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  stockLevels     StockLevel[]
  stockMovements  StockMovement[]
  jobLineItems    JobLineItem[]
  invoiceLineItems InvoiceLineItem[]
  purchaseOrderItems PurchaseOrderItem[]
  
  @@unique([organizationId, sku])
  @@index([organizationId, isActive])
  @@index([organizationId, categoryId])
  @@index([organizationId, name])
  @@index([barcode])
}

enum UnitOfMeasure {
  UNIT        // Unidad
  METER       // Metro
  SQUARE_METER // Metro cuadrado
  CUBIC_METER // Metro cúbico
  KILOGRAM    // Kilogramo
  GRAM        // Gramo
  LITER       // Litro
  MILLILITER  // Mililitro
  HOUR        // Hora (for services)
  BOX         // Caja
  PACK        // Paquete
  ROLL        // Rollo
  PAIR        // Par
}

// Stock Levels per Location (for multi-branch support)
model StockLevel {
  id              String   @id @default(cuid())
  organizationId  String
  
  productId       String
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  // Location (null = default/main location)
  locationId      String?
  location        Location? @relation(fields: [locationId], references: [id])
  
  // Quantities
  quantityOnHand  Int      @default(0)  // Currently in stock
  quantityReserved Int     @default(0)  // Reserved for jobs
  quantityOnOrder Int      @default(0)  // Ordered but not received
  
  // Computed: quantityAvailable = quantityOnHand - quantityReserved
  
  lastCountedAt   DateTime?
  lastCountedBy   String?
  
  updatedAt       DateTime @updatedAt
  
  @@unique([productId, locationId])
  @@index([organizationId])
  @@index([productId])
}

// Stock Movements (audit trail)
model StockMovement {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  productId       String
  product         Product  @relation(fields: [productId], references: [id])
  
  // Location
  locationId      String?
  location        Location? @relation(fields: [locationId], references: [id])
  
  // Movement details
  type            StockMovementType
  quantity        Int      // Positive for IN, negative for OUT
  quantityBefore  Int      // Stock level before movement
  quantityAfter   Int      // Stock level after movement
  
  // Cost tracking
  unitCost        Int?     // Cost per unit at time of movement
  totalCost       Int?     // Total cost of movement
  
  // Reference to source document
  referenceType   StockReferenceType?
  referenceId     String?  // Job ID, PO ID, Adjustment ID, etc.
  
  // Details
  reason          String?  // Reason for adjustment
  notes           String?
  
  // Who did it
  performedById   String
  performedBy     User     @relation(fields: [performedById], references: [id])
  
  createdAt       DateTime @default(now())
  
  @@index([organizationId, createdAt])
  @@index([productId, createdAt])
  @@index([referenceType, referenceId])
}

enum StockMovementType {
  // Inbound
  PURCHASE        // Received from supplier
  RETURN_FROM_JOB // Returned unused from job
  ADJUSTMENT_IN   // Manual increase
  TRANSFER_IN     // From another location
  INITIAL         // Initial stock setup
  
  // Outbound
  SALE            // Sold directly
  JOB_USAGE       // Used in a job
  ADJUSTMENT_OUT  // Manual decrease (damage, loss, etc.)
  TRANSFER_OUT    // To another location
  WRITE_OFF       // Written off
}

enum StockReferenceType {
  JOB
  INVOICE
  PURCHASE_ORDER
  STOCK_ADJUSTMENT
  STOCK_TRANSFER
  STOCK_COUNT
}

// Stock Adjustments (batch adjustments with approval workflow)
model StockAdjustment {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  // Reference
  adjustmentNumber String  // ADJ-0001
  
  // Location
  locationId      String?
  location        Location? @relation(fields: [locationId], references: [id])
  
  // Details
  type            AdjustmentType
  reason          String
  notes           String?
  
  // Status
  status          AdjustmentStatus @default(DRAFT)
  
  // Approval
  approvedById    String?
  approvedBy      User?    @relation("AdjustmentApprover", fields: [approvedById], references: [id])
  approvedAt      DateTime?
  
  // Creator
  createdById     String
  createdBy       User     @relation("AdjustmentCreator", fields: [createdById], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  items           StockAdjustmentItem[]
  
  @@index([organizationId, status])
}

model StockAdjustmentItem {
  id              String   @id @default(cuid())
  
  adjustmentId    String
  adjustment      StockAdjustment @relation(fields: [adjustmentId], references: [id], onDelete: Cascade)
  
  productId       String
  
  quantityBefore  Int
  quantityAdjustment Int   // Can be positive or negative
  quantityAfter   Int
  
  reason          String?
  
  @@index([adjustmentId])
}

enum AdjustmentType {
  STOCK_COUNT     // Physical inventory count
  DAMAGE          // Damaged goods
  LOSS            // Lost/stolen
  FOUND           // Found items
  CORRECTION      // Data correction
  OTHER           // Other reason
}

enum AdjustmentStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
  COMPLETED
}

// Locations (warehouses, branches, vehicles)
model Location {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  name            String
  type            LocationType
  
  // Address (for warehouses/branches)
  address         String?
  city            String?
  province        String?
  postalCode      String?
  lat             Float?
  lng             Float?
  
  // For vehicle locations
  vehicleId       String?  @unique
  vehicle         Vehicle? @relation(fields: [vehicleId], references: [id])
  
  // For technician mobile stock
  technicianId    String?  @unique
  technician      User?    @relation(fields: [technicianId], references: [id])
  
  isDefault       Boolean  @default(false)
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  stockLevels     StockLevel[]
  stockMovements  StockMovement[]
  adjustments     StockAdjustment[]
  
  @@unique([organizationId, name])
  @@index([organizationId, isActive])
}

enum LocationType {
  WAREHOUSE       // Main warehouse
  BRANCH          // Branch location
  VEHICLE         // Vehicle stock
  TECHNICIAN      // Technician's mobile stock
}

// Suppliers (for purchase orders)
model Supplier {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  name            String
  contactName     String?
  email           String?
  phone           String?
  
  // Tax info
  cuit            String?
  taxCondition    TaxCondition?
  
  // Address
  address         String?
  city            String?
  province        String?
  
  // Payment terms
  paymentTermDays Int      @default(30)
  
  notes           String?
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  purchaseOrders  PurchaseOrder[]
  
  @@index([organizationId, isActive])
}

// Purchase Orders
model PurchaseOrder {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  orderNumber     String   // PO-0001
  
  supplierId      String
  supplier        Supplier @relation(fields: [supplierId], references: [id])
  
  // Destination
  locationId      String?
  location        Location? @relation(fields: [locationId], references: [id])
  
  // Status
  status          PurchaseOrderStatus @default(DRAFT)
  
  // Dates
  orderDate       DateTime @default(now())
  expectedDate    DateTime?
  receivedDate    DateTime?
  
  // Totals (in centavos)
  subtotal        Int      @default(0)
  taxAmount       Int      @default(0)
  total           Int      @default(0)
  
  notes           String?
  
  // Creator
  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  items           PurchaseOrderItem[]
  
  @@unique([organizationId, orderNumber])
  @@index([organizationId, status])
}

model PurchaseOrderItem {
  id              String   @id @default(cuid())
  
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  
  productId       String
  product         Product  @relation(fields: [productId], references: [id])
  
  quantity        Int
  unitCost        Int      // in centavos
  totalCost       Int
  
  quantityReceived Int     @default(0)
  
  @@index([purchaseOrderId])
}

enum PurchaseOrderStatus {
  DRAFT
  SENT
  CONFIRMED
  PARTIALLY_RECEIVED
  RECEIVED
  CANCELLED
}

// Job Line Items (products used in jobs)
model JobLineItem {
  id              String   @id @default(cuid())
  
  jobId           String
  job             Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  
  // Can be product or custom line
  productId       String?
  product         Product? @relation(fields: [productId], references: [id])
  
  // Custom description (if no product linked)
  description     String
  
  quantity        Decimal
  unitPrice       Int      // in centavos
  totalPrice      Int
  
  // Tax
  ivaRate         Decimal  @default(21)
  ivaAmount       Int      @default(0)
  
  // Stock tracking
  stockDeducted   Boolean  @default(false)
  locationId      String?  // Where stock was taken from
  
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  
  @@index([jobId])
  @@index([productId])
}

// Invoice Line Items
model InvoiceLineItem {
  id              String   @id @default(cuid())
  
  invoiceId       String
  invoice         Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  
  productId       String?
  product         Product? @relation(fields: [productId], references: [id])
  
  description     String
  quantity        Decimal
  unitPrice       Int
  totalPrice      Int
  
  ivaRate         Decimal  @default(21)
  ivaAmount       Int      @default(0)
  
  sortOrder       Int      @default(0)
  
  @@index([invoiceId])
}
```

### 1.2 Run Migration

```bash
npx prisma migrate dev --name add_inventory_module
npx prisma generate
```

---

## Phase 2: API Endpoints

### 2.1 Products API

Replace the stub in `/api/inventory/products` with full implementation:

```typescript
// apps/web/app/api/inventory/products/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/require-auth';
import { z } from 'zod';

// Validation schema
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sku: z.string().min(1).max(50),
  barcode: z.string().max(50).optional(),
  categoryId: z.string().cuid().optional().nullable(),
  costPrice: z.number().min(0).default(0),
  salePrice: z.number().min(0).default(0),
  ivaRate: z.number().min(0).max(100).default(21),
  unitOfMeasure: z.enum([
    'UNIT', 'METER', 'SQUARE_METER', 'CUBIC_METER', 
    'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER',
    'HOUR', 'BOX', 'PACK', 'ROLL', 'PAIR'
  ]).default('UNIT'),
  trackStock: z.boolean().default(true),
  minStockLevel: z.number().int().min(0).default(0),
  maxStockLevel: z.number().int().min(0).optional().nullable(),
  reorderPoint: z.number().int().min(0).optional().nullable(),
  reorderQuantity: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
  isService: z.boolean().default(false),
  imageUrl: z.string().url().optional().nullable(),
  notes: z.string().max(1000).optional(),
  initialStock: z.number().int().min(0).default(0), // For initial stock level
});

// GET: List products
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const isActive = searchParams.get('isActive');
    const lowStock = searchParams.get('lowStock') === 'true';

    const where: any = {
      organizationId: session.organizationId,
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (categoryId) {
      where.categoryId = categoryId === 'null' ? null : categoryId;
    }

    // Active filter
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Get products with stock levels
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          stockLevels: {
            where: { locationId: null }, // Default location
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    // Transform to include current stock
    const productsWithStock = products.map(product => ({
      ...product,
      currentStock: product.stockLevels[0]?.quantityOnHand || 0,
      availableStock: (product.stockLevels[0]?.quantityOnHand || 0) - 
                      (product.stockLevels[0]?.quantityReserved || 0),
      isLowStock: product.trackStock && 
                  (product.stockLevels[0]?.quantityOnHand || 0) <= product.minStockLevel,
    }));

    // Filter low stock if requested
    const finalProducts = lowStock 
      ? productsWithStock.filter(p => p.isLowStock)
      : productsWithStock;

    return NextResponse.json({
      success: true,
      data: {
        products: finalProducts,
        pagination: {
          page,
          limit,
          total: lowStock ? finalProducts.length : total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST: Create product
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request, ['OWNER', 'ADMIN']);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const validatedData = createProductSchema.parse(body);

    // Check for duplicate SKU
    const existingSku = await prisma.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId: session.organizationId,
          sku: validatedData.sku,
        },
      },
    });

    if (existingSku) {
      return NextResponse.json(
        { success: false, error: 'SKU already exists' },
        { status: 400 }
      );
    }

    // Check barcode uniqueness if provided
    if (validatedData.barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: {
          organizationId: session.organizationId,
          barcode: validatedData.barcode,
        },
      });

      if (existingBarcode) {
        return NextResponse.json(
          { success: false, error: 'Barcode already exists' },
          { status: 400 }
        );
      }
    }

    // Convert prices to centavos
    const costPriceCentavos = Math.round(validatedData.costPrice * 100);
    const salePriceCentavos = Math.round(validatedData.salePrice * 100);

    // Create product with initial stock level
    const product = await prisma.$transaction(async (tx) => {
      // Create the product
      const newProduct = await tx.product.create({
        data: {
          organizationId: session.organizationId,
          name: validatedData.name,
          description: validatedData.description,
          sku: validatedData.sku,
          barcode: validatedData.barcode || null,
          categoryId: validatedData.categoryId || null,
          costPrice: costPriceCentavos,
          salePrice: salePriceCentavos,
          ivaRate: validatedData.ivaRate,
          unitOfMeasure: validatedData.unitOfMeasure,
          trackStock: validatedData.trackStock,
          minStockLevel: validatedData.minStockLevel,
          maxStockLevel: validatedData.maxStockLevel || null,
          reorderPoint: validatedData.reorderPoint || null,
          reorderQuantity: validatedData.reorderQuantity || null,
          isActive: validatedData.isActive,
          isService: validatedData.isService,
          imageUrl: validatedData.imageUrl || null,
          notes: validatedData.notes,
        },
        include: {
          category: true,
        },
      });

      // Create initial stock level if tracking stock
      if (validatedData.trackStock && !validatedData.isService) {
        await tx.stockLevel.create({
          data: {
            organizationId: session.organizationId,
            productId: newProduct.id,
            locationId: null, // Default location
            quantityOnHand: validatedData.initialStock,
          },
        });

        // Create stock movement for initial stock
        if (validatedData.initialStock > 0) {
          await tx.stockMovement.create({
            data: {
              organizationId: session.organizationId,
              productId: newProduct.id,
              locationId: null,
              type: 'INITIAL',
              quantity: validatedData.initialStock,
              quantityBefore: 0,
              quantityAfter: validatedData.initialStock,
              unitCost: costPriceCentavos,
              totalCost: costPriceCentavos * validatedData.initialStock,
              reason: 'Stock inicial',
              performedById: session.userId,
            },
          });
        }
      }

      return newProduct;
    });

    return NextResponse.json({
      success: true,
      data: product,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
```

### 2.2 Single Product API

```typescript
// apps/web/app/api/inventory/products/[productId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/require-auth';
import { z } from 'zod';

const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  sku: z.string().min(1).max(50).optional(),
  barcode: z.string().max(50).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  costPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  ivaRate: z.number().min(0).max(100).optional(),
  unitOfMeasure: z.enum([
    'UNIT', 'METER', 'SQUARE_METER', 'CUBIC_METER',
    'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER',
    'HOUR', 'BOX', 'PACK', 'ROLL', 'PAIR'
  ]).optional(),
  trackStock: z.boolean().optional(),
  minStockLevel: z.number().int().min(0).optional(),
  maxStockLevel: z.number().int().min(0).optional().nullable(),
  reorderPoint: z.number().int().min(0).optional().nullable(),
  reorderQuantity: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  isService: z.boolean().optional(),
  imageUrl: z.string().url().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

interface RouteParams {
  params: { productId: string };
}

// GET: Get single product
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const product = await prisma.product.findFirst({
      where: {
        id: params.productId,
        organizationId: session.organizationId,
      },
      include: {
        category: true,
        stockLevels: {
          include: {
            location: true,
          },
        },
        stockMovements: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            performedBy: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PATCH: Update product
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request, ['OWNER', 'ADMIN']);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const validatedData = updateProductSchema.parse(body);

    // Verify product exists and belongs to org
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: params.productId,
        organizationId: session.organizationId,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check SKU uniqueness if changing
    if (validatedData.sku && validatedData.sku !== existingProduct.sku) {
      const existingSku = await prisma.product.findFirst({
        where: {
          organizationId: session.organizationId,
          sku: validatedData.sku,
          id: { not: params.productId },
        },
      });

      if (existingSku) {
        return NextResponse.json(
          { success: false, error: 'SKU already exists' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = { ...validatedData };
    
    // Convert prices if provided
    if (validatedData.costPrice !== undefined) {
      updateData.costPrice = Math.round(validatedData.costPrice * 100);
    }
    if (validatedData.salePrice !== undefined) {
      updateData.salePrice = Math.round(validatedData.salePrice * 100);
    }

    const product = await prisma.product.update({
      where: { id: params.productId },
      data: updateData,
      include: {
        category: true,
        stockLevels: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE: Delete product (soft delete by setting inactive, or hard delete if no usage)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(request, ['OWNER', 'ADMIN']);
    if (session instanceof NextResponse) return session;

    // Check if product is used in any jobs or invoices
    const usage = await prisma.jobLineItem.findFirst({
      where: { productId: params.productId },
    });

    if (usage) {
      // Soft delete - just deactivate
      await prisma.product.update({
        where: { id: params.productId },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: 'Product deactivated (has usage history)',
      });
    }

    // Hard delete if no usage
    await prisma.product.delete({
      where: { id: params.productId },
    });

    return NextResponse.json({
      success: true,
      message: 'Product deleted',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
```

### 2.3 Categories API

```typescript
// apps/web/app/api/inventory/categories/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/require-auth';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  parentId: z.string().cuid().optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

// GET: List categories
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const categories = await prisma.productCategory.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
      },
      include: {
        _count: {
          select: { products: true },
        },
        children: {
          where: { isActive: true },
          include: {
            _count: {
              select: { products: true },
            },
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    // Build tree structure (only top-level, children included)
    const topLevel = categories.filter(c => !c.parentId);

    return NextResponse.json({
      success: true,
      data: topLevel,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// POST: Create category
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request, ['OWNER', 'ADMIN']);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const validatedData = createCategorySchema.parse(body);

    // Check for duplicate name
    const existing = await prisma.productCategory.findUnique({
      where: {
        organizationId_name: {
          organizationId: session.organizationId,
          name: validatedData.name,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Category name already exists' },
        { status: 400 }
      );
    }

    const category = await prisma.productCategory.create({
      data: {
        organizationId: session.organizationId,
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
        icon: validatedData.icon,
        parentId: validatedData.parentId,
        sortOrder: validatedData.sortOrder,
      },
    });

    return NextResponse.json({
      success: true,
      data: category,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating category:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
```

### 2.4 Stock Adjustments API

```typescript
// apps/web/app/api/inventory/stock/adjust/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/require-auth';
import { z } from 'zod';

const stockAdjustmentSchema = z.object({
  productId: z.string().cuid(),
  locationId: z.string().cuid().optional().nullable(),
  adjustment: z.number().int(), // Positive or negative
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'WRITE_OFF']),
  reason: z.string().min(1).max(500),
  notes: z.string().max(1000).optional(),
});

// POST: Adjust stock
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request, ['OWNER', 'ADMIN', 'DISPATCHER']);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const validatedData = stockAdjustmentSchema.parse(body);

    // Verify product exists and belongs to org
    const product = await prisma.product.findFirst({
      where: {
        id: validatedData.productId,
        organizationId: session.organizationId,
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    if (!product.trackStock || product.isService) {
      return NextResponse.json(
        { success: false, error: 'Product does not track stock' },
        { status: 400 }
      );
    }

    // Get or create stock level
    let stockLevel = await prisma.stockLevel.findUnique({
      where: {
        productId_locationId: {
          productId: validatedData.productId,
          locationId: validatedData.locationId || null,
        },
      },
    });

    const quantityBefore = stockLevel?.quantityOnHand || 0;
    const quantityAfter = quantityBefore + validatedData.adjustment;

    if (quantityAfter < 0) {
      return NextResponse.json(
        { success: false, error: 'Insufficient stock for this adjustment' },
        { status: 400 }
      );
    }

    // Perform adjustment in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update or create stock level
      const updatedStock = await tx.stockLevel.upsert({
        where: {
          productId_locationId: {
            productId: validatedData.productId,
            locationId: validatedData.locationId || null,
          },
        },
        update: {
          quantityOnHand: quantityAfter,
        },
        create: {
          organizationId: session.organizationId,
          productId: validatedData.productId,
          locationId: validatedData.locationId || null,
          quantityOnHand: quantityAfter,
        },
      });

      // Create movement record
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: session.organizationId,
          productId: validatedData.productId,
          locationId: validatedData.locationId || null,
          type: validatedData.type,
          quantity: validatedData.adjustment,
          quantityBefore,
          quantityAfter,
          unitCost: product.costPrice,
          totalCost: Math.abs(validatedData.adjustment) * product.costPrice,
          reason: validatedData.reason,
          notes: validatedData.notes,
          referenceType: 'STOCK_ADJUSTMENT',
          performedById: session.userId,
        },
        include: {
          performedBy: {
            select: { id: true, name: true },
          },
        },
      });

      return { stockLevel: updatedStock, movement };
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error adjusting stock:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to adjust stock' },
      { status: 500 }
    );
  }
}
```

### 2.5 SKU Generator API

```typescript
// apps/web/app/api/inventory/generate-sku/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/require-auth';

// GET: Generate next available SKU
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || 'SKU';

    // Find the highest SKU number with this prefix
    const lastProduct = await prisma.product.findFirst({
      where: {
        organizationId: session.organizationId,
        sku: { startsWith: prefix },
      },
      orderBy: { sku: 'desc' },
      select: { sku: true },
    });

    let nextNumber = 1;
    
    if (lastProduct?.sku) {
      // Extract number from SKU (e.g., "SKU-0042" -> 42)
      const match = lastProduct.sku.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Format with padding (SKU-0001)
    const newSku = `${prefix}-${nextNumber.toString().padStart(4, '0')}`;

    return NextResponse.json({
      success: true,
      data: { sku: newSku },
    });
  } catch (error) {
    console.error('Error generating SKU:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate SKU' },
      { status: 500 }
    );
  }
}
```

### 2.6 Stock Levels API

```typescript
// apps/web/app/api/inventory/stock/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/require-auth';

// GET: Get stock levels (with filters)
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');
    const lowStockOnly = searchParams.get('lowStock') === 'true';
    const productId = searchParams.get('productId');

    const where: any = {
      organizationId: session.organizationId,
    };

    if (locationId) {
      where.locationId = locationId === 'null' ? null : locationId;
    }

    if (productId) {
      where.productId = productId;
    }

    const stockLevels = await prisma.stockLevel.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            minStockLevel: true,
            maxStockLevel: true,
            unitOfMeasure: true,
            isActive: true,
            trackStock: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        product: { name: 'asc' },
      },
    });

    // Add computed fields
    let result = stockLevels.map(sl => ({
      ...sl,
      availableQuantity: sl.quantityOnHand - sl.quantityReserved,
      isLowStock: sl.product.trackStock && sl.quantityOnHand <= sl.product.minStockLevel,
      isOverstock: sl.product.maxStockLevel && sl.quantityOnHand > sl.product.maxStockLevel,
    }));

    // Filter low stock if requested
    if (lowStockOnly) {
      result = result.filter(sl => sl.isLowStock);
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching stock levels:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock levels' },
      { status: 500 }
    );
  }
}
```

---

## Phase 3: Additional Endpoints to Implement

Create these additional endpoints following the same patterns:

### Required Endpoints Checklist

```
/api/inventory/
├── products/
│   ├── route.ts                    ✅ GET (list), POST (create)
│   ├── [productId]/
│   │   ├── route.ts                ✅ GET, PATCH, DELETE
│   │   └── movements/
│   │       └── route.ts            📝 GET (stock movement history)
│   └── import/
│       └── route.ts                📝 POST (bulk import CSV)
│
├── categories/
│   ├── route.ts                    ✅ GET (list), POST (create)
│   └── [categoryId]/
│       └── route.ts                📝 GET, PATCH, DELETE
│
├── stock/
│   ├── route.ts                    ✅ GET (stock levels)
│   ├── adjust/
│   │   └── route.ts                ✅ POST (quick adjustment)
│   ├── transfer/
│   │   └── route.ts                📝 POST (transfer between locations)
│   └── count/
│       └── route.ts                📝 POST (physical inventory count)
│
├── locations/
│   ├── route.ts                    📝 GET, POST
│   └── [locationId]/
│       └── route.ts                📝 GET, PATCH, DELETE
│
├── suppliers/
│   ├── route.ts                    📝 GET, POST
│   └── [supplierId]/
│       └── route.ts                📝 GET, PATCH, DELETE
│
├── purchase-orders/
│   ├── route.ts                    📝 GET, POST
│   └── [orderId]/
│       ├── route.ts                📝 GET, PATCH, DELETE
│       └── receive/
│           └── route.ts            📝 POST (receive items)
│
├── generate-sku/
│   └── route.ts                    ✅ GET
│
└── reports/
    ├── valuation/
    │   └── route.ts                📝 GET (inventory valuation report)
    ├── movements/
    │   └── route.ts                📝 GET (movement report)
    └── low-stock/
        └── route.ts                📝 GET (low stock alerts)
```

---

## Phase 4: Integration with Jobs

### 4.1 Add Products to Job Line Items

When creating/updating a job, allow adding products:

```typescript
// Modify job creation to include line items with products
const createJobSchema = z.object({
  // ... existing fields ...
  lineItems: z.array(z.object({
    productId: z.string().cuid().optional(), // null for custom items
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
  })).optional(),
});
```

### 4.2 Deduct Stock on Job Completion

```typescript
// When job status changes to COMPLETED, deduct stock
async function deductStockForJob(jobId: string, performedById: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      lineItems: {
        where: {
          productId: { not: null },
          stockDeducted: false,
        },
        include: { product: true },
      },
    },
  });

  for (const item of job.lineItems) {
    if (!item.product?.trackStock) continue;

    await prisma.$transaction(async (tx) => {
      // Get current stock
      const stockLevel = await tx.stockLevel.findFirst({
        where: {
          productId: item.productId,
          locationId: item.locationId || null,
        },
      });

      const quantityBefore = stockLevel?.quantityOnHand || 0;
      const quantityAfter = quantityBefore - Number(item.quantity);

      // Update stock level
      await tx.stockLevel.update({
        where: { id: stockLevel.id },
        data: { quantityOnHand: quantityAfter },
      });

      // Create movement
      await tx.stockMovement.create({
        data: {
          organizationId: job.organizationId,
          productId: item.productId,
          locationId: item.locationId || null,
          type: 'JOB_USAGE',
          quantity: -Number(item.quantity),
          quantityBefore,
          quantityAfter,
          referenceType: 'JOB',
          referenceId: jobId,
          reason: `Usado en trabajo #${job.jobNumber}`,
          performedById,
        },
      });

      // Mark as deducted
      await tx.jobLineItem.update({
        where: { id: item.id },
        data: { stockDeducted: true },
      });
    });
  }
}
```

---

## Phase 5: UI Updates

### 5.1 Product Form Updates

Ensure the form at `/dashboard/inventory/products/new` submits to the correct endpoint:

```typescript
// Example form submission
async function handleSubmit(data: ProductFormData) {
  const response = await fetch('/api/inventory/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      costPrice: parseFloat(data.costPrice) || 0,
      salePrice: parseFloat(data.salePrice) || 0,
      minStockLevel: parseInt(data.minStockLevel) || 0,
      maxStockLevel: data.maxStockLevel ? parseInt(data.maxStockLevel) : null,
      initialStock: parseInt(data.initialStock) || 0,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create product');
  }

  return response.json();
}
```

### 5.2 Required UI Pages

Verify these pages exist and are functional:

```
/dashboard/inventory/
├── page.tsx                    # Product list with filters
├── products/
│   ├── new/
│   │   └── page.tsx            # Create product form
│   └── [productId]/
│       ├── page.tsx            # View/edit product
│       └── movements/
│           └── page.tsx        # Stock movement history
├── categories/
│   └── page.tsx                # Manage categories
├── stock/
│   ├── page.tsx                # Stock levels overview
│   ├── adjust/
│   │   └── page.tsx            # Stock adjustment form
│   └── count/
│       └── page.tsx            # Physical inventory count
├── locations/
│   └── page.tsx                # Manage locations
├── suppliers/
│   └── page.tsx                # Manage suppliers
└── purchase-orders/
    ├── page.tsx                # PO list
    └── new/
        └── page.tsx            # Create PO
```

---

## Phase 6: Testing

### 6.1 Test Cases

```typescript
describe('Inventory Module', () => {
  describe('Products', () => {
    it('should create a product with initial stock', async () => {});
    it('should reject duplicate SKU', async () => {});
    it('should update product details', async () => {});
    it('should soft-delete product with usage history', async () => {});
    it('should hard-delete product without usage', async () => {});
    it('should list products with stock levels', async () => {});
    it('should filter low stock products', async () => {});
    it('should search products by name/SKU/barcode', async () => {});
  });

  describe('Stock Management', () => {
    it('should adjust stock in', async () => {});
    it('should adjust stock out', async () => {});
    it('should reject negative stock', async () => {});
    it('should create movement record on adjustment', async () => {});
    it('should transfer stock between locations', async () => {});
  });

  describe('Categories', () => {
    it('should create category', async () => {});
    it('should reject duplicate category name', async () => {});
    it('should support nested categories', async () => {});
  });

  describe('Job Integration', () => {
    it('should add products to job line items', async () => {});
    it('should reserve stock when job scheduled', async () => {});
    it('should deduct stock when job completed', async () => {});
    it('should return stock when job cancelled', async () => {});
  });

  describe('Organization Isolation', () => {
    it('should not show products from other orgs', async () => {});
    it('should not allow adjusting stock for other orgs', async () => {});
  });
});
```

### 6.2 Manual Test Checklist

- [ ] Create product with all fields
- [ ] Create product with minimum fields (name, SKU, price)
- [ ] Edit product
- [ ] Delete product
- [ ] Generate SKU automatically
- [ ] Create category
- [ ] Assign product to category
- [ ] Adjust stock (increase)
- [ ] Adjust stock (decrease)
- [ ] View stock movement history
- [ ] Search products
- [ ] Filter by category
- [ ] Filter low stock items
- [ ] Add product to job
- [ ] Stock deducts on job completion

---

## Phase 7: Deliverables

After completing this implementation:

1. **Database Migration**: All new tables created
2. **API Endpoints**: All endpoints functional (no 501 errors)
3. **UI Integration**: Forms submit successfully
4. **Stock Tracking**: Movements recorded accurately
5. **Job Integration**: Products can be added to jobs
6. **Test Results**: All tests passing
7. **Screenshots**: Working product creation flow

---

## Notes

- All prices are stored in **centavos** (multiply by 100) for precision
- Default currency is **ARS** (Argentine Peso)
- SKU format: `PREFIX-0001` (configurable prefix, 4-digit number)
- Stock levels are per-location (null location = default/main warehouse)
- Multi-location support is available but optional (for EMPRESARIAL tier)
