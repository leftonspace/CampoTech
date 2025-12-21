'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { cn, getInitials } from '@/lib/utils';
import {
  Users,
  Plus,
  Edit2,
  Calendar,
  Clock,
  Mail,
  Phone,
  Star,
  MoreHorizontal,
  Briefcase,
  TrendingUp,
  X,
  Save,
  Shield,
  Wrench,
  Eye,
  User,
} from 'lucide-react';
import TeamCalendar from '@/components/schedule/TeamCalendar';
import TeamMemberDetailModal from './TeamMemberDetailModal';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';
  specialty?: string;
  skillLevel?: string;
  avatar?: string;
  isActive: boolean;
  createdAt?: string;
  jobCount: number;
  avgRating: number | null;
  reviewCount: number;
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

const STATUS_CONFIG = {
  ACTIVE: {
    label: 'Activo',
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  IN_WORK: {
    label: 'En Trabajo',
    color: 'bg-green-50 text-green-600 border-green-300',
  },
  REST: {
    label: 'Descanso',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
  },
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
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const userRole = user?.role?.toUpperCase() || 'TECHNICIAN';
  const isOwnerOrDispatcher = userRole === 'OWNER' || userRole === 'DISPATCHER';
  const isTechnician = userRole === 'TECHNICIAN';

  // Fetch team members
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Error fetching team');
      return res.json();
    },
  });

  const members = (teamData?.data as TeamMember[]) || [];

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
          <EmployeeListTab
            members={members}
            loading={teamLoading}
            canEdit={isOwnerOrDispatcher}
            onEdit={handleEditMember}
            onCardClick={(member) => setSelectedMemberId(member.id)}
            currentUserId={user?.id}
          />
        )}

        {activeTab === 'schedules' && isOwnerOrDispatcher && (
          <WeeklySchedulesTab members={members} />
        )}

        {activeTab === 'availability' && isOwnerOrDispatcher && (
          <TeamCalendar canEdit={isOwnerOrDispatcher} />
        )}

        {activeTab === 'my-schedule' && isTechnician && (
          <MyScheduleTab userId={user?.id} />
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <TeamMemberModal
          member={editingMember}
          currentUserId={user?.id}
          onClose={() => {
            setShowAddModal(false);
            setEditingMember(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['team-members'] });
            setShowAddModal(false);
            setEditingMember(null);
          }}
        />
      )}

      {/* Team Member Detail Modal */}
      <TeamMemberDetailModal
        memberId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
        onEdit={(memberId) => {
          setSelectedMemberId(null);
          const member = members.find(m => m.id === memberId);
          if (member) handleEditMember(member);
        }}
      />
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
// EMPLOYEE LIST TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeeListTabProps {
  members: TeamMember[];
  loading: boolean;
  canEdit: boolean;
  onEdit: (member: TeamMember) => void;
  onCardClick: (member: TeamMember) => void;
  currentUserId?: string;
}

