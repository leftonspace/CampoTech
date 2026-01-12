'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { cn, getInitials, formatPhone } from '@/lib/utils';
import {
  Users,
  Plus,
  Calendar,
  Clock,
  Mail,
  Phone,
  Star,
  MoreHorizontal,
  Briefcase,
  X,
  Save,
  ShieldCheck,
  Wrench,
  Eye,
  Award,
  Trash2,
  AlertTriangle,
  MessageCircle,
  Upload,
  Image as ImageIcon,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import TeamCalendar from '@/components/schedule/TeamCalendar';
import ScheduleConfigModal from '@/components/schedule/ScheduleConfigModal';
import PhoneInput from '@/components/ui/PhoneInput';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TradeCertification {
  matricula: string;
  category: string;
}

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';
  // Legacy single specialty (for backwards compatibility)
  specialty?: string;
  matricula?: string;
  skillLevel?: string;
  // New multi-specialty structure
  specialties?: string[];
  certifications?: Record<string, TradeCertification>;
  avatar?: string;
  isActive: boolean;
  createdAt?: string;
  jobCount: number;
  avgRating: number | null;
  reviewCount: number;
  // Driver's license (for vehicle assignment)
  driverLicenseNumber?: string;
  driverLicenseExpiry?: string;
  driverLicenseCategory?: string;
  driverLicensePhotoFront?: string;
  driverLicensePhotoBack?: string;
}

interface TeamStats {
  totalEmployees: number;
  activeTechnicians: number;
  inProgressCount: number;
  averageRating: number;
}

