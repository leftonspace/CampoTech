/**
 * Admin Role Definitions
 * ======================
 * 
 * Defines the role types for administrative users in the CampoTech platform.
 * These roles are separate from tenant roles (OWNER, DISPATCHER, TECHNICIAN).
 * 
 * Security Fix: INFO-1 from Phase 6 Authorization Audit
 * - Formally defines and documents admin role types
 * - Provides permission checking utilities
 * 
 * IMPORTANT: Admin roles are platform-level privileges and are NOT related
 * to tenant organization roles. Admin authentication is handled separately
 * via the admin panel (`apps/admin`).
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROLE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Admin roles for platform-level administration.
 * Each role has progressively more limited access.
 */
export enum AdminRole {
    /**
     * PLATFORM_ADMIN: Full access to all platform features
     * - Can manage all organizations
     * - Can modify platform settings
     * - Can access all admin modules
     * - Can manage other admin users
     */
    PLATFORM_ADMIN = 'PLATFORM_ADMIN',

    /**
     * BILLING_ADMIN: Access to subscription and billing management
     * - Can view and modify subscriptions
     * - Can process refunds
     * - Can access billing reports
     * - Cannot modify platform settings
     */
    BILLING_ADMIN = 'BILLING_ADMIN',

    /**
     * TRUST_ADMIN: Access to verification and compliance
     * - Can review verification submissions
     * - Can approve/reject business registrations
     * - Can manage compliance requirements
     * - Cannot access billing data
     */
    TRUST_ADMIN = 'TRUST_ADMIN',

