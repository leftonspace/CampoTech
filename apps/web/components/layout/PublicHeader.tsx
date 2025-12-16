'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Menu, X } from 'lucide-react';
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
 * - NOT logged in: Shows "Iniciar Sesión" and "Comenzar" buttons
 * - IS logged in: Shows "Ir al Dashboard" button
 */
export function PublicHeader({ navLinks = [] }: PublicHeaderProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-primary-600">
              CampoTech
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </a>
            ))}

            {isLoading ? (
              <div className="h-10 w-24 animate-pulse rounded-md bg-gray-200" />
            ) : isAuthenticated ? (
              <Link href="/dashboard" className="btn-primary">
                Ir al Dashboard
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="btn-ghost">
                  Iniciar Sesión
                </Link>
                <Link href="/signup" className="btn-primary">
                  Comenzar
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden rounded-md p-2 text-gray-500 hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}

              {isLoading ? (
                <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
              ) : isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="btn-primary w-full text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Ir al Dashboard
                </Link>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/login"
                    className="btn-outline w-full text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Iniciar Sesión
                  </Link>
                  <Link
                    href="/signup"
                    className="btn-primary w-full text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Comenzar
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
