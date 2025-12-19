'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  Edit2,
  Briefcase,
  MessageCircle,
  Star,
  MapPin,
  ChevronRight,
  ExternalLink,
  Shield,
  Wrench,
} from 'lucide-react';
import { cn, formatPhone, formatDate, getInitials } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
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
  jobCount?: number;
  rating?: number;
}

interface TeamMemberDetailModalProps {
  memberId: string | null;
  onClose: () => void;
  onEdit?: (memberId: string) => void;
}

const ROLE_CONFIG = {
  OWNER: {
    label: 'Dueño',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Shield,
  },
  DISPATCHER: {
    label: 'Despachador',
    color: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: User,
  },
  TECHNICIAN: {
    label: 'Técnico',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    icon: Wrench,
  },
};

const SPECIALTY_LABELS: Record<string, string> = {
  PLOMERO: 'Plomero',
  ELECTRICISTA: 'Electricista',
  GASISTA: 'Gasista',
  CALEFACCIONISTA: 'Calefaccionista',
  REFRIGERACION: 'Refrigeración',
  ALBANIL: 'Albañil',
  PINTOR: 'Pintor',
  CARPINTERO: 'Carpintero',
  TECHISTA: 'Techista',
  HERRERO: 'Herrero',
  SOLDADOR: 'Soldador',
  OTRO: 'Otro',
};

const SKILL_LEVEL_LABELS: Record<string, string> = {
  AYUDANTE: 'Ayudante',
  MEDIO_OFICIAL: 'Medio Oficial',
  OFICIAL: 'Oficial',
  OFICIAL_ESPECIALIZADO: 'Oficial Especializado',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TeamMemberDetailModal({
  memberId,
  onClose,
  onEdit,
}: TeamMemberDetailModalProps) {
  const router = useRouter();

  // Fetch member details
  const { data, isLoading, error } = useQuery({
    queryKey: ['team-member-detail', memberId],
    queryFn: async () => {
      if (!memberId) return null;
      const res = await fetch(`/api/users/${memberId}`);
      if (!res.ok) throw new Error('Error fetching member');
      return res.json();
    },
    enabled: !!memberId,
  });

  const member: TeamMember | null = data?.data || null;

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Don't render if no member selected
  if (!memberId) return null;

  const handleWhatsApp = () => {
    if (member?.phone) {
      const cleanPhone = member.phone.replace(/\D/g, '');
      const whatsappPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
      window.open(`https://wa.me/${whatsappPhone}`, '_blank');
    }
  };

  const handleViewJobs = () => {
    if (member) {
      router.push(`/dashboard/jobs?technician=${member.id}`);
      onClose();
    }
  };

  const handleViewSchedule = () => {
    router.push(`/dashboard/team?tab=schedules`);
    onClose();
  };

  const roleConfig = member?.role ? ROLE_CONFIG[member.role] : ROLE_CONFIG.TECHNICIAN;
  const RoleIcon = roleConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          {isLoading ? (
            <div className="flex items-center gap-4 animate-pulse">
              <div className="h-16 w-16 rounded-full bg-gray-200" />
              <div className="space-y-2">
                <div className="h-5 w-40 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          ) : member ? (
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="h-16 w-16 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                {getInitials(member.name)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">{member.name}</h2>
                  <span className={cn(
                    'px-2.5 py-0.5 text-xs font-medium rounded-full border',
                    roleConfig.color
                  )}>
                    {roleConfig.label}
                  </span>
                  {member.isActive ? (
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 border border-green-200">
                      Activo
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      Inactivo
                    </span>
                  )}
                </div>
                {member.specialty && (
                  <p className="text-sm text-gray-500 mt-1">
                    {SPECIALTY_LABELS[member.specialty] || member.specialty}
                    {member.skillLevel && ` - ${SKILL_LEVEL_LABELS[member.skillLevel] || member.skillLevel}`}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Stats Row */}
        {member && (
          <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50 border-b">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{member.jobCount || 0}</p>
              <p className="text-sm text-gray-500">Trabajos</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className={cn(
                  'h-5 w-5',
                  member.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                )} />
                <p className="text-2xl font-bold text-gray-900">
                  {member.rating ? member.rating.toFixed(1) : '-'}
                </p>
              </div>
              <p className="text-sm text-gray-500">Rating</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {member.createdAt
                  ? Math.floor((Date.now() - new Date(member.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30))
                  : '-'}
              </p>
              <p className="text-sm text-gray-500">Meses</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-4 animate-pulse">
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-red-500">Error al cargar el empleado</p>
            </div>
          ) : member ? (
            <>
              {/* Contact Section */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Contacto
                </h3>
                <div className="space-y-3">
                  {member.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <a href={`mailto:${member.email}`} className="text-sm text-gray-700 hover:text-teal-600">
                        {member.email}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{formatPhone(member.phone)}</span>
                  </div>
                  {member.createdAt && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        Desde: {formatDate(member.createdAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Acciones Rápidas
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleWhatsApp}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </button>
                  <button
                    onClick={handleViewJobs}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                  >
                    <Briefcase className="h-4 w-4" />
                    Ver Trabajos
                  </button>
                  {onEdit && (
                    <button
                      onClick={() => onEdit(memberId!)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </button>
                  )}
                </div>
              </div>

              {/* Schedule Preview */}
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Horario
                </h3>
                <div
                  onClick={handleViewSchedule}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-700">Ver horario completo</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
