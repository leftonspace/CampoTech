/**
 * Customers API v1 - Individual Customer
 * Re-exports handlers from main API with versioned path
 * 
 * Security Fix: MEDIUM-1 from Phase 6 Authorization Audit
 * - Uses withAuth wrapper for explicit authentication
 */
import { GET as baseGET, PUT as basePUT, DELETE as baseDELETE } from '@/app/api/customers/[id]/route';
import { withAuth } from '@/lib/middleware/with-auth';

export const GET = withAuth(baseGET);
export const PUT = withAuth(basePUT);
export const DELETE = withAuth(baseDELETE);
