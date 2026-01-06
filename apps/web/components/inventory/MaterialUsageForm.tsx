/**
 * MaterialUsageForm Component
 * =============================
 *
 * Phase 2.2 Task 2.2.2: Add Manual Override Option
 *
 * This component handles material usage recording for jobs with:
 * - Automatic cascade mode (default): Vehicle first, warehouse fallback
 * - Manual mode: User selects specific source
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Building2, Package, AlertTriangle, Check, RefreshCw, ChevronDown, Info } from 'lucide-react';

interface MaterialItem {
    productId: string;
    productName: string;
    quantity: number;
}

interface Vehicle {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
}

interface Warehouse {
    id: string;
    name: string;
    code: string;
}

interface DeductionResult {
    productId: string;
    productName?: string;
    quantity: number;
    source: 'vehicle' | 'warehouse';
    sourceId?: string;
    sourceName?: string;
}

interface MaterialUsageFormProps {
    jobId: string;
    materials: MaterialItem[];
    assignedVehicle?: Vehicle | null;
    onSuccess?: (summary: string, deductions: DeductionResult[]) => void;
    onError?: (error: string) => void;
    className?: string;
}

export function MaterialUsageForm({
    jobId,
    materials,
    assignedVehicle,
    onSuccess,
    onError,
    className = '',
}: MaterialUsageFormProps) {
    const queryClient = useQueryClient();
    const [useManualSelection, setUseManualSelection] = useState(false);
    const [manualSource, setManualSource] = useState<'vehicle' | 'warehouse'>('vehicle');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [showAvailability, setShowAvailability] = useState(false);

    // Fetch warehouses for manual selection
    const { data: warehousesData } = useQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const res = await fetch('/api/inventory/warehouses');
            return res.json();
        },
        enabled: useManualSelection && manualSource === 'warehouse',
    });

    // Check availability
    const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
        queryKey: ['material-availability', jobId, materials],
        queryFn: async () => {
            const res = await fetch('/api/inventory/job-materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'checkAvailability',
                    jobId,
                    items: materials.map((m) => ({ productId: m.productId, quantity: m.quantity })),
                }),
            });
            return res.json();
        },
        enabled: showAvailability && materials.length > 0,
    });

    // Submit mutation
    const submitUsage = useMutation({
        mutationFn: async () => {
            const payload: Record<string, unknown> = {
                action: 'useCascade',
                jobId,
                items: materials.map((m) => ({ productId: m.productId, quantity: m.quantity })),
            };

            if (useManualSelection) {
                payload.manualOverride = true;
                if (manualSource === 'vehicle') {
                    payload.forceVehicle = true;
                    payload.vehicleId = assignedVehicle?.id;
                } else {
                    payload.forceWarehouse = true;
                    payload.warehouseId = selectedWarehouseId;
                }
            }

            const res = await fetch('/api/inventory/job-materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            return res.json();
        },
        onSuccess: (data) => {
            if (data.success) {
                queryClient.invalidateQueries({ queryKey: ['job-materials'] });
                onSuccess?.(data.message || data.data?.summary, data.data?.deductions || []);
            } else {
                onError?.(data.error || 'Error al registrar uso de materiales');
            }
        },
        onError: (error) => {
            onError?.(error instanceof Error ? error.message : 'Error desconocido');
        },
    });

    const warehouses = (warehousesData?.data || []) as Warehouse[];
    const availability = availabilityData?.data;

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Mode Selection */}
            <div className="rounded-lg border border-gray-200 p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={useManualSelection}
                        onChange={(e) => setUseManualSelection(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                        <span className="font-medium text-gray-900">Seleccionar origen manualmente</span>
                        <p className="text-sm text-gray-500">
                            Por defecto, los materiales se deducen automáticamente
                        </p>
                    </div>
                </label>

                {/* Auto Cascade Info */}
                {!useManualSelection && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3">
                        <Info className="mt-0.5 h-4 w-4 text-blue-600 flex-shrink-0" />
                        <p className="text-sm text-blue-700">
                            Los materiales se deducirán automáticamente del{' '}
                            <strong>vehículo asignado</strong>
                            {assignedVehicle && (
                                <span className="text-blue-600">
                                    {' '}({assignedVehicle.make} {assignedVehicle.model} - {assignedVehicle.plateNumber})
                                </span>
                            )}
                            . Si no hay stock suficiente, se usará el <strong>depósito</strong>.
                        </p>
                    </div>
                )}

                {/* Manual Source Selection */}
                {useManualSelection && (
                    <div className="mt-4 space-y-3">
                        {/* Vehicle Option */}
                        <label
                            className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${manualSource === 'vehicle'
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <input
                                type="radio"
                                name="manualSource"
                                value="vehicle"
                                checked={manualSource === 'vehicle'}
                                onChange={() => setManualSource('vehicle')}
                                className="sr-only"
                            />
                            <Truck className={`h-5 w-5 ${manualSource === 'vehicle' ? 'text-primary-600' : 'text-gray-400'}`} />
                            <div className="flex-1">
                                <span className={`font-medium ${manualSource === 'vehicle' ? 'text-primary-900' : 'text-gray-700'}`}>
                                    Deducir solo de vehículo
                                </span>
                                {assignedVehicle ? (
                                    <p className="text-sm text-gray-500">
                                        {assignedVehicle.make} {assignedVehicle.model} - {assignedVehicle.plateNumber}
                                    </p>
                                ) : (
                                    <p className="text-sm text-amber-600">Sin vehículo asignado</p>
                                )}
                            </div>
                            {manualSource === 'vehicle' && (
                                <Check className="h-5 w-5 text-primary-600" />
                            )}
                        </label>

                        {/* Warehouse Option */}
                        <label
                            className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${manualSource === 'warehouse'
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <input
                                type="radio"
                                name="manualSource"
                                value="warehouse"
                                checked={manualSource === 'warehouse'}
                                onChange={() => setManualSource('warehouse')}
                                className="sr-only"
                            />
                            <Building2 className={`h-5 w-5 ${manualSource === 'warehouse' ? 'text-primary-600' : 'text-gray-400'}`} />
                            <div className="flex-1">
                                <span className={`font-medium ${manualSource === 'warehouse' ? 'text-primary-900' : 'text-gray-700'}`}>
                                    Deducir solo de depósito
                                </span>
                                <p className="text-sm text-gray-500">Seleccionar depósito de origen</p>
                            </div>
                            {manualSource === 'warehouse' && (
                                <Check className="h-5 w-5 text-primary-600" />
                            )}
                        </label>

                        {/* Warehouse Selector */}
                        {manualSource === 'warehouse' && (
                            <div className="ml-8">
                                <select
                                    value={selectedWarehouseId}
                                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                                    className="input w-full"
                                >
                                    <option value="">Seleccionar depósito...</option>
                                    {warehouses.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.name} ({w.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Availability Check */}
            <div className="rounded-lg border border-gray-200 p-4">
                <button
                    type="button"
                    onClick={() => setShowAvailability(!showAvailability)}
                    className="flex w-full items-center justify-between text-left"
                >
                    <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-gray-500" />
                        <span className="font-medium text-gray-900">
                            Ver disponibilidad ({materials.length} productos)
                        </span>
                    </div>
                    <ChevronDown
                        className={`h-5 w-5 text-gray-400 transition-transform ${showAvailability ? 'rotate-180' : ''}`}
                    />
                </button>

                {showAvailability && (
                    <div className="mt-4 space-y-2">
                        {availabilityLoading ? (
                            <div className="flex items-center gap-2 text-gray-500">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Verificando disponibilidad...</span>
                            </div>
                        ) : availability?.details ? (
                            <>
                                {availability.details.map((item: {
                                    productId: string;
                                    productName: string;
                                    required: number;
                                    vehicleAvailable: number;
                                    warehouseAvailable: number;
                                    canFulfill: boolean;
                                    suggestedSource: string;
                                }) => (
                                    <div
                                        key={item.productId}
                                        className={`flex items-center justify-between rounded-lg p-3 ${item.canFulfill ? 'bg-gray-50' : 'bg-red-50'
                                            }`}
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">{item.productName}</p>
                                            <p className="text-sm text-gray-500">Necesario: {item.required}</p>
                                        </div>
                                        <div className="text-right text-sm">
                                            <div className="flex items-center gap-1">
                                                <Truck className="h-3 w-3 text-gray-400" />
                                                <span className={item.vehicleAvailable >= item.required ? 'text-green-600' : 'text-gray-500'}>
                                                    {item.vehicleAvailable}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Building2 className="h-3 w-3 text-gray-400" />
                                                <span className={item.warehouseAvailable >= item.required ? 'text-green-600' : 'text-gray-500'}>
                                                    {item.warehouseAvailable}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            {item.canFulfill ? (
                                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.suggestedSource === 'vehicle'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {item.suggestedSource === 'vehicle' ? 'Vehículo' : 'Depósito'}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Insuficiente
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {!availability.available && (
                                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span className="text-sm">
                                            Algunos productos no tienen stock suficiente
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Submit Button */}
            <button
                type="button"
                onClick={() => submitUsage.mutate()}
                disabled={
                    submitUsage.isPending ||
                    materials.length === 0 ||
                    (useManualSelection && manualSource === 'warehouse' && !selectedWarehouseId) ||
                    (useManualSelection && manualSource === 'vehicle' && !assignedVehicle)
                }
                className="btn-primary w-full"
            >
                {submitUsage.isPending ? (
                    <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Registrando uso...
                    </span>
                ) : (
                    'Registrar Uso de Materiales'
                )}
            </button>
        </div>
    );
}
