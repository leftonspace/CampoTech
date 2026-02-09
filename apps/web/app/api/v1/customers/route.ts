/**
 * Customers API v1
 * Re-exports handlers from main API with versioned path
 * 
 * Security Fix: MEDIUM-1 from Phase 6 Authorization Audit
 * - Uses withAuth wrapper for explicit authentication
 * - Defense-in-depth against accidental auth removal from base route
 */
import { GET as baseGET, POST as basePOST } from '@/app/api/customers/route';
import { withAuth } from '@/lib/middleware/with-auth';

export const GET = withAuth(baseGET);
export const POST = withAuth(basePOST);
