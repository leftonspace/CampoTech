/**
 * Test Helpers for CampoTech
 * ==========================
 * Factory functions and mock utilities for testing
 */

import type { User, Customer, Job, Organization, UserRole, SubscriptionTier, JobStatus, JobPriority } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK USER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export interface MockUserOptions {
  id?: string;
  name?: string;
  role?: UserRole;
  orgId?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

let userIdCounter = 1;

export function createMockUser(options: MockUserOptions = {}): User {
  const id = options.id ?? `user-${userIdCounter++}`;
  return {
    id,
    orgId: options.orgId ?? 'org-1',
    name: options.name ?? `Test User ${id}`,
    role: options.role ?? 'TECHNICIAN',
    phone: options.phone ?? '+5491100000000',
    email: options.email ?? `${id}@test.com`,
    isActive: options.isActive ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createMockOwner(options: MockUserOptions = {}): User {
  return createMockUser({ ...options, role: 'OWNER' });
}

export function createMockDispatcher(options: MockUserOptions = {}): User {
  return createMockUser({ ...options, role: 'DISPATCHER' });
}

export function createMockTechnician(options: MockUserOptions = {}): User {
  return createMockUser({ ...options, role: 'TECHNICIAN' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK ORGANIZATION FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export interface MockOrganizationOptions {
  id?: string;
  name?: string;
  cuit?: string;
  subscriptionTier?: SubscriptionTier;
}

let orgIdCounter = 1;

export function createMockOrganization(options: MockOrganizationOptions = {}): Organization {
  const id = options.id ?? `org-${orgIdCounter++}`;
  return {
    id,
    name: options.name ?? `Test Organization ${id}`,
    cuit: options.cuit ?? '30-12345678-9',
    afipConfigured: false,
    mpConfigured: false,
    whatsappConfigured: false,
    settings: {
      defaultInvoiceType: 'B',
      autoInvoice: false,
      defaultPaymentTerms: 30,
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'ARS',
    },
    createdAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK CUSTOMER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export interface MockCustomerOptions {
  id?: string;
  name?: string;
  orgId?: string;
  phone?: string;
  email?: string;
  cuit?: string;
}

let customerIdCounter = 1;

export function createMockCustomer(options: MockCustomerOptions = {}): Customer {
  const id = options.id ?? `customer-${customerIdCounter++}`;
  return {
    id,
    orgId: options.orgId ?? 'org-1',
    name: options.name ?? `Test Customer ${id}`,
    phone: options.phone ?? '+5491100000001',
    email: options.email ?? `${id}@customer.test.com`,
    cuit: options.cuit,
    ivaCondition: 'consumidor_final',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK JOB FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export interface MockJobOptions {
  id?: string;
  orgId?: string;
  customerId?: string;
  assignedToId?: string;
  status?: JobStatus;
  priority?: JobPriority;
  serviceType?: string;
  description?: string;
  address?: string;
  scheduledDate?: string;
  scheduledTimeStart?: string;
  scheduledTimeEnd?: string;
}

let jobIdCounter = 1;

export function createMockJob(options: MockJobOptions = {}): Job {
  const id = options.id ?? `job-${jobIdCounter++}`;
  return {
    id,
    orgId: options.orgId ?? 'org-1',
    jobNumber: `J-${String(jobIdCounter).padStart(6, '0')}`,
    customerId: options.customerId ?? 'customer-1',
    serviceType: options.serviceType ?? 'Plomería',
    status: options.status ?? 'PENDING',
    priority: options.priority ?? 'normal',
    description: options.description ?? 'Test job description',
    address: options.address ?? '123 Test Street, Buenos Aires',
    assignedToId: options.assignedToId,
    scheduledDate: options.scheduledDate,
    scheduledTimeStart: options.scheduledTimeStart,
    scheduledTimeEnd: options.scheduledTimeEnd,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK AUTH CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export interface MockAuthContext {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  organizationId: string | null;
}

export function createMockAuthContext(user: User | null = null): MockAuthContext {
  return {
    user,
    isAuthenticated: !!user,
    isLoading: false,
    organizationId: user?.orgId ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK FETCH HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function mockFetchSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data, meta }),
  } as Response);
}

export function mockFetchError(code: string, message: string, status: number = 400) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ success: false, error: { code, message } }),
  } as Response);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESET HELPERS (for test isolation)
// ═══════════════════════════════════════════════════════════════════════════════

export function resetFactoryCounters() {
  userIdCounter = 1;
  orgIdCounter = 1;
  customerIdCounter = 1;
  jobIdCounter = 1;
}
