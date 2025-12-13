/**
 * User Module
 * ===========
 *
 * User management with role-based access control.
 */

import { Pool, PoolClient } from 'pg';
import { Router, Request, Response, NextFunction } from 'express';
import { OrgScopedRepository } from '../../shared/repositories/base.repository';
import { User, UserRole, UserSettings, PaginatedResult, PaginationParams } from '../../shared/types/domain.types';
import { normalizePhone, validatePhone, validateEmail } from '../../shared/utils/validation';

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ['*'],
  admin: ['jobs:*', 'customers:*', 'invoices:*', 'payments:*', 'team:read', 'reports:*', 'settings:read'],
  dispatcher: ['jobs:*', 'customers:*', 'whatsapp:*', 'invoices:read'],
  technician: ['jobs:read:assigned', 'jobs:update:assigned', 'customers:read'],
  accountant: ['invoices:*', 'payments:read', 'reports:read'],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;

  // Check wildcard (jobs:* matches jobs:read)
  const [resource, action] = permission.split(':');
  return perms.includes(`${resource}:*`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateUserDTO {
  phone: string;
  fullName: string;
  email?: string;
  role: UserRole;
}

export interface UpdateUserDTO {
  fullName?: string;
  email?: string;
  role?: UserRole;
  settings?: Partial<UserSettings>;
}

export interface InviteUserDTO {
  phone: string;
  fullName: string;
  email?: string;
  role: UserRole;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export class UserRepository extends OrgScopedRepository<User> {
  constructor(pool: Pool) {
    super(pool, 'users');
  }

  async findByPhone(orgId: string, phone: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT * FROM users WHERE org_id = $1 AND phone = $2`,
      [orgId, phone]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByPhoneGlobal(phone: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT * FROM users WHERE phone = $1 AND is_active = true LIMIT 1`,
      [phone]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByRole(orgId: string, role: UserRole): Promise<User[]> {
    const result = await this.pool.query(
      `SELECT * FROM users WHERE org_id = $1 AND role = $2 AND is_active = true ORDER BY full_name`,
      [orgId, role]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class UserService {
  private repo: UserRepository;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.repo = new UserRepository(pool);
  }

  async getById(orgId: string, id: string): Promise<User> {
    const user = await this.repo.findByIdInOrg(orgId, id);
    if (!user) throw new Error('User not found');
    return user;
  }

  async getByPhone(phone: string): Promise<User | null> {
    const normalized = normalizePhone(phone);
    return this.repo.findByPhoneGlobal(normalized);
  }

  async list(orgId: string, pagination: PaginationParams): Promise<PaginatedResult<User>> {
    return this.repo.findPaginatedInOrg(orgId, { isActive: true } as any, pagination);
  }

  async create(orgId: string, data: CreateUserDTO): Promise<User> {
    const phoneValidation = validatePhone(data.phone);
    if (!phoneValidation.valid) throw new Error(phoneValidation.error);

    if (data.email) {
      const emailValidation = validateEmail(data.email);
      if (!emailValidation.valid) throw new Error(emailValidation.error);
    }

    // Check duplicate phone
    const existing = await this.repo.findByPhone(orgId, phoneValidation.normalized!);
    if (existing) throw new Error('A user with this phone already exists');

    return this.repo.createInOrg(orgId, {
      phone: phoneValidation.normalized!,
      fullName: data.fullName,
      email: data.email,
      role: data.role,
      isActive: true,
      settings: { notifications: true, language: 'es' },
    });
  }

  async createOwner(client: PoolClient, orgId: string, phone: string, fullName: string): Promise<{ id: string }> {
    const normalized = normalizePhone(phone);
    const id = crypto.randomUUID();
    const now = new Date();

    await client.query(
      `INSERT INTO users (id, org_id, phone, full_name, role, is_active, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'owner', true, $5, $6, $6)`,
      [id, orgId, normalized, fullName, JSON.stringify({ notifications: true, language: 'es' }), now]
    );

    return { id };
  }

  async update(orgId: string, id: string, data: UpdateUserDTO): Promise<User> {
    const user = await this.getById(orgId, id);

    // Prevent demoting last owner
    if (data.role && data.role !== 'owner' && user.role === 'owner') {
      const owners = await this.repo.findByRole(orgId, 'owner');
      if (owners.length <= 1) throw new Error('Cannot demote the last owner');
    }

    const updated = await this.repo.updateInOrg(orgId, id, data as any);
    if (!updated) throw new Error('Failed to update user');
    return updated;
  }

  async deactivate(orgId: string, id: string): Promise<void> {
    const user = await this.getById(orgId, id);

    if (user.role === 'owner') {
      const owners = await this.repo.findByRole(orgId, 'owner');
      if (owners.length <= 1) throw new Error('Cannot deactivate the last owner');
    }

    await this.repo.softDeleteInOrg(orgId, id);
  }

  async recordLogin(id: string): Promise<void> {
    await this.repo.updateLastLogin(id);
  }

  async getTechnicians(orgId: string): Promise<User[]> {
    return this.repo.findByRole(orgId, 'technician');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export function createUserRoutes(pool: Pool): Router {
  const router = Router();
  const service = new UserService(pool);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const result = await service.list(orgId, {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });
      res.json({ data: result.data, meta: { total: result.total, page: result.page, totalPages: result.totalPages } });
    } catch (error) { next(error); }
  });

  router.get('/technicians', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const technicians = await service.getTechnicians(orgId);
      res.json({ data: technicians });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const user = await service.getById(orgId, req.params.id);
      res.json({ data: user });
    } catch (error) { next(error); }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const user = await service.create(orgId, req.body);
      res.status(201).json({ data: user });
    } catch (error) { next(error); }
  });

  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const user = await service.update(orgId, req.params.id, req.body);
      res.json({ data: user });
    } catch (error) { next(error); }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.auth?.orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      await service.deactivate(orgId, req.params.id);
      res.status(204).send();
    } catch (error) { next(error); }
  });

  return router;
}
