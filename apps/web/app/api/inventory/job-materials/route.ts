/**
 * Job Materials API Route
 * Full implementation connected to job-material.service.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/inventory/job-materials
 * Get job materials, estimates, or reports
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'materials';
    const jobId = searchParams.get('jobId');

    // Get job materials
    if (view === 'materials' && jobId) {
      const materials = await prisma.jobMaterial.findMany({
        where: {
          jobId,
          job: { organizationId: session.organizationId },
        },
        include: {
          product: {
            select: { id: true, name: true, sku: true, unitOfMeasure: true, imageUrl: true },
          },
        },
        orderBy: { addedAt: 'asc' },
      });

      return NextResponse.json({ success: true, data: { materials } });
    }

    // Get job material summary
    if (view === 'summary' && jobId) {
      const materials = await prisma.jobMaterial.findMany({
        where: { jobId, job: { organizationId: session.organizationId } },
      });

      const reservations = await prisma.stockReservation.findMany({
        where: { jobId, status: 'PENDING' },
      });

      let totalEstimated = 0;
      let totalUsed = 0;
      let totalReturned = 0;
      let subtotal = 0;
      let totalDiscount = 0;
      let totalCost = 0;

      for (const m of materials) {
        totalEstimated += m.estimatedQty;
        totalUsed += m.usedQty;
        totalReturned += m.returnedQty;

        const itemSubtotal = m.usedQty * Number(m.unitPrice);
        const itemDiscount = itemSubtotal * (Number(m.discount) / 100);
        subtotal += itemSubtotal;
        totalDiscount += itemDiscount;
        totalCost += m.usedQty * Number(m.unitCost);
      }

      const total = subtotal - totalDiscount;
      const profit = total - totalCost;
      const profitMargin = total > 0 ? (profit / total) * 100 : 0;

      const hasPendingMaterials = materials.some(
        (m) => m.estimatedQty > m.usedQty + m.returnedQty
      );

      return NextResponse.json({
        success: true,
        data: {
          jobId,
          totalItems: materials.length,
          totalEstimated,
          totalUsed,
          totalReturned,
          subtotal,
          discount: totalDiscount,
          total,
          profit,
          profitMargin,
          hasReservations: reservations.length > 0,
          hasPendingMaterials,
        },
      });
    }

    // Generate job estimate
    if (view === 'estimate') {
      const serviceType = searchParams.get('serviceType');
      const warehouseId = searchParams.get('warehouseId');

      const commonProducts = await prisma.product.findMany({
        where: {
          organizationId: session.organizationId,
          isActive: true,
          trackInventory: true,
        },
        take: 10,
      });

      const estimates = [];
      for (const product of commonProducts) {
        let availableQty = 0;

        if (warehouseId) {
          const level = await prisma.inventoryLevel.findFirst({
            where: { productId: product.id, warehouseId },
          });
          availableQty = level?.quantityAvailable ?? 0;
        } else {
          const levels = await prisma.inventoryLevel.findMany({
            where: { productId: product.id },
          });
          availableQty = levels.reduce((sum: number, l: typeof levels[number]) => sum + l.quantityAvailable, 0);
        }

        estimates.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          estimatedQty: 1,
          unitPrice: Number(product.salePrice),
          totalPrice: Number(product.salePrice),
          inStock: availableQty > 0,
          availableQty,
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          serviceType,
          estimatedMaterials: estimates,
          totalEstimate: estimates.reduce((sum: number, e: typeof estimates[number]) => sum + e.totalPrice, 0),
        },
      });
    }

    // Job profitability
    if (view === 'profitability' && jobId) {
      const job = await prisma.job.findFirst({
        where: { id: jobId, organizationId: session.organizationId },
        include: {
          customer: { select: { name: true } },
          technician: { select: { name: true } },
          materials: true,
          invoice: true,
        },
      });

      if (!job) {
        return NextResponse.json(
          { success: false, error: 'Trabajo no encontrado' },
          { status: 404 }
        );
      }

      let materialRevenue = 0;
      let materialCost = 0;

      for (const mat of job.materials) {
        materialRevenue += Number(mat.lineTotal);
        materialCost += mat.usedQty * Number(mat.unitCost);
      }

      const laborRevenue = job.invoice ? Number(job.invoice.subtotal) - materialRevenue : 0;
      const totalRevenue = laborRevenue + materialRevenue;
      const totalCost = materialCost;
      const profit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      return NextResponse.json({
        success: true,
        data: {
          jobId: job.id,
          jobNumber: job.jobNumber,
          serviceType: job.serviceType,
          customerName: (job.customer as any)?.name || 'Unknown',
          technicianName: (job.technician as any)?.name || 'Sin asignar',
          completedAt: job.completedAt || new Date(),
          laborRevenue,
          materialRevenue,
          materialCost,
          totalRevenue,
          totalCost,
          profit,
          profitMargin,
        },
      });
    }

    // Material usage report
    if (view === 'usage-report') {
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const dateFrom = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = endDate ? new Date(endDate) : new Date();

      const jobs = await prisma.job.findMany({
        where: {
          organizationId: session.organizationId,
          completedAt: { gte: dateFrom, lte: dateTo },
        },
        include: {
          materials: {
            where: { usedQty: { gt: 0 } },
            include: { product: { select: { id: true, name: true } } },
          },
          technician: { select: { id: true, name: true } },
        },
      });

      let totalMaterialsCost = 0;
      let totalMaterialsRevenue = 0;
      const byProduct: Record<string, { name: string; qty: number; cost: number; revenue: number; jobs: Set<string> }> = {};
      const byTechnician: Record<string, { name: string; materials: number; cost: number; revenue: number; jobs: Set<string> }> = {};

      for (const job of jobs) {
        const techId = job.technicianId;
        const techName = (job.technician as any)?.name || 'Sin asignar';

        for (const mat of job.materials) {
          const cost = mat.usedQty * Number(mat.unitCost);
          const revenue = Number(mat.lineTotal);

          totalMaterialsCost += cost;
          totalMaterialsRevenue += revenue;

          // By product
          if (!byProduct[mat.productId]) {
            byProduct[mat.productId] = {
              name: (mat.product as any)?.name || 'Unknown',
              qty: 0,
              cost: 0,
              revenue: 0,
              jobs: new Set(),
            };
          }
          byProduct[mat.productId].qty += mat.usedQty;
          byProduct[mat.productId].cost += cost;
          byProduct[mat.productId].revenue += revenue;
          byProduct[mat.productId].jobs.add(job.id);

          // By technician
          if (techId) {
            if (!byTechnician[techId]) {
              byTechnician[techId] = {
                name: techName,
                materials: 0,
                cost: 0,
                revenue: 0,
                jobs: new Set(),
              };
            }
            byTechnician[techId].materials += mat.usedQty;
            byTechnician[techId].cost += cost;
            byTechnician[techId].revenue += revenue;
            byTechnician[techId].jobs.add(job.id);
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          period: { from: dateFrom, to: dateTo },
          totalJobs: jobs.length,
          totalMaterialsCost,
          totalMaterialsRevenue,
          totalProfit: totalMaterialsRevenue - totalMaterialsCost,
          averageMaterialsPerJob: jobs.length > 0 ? totalMaterialsRevenue / jobs.length : 0,
          byProduct: Object.entries(byProduct)
            .map(([productId, data]: [string, typeof byProduct[string]]) => ({
              productId,
              productName: data.name,
              quantityUsed: data.qty,
              totalCost: data.cost,
              totalRevenue: data.revenue,
              jobCount: data.jobs.size,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue),
          byTechnician: Object.entries(byTechnician)
            .map(([technicianId, data]: [string, typeof byTechnician[string]]) => ({
              technicianId,
              technicianName: data.name,
              totalMaterials: data.materials,
              totalCost: data.cost,
              totalRevenue: data.revenue,
              jobCount: data.jobs.size,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue),
        },
      });
    }

    // Materials for invoice
    if (view === 'for-invoice' && jobId) {
      const materials = await prisma.jobMaterial.findMany({
        where: {
          jobId,
          job: { organizationId: session.organizationId },
          usedQty: { gt: 0 },
          isInvoiced: false,
        },
        include: {
          product: { select: { name: true, sku: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          items: materials.map((m: typeof materials[number]) => ({
            id: m.id,
            description: `${(m.product as any)?.name || 'Material'} (${(m.product as any)?.sku})`,
            quantity: m.usedQty,
            unitPrice: Number(m.unitPrice),
            total: Number(m.lineTotal),
          })),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'jobId is required or invalid view' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Job materials API error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching job materials data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/job-materials
 * Add, use, or return job materials
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body.action || 'add';

    // Add material to job
    if (action === 'add') {
      const { jobId, productId, quantity, unitPrice, discount, sourceType, sourceId, notes, reserveStock } = body;

      if (!jobId || !productId || !quantity) {
        return NextResponse.json(
          { success: false, error: 'jobId, productId y quantity son requeridos' },
          { status: 400 }
        );
      }

      // Verify job exists
      const job = await prisma.job.findFirst({
        where: { id: jobId, organizationId: session.organizationId },
      });

      if (!job) {
        return NextResponse.json(
          { success: false, error: 'Trabajo no encontrado' },
          { status: 404 }
        );
      }

      // Get product
      const product = await prisma.product.findFirst({
        where: { id: productId, organizationId: session.organizationId },
      });

      if (!product) {
        return NextResponse.json(
          { success: false, error: 'Producto no encontrado' },
          { status: 404 }
        );
      }

      const price = unitPrice ?? Number(product.salePrice);
      const cost = Number(product.costPrice);
      const discountPercent = discount ?? 0;
      const lineTotal = quantity * price * (1 - discountPercent / 100);

      // Create job material
      const material = await prisma.jobMaterial.create({
        data: {
          jobId,
          productId,
          estimatedQty: quantity,
          usedQty: 0,
          returnedQty: 0,
          unitPrice: price,
          unitCost: cost,
          discount: discountPercent,
          lineTotal,
          sourceType: sourceType || 'WAREHOUSE',
          sourceId: sourceId || null,
          notes: notes || null,
          addedAt: new Date(),
        },
        include: {
          product: {
            select: { id: true, name: true, sku: true, unitOfMeasure: true },
          },
        },
      });

      // Create stock reservation if requested
      if (reserveStock && sourceType !== 'CUSTOMER') {
        let warehouseId = sourceId;
        if (!warehouseId) {
          const defaultWarehouse = await prisma.warehouse.findFirst({
            where: { organizationId: session.organizationId, isDefault: true, isActive: true },
          });
          warehouseId = defaultWarehouse?.id;
        }

        if (warehouseId) {
          await prisma.stockReservation.create({
            data: {
              organizationId: session.organizationId,
              productId,
              warehouseId,
              jobId,
              quantity,
              status: 'PENDING',
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: material,
        message: 'Material agregado al trabajo',
      });
    }

    // Use material (record actual usage)
    if (action === 'use') {
      const { jobMaterialId, usedQty, fromVehicle, technicianId } = body;

      if (!jobMaterialId || !usedQty) {
        return NextResponse.json(
          { success: false, error: 'jobMaterialId y usedQty son requeridos' },
          { status: 400 }
        );
      }

      const material = await prisma.jobMaterial.findFirst({
        where: { id: jobMaterialId },
        include: { job: true, product: true },
      });

      if (!material || material.job.organizationId !== session.organizationId) {
        return NextResponse.json(
          { success: false, error: 'Material no encontrado' },
          { status: 404 }
        );
      }

      const remainingQty = material.estimatedQty - material.usedQty - material.returnedQty;
      if (usedQty > remainingQty) {
        return NextResponse.json(
          { success: false, error: `Cantidad excede lo disponible. Restante: ${remainingQty}` },
          { status: 400 }
        );
      }

      // Handle stock deduction
      if (fromVehicle && technicianId) {
        // Use from technician's vehicle
        const vehicleStock = await prisma.vehicleStock.findFirst({
          where: { technicianId, productId: material.productId },
        });

        if (!vehicleStock || vehicleStock.quantity < usedQty) {
          return NextResponse.json(
            { success: false, error: 'Stock insuficiente en vehículo' },
            { status: 400 }
          );
        }

        await prisma.vehicleStock.update({
          where: { id: vehicleStock.id },
          data: { quantity: { decrement: usedQty } },
        });
      } else if (material.sourceType === 'WAREHOUSE' && material.sourceId) {
        // Fulfill reservation or create movement
        const reservation = await prisma.stockReservation.findFirst({
          where: {
            jobId: material.jobId,
            productId: material.productId,
            status: 'PENDING',
          },
        });

        if (reservation) {
          await prisma.stockReservation.update({
            where: { id: reservation.id },
            data: { status: 'FULFILLED', fulfilledAt: new Date() },
          });

          // Update inventory level
          const inventoryLevel = await prisma.inventoryLevel.findFirst({
            where: { productId: material.productId, warehouseId: material.sourceId },
          });

          if (inventoryLevel) {
            await prisma.inventoryLevel.update({
              where: { id: inventoryLevel.id },
              data: {
                quantityOnHand: { decrement: usedQty },
                quantityReserved: { decrement: usedQty },
                quantityAvailable: inventoryLevel.quantityAvailable,
                lastMovementAt: new Date(),
              },
            });
          }
        }

        // Create stock movement
        const movementNumber = `USE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        await prisma.stockMovement.create({
          data: {
            organizationId: session.organizationId,
            productId: material.productId,
            movementNumber,
            movementType: 'SALE',
            quantity: usedQty,
            direction: 'OUT',
            fromWarehouseId: material.sourceId,
            jobId: material.jobId,
            unitCost: Number(material.unitCost),
            totalCost: Number(material.unitCost) * usedQty,
            notes: `Uso en trabajo ${material.job.jobNumber}`,
            performedById: session.userId,
          },
        });
      }

      // Update material record
      const newUsedQty = material.usedQty + usedQty;
      const updated = await prisma.jobMaterial.update({
        where: { id: jobMaterialId },
        data: {
          usedQty: newUsedQty,
          usedAt: new Date(),
          lineTotal: newUsedQty * Number(material.unitPrice) * (1 - Number(material.discount) / 100),
        },
        include: {
          product: {
            select: { id: true, name: true, sku: true, unitOfMeasure: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Uso de material registrado',
      });
    }

    // Return unused material
    if (action === 'return') {
      const { jobMaterialId, returnedQty, reason, toWarehouseId } = body;

      if (!jobMaterialId || !returnedQty) {
        return NextResponse.json(
          { success: false, error: 'jobMaterialId y returnedQty son requeridos' },
          { status: 400 }
        );
      }

      const material = await prisma.jobMaterial.findFirst({
        where: { id: jobMaterialId },
        include: { job: true },
      });

      if (!material || material.job.organizationId !== session.organizationId) {
        return NextResponse.json(
          { success: false, error: 'Material no encontrado' },
          { status: 404 }
        );
      }

      const unusedQty = material.estimatedQty - material.usedQty - material.returnedQty;
      if (returnedQty > unusedQty) {
        return NextResponse.json(
          { success: false, error: `Cantidad excede lo no utilizado. Disponible: ${unusedQty}` },
          { status: 400 }
        );
      }

      // If returning to warehouse, create movement and update inventory
      if (toWarehouseId) {
        const movementNumber = `RET-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        await prisma.stockMovement.create({
          data: {
            organizationId: session.organizationId,
            productId: material.productId,
            movementNumber,
            movementType: 'RETURN_IN',
            quantity: returnedQty,
            direction: 'IN',
            toWarehouseId,
            jobId: material.jobId,
            unitCost: Number(material.unitCost),
            totalCost: Number(material.unitCost) * returnedQty,
            notes: reason || `Devolución de trabajo ${material.job.jobNumber}`,
            performedById: session.userId,
          },
        });

        // Update inventory level
        const inventoryLevel = await prisma.inventoryLevel.findFirst({
          where: { productId: material.productId, warehouseId: toWarehouseId },
        });

        if (inventoryLevel) {
          await prisma.inventoryLevel.update({
            where: { id: inventoryLevel.id },
            data: {
              quantityOnHand: { increment: returnedQty },
              quantityAvailable: { increment: returnedQty },
              lastMovementAt: new Date(),
            },
          });
        } else {
          // Get product for cost info
          const product = await prisma.product.findUnique({
            where: { id: material.productId },
          });

          await prisma.inventoryLevel.create({
            data: {
              organizationId: session.organizationId,
              productId: material.productId,
              warehouseId: toWarehouseId,
              quantityOnHand: returnedQty,
              quantityAvailable: returnedQty,
              unitCost: product?.costPrice || 0,
              totalCost: Number(product?.costPrice || 0) * returnedQty,
            },
          });
        }
      }

      // Update material record
      const newReturnedQty = material.returnedQty + returnedQty;
      const actualUsed = material.usedQty;
      const updated = await prisma.jobMaterial.update({
        where: { id: jobMaterialId },
        data: {
          returnedQty: newReturnedQty,
          lineTotal: actualUsed * Number(material.unitPrice) * (1 - Number(material.discount) / 100),
        },
        include: {
          product: {
            select: { id: true, name: true, sku: true, unitOfMeasure: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Devolución de material registrada',
      });
    }

    // Add materials from estimate
    if (action === 'addFromEstimate') {
      const { jobId, estimates, reserveStock, warehouseId } = body;

      if (!jobId || !estimates || !Array.isArray(estimates)) {
        return NextResponse.json(
          { success: false, error: 'jobId y estimates son requeridos' },
          { status: 400 }
        );
      }

      const materials = [];
      for (const est of estimates) {
        const product = await prisma.product.findFirst({
          where: { id: est.productId, organizationId: session.organizationId },
        });

        if (!product) continue;

        const price = Number(product.salePrice);
        const cost = Number(product.costPrice);
        const lineTotal = est.quantity * price;

        const material = await prisma.jobMaterial.create({
          data: {
            jobId,
            productId: est.productId,
            estimatedQty: est.quantity,
            usedQty: 0,
            returnedQty: 0,
            unitPrice: price,
            unitCost: cost,
            discount: 0,
            lineTotal,
            sourceType: 'WAREHOUSE',
            sourceId: warehouseId || null,
            addedAt: new Date(),
          },
          include: {
            product: {
              select: { id: true, name: true, sku: true, unitOfMeasure: true },
            },
          },
        });

        // Create stock reservation if requested
        if (reserveStock) {
          let targetWarehouseId = warehouseId;
          if (!targetWarehouseId) {
            const defaultWarehouse = await prisma.warehouse.findFirst({
              where: { organizationId: session.organizationId, isDefault: true, isActive: true },
            });
            targetWarehouseId = defaultWarehouse?.id;
          }

          if (targetWarehouseId) {
            await prisma.stockReservation.create({
              data: {
                organizationId: session.organizationId,
                productId: est.productId,
                warehouseId: targetWarehouseId,
                jobId,
                quantity: est.quantity,
                status: 'PENDING',
              },
            });
          }
        }

        materials.push(material);
      }

      return NextResponse.json({
        success: true,
        data: { materials, count: materials.length },
        message: `${materials.length} materiales agregados al trabajo`,
      });
    }

    // Mark materials as invoiced
    if (action === 'markInvoiced') {
      const { jobId } = body;

      if (!jobId) {
        return NextResponse.json(
          { success: false, error: 'jobId es requerido' },
          { status: 400 }
        );
      }

      const result = await prisma.jobMaterial.updateMany({
        where: {
          jobId,
          job: { organizationId: session.organizationId },
          usedQty: { gt: 0 },
          isInvoiced: false,
        },
        data: { isInvoiced: true },
      });

      return NextResponse.json({
        success: true,
        data: { count: result.count },
        message: `${result.count} materiales marcados como facturados`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Acción no válida' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Job materials action error:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing job materials action' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory/job-materials
 * Update job material
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, quantity, unitPrice, discount, notes } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID del material es requerido' },
        { status: 400 }
      );
    }

    const material = await prisma.jobMaterial.findFirst({
      where: { id },
      include: { job: true },
    });

    if (!material || material.job.organizationId !== session.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Material no encontrado' },
        { status: 404 }
      );
    }

    const newQuantity = quantity ?? material.estimatedQty;
    const newPrice = unitPrice ?? Number(material.unitPrice);
    const newDiscount = discount ?? Number(material.discount);
    const lineTotal = newQuantity * newPrice * (1 - newDiscount / 100);

    const updated = await prisma.jobMaterial.update({
      where: { id },
      data: {
        estimatedQty: newQuantity,
        unitPrice: newPrice,
        discount: newDiscount,
        lineTotal,
        notes: notes !== undefined ? notes : material.notes,
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, unitOfMeasure: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Material actualizado',
    });
  } catch (error) {
    console.error('Job material update error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating job material' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/job-materials
 * Remove material from job
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID del material es requerido' },
        { status: 400 }
      );
    }

    const material = await prisma.jobMaterial.findFirst({
      where: { id },
      include: { job: true },
    });

    if (!material || material.job.organizationId !== session.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Material no encontrado' },
        { status: 404 }
      );
    }

    if (material.usedQty > 0) {
      return NextResponse.json(
        { success: false, error: 'No se puede eliminar un material que ya fue utilizado' },
        { status: 400 }
      );
    }

    // Cancel any pending reservations
    await prisma.stockReservation.updateMany({
      where: {
        jobId: material.jobId,
        productId: material.productId,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    await prisma.jobMaterial.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Material eliminado del trabajo',
    });
  } catch (error) {
    console.error('Job material removal error:', error);
    return NextResponse.json(
      { success: false, error: 'Error removing job material' },
      { status: 500 }
    );
  }
}