type TabType = 'employees' | 'schedules' | 'availability' | 'my-schedule';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ROLE_CONFIG = {
  OWNER: {
    label: 'Dueño',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  DISPATCHER: {
    label: 'Despachador',
    color: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  TECHNICIAN: {
    label: 'Técnico',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
  },
};

// Live status configuration matching Standby business rules
const LIVE_STATUS_CONFIG = {
  // Priority 1: 🔴 Exception (Sick/Vacation)
  UNAVAILABLE: {
    label: 'No Disponible',
    emoji: '🔴',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  // Priority 2: ⚪ Outside hours or no schedule
  OFF_SHIFT: {
    label: 'Fuera de Turno',
    emoji: '⚪',
    color: 'bg-gray-100 text-gray-500 border-gray-200',
  },
  // Priority 3: 🟡 Has active IN_PROGRESS job
  BUSY: {
    label: 'Ocupado',
    emoji: '🟡',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  // Priority 4: 🟢 Within hours + no active job
  AVAILABLE: {
    label: 'Disponible',
    emoji: '🟢',
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  // Fallback for inactive users
  INACTIVE: {
    label: 'Inactivo',
    emoji: '⚫',
    color: 'bg-gray-200 text-gray-600 border-gray-300',
  },
};

// Trades that require professional licensing (matrícula) in Argentina
const REGULATED_TRADES = ['GASISTA', 'ELECTRICISTA', 'REFRIGERACION', 'CALEFACCIONISTA'];

// Human-readable labels for specialty codes
const SPECIALTY_LABELS: Record<string, string> = {
  GASISTA: 'Gasista',
  ELECTRICISTA: 'Electricista',
  PLOMERO: 'Plomero',
  CALEFACCIONISTA: 'Calefaccionista',
  REFRIGERACION: 'Refrigeración',
  ALBANIL: 'Albañil',
  PINTOR: 'Pintor',
  CARPINTERO: 'Carpintero',
  TECHISTA: 'Techista',
  HERRERO: 'Herrero',
  SOLDADOR: 'Soldador',
};

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lunes', short: 'LUN' },
  { id: 2, name: 'Martes', short: 'MAR' },
  { id: 3, name: 'Miércoles', short: 'MIÉ' },
  { id: 4, name: 'Jueves', short: 'JUE' },
  { id: 5, name: 'Viernes', short: 'VIE' },
  { id: 6, name: 'Sábado', short: 'SÁB' },
  { id: 0, name: 'Domingo', short: 'DOM' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('employees');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const userRole = user?.role?.toUpperCase() || 'TECHNICIAN';
  const isOwnerOrDispatcher = userRole === 'OWNER' || userRole === 'DISPATCHER';
  const isTechnician = userRole === 'TECHNICIAN';

  // Fetch team members (with includeInactive flag for archive view)
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-members', showInactive],
    queryFn: async () => {
      const url = showInactive ? '/api/users?includeInactive=true' : '/api/users';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error fetching team');
      return res.json();
    },
  });

  // Split members into active and inactive for display
  const allMembers = (teamData?.data as TeamMember[]) || [];
  const members = showInactive
    ? allMembers.filter(m => !m.isActive)
    : allMembers.filter(m => m.isActive !== false);

  // Fetch team stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['team-stats'],
    queryFn: async () => {
      const res = await fetch('/api/users/stats');
      if (!res.ok) {
        // Return mock data if endpoint doesn't exist
        return {
          success: true,
          data: {
            totalEmployees: members.length,
            activeTechnicians: members.filter(m => m.role === 'TECHNICIAN' && m.isActive).length,
            inProgressCount: 2,
            averageRating: 4.7,
          },
        };
      }
      return res.json();
    },
    enabled: members.length > 0,
  });

  const stats: TeamStats = statsData?.data || {
    totalEmployees: members.length,
    activeTechnicians: members.filter(m => m.role === 'TECHNICIAN' && m.isActive).length,
    inProgressCount: 2,
    averageRating: 4.7,
  };

  // Determine available tabs based on role
  const availableTabs = useMemo(() => {
    if (isTechnician) {
      return [
        { id: 'employees' as TabType, label: 'Lista de Empleados' },
        { id: 'my-schedule' as TabType, label: 'Mi Horario' },
      ];
    }
    return [
      { id: 'employees' as TabType, label: 'Lista de Empleados' },
      { id: 'schedules' as TabType, label: 'Horarios' },
      { id: 'availability' as TabType, label: 'Disponibilidad' },
    ];
  }, [isTechnician]);

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setShowAddModal(true);
  };

  const handleDeleteMember = (member: TeamMember) => {
    setDeletingMember(member);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMember) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deletingMember.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar');
      }

      // Refresh the team list
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      setDeletingMember(null);
    } catch (error) {
      console.error('Delete error:', error);
      // You could add toast notification here
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
          <p className="text-gray-500">Gestioná tu equipo de trabajo</p>
        </div>
        {isOwnerOrDispatcher && (
          <button
            onClick={() => {
              setEditingMember(null);
              setShowAddModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar Empleado
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Empleados"
          value={stats.totalEmployees}
          loading={statsLoading}
        />
        <StatCard
          title="Técnicos Activos"
          value={stats.activeTechnicians}
          color="teal"
          loading={statsLoading}
        />
        <StatCard
          title="En Trabajo Ahora"
          value={stats.inProgressCount}
          loading={statsLoading}
        />
        <StatCard
          title="Rating Promedio"
          value={stats.averageRating.toFixed(1)}
          icon={<Star className="h-5 w-5 text-amber-400 fill-amber-400" />}
          loading={statsLoading}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1" aria-label="Tabs">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium rounded-t-lg transition-colors',
                activeTab === tab.id
                  ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-px'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'employees' && (
          <>
            {/* Archive Filter Toggle */}
            {isOwnerOrDispatcher && (
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInactive(false)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                      !showInactive
                        ? "bg-teal-100 text-teal-700 border border-teal-200"
                        : "text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    Activos ({allMembers.filter(m => m.isActive !== false).length})
                  </button>
                  <button
                    onClick={() => setShowInactive(true)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                      showInactive
                        ? "bg-gray-200 text-gray-700 border border-gray-300"
                        : "text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    📁 Inactivos ({allMembers.filter(m => !m.isActive).length})
                  </button>
                </div>
                {showInactive && (
                  <p className="text-xs text-gray-500">
                    Vista de archivo • Los usuarios inactivos no pueden iniciar sesión
                  </p>
                )}
              </div>
            )}
            <EmployeeListTab
              members={members}
              loading={teamLoading}
              canEdit={isOwnerOrDispatcher}
              onEdit={handleEditMember}
              onDelete={handleDeleteMember}
              onCardClick={handleEditMember}
              currentUserId={user?.id}
            />
          </>
        )}

        {activeTab === 'schedules' && isOwnerOrDispatcher && (
          <WeeklySchedulesTab members={members} />
        )}

        {activeTab === 'availability' && isOwnerOrDispatcher && (
          <DisponibilidadTab canEdit={isOwnerOrDispatcher} members={members} />
        )}

        {activeTab === 'my-schedule' && isTechnician && (
          <MyScheduleTab userId={user?.id} />
        )}
      </div>

      {/* Unified Member Modal - Create/View/Edit */}
      {showAddModal && (
        <TeamMemberModal
          member={editingMember}
          currentUserId={user?.id}
          currentUserRole={userRole}
          onClose={() => {
            setShowAddModal(false);
            setEditingMember(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['team-members'] });
            queryClient.invalidateQueries({ queryKey: ['team-stats'] });
            setShowAddModal(false);
            setEditingMember(null);
          }}
          onDelete={handleDeleteMember}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingMember && (
        <DeleteConfirmationModal
          member={deletingMember}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingMember(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  title: string;
  value: string | number;
  color?: 'teal' | 'default';
  icon?: React.ReactNode;
  loading?: boolean;
}

function StatCard({ title, value, color = 'default', icon, loading }: StatCardProps) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {loading ? (
        <div className="h-8 w-16 animate-pulse rounded bg-gray-200 mt-1" />
      ) : (
        <div className="flex items-center gap-2 mt-1">
          <p className={cn(
            'text-2xl font-bold',
            color === 'teal' ? 'text-teal-600' : 'text-gray-900'
          )}>
            {value}
          </p>
          {icon}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE STATUS TYPE (from API) - Matches Standby business rules
// ═══════════════════════════════════════════════════════════════════════════════

type LiveStatusType = 'UNAVAILABLE' | 'OFF_SHIFT' | 'BUSY' | 'AVAILABLE';

interface UserLiveStatus {
  userId: string;
  status: LiveStatusType;
  statusLabel: string;
  statusColor: string;
  reason?: string;
  currentJobId?: string;
  jobNumber?: string;
  hasSchedule?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE LIST TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeeListTabProps {
  members: TeamMember[];
  loading: boolean;
  canEdit: boolean;
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
  onCardClick: (member: TeamMember) => void;
  currentUserId?: string;
}

function EmployeeListTab({ members, loading, canEdit, onEdit: _onEdit, onDelete, onCardClick, currentUserId }: EmployeeListTabProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Fetch live status for all users
  const { data: liveStatusData } = useQuery({
    queryKey: ['user-live-status'],
    queryFn: async () => {
      const res = await fetch('/api/users/live-status');
      if (!res.ok) return { success: false, data: { statuses: {} } };
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });

  const liveStatuses: Record<string, UserLiveStatus> = liveStatusData?.data?.statuses || {};

  // Get live status config for a member
  const getLiveStatusConfig = (memberId: string, isActive: boolean) => {
    if (!isActive) {
      return LIVE_STATUS_CONFIG.INACTIVE;
    }
    const liveStatus = liveStatuses[memberId];
    if (liveStatus) {
      return LIVE_STATUS_CONFIG[liveStatus.status] || LIVE_STATUS_CONFIG.AVAILABLE;
    }
    // Default to available if no status yet
    return LIVE_STATUS_CONFIG.AVAILABLE;
  };

  // Get status tooltip (for UNAVAILABLE shows reason, for BUSY shows job number)
  const getStatusTooltip = (memberId: string): string => {
    const liveStatus = liveStatuses[memberId];
    if (!liveStatus) return '';
    if (liveStatus.status === 'UNAVAILABLE' && liveStatus.reason) {
      return liveStatus.reason;
    }
    if (liveStatus.status === 'BUSY' && liveStatus.jobNumber) {
      return `Trabajo #${liveStatus.jobNumber}`;
    }
    return '';
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Users className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4 text-gray-500">No hay miembros en el equipo</p>
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => {
        const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.TECHNICIAN;
        const statusConfig = getLiveStatusConfig(member.id, member.isActive);
        const statusTooltip = getStatusTooltip(member.id);
        const isCurrentUser = member.id === currentUserId;

        return (
          <div
            key={member.id}
            className="card p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={(e) => {
              // Don't open modal if clicking on menu
              if ((e.target as HTMLElement).closest('.menu-container')) return;
              onCardClick(member);
            }}
          >
            {/* Header row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="h-12 w-12 rounded-full bg-teal-500 flex items-center justify-center text-white font-semibold text-lg">
                  {getInitials(member.name)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {member.name}
                    {isCurrentUser && (
                      <span className="ml-1 text-xs text-gray-400">(vos)</span>
                    )}
                  </h3>
                  {/* Role & Live Status Badges */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full border', roleConfig.color)}>
                      {roleConfig.label}
                    </span>
                    <span
                      className={cn('px-2 py-0.5 text-xs font-medium rounded-full border inline-flex items-center gap-1', statusConfig.color)}
                      title={statusTooltip}
                    >
                      <span>{statusConfig.emoji}</span>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu */}
              {canEdit && (
                <div className="relative menu-container">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === member.id ? null : member.id);
                    }}
                    className="p-1 rounded hover:bg-gray-100"
                  >
                    <MoreHorizontal className="h-5 w-5 text-gray-400" />
                  </button>
                  {menuOpen === member.id && (
                    <div className="absolute right-0 mt-1 w-40 bg-white border rounded-lg shadow-lg z-10">
                      <button
                        onClick={() => {
                          setMenuOpen(null);
                          onCardClick(member);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Ver Detalles
                      </button>
                      <button
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Calendar className="h-4 w-4" />
                        Ver Horario
                      </button>
                      {/* Only show delete for non-owners and not the current user */}
                      {member.role !== 'OWNER' && member.id !== currentUserId && (
                        <>
                          <div className="border-t my-1" />
                          <button
                            onClick={() => {
                              setMenuOpen(null);
                              onDelete(member);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar empleado
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contact info */}
            <div className="space-y-2 mt-4">
              {member.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="truncate">{member.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{formatPhone(member.phone)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>Desde: {formatDate(member.createdAt)}</span>
              </div>
            </div>

            {/* Footer stats */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Briefcase className="h-4 w-4" />
                <span>{member.jobCount} {member.jobCount === 1 ? 'trabajo' : 'trabajos'}</span>
              </div>
              {member.avgRating !== null ? (
                <div className="flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  <span className="font-medium">{member.avgRating}</span>
                  <span className="text-gray-400 text-xs">({member.reviewCount})</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Star className="h-4 w-4" />
                  <span>Sin calificaciones</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE CONFIRMATION MODAL (with 3-second safety button)
// ═══════════════════════════════════════════════════════════════════════════════

interface DeleteConfirmationModalProps {
  member: TeamMember;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmationModal({ member, onConfirm, onCancel, isDeleting }: DeleteConfirmationModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [canDelete, setCanDelete] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft > 0) {
      const timer = setTimeout(() => {
        setSecondsLeft(secondsLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanDelete(true);
    }
  }, [secondsLeft]);

  // Reset on close
  useEffect(() => {
    return () => {
      setSecondsLeft(3);
      setCanDelete(false);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden">
          {/* Header with warning icon */}
          <div className="p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Estás seguro?
            </h2>
            <p className="text-sm text-gray-600">
              Esta acción eliminará a <strong>{member.name}</strong> permanentemente y no se puede deshacer.
            </p>
          </div>

          {/* Footer with buttons */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            {/* Safety Delete Button with animation */}
            <button
              type="button"
              onClick={canDelete ? onConfirm : undefined}
              disabled={!canDelete || isDeleting}
              className={cn(
                "flex-1 relative overflow-hidden px-4 py-2.5 text-sm font-medium rounded-lg transition-all",
                canDelete
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              )}
            >
              {/* Animated overlay that shrinks from 100% to 0% */}
              {!canDelete && (
                <div
                  className="absolute inset-0 bg-gray-400 transition-all ease-linear"
                  style={{
                    width: `${(secondsLeft / 3) * 100}%`,
                    transitionDuration: '1000ms',
                  }}
                />
              )}
              <span className="relative z-10">
                {isDeleting
                  ? 'Eliminando...'
                  : canDelete
                    ? 'Confirmar Eliminación'
                    : `Espere (${secondsLeft}s)...`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY SCHEDULES TAB (Read-Only Visualizer)
// Updated: Cleaner grid without repetitive orange warnings
// ═══════════════════════════════════════════════════════════════════════════════

interface ScheduleEntry {
  id: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

function WeeklySchedulesTab({ members }: { members: TeamMember[] }) {
  const { data: schedulesData, isLoading } = useQuery({
    queryKey: ['all-schedules'],
    queryFn: async () => {
      const res = await fetch('/api/employees/schedule/all');
      if (!res.ok) throw new Error('Error fetching schedules');
      return res.json();
    },
  });

  const schedules: ScheduleEntry[] = schedulesData?.data?.schedules || [];

  // Check if a user has ANY schedule records defined
  const userHasSchedule = (userId: string): boolean => {
    return schedules.some((s: ScheduleEntry) => s.userId === userId);
  };

  // Get schedule for a specific day
  const getScheduleForDay = (userId: string, dayOfWeek: number): { text: string; isAvailable: boolean } => {
    const schedule = schedules.find(
      (s: ScheduleEntry) => s.userId === userId && s.dayOfWeek === dayOfWeek
    );

    if (schedule?.isAvailable) {
      return { text: `${schedule.startTime} - ${schedule.endTime}`, isAvailable: true };
    }

    // If we are here, it's either "Libre" (Day Off) or "Sin Horario" (No setup)
    // We handle the visual distinction in the render loop, not here.
    return { text: 'Libre', isAvailable: false };
  };

  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Cargando horarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
        <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          Vista de solo lectura. Para modificar horarios, haga clic en el día específico en la pestaña <strong>Disponibilidad</strong>.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Empleado
                </th>
                {DAYS_OF_WEEK.map((day) => (
                  <th
                    key={day.id}
                    className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {day.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {members.map((member) => {
                const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.TECHNICIAN;
                const hasAnySchedule = userHasSchedule(member.id);

                return (
                  <tr key={member.id} className="hover:bg-gray-50">
                    {/* NAME COLUMN - Keep the warning here if needed */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-medium">
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{member.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className={cn('px-1.5 py-0.5 text-xs font-medium rounded', roleConfig.color)}>
                              {roleConfig.label}
                            </span>
                            {!hasAnySchedule && (
                              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700 border border-orange-200">
                                ⚠️ Sin Configurar
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* DAYS COLUMNS - Clean Look */}
                    {DAYS_OF_WEEK.map((day) => {
                      const scheduleInfo = getScheduleForDay(member.id, day.id);

                      // VISUAL LOGIC:
                      // 1. If user has NO schedule set up at all -> Show clean Dash "-"
                      // 2. If user has schedule but is off today -> Show "Libre"
                      // 3. If user is working -> Show Time

                      let cellContent = <span className="text-gray-400">-</span>;
                      let cellClass = "bg-gray-50/30"; // Default empty feel

                      if (hasAnySchedule) {
                        if (scheduleInfo.isAvailable) {
                          cellContent = <span>{scheduleInfo.text}</span>;
                          cellClass = "text-gray-900 font-medium bg-green-50/30"; // Subtle green tint for working days
                        } else {
                          cellContent = <span className="italic">Libre</span>;
                          cellClass = "text-gray-400 bg-gray-50"; // Dimmed for days off
                        }
                      }

                      return (
                        <td
                          key={day.id}
                          className={cn('px-3 py-3 text-center text-xs border-l border-gray-100', cellClass)}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY SCHEDULE TAB (TECHNICIAN VIEW)
// ═══════════════════════════════════════════════════════════════════════════════

function MyScheduleTab({ userId }: { userId?: string }) {
  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['my-schedule', userId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/schedule?userId=${userId}`);
      if (!res.ok) throw new Error('Error fetching schedule');
      return res.json();
    },
    enabled: !!userId,
  });

  const schedules = scheduleData?.data?.schedules || [];
  const exceptions = scheduleData?.data?.exceptions || [];

  if (isLoading) {
    return (
      <div className="card p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-500">Cargando tu horario...</p>
      </div>
    );
  }

  const getScheduleForDay = (dayOfWeek: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schedule = schedules.find((s: any) => s.dayOfWeek === dayOfWeek);
    if (schedule?.isAvailable) {
      return `${schedule.startTime} - ${schedule.endTime}`;
    }
    return 'No disponible';
  };

  return (
    <div className="space-y-6">
      {/* Weekly Schedule */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">Mi Horario Semanal</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Tu horario es administrado por tu supervisor
          </p>
        </div>
        <div className="divide-y">
          {DAYS_OF_WEEK.map((day) => {
            const schedule = getScheduleForDay(day.id);
            const isAvailable = schedule !== 'No disponible';
            return (
              <div
                key={day.id}
                className={cn(
                  'flex items-center justify-between px-4 py-3',
                  !isAvailable && 'bg-gray-50'
                )}
              >
                <span className={cn('font-medium', !isAvailable && 'text-gray-400')}>
                  {day.name}
                </span>
                <span className={cn('text-sm', isAvailable ? 'text-gray-700' : 'text-gray-400')}>
                  {schedule}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Exceptions */}
      {exceptions.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-600" />
              <h2 className="font-semibold text-gray-900">Mis Excepciones Próximas</h2>
            </div>
          </div>
          <div className="divide-y">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {exceptions.slice(0, 5).map((exception: any) => (
              <div key={exception.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {new Date(exception.date).toLocaleDateString('es-AR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                    <p className="text-sm text-gray-500">{exception.reason || 'Sin motivo'}</p>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      exception.isAvailable
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    )}
                  >
                    {exception.isAvailable ? 'Horario especial' : 'No disponible'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPONIBILIDAD TAB (The Manager)
// Control center for Schedule & Exceptions
// ═══════════════════════════════════════════════════════════════════════════════

interface DisponibilidadTabProps {
  canEdit: boolean;
  members: TeamMember[];
}

function DisponibilidadTab({ canEdit, members }: DisponibilidadTabProps) {
  const queryClient = useQueryClient();
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  return (
    <div className="space-y-4">
      {/* Control Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Gestión de Disponibilidad</h2>
          <p className="text-sm text-gray-500">Configura horarios base y marca excepciones (vacaciones, enfermedades).</p>
        </div>
      </div>

      {/* Team Calendar for Exceptions - includes the schedule config button */}
      <TeamCalendar
        canEdit={canEdit}
        onOpenScheduleConfig={() => setShowScheduleModal(true)}
      />

      {/* Schedule Config Modal */}
      {showScheduleModal && (
        <ScheduleConfigModal
          members={members}
          onClose={() => setShowScheduleModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['all-schedules'] });
            queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
            queryClient.invalidateQueries({ queryKey: ['user-live-status'] });
            setShowScheduleModal(false);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS FOR TEAM MEMBER FORM
// ═══════════════════════════════════════════════════════════════════════════════

const SPECIALTY_OPTIONS = [
  { value: '', label: 'Sin especialidad' },
  { value: 'PLOMERO', label: 'Plomero' },
  { value: 'ELECTRICISTA', label: 'Electricista' },
  { value: 'GASISTA', label: 'Gasista' },
  { value: 'CALEFACCIONISTA', label: 'Calefaccionista' },
  { value: 'REFRIGERACION', label: 'Refrigeración' },
  { value: 'ALBANIL', label: 'Albañil' },
  { value: 'PINTOR', label: 'Pintor' },
  { value: 'CARPINTERO', label: 'Carpintero' },
  { value: 'TECHISTA', label: 'Techista' },
  { value: 'HERRERO', label: 'Herrero' },
  { value: 'SOLDADOR', label: 'Soldador' },
  { value: 'OTRO', label: 'Otro' },
];

const _SKILL_LEVEL_OPTIONS = [
  { value: '', label: 'Sin nivel asignado' },
  { value: 'AYUDANTE', label: 'Ayudante' },
  { value: 'MEDIO_OFICIAL', label: 'Medio Oficial' },
  { value: 'OFICIAL', label: 'Oficial' },
  { value: 'OFICIAL_ESPECIALIZADO', label: 'Oficial Especializado' },
];

// Standard UOCRA categories (used for most manual trades in Argentina - CCT 76/75)
const UOCRA_CATEGORIES = [
  { value: 'AYUDANTE', label: 'Ayudante' },
  { value: 'MEDIO_OFICIAL', label: 'Medio Oficial' },
  { value: 'OFICIAL', label: 'Oficial' },
  { value: 'OFICIAL_ESPECIALIZADO', label: 'Oficial Especializado' },
];

const TRADE_CATEGORY_OPTIONS: Record<string, { value: string; label: string }[]> = {
  // --- MATRICULATED TRADES (Regulated by Law) ---

  GASISTA: [
    { value: '1RA', label: '1ra Categoría (Industrial / Edificios - >50.000 Kcal)' },
    { value: '2DA', label: '2da Categoría (Doméstico / Comercial - <50.000 Kcal)' },
    { value: '3RA', label: '3ra Categoría (Unifuncional / Domiciliario)' },
  ],

  ELECTRICISTA: [
    { value: 'CAT_A', label: 'Categoría A (Profesional / Ingeniero - Potencia Ilimitada)' },
    { value: 'CAT_B', label: 'Categoría B (Técnico - Hasta 2000 kVA)' },
    { value: 'CAT_C', label: 'Categoría C (Idóneo - Hasta 10 kW / Domiciliario)' },
  ],

  // --- NON-MATRICULATED TRADES (Regulated by UOCRA Skills) ---

  PLOMERO: [
    { value: '', label: 'Sin categoría' },
    ...UOCRA_CATEGORIES, // Uses Ayudante -> Oficial Especializado
    { value: 'DESTAPACIONES', label: 'Especialista en Destapaciones (Máquina)' },
  ],

  CALEFACCIONISTA: [
    { value: '', label: 'Sin categoría' },
    { value: 'CALDERISTA', label: 'Calderista (Vapor/Agua Caliente)' },
    { value: 'RADIADORES', label: 'Instalador de Radiadores/Piso Radiante' },
    { value: 'ESTUFAS', label: 'Reparador de Estufas/Tiro Balanceado' },
  ],

  REFRIGERACION: [
    { value: '', label: 'Sin categoría' },
    { value: 'MATRICULADO_CACAAV', label: 'Matriculado CACAAV / IRAM' },
    { value: 'INSTALADOR_SPLIT', label: 'Instalador de Splits (Baja capacidad)' },
    { value: 'TECNICO_CENTRAL', label: 'Técnico en Sistemas Centrales / VRF' },
    { value: 'HELADERAS', label: 'Reparador de Heladeras / Línea Blanca' },
  ],

  // --- CONSTRUCTION TRADES (Strictly UOCRA) ---

  ALBANIL: UOCRA_CATEGORIES,

  PINTOR: [
    ...UOCRA_CATEGORIES,
    { value: 'ALTURA', label: 'Pintor de Altura / Siletero' }, // Specialized high-risk role
  ],

  CARPINTERO: [
    ...UOCRA_CATEGORIES,
    { value: 'EBANISTA', label: 'Ebanista (Muebles a medida)' },
    { value: 'OBRA', label: 'Carpintero de Obra / Encofrador' },
  ],

  TECHISTA: [
    ...UOCRA_CATEGORIES,
    { value: 'ZINGUERO', label: 'Zinguero (Canaletas y Zinguería)' },
    { value: 'MEMBRANERO', label: 'Colocador de Membranas' },
  ],

  HERRERO: UOCRA_CATEGORIES,

  // --- HIGHLY SPECIALIZED ---

  SOLDADOR: [
    { value: '', label: 'Herrero de Obra (Sin calificación)' },
    { value: 'CALIFICADO_ASME', label: 'Calificado ASME IX (Alta Presión)' },
    { value: 'CALIFICADO_API', label: 'Calificado API 1104 (Gasoductos)' },
    { value: 'CALIFICADO_AWS', label: 'Calificado AWS D1.1 (Estructural)' },
    { value: 'ARGONISTA', label: 'Argonista / TIG (Acero Inoxidable)' },
  ],

  // Fallback
  DEFAULT: UOCRA_CATEGORIES,
};

// Get category options for a specific trade
function getTradeCategoryOptions(specialty: string) {
  return TRADE_CATEGORY_OPTIONS[specialty] || TRADE_CATEGORY_OPTIONS.DEFAULT;
}

// Matrícula configuration per specialty
// Different trades require different types of professional certifications
// All are OPTIONAL - helpers and unlicensed workers can still be added
const SPECIALTY_MATRICULA_CONFIG: Record<string, {
  label: string;
  placeholder: string;
  hint: string;
  required: boolean;
  pattern?: RegExp;
}> = {
  GASISTA: {
    label: 'Matrícula Gasista',
    // Removed CACAAV. Added generic numeric examples common in Metrogas/Naturgy.
    placeholder: 'Ej: 12345 o MG-12345',
    hint: 'Número de matrícula habilitante (ej: MetroGas, Camuzzi, Naturgy)',
    required: false,
  },
  ELECTRICISTA: {
    label: 'Matrícula Electricista',
    // APSE and COPIME are the two big ones technicians recognize.
    placeholder: 'Ej: APSE-12345 o COPIME Tº12 Fº34',
    hint: 'Número de registro en APSE, COPIME o colegio técnico provincial',
    required: false,
  },
  PLOMERO: {
    label: 'Matrícula Sanitarista', // "Sanitarista" sounds more professional for matriculas
    placeholder: 'Ej: 12345 (AySA / Obras Sanitarias)',
    hint: 'Sólo si posee matrícula oficial de instalador sanitario',
    required: false,
  },
  CALEFACCIONISTA: {
    label: 'Matrícula Calefacción',
    // Usually implies Gasista, but could be specific hydronic heating
    placeholder: 'Ej: 12345',
    hint: 'Si es caldera a gas, por favor ingrese su matrícula de Gasista',
    required: false,
  },
  REFRIGERACION: {
    label: 'Matrícula / Registro HVAC',
    // Moved CACAAV here where it belongs
    placeholder: 'Ej: CACAAV-12345 o AARA-123',
    hint: 'Número de socio CACAAV o certificado de la Asoc. Arg. del Frío',
    required: false,
  },
  ALBANIL: {
    label: 'Registro IERIC / Credencial',
    placeholder: 'Ej: Nº de Inscripción IERIC',
    hint: 'Número de credencial IERIC (Libreta de Fondo de Desempleo) si posee',
    required: false,
  },
  PINTOR: {
    label: 'Certificación / Registro',
    placeholder: 'Ej: Curso Profesional / Capra',
    hint: 'Mencione si posee certificados de cursos o membresía en cámara de pintores',
    required: false,
  },
  CARPINTERO: {
    label: 'Registro / Afiliación',
    placeholder: 'Ej: USIMRA o Certificado FP',
    hint: 'Número de afiliación gremial o certificado de Formación Profesional',
    required: false,
  },
  TECHISTA: {
    label: 'Certificación Especialidad',
    placeholder: 'Ej: Instalador Zinguería / Techos Verdes',
    hint: 'Especifique si tiene certificación en materiales específicos',
    required: false,
  },
  HERRERO: {
    label: 'Habilitación Taller',
    placeholder: 'Ej: Habilitación Municipal',
    hint: 'Si posee taller habilitado, puede indicarlo aquí',
    required: false,
  },
  SOLDADOR: {
    label: 'Calificación de Soldadura', // This is the most technical one in this list
    placeholder: 'Ej: Norma ASME IX / API 1104',
    hint: 'Código de calificación vigente (WPQ) si realiza trabajos de alta presión',
    required: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MATRÍCULA VALIDATION - Argentine Skilled Trade License Numbers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Regex patterns for validating Argentine trade license/matrícula numbers
 * All patterns are optional (empty string is valid)
 */
const MATRICULA_PATTERNS: Record<string, {
  pattern: RegExp;
  errorMessage: string;
}> = {
  GASISTA: {
    // Numeric (4-6 digits) OR alphanumeric starting with 'MG-' or 'Naturgy-'
    // Examples: 12345, 123456, MG-12345, Naturgy-123
    pattern: /^$|^(\d{4,6}|MG-\d{3,6}|Naturgy-\d{2,6}|Camuzzi-\d{2,6})$/i,
    errorMessage: 'Formato inválido. Use número (4-6 dígitos) o prefijo MG-/Naturgy-/Camuzzi-',
  },
  ELECTRICISTA: {
    // 'APSE' or 'COPIME' followed by numbers/dashes, OR just a 5-6 digit number
    // Examples: APSE-12345, COPIME Tº12 Fº34, 12345, 123456
    pattern: /^$|^(APSE[-\s]?\d{3,6}|COPIME\s*(Tº?\d{1,4}\s*Fº?\d{1,4}|\d{3,6})|\d{5,6})$/i,
    errorMessage: 'Formato inválido. Use APSE-xxxxx, COPIME Tº12 Fº34, o número de 5-6 dígitos',
  },
  PLOMERO: {
    // Numeric (3-6 digits) - AySA / Obras Sanitarias format
    // Examples: 1234, 12345, 123456
    pattern: /^$|^\d{3,6}$/,
    errorMessage: 'Use número de matrícula de 3-6 dígitos',
  },
  CALEFACCIONISTA: {
    // Numeric (4-6 digits) - same as gasista or general format
    // Examples: 1234, 12345, 123456
    pattern: /^$|^\d{4,6}$/,
    errorMessage: 'Use número de 4-6 dígitos (si es a gas, use su matrícula de gasista)',
  },
  REFRIGERACION: {
    // CACAAV-xxxxx or AARA-xxx format
    // Examples: CACAAV-12345, AARA-123, 12345
    pattern: /^$|^(CACAAV[-\s]?\d{3,6}|AARA[-\s]?\d{2,5}|\d{3,6})$/i,
    errorMessage: 'Use formato CACAAV-xxxxx, AARA-xxx, o número de 3-6 dígitos',
  },
  ALBANIL: {
    // IERIC registration number or free text (credencial number)
    // Examples: 123456789, IERIC-12345
    pattern: /^$|^(IERIC[-\s]?\d{4,10}|\d{4,12}|.{1,50})$/i,
    errorMessage: 'Use número IERIC o número de credencial',
  },
  PINTOR: {
    // Open format - certification names or course completion
    // Just validate it's not too long
    pattern: /^$|^.{1,100}$/,
    errorMessage: 'Ingrese nombre de certificación o curso (máx 100 caracteres)',
  },
  CARPINTERO: {
    // USIMRA or FP certificate format
    // Examples: USIMRA-12345, FP Carpintería 2020
    pattern: /^$|^(USIMRA[-\s]?\d{3,8}|FP\s*.{1,50}|.{1,50})$/i,
    errorMessage: 'Use número USIMRA, certificado FP, o descripción breve',
  },
  TECHISTA: {
    // Open format - specialty certification
    pattern: /^$|^.{1,100}$/,
    errorMessage: 'Ingrese tipo de certificación (máx 100 caracteres)',
  },
  HERRERO: {
    // Municipal habilitación or general format
    // Examples: Hab. Municipal CABA, 12345
    pattern: /^$|^.{1,100}$/,
    errorMessage: 'Ingrese habilitación o número de taller (máx 100 caracteres)',
  },
  SOLDADOR: {
    // ASME, API, or AWS certification format
    // Examples: ASME IX, API 1104, AWS D1.1, WPQ-123
    pattern: /^$|^(ASME\s*(IX|Section\s*IX|Sec\.?\s*IX)?|API\s*(1104|650)|AWS\s*D\d+(\.\d+)?|WPQ[-\s]?\d{1,6}|.{1,50})$/i,
    errorMessage: 'Use código ASME/API/AWS (ej: ASME IX, API 1104) o número WPQ',
  },
};

/**
 * Validate a matrícula value based on the specialty
 * @param specialty - The specialty code (e.g., 'GASISTA', 'ELECTRICISTA')
 * @param matricula - The matrícula value to validate
 * @returns { valid: boolean, error?: string }
 */
function validateMatricula(specialty: string, matricula: string): { valid: boolean; error?: string } {
  // Empty is always valid (all matrícula fields are optional)
  if (!matricula || matricula.trim() === '') {
    return { valid: true };
  }

  const trimmed = matricula.trim();
  const config = MATRICULA_PATTERNS[specialty];

  // If no specific pattern defined, allow any non-empty value up to 100 chars
  if (!config) {
    if (trimmed.length > 100) {
      return { valid: false, error: 'Máximo 100 caracteres' };
    }
    return { valid: true };
  }

  // Test against the pattern
  if (!config.pattern.test(trimmed)) {
    return { valid: false, error: config.errorMessage };
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM MEMBER MODAL (Add/Edit)
// ═══════════════════════════════════════════════════════════════════════════════

interface TeamMemberModalProps {
  member: TeamMember | null;
  currentUserId?: string;
  currentUserRole?: string;
  onClose: () => void;
  onSuccess: () => void;
  onDelete?: (member: TeamMember) => void;
}

function TeamMemberModal({ member, currentUserId, currentUserRole, onClose, onSuccess, onDelete }: TeamMemberModalProps) {
  // Initialize certifications from member data (handle legacy single specialty)
  const initCertifications = (): Record<string, TradeCertification> => {
    if (member?.certifications) {
      return member.certifications;
    }
    // Legacy: convert single specialty to certifications format
    if (member?.specialty && member?.specialty !== '') {
      return {
        [member.specialty]: {
          matricula: member.matricula || '',
          category: member.skillLevel || '',
        },
      };
    }
    return {};
  };

  // Initialize specialties from member data
  const initSpecialties = (): string[] => {
    if (member?.specialties && member.specialties.length > 0) {
      return member.specialties;
    }
    // Legacy: convert single specialty to array
    if (member?.specialty && member.specialty !== '') {
      return [member.specialty];
    }
    return [];
  };

  const [formData, setFormData] = useState({
    name: member?.name || '',
    phone: member?.phone || '',
    email: member?.email || '',
    role: member?.role || 'TECHNICIAN',
    // Multi-specialty support
    specialties: initSpecialties(),
    certifications: initCertifications(),
    isActive: member?.isActive ?? true,
    sendWelcome: true,
    // Driver's license (optional)
    driverLicenseNumber: member?.driverLicenseNumber || '',
    driverLicenseExpiry: member?.driverLicenseExpiry?.split('T')[0] || '', // Format for date input
    driverLicenseCategory: member?.driverLicenseCategory || '',
    driverLicensePhotoFront: member?.driverLicensePhotoFront || '',
    driverLicensePhotoBack: member?.driverLicensePhotoBack || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certificationErrors, setCertificationErrors] = useState<Record<string, string>>({});
  const [showSpecialtyDropdown, setShowSpecialtyDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const specialtyButtonRef = useRef<HTMLButtonElement>(null);

  // Driver's license photo upload refs and state
  const licensePhotoFrontRef = useRef<HTMLInputElement>(null);
  const licensePhotoBackRef = useRef<HTMLInputElement>(null);
  const [uploadingPhotoFront, setUploadingPhotoFront] = useState(false);
  const [uploadingPhotoBack, setUploadingPhotoBack] = useState(false);

  // Lightbox state for photo preview
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  const isOwner = member?.role === 'OWNER';
  const isEditing = !!member;

  // ACCESS CONTROL: Determine if user can edit or just view
  const normalizedRole = currentUserRole?.toUpperCase() || 'TECHNICIAN';
  const isEditingSelf = member?.id === currentUserId;
  const canEdit = isEditingSelf || ['OWNER', 'DISPATCHER'].includes(normalizedRole);
  const isViewOnly = isEditing && !canEdit;

  // Resend access states (Edit mode only)
  const [resendPhoneOTP, setResendPhoneOTP] = useState(false);
  const originalEmail = member?.email || '';
  const emailChanged = isEditing && formData.email !== originalEmail && formData.email.trim() !== '';

  // Handle specialty dropdown toggle with position calculation
  const handleSpecialtyDropdownToggle = () => {
    if (!showSpecialtyDropdown && specialtyButtonRef.current) {
      const rect = specialtyButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // 4px gap below button
        left: rect.left,
        width: rect.width,
      });
    }
    setShowSpecialtyDropdown(!showSpecialtyDropdown);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showSpecialtyDropdown &&
        specialtyButtonRef.current &&
        !specialtyButtonRef.current.contains(event.target as Node)
      ) {
        // Check if click is inside the portal dropdown
        const portalDropdown = document.getElementById('specialty-dropdown-portal');
        if (portalDropdown && !portalDropdown.contains(event.target as Node)) {
          setShowSpecialtyDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSpecialtyDropdown]);

  // Recalculate dropdown position when specialties change or on resize/scroll
  useEffect(() => {
    if (!showSpecialtyDropdown || !specialtyButtonRef.current) return;

    const updatePosition = () => {
      if (specialtyButtonRef.current) {
        const rect = specialtyButtonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      }
    };

    // 1. Update immediately
    updatePosition();

    // 2. Watch for resizing (The Modal Animation)
    const observer = new ResizeObserver(() => {
      updatePosition();
    });
    observer.observe(specialtyButtonRef.current);

    // 3. Watch for scrolling (window resize/scroll)
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showSpecialtyDropdown, formData.specialties]); // Re-run if specialties change

  // Toggle a specialty in the multi-select
  const toggleSpecialty = (specialty: string) => {
    const currentSpecialties = formData.specialties;
    const currentCerts = { ...formData.certifications };

    if (currentSpecialties.includes(specialty)) {
      // Remove specialty
      const newSpecialties = currentSpecialties.filter((s) => s !== specialty);
      delete currentCerts[specialty];
      setFormData({
        ...formData,
        specialties: newSpecialties,
        certifications: currentCerts,
      });
      // Clear any error for this specialty
      const newErrors = { ...certificationErrors };
      delete newErrors[specialty];
      setCertificationErrors(newErrors);
    } else {
      // Add specialty
      const newSpecialties = [...currentSpecialties, specialty];
      currentCerts[specialty] = { matricula: '', category: '' };
      setFormData({
        ...formData,
        specialties: newSpecialties,
        certifications: currentCerts,
      });
    }
  };

  // Update certification for a specific specialty
  const updateCertification = (specialty: string, field: 'matricula' | 'category', value: string) => {
    const currentCerts = { ...formData.certifications };
    if (!currentCerts[specialty]) {
      currentCerts[specialty] = { matricula: '', category: '' };
    }
    currentCerts[specialty][field] = value;
    setFormData({ ...formData, certifications: currentCerts });

    // Clear error when typing
    if (field === 'matricula' && certificationErrors[specialty]) {
      const newErrors = { ...certificationErrors };
      delete newErrors[specialty];
      setCertificationErrors(newErrors);
    }
  };

  // Validate matrícula for a specific specialty
  const validateCertification = (specialty: string) => {
    const cert = formData.certifications[specialty];
    if (cert?.matricula) {
      const result = validateMatricula(specialty, cert.matricula);
      if (!result.valid) {
        setCertificationErrors((prev) => ({ ...prev, [specialty]: result.error || 'Formato inválido' }));
        return false;
      }
    }
    setCertificationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[specialty];
      return newErrors;
    });
    return true;
  };

  // Validate all certifications before submit
  const validateAllCertifications = (): boolean => {
    let allValid = true;
    const newErrors: Record<string, string> = {};

    for (const specialty of formData.specialties) {
      const cert = formData.certifications[specialty];
      if (cert?.matricula) {
        const result = validateMatricula(specialty, cert.matricula);
        if (!result.valid) {
          newErrors[specialty] = result.error || 'Formato inválido';
          allValid = false;
        }
      }
    }

    setCertificationErrors(newErrors);
    return allValid;
  };

  // Handle photo upload for driver's license
  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    side: 'front' | 'back'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Por favor, seleccioná una imagen (JPG, PNG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB');
      return;
    }

    const setUploading = side === 'front' ? setUploadingPhotoFront : setUploadingPhotoBack;
    const fieldName = side === 'front' ? 'driverLicensePhotoFront' : 'driverLicensePhotoBack';

    setUploading(true);

    try {
      // Convert to base64 for preview (in production, upload to storage and use URL)
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFormData(prev => ({ ...prev, [fieldName]: base64 }));
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Error al leer la imagen');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      alert('Error al procesar la imagen');
      setUploading(false);
    }

    // Clear the input so the same file can be selected again
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate all certifications
    if (!validateAllCertifications()) {
      setIsSubmitting(false);
      return;
    }

    try {
      const url = member ? `/api/users/${member.id}` : '/api/users';
      const method = member ? 'PUT' : 'POST';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        name: formData.name,
        phone: formData.phone, // Already includes country code from PhoneInput
        email: formData.email,
        role: formData.role,
        // Multi-specialty data
        specialties: formData.specialties,
        certifications: formData.certifications,
        // Legacy fields for backwards compatibility (use first specialty)
        specialty: formData.specialties[0] || null,
        matricula: formData.certifications[formData.specialties[0]]?.matricula || null,
        skillLevel: formData.certifications[formData.specialties[0]]?.category || null,
        isActive: formData.isActive,
        // Driver's license fields
        driverLicenseNumber: formData.driverLicenseNumber || null,
        driverLicenseExpiry: formData.driverLicenseExpiry || null,
        driverLicenseCategory: formData.driverLicenseCategory || null,
        driverLicensePhotoFront: formData.driverLicensePhotoFront || null,
        driverLicensePhotoBack: formData.driverLicensePhotoBack || null,
      };

      // Only include sendWelcome for new users
      if (!member) {
        payload.sendWelcome = formData.sendWelcome;
      }

      // For edits: Include resend flags
      if (member) {
        // Auto-trigger email notification if email changed
        if (emailChanged) {
          payload.resendEmailNotification = true;
        }
        // Manual toggle for resending phone OTP
        if (resendPhoneOTP) {
          payload.resendPhoneOTP = true;
        }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Translate common API errors to Spanish
        const errorMessage = data.error?.message || data.error || 'Error al guardar';
        const errorTranslations: Record<string, string> = {
          'Phone number already in use': 'Este número de teléfono ya está registrado',
          'Name and phone are required': 'El nombre y teléfono son obligatorios',
          'Cannot create users with OWNER role': 'No se puede crear usuarios con rol de Propietario',
          'Unauthorized': 'No autorizado',
          'Forbidden: insufficient permissions': 'No tienes permisos para realizar esta acción',
        };
        throw new Error(errorTranslations[errorMessage] || errorMessage);
      }

      onSuccess();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
      // Scroll the form to top to show the error
      const scrollContainer = document.querySelector('[data-form-scroll]');
      if (scrollContainer) scrollContainer.scrollTop = 0;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic width based on whether specialties are selected
  const hasSpecialties = formData.specialties.length > 0;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop overlay - covers entire screen */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content - centered with max height, binary width (no gradual growth) */}
      <div className="flex h-full items-center justify-center p-4">
        <div
          className={cn(
            "relative flex flex-col rounded-xl bg-white shadow-xl overflow-x-hidden",
            "transition-all duration-500 ease-in-out",
            "max-h-[90vh] w-full",
            // Binary sizing: Compact (max-w-2xl) or Medium-Wide (max-w-3xl)
            hasSpecialties ? "max-w-3xl" : "max-w-2xl"
          )}
        >
          {/* Fixed Header */}
          <div className="flex-shrink-0 flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {!member ? 'Nuevo miembro' : (isViewOnly ? 'Ver Empleado' : 'Editar Empleado')}
              </h2>
              {/* Stats (Edit mode only) - inline with title */}
              {isEditing && member && (
                <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>{member.jobCount || 0} trabajos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-400" />
                    <span>{member.avgRating !== null ? member.avgRating.toFixed(1) : '—'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {member.createdAt
                        ? new Date(member.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Scrollable Body */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div data-form-scroll className="flex-1 overflow-y-auto p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                  <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* TOP SECTION: Personal Info - 2 Column Grid                       */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Row 1: Name | Phone */}
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre {!isViewOnly && '*'}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={cn("input w-full h-10", isViewOnly && "bg-gray-100 cursor-not-allowed")}
                    placeholder="Nombre completo"
                    required={!isViewOnly}
                    disabled={isViewOnly}
                  />
                </div>

                {/* Phone */}
                <div>
                  <PhoneInput
                    id="employee-phone"
                    value={formData.phone}
                    onChange={(fullPhone) => setFormData({ ...formData, phone: fullPhone })}
                    label="Teléfono"
                    required
                    disabled={isEditing}
                    error={isEditing ? '🔒 Bloqueado por seguridad. Si cambió de número, desactive este usuario y cree uno nuevo.' : undefined}
                  />
                  {/* Edit mode: Resend OTP link */}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setResendPhoneOTP(!resendPhoneOTP)}
                      className={cn(
                        "mt-1 text-sm underline transition-colors",
                        resendPhoneOTP ? "text-green-600" : "text-blue-600 hover:text-blue-800"
                      )}
                    >
                      {resendPhoneOTP ? '✓ Se reenviará código de verificación' : '¿Reenviar acceso?'}
                    </button>
                  )}
                </div>

                {/* Row 2: Email | Rol */}
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input w-full h-10"
                    placeholder="email@ejemplo.com"
                    required
                  />
                  {/* Create mode: Standard message */}
                  {!isEditing && (
                    <p className="mt-1 text-xs text-gray-500">
                      Se enviará una notificación al empleado
                    </p>
                  )}
                  {/* Edit mode: Show if email changed */}
                  {isEditing && emailChanged && (
                    <p className="mt-1 text-xs text-green-600">
                      ✓ Se enviará notificación al nuevo email
                    </p>
                  )}
                  {/* Edit mode: Email not changed - no message needed */}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rol
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as TeamMember['role'] })}
                    className="input w-full h-10"
                    disabled={isOwner}
                  >
                    <option value="TECHNICIAN">Técnico</option>
                    <option value="DISPATCHER">Despachador</option>
                    {isOwner && <option value="OWNER">Dueño</option>}
                  </select>
                  {/* Active checkbox - under Rol for alignment */}
                  <div className="mt-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded text-primary-600"
                        disabled={member?.id === currentUserId}
                      />
                      <span className="text-sm text-gray-700">Usuario activo</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* DRIVER'S LICENSE SECTION (Optional)                             */}
              {/* ═══════════════════════════════════════════════════════════════ */}

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  🚗 Licencia de Conducir
                  <span className="text-xs font-normal text-gray-500">(opcional)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* License Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Licencia
                    </label>
                    <input
                      type="text"
                      value={formData.driverLicenseNumber}
                      onChange={(e) => setFormData({ ...formData, driverLicenseNumber: e.target.value })}
                      className={cn("input w-full h-10", isViewOnly && "bg-gray-100 cursor-not-allowed")}
                      placeholder="Ej: 12345678"
                      disabled={isViewOnly}
                    />
                  </div>
                  {/* License Expiry */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vencimiento
                    </label>
                    <input
                      type="date"
                      value={formData.driverLicenseExpiry}
                      onChange={(e) => setFormData({ ...formData, driverLicenseExpiry: e.target.value })}
                      className={cn("input w-full h-10", isViewOnly && "bg-gray-100 cursor-not-allowed")}
                      disabled={isViewOnly}
                    />
                  </div>
                  {/* License Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría
                    </label>
                    <select
                      value={formData.driverLicenseCategory}
                      onChange={(e) => setFormData({ ...formData, driverLicenseCategory: e.target.value })}
                      className={cn("input w-full h-10", isViewOnly && "bg-gray-100 cursor-not-allowed")}
                      disabled={isViewOnly}
                    >
                      <option value="">Sin especificar</option>
                      <option value="B1">B1 - Auto hasta 3500kg</option>
                      <option value="B2">B2 - Auto + remolque</option>
                      <option value="C">C - Camión</option>
                      <option value="D1">D1 - Transporte de pasajeros</option>
                    </select>
                  </div>
                </div>

                {/* License Photo Uploads - Second Row */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {/* Photo Front */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Foto Frente
                    </label>
                    <input
                      ref={licensePhotoFrontRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'front')}
                      className="hidden"
                      disabled={isViewOnly}
                    />
                    {formData.driverLicensePhotoFront ? (
                      <div className="relative group">
                        <img
                          src={formData.driverLicensePhotoFront}
                          alt="Licencia frente"
                          className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer"
                          onClick={() => setLightboxImage({ src: formData.driverLicensePhotoFront, alt: 'Licencia de Conducir - Frente' })}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          {/* Cambiar imagen - only when editable */}
                          {!isViewOnly && (
                            <button
                              type="button"
                              onClick={() => licensePhotoFrontRef.current?.click()}
                              className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                              title="Cambiar imagen"
                            >
                              <Upload className="h-4 w-4 text-gray-700" />
                            </button>
                          )}
                          {/* Ver imagen - always visible */}
                          <button
                            type="button"
                            onClick={() => setLightboxImage({ src: formData.driverLicensePhotoFront, alt: 'Licencia de Conducir - Frente' })}
                            className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                            title="Ver imagen"
                          >
                            <Eye className="h-4 w-4 text-gray-700" />
                          </button>
                          {/* Quitar imagen - only when editable */}
                          {!isViewOnly && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, driverLicensePhotoFront: '' })}
                              className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                              title="Quitar imagen"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => !isViewOnly && licensePhotoFrontRef.current?.click()}
                        disabled={isViewOnly || uploadingPhotoFront}
                        className={cn(
                          "w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors",
                          isViewOnly
                            ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                            : "border-gray-300 hover:border-teal-400 hover:bg-teal-50 cursor-pointer"
                        )}
                      >
                        {uploadingPhotoFront ? (
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
                        ) : (
                          <>
                            <ImageIcon className="h-6 w-6 text-gray-400" />
                            <span className="text-xs text-gray-500">Subir foto</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Photo Back */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Foto Dorso
                    </label>
                    <input
                      ref={licensePhotoBackRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'back')}
                      className="hidden"
                      disabled={isViewOnly}
                    />
                    {formData.driverLicensePhotoBack ? (
                      <div className="relative group">
                        <img
                          src={formData.driverLicensePhotoBack}
                          alt="Licencia dorso"
                          className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer"
                          onClick={() => setLightboxImage({ src: formData.driverLicensePhotoBack, alt: 'Licencia de Conducir - Dorso' })}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          {/* Cambiar imagen - only when editable */}
                          {!isViewOnly && (
                            <button
                              type="button"
                              onClick={() => licensePhotoBackRef.current?.click()}
                              className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                              title="Cambiar imagen"
                            >
                              <Upload className="h-4 w-4 text-gray-700" />
                            </button>
                          )}
                          {/* Ver imagen - always visible */}
                          <button
                            type="button"
                            onClick={() => setLightboxImage({ src: formData.driverLicensePhotoBack, alt: 'Licencia de Conducir - Dorso' })}
                            className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                            title="Ver imagen"
                          >
                            <Eye className="h-4 w-4 text-gray-700" />
                          </button>
                          {/* Quitar imagen - only when editable */}
                          {!isViewOnly && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, driverLicensePhotoBack: '' })}
                              className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                              title="Quitar imagen"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => !isViewOnly && licensePhotoBackRef.current?.click()}
                        disabled={isViewOnly || uploadingPhotoBack}
                        className={cn(
                          "w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors",
                          isViewOnly
                            ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                            : "border-gray-300 hover:border-teal-400 hover:bg-teal-50 cursor-pointer"
                        )}
                      >
                        {uploadingPhotoBack ? (
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
                        ) : (
                          <>
                            <ImageIcon className="h-6 w-6 text-gray-400" />
                            <span className="text-xs text-gray-500">Subir foto</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {!formData.driverLicenseNumber && isEditing && !isViewOnly && (
                  <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                    ⚠️ Sin licencia registrada - recomendamos agregar para asignaciones de vehículos y seguros
                  </p>
                )}
              </div>

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* BOTTOM SECTION: Trade Details - Full Width                       */}
              {/* ═══════════════════════════════════════════════════════════════ */}


              {/* Divider with section title */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-teal-600" />
                  Oficios y Credenciales
                </h3>
              </div>

              {/* Multi-Select Specialties */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Especialidades <span className="text-gray-400 text-xs font-normal">(puede seleccionar varias)</span>
                </label>

                {/* Selected specialties as chips */}
                {formData.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.specialties.map((specialty) => {
                      const opt = SPECIALTY_OPTIONS.find((o) => o.value === specialty);
                      return (
                        <span
                          key={specialty}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-sm"
                        >
                          {opt?.label || specialty}
                          <button
                            type="button"
                            onClick={() => toggleSpecialty(specialty)}
                            className="hover:bg-teal-200 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Dropdown button */}
                <div className="relative">
                  <button
                    ref={specialtyButtonRef}
                    type="button"
                    onClick={handleSpecialtyDropdownToggle}
                    className="input w-full h-10 text-left flex items-center justify-between"
                  >
                    <span className="text-gray-500">
                      {formData.specialties.length === 0
                        ? 'Seleccionar especialidades...'
                        : `${formData.specialties.length} especialidad(es) seleccionada(s)`}
                    </span>
                    <Wrench className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                {/* Portal dropdown menu - renders to document.body */}
                {showSpecialtyDropdown && typeof document !== 'undefined' && createPortal(
                  <div
                    id="specialty-dropdown-portal"
                    className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                    style={{
                      position: 'fixed',
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                      zIndex: 9999,
                    }}
                  >
                    {SPECIALTY_OPTIONS.filter((opt) => opt.value !== '').map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.specialties.includes(opt.value)}
                          onChange={() => toggleSpecialty(opt.value)}
                          className="rounded text-teal-600"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                    <div className="border-t p-2 sticky bottom-0 bg-white">
                      <button
                        type="button"
                        onClick={() => setShowSpecialtyDropdown(false)}
                        className="w-full text-center text-sm text-teal-600 hover:text-teal-700"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>,
                  document.body
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Seleccione todos los oficios que el empleado puede realizar
                </p>
              </div>

              {/* Dynamic Trade Cards - One for each selected specialty */}
              {formData.specialties.length > 0 && (
                <div className="space-y-4">
                  {formData.specialties.map((specialty) => {
                    const config = SPECIALTY_MATRICULA_CONFIG[specialty];
                    const categoryOptions = getTradeCategoryOptions(specialty);
                    const cert = formData.certifications[specialty] || { matricula: '', category: '' };
                    const error = certificationErrors[specialty];
                    const specialtyLabel = SPECIALTY_OPTIONS.find((o) => o.value === specialty)?.label || specialty;

                    return (
                      <div
                        key={specialty}
                        className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Award className="h-4 w-4 text-teal-600" />
                          <h4 className="text-sm font-medium text-gray-900">{specialtyLabel}</h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Matrícula for this trade */}
                          {config && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {config.label}
                                <span className="text-gray-400 text-xs font-normal ml-1">(opcional)</span>
                              </label>
                              <input
                                type="text"
                                value={cert.matricula}
                                onChange={(e) => updateCertification(specialty, 'matricula', e.target.value)}
                                onBlur={() => validateCertification(specialty)}
                                className={cn(
                                  "input w-full",
                                  error && "border-red-500 focus:ring-red-500"
                                )}
                                placeholder={config.placeholder}
                              />
                              {error ? (
                                <p className="mt-1 text-xs text-red-500">{error}</p>
                              ) : (
                                <p className="mt-1 text-xs text-gray-500">{config.hint}</p>
                              )}
                            </div>
                          )}

                          {/* Category for this trade */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Categoría / Nivel
                            </label>
                            <select
                              value={cert.category}
                              onChange={(e) => updateCertification(specialty, 'category', e.target.value)}
                              className="input w-full h-10 truncate"
                              title={categoryOptions.find(o => o.value === cert.category)?.label}
                            >
                              {categoryOptions.map((opt) => (
                                <option key={opt.value} value={opt.value} title={opt.label}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Send welcome message (only for new members) - LAST ITEM */}
              {!isEditing && (
                <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={formData.sendWelcome}
                      onChange={(e) => setFormData({ ...formData, sendWelcome: e.target.checked })}
                      className="rounded text-teal-600 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-teal-800">
                        Enviar bienvenida y código de verificación
                      </span>
                      <p className="text-xs text-teal-600 mt-0.5">
                        Se enviará por WhatsApp un mensaje de bienvenida con código de verificación (6 dígitos)
                      </p>
                    </div>
                  </label>
                </div>
              )}
              {/* / Scrollable content ends here */}
            </div>

            {/* Smart Footer - Different layouts for Create vs Edit vs View mode */}
            <div className="flex-shrink-0 flex items-center justify-between gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
              {/* Left Side: Secondary Actions (Edit mode only, not view-only) */}
              {isEditing && member ? (
                <div className="flex items-center gap-2">
                  {/* WhatsApp Button - always visible */}
                  <a
                    href={`https://wa.me/${member.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                  {/* Delete Button - hidden in view-only mode */}
                  {!isViewOnly && member.role !== 'OWNER' && member.id !== currentUserId && onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onDelete(member);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>
                  )}
                </div>
              ) : (
                <div /> /* Empty spacer for create mode */
              )}

              {/* Right Side: Primary Actions */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} className="btn-outline">
                  {isViewOnly ? 'Cerrar' : 'Cancelar'}
                </button>
                {/* Save button - hidden in view-only mode */}
                {!isViewOnly && (
                  <button type="submit" disabled={isSubmitting} className="btn-primary">
                    <Save className="mr-2 h-4 w-4" />
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Lightbox Overlay for Image Preview */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
          onKeyDown={(e) => e.key === 'Escape' && setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.alt}
          tabIndex={-1}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white transition-colors"
              title="Cerrar"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Image */}
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
            />

            {/* Caption */}
            <p className="text-center text-white/80 text-sm mt-3">
              {lightboxImage.alt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
