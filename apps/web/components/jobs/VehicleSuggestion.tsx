/**
 * VehicleSuggestion Component
 * ============================
 *
 * Phase 2.1 Task 2.1.4: Integrate Vehicle Scheduling into Job Creation
 *
 * Displays the suggested vehicle for a job based on technician schedule.
 * Allows users to accept or override the suggestion.
 */

'use client';

import { Truck, Check, X, RefreshCw } from 'lucide-react';
import { useVehicleSuggestion, getMatchTypeLabel } from '@/hooks/useVehicleSuggestion';

interface VehicleSuggestionProps {
    technicianId: string | null;
    date: string | null;
    time?: string | null;
    selectedVehicleId: string | null;
    onVehicleSelect: (vehicleId: string | null) => void;
    onVehicleOverride?: () => void;
    className?: string;
}

export function VehicleSuggestion({
    technicianId,
    date,
    time,
    selectedVehicleId,
    onVehicleSelect,
    onVehicleOverride,
    className = '' }: VehicleSuggestionProps) {
    const { data, isLoading } = useVehicleSuggestion({
        technicianId,
        date,
        time,
        enabled: !!technicianId && !!date
    });

    // If no technician or date selected, don't show anything
    if (!technicianId || !date) {
        return null;
    }

    // Loading state
    if (isLoading) {
        return (
            <div className={`rounded-lg border border-gray-200 bg-gray-50 p-3 ${className}`}>
                <div className="flex items-center gap-2 text-gray-500">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Buscando vehículo asignado...</span>
                </div>
            </div>
        );
    }

    // No vehicle found
    if (!data?.vehicle) {
        return (
            <div className={`rounded-lg border border-amber-200 bg-amber-50 p-3 ${className}`}>
                <div className="flex items-center gap-2 text-amber-700">
                    <Truck className="h-4 w-4" />
                    <span className="text-sm">
                        No hay vehículo asignado para este técnico en esta fecha
                    </span>
                </div>
                {onVehicleOverride && (
                    <button
                        type="button"
                        onClick={onVehicleOverride}
                        className="mt-2 text-xs text-amber-700 hover:underline"
                    >
                        Seleccionar vehículo manualmente
                    </button>
                )}
            </div>
        );
    }

    const vehicle = data.vehicle;
    const matchType = data.matchType;
    const vehicleName = `${vehicle.make} ${vehicle.model} - ${vehicle.plateNumber}`;
    const isSelected = selectedVehicleId === vehicle.id;

    return (
        <div
            className={`rounded-lg border ${isSelected
                ? 'border-green-300 bg-green-50'
                : 'border-blue-200 bg-blue-50'
                } p-3 ${className}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                    <Truck className={`mt-0.5 h-4 w-4 ${isSelected ? 'text-green-600' : 'text-blue-600'}`} />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isSelected ? 'text-green-800' : 'text-blue-800'}`}>
                                {vehicleName}
                            </span>
                            {isSelected && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-200 px-2 py-0.5 text-xs font-medium text-green-800">
                                    <Check className="h-3 w-3" />
                                    Asignado
                                </span>
                            )}
                        </div>
                        <p className={`text-xs ${isSelected ? 'text-green-600' : 'text-blue-600'}`}>
                            Vehículo según horario ({getMatchTypeLabel(matchType)})
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {!isSelected ? (
                        <button
                            type="button"
                            onClick={() => onVehicleSelect(vehicle.id)}
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                            Usar
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onVehicleSelect(null)}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}

                    {onVehicleOverride && (
                        <button
                            type="button"
                            onClick={onVehicleOverride}
                            className="text-xs text-blue-600 hover:underline ml-2"
                        >
                            Cambiar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Compact version for job lists or summaries
 */
export function VehicleSuggestionCompact({
    technicianId,
    date,
    time }: {
        technicianId: string | null;
        date: string | null;
        time?: string | null;
    }) {
    const { data, isLoading } = useVehicleSuggestion({
        technicianId,
        date,
        time,
        enabled: !!technicianId && !!date
    });

    if (isLoading || !data?.vehicle) {
        return null;
    }

    const vehicle = data.vehicle;
    const matchType = data.matchType;

    return (
        <div className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            <Truck className="h-3 w-3" />
            <span>
                {vehicle.plateNumber} ({getMatchTypeLabel(matchType)})
            </span>
        </div>
    );
}
