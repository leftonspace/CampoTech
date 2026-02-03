'use client';

import Image from 'next/image';

import {
  Truck,
  Users,
  FileText,
  Settings,
  AlertTriangle,
  CheckCircle,
  Fuel,
  Gauge,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';

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

interface VehicleCardProps {
  vehicle: Vehicle;
  onClick?: () => void;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'Activo', color: 'text-green-700', bgColor: 'bg-green-100' },
  MAINTENANCE: { label: 'Mantenimiento', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  INACTIVE: { label: 'Inactivo', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const fuelTypeLabels: Record<string, string> = {
  GASOLINE: 'Nafta',
  DIESEL: 'Diésel',
  GNC: 'GNC',
  ELECTRIC: 'Eléctrico',
  HYBRID: 'Híbrido',
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

export function VehicleCard({ vehicle, onClick }: VehicleCardProps) {
  const status = statusConfig[vehicle.status] || statusConfig.INACTIVE;
  const primaryDriver = vehicle.assignments.find((a) => a.isPrimaryDriver);
  const otherDrivers = vehicle.assignments.filter((a) => !a.isPrimaryDriver);

  const insuranceDays = getDaysUntil(vehicle.insuranceExpiry);
  const vtvDays = getDaysUntil(vehicle.vtvExpiry);
  const _registrationDays = getDaysUntil(vehicle.registrationExpiry);

  return (
    <div
      onClick={onClick}
      className="block rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <Truck className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{vehicle.plateNumber}</h3>
            <p className="text-sm text-gray-500">
              {vehicle.make} {vehicle.model} ({vehicle.year})
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.bgColor} ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Vehicle details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {vehicle.color && (
            <div className="flex items-center gap-2 text-gray-600">
              <div
                className="h-3 w-3 rounded-full border border-gray-300"
                style={{
                  backgroundColor: vehicle.color.toLowerCase().includes('blanco')
                    ? '#ffffff'
                    : vehicle.color.toLowerCase().includes('negro')
                      ? '#1f2937'
                      : vehicle.color.toLowerCase().includes('gris')
                        ? '#6b7280'
                        : vehicle.color.toLowerCase().includes('rojo')
                          ? '#dc2626'
                          : vehicle.color.toLowerCase().includes('azul')
                            ? '#2563eb'
                            : vehicle.color.toLowerCase().includes('verde')
                              ? '#16a34a'
                              : '#9ca3af',
                }}
              />
              <span>{vehicle.color}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600">
            <Fuel className="h-4 w-4 text-gray-400" />
            <span>{fuelTypeLabels[vehicle.fuelType] || vehicle.fuelType}</span>
          </div>
          {vehicle.currentMileage && (
            <div className="flex items-center gap-2 text-gray-600 col-span-2">
              <Gauge className="h-4 w-4 text-gray-400" />
              <span>{vehicle.currentMileage.toLocaleString('es-AR')} km</span>
            </div>
          )}
        </div>

        {/* Compliance alerts */}
        {!vehicle.isCompliant && vehicle.complianceAlerts.length > 0 && (
          <div className="rounded-lg bg-red-50 p-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-700">
                {vehicle.complianceAlerts.map((alert, i) => (
                  <p key={i}>{alert}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {vehicle.isCompliant && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>En cumplimiento</span>
          </div>
        )}

        {/* Expiry dates */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">VTV:</span>
            <span className={vtvDays !== null && vtvDays <= 30 ? 'text-red-600 font-medium' : 'text-gray-700'}>
              {formatDate(vehicle.vtvExpiry)}
              {vtvDays !== null && vtvDays <= 30 && vtvDays > 0 && ` (${vtvDays} días)`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Seguro:</span>
            <span className={insuranceDays !== null && insuranceDays <= 30 ? 'text-red-600 font-medium' : 'text-gray-700'}>
              {formatDate(vehicle.insuranceExpiry)}
              {insuranceDays !== null && insuranceDays <= 30 && insuranceDays > 0 && ` (${insuranceDays} días)`}
            </span>
          </div>
        </div>

        {/* Drivers */}
        <div className="border-t pt-3">
          {primaryDriver ? (
            <div className="flex items-center gap-2">
              {primaryDriver.user.avatar ? (
                <Image
                  src={primaryDriver.user.avatar}
                  alt={primaryDriver.user.name}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-xs font-medium">
                  {getInitials(primaryDriver.user.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {primaryDriver.user.name}
                </p>
                <p className="text-xs text-gray-500">Conductor principal</p>
              </div>
              {otherDrivers.length > 0 && (
                <div className="flex -space-x-2">
                  {otherDrivers.slice(0, 2).map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-600 text-xs font-medium ring-2 ring-white"
                      title={assignment.user.name}
                    >
                      {getInitials(assignment.user.name)}
                    </div>
                  ))}
                  {otherDrivers.length > 2 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-gray-600 text-xs font-medium ring-2 ring-white">
                      +{otherDrivers.length - 2}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="h-4 w-4" />
              <span>Sin conductor asignado</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 border-t pt-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            <span>{vehicle._count.documents} docs</span>
          </div>
          <div className="flex items-center gap-1">
            <Settings className="h-3.5 w-3.5" />
            <span>{vehicle._count.maintenanceLogs} mant.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
