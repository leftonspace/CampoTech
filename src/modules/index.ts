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
export {
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
  CreateUserDTO,
  UpdateUserDTO,
} from './users';

// Customers
export {
  CustomerRepository,
  CustomerService,
  createCustomerRoutes,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CustomerFilters,
} from './customers';

// Jobs
export {
  JobRepository,
  JobService,
  createJobRoutes,
  CreateJobDTO,
  UpdateJobDTO,
  JobFilters,
} from './jobs';

// Invoices
export {
  InvoiceRepository,
  InvoiceService,
  createInvoiceRoutes,
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
  AuditAction,
  AuditEntityType,
  CreateAuditLogDTO,
  AuditFilters,
  AuditIntegrityResult,
} from './audit';
