import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listProducts,
  createProduct,
  searchProducts,
  getProductStats,
  importProducts,
  getAllCategories,
  getCategoryTree,
  createCategory,
} from '@/src/modules/inventory';

/**
 * GET /api/inventory/products
 * List products with filters and pagination
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
    const view = searchParams.get('view');

    // Statistics view
    if (view === 'stats') {
      const stats = await getProductStats(session.organizationId);
      return NextResponse.json({ success: true, data: stats });
    }

    // Categories view
    if (view === 'categories') {
      const tree = searchParams.get('tree') === 'true';
      const categories = tree
        ? await getCategoryTree(session.organizationId)
        : await getAllCategories(session.organizationId);
      return NextResponse.json({ success: true, data: { categories } });
    }

    // Quick search
    if (view === 'search') {
      const query = searchParams.get('q') || '';
      const products = await searchProducts(session.organizationId, query, 20);
      return NextResponse.json({ success: true, data: { products } });
    }

    // List products with filters
    const filters = {
      categoryId: searchParams.get('categoryId') || undefined,
      productType: searchParams.get('productType') as any,
      isActive: searchParams.get('isActive') === 'true' ? true : searchParams.get('isActive') === 'false' ? false : undefined,
      search: searchParams.get('search') || undefined,
      lowStock: searchParams.get('lowStock') === 'true',
      outOfStock: searchParams.get('outOfStock') === 'true',
    };

    const options = {
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      sortBy: (searchParams.get('sortBy') as any) || 'name',
      sortOrder: (searchParams.get('sortOrder') as any) || 'asc',
      includeInventory: searchParams.get('includeInventory') !== 'false',
      includeCategory: true,
    };

    const result = await listProducts(session.organizationId, filters, options);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Products list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error listing products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/products
 * Create a product or category
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
    const { type } = body;

    // Create category
    if (type === 'category') {
      const category = await createCategory({
        organizationId: session.organizationId,
        ...body.data,
      });
      return NextResponse.json({ success: true, data: { category } });
    }

    // Import products
    if (type === 'import') {
      const result = await importProducts(session.organizationId, body.data.rows);
      return NextResponse.json({ success: true, data: result });
    }

    // Create product
    const product = await createProduct({
      organizationId: session.organizationId,
      ...body,
    });

    return NextResponse.json({
      success: true,
      data: { product },
    });
  } catch (error) {
    console.error('Product creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error creating product' },
      { status: 500 }
    );
  }
}
