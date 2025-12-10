'use client';

/**
 * Profile Page
 * ============
 *
 * Customer profile management page.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  LogOut,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { useCustomerAuth } from '@/lib/customer-auth';
import { formatDate, cn } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const { customer, logout, refreshCustomer } = useCustomerAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    province: '',
  });

  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        province: customer.province || '',
      });
    }
    loadSessions();
  }, [customer]);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    const result = await customerApi.getSessions();
    if (result.success && result.data) {
      setSessions(result.data.sessions || []);
    }
    setIsLoadingSessions(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');

    const result = await customerApi.updateProfile({
      name: formData.name,
      address: formData.address,
      city: formData.city,
      province: formData.province,
    });

    setIsSaving(false);

    if (result.success) {
      setSuccess('Perfil actualizado correctamente');
      setIsEditing(false);
      refreshCustomer();
    } else {
      setError(result.error?.message || 'Error al actualizar el perfil');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const result = await customerApi.revokeSession(sessionId);
    if (result.success) {
      setSessions(sessions.filter((s) => s.id !== sessionId));
    }
  };

  const handleLogoutAll = async () => {
    const result = await customerApi.logoutAllSessions();
    if (result.success) {
      logout();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mi perfil</h1>
        <p className="text-gray-600">
          Gestioná tu información personal y sesiones
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {customer?.name || 'Cliente'}
              </h2>
              <p className="text-sm text-gray-500">
                Cliente desde {formatDate(customer?.createdAt || new Date())}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn-outline text-sm"
          >
            {isEditing ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Nombre</p>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="input mt-1"
                />
              ) : (
                <p className="font-medium text-gray-900">
                  {customer?.name || '-'}
                </p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">
                {customer?.email || '-'}
              </p>
              {!customer?.email && isEditing && (
                <button className="text-sm text-primary-600 hover:text-primary-700 mt-1">
                  + Vincular email
                </button>
              )}
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Teléfono</p>
              <p className="font-medium text-gray-900">
                {customer?.phone || '-'}
              </p>
              {!customer?.phone && isEditing && (
                <button className="text-sm text-primary-600 hover:text-primary-700 mt-1">
                  + Vincular teléfono
                </button>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Dirección</p>
              {isEditing ? (
                <div className="space-y-2 mt-1">
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Dirección"
                    className="input"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder="Ciudad"
                      className="input"
                    />
                    <input
                      type="text"
                      value={formData.province}
                      onChange={(e) =>
                        setFormData({ ...formData, province: e.target.value })
                      }
                      placeholder="Provincia"
                      className="input"
                    />
                  </div>
                </div>
              ) : (
                <p className="font-medium text-gray-900">
                  {customer?.address ? (
                    <>
                      {customer.address}
                      {(customer.city || customer.province) && (
                        <span className="text-gray-500">
                          , {[customer.city, customer.province].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </>
                  ) : (
                    '-'
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Save button */}
          {isEditing && (
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active sessions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Sesiones activas</h2>
          </div>
          <button
            onClick={handleLogoutAll}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Cerrar todas
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {isLoadingSessions ? (
            <div className="p-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
            </div>
          ) : sessions.length > 0 ? (
            sessions.map((session) => (
              <div
                key={session.id}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {session.deviceInfo?.platform || 'Dispositivo desconocido'}
                      {session.isCurrentSession && (
                        <span className="ml-2 text-xs text-green-600">
                          (Esta sesión)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {session.ipAddress} • Último acceso{' '}
                      {formatDate(session.lastUsedAt)}
                    </p>
                  </div>
                </div>
                {!session.isCurrentSession && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Cerrar sesión"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              No hay otras sesiones activas
            </div>
          )}
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 p-4 bg-white rounded-xl border border-gray-200 text-red-600 hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        Cerrar sesión
      </button>
    </div>
  );
}
