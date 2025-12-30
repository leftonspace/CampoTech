# Architecture Documentation Update Summary

## Overview
The architecture documentation has been comprehensively updated to align with the current codebase state, specifically addressing:
1.  **Refactoring of User Roles**: Consolidation of `dispatcher` and `accountant` into `admin`, and standardization of the `owner`, `admin`, `technician` roles.
2.  **Removal of Customer Portal**: Complete removal of the "Customer Portal" application (Phase 13), including its endpoints, flows, capabilities, and detailed designs.

## Updates by File

### 1. `campotech-architecture-complete.md`
*   **User Roles**: Updated role definitions to remove 'Dispatcher' and 'Accountant'. Refined 'Admin' permissions.
*   **Modules**: Removed "Customer Portal" module section.
*   **Diagrams**: Updated text diagrams to exclude portal components.

### 2. `campotech-complete-system-architecture.md`
*   **System Context**: Removed Customer Portal from high-level system diagrams.
*   **Security & Auth**: Updated Role-Based Access Control (RBAC) matrix to reflect the 3-role system (`owner`, `admin`, `technician`).

### 3. `campotech-database-schema-complete.md`
*   **Enums**: Updated `user_role_enum` to `('owner', 'admin', 'technician')`.
*   **ERD**: Removed relationships/tables specific to the portal (if any were explicitly detailed as exclusive to it, though core tables like `customers` remain).

### 4. `campotech-end-to-end-flows.md`
*   **Removed Flow H**: Completely removed "Flow H: Customer Portal Journey".
*   **Diagram Updates**: Removed "Customer Portal" participant from Invoice Delivery and other cross-functional diagrams.

### 5. `capabilities.md`
*   **Domain Capabilities**: Removed `customer_portal` flag.
*   **UI Capabilities**: Removed `whitelabel_portal` flag.
*   **Fallbacks**: Deleted fallback behavior definitions for the portal.
*   **Dependency Graph**: Removed portal nodes.

### 6. `campotech-openapi-spec.yaml`
*   **Tags**: Removed `CustomerPortal` tag.
*   **Endpoints**: Deleted all `/portal/*` endpoints (Magic Link, OTP, Dashboard, Invoices, Support).
*   **Enums**: Updated `UserRole` schema to match the code (`owner`, `admin`, `technician`).

## Conclusion
The architecture documentation now accurately reflects the "Kill-Switch" implementation plan and the decision to simplify the product by removing the dedicated customer portal app in favor of distinct mobile apps (Technician/Consumer) and administrative tools. Use these updated documents as the source of truth for all future development.
