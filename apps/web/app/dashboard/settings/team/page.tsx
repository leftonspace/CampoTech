'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatPhone } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Users,
  X,
  Save,
  Shield,
  Wrench,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  ChevronDown,
  Check,
} from 'lucide-react';

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
  isVerified?: boolean;
}

interface PendingVerification {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  createdAt: string;
}

// Argentine construction trade categories (UOCRA CCT 76/75)
const SKILL_LEVELS = {
  AYUDANTE: { label: 'Ayudante', description: 'Tareas generales no calificadas' },
  MEDIO_OFICIAL: { label: 'Medio Oficial', description: 'Conocimientos prácticos básicos' },
  OFICIAL: { label: 'Oficial', description: 'Trabajador calificado' },
  OFICIAL_ESPECIALIZADO: { label: 'Oficial Especializado', description: 'Nivel máximo de especialización' },
};

const TRADE_SPECIALTIES = {
  PLOMERO: { label: 'Plomero', icon: 'ðŸ”§' },
  ELECTRICISTA: { label: 'Electricista', icon: 'âš¡' },
  GASISTA: { label: 'Gasista', icon: 'ðŸ”¥' },
  CALEFACCIONISTA: { label: 'Calefaccionista', icon: '🌍¡ï¸' },
  REFRIGERACION: { label: 'Refrigeración/HVAC', icon: 'â„ï¸' },
  ALBANIL: { label: 'Albañil', icon: 'ðŸ§±' },
  PINTOR: { label: 'Pintor', icon: 'ðŸŽ¨' },
  CARPINTERO: { label: 'Carpintero', icon: 'ðŸªš' },
  TECHISTA: { label: 'Techista', icon: 'ðŸ ' },
  HERRERO: { label: 'Herrero', icon: 'ðŸ”¨' },
  SOLDADOR: { label: 'Soldador', icon: 'ðŸ”¥' },
  OTRO: { label: 'Otro', icon: 'ðŸ› ï¸' },
};

const ROLE_CONFIG = {
  OWNER: {
    label: 'Dueño',
    icon: Shield,
    color: 'text-purple-600 bg-purple-50',
    description: 'Acceso completo: facturación, equipo, configuración',
  },
  DISPATCHER: {
    label: 'Despachador',
    icon: Users,
    color: 'text-orange-600 bg-orange-50',
    description: 'Trabajos, clientes, WhatsApp, inventario (sin facturación)',
  },
  TECHNICIAN: {
    label: 'Técnico',
    icon: Wrench,
    color: 'text-green-600 bg-green-50',
    description: 'Solo sus trabajos asignados, uso de inventario',
  },
};

