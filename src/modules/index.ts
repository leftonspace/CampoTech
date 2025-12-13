/**
 * Module Exports
 * ==============
 *
 * Central export for all domain modules.
 */

// Organizations
export {
  OrganizationRepository,
  OrganizationService,
} from './organizations/organization.repository';
export type {
  CreateOrganizationDTO,
  UpdateOrganizationDTO,
  AFIPConfigDTO,
  OrganizationFilters,
} from './organizations/organization.types';
export { default as organizationRoutes } from './organizations/organization.routes';

// Users
export {
  UserRepository,
  UserService,
  createUserRoutes,
  ROLE_PERMISSIONS,
  hasPermission,
} from './users';
export type {
  CreateUserDTO,
  UpdateUserDTO,
} from './users';

// Customers
export {
  CustomerRepository,
  CustomerService,
  createCustomerRoutes,
} from './customers';
export type {
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CustomerFilters,
} from './customers';

// Jobs
export {
  JobRepository,
  JobService,
  createJobRoutes,
} from './jobs';
export type {
  CreateJobDTO,
  UpdateJobDTO,
  JobFilters,
} from './jobs';

// Invoices
export {
  InvoiceRepository,
  InvoiceService,
  createInvoiceRoutes,
} from './invoices';
export type {
  CreateInvoiceDTO,
  CreateInvoiceLineItemDTO,
  InvoiceFilters,
  IssueCAEResult,
} from './invoices';

// Payments
export {
  PaymentRepository,
  PaymentService,
  createPaymentRoutes,
} from './payments';
export type {
  CreatePaymentDTO,
  RefundPaymentDTO,
  PaymentFilters,
} from './payments';

// Price Book
export {
  CategoryRepository,
  PriceBookItemRepository,
  PriceBookService,
  createPriceBookRoutes,
} from './pricebook';
export type {
  PriceBookCategory,
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CreatePriceBookItemDTO,
  UpdatePriceBookItemDTO,
  PriceBookFilters,
} from './pricebook';

// Audit
export {
  AuditRepository,
  AuditService,
  createAuditRoutes,
  createAuditMiddleware,
  calculateAuditHash,
  verifyAuditEntry,
} from './audit';
export type {
  AuditAction,
  AuditEntityType,
  CreateAuditLogDTO,
  AuditFilters,
  AuditIntegrityResult,
} from './audit';
