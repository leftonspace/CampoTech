'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Menu, X, Zap } from 'lucide-react';
import { useState } from 'react';

interface NavLink {
  label: string;
  href: string;
}

interface PublicHeaderProps {
  /**
   * Optional navigation links for the header
   */
  navLinks?: NavLink[];
}

/**
 * Public Header Component
 * =======================
 *
 * Displays auth-aware navigation:
 * - NOT logged in: Shows "Iniciar Sesión" and "Probar Gratis" buttons
 * - IS logged in: Shows "Ir al Dashboard" button
 */
export function PublicHeader({ navLinks = [] }: PublicHeaderProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <Link href="/" className="text-xl font-bold text-foreground">
              CampoTech
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
            ) : isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Ir al Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Probar Gratis
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}

              {isLoading ? (
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              ) : isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Ir al Dashboard
                </Link>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors w-full"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Iniciar Sesión
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Probar Gratis
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
