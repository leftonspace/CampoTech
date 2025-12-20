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
import { TrialBannerWithFetch } from '@/components/billing/TrialBanner';
import { AccessBanner } from '@/components/access';
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
  MapPin,
  Calendar,
  Truck,
  Package,
  UsersRound,
  Lock,
  Eye,
  Clock,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Wrench,
  User,
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
  { name: 'Panel', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { name: 'Mapa', href: '/dashboard/map', icon: MapPin, module: 'map' },
  { name: 'Agenda', href: '/dashboard/calendar', icon: Calendar, module: 'calendar' },
  { name: 'Trabajos', href: '/dashboard/jobs', icon: Briefcase, module: 'jobs' },
  { name: 'Clientes', href: '/dashboard/customers', icon: Users, module: 'customers' },
  { name: 'Equipo', href: '/dashboard/team', icon: UsersRound, module: 'team' },
  { name: 'Vehículos', href: '/dashboard/fleet', icon: Truck, module: 'fleet' },
  { name: 'Inventario', href: '/dashboard/inventory', icon: Package, module: 'inventory' },
  { name: 'Facturas', href: '/dashboard/invoices', icon: FileText, module: 'invoices' },
  { name: 'Pagos', href: '/dashboard/payments', icon: CreditCard, module: 'payments' },
  { name: 'Análisis', href: '/dashboard/analytics/overview', icon: BarChart3, module: 'analytics' },
  { name: 'Zonas', href: '/dashboard/locations', icon: MapPin, module: 'locations' },
  { name: 'WhatsApp', href: '/dashboard/whatsapp', icon: MessageCircle, module: 'whatsapp' },
];