export default function TeamSettingsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showPendingVerifications, setShowPendingVerifications] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => api.users.list(),
  });

  const members = (data?.data as TeamMember[]) || [];

  // Fetch pending verifications
  const { data: pendingData, isLoading: _pendingLoading } = useQuery({
    queryKey: ['pending-verifications'],
    queryFn: async () => {
      const response = await fetch('/api/users/pending-verifications');
      return response.json();
    },
    enabled: currentUser?.role === 'OWNER',
  });

  const pendingVerifications = (pendingData?.data as PendingVerification[]) || [];

  // Manual verify mutation
  const manualVerifyMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/users/pending-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manual-verify', userId }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['users-all'] });
    },
  });

  // Resend code mutation
  const resendCodeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/users/pending-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend-code', userId }),
      });
      return response.json();
    },
    onSuccess: () => {
      alert('Código de verificación reenviado');
    },
  });

  const [_mutationError, setMutationError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<TeamMember>) => {
      const result = await api.users.create(data);
      if (!result.success) {
        // Handle both string and object error formats
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Error al crear usuario';
        throw new Error(errorMsg);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-all'] });
      setShowModal(false);
      setEditingMember(null);
      setMutationError(null);
    },
    onError: (error: Error) => {
      setMutationError(error.message);
      alert(`Error: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TeamMember> }) => {
      const result = await api.users.update(id, data);
      if (!result.success) {
        // Handle both string and object error formats
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Error al actualizar usuario';
        throw new Error(errorMsg);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-all'] });
      setShowModal(false);
      setEditingMember(null);
      setMutationError(null);
    },
    onError: (error: Error) => {
      setMutationError(error.message);
      alert(`Error: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-all'] });
    },
  });

  const handleOpenModal = (member?: TeamMember) => {
    setEditingMember(member || null);
    setShowModal(true);
  };

  const handleDelete = (member: TeamMember) => {
    if (member.role === 'OWNER') {
      alert('No se puede eliminar al propietario');
      return;
    }
    if (member.id === currentUser?.id) {
      alert('No te podés eliminar a vos mismo');
      return;
    }
    if (confirm(`¿Estás seguro de eliminar a ${member.name}?`)) {
      deleteMutation.mutate(member.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
          <p className="text-gray-500">Gestión de usuarios y roles</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo miembro
        </button>
      </div>

      {/* Role legend */}
      <div className="card p-4">
        <h3 className="mb-3 font-medium text-gray-900">Roles disponibles</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(ROLE_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div key={key} className="flex items-start gap-2">
                <div className={`rounded p-1 ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{config.label}</p>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending verifications */}
      {['OWNER', 'DISPATCHER'].includes(currentUser?.role?.toUpperCase() || '') && pendingVerifications.length > 0 && (
        <div className="card overflow-hidden border-yellow-200 bg-yellow-50">
          <div
            className="flex cursor-pointer items-center justify-between p-4"
            onClick={() => setShowPendingVerifications(!showPendingVerifications)}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <h3 className="font-medium text-yellow-900">
                Verificaciones pendientes ({pendingVerifications.length})
              </h3>
            </div>
            <span className="text-sm text-yellow-700">
              {showPendingVerifications ? 'Ocultar' : 'Mostrar'}
            </span>
          </div>

          {showPendingVerifications && (
            <div className="border-t border-yellow-200 bg-white">
              <div className="divide-y divide-gray-100">
                {pendingVerifications.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">{formatPhone(user.phone)}</p>
                        <p className="text-xs text-gray-400">
                          Agregado {new Date(user.createdAt).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => resendCodeMutation.mutate(user.id)}
                        disabled={resendCodeMutation.isPending}
                        className="flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        title="Reenviar código por WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Reenviar código
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Verificar manualmente a ${user.name}?`)) {
                            manualVerifyMutation.mutate(user.id);
                          }
                        }}
                        disabled={manualVerifyMutation.isPending}
                        className="flex items-center gap-1 rounded-md bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
                        title="Verificar manualmente"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Verificar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Miembro
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Contacto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Especialidad / Nivel
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Rol
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                    </td>
                  </tr>
                ))
              ) : members.length ? (
                members.map((member) => {
                  const roleConfig = ROLE_CONFIG[member.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.TECHNICIAN;
                  const RoleIcon = roleConfig.icon;
                  const isCurrentUser = member.id === currentUser?.id;
                  const specialtyConfig = member.specialty ? TRADE_SPECIALTIES[member.specialty as keyof typeof TRADE_SPECIALTIES] : null;
                  const skillLevelConfig = member.skillLevel ? SKILL_LEVELS[member.skillLevel as keyof typeof SKILL_LEVELS] : null;

                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600 font-medium">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.name}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-gray-500">(vos)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="text-gray-900">{formatPhone(member.phone)}</p>
                        {member.email && (
                          <p className="text-sm text-gray-500">{member.email}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {specialtyConfig ? (
                          <div>
                            <p className="text-gray-900">
                              <span className="mr-1">{specialtyConfig.icon}</span>
                              {specialtyConfig.label}
                            </p>
                            {skillLevelConfig && (
                              <p className="text-xs text-gray-500">{skillLevelConfig.label}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${roleConfig.color}`}
                        >
                          <RoleIcon className="h-3 w-3" />
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${member.isActive !== false
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-50 text-gray-600'
                            }`}
                        >
                          {member.isActive !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleOpenModal(member)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {member.role !== 'OWNER' && !isCurrentUser && (
                            <button
                              onClick={() => handleDelete(member)}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <Users className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2">No hay miembros en el equipo</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <TeamMemberModal
          member={editingMember}
          currentUserId={currentUser?.id}
          onClose={() => {
            setShowModal(false);
            setEditingMember(null);
          }}
          onSave={(data) => {
            if (editingMember) {
              updateMutation.mutate({ id: editingMember.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}

interface TeamMemberModalProps {
  member: TeamMember | null;
  currentUserId?: string;
  onClose: () => void;
  onSave: (data: Partial<TeamMember>) => void;
  isLoading: boolean;
}

// Country codes for phone input - Top 10 most relevant + Other
// Using ISO country codes for flag images from flagcdn.com
const COUNTRY_CODES = [
  { code: '+54', country: 'Argentina', iso: 'ar', minDigits: 8, maxDigits: 10, example: '11 1234 5678' },
  { code: '+56', country: 'Chile', iso: 'cl', minDigits: 8, maxDigits: 9, example: '9 1234 5678' },
  { code: '+598', country: 'Uruguay', iso: 'uy', minDigits: 7, maxDigits: 8, example: '94 123 456' },
  { code: '+595', country: 'Paraguay', iso: 'py', minDigits: 8, maxDigits: 9, example: '981 123 456' },
  { code: '+55', country: 'Brasil', iso: 'br', minDigits: 10, maxDigits: 11, example: '11 91234 5678' },
  { code: '+591', country: 'Bolivia', iso: 'bo', minDigits: 7, maxDigits: 8, example: '7 123 4567' },
  { code: '+51', country: 'Perú', iso: 'pe', minDigits: 8, maxDigits: 9, example: '912 345 678' },
  { code: '+57', country: 'Colombia', iso: 'co', minDigits: 9, maxDigits: 10, example: '310 123 4567' },
  { code: '+52', country: 'México', iso: 'mx', minDigits: 9, maxDigits: 10, example: '55 1234 5678' },
  { code: '+1', country: 'USA/Canadá', iso: 'us', minDigits: 10, maxDigits: 10, example: '(555) 123-4567' },
  // Other option - allows any custom country code
  { code: 'OTHER', country: 'Otro', iso: 'un', minDigits: 6, maxDigits: 15, example: '123 456 7890' },
];

// Flag image component using flagcdn.com
function FlagImage({ iso, size = 20 }: { iso: string; size?: number }) {
  // For "Otro" option, show globe emoji
  if (iso === 'un') {
    return (
      <span
        className="flex items-center justify-center rounded-sm"
        style={{ width: size, height: Math.round(size * 0.75), fontSize: size * 0.8 }}
      >
        🌍
      </span>
    );
  }

  return (
    <Image
      src={`https://flagcdn.com/w20/${iso.toLowerCase()}.png`}
      alt={`${iso} flag`}
      width={size}
      height={Math.round(size * 0.75)}
    />
  );
}

function TeamMemberModal({
  member,
  currentUserId,
  onClose,
  onSave,
  isLoading,
}: TeamMemberModalProps) {
  const isOwner = member?.role === 'OWNER';
  const isSelf = member?.id === currentUserId;

  const [countryCode, setCountryCode] = useState('+54');
  const [customCountryCode, setCustomCountryCode] = useState(''); // For "Otro" option
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: member?.name || '',
    phone: member?.phone?.replace(/^\+\d+/, '') || '',
    email: member?.email || '',
    role: member?.role || 'TECHNICIAN',
    specialty: member?.specialty || '',
    skillLevel: member?.skillLevel || '',
    isActive: member?.isActive ?? true,
    sendNotification: !member, // Default to true for new users only
  });

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCountryPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get the actual country code (from list or custom)
  const getActualCountryCode = () => {
    if (countryCode === 'OTHER') {
      return customCountryCode.startsWith('+') ? customCountryCode : `+${customCountryCode}`;
    }
    return countryCode;
  };

  const validatePhone = (phone: string): string | null => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < selectedCountry.minDigits) {
      return `El teléfono debe tener al menos ${selectedCountry.minDigits} dígitos para ${selectedCountry.country}`;
    }
    if (digits.length > selectedCountry.maxDigits) {
      return `El teléfono no puede tener más de ${selectedCountry.maxDigits} dígitos para ${selectedCountry.country}`;
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone for new users
    if (!member) {
      // Require custom country code when "Otro" is selected
      if (countryCode === 'OTHER' && !customCountryCode) {
        setPhoneError('Por favor, ingresá un código de país');
        return;
      }
      const error = validatePhone(formData.phone);
      if (error) {
        setPhoneError(error);
        return;
      }
    }
    setPhoneError(null);

    const actualCode = getActualCountryCode();
    const fullPhone = member ? formData.phone : `${actualCode}${formData.phone.replace(/\D/g, '')}`;
    onSave({
      name: formData.name,
      phone: fullPhone,
      email: formData.email,
      role: formData.role as TeamMember['role'],
      specialty: formData.specialty || undefined,
      skillLevel: formData.skillLevel || undefined,
      isActive: formData.isActive,
      sendNotification: !member && formData.sendNotification,
    } as Partial<TeamMember> & { sendNotification?: boolean });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-medium text-gray-900">
            {member ? 'Editar miembro' : 'Nuevo miembro'}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="label mb-1 block">
                Nombre *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre completo"
                className="input"
                required
                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el nombre')}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
              />
            </div>

            <div>
              <label htmlFor="phone" className="label mb-1 block">
                Teléfono *
              </label>
              {member ? (
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                  required
                  disabled
                />
              ) : (
                <div className="flex rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2">
                  {/* Country Selector with Flag */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowCountryPicker(!showCountryPicker)}
                      className="flex items-center gap-1.5 h-10 px-3 border-r border-gray-300 bg-gray-50 rounded-l-md hover:bg-gray-100 transition-colors focus:outline-none"
                    >
                      <FlagImage iso={selectedCountry.iso} size={20} />
                      <span className="text-sm text-gray-700 font-medium">
                        {countryCode === 'OTHER' ? 'Otro' : countryCode}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </button>

                    {/* Country Dropdown */}
                    {showCountryPicker && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
                        <div className="p-2 border-b border-gray-100">
                          <span className="text-xs font-medium text-gray-500 uppercase">Seleccionar país</span>
                        </div>
                        {COUNTRY_CODES.map((country) => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => {
                              setCountryCode(country.code);
                              setPhoneError(null);
                              setShowCountryPicker(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                          >
                            <FlagImage iso={country.iso} size={20} />
                            <span className="flex-1 text-left text-sm text-gray-700">{country.country}</span>
                            <span className="text-sm text-gray-500">
                              {country.code === 'OTHER' ? 'Otro' : country.code}
                            </span>
                            {country.code === countryCode && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Custom Country Code Input (shown when "Otro" is selected) */}
                  {countryCode === 'OTHER' && (
                    <input
                      type="text"
                      value={customCountryCode}
                      onChange={(e) => {
                        // Only allow + and numbers
                        const value = e.target.value.replace(/[^+\d]/g, '');
                        // Ensure + is only at the start
                        const cleaned = value.startsWith('+')
                          ? '+' + value.slice(1).replace(/\+/g, '')
                          : value.replace(/\+/g, '');
                        setCustomCountryCode(cleaned);
                      }}
                      placeholder="+XX"
                      className="w-16 h-10 px-2 text-sm text-center border-r border-gray-300 bg-transparent placeholder:text-gray-400 focus:outline-none"
                      maxLength={5}
                    />
                  )}

                  {/* Phone Input */}
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') });
                      setPhoneError(null);
                    }}
                    placeholder={selectedCountry.example}
                    className="flex-1 h-10 px-3 py-2 text-sm bg-transparent placeholder:text-gray-400 focus:outline-none"
                    required
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el teléfono')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  />
                </div>
              )}
              {countryCode === 'OTHER' && !member && (
                <p className="mt-1 text-xs text-gray-500">
                  Ingresá el código de país (ej: +34 para España, +49 para Alemania)
                </p>
              )}
              {phoneError && (
                <p className="mt-1 text-xs text-red-600">{phoneError}</p>
              )}
              {!phoneError && !member && countryCode !== 'OTHER' && (
                <p className="mt-1 text-xs text-gray-500">
                  Ej: {selectedCountry.example} ({selectedCountry.minDigits}-{selectedCountry.maxDigits} dígitos)
                </p>
              )}
              {member && (
                <p className="mt-1 text-xs text-gray-500">
                  El teléfono no se puede cambiar
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="label mb-1 block">
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@ejemplo.com"
                className="input"
                required
                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el email')}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
              />
              <p className="mt-1 text-xs text-gray-500">
                Se enviará una notificación al empleado
              </p>
            </div>

            <div>
              <label htmlFor="role" className="label mb-1 block">
                Rol
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as TeamMember['role'] })}
                className="input"
                disabled={isOwner}
              >
                <option value="DISPATCHER">Despachador</option>
                <option value="TECHNICIAN">Técnico</option>
                {isOwner && <option value="OWNER">Propietario</option>}
              </select>
              {isOwner && (
                <p className="mt-1 text-xs text-gray-500">
                  El rol de propietario no se puede cambiar
                </p>
              )}
            </div>

            <div>
              <label htmlFor="specialty" className="label mb-1 block">
                Especialidad
              </label>
              <select
                id="specialty"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                className="input"
              >
                <option value="">Sin especialidad</option>
                {Object.entries(TRADE_SPECIALTIES).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {config.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Oficio o área de trabajo del empleado
              </p>
            </div>

            <div>
              <label htmlFor="skillLevel" className="label mb-1 block">
                Nivel de Calificación
              </label>
              <select
                id="skillLevel"
                value={formData.skillLevel}
                onChange={(e) => setFormData({ ...formData, skillLevel: e.target.value })}
                className="input"
              >
                <option value="">Sin nivel asignado</option>
                {Object.entries(SKILL_LEVELS).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Según categorías UOCRA (CCT 76/75)
              </p>
            </div>

            {!isSelf && (
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="rounded text-primary-600"
                  />
                  <span className="text-sm text-gray-700">Usuario activo</span>
                </label>
              </div>
            )}

            {!member && (
              <div className="rounded-lg bg-green-50 p-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.sendNotification}
                    onChange={(e) =>
                      setFormData({ ...formData, sendNotification: e.target.checked })
                    }
                    className="rounded text-primary-600"
                  />
                  <span className="text-sm font-medium text-green-900">
                    Enviar bienvenida y código de verificación
                  </span>
                </label>
                <p className="mt-1 ml-6 text-xs text-green-700">
                  Se enviará por WhatsApp un mensaje de bienvenida con código de verificación (6 dígitos)
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary">
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
