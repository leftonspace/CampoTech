'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  Building,
  FileCheck,
  CreditCard,
  Users,
  DollarSign,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';

interface SettingCard {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  status?: 'configured' | 'not_configured' | 'warning';
  adminOnly?: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const settingCards: SettingCard[] = [
    {
      title: 'Organización',
      description: 'Datos de la empresa, CUIT, dirección',
      href: '/dashboard/settings/organization',
      icon: Building,
      status: 'configured',
    },
    {
      title: 'AFIP',
      description: 'Configuración de facturación electrónica',
      href: '/dashboard/settings/afip',
      icon: FileCheck,
      status: 'not_configured',
      adminOnly: true,
    },
    {
      title: 'MercadoPago',
      description: 'Conexión para recibir pagos',
      href: '/dashboard/settings/mercadopago',
      icon: CreditCard,
      status: 'configured',
      adminOnly: true,
    },
    {
      title: 'WhatsApp',
      description: 'Mensajería y notificaciones',
      href: '/dashboard/settings/whatsapp',
      icon: MessageCircle,
      status: 'not_configured',
      adminOnly: true,
    },
    {
      title: 'Equipo',
      description: 'Gestión de usuarios y roles',
      href: '/dashboard/settings/team',
      icon: Users,
      adminOnly: true,
    },
    {
      title: 'Lista de precios',
      description: 'Servicios y productos',
      href: '/dashboard/settings/pricebook',
      icon: DollarSign,
    },
  ];

  const filteredCards = settingCards.filter(
    (card) => !card.adminOnly || isAdmin
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500">Administra los ajustes de tu cuenta</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card flex items-start gap-4 p-4 transition-shadow hover:shadow-md"
          >
            <div className="rounded-lg bg-primary-100 p-3 text-primary-600">
              <card.icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900">{card.title}</h3>
                {card.status === 'configured' && (
                  <CheckCircle className="h-4 w-4 text-success-500" />
                )}
                {card.status === 'not_configured' && (
                  <AlertCircle className="h-4 w-4 text-warning-500" />
                )}
              </div>
              <p className="text-sm text-gray-500">{card.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
