'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Save, User, Mail, Shield } from 'lucide-react';
import { PermissionField, FieldMeta } from '@/components/ui/permission-field';
import { LockedField, LockedFieldGroup } from '@/components/ui/locked-field';

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: string;
  specialty?: string | null;
  skillLevel?: string | null;
  avatar?: string | null;
  isActive: boolean;
  createdAt: string;
  organization?: {
    id: string;
    name: string;
  };
}

interface ProfileResponse {
  success: boolean;
  data: UserProfile;
  _fieldMeta: Record<string, FieldMeta>;
  error?: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  DISPATCHER: 'Despachador',
  TECHNICIAN: 'Tecnico',
};

const SKILL_LEVELS: { value: string; label: string }[] = [
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'SEMI_SENIOR', label: 'Semi-Senior' },
  { value: 'SENIOR', label: 'Senior' },
  { value: 'LEAD', label: 'Lead' },
];

async function fetchProfile(): Promise<ProfileResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/users/me/profile', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  return res.json();
}

async function updateProfile(data: Partial<UserProfile>): Promise<ProfileResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/users/me/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: '',
    email: '',
    avatar: '',
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  });

  const profile = data?.data;
  const fieldMeta = data?._fieldMeta || {};

  // Default field metadata if not available
  const getFieldMeta = (fieldName: string): FieldMeta => {
    return fieldMeta[fieldName] || { visible: true, editable: false, locked: true };
  };

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        avatar: profile.avatar || '',
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (response) => {
      if (response.success) {
        setSuccess('Perfil actualizado correctamente');
        setHasChanges(false);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Error al guardar');
      }
    },
    onError: () => {
      setError('Error al guardar los datos');
    },
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setError('');
    setSuccess('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-md bg-danger-50 p-4 text-danger-700">
          Error cargando perfil. Por favor intenta de nuevo.
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-gray-500">Gestioná tu información personal</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Summary Card */}
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
              {profile.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={profile.name}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <User className="h-8 w-8 text-primary-600" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">{profile.name}</h2>
              <p className="text-gray-500">{ROLE_LABELS[profile.role] || profile.role}</p>
              {profile.organization && (
                <p className="text-sm text-gray-400">{profile.organization.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-400" />
            <h2 className="font-medium text-gray-900">Información personal</h2>
          </div>

          <div className="space-y-4">
            <PermissionField
              name="name"
              label="Nombre"
              value={formData.name}
              meta={getFieldMeta('name')}
              onChange={(value) => handleChange('name', value)}
              placeholder="Tu nombre completo"
            />

            <PermissionField
              name="email"
              label="Email"
              value={formData.email}
              meta={getFieldMeta('email')}
              onChange={(value) => handleChange('email', value)}
              type="email"
              placeholder="tu@email.com"
            />

            <PermissionField
              name="avatar"
              label="URL de avatar"
              value={formData.avatar}
              meta={getFieldMeta('avatar')}
              onChange={(value) => handleChange('avatar', value)}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Locked Fields */}
        <LockedFieldGroup
          title="Datos del sistema"
          description="Estos campos son gestionados por el administrador y no pueden ser modificados directamente."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <LockedField
              label="Telefono"
              value={profile.phone}
              message="El telefono es tu identificador principal y no puede ser modificado."
            />
            <LockedField
              label="Rol"
              value={ROLE_LABELS[profile.role] || profile.role}
              message="Tu rol es asignado por el administrador."
            />
            {profile.specialty && (
              <LockedField
                label="Especialidad"
                value={profile.specialty}
              />
            )}
            {profile.skillLevel && (
              <LockedField
                label="Nivel"
                value={SKILL_LEVELS.find(s => s.value === profile.skillLevel)?.label || profile.skillLevel}
              />
            )}
          </div>
        </LockedFieldGroup>

        {/* Account Information */}
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-400" />
            <h2 className="font-medium text-gray-900">Cuenta</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-500">Estado</label>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${profile.isActive ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'
                }`}>
                <span className={`h-2 w-2 rounded-full ${profile.isActive ? 'bg-success-500' : 'bg-danger-500'}`} />
                {profile.isActive ? 'Activo' : 'Inactivo'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-500">Miembro desde</label>
              <p className="text-gray-900">{formatDate(profile.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="card p-6">
          <h2 className="font-medium text-gray-900 mb-4">Configuracion adicional</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/dashboard/settings/privacy"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Shield className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Privacidad</p>
                <p className="text-sm text-gray-500">Gestioná tus datos</p>
              </div>
            </Link>
            <Link
              href="/dashboard/settings/notifications"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Notificaciones</p>
                <p className="text-sm text-gray-500">Preferencias de alertas</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="rounded-md bg-danger-50 p-4 text-danger-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md bg-success-50 p-4 text-success-700">
            {success}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Link href="/dashboard" className="btn-outline">
            Volver
          </Link>
          <button
            type="submit"
            disabled={updateMutation.isPending || !hasChanges}
            className="btn-primary"
          >
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