    /**
     * SUPPORT_ADMIN: Read-only support access
     * - Can view organization details (for support tickets)
     * - Can view job and payment history
     * - Cannot modify any data
     * - Ideal for tier-1 support staff
     */
    SUPPORT_ADMIN = 'SUPPORT_ADMIN',
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION MATRIX
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Admin module access levels
 */
export type AdminModuleAccess = 'full' | 'limited' | 'view' | 'hidden';

/**
 * Admin modules in the platform
 */
export type AdminModule =
    | 'dashboard'
    | 'organizations'
    | 'subscriptions'
    | 'verifications'
    | 'exchange_rates'
    | 'inflation'
    | 'discounts'
    | 'admins'
    | 'audit_logs'
    | 'settings';

/**
 * Defines access levels for each admin role per module
 */
export const ADMIN_MODULE_ACCESS: Record<AdminModule, Record<AdminRole, AdminModuleAccess>> = {
    // Dashboard: All admins can view, only PLATFORM_ADMIN has full access
    dashboard: {
        [AdminRole.PLATFORM_ADMIN]: 'full',
        [AdminRole.BILLING_ADMIN]: 'limited',
        [AdminRole.TRUST_ADMIN]: 'limited',
        [AdminRole.SUPPORT_ADMIN]: 'view',
    },

    // Organizations: PLATFORM_ADMIN full, others can view for support purposes
    organizations: {
        [AdminRole.PLATFORM_ADMIN]: 'full',
        [AdminRole.BILLING_ADMIN]: 'limited', // Can modify subscription status
        [AdminRole.TRUST_ADMIN]: 'limited', // Can modify verification status
        [AdminRole.SUPPORT_ADMIN]: 'view',
    },

    // Subscriptions: PLATFORM_ADMIN and BILLING_ADMIN can manage
    subscriptions: {
        [AdminRole.PLATFORM_ADMIN]: 'full',
        [AdminRole.BILLING_ADMIN]: 'full',
        [AdminRole.TRUST_ADMIN]: 'hidden',
        [AdminRole.SUPPORT_ADMIN]: 'view',
    },

    // Verifications: PLATFORM_ADMIN and TRUST_ADMIN can manage
    verifications: {
        [AdminRole.PLATFORM_ADMIN]: 'full',
        [AdminRole.BILLING_ADMIN]: 'hidden',
        [AdminRole.TRUST_ADMIN]: 'full',
        [AdminRole.SUPPORT_ADMIN]: 'view',
    },

    // Exchange Rates: PLATFORM_ADMIN and BILLING_ADMIN can manage
    exchange_rates: {
        [AdminRole.PLATFORM_ADMIN]: 'full',
        [AdminRole.BILLING_ADMIN]: 'full',
        [AdminRole.TRUST_ADMIN]: 'hidden',
        [AdminRole.SUPPORT_ADMIN]: 'hidden',
    },

    // Inflation: PLATFORM_ADMIN and BILLING_ADMIN can manage
    inflation: {
        [AdminRole.PLATFORM_ADMIN]: 'full',
        [AdminRole.BILLING_ADMIN]: 'full',
        [AdminRole.TRUST_ADMIN]: 'hidden',
        [AdminRole.SUPPORT_ADMIN]: 'hidden',
    },

    // Discounts: PLATFORM_ADMIN and BILLING_ADMIN can manage
    discounts: {
        [AdminRole.PLATFORM_ADMIN]: 'full',
        [AdminRole.BILLING_ADMIN]: 'full',
        [AdminRole.TRUST_ADMIN]: 'hidden',
        [AdminRole.SUPPORT_ADMIN]: 'hidden',
    },

    // Admins: Only PLATFORM_ADMIN can manage other admins
    admins: {
        [AdminRole.PLATFORM_ADMIN]: 'full',
        [AdminRole.BILLING_ADMIN]: 'hidden',
        [AdminRole.TRUST_ADMIN]: 'hidden',
        [AdminRole.SUPPORT_ADMIN]: 'hidden',
    },

    // Audit Logs: PLATFORM_ADMIN full, TRUST_ADMIN can view for compliance
    audit_logs: {
        [AdminRole.PLATFORM_ADMIN]: 'full',
        [AdminRole.BILLING_ADMIN]: 'view',
        [AdminRole.TRUST_ADMIN]: 'view',
        [AdminRole.SUPPORT_ADMIN]: 'hidden',
    },

    // Settings: Only PLATFORM_ADMIN
    settings: {
        [AdminRole.PLATFORM_ADMIN]: 'full',
        [AdminRole.BILLING_ADMIN]: 'hidden',
        [AdminRole.TRUST_ADMIN]: 'hidden',
        [AdminRole.SUPPORT_ADMIN]: 'hidden',
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if an admin role can access a module
 */
export function canAccessModule(role: AdminRole, module: AdminModule): boolean {
    const access = ADMIN_MODULE_ACCESS[module]?.[role];
    return access !== 'hidden' && access !== undefined;
}

/**
 * Check if an admin role can modify in a module
 */
export function canModifyInModule(role: AdminRole, module: AdminModule): boolean {
    const access = ADMIN_MODULE_ACCESS[module]?.[role];
    return access === 'full' || access === 'limited';
}

/**
 * Check if an admin role has full access to a module
 */
export function hasFullAccess(role: AdminRole, module: AdminModule): boolean {
    return ADMIN_MODULE_ACCESS[module]?.[role] === 'full';
}

/**
 * Get all accessible modules for an admin role
 */
export function getAccessibleModules(role: AdminRole): AdminModule[] {
    const modules = Object.keys(ADMIN_MODULE_ACCESS) as AdminModule[];
    return modules.filter((m) => canAccessModule(role, m));
}

/**
 * Get the access level for a specific role and module
 */
export function getModuleAccess(role: AdminRole, module: AdminModule): AdminModuleAccess {
    return ADMIN_MODULE_ACCESS[module]?.[role] || 'hidden';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE INFO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Human-readable descriptions for admin roles
 */
export const ADMIN_ROLE_INFO: Record<AdminRole, { label: string; description: string }> = {
    [AdminRole.PLATFORM_ADMIN]: {
        label: 'Administrador de Plataforma',
        description: 'Acceso completo a todas las funciones administrativas',
    },
    [AdminRole.BILLING_ADMIN]: {
        label: 'Administrador de Facturación',
        description: 'Gestión de suscripciones, pagos y tarifas',
    },
    [AdminRole.TRUST_ADMIN]: {
        label: 'Administrador de Confianza',
        description: 'Gestión de verificaciones y cumplimiento',
    },
    [AdminRole.SUPPORT_ADMIN]: {
        label: 'Soporte Técnico',
        description: 'Acceso de solo lectura para atención al cliente',
    },
};

/**
 * Check if a string is a valid admin role
 */
export function isValidAdminRole(role: string): role is AdminRole {
    return Object.values(AdminRole).includes(role as AdminRole);
}
