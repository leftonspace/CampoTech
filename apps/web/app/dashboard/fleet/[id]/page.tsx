'use client';

import { useState, useEffect } from 'react';
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
  Package,
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

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  role: string;
}

interface InventoryItem {
  id: string;
  item: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    category: string;
    unit: string;
    minStockLevel: number;
    costPrice: number;
    salePrice: number;
    imageUrl: string | null;
  };
  quantity: number;
  value: number;
  status: 'OK' | 'LOW' | 'OUT';
  lastCountedAt: string | null;
}

interface VehicleInventory {
  vehicle: { id: string; plateNumber: string; make: string; model: string };
  location: { id: string; name: string; isActive: boolean } | null;
  items: InventoryItem[];
  summary: {
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
  };
  alerts: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    minLevel: number;
    status: 'LOW' | 'OUT';
  }>;
}

interface AvailableItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
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
  INSURANCE: 'Seguro',
  VTV: 'VTV',
  REGISTRATION: 'Registro',
  TITLE: 'Título',
  GREEN_CARD: 'Tarjeta Verde',
  SERVICE_RECORD: 'Registro de Servicio',
  OTHER: 'Otro',
};

const documentTypeOptions = [
  { value: 'INSURANCE', label: 'Seguro' },
  { value: 'VTV', label: 'VTV' },
  { value: 'REGISTRATION', label: 'Registro' },
  { value: 'TITLE', label: 'Título' },
  { value: 'GREEN_CARD', label: 'Tarjeta Verde' },
  { value: 'SERVICE_RECORD', label: 'Registro de Servicio' },
  { value: 'OTHER', label: 'Otro' },
];

const maintenanceTypeLabels: Record<string, string> = {
  OIL_CHANGE: 'Cambio de Aceite',
  TIRE_ROTATION: 'Rotación de Neumáticos',
  BRAKE_SERVICE: 'Servicio de Frenos',
  INSPECTION: 'Inspección',
  REPAIR: 'Reparación',
  SCHEDULED_SERVICE: 'Service Programado',
  OTHER: 'Otro',
};

const maintenanceTypeOptions = [
  { value: 'OIL_CHANGE', label: 'Cambio de Aceite' },
  { value: 'TIRE_ROTATION', label: 'Rotación de Neumáticos' },
  { value: 'BRAKE_SERVICE', label: 'Servicio de Frenos' },
  { value: 'INSPECTION', label: 'Inspección' },
  { value: 'REPAIR', label: 'Reparación' },
  { value: 'SCHEDULED_SERVICE', label: 'Service Programado' },
  { value: 'OTHER', label: 'Otro' },
];

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

async function fetchTeamMembers(): Promise<{ success: boolean; data: { members: TeamMember[] } }> {
  const res = await fetch('/api/team');
  if (!res.ok) throw new Error('Error cargando equipo');
  return res.json();
}

async function fetchVehicleInventory(vehicleId: string): Promise<{ success: boolean; data: VehicleInventory }> {
  const res = await fetch(`/api/vehicles/${vehicleId}/inventory`);
  if (!res.ok) throw new Error('Error cargando inventario');
  return res.json();
}

