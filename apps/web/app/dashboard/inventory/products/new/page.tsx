/**
 * New Product Page - Server Component with Role Guard
 * 
 * Security: Prevents URL bypassing by checking role server-side before render.
 * Only OWNER role can access this page.
 * 
 * Hardened: Feb 2026
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import NewProductForm from './NewProductForm';

export default async function NewProductPage() {
  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY: Server-side role verification
  // ═══════════════════════════════════════════════════════════════════════════
  const session = await getSession();

  if (!session) {
    redirect('/auth/signin');
  }

  // Only OWNER can access product creation
  if (session.role.toUpperCase() !== 'OWNER') {
    redirect('/dashboard');
  }

  return <NewProductForm />;
}
