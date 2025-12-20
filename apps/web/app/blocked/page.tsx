'use client';

/**
 * Blocked Page
 * ============
 *
 * Displayed when a user is hard-blocked from accessing the platform.
 * Shows the reason for the block and actions to resolve it.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { XCircle, AlertTriangle, CreditCard, FileCheck, Shield, ArrowRight, Phone, Mail, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface BlockReason {
  code: string;
  type: 'subscription' | 'verification' | 'compliance';
  severity: 'warning' | 'soft_block' | 'hard_block';
  message: string;
  actionRequired: string;
  actionUrl?: string;
}

interface AccessStatus {
  canAccessDashboard: boolean;
  blockReasons: BlockReason[];
  isHardBlocked: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TYPE_ICONS = {
  subscription: CreditCard,
  verification: FileCheck,
  compliance: Shield,
};

const TYPE_LABELS = {
  subscription: 'Problema de Suscripción',
  verification: 'Verificación Pendiente',
  compliance: 'Cumplimiento',
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function BlockedPage() {
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch access status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/access/status');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al obtener estado');
        }

        setAccessStatus(data);
      } catch (err) {
        console.error('[Blocked] Error fetching status:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, []);

  // Get hard block reasons
  const hardBlocks = accessStatus?.blockReasons.filter(
    (r) => r.severity === 'hard_block'
  ) || [];

  // Get primary block reason
  const primaryBlock = hardBlocks[0];

  // ─────────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR STATE
  // ─────────────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Error de Acceso
          </h1>
          <p className="mt-2 text-gray-600">{error}</p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Iniciar sesión
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NOT BLOCKED STATE
  // ─────────────────────────────────────────────────────────────────────────────

  if (!accessStatus?.isHardBlocked || hardBlocks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto">
            <FileCheck className="h-8 w-8 text-success-600" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Acceso Restaurado
          </h1>
          <p className="mt-2 text-gray-600">
            Tu cuenta ya no tiene restricciones. Podés continuar usando la plataforma.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Ir al Panel
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BLOCKED STATE
  // ─────────────────────────────────────────────────────────────────────────────

  const PrimaryIcon = primaryBlock ? TYPE_ICONS[primaryBlock.type] : XCircle;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-lg">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-white">
              Acceso Suspendido
            </h1>
            <p className="mt-2 text-gray-300">
              Tu cuenta tiene restricciones que impiden el acceso a la plataforma.
            </p>
          </div>

          {/* Block Reasons */}
          <div className="p-6 space-y-4">
            {hardBlocks.map((block) => {
              const Icon = TYPE_ICONS[block.type];
              return (
                <div
                  key={block.code}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-red-600 uppercase tracking-wide">
                        {TYPE_LABELS[block.type]}
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {block.message}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {block.actionRequired}
                      </p>
                      {block.actionUrl && (
                        <Link
                          href={block.actionUrl}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                          Resolver
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Help Section */}
          <div className="px-6 py-4 bg-gray-50 border-t">
            <p className="text-sm text-gray-600 text-center">
              ¿Necesitás ayuda? Contactanos:
            </p>
            <div className="mt-3 flex items-center justify-center gap-4">
              <a
                href="mailto:soporte@campotech.com.ar"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600"
              >
                <Mail className="h-4 w-4" />
                soporte@campotech.com.ar
              </a>
              <a
                href="https://wa.me/5491112345678"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600"
              >
                <Phone className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          Si creés que esto es un error, por favor contactanos inmediatamente.
        </p>
      </div>
    </div>
  );
}