const bottomNavigation: NavItemDef[] = [
  { name: 'Configuración', href: '/dashboard/settings', icon: Settings, module: 'settings' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TIER NAME HELPER
// ═══════════════════════════════════════════════════════════════════════════════

const TIER_NAMES: Record<SubscriptionTier, string> = {
  FREE: 'Gratis',
  INICIAL: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESA: 'Empresa',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getRoleAccess(module: string, role: UserRole): ModuleAccess {
  return MODULE_ACCESS[module]?.[role] || 'hidden';
}

function isModuleTierLocked(module: string, tier: SubscriptionTier): boolean {
  const feature = TIER_GATED_MODULES[module];
  if (!feature) return false;
  return !hasFeatureAccess(tier, feature);
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    moduleName?: string;
    feature?: FeatureId;
  }>({ isOpen: false });
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const userRole = useMemo(() => {
    return (user?.role?.toUpperCase() || 'TECHNICIAN') as UserRole;
  }, [user?.role]);

  const subscriptionTier = useMemo(() => {
    return (user?.organization?.subscriptionTier || 'FREE') as SubscriptionTier;
  }, [user?.organization?.subscriptionTier]);

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
      .filter((item) => item.roleAccess !== 'hidden');
  }, [userRole, subscriptionTier]);

  const bottomNav = useMemo(() => {
    return bottomNavigation.map((item) => {
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
    });
  }, [userRole, subscriptionTier]);

  const handleLockedClick = (name: string, feature?: FeatureId) => {
    setUpgradeModal({
      isOpen: true,
      moduleName: name,
      feature,
    });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href: string) => {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  };

  const renderNavItem = (item: typeof navigation[0], index: number) => {
    const active = isActive(item.href);

    if (item.tierLocked) {
      return (
        <button
          key={item.name}
          onClick={() => handleLockedClick(item.name, item.feature)}
          className="group relative flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent transition-all duration-200"
        >
          <item.icon className="w-5 h-5 shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left truncate animate-fade-in">{item.name}</span>
              <Lock className="w-4 h-4 text-accent shrink-0" />
            </>
          )}
        </button>
      );
    }

    const isViewOnly = item.roleAccess === 'view' || item.roleAccess === 'own';

    return (
      <Link
        key={item.name}
        href={item.href}
        className={cn(
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
          active
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )}
        onClick={() => setSidebarOpen(false)}
        style={{ animationDelay: `${index * 30}ms` }}
      >
        <item.icon className={cn('w-5 h-5 shrink-0', active && 'animate-scale-in')} />
        {!sidebarCollapsed && (
          <>
            <span className="flex-1 truncate animate-fade-in">{item.name}</span>
            {isViewOnly && <Eye className="w-4 h-4 text-sidebar-foreground/50 shrink-0" />}
          </>
        )}
      </Link>
    );
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex w-full bg-background">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Fixed position, stays locked to viewport */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex flex-col gradient-dark border-r border-sidebar-border transition-all duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            sidebarCollapsed ? 'w-[70px]' : 'w-[260px]'
          )}
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-glow shrink-0">
                <Wrench className="w-5 h-5 text-primary-foreground" />
              </div>
              {!sidebarCollapsed && (
                <span className="text-lg font-semibold text-sidebar-foreground animate-fade-in">
                  CampoTech
                </span>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navigation.map((item, index) => renderNavItem(item, index))}
          </nav>

          {/* Bottom Section */}
          <div className="py-4 px-3 border-t border-sidebar-border space-y-1">
            {bottomNav.map((item, index) => renderNavItem(item, index))}

            {/* Collapse Button - Desktop only */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200 mt-2"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5 shrink-0" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5 shrink-0" />
                  <span>Colapsar</span>
                </>
              )}
            </button>

            {/* User section */}
            <div className="pt-2 mt-2 border-t border-sidebar-border">
              <div className={cn('flex items-center gap-3', sidebarCollapsed && 'justify-center')}>
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-sm font-semibold text-primary-foreground shrink-0">
                  {user ? getInitials(user.name) : '?'}
                </div>
                {!sidebarCollapsed && (
                  <>
                    <div className="flex-1 min-w-0 animate-fade-in">
                      <p className="truncate text-sm font-medium text-sidebar-foreground">
                        {user?.name}
                      </p>
                      <p className="truncate text-xs text-sidebar-foreground/60 capitalize">
                        {user?.role}
                      </p>
                    </div>
                    <button
                      onClick={logout}
                      className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
                      title="Cerrar sesión"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main content area - offset by sidebar width */}
        <div
          className={cn(
            'flex-1 flex flex-col min-h-screen transition-all duration-300',
            // On mobile, no margin (sidebar is overlay)
            // On desktop, margin matches sidebar width
            sidebarCollapsed ? 'lg:ml-[70px]' : 'lg:ml-[260px]'
          )}
        >
          {/* Header */}
          <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between sticky top-0 z-10">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Search */}
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Buscar trabajos, clientes..."
                className="w-full pl-10 h-10 bg-secondary border-0 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="flex-1 md:hidden" />

            {/* Right Section */}
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative rounded-md p-2 text-muted-foreground hover:bg-muted"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-medium">
                    3
                  </span>
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-card shadow-lg z-50 animate-scale-in">
                    <div className="border-b px-4 py-3">
                      <h3 className="font-medium text-foreground">Notificaciones</h3>
                    </div>
                    <div className="p-8 text-center">
                      <Bell className="mx-auto h-8 w-8 text-muted-foreground/30" />
                      <p className="mt-2 text-sm text-muted-foreground">No hay notificaciones</p>
                      <p className="text-xs text-muted-foreground/60">Las notificaciones aparecerán aquí</p>
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium">{user?.name || 'Usuario'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role || 'Usuario'}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground hidden md:block" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-card shadow-lg z-50 animate-scale-in">
                    <div className="px-4 py-3 border-b">
                      <p className="text-sm font-medium">Mi Cuenta</p>
                    </div>
                    <div className="p-1">
                      <Link
                        href="/dashboard/profile"
                        className="block px-3 py-2 text-sm rounded-md hover:bg-muted"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Perfil
                      </Link>
                      <Link
                        href="/dashboard/settings/billing"
                        className="block px-3 py-2 text-sm rounded-md hover:bg-muted"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Facturación
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        className="block px-3 py-2 text-sm rounded-md hover:bg-muted"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Configuración
                      </Link>
                    </div>
                    <div className="border-t p-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-3 py-2 text-sm rounded-md text-destructive hover:bg-destructive/10"
                      >
                        Cerrar Sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Trial Banner - Shows when organization is on trial */}
          <TrialBannerWithFetch />

          {/* Access Banner - Shows subscription/verification warnings or blocks */}
          <AccessBanner className="px-6 pt-4" />

          {/* Page content */}
          <main className="flex-1 overflow-auto p-6">{children}</main>
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