async function fetchAvailableItems(): Promise<{ success: boolean; data: { items: AvailableItem[] } }> {
  const res = await fetch('/api/inventory/items?isActive=true');
  if (!res.ok) throw new Error('Error cargando artículos');
  return res.json();
}

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const vehicleId = params.id as string;

  const [activeTab, setActiveTab] = useState<'documents' | 'maintenance' | 'drivers' | 'inventory'>('documents');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Modal states
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  // Form states
  const [documentForm, setDocumentForm] = useState({
    documentType: 'OTHER',
    fileName: '',
    fileUrl: '',
    expiryDate: '',
    notes: '',
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenanceType: 'OTHER',
    description: '',
    mileageAtService: '',
    cost: '',
    vendor: '',
    completedDate: new Date().toISOString().split('T')[0],
    nextServiceDate: '',
    notes: '',
  });

  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isPrimaryDriver, setIsPrimaryDriver] = useState(false);

  const [inventoryForm, setInventoryForm] = useState({
    itemId: '',
    quantity: '',
    action: 'set' as 'set' | 'add' | 'remove',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => fetchVehicle(vehicleId),
  });

  const { data: teamData } = useQuery({
    queryKey: ['team'],
    queryFn: fetchTeamMembers,
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['vehicle-inventory', vehicleId],
    queryFn: () => fetchVehicleInventory(vehicleId),
    enabled: activeTab === 'inventory',
  });

  const { data: availableItemsData } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: fetchAvailableItems,
    enabled: showInventoryModal,
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

  // Document upload mutation
  const documentMutation = useMutation({
    mutationFn: async (data: typeof documentForm) => {
      const res = await fetch(`/api/vehicles/${vehicleId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error subiendo documento');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      setShowDocumentModal(false);
      setDocumentForm({ documentType: 'OTHER', fileName: '', fileUrl: '', expiryDate: '', notes: '' });
    },
  });

  // Maintenance mutation
  const maintenanceMutation = useMutation({
    mutationFn: async (data: typeof maintenanceForm) => {
      const res = await fetch(`/api/vehicles/${vehicleId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error registrando mantenimiento');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      setShowMaintenanceModal(false);
      setMaintenanceForm({
        maintenanceType: 'OTHER',
        description: '',
        mileageAtService: '',
        cost: '',
        vendor: '',
        completedDate: new Date().toISOString().split('T')[0],
        nextServiceDate: '',
        notes: '',
      });
    },
  });

  // Driver assignment mutation
  const assignDriverMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vehicles/${vehicleId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedDriverId, isPrimaryDriver }),
      });
      if (!res.ok) throw new Error('Error asignando conductor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      setShowDriverModal(false);
      setSelectedDriverId('');
      setIsPrimaryDriver(false);
    },
  });

  // Remove driver mutation
  const removeDriverMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/vehicles/${vehicleId}/assign?userId=${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error removiendo conductor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
    },
  });

  // Inventory mutation
  const inventoryMutation = useMutation({
    mutationFn: async (data: typeof inventoryForm) => {
      const res = await fetch(`/api/vehicles/${vehicleId}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error actualizando inventario');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-inventory', vehicleId] });
      setShowInventoryModal(false);
      setInventoryForm({ itemId: '', quantity: '', action: 'set' });
    },
  });

  // Remove item from inventory mutation
  const removeInventoryMutation = useMutation({
    mutationFn: async (stockId: string) => {
      const res = await fetch(`/api/vehicles/${vehicleId}/inventory?stockId=${stockId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error eliminando artículo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-inventory', vehicleId] });
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

  // Filter out already assigned drivers for the dropdown
  const assignedUserIds = vehicle.assignments.map(a => a.user.id);
  const availableDrivers = teamData?.data?.members?.filter(m => !assignedUserIds.includes(m.id)) || [];

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
          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'inventory'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="h-4 w-4 inline-block mr-2" />
            Inventario
            {inventoryData?.data?.summary?.lowStockItems ? (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                {inventoryData.data.summary.lowStockItems}
              </span>
            ) : null}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="rounded-lg bg-white shadow-sm">
        {activeTab === 'documents' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Documentos</h3>
              <button
                onClick={() => setShowDocumentModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
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
              <button
                onClick={() => setShowMaintenanceModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
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
              <button
                onClick={() => setShowDriverModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
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
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-gray-500">
                        Desde {formatDate(assignment.startDate)}
                      </p>
                      <button
                        onClick={() => removeDriverMutation.mutate(assignment.user.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Inventario del Vehículo</h3>
              <button
                onClick={() => setShowInventoryModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                Agregar Artículo
              </button>
            </div>

            {/* Low Stock Alerts */}
            {inventoryData?.data?.alerts && inventoryData.data.alerts.length > 0 && (
              <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Alertas de Stock Bajo</h4>
                    <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                      {inventoryData.data.alerts.map((alert) => (
                        <li key={alert.itemId}>
                          {alert.itemName}: {alert.quantity} unidades
                          {alert.status === 'OUT' ? ' (Agotado)' : ` (Mín: ${alert.minLevel})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            {inventoryData?.data?.summary && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Total Artículos</p>
                  <p className="text-2xl font-bold text-gray-900">{inventoryData.data.summary.totalItems}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Valor Total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${inventoryData.data.summary.totalValue.toLocaleString('es-AR')}
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 p-4">
                  <p className="text-sm text-amber-600">Stock Bajo</p>
                  <p className="text-2xl font-bold text-amber-700">{inventoryData.data.summary.lowStockItems}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-sm text-red-600">Agotados</p>
                  <p className="text-2xl font-bold text-red-700">{inventoryData.data.summary.outOfStockItems}</p>
                </div>
              </div>
            )}

            {inventoryLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : !inventoryData?.data?.items?.length ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2">No hay artículos en el inventario del vehículo</p>
                <p className="text-sm">Agrega artículos para llevar control del stock en este vehículo.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artículo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventoryData.data.items.map((stock) => (
                      <tr key={stock.id} className={stock.status !== 'OK' ? 'bg-amber-50/50' : ''}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{stock.item.name}</p>
                          <p className="text-xs text-gray-500">{stock.item.category}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">{stock.item.sku}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-medium text-gray-900">{stock.quantity}</span>
                          <span className="text-gray-500 text-sm ml-1">{stock.item.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {stock.status === 'OK' && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                              OK
                            </span>
                          )}
                          {stock.status === 'LOW' && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                              Stock Bajo
                            </span>
                          )}
                          {stock.status === 'OUT' && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                              Agotado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          ${stock.value.toLocaleString('es-AR')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeInventoryMutation.mutate(stock.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

      {/* Document Upload Modal */}
      {showDocumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Subir Documento</h3>
              <button onClick={() => setShowDocumentModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); documentMutation.mutate(documentForm); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de documento</label>
                <select
                  value={documentForm.documentType}
                  onChange={(e) => setDocumentForm({ ...documentForm, documentType: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  required
                >
                  {documentTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del archivo</label>
                <input
                  type="text"
                  value={documentForm.fileName}
                  onChange={(e) => setDocumentForm({ ...documentForm, fileName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Ej: Póliza de seguro 2024"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL del archivo</label>
                <input
                  type="url"
                  value={documentForm.fileUrl}
                  onChange={(e) => setDocumentForm({ ...documentForm, fileUrl: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="https://..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento</label>
                <input
                  type="date"
                  value={documentForm.expiryDate}
                  onChange={(e) => setDocumentForm({ ...documentForm, expiryDate: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={documentForm.notes}
                  onChange={(e) => setDocumentForm({ ...documentForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDocumentModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={documentMutation.isPending}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {documentMutation.isPending ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Registrar Servicio</h3>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); maintenanceMutation.mutate(maintenanceForm); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de servicio</label>
                <select
                  value={maintenanceForm.maintenanceType}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenanceType: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  required
                >
                  {maintenanceTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Descripción del servicio realizado"
                  rows={2}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kilometraje</label>
                  <input
                    type="number"
                    value={maintenanceForm.mileageAtService}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, mileageAtService: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                    placeholder="Km"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo</label>
                  <input
                    type="number"
                    value={maintenanceForm.cost}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                    placeholder="$"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor/Taller</label>
                <input
                  type="text"
                  value={maintenanceForm.vendor}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vendor: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Nombre del taller"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del servicio</label>
                  <input
                    type="date"
                    value={maintenanceForm.completedDate}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, completedDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Próximo servicio</label>
                  <input
                    type="date"
                    value={maintenanceForm.nextServiceDate}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextServiceDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={maintenanceForm.notes}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={maintenanceMutation.isPending}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {maintenanceMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Assignment Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Asignar Conductor</h3>
              <button onClick={() => setShowDriverModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            {availableDrivers.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Users className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-2">No hay conductores disponibles</p>
                <p className="text-sm">Todos los trabajadores ya están asignados o no hay trabajadores registrados.</p>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); assignDriverMutation.mutate(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar conductor</label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                    required
                  >
                    <option value="">Seleccione un conductor</option>
                    {availableDrivers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} - {member.phone}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={isPrimaryDriver}
                    onChange={(e) => setIsPrimaryDriver(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="isPrimary" className="text-sm text-gray-700">
                    Marcar como conductor principal
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDriverModal(false)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={assignDriverMutation.isPending || !selectedDriverId}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {assignDriverMutation.isPending ? 'Asignando...' : 'Asignar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {showInventoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Agregar Artículo al Inventario</h3>
              <button onClick={() => setShowInventoryModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); inventoryMutation.mutate(inventoryForm); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Artículo</label>
                <select
                  value={inventoryForm.itemId}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, itemId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  required
                >
                  <option value="">Seleccione un artículo</option>
                  {availableItemsData?.data?.items?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Acción</label>
                <select
                  value={inventoryForm.action}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, action: e.target.value as 'set' | 'add' | 'remove' })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="set">Establecer cantidad</option>
                  <option value="add">Agregar a existente</option>
                  <option value="remove">Restar de existente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                <input
                  type="number"
                  min="0"
                  value={inventoryForm.quantity}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, quantity: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="0"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInventoryModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inventoryMutation.isPending || !inventoryForm.itemId}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {inventoryMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
