'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Phone,
  ExternalLink,
  ChevronRight,
  MessageCircle,
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

interface VehicleDetailModalProps {
  vehicleId: string | null;
  onClose: () => void;
  onEdit?: (vehicleId: string) => void;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'Activo', color: 'text-green-700', bgColor: 'bg-green-100' },
  MAINTENANCE: { label: 'Mantenimiento', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  INACTIVE: { label: 'Inactivo', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const fuelTypeLabels: Record<string, string> = {
  NAFTA: 'Nafta',
  DIESEL: 'Diesel',
  GNC: 'GNC',
  ELECTRICO: 'Eléctrico',
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
}: VehicleDetailModalProps) {
  const router = useRouter();

  // Fetch vehicle details
  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicle-detail', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return null;
      const res = await fetch(`/api/vehicles/${vehicleId}`);
      if (!res.ok) throw new Error('Error fetching vehicle');
      return res.json();
    },
    enabled: !!vehicleId,
  });

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

  const status = vehicle?.status ? statusConfig[vehicle.status] : statusConfig.INACTIVE;
  const primaryDriver = vehicle?.assignments?.find((a) => a.isPrimaryDriver);
  const insuranceDays = vehicle ? getDaysUntil(vehicle.insuranceExpiry) : null;
  const vtvDays = vehicle ? getDaysUntil(vehicle.vtvExpiry) : null;

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

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
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
                          <li key={i}>• {alert}</li>
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

              {/* Vehicle Details */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Detalles
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {vehicle.color && (
                    <div className="flex items-center gap-2 text-sm">
                      <div
                        className="h-4 w-4 rounded-full border border-gray-300"
                        style={{
                          backgroundColor: vehicle.color.toLowerCase().includes('blanco')
                            ? '#ffffff'
                            : vehicle.color.toLowerCase().includes('negro')
                              ? '#1f2937'
                              : vehicle.color.toLowerCase().includes('gris')
                                ? '#6b7280'
                                : vehicle.color.toLowerCase().includes('azul')
                                  ? '#2563eb'
                                  : '#9ca3af',
                        }}
                      />
                      <span className="text-gray-700">{vehicle.color}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Fuel className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">{fuelTypeLabels[vehicle.fuelType] || vehicle.fuelType}</span>
                  </div>
                  {vehicle.currentMileage && (
                    <div className="flex items-center gap-2 text-sm col-span-2">
                      <Gauge className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">{vehicle.currentMileage.toLocaleString('es-AR')} km</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expiry Dates */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Vencimientos
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">VTV:</span>
                    <span className={cn(
                      vtvDays !== null && vtvDays <= 30 ? 'text-red-600 font-medium' : 'text-gray-700'
                    )}>
                      {formatDate(vehicle.vtvExpiry)}
                      {vtvDays !== null && vtvDays <= 30 && vtvDays > 0 && ` (${vtvDays} días)`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Seguro:</span>
                    <span className={cn(
                      insuranceDays !== null && insuranceDays <= 30 ? 'text-red-600 font-medium' : 'text-gray-700'
                    )}>
                      {formatDate(vehicle.insuranceExpiry)}
                      {insuranceDays !== null && insuranceDays <= 30 && insuranceDays > 0 && ` (${insuranceDays} días)`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Driver */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Conductor Principal
                </h3>
                {primaryDriver ? (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
                        <p className="font-medium text-gray-900">{primaryDriver.user.name}</p>
                        <p className="text-xs text-gray-500">{formatPhone(primaryDriver.user.phone)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleWhatsAppDriver(primaryDriver.user.phone)}
                      className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-gray-500">
                    <User className="h-5 w-5" />
                    <span>Sin conductor asignado</span>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Acciones
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={handleViewDocuments}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <span className="text-sm text-gray-700">Documentos ({vehicle._count?.documents || 0})</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                  <button
                    onClick={handleViewMaintenance}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-gray-400" />
                      <span className="text-sm text-gray-700">Mantenimientos ({vehicle._count?.maintenanceLogs || 0})</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                  {onEdit && (
                    <button
                      onClick={() => onEdit(vehicleId!)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Edit2 className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-700">Editar vehículo</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </button>
                  )}
                  <button
                    onClick={handleViewFull}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="text-sm font-medium">Ver página completa</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
