/**
 * Price Book Module
 * =================
 *
 * Service and product catalog with categories and pricing.
 */

import { Pool } from 'pg';
import { Router, Request, Response, NextFunction } from 'express';
import { OrgScopedRepository, objectToCamel } from '../../shared/repositories/base.repository';
import { PriceBookItem, PaginatedResult, PaginationParams } from '../../shared/types/domain.types';
import { validateMoney, validateTaxRate, validatePercentage } from '../../shared/utils/database.utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PriceBookCategory {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryDTO {
  name: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateCategoryDTO {
  name?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreatePriceBookItemDTO {
  categoryId?: string;
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  unit: string;
  taxRate: number;
  estimatedDuration?: number;
}

export interface UpdatePriceBookItemDTO {
  categoryId?: string;
  name?: string;
  description?: string;
  unitPrice?: number;
  unit?: string;
  taxRate?: number;
  estimatedDuration?: number;
  isActive?: boolean;
}

export interface PriceBookFilters {
  categoryId?: string;
  search?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class CategoryRepository extends OrgScopedRepository<PriceBookCategory> {
  constructor(pool: Pool) {
    super(pool, 'pricebook_categories');
  }

  async findByName(orgId: string, name: string): Promise<PriceBookCategory | null> {
    const result = await this.pool.query(
      `SELECT * FROM pricebook_categories WHERE org_id = $1 AND LOWER(name) = LOWER($2)`,
      [orgId, name]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findWithChildren(orgId: string): Promise<PriceBookCategory[]> {
    const result = await this.pool.query(
      `SELECT * FROM pricebook_categories WHERE org_id = $1 ORDER BY sort_order, name`,
      [orgId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async findChildren(orgId: string, parentId: string | null): Promise<PriceBookCategory[]> {
    const result = await this.pool.query(
      parentId
        ? `SELECT * FROM pricebook_categories WHERE org_id = $1 AND parent_id = $2 ORDER BY sort_order, name`
        : `SELECT * FROM pricebook_categories WHERE org_id = $1 AND parent_id IS NULL ORDER BY sort_order, name`,
      parentId ? [orgId, parentId] : [orgId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async getItemCount(categoryId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM pricebook_items WHERE category_id = $1`,
      [categoryId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRow(row: Record<string, any>): PriceBookCategory {
    return objectToCamel<PriceBookCategory>(row);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ITEM REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class PriceBookItemRepository extends OrgScopedRepository<PriceBookItem> {
  constructor(pool: Pool) {
    super(pool, 'pricebook_items');
  }

  async findByCode(orgId: string, code: string): Promise<PriceBookItem | null> {
    const result = await this.pool.query(
      `SELECT * FROM pricebook_items WHERE org_id = $1 AND code = $2`,
      [orgId, code]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findFiltered(orgId: string, filters: PriceBookFilters, pagination: PaginationParams): Promise<PaginatedResult<PriceBookItem>> {
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE org_id = $1';
    const values: any[] = [orgId];
    let paramIndex = 2;

    if (filters.categoryId) {
      whereClause += ` AND category_id = $${paramIndex}`;
      values.push(filters.categoryId);
      paramIndex++;
    }

    if (filters.isActive !== undefined) {
      whereClause += ` AND is_active = $${paramIndex}`;
      values.push(filters.isActive);
      paramIndex++;
    }

    if (filters.search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR code ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.minPrice !== undefined) {
      whereClause += ` AND unit_price >= $${paramIndex}`;
      values.push(filters.minPrice);
      paramIndex++;
    }

    if (filters.maxPrice !== undefined) {
      whereClause += ` AND unit_price <= $${paramIndex}`;
      values.push(filters.maxPrice);
      paramIndex++;
    }

    const countResult = await this.pool.query(`SELECT COUNT(*) FROM pricebook_items ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const sortBy = pagination.sortBy || 'name';
    const sortOrder = (pagination.sortOrder || 'asc').toUpperCase();

    const result = await this.pool.query(
      `SELECT * FROM pricebook_items ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      data: result.rows.map(row => this.mapRow(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByCategory(orgId: string, categoryId: string): Promise<PriceBookItem[]> {
    const result = await this.pool.query(
      `SELECT * FROM pricebook_items WHERE org_id = $1 AND category_id = $2 AND is_active = true ORDER BY name`,
      [orgId, categoryId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async search(orgId: string, query: string, limit: number = 10): Promise<PriceBookItem[]> {
    const result = await this.pool.query(
      `SELECT * FROM pricebook_items
       WHERE org_id = $1 AND is_active = true
         AND (name ILIKE $2 OR code ILIKE $2 OR description ILIKE $2)
       ORDER BY name
       LIMIT $3`,
      [orgId, `%${query}%`, limit]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async updatePrice(orgId: string, id: string, unitPrice: number): Promise<PriceBookItem | null> {
    const result = await this.pool.query(
      `UPDATE pricebook_items SET unit_price = $3, updated_at = NOW()
       WHERE org_id = $1 AND id = $2 RETURNING *`,
      [orgId, id, unitPrice]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async bulkUpdatePrices(orgId: string, updates: { id: string; unitPrice: number }[]): Promise<number> {
    let updated = 0;
    for (const update of updates) {
      const result = await this.pool.query(
        `UPDATE pricebook_items SET unit_price = $3, updated_at = NOW()
         WHERE org_id = $1 AND id = $2`,
        [orgId, update.id, update.unitPrice]
      );
      updated += result.rowCount || 0;
    }
    return updated;
  }

  protected mapRow(row: Record<string, any>): PriceBookItem {
    return objectToCamel<PriceBookItem>(row);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class PriceBookService {
  private categoryRepo: CategoryRepository;
  private itemRepo: PriceBookItemRepository;

  constructor(pool: Pool) {
    this.categoryRepo = new CategoryRepository(pool);
    this.itemRepo = new PriceBookItemRepository(pool);
  }

  // Category methods
  async getCategory(orgId: string, id: string): Promise<PriceBookCategory> {
    const category = await this.categoryRepo.findByIdInOrg(orgId, id);
    if (!category) throw new Error('Category not found');
    return category;
  }

  async listCategories(orgId: string): Promise<PriceBookCategory[]> {
    return this.categoryRepo.findWithChildren(orgId);
  }

  async getCategoryTree(orgId: string): Promise<any[]> {
    const categories = await this.categoryRepo.findWithChildren(orgId);

    // Build tree structure
    const categoryMap = new Map<string, any>();
    const roots: any[] = [];

    for (const cat of categories) {
      categoryMap.set(cat.id, { ...cat, children: [] });
    }

    for (const cat of categories) {
      const node = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async createCategory(orgId: string, data: CreateCategoryDTO): Promise<PriceBookCategory> {
    // Check for duplicate name
    const existing = await this.categoryRepo.findByName(orgId, data.name);
    if (existing) {
      throw new Error('Category with this name already exists');
    }

    return this.categoryRepo.createInOrg(orgId, {
      name: data.name,
      description: data.description,
      parentId: data.parentId,
      sortOrder: data.sortOrder || 0,
      isActive: true,
    });
  }

  async updateCategory(orgId: string, id: string, data: UpdateCategoryDTO): Promise<PriceBookCategory> {
    const category = await this.getCategory(orgId, id);

    if (data.name && data.name !== category.name) {
      const existing = await this.categoryRepo.findByName(orgId, data.name);
      if (existing) {
        throw new Error('Category with this name already exists');
      }
    }

    // Prevent circular parent reference
    if (data.parentId === id) {
      throw new Error('Category cannot be its own parent');
    }

    const updated = await this.categoryRepo.updateInOrg(orgId, id, data);
    if (!updated) throw new Error('Failed to update category');
    return updated;
  }

  async deleteCategory(orgId: string, id: string): Promise<void> {
    const category = await this.getCategory(orgId, id);

    // Check for items in category
    const itemCount = await this.categoryRepo.getItemCount(id);
    if (itemCount > 0) {
      throw new Error(`Cannot delete category with ${itemCount} items`);
    }

    // Check for child categories
    const children = await this.categoryRepo.findChildren(orgId, id);
    if (children.length > 0) {
      throw new Error('Cannot delete category with subcategories');
    }

    await this.categoryRepo.deleteInOrg(orgId, id);
  }

  // Item methods
  async getItem(orgId: string, id: string): Promise<PriceBookItem> {
    const item = await this.itemRepo.findByIdInOrg(orgId, id);
    if (!item) throw new Error('Price book item not found');
    return item;
  }

  async getItemByCode(orgId: string, code: string): Promise<PriceBookItem> {
    const item = await this.itemRepo.findByCode(orgId, code);
    if (!item) throw new Error('Price book item not found');
    return item;
  }

  async listItems(orgId: string, filters: PriceBookFilters, pagination: PaginationParams): Promise<PaginatedResult<PriceBookItem>> {
    return this.itemRepo.findFiltered(orgId, filters, pagination);
  }

  async searchItems(orgId: string, query: string): Promise<PriceBookItem[]> {
    return this.itemRepo.search(orgId, query);
  }

  async createItem(orgId: string, data: CreatePriceBookItemDTO): Promise<PriceBookItem> {
    // Validate numeric fields
    validateMoney(data.unitPrice, 'unitPrice');
    validateTaxRate(data.taxRate, 'taxRate');

    // Check for duplicate code
    const existing = await this.itemRepo.findByCode(orgId, data.code);
    if (existing) {
      throw new Error('Item with this code already exists');
    }

    // Verify category exists if provided
    if (data.categoryId) {
      await this.getCategory(orgId, data.categoryId);
    }

    return this.itemRepo.createInOrg(orgId, {
      categoryId: data.categoryId,
      code: data.code,
      name: data.name,
      description: data.description,
      unitPrice: data.unitPrice,
      unit: data.unit,
      taxRate: data.taxRate,
      estimatedDuration: data.estimatedDuration,
      isActive: true,
    });
  }

  async updateItem(orgId: string, id: string, data: UpdatePriceBookItemDTO): Promise<PriceBookItem> {
    // Validate numeric fields if provided
    if (data.unitPrice !== undefined) {
      validateMoney(data.unitPrice, 'unitPrice');
    }
    if (data.taxRate !== undefined) {
      validateTaxRate(data.taxRate, 'taxRate');
    }

    await this.getItem(orgId, id);

    if (data.categoryId) {
      await this.getCategory(orgId, data.categoryId);
    }

    const updated = await this.itemRepo.updateInOrg(orgId, id, data);
    if (!updated) throw new Error('Failed to update item');
    return updated;
  }

  async updateItemPrice(orgId: string, id: string, unitPrice: number): Promise<PriceBookItem> {
    validateMoney(unitPrice, 'unitPrice');
    const updated = await this.itemRepo.updatePrice(orgId, id, unitPrice);
    if (!updated) throw new Error('Failed to update price');
    return updated;
  }

  async bulkUpdatePrices(orgId: string, updates: { id: string; unitPrice: number }[]): Promise<number> {
    // Validate all prices before updating
    for (const update of updates) {
      validateMoney(update.unitPrice, `updates[${update.id}].unitPrice`);
    }
    return this.itemRepo.bulkUpdatePrices(orgId, updates);
  }

  async applyPriceAdjustment(orgId: string, categoryId: string | null, adjustmentPercent: number): Promise<number> {
    // Validate adjustment percentage (-100% to +1000%)
    validatePercentage(Math.abs(adjustmentPercent), 'adjustmentPercent');
    if (adjustmentPercent < -100 || adjustmentPercent > 1000) {
      throw new Error('Adjustment percent must be between -100 and 1000');
    }

    // Get items to update
    const filters: PriceBookFilters = { isActive: true };
    if (categoryId) filters.categoryId = categoryId;

    const items = await this.itemRepo.findFiltered(orgId, filters, { page: 1, limit: 1000 });

    const updates = items.data.map(item => ({
      id: item.id,
      unitPrice: Math.round(item.unitPrice * (1 + adjustmentPercent / 100) * 100) / 100,
    }));

    return this.bulkUpdatePrices(orgId, updates);
  }

  async deleteItem(orgId: string, id: string): Promise<void> {
    await this.getItem(orgId, id);
    await this.itemRepo.deleteInOrg(orgId, id);
  }

  async deactivateItem(orgId: string, id: string): Promise<PriceBookItem> {
    const updated = await this.itemRepo.updateInOrg(orgId, id, { isActive: false });
    if (!updated) throw new Error('Failed to deactivate item');
    return updated;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createPriceBookRoutes(pool: Pool): Router {
  const router = Router();
  const service = new PriceBookService(pool);

  // Category routes
  router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const categories = await service.listCategories(orgId);
      res.json({ data: categories });
    } catch (error) { next(error); }
  });

  router.get('/categories/tree', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const tree = await service.getCategoryTree(orgId);
      res.json({ data: tree });
    } catch (error) { next(error); }
  });

  router.get('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const category = await service.getCategory(orgId, req.params.id);
      res.json({ data: category });
    } catch (error) { next(error); }
  });

  router.post('/categories', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const category = await service.createCategory(orgId, req.body);
      res.status(201).json({ data: category });
    } catch (error) { next(error); }
  });

  router.put('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const category = await service.updateCategory(orgId, req.params.id, req.body);
      res.json({ data: category });
    } catch (error) { next(error); }
  });

  router.delete('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      await service.deleteCategory(orgId, req.params.id);
      res.status(204).send();
    } catch (error) { next(error); }
  });

  // Item routes
  router.get('/items', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const filters: PriceBookFilters = {};
      if (req.query.categoryId) filters.categoryId = req.query.categoryId as string;
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.isActive) filters.isActive = req.query.isActive === 'true';

      const result = await service.listItems(orgId, filters, {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      });
      res.json({ data: result.data, meta: { total: result.total, page: result.page } });
    } catch (error) { next(error); }
  });

  router.get('/items/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const query = req.query.q as string;
      if (!query) return res.json({ data: [] });

      const items = await service.searchItems(orgId, query);
      res.json({ data: items });
    } catch (error) { next(error); }
  });

  router.get('/items/code/:code', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const item = await service.getItemByCode(orgId, req.params.code);
      res.json({ data: item });
    } catch (error) { next(error); }
  });

  router.get('/items/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const item = await service.getItem(orgId, req.params.id);
      res.json({ data: item });
    } catch (error) { next(error); }
  });

  router.post('/items', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const item = await service.createItem(orgId, req.body);
      res.status(201).json({ data: item });
    } catch (error) { next(error); }
  });

  router.put('/items/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const item = await service.updateItem(orgId, req.params.id, req.body);
      res.json({ data: item });
    } catch (error) { next(error); }
  });

  router.patch('/items/:id/price', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const item = await service.updateItemPrice(orgId, req.params.id, req.body.unitPrice);
      res.json({ data: item });
    } catch (error) { next(error); }
  });

  router.post('/items/bulk-price-update', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const updated = await service.bulkUpdatePrices(orgId, req.body.updates);
      res.json({ data: { updated } });
    } catch (error) { next(error); }
  });

  router.post('/items/price-adjustment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { categoryId, adjustmentPercent } = req.body;
      const updated = await service.applyPriceAdjustment(orgId, categoryId, adjustmentPercent);
      res.json({ data: { updated } });
    } catch (error) { next(error); }
  });

  router.delete('/items/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      await service.deleteItem(orgId, req.params.id);
      res.status(204).send();
    } catch (error) { next(error); }
  });

  router.post('/items/:id/deactivate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const item = await service.deactivateItem(orgId, req.params.id);
      res.json({ data: item });
    } catch (error) { next(error); }
  });

  return router;
}

export { CategoryRepository, PriceBookItemRepository, PriceBookService };
