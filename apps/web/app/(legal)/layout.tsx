/**
 * Legal Pages Layout
 * ==================
 *
 * Layout for public legal pages (privacy, terms, cookies).
 * These pages are accessible without authentication.
 */

import { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
