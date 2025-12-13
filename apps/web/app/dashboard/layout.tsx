'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth, ProtectedRoute } from '@/lib/auth-context';
import { cn, getInitials } from '@/lib/utils';
import { MODULE_ACCESS, type UserRole, type ModuleAccess } from '@/lib/config/field-permissions';
import {
  TIER_GATED_MODULES,
  FEATURES,
  hasFeatureAccess,
  getMinimumTierForFeature,
  type FeatureId,
} from '@/lib/config/feature-flags';
import { type SubscriptionTier } from '@/lib/config/tier-limits';
import { TierUpgradeModal } from '@/components/upgrade/tier-upgrade-modal';
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
  Lock,
  Eye,
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

interface NavItemDef {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module: string;
}

const allNavigation: NavItemDef[] = [
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
  { name: 'Zonas', href: '/dashboard/locations', icon: MapPin, module: 'locations' },
  { name: 'WhatsApp', href: '/dashboard/whatsapp', icon: MessageCircle, module: 'whatsapp' },
  { name: 'Configuracion', href: '/dashboard/settings', icon: Settings, module: 'settings' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TIER NAME HELPER
// ═══════════════════════════════════════════════════════════════════════════════

const TIER_NAMES: Record<SubscriptionTier, string> = {
  FREE: 'Gratis',
  BASICO: 'Basico',
  PROFESIONAL: 'Profesional',
  EMPRESARIAL: 'Empresarial',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get role access level for a module
 */
function getRoleAccess(module: string, role: UserRole): ModuleAccess {
  return MODULE_ACCESS[module]?.[role] || 'hidden';
}

/**
 * Check if module is tier-locked
 */
function isModuleTierLocked(module: string, tier: SubscriptionTier): boolean {
  const feature = TIER_GATED_MODULES[module];
  if (!feature) return false;
  return !hasFeatureAccess(tier, feature);
}

/**
 * Get required tier name for a module
 */
function getModuleRequiredTier(module: string): string {
  const feature = TIER_GATED_MODULES[module];
  if (!feature) return '';
  const minTier = getMinimumTierForFeature(feature);
  return minTier ? TIER_NAMES[minTier] : '';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    moduleName?: string;
    feature?: FeatureId;
  }>({ isOpen: false });
  const notificationRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Get user role, defaulting to VIEWER if not set
  const userRole = useMemo(() => {
    return (user?.role?.toUpperCase() || 'VIEWER') as UserRole;
  }, [user?.role]);

  // Get organization's subscription tier, defaulting to FREE
  const subscriptionTier = useMemo(() => {
    return (user?.organization?.subscriptionTier || 'FREE') as SubscriptionTier;
  }, [user?.organization?.subscriptionTier]);

  // Build navigation with role and tier access info
  const navigation = useMemo(() => {
    return allNavigation
      .map((item) => {
        const roleAccess = getRoleAccess(item.module, userRole);
        const tierLocked = isModuleTierLocked(item.module, subscriptionTier);
        const requiredTier = getModuleRequiredTier(item.module);
        const feature = TIER_GATED_MODULES[item.module] as FeatureId | undefined;

        return {
          ...item,
          roleAccess,
          tierLocked,
          requiredTier,
          feature,
        };
      })
      // Filter out role-hidden items (they shouldn't show at all)
      .filter((item) => item.roleAccess !== 'hidden');
  }, [userRole, subscriptionTier]);

  // Handle clicking on a tier-locked item
  const handleLockedClick = (name: string, feature?: FeatureId) => {
    setUpgradeModal({
      isOpen: true,
      moduleName: name,
      feature,
    });
  };

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

                  // Tier-locked: Show lock icon, click opens upgrade modal
                  if (item.tierLocked) {
                    return (
                      <li key={item.name}>
                        <button
                          onClick={() => handleLockedClick(item.name, item.feature)}
                          className="group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-500 transition-colors"
                        >
                          <item.icon className="h-5 w-5" />
                          <span className="flex-1 text-left">{item.name}</span>
                          <Lock className="h-4 w-4 text-amber-500" />
                          {/* Tooltip */}
                          <div className="absolute left-full ml-2 hidden group-hover:block z-50">
                            <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              Disponible desde {item.requiredTier}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  }

                  // View-only access: Show eye icon badge
                  const isViewOnly = item.roleAccess === 'view' || item.roleAccess === 'own';

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary-50 text-primary-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        )}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="flex-1">{item.name}</span>
                        {isViewOnly && (
                          <>
                            <Eye className="h-4 w-4 text-gray-400" />
                            {/* Tooltip for view-only */}
                            <div className="absolute left-full ml-2 hidden group-hover:block z-50">
                              <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                {item.roleAccess === 'own' ? 'Solo datos propios' : 'Solo lectura'}
                              </div>
                            </div>
                          </>
                        )}
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

        {/* Upgrade Modal */}
        <TierUpgradeModal
          isOpen={upgradeModal.isOpen}
          onClose={() => setUpgradeModal({ isOpen: false })}
          feature={upgradeModal.feature}
          moduleName={upgradeModal.moduleName}
          currentTier={subscriptionTier}
        />
      </div>
    </ProtectedRoute>
  );
}
