'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth, ProtectedRoute } from '@/lib/auth-context';
import { cn, getInitials } from '@/lib/utils';
import { MODULE_ACCESS, type UserRole } from '@/lib/config/field-permissions';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  MessageCircle,
  BarChart3,
  Building2,
  MapPin,
  Calendar,
  Truck,
  Package,
  UsersRound,
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';

// Navigation items with module mapping for access control
const allNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { name: 'Mapa', href: '/dashboard/map', icon: MapPin, module: 'map' },
  { name: 'Calendario', href: '/dashboard/calendar', icon: Calendar, module: 'calendar' },
  { name: 'Trabajos', href: '/dashboard/jobs', icon: Briefcase, module: 'jobs' },
  { name: 'Clientes', href: '/dashboard/customers', icon: Users, module: 'customers' },
  { name: 'Flota', href: '/dashboard/fleet', icon: Truck, module: 'fleet' },
  { name: 'Inventario', href: '/dashboard/inventory', icon: Package, module: 'inventory' },
  { name: 'Equipo', href: '/dashboard/settings/team', icon: UsersRound, module: 'team' },
  { name: 'Facturas', href: '/dashboard/invoices', icon: FileText, module: 'invoices' },
  { name: 'Pagos', href: '/dashboard/payments', icon: CreditCard, module: 'payments' },
  { name: 'Analytics', href: '/dashboard/analytics/overview', icon: BarChart3, module: 'analytics' },
  { name: 'Sucursales', href: '/dashboard/locations', icon: Building2, module: 'locations' },
  { name: 'WhatsApp', href: '/dashboard/whatsapp', icon: MessageCircle, module: 'whatsapp' },
  { name: 'Configuracion', href: '/dashboard/settings', icon: Settings, module: 'settings' },
];

// Helper to check if module is accessible for a role
function canAccessModule(module: string, role: UserRole): boolean {
  const access = MODULE_ACCESS[module]?.[role];
  return access !== undefined && access !== 'hidden';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Get user role, defaulting to VIEWER if not set
  const userRole = useMemo(() => {
    return (user?.role?.toUpperCase() || 'VIEWER') as UserRole;
  }, [user?.role]);

  // Filter navigation based on user role
  const navigation = useMemo(() => {
    return allNavigation.filter((item) => canAccessModule(item.module, userRole));
  }, [userRole]);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-gray-100">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-lg transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Link href="/dashboard" className="text-xl font-bold text-primary-600">
                CampoTech
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-1">
                {navigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href));

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary-50 text-primary-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        )}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>

            </nav>

            {/* User section */}
            <div className="border-t p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600 font-medium">
                  {user ? getInitials(user.name) : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-gray-500 capitalize">
                    {user?.role}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="flex-1" />

            <div className="relative flex items-center gap-2" ref={notificationRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <Bell className="h-5 w-5" />
              </button>

              {/* Notifications dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-white shadow-lg z-50">
                  <div className="border-b px-4 py-3">
                    <h3 className="font-medium text-gray-900">Notificaciones</h3>
                  </div>
                  <div className="p-8 text-center">
                    <Bell className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No hay notificaciones</p>
                    <p className="text-xs text-gray-400">Las notificaciones aparecerán aquí</p>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