function EmployeeListTab({ members, loading, canEdit, onEdit, onCardClick, currentUserId }: EmployeeListTabProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

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

  const getEmployeeStatus = (member: TeamMember) => {
    // Mock status - in production this would come from job data
    if (!member.isActive) return 'REST';
    if (Math.random() > 0.7) return 'IN_WORK';
    return 'ACTIVE';
  };

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
        const status = getEmployeeStatus(member);
        const statusConfig = STATUS_CONFIG[status];
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
                  {/* Badges */}
                  <div className="flex gap-1.5 mt-1">
                    <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full border', roleConfig.color)}>
                      {roleConfig.label}
                    </span>
                    <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full border', statusConfig.color)}>
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
                          onEdit(member);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Edit2 className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Calendar className="h-4 w-4" />
                        Ver Horario
                      </button>
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
                <span>{member.phone}</span>
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
// WEEKLY SCHEDULES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function WeeklySchedulesTab({ members }: { members: TeamMember[] }) {
  const { data: schedulesData, isLoading } = useQuery({
    queryKey: ['all-schedules'],
    queryFn: async () => {
      const res = await fetch('/api/employees/schedule/all');
      if (!res.ok) throw new Error('Error fetching schedules');
      return res.json();
    },
  });

  const schedules = schedulesData?.data?.schedules || [];

  const getScheduleForDay = (userId: string, dayOfWeek: number) => {
    const schedule = schedules.find(
      (s: any) => s.userId === userId && s.dayOfWeek === dayOfWeek
    );
    if (schedule?.isAvailable) {
      return `${schedule.startTime} - ${schedule.endTime}`;
    }
    return 'Libre';
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
              return (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-medium">
                        {getInitials(member.name)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{member.name}</p>
                        <span className={cn('px-1.5 py-0.5 text-xs font-medium rounded', roleConfig.color)}>
                          {roleConfig.label}
                        </span>
                      </div>
                    </div>
                  </td>
                  {DAYS_OF_WEEK.map((day) => {
                    const schedule = getScheduleForDay(member.id, day.id);
                    const isAvailable = schedule !== 'Libre';
                    return (
                      <td
                        key={day.id}
                        className={cn(
                          'px-3 py-3 text-center text-xs',
                          isAvailable ? 'text-gray-700' : 'text-gray-400'
                        )}
                      >
                        {schedule}
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

const SKILL_LEVEL_OPTIONS = [
  { value: '', label: 'Sin nivel asignado' },
  { value: 'AYUDANTE', label: 'Ayudante' },
  { value: 'MEDIO_OFICIAL', label: 'Medio Oficial' },
  { value: 'OFICIAL', label: 'Oficial' },
  { value: 'OFICIAL_ESPECIALIZADO', label: 'Oficial Especializado' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM MEMBER MODAL (Add/Edit)
// ═══════════════════════════════════════════════════════════════════════════════

interface TeamMemberModalProps {
  member: TeamMember | null;
  currentUserId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function TeamMemberModal({ member, currentUserId, onClose, onSuccess }: TeamMemberModalProps) {
  const [formData, setFormData] = useState({
    name: member?.name || '',
    countryCode: '+54',
    phone: member?.phone?.replace(/^\+54/, '') || '',
    email: member?.email || '',
    role: member?.role || 'TECHNICIAN',
    specialty: member?.specialty || '',
    skillLevel: member?.skillLevel || '',
    isActive: member?.isActive ?? true,
    sendWelcome: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = member?.role === 'OWNER';
  const isEditing = !!member;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Combine country code with phone number
      const fullPhone = formData.countryCode + formData.phone.replace(/\D/g, '');

      const url = member ? `/api/users/${member.id}` : '/api/users';
      const method = member ? 'PUT' : 'POST';

      const payload: any = {
        name: formData.name,
        phone: fullPhone,
        email: formData.email,
        role: formData.role,
        specialty: formData.specialty || null,
        skillLevel: formData.skillLevel || null,
        isActive: formData.isActive,
      };

      // Only include sendWelcome for new users
      if (!member) {
        payload.sendWelcome = formData.sendWelcome;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || 'Error al guardar');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl my-8">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {member ? 'Editar Empleado' : 'Nuevo miembro'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="Nombre completo"
              required
            />
          </div>

          {/* Phone with country code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono *
            </label>
            <div className="flex gap-2">
              <select
                value={formData.countryCode}
                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                className="input w-24 flex-shrink-0"
                disabled={isEditing}
              >
                <option value="+54">AR +54</option>
                <option value="+1">US +1</option>
                <option value="+56">CL +56</option>
                <option value="+598">UY +598</option>
                <option value="+55">BR +55</option>
                <option value="+52">MX +52</option>
              </select>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input flex-1"
                placeholder="11 1234 5678"
                required
                disabled={isEditing}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {isEditing ? 'El teléfono no se puede cambiar' : 'Ej: 11 1234 5678 (10-11 dígitos)'}
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input w-full"
              placeholder="email@ejemplo.com"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Se enviará una notificación al empleado
            </p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as TeamMember['role'] })}
              className="input w-full"
              disabled={isOwner}
            >
              <option value="TECHNICIAN">Técnico</option>
              <option value="DISPATCHER">Despachador</option>
              {isOwner && <option value="OWNER">Dueño</option>}
            </select>
          </div>

          {/* Specialty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Especialidad
            </label>
            <select
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              className="input w-full"
            >
              {SPECIALTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Oficio o área de trabajo del empleado
            </p>
          </div>

          {/* Skill Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nivel de Calificación
            </label>
            <select
              value={formData.skillLevel}
              onChange={(e) => setFormData({ ...formData, skillLevel: e.target.value })}
              className="input w-full"
            >
              {SKILL_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Según categorías UOCRA (CCT 76/75)
            </p>
          </div>

          {/* Active checkbox */}
          <div>
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

          {/* Send welcome message (only for new members) */}
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

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-outline flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
