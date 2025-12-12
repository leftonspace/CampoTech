'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Truck,
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  FileText,
  Users,
  Settings,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Fuel,
  Gauge,
  Upload,
  X,
  UserPlus,
  Crown,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';

interface VehicleDocument {
  id: string;
  type: string;
  name: string;
  fileUrl: string;
  expiryDate: string | null;
  expiryStatus: 'valid' | 'expiring_soon' | 'expired' | 'no_expiry';
  notes: string | null;
  createdAt: string;
}

interface VehicleAssignment {
  id: string;
  isPrimaryDriver: boolean;
  startDate: string;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    phone: string;
  };
}

interface MaintenanceLog {
  id: string;
  type: string;
  description: string;
  mileageAtService: number | null;
  cost: number | null;
  serviceDate: string;
  nextServiceDate: string | null;
}

interface Vehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  vin: string | null;
  status: string;
  fuelType: string;
  currentMileage: number | null;
  insuranceExpiry: string | null;
  vtvExpiry: string | null;
  registrationExpiry: string | null;
  notes: string | null;
  assignments: VehicleAssignment[];
  documents: VehicleDocument[];
  maintenanceLogs: MaintenanceLog[];
  complianceAlerts: string[];
  isCompliant: boolean;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'Activo', color: 'text-green-700', bgColor: 'bg-green-100' },
  MAINTENANCE: { label: 'Mantenimiento', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  INACTIVE: { label: 'Inactivo', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const fuelTypeLabels: Record<string, string> = {
  GASOLINE: 'Nafta',
  DIESEL: 'Diesel',
  GNC: 'GNC',
  ELECTRIC: 'Eléctrico',
  HYBRID: 'Híbrido',
};

const documentTypeLabels: Record<string, string> = {
  TARJETA_VERDE: 'Tarjeta Verde',
  SEGURO: 'Póliza de Seguro',
  VTV: 'VTV',
  CEDULA_AZUL: 'Cédula Azul',
  MULTA: 'Multa',
  FACTURA_MANTENIMIENTO: 'Factura Mantenimiento',
  OTRO: 'Otro',
};

const maintenanceTypeLabels: Record<string, string> = {
  OIL_CHANGE: 'Cambio de Aceite',
  TIRE_ROTATION: 'Rotación de Neumáticos',
  BRAKE_SERVICE: 'Servicio de Frenos',
  GENERAL_SERVICE: 'Service General',
  REPAIR: 'Reparación',
  INSPECTION: 'Inspección',
  OTHER: 'Otro',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return 'No especificado';
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

async function fetchVehicle(id: string): Promise<{ success: boolean; data: Vehicle }> {
  const res = await fetch(`/api/vehicles/${id}`);
  if (!res.ok) throw new Error('Error cargando vehículo');
  return res.json();
}

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const vehicleId = params.id as string;

  const [activeTab, setActiveTab] = useState<'documents' | 'maintenance' | 'drivers'>('documents');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => fetchVehicle(vehicleId),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error eliminando vehículo');
      return res.json();
    },
    onSuccess: () => {
      router.push('/dashboard/fleet');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="rounded-lg bg-red-50 p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
        <p className="mt-2 text-red-600">Error cargando vehículo</p>
        <Link href="/dashboard/fleet" className="mt-2 text-sm text-primary-600 hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  const vehicle = data.data;
  const status = statusConfig[vehicle.status] || statusConfig.INACTIVE;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/fleet"
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{vehicle.plateNumber}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.bgColor} ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {vehicle.make} {vehicle.model} ({vehicle.year})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/fleet/${vehicleId}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </button>
        </div>
      </div>

      {/* Compliance Alert */}
      {!vehicle.isCompliant && vehicle.complianceAlerts.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800">Alertas de Cumplimiento</h3>
              <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                {vehicle.complianceAlerts.map((alert, i) => (
                  <li key={i}>{alert}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Info Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Details Card */}
        <div className="rounded-lg bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalles del Vehículo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Marca</p>
              <p className="font-medium text-gray-900">{vehicle.make}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Modelo</p>
              <p className="font-medium text-gray-900">{vehicle.model}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Año</p>
              <p className="font-medium text-gray-900">{vehicle.year}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Color</p>
              <p className="font-medium text-gray-900">{vehicle.color || 'No especificado'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Combustible</p>
              <p className="font-medium text-gray-900">{fuelTypeLabels[vehicle.fuelType] || vehicle.fuelType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Kilometraje</p>
              <p className="font-medium text-gray-900">
                {vehicle.currentMileage ? `${vehicle.currentMileage.toLocaleString('es-AR')} km` : 'No registrado'}
              </p>
            </div>
            {vehicle.vin && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500">VIN/Chasis</p>
                <p className="font-medium text-gray-900 font-mono">{vehicle.vin}</p>
              </div>
            )}
            {vehicle.notes && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Notas</p>
                <p className="text-gray-900">{vehicle.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Compliance Card */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vencimientos</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">VTV</span>
              </div>
              <span className="text-sm font-medium">{formatDate(vehicle.vtvExpiry)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Seguro</span>
              </div>
              <span className="text-sm font-medium">{formatDate(vehicle.insuranceExpiry)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Registro</span>
              </div>
              <span className="text-sm font-medium">{formatDate(vehicle.registrationExpiry)}</span>
            </div>
            <div className="border-t pt-4 mt-4">
              {vehicle.isCompliant ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">En cumplimiento</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Requiere atención</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-4 w-4 inline-block mr-2" />
            Documentos ({vehicle.documents.length})
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'maintenance'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings className="h-4 w-4 inline-block mr-2" />
            Mantenimiento ({vehicle.maintenanceLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'drivers'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="h-4 w-4 inline-block mr-2" />
            Conductores ({vehicle.assignments.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="rounded-lg bg-white shadow-sm">
        {activeTab === 'documents' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Documentos</h3>
              <button className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                <Upload className="h-4 w-4" />
                Subir Documento
              </button>
            </div>
            {vehicle.documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2">No hay documentos cargados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicle.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{doc.name}</p>
                        <p className="text-sm text-gray-500">
                          {documentTypeLabels[doc.type] || doc.type}
                          {doc.expiryDate && ` • Vence: ${formatDate(doc.expiryDate)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.expiryStatus === 'expired' && (
                        <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded">
                          Vencido
                        </span>
                      )}
                      {doc.expiryStatus === 'expiring_soon' && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded">
                          Por vencer
                        </span>
                      )}
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline text-sm"
                      >
                        Ver
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Historial de Mantenimiento</h3>
              <button className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                <Plus className="h-4 w-4" />
                Registrar Servicio
              </button>
            </div>
            {vehicle.maintenanceLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Settings className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2">No hay registros de mantenimiento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicle.maintenanceLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {maintenanceTypeLabels[log.type] || log.type}
                      </p>
                      <p className="text-sm text-gray-500">{log.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(log.serviceDate)}
                        {log.mileageAtService && ` • ${log.mileageAtService.toLocaleString('es-AR')} km`}
                      </p>
                    </div>
                    {log.cost && (
                      <p className="font-medium text-gray-900">
                        ${log.cost.toLocaleString('es-AR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Conductores Asignados</h3>
              <button className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                <UserPlus className="h-4 w-4" />
                Asignar Conductor
              </button>
            </div>
            {vehicle.assignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2">No hay conductores asignados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicle.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      {assignment.user.avatar ? (
                        <img
                          src={assignment.user.avatar}
                          alt={assignment.user.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600 font-medium">
                          {getInitials(assignment.user.name)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{assignment.user.name}</p>
                          {assignment.isPrimaryDriver && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                              <Crown className="h-3 w-3" />
                              Principal
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{assignment.user.phone}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Desde {formatDate(assignment.startDate)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Eliminar Vehículo</h3>
            <p className="mt-2 text-sm text-gray-500">
              ¿Estás seguro de que deseas eliminar el vehículo {vehicle.plateNumber}? Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
