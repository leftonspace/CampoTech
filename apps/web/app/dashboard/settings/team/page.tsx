'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
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
  Eye,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'OWNER' | 'ADMIN' | 'TECHNICIAN' | 'VIEWER';
  isActive: boolean;
  createdAt: string;
}

const ROLE_CONFIG = {
  OWNER: {
    label: 'Propietario',
    icon: Shield,
    color: 'text-purple-600 bg-purple-50',
    description: 'Acceso completo, no se puede eliminar',
  },
  ADMIN: {
    label: 'Administrador',
    icon: Shield,
    color: 'text-blue-600 bg-blue-50',
    description: 'Acceso completo excepto configuración de propietario',
  },
  TECHNICIAN: {
    label: 'Técnico',
    icon: Wrench,
    color: 'text-green-600 bg-green-50',
    description: 'Puede ver y gestionar trabajos asignados',
  },
  VIEWER: {
    label: 'Visualizador',
    icon: Eye,
    color: 'text-gray-600 bg-gray-50',
    description: 'Solo puede ver información, sin edición',
  },
};

export default function TeamSettingsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => api.users.list(),
  });

  const members = (data?.data as TeamMember[]) || [];

  const createMutation = useMutation({
    mutationFn: (data: Partial<TeamMember>) => api.users.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-all'] });
      setShowModal(false);
      setEditingMember(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TeamMember> }) =>
      api.users.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-all'] });
      setShowModal(false);
      setEditingMember(null);
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
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                    </td>
                  </tr>
                ))
              ) : members.length ? (
                members.map((member) => {
                  const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.VIEWER;
                  const RoleIcon = roleConfig.icon;
                  const isCurrentUser = member.id === currentUser?.id;

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
                        <p className="text-gray-900">{member.phone}</p>
                        {member.email && (
                          <p className="text-sm text-gray-500">{member.email}</p>
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
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            member.isActive !== false
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
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
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

// Country codes for phone input
const COUNTRY_CODES = [
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
];

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
  const [formData, setFormData] = useState({
    name: member?.name || '',
    phone: member?.phone?.replace(/^\+\d+/, '') || '',
    email: member?.email || '',
    role: member?.role || 'TECHNICIAN',
    isActive: member?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullPhone = member ? formData.phone : `${countryCode}${formData.phone.replace(/\D/g, '')}`;
    onSave({
      name: formData.name,
      phone: fullPhone,
      email: formData.email || undefined,
      role: formData.role as TeamMember['role'],
      isActive: formData.isActive,
    });
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
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="input w-32 px-2"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="11 1234 5678"
                    className="input flex-1"
                    required
                  />
                </div>
              )}
              {member && (
                <p className="mt-1 text-xs text-gray-500">
                  El teléfono no se puede cambiar
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="label mb-1 block">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@ejemplo.com"
                className="input"
              />
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
                <option value="ADMIN">Administrador</option>
                <option value="TECHNICIAN">Técnico</option>
                <option value="VIEWER">Visualizador</option>
                {isOwner && <option value="OWNER">Propietario</option>}
              </select>
              {isOwner && (
                <p className="mt-1 text-xs text-gray-500">
                  El rol de propietario no se puede cambiar
                </p>
              )}
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
