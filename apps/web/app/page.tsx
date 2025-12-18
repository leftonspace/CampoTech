'use client';

import Link from 'next/link';
import { PublicHeader, PublicFooter } from '@/components/layout';
import {
  Briefcase,
  FileText,
  MessageCircle,
  Package,
  BarChart3,
  MapPin,
  Check,
  X,
  Smartphone,
  Zap,
  Shield,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES DATA
// ═══════════════════════════════════════════════════════════════════════════════

const features = [
  {
    name: 'Gestión de Trabajos',
    description: 'Creá, asigná y seguí trabajos en tiempo real. Control total de tu operación.',
    icon: Briefcase,
  },
  {
    name: 'Facturación AFIP',
    description: 'Factura electrónica integrada con AFIP. Cumplí con tus obligaciones fiscales sin esfuerzo.',
    icon: FileText,
  },
  {
    name: 'WhatsApp con IA',
    description: 'Atención automatizada 24/7. La IA responde consultas y agenda trabajos por vos.',
    icon: MessageCircle,
  },
  {
    name: 'Control de Inventario',
    description: 'Controlá el stock en depósitos y vehículos. Sabé qué materiales tiene cada técnico.',
    icon: Package,
  },
  {
    name: 'Analytics y Reportes',
    description: 'Métricas de rendimiento, ingresos y posición de mercado para tomar mejores decisiones.',
    icon: BarChart3,
  },
  {
    name: 'Seguimiento GPS',
    description: 'Ubicación en tiempo real de tus técnicos. Optimizá rutas y tiempos de llegada.',
    icon: MapPin,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING DATA
// ═══════════════════════════════════════════════════════════════════════════════

const pricing = [
  {
    name: 'Inicial',
    price: '$25',
    description: 'Para trabajadores independientes',
    features: [
      '1 usuario',
      '50 trabajos/mes',
      'App técnico',
      'Facturación AFIP',
      'Inventario básico',
      'WhatsApp manual',
    ],
    notIncluded: ['Reportes de voz', 'Analytics', 'WhatsApp con IA'],
    cta: 'Comenzar',
    popular: false,
  },
  {
    name: 'Profesional',
    price: '$55',
    description: 'Para pequeñas empresas (2-5 empleados)',
    features: [
      '5 usuarios',
      '200 trabajos/mes',
      'App técnico',
      'Facturación AFIP',
      'Inventario completo',
      'WhatsApp + IA (100 conv/mes)',
      'Reportes de voz',
      'Analytics básico',
    ],
    notIncluded: [],
    cta: 'Comenzar',
    popular: true,
  },
  {
    name: 'Empresa',
    price: '$120',
    description: 'Para empresas medianas (6+ empleados)',
    features: [
      'Usuarios ilimitados',
      'Trabajos ilimitados',
      'App técnico',
      'Facturación AFIP',
      'Inventario completo',
      'WhatsApp + IA ilimitado',
      'Reportes de voz',
      'Analytics avanzado',
      'Soporte prioritario',
    ],
    notIncluded: [],
    cta: 'Comenzar',
    popular: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION LINKS
// ═══════════════════════════════════════════════════════════════════════════════

const navLinks = [
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Precios', href: '#precios' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HERO SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 bg-gradient-to-b from-primary-50 to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Organizá tu negocio de servicios{' '}
            <span className="text-primary-600">como un profesional</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Gestioná trabajos, técnicos, facturas y clientes desde una sola plataforma.
            Con WhatsApp integrado e IA que atiende por vos las 24 horas.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="btn-primary text-base px-8 py-3 h-auto"
            >
              Comenzar gratis
            </Link>
            <a
              href="#funcionalidades"
              className="btn-outline text-base px-8 py-3 h-auto"
            >
              Ver funcionalidades
            </a>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary-500" />
              <span>App para técnicos</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary-500" />
              <span>Facturación AFIP</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary-500" />
              <span>100% seguro</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-20 sm:py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Todo lo que necesitás para tu negocio
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Herramientas diseñadas para empresas de servicios en Argentina
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.name}
              className="relative rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.name}</h3>
              <p className="mt-2 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function PricingSection() {
  return (
    <section id="precios" className="py-20 sm:py-24 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Planes simples, sin sorpresas
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Elegí el plan que mejor se adapte a tu negocio. Podés cambiar en cualquier momento.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {pricing.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl bg-white p-8 shadow-sm flex flex-col ${
                plan.popular
                  ? 'ring-2 ring-primary-500 shadow-lg'
                  : 'border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-primary-500 px-4 py-1 text-sm font-medium text-white">
                    Más popular
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500">/mes</span>
                </div>
              </div>

              <ul className="mt-8 space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-success-500" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
                {plan.notIncluded.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-gray-400">
                    <X className="h-5 w-5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-8 block w-full text-center py-3 px-4 rounded-lg font-medium transition-colors ${
                  plan.popular
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Todos los planes incluyen: Soporte por WhatsApp, actualizaciones y backup de datos.
          <br />
          Precios en USD. Facturamos en pesos argentinos al tipo de cambio del día.
        </p>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CTA SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function CTASection() {
  return (
    <section className="py-20 sm:py-24 bg-primary-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Empezá a organizar tu negocio hoy
        </h2>
        <p className="mt-4 text-lg text-primary-100">
          Unite a las empresas de servicios que ya usan CampoTech para crecer.
        </p>
        <div className="mt-8">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-3 text-base font-medium text-primary-600 hover:bg-primary-50 transition-colors"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader navLinks={navLinks} />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <CTASection />
      </main>
      <PublicFooter />
    </div>
  );
}
