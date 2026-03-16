'use client';

import Link from 'next/link';
import { Smartphone, Rocket, ArrowRight, Building2, CheckCircle2 } from 'lucide-react';
import { TIER_CONFIGS } from '@/lib/config/tier-limits';

/**
 * Mobile-Only Landing Page
 * ========================
 *
 * Phase 2.3: Friendly redirect page for TECHNICIAN users who attempt
 * to access the web dashboard. Technicians should use the mobile app.
 *
 * Contains two sections:
 * 1. Acceso Técnico — directs to mobile app download
 * 2. Upsell — converts blocked technicians into potential OWNER customers
 */

// Plan data from tier config (Inicial + Profesional only for upsell)
const UPSELL_PLANS = TIER_CONFIGS.filter(t => t.id === 'INICIAL' || t.id === 'PROFESIONAL').map(t => ({
  id: t.id,
  name: t.name,
  price: t.limits.priceDisplay,
  description: t.description,
}));

export default function MobileOnlyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="py-6 px-4 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-gray-900">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-md">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          CampoTech
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        {/* ─────────────────────────────────────────────────────────── */}
        {/* Section 1: Acceso Técnico (primary message)               */}
        {/* ─────────────────────────────────────────────────────────── */}
        <section className="w-full max-w-lg text-center mb-12">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg mb-6">
            <Smartphone className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Acceso para Técnicos
          </h1>

          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            CampoTech para técnicos está disponible en la{' '}
            <span className="font-semibold text-green-700">app móvil</span>.
            Descargala para recibir y gestionar tus órdenes de trabajo.
          </p>

          {/* App Download Links (placeholder until app is live) */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm"
              aria-label="Descargar en App Store"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.97 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
              </svg>
              App Store
            </a>
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm"
              aria-label="Descargar en Google Play"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
              </svg>
              Google Play
            </a>
          </div>

          {/* Admin/Owner fallback link */}
          <p className="text-sm text-gray-500">
            ¿Sos propietario o administrador?{' '}
            <Link
              href="/login"
              className="text-green-600 font-medium hover:text-green-700 hover:underline transition-colors"
            >
              Iniciá sesión aquí
            </Link>
          </p>
        </section>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* Section 2: Upsell — Own Business Conversion Funnel        */}
        {/* ─────────────────────────────────────────────────────────── */}
        <section className="w-full max-w-2xl">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Section header */}
            <div className="px-6 py-5 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    ¿Querés gestionar tu propio negocio?
                  </h2>
                  <p className="text-sm text-gray-600">
                    Conseguí nuevos clientes, gestioná trabajos, cobrá online
                  </p>
                </div>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="p-6">
              <div className="grid sm:grid-cols-3 gap-4">
                {/* Free Trial */}
                <div className="relative rounded-xl border-2 border-green-200 bg-green-50/50 p-5 flex flex-col">
                  <div className="absolute -top-3 left-4 px-2 py-0.5 bg-green-600 text-white text-xs font-bold rounded-full">
                    RECOMENDADO
                  </div>
                  <div className="text-2xl mb-1">🆓</div>
                  <h3 className="font-bold text-gray-900 mb-1">Prueba Gratis</h3>
                  <p className="text-sm text-gray-500 mb-3">21 días sin compromiso</p>
                  <div className="mt-auto">
                    <Link
                      href="/signup"
                      className="flex items-center justify-center gap-1 w-full py-2.5 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition-colors shadow-sm"
                    >
                      Empezar gratis
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Dynamic plans from config */}
                {UPSELL_PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col hover:border-green-300 hover:shadow-sm transition-all"
                  >
                    <div className="text-2xl mb-1">
                      {plan.id === 'INICIAL' ? '💼' : '🚀'}
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">
                      Plan {plan.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-1">{plan.description}</p>
                    <p className="text-lg font-bold text-green-700 mb-3">
                      {plan.price}
                    </p>
                    <div className="mt-auto">
                      <Link
                        href={`/signup?plan=${plan.id.toLowerCase()}`}
                        className="flex items-center justify-center gap-1 w-full py-2.5 border border-green-600 text-green-700 rounded-lg font-medium text-sm hover:bg-green-50 transition-colors"
                      >
                        Suscribirme
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Benefits summary */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase mb-3">
                  Incluido en todos los planes
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Panel de control web',
                    'Gestión de clientes',
                    'Agenda y calendario',
                    'Seguimiento de trabajos',
                  ].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      {benefit}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} CampoTech — Sistema de Gestión para Servicios de Campo
      </footer>
    </div>
  );
}
