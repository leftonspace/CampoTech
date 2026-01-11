'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  X,
  Truck,
  User,
  Calendar,
  Edit2,
  FileText,
  Settings,
  AlertTriangle,
  CheckCircle,
  Fuel,
  Gauge,
  MessageCircle,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { cn, formatPhone, getInitials } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface VehicleAssignment {
  id: string;
  isPrimaryDriver: boolean;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    phone: string;
  };
}

interface Vehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  vin: string | null;
  notes: string | null;
  status: string;
  fuelType: string;
  currentMileage: number | null;
  insuranceExpiry: string | null;
  vtvExpiry: string | null;
  registrationExpiry: string | null;
  assignments: VehicleAssignment[];
  complianceAlerts: string[];
  isCompliant: boolean;
  _count: {
    documents: number;
    maintenanceLogs: number;
  };
}

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  phone: string;
}

interface VehicleDetailModalProps {
  vehicleId: string | null;
  onClose: () => void;
  onEdit?: (vehicleId: string) => void;
  onRefresh?: () => void;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'Activo', color: 'text-green-700', bgColor: 'bg-green-100' },
  MAINTENANCE: { label: 'Mantenimiento', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  INACTIVE: { label: 'Inactivo', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const fuelTypeLabels: Record<string, string> = {
  GASOLINE: 'Nafta',
  NAFTA: 'Nafta',
  DIESEL: 'Diesel',
  GNC: 'GNC',
  ELECTRIC: 'Eléctrico',
  ELECTRICO: 'Eléctrico',
  HYBRID: 'Híbrido',
  HIBRIDO: 'Híbrido',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return 'No especificado';
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getDaysUntil(dateString: string | null): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function VehicleDetailModal({
  vehicleId,
  onClose,
  onEdit,
  onRefresh,
}: VehicleDetailModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAssignDriver, setShowAssignDriver] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // Fetch vehicle details
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vehicle-detail', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return null;
      const res = await fetch(`/api/vehicles/${vehicleId}`);
      if (!res.ok) throw new Error('Error fetching vehicle');
      return res.json();
    },
    enabled: !!vehicleId,
  });

  // Fetch team members for driver assignment
  const { data: teamData } = useQuery({
    queryKey: ['team-members-drivers'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Error fetching team');
      return res.json();
    },
    enabled: showAssignDriver,
  });
  const teamMembers: TeamMember[] = teamData?.data || [];

  const vehicle: Vehicle | null = data?.data || null;

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Don't render if no vehicle selected
  if (!vehicleId) return null;

  const handleViewFull = () => {
    router.push(`/dashboard/fleet/${vehicleId}`);
    onClose();
  };

  const handleEdit = () => {
    router.push(`/dashboard/fleet/${vehicleId}/edit`);
    onClose();
  };

  const handleViewDocuments = () => {
    router.push(`/dashboard/fleet/${vehicleId}?tab=documents`);
    onClose();
  };

  const handleViewMaintenance = () => {
    router.push(`/dashboard/fleet/${vehicleId}?tab=maintenance`);
    onClose();
  };

  const handleWhatsAppDriver = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
    window.open(`https://wa.me/${whatsappPhone}`, '_blank');
  };

  // Assign driver
  const handleAssignDriver = async () => {
    if (!selectedDriverId) return;
    setIsAssigning(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedDriverId, isPrimaryDriver: true }),
      });
      if (res.ok) {
        setShowAssignDriver(false);
        setSelectedDriverId('');
        refetch();
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
        onRefresh?.();
      }
    } catch (err) {
      console.error('Error assigning driver:', err);
    }
    setIsAssigning(false);
  };

  // Remove driver
  const handleRemoveDriver = async (userId: string) => {
    setIsRemoving(userId);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/assign?userId=${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
        onRefresh?.();
      }
    } catch (err) {
      console.error('Error removing driver:', err);
    }
    setIsRemoving(null);
  };

  const status = vehicle?.status ? statusConfig[vehicle.status] : statusConfig.INACTIVE;
  const primaryDriver = vehicle?.assignments?.find((a) => a.isPrimaryDriver);
  const otherDrivers = vehicle?.assignments?.filter((a) => !a.isPrimaryDriver) || [];
  const insuranceDays = vehicle ? getDaysUntil(vehicle.insuranceExpiry) : null;
  const vtvDays = vehicle ? getDaysUntil(vehicle.vtvExpiry) : null;
  const registrationDays = vehicle ? getDaysUntil(vehicle.registrationExpiry) : null;

  // Filter out already assigned drivers
  const assignedUserIds = vehicle?.assignments?.map((a) => a.user.id) || [];
  const availableDrivers = teamMembers.filter((m) => !assignedUserIds.includes(m.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          {isLoading ? (
            <div className="flex items-center gap-4 animate-pulse">
              <div className="h-12 w-12 rounded-lg bg-gray-200" />
              <div className="space-y-2">
                <div className="h-5 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-48 bg-gray-200 rounded" />
              </div>
            </div>
          ) : vehicle ? (
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Truck className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">{vehicle.plateNumber}</h2>
                  <span className={cn(
                    'px-2.5 py-0.5 text-xs font-medium rounded-full',
                    status.bgColor,
                    status.color
                  )}>
                    {status.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {vehicle.make} {vehicle.model} ({vehicle.year})
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              title="Editar"
            >
              <Edit2 className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

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
              <p className="text-red-500">Error al cargar el vehículo</p>
            </div>
          ) : vehicle ? (
            <>
              {/* Compliance Alert */}
              {!vehicle.isCompliant && vehicle.complianceAlerts.length > 0 && (
                <div className="mx-6 mt-6 rounded-lg bg-red-50 p-4 border border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Alertas de cumplimiento</p>
                      <ul className="mt-1 text-sm text-red-700 space-y-1">
                        {vehicle.complianceAlerts.map((alert, i) => (
                          <li key={i}>• {alert.replace('_', ' ')}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {vehicle.isCompliant && (
                <div className="mx-6 mt-6 flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Vehículo en cumplimiento</span>
                </div>
              )}

              {/* Two-column layout for details */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Vehicle Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Detalles del Vehículo
                  </h3>
                  <div className="space-y-3">
                    {vehicle.color && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Color</span>
                        <span className="text-gray-900">{vehicle.color}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Combustible</span>
                      <span className="text-gray-900 flex items-center gap-1">
                        <Fuel className="h-4 w-4 text-gray-400" />
                        {fuelTypeLabels[vehicle.fuelType] || vehicle.fuelType}
                      </span>
                    </div>
                    {vehicle.currentMileage && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Kilometraje</span>
                        <span className="text-gray-900 flex items-center gap-1">
                          <Gauge className="h-4 w-4 text-gray-400" />
                          {vehicle.currentMileage.toLocaleString('es-AR')} km
                        </span>
                      </div>
                    )}
                    {vehicle.vin && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">VIN/Chasis</span>
                        <span className="text-gray-900 font-mono text-xs">{vehicle.vin}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {vehicle.notes && (
                    <div className="mt-4">
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Notas</h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{vehicle.notes}</p>
                    </div>
                  )}
                </div>

                {/* Right Column: Expiry Dates */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Vencimientos
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> VTV
                      </span>
                      <span className={cn(
                        vtvDays !== null && vtvDays <= 30 ? 'text-red-600 font-medium' : 'text-gray-700'
                      )}>
                        {formatDate(vehicle.vtvExpiry)}
                        {vtvDays !== null && vtvDays <= 30 && vtvDays > 0 && ` (${vtvDays} días)`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> Seguro
                      </span>
                      <span className={cn(
                        insuranceDays !== null && insuranceDays <= 30 ? 'text-red-600 font-medium' : 'text-gray-700'
                      )}>
                        {formatDate(vehicle.insuranceExpiry)}
                        {insuranceDays !== null && insuranceDays <= 30 && insuranceDays > 0 && ` (${insuranceDays} días)`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> Registro
                      </span>
                      <span className={cn(
                        registrationDays !== null && registrationDays <= 30 ? 'text-red-600 font-medium' : 'text-gray-700'
                      )}>
                        {formatDate(vehicle.registrationExpiry)}
                        {registrationDays !== null && registrationDays <= 30 && registrationDays > 0 && ` (${registrationDays} días)`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Driver Section */}
              <div className="px-6 pb-6 border-t pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Conductores Asignados
                  </h3>
                  {!showAssignDriver && (
                    <button
                      onClick={() => setShowAssignDriver(true)}
                      className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Asignar
                    </button>
                  )}
                </div>

                {/* Assign Driver Form (inline) */}
                {showAssignDriver && (
                  <div className="mb-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seleccionar conductor
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedDriverId}
                        onChange={(e) => setSelectedDriverId(e.target.value)}
                        className="input flex-1"
                      >
                        <option value="">Seleccionar...</option>
                        {availableDrivers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAssignDriver}
                        disabled={!selectedDriverId || isAssigning}
                        className="btn-primary px-4"
                      >
                        {isAssigning ? '...' : 'Asignar'}
                      </button>
                      <button
                        onClick={() => {
                          setShowAssignDriver(false);
                          setSelectedDriverId('');
                        }}
                        className="btn-outline px-3"
                      >
                        Cancelar
                      </button>
                    </div>
                    {availableDrivers.length === 0 && (
                      <p className="text-xs text-amber-600 mt-2">
                        No hay empleados disponibles para asignar
                      </p>
                    )}
                  </div>
                )}

                {/* Driver List */}
                {primaryDriver ? (
                  <div className="space-y-2">
                    {/* Primary Driver */}
                    <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg border border-teal-200">
                      <div className="flex items-center gap-3">
                        {primaryDriver.user.avatar ? (
                          <img
                            src={primaryDriver.user.avatar}
                            alt={primaryDriver.user.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium">
                            {getInitials(primaryDriver.user.name)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{primaryDriver.user.name}</p>
                            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                              Principal
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{formatPhone(primaryDriver.user.phone)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleWhatsAppDriver(primaryDriver.user.phone)}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveDriver(primaryDriver.user.id)}
                          disabled={isRemoving === primaryDriver.user.id}
                          className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                          title="Quitar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Other Drivers */}
                    {otherDrivers.map((driver) => (
                      <div key={driver.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-sm">
                            {getInitials(driver.user.name)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{driver.user.name}</p>
                            <p className="text-xs text-gray-500">{formatPhone(driver.user.phone)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveDriver(driver.user.id)}
                          disabled={isRemoving === driver.user.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-gray-500">
                    <User className="h-5 w-5" />
                    <span>Sin conductor asignado</span>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="px-6 pb-6 border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Acciones Rápidas
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleViewDocuments}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <span className="text-sm text-gray-700">Documentos ({vehicle._count?.documents || 0})</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    onClick={handleViewMaintenance}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-gray-400" />
                      <span className="text-sm text-gray-700">Mantenimiento ({vehicle._count?.maintenanceLogs || 0})</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={handleViewFull}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <ExternalLink className="h-4 w-4" />
            Ver página completa
          </button>
          <button onClick={onClose} className="btn-outline">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
