import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  createSupplierWithAutoCode,
  getSupplier,
  updateSupplier,
  deleteSupplier,
  listSuppliers,
  searchSuppliers,
  getSupplierPerformance,
  getTopSuppliers,
  getSupplierProducts,
  addSupplierProduct,
  removeSupplierProduct,
  setPreferredSupplier,
} from '@/src/modules/inventory';

/**
 * GET /api/inventory/suppliers
 * List or search suppliers
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
    const supplierId = searchParams.get('supplierId');
    const view = searchParams.get('view');
    const search = searchParams.get('search');

    // Get single supplier
    if (supplierId && !view) {
      const supplier = await getSupplier(session.organizationId, supplierId);
      if (!supplier) {
        return NextResponse.json(
          { success: false, error: 'Supplier not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: { supplier } });
    }

    // Supplier performance
    if (supplierId && view === 'performance') {
      const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined;
      const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined;
      const performance = await getSupplierPerformance(session.organizationId, supplierId, dateFrom, dateTo);
      return NextResponse.json({ success: true, data: performance });
    }

    // Supplier products
    if (supplierId && view === 'products') {
      const products = await getSupplierProducts(session.organizationId, supplierId);
      return NextResponse.json({ success: true, data: { products } });
    }

    // Top suppliers
    if (view === 'top') {
      const limit = parseInt(searchParams.get('limit') || '10', 10);
      const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined;
      const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined;
      const suppliers = await getTopSuppliers(session.organizationId, limit, dateFrom, dateTo);
      return NextResponse.json({ success: true, data: { suppliers } });
    }

    // Search suppliers
    if (search) {
      const suppliers = await searchSuppliers(
        session.organizationId,
        search,
        parseInt(searchParams.get('limit') || '20', 10)
      );
      return NextResponse.json({ success: true, data: { suppliers } });
    }

    // List suppliers with filters
    const filters = {
      isActive: searchParams.get('isActive') === 'true' ? true :
                searchParams.get('isActive') === 'false' ? false : undefined,
      category: searchParams.get('category') || undefined,
      search: searchParams.get('q') || undefined,
    };

    const options = {
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc',
    };

    const result = await listSuppliers(session.organizationId, filters, options);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Suppliers list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error listing suppliers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/suppliers
 * Create supplier or manage supplier products
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
    const { action, supplierId } = body;

    // Add product to supplier
    if (action === 'addProduct' && supplierId) {
      const { productId, supplierSku, unitCost, minOrderQty, leadTimeDays, isPreferred } = body;
      const result = await addSupplierProduct({
        organizationId: session.organizationId,
        supplierId,
        productId,
        supplierSku,
        unitCost,
        minOrderQty,
        leadTimeDays,
        isPreferred,
      });
      return NextResponse.json({ success: true, data: result });
    }

    // Remove product from supplier
    if (action === 'removeProduct' && supplierId) {
      const { productId } = body;
      await removeSupplierProduct(session.organizationId, supplierId, productId);
      return NextResponse.json({ success: true });
    }

    // Set preferred supplier for product
    if (action === 'setPreferred' && supplierId) {
      const { productId } = body;
      await setPreferredSupplier(session.organizationId, productId, supplierId);
      return NextResponse.json({ success: true });
    }

    // Create new supplier
    const supplier = await createSupplierWithAutoCode({
      organizationId: session.organizationId,
      ...body,
    });

    return NextResponse.json({
      success: true,
      data: { supplier },
    });
  } catch (error) {
    console.error('Supplier creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error creating supplier' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory/suppliers
 * Update supplier
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
    const { supplierId, ...data } = body;

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: 'supplierId is required' },
        { status: 400 }
      );
    }

    const supplier = await updateSupplier(session.organizationId, supplierId, data);

    return NextResponse.json({
      success: true,
      data: { supplier },
    });
  } catch (error) {
    console.error('Supplier update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error updating supplier' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/suppliers
 * Delete supplier
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
    const supplierId = searchParams.get('supplierId');

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: 'supplierId is required' },
        { status: 400 }
      );
    }

    await deleteSupplier(session.organizationId, supplierId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Supplier deletion error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error deleting supplier' },
      { status: 500 }
    );
  }
}
