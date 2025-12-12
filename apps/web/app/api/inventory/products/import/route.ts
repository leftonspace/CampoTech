/**
 * Product Import API Route
 * POST CSV bulk import for products
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/inventory/products/import
 * Import products from CSV data
 *
 * Expected CSV columns:
 * sku, name, description, categoryCode, brand, model, unitOfMeasure,
 * costPrice, salePrice, taxRate, reorderPoint, reorderQuantity,
 * minStockLevel, maxStockLevel, barcode, isActive, trackInventory
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

    // Check user role
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para importar productos' },
        { status: 403 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let rows: any[] = [];

    if (contentType.includes('application/json')) {
      // JSON format: { rows: [...] }
      const body = await request.json();
      rows = body.rows || body.data || [];
    } else if (contentType.includes('text/csv') || contentType.includes('multipart/form-data')) {
      // CSV format
      const text = await request.text();
      rows = parseCSV(text);
    } else {
      return NextResponse.json(
        { success: false, error: 'Content-Type debe ser application/json o text/csv' },
        { status: 400 }
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron datos para importar' },
        { status: 400 }
      );
    }

    // Get category map
    const categories = await prisma.productCategory.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, code: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.code.toLowerCase(), c.id]));

    // Process rows
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; sku: string; error: string }>,
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Account for header row and 0-index

      try {
        // Validate required fields
        if (!row.sku || !row.name) {
          results.errors.push({
            row: rowNum,
            sku: row.sku || 'N/A',
            error: 'SKU y nombre son requeridos',
          });
          results.skipped++;
          continue;
        }

        // Clean and normalize SKU
        const sku = row.sku.toString().trim().toUpperCase();

        // Check if product exists
        const existingProduct = await prisma.product.findFirst({
          where: {
            organizationId: session.organizationId,
            sku,
          },
        });

        // Get category ID if provided
        let categoryId: string | null = null;
        if (row.categoryCode) {
          categoryId = categoryMap.get(row.categoryCode.toLowerCase()) || null;
        }

        // Parse numeric values
        const costPrice = parseFloat(row.costPrice) || 0;
        const salePrice = parseFloat(row.salePrice) || 0;
        const taxRate = parseFloat(row.taxRate) ?? 21;
        const reorderPoint = parseInt(row.reorderPoint) || 0;
        const reorderQuantity = parseInt(row.reorderQuantity) || 1;
        const minStockLevel = parseInt(row.minStockLevel) || 0;
        const maxStockLevel = row.maxStockLevel ? parseInt(row.maxStockLevel) : null;

        // Parse boolean values
        const isActive = row.isActive !== 'false' && row.isActive !== '0' && row.isActive !== false;
        const trackInventory = row.trackInventory !== 'false' && row.trackInventory !== '0' && row.trackInventory !== false;

        const productData = {
          name: row.name.trim(),
          description: row.description?.trim() || null,
          categoryId,
          brand: row.brand?.trim() || null,
          model: row.model?.trim() || null,
          unitOfMeasure: row.unitOfMeasure?.trim() || 'unidad',
          costPrice,
          salePrice,
          taxRate,
          reorderPoint,
          reorderQuantity,
          minStockLevel,
          maxStockLevel,
          barcode: row.barcode?.trim() || null,
          isActive,
          trackInventory,
        };

        if (existingProduct) {
          // Update existing product
          await prisma.product.update({
            where: { id: existingProduct.id },
            data: productData,
          });
          results.updated++;
        } else {
          // Create new product
          await prisma.product.create({
            data: {
              organizationId: session.organizationId,
              sku,
              ...productData,
            },
          });
          results.created++;
        }
      } catch (error: any) {
        results.errors.push({
          row: rowNum,
          sku: row.sku || 'N/A',
          error: error.message || 'Error desconocido',
        });
        results.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `Importación completada: ${results.created} creados, ${results.updated} actualizados, ${results.skipped} omitidos`,
    });
  } catch (error) {
    console.error('Product import error:', error);
    return NextResponse.json(
      { success: false, error: 'Error importing products' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inventory/products/import
 * Get import template/instructions
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
    const format = searchParams.get('format') || 'json';

    // Get available categories
    const categories = await prisma.productCategory.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    });

    const template = {
      columns: [
        { name: 'sku', required: true, description: 'Código único del producto' },
        { name: 'name', required: true, description: 'Nombre del producto' },
        { name: 'description', required: false, description: 'Descripción detallada' },
        { name: 'categoryCode', required: false, description: 'Código de categoría' },
        { name: 'brand', required: false, description: 'Marca' },
        { name: 'model', required: false, description: 'Modelo' },
        { name: 'unitOfMeasure', required: false, description: 'Unidad de medida (default: unidad)' },
        { name: 'costPrice', required: false, description: 'Precio de costo' },
        { name: 'salePrice', required: false, description: 'Precio de venta' },
        { name: 'taxRate', required: false, description: 'Tasa de IVA (default: 21)' },
        { name: 'reorderPoint', required: false, description: 'Punto de reorden' },
        { name: 'reorderQuantity', required: false, description: 'Cantidad a reordenar' },
        { name: 'minStockLevel', required: false, description: 'Stock mínimo' },
        { name: 'maxStockLevel', required: false, description: 'Stock máximo' },
        { name: 'barcode', required: false, description: 'Código de barras' },
        { name: 'isActive', required: false, description: 'Activo (true/false)' },
        { name: 'trackInventory', required: false, description: 'Rastrear inventario (true/false)' },
      ],
      availableCategories: categories,
      example: {
        sku: 'PROD-001',
        name: 'Producto de ejemplo',
        description: 'Descripción del producto',
        categoryCode: categories[0]?.code || 'CAT001',
        brand: 'Marca',
        model: 'Modelo XL',
        unitOfMeasure: 'unidad',
        costPrice: 100,
        salePrice: 150,
        taxRate: 21,
        reorderPoint: 10,
        reorderQuantity: 20,
        minStockLevel: 5,
        maxStockLevel: 100,
        barcode: '7790000000001',
        isActive: true,
        trackInventory: true,
      },
    };

    if (format === 'csv') {
      // Return CSV template
      const headers = template.columns.map((c) => c.name).join(',');
      const exampleRow = template.columns.map((c) => {
        const val = template.example[c.name as keyof typeof template.example];
        return typeof val === 'string' ? `"${val}"` : val;
      }).join(',');

      return new NextResponse(`${headers}\n${exampleRow}`, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="products_import_template.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('Import template error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching import template' },
      { status: 500 }
    );
  }
}

/**
 * Parse CSV text into array of objects
 */
function parseCSV(text: string): any[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: any = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
